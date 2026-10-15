import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { disposeObject, inspectModel } from './CharacterViewer.js?v=20261010-visual12';
import { capturePartSpace } from '../portrait/PartSpace.js?v=20261007-parts2';
import { createRandomPartPlan } from './part-randomizer.js?v=20261014-gender1';

const API = '/api/character-assets/parts';
const DEFAULT_TRANSFORM = Object.freeze({ position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 });

function commonTopLevelTransform(scene) {
  const nodes = scene.children.filter(node => node.isMesh || node.isSkinnedMesh);
  if (nodes.length < 2 || nodes.length !== scene.children.length) return null;
  nodes.forEach(node => node.updateMatrix());
  const first = nodes[0].matrix;
  const same = nodes.every(node => node.matrix.elements.every((value, index) => Math.abs(value - first.elements[index]) < 1e-6));
  return same && !first.equals(new THREE.Matrix4()) ? first.clone() : null;
}

function inspectPart(scene) {
  const info = inspectModel(scene);
  let skinnedMeshes = 0, meshes = 0, armatures = 0;
  scene.traverse(node => {
    if (node.isMesh) meshes++;
    if (node.isSkinnedMesh) skinnedMeshes++;
    if (node.isBone && !node.parent?.isBone) armatures++;
  });
  return { ...info, meshes, skinnedMeshes, armatures, sceneRoot: scene.name || '(이름 없는 Scene)' };
}

function bonesByName(root) {
  const result = new Map();
  root.traverse(node => {
    if (node.isBone && node.name && !result.has(node.name)) result.set(node.name, node);
  });
  return result;
}

function hideEmbeddedBaseBody(scene) {
  const hidden = [];
  scene.traverse(node => {
    if (!node.isMesh || !/^Mesh_0(?:$|[._-])/i.test(node.name || '')) return;
    node.visible = false;
    node.userData.characterPartEmbeddedBase = true;
    hidden.push(node.name || 'Mesh_0');
  });
  return hidden;
}

function rebindSkinnedMeshes(scene, baseRoot) {
  const targetBones = bonesByName(baseRoot);
  const sourceSkeletons = new Map();
  const rebound = [];
  const failures = [];

  scene.traverse(node => {
    if (!node.isSkinnedMesh || node.userData.characterPartEmbeddedBase) return;
    const sourceSkeleton = node.skeleton;
    if (!sourceSkeleton?.bones?.length) {
      failures.push(`${node.name || '(unnamed SkinnedMesh)'}: no Skeleton`);
      return;
    }
    const missing = sourceSkeleton.bones.map(bone => bone.name).filter(name => !targetBones.has(name));
    if (missing.length) {
      failures.push(`${node.name || '(unnamed SkinnedMesh)'}: missing Base Bone (${missing.join(', ')})`);
      return;
    }
    let targetSkeleton = sourceSkeletons.get(sourceSkeleton);
    if (!targetSkeleton) {
      targetSkeleton = new THREE.Skeleton(
        sourceSkeleton.bones.map(bone => targetBones.get(bone.name)),
        sourceSkeleton.boneInverses.map(matrix => matrix.clone()),
      );
      sourceSkeletons.set(sourceSkeleton, targetSkeleton);
    }
    node.bind(targetSkeleton, node.bindMatrix.clone());
    node.frustumCulled = false;
    rebound.push(node.name || '(unnamed SkinnedMesh)');
  });

  if (rebound.length) {
    const sourceBoneRoots = [];
    scene.traverse(node => {
      if (node.isBone && !node.parent?.isBone) sourceBoneRoots.push(node);
    });
    sourceBoneRoots.forEach(node => node.removeFromParent());
    for (const sourceSkeleton of sourceSkeletons.keys()) sourceSkeleton.dispose();
  }
  return { rebound, failures };
}

export class CharacterPartPreview {
  constructor(viewer, onStatus = () => {}, getJsClothesNodes = () => [], onBusyChange = () => {}) {
    this.viewer = viewer;
    this.onStatus = onStatus;
    this.mode = 'js';
    this.root = null;
    this.categories = [];
    this.instances = new Map();
    this.selections = new Map();
    this.transforms = new Map();
    this.tokens = new Map();
    this.hidden = new Map();
    this.pendingLoads = 0;
    this.randomGeneration = 0;
    this.onBusyChange = onBusyChange;
    this.getJsClothesNodes = getJsClothesNodes;
    this.sync = () => this.syncVisibility();
    viewer.beforeAnimation.add(this.sync);
  }

  setCategories(categories) { this.categories = categories; }

  async setModel(root) {
    this.clearInstances();
    this.root = root || null;
    this.head = root?.getObjectByName('mixamorigHead') || root?.getObjectByName('Head') || null;
    this.partSpace = this.head ? capturePartSpace(root, this.head) : null;
    this.syncVisibility();
    if (this.root && this.mode === 'glb') {
      for (const category of this.categories) {
        const path = this.selections.get(category.id);
        const asset = category.files?.find(file => file.path === path) || path;
        if (path) await this.load(category, asset, path.split('/').pop());
      }
    }
  }

  setMode(mode) {
    this.mode = mode === 'glb' ? 'glb' : 'js';
    this.syncVisibility();
  }

  setBusy(delta) {
    this.pendingLoads = Math.max(0, this.pendingLoads + delta);
    this.onBusyChange(this.pendingLoads > 0);
  }

  getState() {
    const parts = {};
    for (const category of this.categories) {
      const path = this.selections.get(category.id) || null;
      const file = category.files?.find(entry => entry.path === path);
      parts[category.id] = path ? { path, name: file?.displayName || path.split('/').pop() } : null;
    }
    return { source: 'glb', parts, loading: this.pendingLoads > 0, generation: this.randomGeneration };
  }

  syncVisibility() {
    for (const [node, visible] of this.hidden) node.visible = visible;
    this.hidden.clear();
    const showGlb = this.mode === 'glb';
    for (const record of this.instances.values()) record.owner.visible = showGlb;
    if (!showGlb || !this.root) return;
    for (const category of this.categories) {
      for (const name of category.hideNodes || []) {
        const node = this.root.getObjectByName(name);
        if (node && !this.hidden.has(node)) { this.hidden.set(node, node.visible); node.visible = false; }
      }
    }
    if (this.categories.some(category => category.id === 'clothes')) {
      for (const node of this.getJsClothesNodes()) {
        if (node && !this.hidden.has(node)) { this.hidden.set(node, node.visible); node.visible = false; }
      }
    }
  }

  createOwner(category) {
    const owner = new THREE.Group();
    owner.name = `ExternalPart_${category.id}`;
    if (category.attachment === 'head-root-space') {
      if (!this.head || !this.partSpace) throw new Error('이 파츠를 연결할 Head Bone을 찾지 못했습니다.');
      owner.matrixAutoUpdate = false;
      owner.matrix.copy(this.partSpace.rootToParent);
      this.head.add(owner);
    } else {
      if (!this.root) throw new Error('먼저 Base Character를 불러오세요.');
      this.root.add(owner);
    }
    return owner;
  }

  async load(category, asset, name, release = () => {}) {
    if (!this.root) { release(); throw new Error('먼저 Base Character를 불러오세요.'); }
    const token = (this.tokens.get(category.id) || 0) + 1;
    this.tokens.set(category.id, token);
    this.setBusy(1);
    this.onStatus(category.id, 'loading', `${name} 로딩 중…`);
    let gltf;
    try {
      const sourcePath = typeof asset === 'string' ? asset : asset.path;
      const modified = typeof asset === 'string' ? '' : asset.modified;
      const requestPath = modified ? `${sourcePath}?partVersion=${encodeURIComponent(modified)}` : sourcePath;
      const url = new URL(requestPath, document.baseURI).href;
      gltf = await new GLTFLoader().loadAsync(url);
      if (this.tokens.get(category.id) !== token || !this.root) { gltf.scenes.forEach(disposeObject); return null; }
      const source = gltf.scene;
      const embeddedBase = category.id === 'clothes' ? hideEmbeddedBaseBody(source) : [];
      const binding = category.id === 'clothes' || category.rebindSkeleton
        ? rebindSkinnedMeshes(source, this.root)
        : { rebound: [], failures: [] };
      const info = { ...inspectPart(source), embeddedBase, binding };
      if (!info.meshes) throw new Error('표시할 Mesh가 없는 GLB입니다.');
      const owner = this.createOwner(category);
      owner.userData.externalPartCategory = category.id;
      if (category.slot) owner.userData.externalEquipmentSlot = category.slot;
      const adjustment = new THREE.Group(); adjustment.name = `ExternalPart_Adjustment_${category.id}`; owner.add(adjustment);
      const coordinateFix = new THREE.Group(); coordinateFix.name = `ExternalPart_CoordinateFix_${category.id}`;
      source.updateMatrix(); const sharedTransform = commonTopLevelTransform(source);
      if (sharedTransform) { coordinateFix.matrixAutoUpdate = false; coordinateFix.matrix.copy(sharedTransform).invert(); }
      adjustment.add(coordinateFix); coordinateFix.add(source);
      const transform = this.transforms.get(category.id) || { ...DEFAULT_TRANSFORM, position: [0, 0, 0], rotation: [0, 0, 0] };
      adjustment.position.set(...transform.position);
      adjustment.rotation.set(...transform.rotation.map(THREE.MathUtils.degToRad));
      adjustment.scale.setScalar(transform.scale);
      const previous = this.instances.get(category.id);
      this.instances.set(category.id, { owner, adjustment, source, info, path: sourcePath, modified, name });
      if (previous) { previous.owner.removeFromParent(); disposeObject(previous.owner); }
      this.selections.set(category.id, sourcePath);
      this.syncVisibility();
      const bindingStatus = binding.rebound.length
        ? ` | Base Skeleton bound: ${binding.rebound.length}`
        : (info.skinnedMeshes ? ' | embedded Skeleton preview' : '');
      const bindingWarning = binding.failures.length ? ` | bind failed: ${binding.failures.join(' / ')}` : '';
      const bodyStatus = embeddedBase.length ? ` | embedded Base Body hidden: ${embeddedBase.length}` : '';
      this.onStatus(category.id, binding.failures.length ? 'error' : 'loaded', `${name} | Scene ${info.sceneRoot} | Mesh ${info.meshes} | Skinned ${info.skinnedMeshes} | Armature ${info.armatures}${bindingStatus}${bodyStatus}${bindingWarning}`);
      return info;
    } catch (error) {
      if (gltf) gltf.scenes.forEach(scene => { if (![...this.instances.values()].some(item => item.source === scene)) disposeObject(scene); });
      this.onStatus(category.id, 'error', `${name} 로딩 실패: ${error.message}`);
      throw error;
    } finally { this.setBusy(-1); release(); }
  }

  async randomize(random = Math.random) {
    const generation = ++this.randomGeneration;
    const current = Object.fromEntries(this.selections);
    const gender = this.root?.userData.sdAppearance?.base;
    const plan = createRandomPartPlan(this.categories, current, random, gender === 'male' || gender === 'female' ? gender : null);
    const jobs = this.categories.map(async category => {
      const asset = plan[category.id];
      if (!asset) {
        this.remove(category.id);
        return;
      }
      await this.load(category, asset, asset.displayName || asset.path.split('/').pop());
    });
    const results = await Promise.allSettled(jobs);
    return { generation, stale: generation !== this.randomGeneration, plan, results, state: this.getState() };
  }

  remove(categoryId, clearSelection = true) {
    this.tokens.set(categoryId, (this.tokens.get(categoryId) || 0) + 1);
    const record = this.instances.get(categoryId);
    if (record) { record.owner.removeFromParent(); disposeObject(record.owner); this.instances.delete(categoryId); }
    if (clearSelection) this.selections.delete(categoryId);
    this.syncVisibility();
  }

  setTransform(categoryId, value) {
    this.transforms.set(categoryId, { position: [...value.position], rotation: [...value.rotation], scale: value.scale });
    const adjustment = this.instances.get(categoryId)?.adjustment;
    if (!adjustment) return;
    adjustment.position.set(...value.position);
    adjustment.rotation.set(...value.rotation.map(THREE.MathUtils.degToRad));
    adjustment.scale.setScalar(value.scale);
  }

  clearInstances() {
    this.randomGeneration++;
    for (const categoryId of [...this.instances.keys()]) this.remove(categoryId, false);
    for (const [node, visible] of this.hidden) node.visible = visible;
    this.hidden.clear();
  }

  dispose() {
    this.clearInstances();
    this.viewer.beforeAnimation.delete(this.sync);
    this.root = this.head = this.partSpace = null;
  }
}

export function setupCharacterParts(viewer, { onModeChange = () => {}, onBusyChange = () => {}, onCombinationChange = () => {}, getJsClothesNodes = () => [] } = {}) {
  const byId = id => document.getElementById(id);
  const panel = byId('glb-part-panel'), list = byId('glb-part-categories'), summary = byId('glb-part-summary');
  const preview = new CharacterPartPreview(viewer, (id, state, message) => {
    const row = list.querySelector(`[data-category="${id}"]`);
    if (row) { row.dataset.state = state; row.querySelector('.part-status').textContent = message; }
    summary.textContent = message;
  }, getJsClothesNodes, onBusyChange);
  let categories = [];
  let localFileUrl = null;

  const setMode = mode => {
    preview.setMode(mode);
    panel.hidden = mode !== 'glb';
    byId('js-portrait-options').hidden = mode !== 'js';
    byId('portrait-default').hidden = mode !== 'js';
    document.querySelectorAll('[data-part-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.partMode === mode)));
    onModeChange(mode);
    summary.textContent = mode === 'glb' ? 'GLB 파츠 모드 · 각 카테고리를 독립적으로 선택할 수 있습니다.' : '기존 JavaScript 파츠 모드';
  };

  const renderCategories = data => {
    categories = data.categories || []; preview.setCategories(categories); list.replaceChildren();
    for (const category of categories) {
      const row = document.createElement('div'); row.className = 'glb-part-row'; row.dataset.category = category.id;
      const label = document.createElement('label'); label.htmlFor = `glb-part-${category.id}`; label.textContent = category.label;
      const select = document.createElement('select'); select.id = `glb-part-${category.id}`;
      select.append(new Option('없음', ''));
      category.files.forEach(file => select.append(new Option(file.displayName, file.path)));
      select.value = preview.selections.get(category.id) || '';
      const status = document.createElement('p'); status.className = 'part-status hint'; status.textContent = category.files.length ? `${category.files.length}개 GLB · ${category.folder}` : `GLB 없음 · ${category.folder}`;
      select.addEventListener('change', async () => {
        if (!select.value) { preview.remove(category.id); status.textContent = '없음 · 외부 파츠 제거됨'; onCombinationChange(preview.getState()); return; }
        const asset = category.files.find(file => file.path === select.value);
        try { await preview.load(category, asset || select.value, select.options[select.selectedIndex].text); onCombinationChange(preview.getState()); }
        catch { select.value = preview.selections.get(category.id) || ''; }
      });
      row.append(label, select, status); list.append(row);
    }
    const target = byId('glb-transform-category');
    target.replaceChildren(...categories.map(category => new Option(category.label, category.id)));
  };

  const refresh = async () => {
    summary.textContent = 'GLB 파츠 폴더 검색 중…';
    try {
      const response = await fetch(API, { cache: 'no-store' }); if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json(); renderCategories(data);
      for (const category of categories) {
        const record = preview.instances.get(category.id), selected = preview.selections.get(category.id);
        const asset = category.files.find(file => file.path === selected);
        if (record && asset && record.modified !== asset.modified) await preview.load(category, asset, asset.displayName);
      }
      const total = categories.reduce((sum, category) => sum + category.files.length, 0);
      summary.textContent = `${categories.length}개 카테고리 · GLB ${total}개 발견`;
      return data;
    } catch (error) { summary.textContent = `파츠 목록 실패: ${error.message}. server.py를 다시 시작하세요.`; return { categories: [] }; }
  };

  document.querySelectorAll('[data-part-mode]').forEach(button => button.addEventListener('click', () => setMode(button.dataset.partMode)));
  byId('glb-part-refresh').addEventListener('click', refresh);
  const transformIds = ['glb-part-x','glb-part-y','glb-part-z','glb-part-rx','glb-part-ry','glb-part-rz','glb-part-scale'];
  const readTransform = () => ({ position: transformIds.slice(0,3).map(id => Number(byId(id).value)), rotation: transformIds.slice(3,6).map(id => Number(byId(id).value)), scale: Number(byId('glb-part-scale').value) });
  const applyTransform = () => {
    const value = readTransform(); if (!value.position.concat(value.rotation,[value.scale]).every(Number.isFinite) || value.scale <= 0) return;
    preview.setTransform(byId('glb-transform-category').value, value);
  };
  transformIds.forEach(id => byId(id).addEventListener('change', applyTransform));
  byId('glb-part-transform-reset').addEventListener('click', () => {
    transformIds.forEach(id => { byId(id).value = id === 'glb-part-scale' ? '1' : '0'; }); applyTransform();
  });
  byId('glb-transform-category').addEventListener('change', event => {
    const value = preview.transforms.get(event.target.value) || DEFAULT_TRANSFORM;
    [...value.position, ...value.rotation, value.scale].forEach((number,index) => { byId(transformIds[index]).value = String(number); });
  });
  byId('glb-part-url-form').addEventListener('submit', async event => {
    event.preventDefault(); const category = categories.find(item => item.id === byId('glb-transform-category').value);
    const value = byId('glb-part-url').value.trim();
    try {
      const url = new URL(value, document.baseURI); if (!/\.glb$/i.test(url.pathname)) throw new Error('.glb 파일만 지원합니다.');
      await preview.load(category, url.href, decodeURIComponent(url.pathname.split('/').pop()));
    } catch (error) { summary.textContent = `수동 GLB 로딩 실패: ${error.message}`; }
  });
  byId('glb-part-file').addEventListener('change', async event => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    if (!/\.glb$/i.test(file.name)) { summary.textContent = '.glb 파일만 선택할 수 있습니다.'; return; }
    const category = categories.find(item => item.id === byId('glb-transform-category').value);
    if (localFileUrl) URL.revokeObjectURL(localFileUrl); localFileUrl = URL.createObjectURL(file);
    try { await preview.load(category, localFileUrl, file.name); }
    catch { /* category status already contains the error */ }
    finally { URL.revokeObjectURL(localFileUrl); localFileUrl = null; }
  });

  refresh(); setMode('js');
  return {
    preview, refresh, setMode,
    getState() { return preview.getState(); },
    async randomize(random = Math.random) {
      const result = await preview.randomize(random);
      for (const category of categories) {
        const select = byId(`glb-part-${category.id}`);
        if (select) select.value = preview.selections.get(category.id) || '';
      }
      if (!result.stale) onCombinationChange(result.state);
      return result;
    },
    async setModel(root) { await preview.setModel(root); byId('part-source-controls').disabled = !root; },
    clear() { preview.setModel(null); byId('part-source-controls').disabled = true; },
    dispose() { if (localFileUrl) URL.revokeObjectURL(localFileUrl); preview.dispose(); },
  };
}
