import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const ATTACHMENT_POINTS = ['Weapon_R', 'Weapon_L', 'Head_Attachment', 'Back_Attachment'];

// Viewer-owned resources only. Sets avoid disposing shared materials/textures twice.
export function disposeObject(root) {
  const geometries = new Set(), materials = new Set(), textures = new Set(), skeletons = new Set();
  root.traverse(node => {
    if (node.geometry) geometries.add(node.geometry);
    if (node.skeleton) skeletons.add(node.skeleton);
    for (const material of [].concat(node.material || [])) {
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  geometries.forEach(value => value.dispose());
  materials.forEach(value => value.dispose());
  const images = new Set();
  textures.forEach(value => { images.add(value.source?.data); value.dispose(); });
  images.forEach(value => value?.close?.());
  skeletons.forEach(value => value.dispose());
}

export function inspectModel(root) {
  let meshes = 0, triangles = 0;
  const materials = new Set(), textures = new Set(), bones = new Set();
  root.traverse(node => {
    if (node.isBone) bones.add(node);
    if (!node.isMesh) return;
    meshes++;
    const count = node.geometry.index?.count ?? node.geometry.attributes.position?.count ?? 0;
    triangles += Math.floor(count / 3) * (node.isInstancedMesh ? node.count : 1);
    for (const material of [].concat(node.material || [])) {
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  return {
    meshes, triangles, materials: materials.size, bones: [...bones].map(bone => bone.name || '(이름 없는 본)'),
    textures: [...textures].map(texture => {
      const source = texture.image;
      return { name: texture.name || '(이름 없음)', width: source?.width ?? '?', height: source?.height ?? '?', colorSpace: texture.colorSpace || 'linear / data' };
    }),
    attachments: ATTACHMENT_POINTS.map(name => ({ name, found: Boolean(root.getObjectByName(name)) }))
  };
}

// Rendering and animation only: no game state, stats, skills, DOM controls or save APIs.
export class CharacterViewer {
  constructor(container, onState = () => {}) {
    this.container = container;
    this.onState = onState;
    this.generation = 0;
    this.disposed = false;
    this.clips = [];
    this.loop = true;
    this.speed = 1;
    this.playback = 'stopped';
    this.beforeAnimation = new Set();
    this.afterAnimation = new Set();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#1b2330');
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.01, 1000);
    this.camera.position.set(3, 2, 4);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.append(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 1, 0);
    this.scene.add(new THREE.HemisphereLight(0xddeeff, 0x667080, 2.4));
    const key = new THREE.DirectionalLight(0xffead9, 3);
    key.position.set(3, 5, 4);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xb2d5ff, 1.5);
    fill.position.set(-3, 2, -3);
    this.scene.add(fill);
    this.grid = new THREE.GridHelper(10, 20, 0x607c9d, 0x33465e);
    this.scene.add(this.grid);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.lastTime = null;
    this.onContextLost = event => {
      event.preventDefault();
      ++this.generation;
      this.renderer.setAnimationLoop(null);
      this.clearModel();
      this.onState({ type: 'fatal', message: 'WebGL 컨텍스트가 손실되었습니다. 페이지를 새로고침하세요.' });
    };
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost);
    this.renderer.setAnimationLoop(time => {
      const delta = this.lastTime === null ? 0 : Math.min((time - this.lastTime) / 1000, 0.1);
      this.lastTime = time;
      if (document.hidden) return;
      this.beforeAnimation.forEach(callback => callback());
      this.mixer?.update(delta * this.speed);
      this.afterAnimation.forEach(callback => callback());
      this.controls.update();
      this.skeletonHelper?.updateMatrixWorld(true);
      this.renderer.render(this.scene, this.camera);
    });
  }

  resize() {
    const width = Math.max(1, this.container.clientWidth), height = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    if (this.model) this.frameModel();
  }

  async load(url, name, release = () => {}) {
    if (this.disposed) { release(); return; }
    const generation = ++this.generation;
    this.clearModel();
    this.onState({ type: 'loading', name });
    let gltf;
    try {
      const manager = new THREE.LoadingManager();
      const failedResources = [];
      manager.onError = resource => failedResources.push(resource);
      const loader = new GLTFLoader(manager);
      gltf = await loader.loadAsync(url, progress => {
        if (generation !== this.generation || this.disposed) return;
        this.onState({ type: 'progress', loaded: progress.loaded, total: progress.total });
      });
      if (generation !== this.generation || this.disposed) {
        this.disposeScenes(gltf.scenes);
        return;
      }
      // Texture failures may otherwise produce a successful but incomplete GLTFLoader result.
      if (failedResources.length) throw new Error(`참조 리소스 로딩 실패: ${failedResources.join(', ')}`);
      this.model = gltf.scene;
      this.ownedScenes = gltf.scenes;
      this.model.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(this.model, true);
      if (bounds.isEmpty() || !Number.isFinite(bounds.min.length() + bounds.max.length())) {
        throw new Error('표시할 수 있는 유효한 형상이 없습니다.');
      }
      // Offset/scale the wrapper, preserving imported transforms and animation track paths.
      this.presentation = new THREE.Group();
      this.offset = new THREE.Group();
      const center = bounds.getCenter(new THREE.Vector3());
      this.offset.position.set(-center.x, -bounds.min.y, -center.z);
      this.offset.add(this.model);
      this.presentation.add(this.offset);
      this.scene.add(this.presentation);
      this.clips = gltf.animations;
      this.mixer = new THREE.AnimationMixer(this.model);
      this.mixer.addEventListener('finished', event => {
        if (event.action === this.action) { this.playback = 'finished'; this.notifyPlayback(); }
      });
      this.skeletonHelper = new THREE.SkeletonHelper(this.model);
      this.skeletonHelper.visible = false;
      this.scene.add(this.skeletonHelper);
      this.frameModel();
      this.onState({ type: 'loaded', name, info: inspectModel(this.model), clips: this.clips,
        sourceScale: this.model.scale.toArray() });
      if (this.clips.length) this.selectClip(0);
    } catch (error) {
      if (gltf) {
        if (this.model === gltf.scene) this.clearModel();
        else this.disposeScenes(gltf.scenes);
      }
      if (generation === this.generation && !this.disposed) this.onState({ type: 'error', error });
    } finally {
      release();
    }
  }

  frameModel() {
    if (!this.presentation) return;
    this.presentation.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(this.presentation, true);
    if (bounds.isEmpty()) return;
    const sphere = bounds.getBoundingSphere(new THREE.Sphere());
    const radius = Math.max(sphere.radius, 0.0001);
    const vertical = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const horizontal = Math.atan(Math.tan(vertical) * this.camera.aspect);
    const distance = radius / Math.sin(Math.min(vertical, horizontal)) * 1.15;
    this.camera.near = Math.max(radius / 1000, 0.000001);
    this.camera.far = distance + radius * 100;
    this.camera.position.copy(sphere.center).add(new THREE.Vector3(0.65, 0.3, 1).normalize().multiplyScalar(distance));
    this.camera.updateProjectionMatrix();
    this.controls.target.copy(sphere.center);
    this.controls.minDistance = radius * 0.15;
    this.controls.maxDistance = radius * 40;
    this.controls.update();
    this.grid.scale.setScalar(radius * 0.6);
    this.grid.position.y = bounds.min.y - radius * 0.002;
  }

  setScale(value) {
    if (!this.presentation || !Number.isFinite(value) || value < 0.001 || value > 1000) return false;
    this.presentation.scale.setScalar(value);
    this.frameModel();
    return true;
  }

  selectClip(index) {
    const clip = this.clips[index];
    if (!this.mixer || !clip) return;
    this.mixer.stopAllAction();
    this.selectedClipIndex = index;
    this.action = this.mixer.clipAction(clip);
    this.action.reset();
    this.applyLoop();
    this.action.play();
    this.playback = 'playing';
    this.notifyPlayback();
  }

  applyLoop() {
    if (!this.action) return;
    // A single-keyframe clip can have duration 0; repeating it would divide by zero.
    const repeat = this.loop && this.action.getClip().duration > 0;
    this.action.setLoop(repeat ? THREE.LoopRepeat : THREE.LoopOnce, repeat ? Infinity : 1);
    this.action.clampWhenFinished = true;
  }

  setLoop(value) { this.loop = Boolean(value); this.applyLoop(); }
  setSpeed(value) { if (Number.isFinite(value) && value > 0 && value <= 3) this.speed = value; }

  play() {
    if (!this.action) return;
    if (this.playback === 'finished' || this.playback === 'stopped') this.action.reset();
    this.action.paused = false;
    this.action.play();
    this.playback = 'playing';
    this.notifyPlayback();
  }

  pause() {
    if (!this.action || this.playback !== 'playing') return;
    this.action.paused = true;
    this.playback = 'paused';
    this.notifyPlayback();
  }

  stop() {
    if (!this.action) return;
    this.action.reset().play();
    this.action.paused = true;
    this.mixer.update(0);
    this.playback = 'stopped';
    this.notifyPlayback();
  }

  notifyPlayback() {
    this.onState({ type: 'playback', state: this.playback, index: this.selectedClipIndex });
  }

  addAnimationModifier({ before, after }) {
    if (before) this.beforeAnimation.add(before);
    if (after) this.afterAnimation.add(after);
    return () => { if (before) this.beforeAnimation.delete(before); if (after) this.afterAnimation.delete(after); };
  }

  // Returns the actual imported bone/node. Missing sockets are valid for arbitrary test models.
  getAttachmentPoint(name) { return this.model?.getObjectByName(name) ?? null; }

  disposeScenes(scenes = []) {
    const owner = new THREE.Group();
    scenes.forEach(scene => owner.add(scene));
    disposeObject(owner);
  }

  clearModel() {
    if (this.model) this.onState({ type: 'unloading' });
    if (this.mixer) { this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.model); }
    if (this.skeletonHelper) { this.scene.remove(this.skeletonHelper); this.skeletonHelper.dispose(); }
    if (this.presentation) this.scene.remove(this.presentation);
    this.disposeScenes(this.ownedScenes);
    this.ownedScenes = [];
    this.model = this.presentation = this.offset = this.mixer = this.action = this.skeletonHelper = null;
    this.clips = [];
    this.selectedClipIndex = -1;
    this.playback = 'stopped';
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    ++this.generation;
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    this.clearModel();
    this.controls.dispose();
    this.beforeAnimation.clear();
    this.afterAnimation.clear();
    disposeObject(this.grid);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
