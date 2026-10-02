import * as THREE from 'three';
import { instancePlacements } from './assets.js';

export async function loadStage(url) {
  let data;
  try {
    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) throw new Error();
    data = await response.json();
  } catch {
    throw new Error('Stage 데이터를 불러오지 못했습니다. 경로와 JSON 문법을 확인해 주세요.');
  }
  return validateStage(data);
}

export function validateStage(data) {
  const vector = value => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const lighting = preset => object(preset)
    && ['background', 'sky', 'ground', 'sun'].every(key => /^#[0-9a-f]{6}$/i.test(preset[key]))
    && ['ambient', 'intensity'].every(key => Number.isFinite(preset[key]) && preset[key] >= 0)
    && Array.isArray(preset.fog) && preset.fog.length === 2 && preset.fog.every(Number.isFinite)
    && preset.fog[0] >= 0 && preset.fog[1] > preset.fog[0];
  if (!object(data) || data.version !== 1 || typeof data.id !== 'string' || typeof data.name !== 'string'
    || !Array.isArray(data.placements) || !Array.isArray(data.spawnPoints) || data.spawnPoints.length === 0
    || !vector(data.camera?.position) || !vector(data.camera?.target)
    || (data.camera.fov !== undefined && (!Number.isFinite(data.camera.fov) || data.camera.fov <= 0 || data.camera.fov >= 120))
    || !lighting(data.lighting?.day) || !lighting(data.lighting?.evening)
    || data.placements.some(p => !object(p) || typeof p.asset !== 'string' || !vector(p.position) || (p.scale !== undefined && (!vector(p.scale) || p.scale.some(v => v <= 0))) || (p.rotationY !== undefined && !Number.isFinite(p.rotationY)))
    || data.spawnPoints.some(p => !object(p) || typeof p.id !== 'string' || !p.id || !vector(p.position) || !Number.isFinite(p.rotationY))
    || new Set(data.spawnPoints.map(p => p.id)).size !== data.spawnPoints.length
    || !Number.isInteger(data.effects?.leaves?.count) || data.effects.leaves.count < 0 || data.effects.leaves.count > 200
    || !object(data.assetDescriptions)
    || (data.assetSources !== undefined && (!object(data.assetSources) || Object.values(data.assetSources).some(path => typeof path !== 'string')))) {
    throw new Error('Stage 형식, 좌표 또는 SpawnPoint 식별자가 올바르지 않습니다.');
  }
  return data;
}

export async function loadEnvironmentModels(data, cache) {
  const models = new Map();
  // GLB는 바닥 중심 원점과 실제 단위로 제작한 정적 환경 모델만 허용합니다.
  for (const [id, path] of Object.entries(data.assetSources ?? {})) {
    const { root, animations } = await cache.instantiate(path);
    let unsupported = animations.length > 0;
    root.traverse(part => {
      if (part.isSkinnedMesh || part.isInstancedMesh || part.morphTargetInfluences?.length) unsupported = true;
      if (part.isMesh) part.castShadow = true;
    });
    if (unsupported) throw new Error(`환경 GLB는 애니메이션과 변형이 없는 정적 Mesh여야 합니다: ${id}`);
    models.set(id, root);
  }
  return models;
}

export function buildStage(data, assets, models = new Map()) {
  const root = new THREE.Group(); root.name = data.id;
  const buckets = new Map();
  for (const placement of data.placements) {
    if (!buckets.has(placement.asset)) buckets.set(placement.asset, []);
    buckets.get(placement.asset).push(placement);
  }
  // 원형을 먼저 확인해 잘못된 Asset 참조에서 GPU 인스턴스가 누적되지 않게 합니다.
  const prototype = id => models.get(id) ?? assets.get(id);
  buckets.forEach((placements, id) => prototype(id));
  buckets.forEach((placements, id) => root.add(instancePlacements(prototype(id), placements)));
  const markers = new THREE.Group(); root.add(markers);
  const markerGeometry = new THREE.TorusGeometry(0.4, 0.025, 6, 24);
  const markerMaterials = ['#397aa0', '#b86851', '#aa8b41'].map(color => new THREE.MeshBasicMaterial({ color }));
  data.spawnPoints.forEach(point => {
    const material = markerMaterials[point.id.startsWith('Player') ? 0 : point.id === 'Boss' ? 2 : 1];
    const marker = new THREE.Mesh(markerGeometry, material);
    marker.rotation.x = -Math.PI / 2; marker.position.fromArray(point.position); marker.position.y += 0.09; markers.add(marker);
  });
  const grid = new THREE.GridHelper(20, 20, '#536d60', '#9eaf87'); grid.position.y = 0.085; root.add(grid);
  const leafGeometry = new THREE.BufferGeometry();
  const count = data.effects.leaves.count;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = Math.sin(i * 47.3) * 9;
    positions[i * 3 + 1] = 1 + (i * 0.73 % 4);
    positions[i * 3 + 2] = -4 - (i % 5) * 0.5;
  }
  leafGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const leafMaterial = new THREE.PointsMaterial({ color: '#c2b878', size: 0.075 });
  const leaves = new THREE.Points(leafGeometry, leafMaterial); leaves.frustumCulled = false; root.add(leaves);
  return {
    root, markers, grid, leaves,
    update(delta) {
      if (!leaves.visible) return;
      for (let i = 0; i < count; i++) {
        positions[i * 3 + 1] -= delta * 0.24;
        if (positions[i * 3 + 1] < 0.15) positions[i * 3 + 1] = 4.5;
      }
      leafGeometry.attributes.position.needsUpdate = true;
    },
    dispose() {
      root.removeFromParent(); root.traverse(object => { if (object.isInstancedMesh) object.dispose(); });
      markerGeometry.dispose(); markerMaterials.forEach(material => material.dispose());
      grid.geometry.dispose(); [].concat(grid.material).forEach(material => material.dispose());
      leafGeometry.dispose(); leafMaterial.dispose();
    }
  };
}
