import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { disposeObject, inspectModel } from './CharacterViewer.js?v=20261013-hairimport1';
import { capturePartSpace } from '../portrait/PartSpace.js?v=20261007-parts2';

const DEFAULT_TRANSFORM = Object.freeze({ position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 });
const LIBRARY_API = '/api/character-assets/hair';

function commonTopLevelTransform(scene) {
  const nodes = scene.children.filter(node => node.isMesh);
  if (nodes.length < 2 || nodes.length !== scene.children.length) return null;
  nodes.forEach(node => node.updateMatrix());
  const first = nodes[0].matrix;
  const same = nodes.every(node => node.matrix.elements.every((value, index) => Math.abs(value - first.elements[index]) < 1e-6));
  return same && !first.equals(new THREE.Matrix4()) ? first.clone() : null;
}

export class ExternalHairPreview {
  constructor(viewer, onStatus = () => {}) {
    this.viewer = viewer; this.onStatus = onStatus; this.generation = 0;
    this.transform = { ...DEFAULT_TRANSFORM, position: [0, 0, 0], rotation: [0, 0, 0] };
    this.syncVisibility = () => {
      if (!this.instance) return;
      const hair = this.root?.getObjectByName('Hair_Anchor');
      if (hair && hair !== this.previousHair) {
        if (this.previousHair) this.previousHair.visible = this.previousHairVisible;
        this.previousHair = hair; this.previousHairVisible = hair.visible; hair.visible = false;
      }
    };
    viewer.beforeAnimation.add(this.syncVisibility);
  }
  setModel(root) {
    this.remove(); this.root = root || null;
    this.head = root?.getObjectByName('mixamorigHead') || root?.getObjectByName('Head') || null;
    this.partSpace = this.head ? capturePartSpace(root, this.head) : null;
  }
  async load(url, name, release = () => {}) {
    if (!this.root || !this.head || !this.partSpace) { release(); throw new Error('먼저 남성 또는 여성 블랭크 캐릭터를 불러오세요.'); }
    const generation = ++this.generation; this.remove(false); this.onStatus(`${name} 불러오는 중…`); let gltf;
    try {
      gltf = await new GLTFLoader().loadAsync(url);
      if (generation !== this.generation) { gltf.scenes.forEach(disposeObject); return null; }
      const source = gltf.scene; source.updateMatrix(); const sharedTransform = commonTopLevelTransform(source);
      const anchor = new THREE.Group(); anchor.name = 'ExternalHair_RootSpace'; anchor.matrixAutoUpdate = false; anchor.matrix.copy(this.partSpace.rootToParent); this.head.add(anchor);
      const adjustment = new THREE.Group(); adjustment.name = 'ExternalHair_Adjustment'; anchor.add(adjustment);
      const coordinateFix = new THREE.Group(); coordinateFix.name = 'ExternalHair_CoordinateFix';
      if (sharedTransform) { coordinateFix.matrixAutoUpdate = false; coordinateFix.matrix.copy(sharedTransform).invert(); }
      adjustment.add(coordinateFix); source.name = source.name || name; coordinateFix.add(source);
      this.anchor = anchor; this.adjustment = adjustment; this.instance = source; this.applyTransform(this.transform); this.syncVisibility();
      const info = inspectModel(source); const corrected = sharedTransform ? ' · 공통 Blender node transform 자동 보정' : '';
      this.onStatus(`${name} 장착 완료 · Mesh ${info.meshes} · Triangles ${info.triangles.toLocaleString()} · Material ${info.materials}${corrected}`);
      return info;
    } catch (error) {
      if (gltf) gltf.scenes.forEach(scene => { if (scene !== this.instance) disposeObject(scene); });
      throw error;
    } finally { release(); }
  }
  applyTransform(value) {
    this.transform = { position: [...value.position], rotation: [...value.rotation], scale: value.scale };
    if (!this.adjustment) return;
    this.adjustment.position.set(...value.position); this.adjustment.rotation.set(...value.rotation.map(THREE.MathUtils.degToRad)); this.adjustment.scale.setScalar(value.scale);
  }
  remove(increment = true) {
    if (increment) ++this.generation;
    if (this.previousHair) { this.previousHair.visible = this.previousHairVisible; this.previousHair = null; }
    if (this.anchor) { this.anchor.removeFromParent(); disposeObject(this.anchor); }
    this.anchor = null; this.adjustment = null; this.instance = null;
  }
  dispose() { this.remove(); this.viewer.beforeAnimation.delete(this.syncVisibility); this.root = null; this.head = null; this.partSpace = null; }
}

export function setupExternalHair(viewer) {
  const byId = id => document.getElementById(id), status = byId('external-hair-status'), library = byId('external-hair-library');
  const preview = new ExternalHairPreview(viewer, text => { status.textContent = text; }); let fileUrl = null;
  const controls = ['external-hair-x', 'external-hair-y', 'external-hair-z', 'external-hair-rx', 'external-hair-ry', 'external-hair-rz', 'external-hair-scale'];
  const readTransform = () => ({ position: controls.slice(0, 3).map(id => Number(byId(id).value)), rotation: controls.slice(3, 6).map(id => Number(byId(id).value)), scale: Number(byId('external-hair-scale').value) });
  const apply = () => {
    const value = readTransform();
    if (!value.position.concat(value.rotation, [value.scale]).every(Number.isFinite) || value.scale <= 0) { status.textContent = '유효한 위치·회전과 0보다 큰 배율을 입력하세요.'; return; }
    preview.applyTransform(value); status.textContent = '외부 머리 transform을 적용했습니다.';
  };
  controls.forEach(id => byId(id).addEventListener('change', apply));
  const load = (url, name, release) => preview.load(url, name, release).catch(error => { status.textContent = `외부 머리 로딩 실패: ${error.message}`; });
  const selectPath = path => { byId('external-hair-url').value = path || ''; };
  const refreshLibrary = async ({ preserve = true } = {}) => {
    const previous = preserve ? library.value : ''; library.disabled = true; library.replaceChildren(new Option('폴더 목록 불러오는 중…', ''));
    try {
      const response = await fetch(LIBRARY_API, { cache: 'no-store' }); if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json(), files = Array.isArray(data.files) ? data.files : []; library.replaceChildren();
      if (!files.length) { library.append(new Option('GLB 파일 없음', '')); selectPath(''); }
      else {
        files.forEach(file => library.append(new Option(`${file.name} · ${(file.bytes / 1024).toFixed(1)} KB`, file.path)));
        library.value = files.some(file => file.path === previous) ? previous : files[0].path; selectPath(library.value);
      }
      status.textContent = `${data.folder || '가져오기 폴더'}에서 GLB ${files.length}개를 찾았습니다.`; return files;
    } catch (error) {
      library.replaceChildren(new Option('폴더 목록을 불러오지 못함', ''));
      status.textContent = `GLB 폴더 조회 실패: ${error.message}. server.py를 다시 시작했는지 확인하세요.`; return [];
    } finally { library.disabled = false; }
  };
  library.addEventListener('change', () => selectPath(library.value));
  byId('external-hair-load-selected').addEventListener('click', () => {
    const path = library.value; if (!path) { status.textContent = '가져오기 폴더에서 장착할 GLB를 선택하세요.'; return; }
    selectPath(path); load(new URL(path, document.baseURI).href, path.split('/').pop());
  });
  byId('external-hair-refresh').addEventListener('click', () => refreshLibrary());
  byId('external-hair-url-form').addEventListener('submit', event => {
    event.preventDefault(); const value = byId('external-hair-url').value.trim();
    try { const url = new URL(value, document.baseURI); if (!/\.glb$/i.test(url.pathname)) throw new Error('.glb 파일만 지원합니다.'); load(url.href, decodeURIComponent(url.pathname.split('/').pop())); }
    catch (error) { status.textContent = error.message; }
  });
  byId('external-hair-file').addEventListener('change', event => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    if (!/\.glb$/i.test(file.name)) { status.textContent = '.glb 파일만 선택할 수 있습니다.'; return; }
    if (fileUrl) URL.revokeObjectURL(fileUrl); fileUrl = URL.createObjectURL(file);
    load(fileUrl, file.name, () => { URL.revokeObjectURL(fileUrl); fileUrl = null; });
  });
  byId('external-hair-reset').addEventListener('click', () => {
    controls.forEach(id => { byId(id).value = id === 'external-hair-scale' ? '1' : '0'; }); preview.applyTransform({ position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 }); status.textContent = '외부 머리 transform을 초기화했습니다.';
  });
  byId('external-hair-remove').addEventListener('click', () => { preview.remove(); status.textContent = '외부 머리를 제거하고 기존 머리를 복원했습니다.'; });
  refreshLibrary({ preserve: false });
  return {
    preview, refreshLibrary,
    setModel(root) { preview.setModel(root); byId('external-hair-controls').disabled = !preview.head; status.textContent = preview.head ? '외부 머리 GLB를 불러올 수 있습니다.' : '블랭크 캐릭터의 Head를 찾지 못했습니다.'; },
    clear() { preview.setModel(null); byId('external-hair-controls').disabled = true; },
    dispose() { if (fileUrl) URL.revokeObjectURL(fileUrl); preview.dispose(); },
  };
}
