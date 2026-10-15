import { CharacterViewer } from './CharacterViewer.js?v=20261010-visual12';
import { setupAssembler } from './assembler.js?v=20261016-assembler2';

const byId = id => document.getElementById(id);
const BASE = { male: 'assets/characters/base/대머리 블랭크 얼굴 남자.glb', female: 'assets/characters/base/대머리 블랭크 얼굴 여자.glb' };
let clips = [], clipNames = [], pendingRestore = false;
let viewer, assembler;

function setMessage(message, error = false) { byId('assembly-status').textContent = message; byId('assembly-status').dataset.error = String(error); }
function loadGender(gender, restore = false) {
  assembler.state.gender = gender; pendingRestore = restore;
  document.querySelectorAll('[data-gender]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.gender === gender)));
  viewer.load(new URL(BASE[gender], document.baseURI).href, `${gender} Base`);
}
function downloadPortrait() {
  if (assembler.bodyPreview.pendingLoads || assembler.equipmentPreview.pendingLoads) return setMessage('GLB 로딩이 끝난 뒤 초상화를 생성하세요.', true);
  const link = document.createElement('a'); link.download = `${byId('composition-name').value.trim() || 'sd-character'}-portrait.png`;
  link.href = viewer.renderer.domElement.toDataURL('image/png'); link.click(); setMessage('현재 3D Preview를 PNG로 저장했습니다.');
}
function onState(event) {
  if (event.type === 'unloading') assembler?.clear();
  if (event.type === 'loading') setMessage(`${event.name} 로딩 중…`);
  if (event.type === 'loaded') {
    clips = event.clips; clipNames = clips.map((clip, index) => clip.name || `이름 없는 클립 ${index + 1}`);
    byId('clip-select').replaceChildren(...(clips.length ? clips.map((clip, index) => new Option(`${clipNames[index]} · ${clip.duration.toFixed(2)}s`, String(index))) : [new Option('애니메이션 없음', '')]));
    byId('animation-controls').disabled = !clips.length;
    byId('debug-info').textContent = [`Model: ${event.name}`, `Triangles: ${event.info.triangles.toLocaleString()}`, `Mesh / Material: ${event.info.meshes} / ${event.info.materials}`, `Texture / Bone: ${event.info.textures.length} / ${event.info.bones.length}`, `AnimationClip: ${clips.length}`].join('\n');
    assembler.setModel(viewer.model).then(async () => { if (pendingRestore) await assembler.restore(); pendingRestore = false; setMessage(`${event.name} 준비 완료`); });
  }
  if (event.type === 'playback') byId('playback-status').textContent = `${clipNames[event.index]} · ${event.state}`;
  if (event.type === 'error' || event.type === 'fatal') setMessage(event.message || event.error?.message || '모델 로딩 실패', true);
}

viewer = new CharacterViewer(byId('viewport'), onState);
assembler = setupAssembler(viewer, { onBusyChange: busy => { byId('portrait-download').disabled = busy; byId('save-composition').disabled = busy; } });
globalThis.characterViewerDebug = { viewer, assembler };
await assembler.refresh();
document.querySelectorAll('[data-gender]').forEach(button => button.addEventListener('click', () => loadGender(button.dataset.gender)));
byId('catalog-refresh').addEventListener('click', () => assembler.refresh().catch(error => setMessage(error.message, true)));
byId('random-composition').addEventListener('click', () => assembler.randomize());
byId('portrait-download').addEventListener('click', downloadPortrait);
byId('save-composition').addEventListener('click', () => assembler.save(byId('composition-name').value));
byId('restore-composition').addEventListener('click', async () => {
  let saved; try { saved = JSON.parse(localStorage.getItem('sdCharacterAssembler.v1') || 'null'); } catch { saved = null; }
  if (!saved) return setMessage('저장된 GLB 조합이 없습니다.', true);
  if (saved.gender !== assembler.state.gender) loadGender(saved.gender, true); else await assembler.restore();
});
byId('clip-select').addEventListener('change', event => viewer.selectClip(Number(event.target.value)));
byId('play').addEventListener('click', () => viewer.play()); byId('pause').addEventListener('click', () => viewer.pause()); byId('stop').addEventListener('click', () => viewer.stop());
byId('loop').addEventListener('change', event => viewer.setLoop(event.target.checked));
byId('frame-model').addEventListener('click', () => viewer.frameModel());
byId('show-skeleton').addEventListener('change', event => { if (viewer.skeletonHelper) viewer.skeletonHelper.visible = event.target.checked; });
window.addEventListener('pagehide', event => { if (!event.persisted) { assembler.dispose(); viewer.dispose(); } });
let saved = null; try { saved = JSON.parse(localStorage.getItem('sdCharacterAssembler.v1') || 'null'); } catch {}
loadGender(saved?.gender === 'male' ? 'male' : 'female', Boolean(saved));

