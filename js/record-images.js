// Per-record pictures. Independent of shared word/category icon mappings.
const recordImageCache = new Map();

function recordImagePath(value) {
  const path = typeof value === 'string' ? value : '';
  return /^assets\/images\/(skills|synergies)\/[^/\\?#]+\.(png|jpe?g|webp|gif)$/i.test(path) ? path : '';
}

function getCachedRecordImage(value) {
  const path = recordImagePath(value);
  if (!path) return null;
  if (recordImageCache.has(path)) return recordImageCache.get(path);
  const image = new Image();
  image.src = path;
  recordImageCache.set(path,image);
  return image;
}

function renderRecordImageName(record) {
  const path = recordImagePath(record?.icon);
  return `<span class="record-image-name">${path ? `<img class="record-image-thumb" src="${escapeHtml(path)}" alt="" loading="lazy" onerror="this.hidden=true">` : ''}<span>${escapeHtml(record?.name || '')}</span></span>`;
}

function openRecordImageEditor(kind, value = '') {
  const host = document.getElementById(`${kind}ImageEditor`);
  host.innerHTML = `<fieldset class="record-image-editor"><legend>그림</legend>
    <div class="record-image-controls"><img class="record-image-preview" alt="선택한 그림" hidden>
    <label>새 그림 추가<input type="file" accept="image/png,image/jpeg,image/webp,image/gif"></label>
    <button type="button" class="record-image-clear">선택 해제</button></div>
    <p class="text-body-secondary">PNG, JPG, WEBP, GIF · 최대 5MB. 추가한 파일은 보관함에 남으며, 선택은 저장할 때 적용됩니다.</p>
    <details><summary>보관함에서 선택</summary><button type="button" class="record-image-refresh">목록 새로고침</button><div class="record-image-gallery"></div></details>
    <p class="record-image-status" role="status" aria-live="polite"></p></fieldset>`;
  const editor = host.firstElementChild;
  editor.imagePath = recordImagePath(value);
  editor.imageBusy = false;
  const preview = editor.querySelector('img');
  const status = editor.querySelector('.record-image-status');
  const select = path => {
    editor.imagePath = recordImagePath(path);
    preview.hidden = !editor.imagePath;
    if (editor.imagePath) preview.src = editor.imagePath; else preview.removeAttribute('src');
    editor.querySelectorAll('.record-image-gallery button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.path === editor.imagePath)));
  };
  preview.onerror = () => { preview.hidden = true; status.textContent = '선택한 파일을 표시할 수 없습니다. 다른 그림을 선택하거나 해제하세요.'; };
  select(value);
  let request = 0;
  const refresh = async () => {
    const version = ++request;
    status.textContent = '그림 목록을 불러오는 중…';
    try {
      const response = await fetch(`/api/assets/${kind}`, {cache:'no-store'});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const rows = await response.json();
      if (!Array.isArray(rows)) throw new Error('목록 형식 오류');
      if (!editor.isConnected || version !== request) return;
      const gallery = editor.querySelector('.record-image-gallery');
      gallery.replaceChildren();
      for (const row of rows) {
        if (!recordImagePath(row.path)) continue;
        const button = document.createElement('button');
        button.type = 'button'; button.dataset.path = row.path; button.title = row.name;
        button.setAttribute('aria-label', row.name);
        button.innerHTML = `<img src="${escapeHtml(row.path)}" alt="" loading="lazy" onerror="this.hidden=true"><span>${escapeHtml(row.name)}</span>`;
        button.onclick = () => { select(row.path); status.textContent = '그림을 선택했습니다. 저장하면 적용됩니다.'; };
        gallery.appendChild(button);
      }
      select(editor.imagePath);
      status.textContent = gallery.childElementCount ? '' : '등록된 그림이 없습니다. 새 그림을 추가해주세요.';
    } catch (error) {
      if (editor.isConnected && version === request) status.textContent = `목록을 불러오지 못했습니다. 서버를 재시작한 뒤 목록 새로고침을 누르세요. (${error.message})`;
      logError('record-image', '그림 목록 조회 실패', error);
    }
  };
  editor.querySelector('.record-image-refresh').onclick = refresh;
  editor.querySelector('.record-image-clear').onclick = () => { select(''); status.textContent = '선택을 해제했습니다. 저장하면 적용됩니다.'; };
  editor.querySelector('input').onchange = async event => {
    const file = event.target.files[0];
    if (!file) return;
    editor.imageBusy = true; editor.disabled = true; ++request;
    status.textContent = '그림을 추가하는 중…';
    try {
      if (!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error('5MB 이하 PNG, JPG, WEBP, GIF를 선택하세요.');
      const dataUrl = await new Promise((resolve,reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('파일을 읽지 못했습니다.')); reader.readAsDataURL(file);
      });
      const path = await uploadImageAsset(kind, dataUrl, file.name.replace(/\.[^.]+$/, ''));
      if (!editor.isConnected) return;
      select(path); await refresh();
      status.textContent = '보관함에 추가했습니다. 저장하면 선택한 그림이 적용됩니다.';
    } catch (error) {
      status.textContent = `그림 추가 실패: ${error.message}`;
      logError('record-image', '그림 추가 실패', error);
    } finally {
      editor.imageBusy = false; editor.disabled = false; event.target.value = '';
    }
  };
  refresh();
}

function getRecordImageSelection(kind) {
  const editor = document.getElementById(`${kind}ImageEditor`).firstElementChild;
  if (editor.imageBusy) throw new Error('그림 추가가 끝난 뒤 저장해주세요.');
  return editor.imagePath;
}
