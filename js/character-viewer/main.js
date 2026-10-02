import { CharacterViewer } from './CharacterViewer.js?v=20260926-equipment1';
import { setupEquipment } from './equipment.js?v=20260926-equipment1';
import { setupComposer } from '../portrait/composer.js?v=20260929-bald7';

const byId = id => document.getElementById(id);
let viewer;
let equipment;
let composer;
let files = [];
let clipNames = [];
let modelRows = [];

function showError(message) {
  byId('error-message').textContent = message;
  byId('error-message').hidden = false;
}

function list(id, lines) {
  byId(id).replaceChildren(...(lines.length ? lines : ['없음']).map(text => {
    const item = document.createElement('li');
    item.textContent = text;
    return item;
  }));
}

function renderInfo() {
  byId('model-info').replaceChildren(...modelRows.flatMap(([label, value]) => {
    const dt = document.createElement('dt'), dd = document.createElement('dd');
    dt.textContent = label;
    dd.textContent = value;
    return [dt, dd];
  }));
}

function updateInfo(label, value) {
  const row = modelRows.find(row => row[0] === label);
  if (row) row[1] = value;
  renderInfo();
}

function onState(event) {
  if (event.type === 'unloading') {
    composer?.clear();
    equipment?.clear();
  } else if (event.type === 'loading') {
    byId('load-status').textContent = `${event.name} 불러오는 중…`;
    byId('error-message').hidden = true;
    byId('animation-controls').disabled = true;
    byId('display-controls').disabled = true;
    byId('empty-hint').hidden = false;
    byId('model-scale').value = '1';
    byId('model-scale').setCustomValidity('');
    byId('show-skeleton').checked = false;
    byId('clip-select').replaceChildren(new Option('애니메이션 없음', ''));
    byId('playback-status').textContent = '모델을 불러오는 중입니다.';
    modelRows = [['모델', '불러오는 중']];
    renderInfo();
    for (const id of ['texture-info', 'clip-info', 'rig-info']) list(id, []);
  } else if (event.type === 'progress') {
    byId('load-status').textContent = event.total > 0
      ? `모델 데이터 수신 ${Math.round(event.loaded / event.total * 100)}% · 리소스 처리 중…`
      : `${(event.loaded / 1024).toFixed(0)} KB 수신 · 리소스 처리 중…`;
  } else if (event.type === 'loaded') {
    equipment?.setModel(viewer.model);
    composer?.setModel(viewer.model);
    const { info, clips } = event;
    byId('load-status').textContent = `${event.name} 로딩 완료`;
    byId('empty-hint').hidden = true;
    byId('display-controls').disabled = false;
    byId('animation-controls').disabled = clips.length === 0;
    clipNames = clips.map((clip, index) => clip.name || `이름 없는 클립 ${index + 1}`);
    byId('clip-select').replaceChildren(...(clips.length
      ? clips.map((clip, index) => new Option(`${clipNames[index]} · ${clip.duration.toFixed(2)}s`, String(index)))
      : [new Option('애니메이션 없음', '')]));
    byId('playback-status').textContent = clips.length ? '재생 준비' : '포함된 애니메이션이 없는 정적 모델입니다.';
    modelRows = [['모델', event.name], ['Triangles', info.triangles.toLocaleString()],
      ['Mesh / Material', `${info.meshes} / ${info.materials}`], ['Texture / Bone', `${info.textures.length} / ${info.bones.length}`],
      ['클립 수', String(clips.length)], ['현재 클립', '없음'], ['표시 배율', '1×'],
      ['원본 루트 scale', event.sourceScale.map(value => value.toFixed(3)).join(', ')]];
    renderInfo();
    list('texture-info', info.textures.map(texture => `${texture.name} · ${texture.width} × ${texture.height} · ${texture.colorSpace}`));
    list('clip-info', clips.map((clip, index) => `${clipNames[index]} · ${clip.duration.toFixed(3)}초 · ${clip.tracks.length} tracks`));
    list('rig-info', [...info.attachments.map(point => `${point.name}: ${point.found ? '있음' : '없음 (선택 사항)'}`), ...info.bones]);
  } else if (event.type === 'playback') {
    const name = clipNames[event.index];
    const label = { playing: '재생 중', paused: '일시정지', stopped: '정지 · 첫 프레임', finished: '재생 완료' }[event.state];
    byId('playback-status').textContent = `${name} · ${label}`;
    updateInfo('현재 클립', name);
  } else if (event.type === 'error' || event.type === 'fatal') {
    byId('load-status').textContent = event.type === 'fatal' ? '뷰어 실행 중단' : '모델 로딩 실패';
    byId('playback-status').textContent = '재생할 수 없습니다.';
    byId('animation-controls').disabled = true;
    byId('display-controls').disabled = true;
    modelRows = [['모델', '불러온 모델 없음']];
    renderInfo();
    showError(event.message || `${event.error.message || event.error}\n경로, glTF의 BIN·텍스처 참조, 외부 서버의 CORS 설정을 확인하세요. Draco / Meshopt / KTX2 압축은 아직 지원하지 않습니다.`);
    if (event.type === 'fatal') byId('source-controls').disabled = true;
  }
}

try {
  viewer = new CharacterViewer(byId('viewport'), onState);
  equipment = setupEquipment(viewer);
  composer = setupComposer(viewer);
  byId('source-controls').disabled = false;
  byId('load-status').textContent = '준비 완료 · 모델을 선택하세요.';
} catch (error) {
  byId('load-status').textContent = '뷰어 초기화 실패';
  showError(`WebGL2를 지원하는 브라우저와 그래픽 가속이 필요합니다. ${error.message}`);
}

function loadPath(value) {
  try {
    const url = new URL(value, document.baseURI);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('HTTP(S) URL 또는 서버 상대 경로를 입력하세요.');
    if (!/\.(glb|gltf)$/i.test(url.pathname)) throw new Error('.glb 또는 .gltf 경로를 입력하세요.');
    viewer.load(url.href, decodeURIComponent(url.pathname.split('/').pop()));
  } catch (error) { showError(error.message); }
}

byId('url-form').addEventListener('submit', event => {
  event.preventDefault();
  loadPath(byId('model-url').value.trim());
});
document.querySelectorAll('[data-sd-model]').forEach(button=>button.addEventListener('click',()=>{
  byId('model-url').value=button.dataset.sdModel==='bald'?'assets/characters/base/human_sd_bald_v1.glb':`assets/characters/base/human_sd_${button.dataset.sdModel}_v2.glb`;
  loadPath(byId('model-url').value);
}));

function loadLocal(index) {
  const file = files[index];
  if (!file) return;
  const url = URL.createObjectURL(file);
  viewer.load(url, file.name, () => URL.revokeObjectURL(url));
}

byId('model-files').addEventListener('change', event => {
  files = [...event.target.files].filter(file => /\.glb$/i.test(file.name));
  byId('local-models').disabled = files.length === 0;
  byId('local-models').replaceChildren(...(files.length
    ? files.map((file, index) => new Option(file.name, String(index)))
    : [new Option('선택한 파일 없음', '')]));
  if (files.length) loadLocal(0);
  else showError('로컬 선택은 .glb 파일을 지원합니다. glTF는 서버 경로로 불러오세요.');
  event.target.value = '';
});
byId('local-models').addEventListener('change', event => loadLocal(Number(event.target.value)));
byId('clip-select').addEventListener('change', event => viewer.selectClip(Number(event.target.value)));
byId('play').addEventListener('click', () => viewer.play());
byId('pause').addEventListener('click', () => viewer.pause());
byId('stop').addEventListener('click', () => viewer.stop());
byId('loop').addEventListener('change', event => viewer.setLoop(event.target.checked));
byId('speed').addEventListener('input', event => {
  const speed = Number(event.target.value);
  viewer.setSpeed(speed);
  byId('speed-value').textContent = `${speed.toFixed(2)}×`;
});
byId('frame-model').addEventListener('click', () => viewer.frameModel());
byId('model-scale').addEventListener('change', event => {
  const value = Number(event.target.value);
  if (viewer.setScale(value)) {
    event.target.setCustomValidity('');
    updateInfo('표시 배율', `${value}×`);
  } else {
    event.target.setCustomValidity('0.001~1000 사이의 배율을 입력하세요.');
    event.target.reportValidity();
  }
});
byId('show-skeleton').addEventListener('change', event => {
  if (viewer.skeletonHelper) viewer.skeletonHelper.visible = event.target.checked;
});
window.addEventListener('pagehide', event => { if (!event.persisted) viewer?.dispose(); });

// No implicit nonexistent default asset; query loading is explicitly requested by the URL.
const requestedModel = new URLSearchParams(location.search).get('model');
if (requestedModel && viewer) {
  byId('model-url').value = requestedModel;
  loadPath(requestedModel);
}
