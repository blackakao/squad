import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { CharacterViewer, disposeObject } from '../character-viewer/CharacterViewer.js';

// 기존 CharacterViewer의 렌더링 기반을 환경용 설정으로 확장합니다.
export const ART = Object.freeze({ characterHeight: 1.8, fov: 32, pixelRatio: 1.5 });

export function createView(host) {
  const base = new CharacterViewer(host);
  const { renderer, scene, camera, controls } = base;
  renderer.setAnimationLoop(null);
  scene.remove(base.grid);
  // 인물 감상용 보조광 대신 전장용 주광 하나를 유지합니다.
  const lights = scene.children.filter(object => object.isLight);
  lights.forEach(light => scene.remove(light));
  renderer.setPixelRatio(Math.min(devicePixelRatio, ART.pixelRatio));
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  camera.fov = ART.fov; camera.near = 0.1; camera.far = 150;
  const resize = base.resize.bind(base);
  base.resize = () => {
    resize();
    camera.zoom = Math.min(1, camera.aspect / 1.5);
    camera.updateProjectionMatrix();
  };
  base.resize();
  controls.minDistance = 8;
  controls.maxDistance = 48;
  controls.minPolarAngle = Math.PI / 8;
  controls.maxPolarAngle = Math.PI / 2.65;
  const hemi = lights.find(light => light.isHemisphereLight);
  const sun = lights.find(light => light.isDirectionalLight);
  sun.position.set(-6, 12, 8);
  sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 0.5, far: 45 });
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.normalBias = 0.04;
  scene.add(hemi, sun);
  return {
    renderer, scene, camera, controls,
    setCamera(preset) {
      camera.position.fromArray(preset.position);
      camera.fov = preset.fov ?? ART.fov;
      camera.updateProjectionMatrix();
      controls.target.fromArray(preset.target);
      controls.update();
    },
    setLighting(preset) {
      scene.background = new THREE.Color(preset.background);
      scene.fog = new THREE.Fog(preset.background, ...preset.fog);
      hemi.color.set(preset.sky); hemi.groundColor.set(preset.ground);
      hemi.intensity = preset.ambient;
      sun.color.set(preset.sun); sun.intensity = preset.intensity;
    },
    dispose() {
      sun.shadow.map?.dispose(); base.dispose();
    }
  };
}

export function disposeTree(root) {
  root.traverse(object => { if (object.isInstancedMesh) object.dispose(); });
  disposeObject(root);
}

export class AssetCache {
  constructor() { this.entries = new Map(); }
  async instantiate(path) {
    const url = new URL(path, location.href);
    if (url.origin !== location.origin || !url.pathname.toLowerCase().endsWith('.glb')) {
      throw new Error('같은 서버의 GLB 경로를 입력해 주세요.');
    }
    const key = url.href;
    if (!this.entries.has(key)) {
      const manager = new THREE.LoadingManager();
      let resourceFailed = false;
      manager.onError = () => { resourceFailed = true; };
      this.entries.set(key, new GLTFLoader(manager).loadAsync(key).then(gltf => {
        if (resourceFailed) {
          const owner = new THREE.Group(); gltf.scenes.forEach(scene => owner.add(scene)); disposeTree(owner);
          throw new Error('GLB 참조 리소스를 불러오지 못했습니다.');
        }
        return gltf;
      }).catch(() => {
        this.entries.delete(key);
        throw new Error('GLB를 불러오지 못했습니다. 경로와 파일 형식을 확인해 주세요.');
      }));
    }
    const gltf = await this.entries.get(key);
    return { root: clone(gltf.scene), animations: gltf.animations };
  }
  async dispose() {
    const entries = await Promise.allSettled(this.entries.values());
    entries.forEach(entry => {
      if (entry.status === 'fulfilled') {
        const owner = new THREE.Group(); entry.value.scenes.forEach(scene => owner.add(scene)); disposeTree(owner);
      }
    });
    this.entries.clear();
  }
}

export function createCharacter(root, animations = []) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const height = box.max.y - box.min.y;
  if (!Number.isFinite(height) || height <= 0) throw new Error('캐릭터의 유효한 높이를 계산할 수 없습니다.');
  const scale = ART.characterHeight / height;
  const centered = new THREE.Group();
  centered.add(root);
  // 애니메이션이 원본 위치를 바꿔도 정규화 변환은 별도 부모에 유지합니다.
  centered.position.set(-(box.min.x + box.max.x) * scale / 2, -box.min.y * scale, -(box.min.z + box.max.z) * scale / 2);
  centered.scale.setScalar(scale);
  const group = new THREE.Group(); group.add(centered);
  root.traverse(object => { if (object.isMesh) object.castShadow = true; });
  const mixer = new THREE.AnimationMixer(root);
  if (animations.length) mixer.clipAction(animations[0]).play();
  return { group, update: delta => mixer.update(delta), dispose() {
    mixer.stopAllAction(); mixer.uncacheRoot(root);
    // 복제된 Skeleton만 해제하고 캐시 소유 Mesh/Material은 유지합니다.
    const skeletons = new Set(); root.traverse(object => { if (object.skeleton) skeletons.add(object.skeleton); });
    skeletons.forEach(skeleton => skeleton.dispose());
  } };
}
