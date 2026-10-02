import * as THREE from 'three';
import { createView, AssetCache, createCharacter } from '../three/core.js';
import { EnvironmentAssets } from './assets.js';
import { loadStage, loadEnvironmentModels, buildStage } from './stage.js';

const $ = id => document.getElementById(id);
const view = createView($('viewport'));
const assets = new EnvironmentAssets();
const cache = new AssetCache();
const characters = new Map();
let stage, data, busy = false, closed = false, generation = 0;
let labelEntries = [];
const buttons = ['reload', 'reset', 'place', 'load-model', 'clear'];
function log(message) { $('status').textContent = message; }
function logError(message) { $('status').textContent = message; }
function lock(value) { busy = value; buttons.forEach(id => { $(id).disabled = value; }); }
function clearCharacters() {
  generation++;
  characters.forEach(character => { character.group.removeFromParent(); character.dispose(); });
  characters.clear();
}
function syncSettings() {
  if (!stage) return;
  stage.markers.visible = $('spawns').checked;
  $('labels').hidden = !$('spawns').checked;
  stage.grid.visible = $('grid').checked;
  stage.leaves.visible = $('effects').checked;
  view.renderer.shadowMap.enabled = $('shadows').checked;
  view.scene.traverse(object => {
    for (const material of [].concat(object.material || [])) {
      if ('wireframe' in material) material.wireframe = $('wireframe').checked;
    }
  });
  view.setLighting(data.lighting[$('lighting').value]);
}
function placeCharacter(root, animations, point) {
  const character = createCharacter(root, animations);
  const previous = characters.get(point.id);
  if (previous) { previous.group.removeFromParent(); previous.dispose(); }
  character.group.position.fromArray(point.position);
  character.group.rotation.y = point.rotationY;
  characters.set(point.id, character); view.scene.add(character.group); syncSettings();
}
async function reload() {
  if (busy) return;
  lock(true);
  try {
    const nextData = await loadStage('assets/environments/stages/forest/stage.json');
    const models = await loadEnvironmentModels(nextData, cache);
    if (closed) return;
    const nextStage = buildStage(nextData, assets, models);
    clearCharacters(); stage?.dispose(); stage = nextStage; data = nextData;
    view.scene.add(stage.root); view.setCamera(data.camera);
    $('spawn').replaceChildren(...data.spawnPoints.map(point => new Option(point.id, point.id)));
    labelEntries = data.spawnPoints.map(point => {
      const element = document.createElement('span'); element.textContent = point.id;
      return { element, position: new THREE.Vector3(...point.position).add(new THREE.Vector3(0, 0.18, 0)) };
    });
    $('labels').replaceChildren(...labelEntries.map(entry => entry.element));
    $('assets').replaceChildren(...Object.entries(data.assetDescriptions).map(([id, description]) => {
      const item = document.createElement('li');
      item.textContent = `${description} × ${data.placements.filter(p => p.asset === id).length}`; return item;
    }));
    const initialPoints = new Set([data.spawnPoints[0], data.spawnPoints.find(point => point.id.startsWith('Enemy'))]);
    initialPoints.forEach(point => { if (point) placeCharacter(assets.get('SD_Dummy').clone(), [], point); });
    syncSettings(); log('초원/숲 Stage를 불러왔습니다. 중앙은 전투 공간이며 장식은 외곽에 배치했습니다.');
  } catch (error) { logError(error.message); }
  finally { lock(false); if (!stage) buttons.filter(id => id !== 'reload').forEach(id => { $(id).disabled = true; }); }
}
['spawns', 'grid', 'wireframe', 'shadows', 'effects', 'lighting'].forEach(id => $(id).addEventListener('change', syncSettings));
$('reload').addEventListener('click', reload);
$('reset').addEventListener('click', () => view.setCamera(data.camera));
$('clear').addEventListener('click', () => { clearCharacters(); log('임시 캐릭터를 모두 제거했습니다.'); });
$('place').addEventListener('click', () => {
  const point = data.spawnPoints.find(p => p.id === $('spawn').value);
  placeCharacter(assets.get('SD_Dummy').clone(), [], point); log(`${point.id}에 비율 확인용 캐릭터를 배치했습니다.`);
});
$('load-model').addEventListener('click', async () => {
  const path = $('model').value.trim();
  if (!path) { logError('불러올 GLB 경로를 입력해 주세요.'); return; }
  const point = data.spawnPoints.find(p => p.id === $('spawn').value);
  const requestGeneration = generation;
  lock(true); log('캐릭터 GLB를 불러오는 중입니다…');
  try {
    const { root, animations } = await cache.instantiate(path);
    if (closed || generation !== requestGeneration) return;
    placeCharacter(root, animations, point); log(`${point.id}에 캐릭터를 배치했습니다.`);
  } catch (error) { logError(error.message); }
  finally { lock(false); }
});

const projected = new THREE.Vector3();
let previous = performance.now(), statsStart = previous, frames = 0;
view.renderer.setAnimationLoop(now => {
  const delta = Math.min((now - previous) / 1000, 0.05); previous = now;
  if (document.hidden) { frames = 0; statsStart = now; return; }
  view.controls.update(); stage?.update(delta);
  characters.forEach(character => character.update(delta));
  view.renderer.render(view.scene, view.camera);
  if ($('spawns').checked) labelEntries.forEach(({ element, position }) => {
    projected.copy(position).project(view.camera);
    element.hidden = projected.z < -1 || projected.z > 1 || Math.abs(projected.x) > 1 || Math.abs(projected.y) > 1;
    element.style.left = `${(projected.x + 1) * 50}%`; element.style.top = `${(1 - projected.y) * 50}%`;
  });
  frames++;
  if (now - statsStart >= 600) {
    const info = view.renderer.info.render;
    $('stats').textContent = `FPS ${(frames * 1000 / (now - statsStart)).toFixed(0)} · DrawCall ${info.calls} · 삼각형 ${info.triangles.toLocaleString()}`;
    frames = 0; statsStart = now;
  }
});
view.renderer.domElement.addEventListener('webglcontextlost', event => {
  event.preventDefault(); logError('그래픽 연결이 끊어졌습니다. 페이지를 새로고침해 주세요.');
});
window.addEventListener('pagehide', event => {
  if (event.persisted) return;
  closed = true; clearCharacters(); stage?.dispose(); assets.dispose(); void cache.dispose(); view.dispose();
});
await reload();
