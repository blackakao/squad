import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { disposeTree } from '../three/core.js';

// 모든 원형은 바닥 중심이 원점이며, 복제 시 Geometry와 Material을 공유합니다.
export class EnvironmentAssets {
  constructor() {
    this.prototypes = new Map(); this.materials = new Map();
    this.ball = new THREE.SphereGeometry(1, 12, 8);
    this.box = new RoundedBoxGeometry(1, 1, 1, 2, 0.12);
    this.trunk = new THREE.CylinderGeometry(0.22, 0.32, 1.6, 8);
    this.rock = new THREE.DodecahedronGeometry(1, 1);
  }
  material(color) {
    if (!this.materials.has(color)) this.materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0 }));
    return this.materials.get(color);
  }
  part(group, geometry, color, position, scale = [1, 1, 1]) {
    const mesh = new THREE.Mesh(geometry, this.material(color));
    mesh.position.fromArray(position); mesh.scale.fromArray(scale);
    mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
    return mesh;
  }
  get(id) {
    if (this.prototypes.has(id)) return this.prototypes.get(id);
    const group = new THREE.Group();
    const part = (geometry, color, position, scale) => this.part(group, geometry, color, position, scale);
    switch (id) {
      case 'Grass_Flat':
        part(this.box, '#806c4f', [0, -0.4, 0], [20, 0.8, 14]);
        part(this.box, '#8ca968', [0, -0.04, 0], [20, 0.16, 14]); break;
      case 'Dirt_Road': part(this.box, '#bca57b', [0, 0.045, 0], [17.8, 0.04, 2.3]); break;
      case 'Tree':
        part(this.trunk, '#86634b', [0, 0.8, 0]);
        part(this.ball, '#668757', [0, 2.25, 0], [1.15, 1.25, 1.05]);
        part(this.ball, '#7e9a60', [-0.65, 1.95, 0.15], [0.8, 0.8, 0.8]);
        part(this.ball, '#90a86c', [0.55, 2.2, 0.25], [0.7, 0.85, 0.75]); break;
      case 'Rock': part(this.rock, '#959a87', [0, 0.4, 0], [0.85, 0.6, 0.7]); break;
      case 'Bush':
        part(this.ball, '#6f9259', [0, 0.36, 0], [0.7, 0.5, 0.55]);
        part(this.ball, '#85a668', [0.4, 0.28, 0], [0.45, 0.35, 0.4]); break;
      case 'Grass':
        for (let i = -1; i <= 1; i++) {
          const blade = part(this.ball, '#789654', [i * 0.14, 0.2, 0], [0.08, 0.3, 0.08]); blade.rotation.z = -i * 0.3;
        } break;
      case 'Flower':
        part(this.box, '#6e8d53', [0, 0.16, 0], [0.045, 0.32, 0.045]);
        for (let i = 0; i < 5; i++) part(this.ball, '#f1dfae', [Math.cos(i * 1.256) * 0.12, 0.34, Math.sin(i * 1.256) * 0.12], [0.1, 0.055, 0.1]);
        part(this.ball, '#d7af5e', [0, 0.37, 0], [0.07, 0.05, 0.07]); break;
      case 'Fence':
        for (const x of [-0.85, 0.85]) part(this.box, '#977953', [x, 0.55, 0], [0.18, 1.1, 0.18]);
        for (const y of [0.35, 0.8]) part(this.box, '#b09161', [0, y, 0], [2, 0.14, 0.12]); break;
      case 'Hill': part(this.ball, '#8fa97e', [0, -0.6, 0], [4.5, 2.8, 2.8]); break;
      case 'SD_Dummy':
        part(this.ball, '#f2d2b0', [0, 1.43, 0], [0.34, 0.34, 0.32]);
        part(this.ball, '#634d43', [0, 1.61, -0.055], [0.35, 0.19, 0.31]);
        part(this.box, '#547e9a', [0, 0.85, 0], [0.48, 0.57, 0.32]);
        for (const x of [-0.15, 0.15]) {
          part(this.box, '#625d59', [x, 0.3, 0], [0.2, 0.55, 0.25]);
          part(this.ball, '#f2d2b0', [x * 2.3, 0.84, 0], [0.12, 0.27, 0.13]);
          part(this.ball, '#353c3e', [x * 0.75, 1.43, 0.303], [0.035, 0.048, 0.025]);
        } break;
      default: throw new Error(`등록되지 않은 환경 Asset입니다: ${id}`);
    }
    this.prototypes.set(id, group); return group;
  }
  dispose() {
    const root = new THREE.Group(); this.prototypes.forEach(group => root.add(group));
    disposeTree(root);
    // 사용되지 않은 공통 Geometry도 해제합니다.
    [this.ball, this.box, this.trunk, this.rock].forEach(geometry => geometry.dispose());
    this.prototypes.clear(); this.materials.clear();
  }
}

export function instancePlacements(prototype, placements) {
  const group = new THREE.Group(); const transform = new THREE.Object3D();
  prototype.updateMatrixWorld(true);
  prototype.traverseVisible(part => {
    if (!part.isMesh) return;
    const mesh = new THREE.InstancedMesh(part.geometry, part.material, placements.length);
    placements.forEach((placement, index) => {
      transform.position.fromArray(placement.position);
      transform.rotation.set(0, placement.rotationY ?? 0, 0);
      transform.scale.fromArray(placement.scale ?? [1, 1, 1]); transform.updateMatrix();
      mesh.setMatrixAt(index, new THREE.Matrix4().multiplyMatrices(transform.matrix, part.matrixWorld));
    });
    mesh.castShadow = part.castShadow; mesh.receiveShadow = true;
    mesh.computeBoundingSphere(); group.add(mesh);
  });
  return group;
}
