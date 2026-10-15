import { CharacterPartPreview } from './character-parts.js?v=20261016-assembler1';

const API = '/api/character-assets/parts';
const STORAGE_KEY = 'sdCharacterAssembler.v1';

export function setupAssembler(viewer, { onBusyChange = () => {}, onChange = () => {} } = {}) {
  const byId = id => document.getElementById(id);
  const state = { gender: 'female', bodyParts: {}, equipment: {} };
  let bodyCategories = [], equipmentCategories = [];
  const loading = { body: false, equipment: false };
  const busy = (scope, value) => { loading[scope] = value; onBusyChange(loading.body || loading.equipment); };
  const showStatus = (id, phase, message) => {
    const row = document.querySelector(`[data-assembler-category="${id}"]`);
    if (row) { row.dataset.state = phase; row.querySelector('.part-status').textContent = message; }
    byId('assembly-status').textContent = message;
  };
  const bodyPreview = new CharacterPartPreview(viewer, showStatus, () => [], value => busy('body', value));
  const equipmentPreview = new CharacterPartPreview(viewer, showStatus, () => [], value => busy('equipment', value));
  bodyPreview.setMode('glb'); equipmentPreview.setMode('glb');

  const getState = () => JSON.parse(JSON.stringify(state));
  const syncState = () => {
    const gender = viewer.model?.userData?.sdAppearance?.base;
    if (gender === 'male' || gender === 'female') state.gender = gender;
    state.bodyParts = {}; state.equipment = {};
    for (const category of bodyCategories) {
      const file = category.files.find(item => item.path === bodyPreview.selections.get(category.id));
      state.bodyParts[category.id] = file ? { assetId: file.id, name: file.displayName } : null;
    }
    for (const category of equipmentCategories) {
      const file = category.files.find(item => item.path === equipmentPreview.selections.get(category.id));
      state.equipment[category.slot || category.id] = file ? { assetId: file.id, name: file.displayName } : null;
    }
    onChange(getState());
  };

  function renderCategory(category, preview, container) {
    const row = document.createElement('div'); row.className = 'assembler-part-row'; row.dataset.assemblerCategory = category.id;
    const label = document.createElement('label'); label.htmlFor = `assemble-${category.id}`; label.textContent = category.label;
    const select = document.createElement('select'); select.id = `assemble-${category.id}`;
    select.append(new Option('없음', ''));
    category.files.forEach(file => select.append(new Option(file.displayName, file.path)));
    select.value = preview.selections.get(category.id) || '';
    const partStatus = document.createElement('small'); partStatus.className = 'part-status'; partStatus.textContent = `${category.files.length}개`;
    select.addEventListener('change', async () => {
      const requested = select.value;
      if (!requested) { preview.remove(category.id); partStatus.textContent = '없음'; syncState(); return; }
      const asset = category.files.find(file => file.path === requested);
      try { await preview.load(category, asset, asset.displayName); if (select.value === requested) syncState(); }
      catch { select.value = preview.selections.get(category.id) || ''; }
    });
    row.append(label, select, partStatus); container.append(row);
  }

  const render = data => {
    const allParts = data.categories || [];
    bodyCategories = allParts.filter(category => category.id !== 'clothes');
    const clothes = allParts.filter(category => category.id === 'clothes').map(category => ({ ...category, slot: 'clothes', label: '의류' }));
    equipmentCategories = [...clothes, ...(data.equipmentCategories || [])];
    bodyPreview.setCategories(bodyCategories); equipmentPreview.setCategories(equipmentCategories);
    const body = byId('body-part-list'), equipment = byId('equipment-part-list');
    body.replaceChildren(); equipment.replaceChildren();
    bodyCategories.forEach(category => renderCategory(category, bodyPreview, body));
    equipmentCategories.forEach(category => renderCategory(category, equipmentPreview, equipment));
  };

  const refresh = async () => {
    byId('assembly-status').textContent = 'GLB 카탈로그 새로고침 중…';
    const response = await fetch(API, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json(); render(data);
    const count = [...bodyCategories, ...equipmentCategories].reduce((sum, category) => sum + category.files.length, 0);
    byId('assembly-status').textContent = `${bodyCategories.length}개 신체 분류 · ${equipmentCategories.length}개 장비 분류 · GLB ${count}개`;
    return data;
  };

  const randomize = async () => {
    if (!viewer.model) return;
    const results = await Promise.all([bodyPreview.randomize(), equipmentPreview.randomize()]);
    for (const [categories, preview] of [[bodyCategories, bodyPreview], [equipmentCategories, equipmentPreview]]) {
      categories.forEach(category => { const select = byId(`assemble-${category.id}`); if (select) select.value = preview.selections.get(category.id) || ''; });
      categories.forEach(category => { if (!preview.selections.get(category.id)) document.querySelector(`[data-assembler-category="${category.id}"] .part-status`)?.replaceChildren('없음'); });
    }
    syncState(); return results;
  };

  const apply = async saved => {
    const jobs = [];
    for (const [categories, preview, values] of [[bodyCategories, bodyPreview, saved.bodyParts || {}], [equipmentCategories, equipmentPreview, saved.equipment || {}]]) {
      for (const category of categories) {
        const key = category.slot || category.id, value = values[key] || values[category.id];
        const asset = category.files.find(file => file.id === value?.assetId || file.path === value?.path || file.name === value?.name);
        const select = byId(`assemble-${category.id}`);
        if (!asset) { preview.remove(category.id); if (select) select.value = ''; document.querySelector(`[data-assembler-category="${category.id}"] .part-status`)?.replaceChildren('없음'); continue; }
        if (select) select.value = asset.path;
        jobs.push(preview.load(category, asset, asset.displayName).catch(() => { if (select) select.value = ''; }));
      }
    }
    await Promise.all(jobs); syncState();
  };

  const save = name => {
    syncState();
    const payload = { version: 1, name: name.trim() || '이름 없는 GLB 캐릭터', ...getState(), savedAt: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    byId('assembly-status').textContent = `저장 완료 · ${payload.name}`; return payload;
  };
  const restore = async () => {
    let saved; try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { saved = null; }
    if (!saved) return null;
    byId('composition-name').value = saved.name || ''; await apply(saved);
    byId('assembly-status').textContent = `저장 조합 복원 · ${saved.name || '이름 없음'}`; return saved;
  };

  return { state, bodyPreview, equipmentPreview, refresh, randomize, save, restore, getState,
    async setModel(root) { if (root) root.userData.sdAppearance = { ...(root.userData.sdAppearance || {}), base: state.gender }; await Promise.all([bodyPreview.setModel(root), equipmentPreview.setModel(root)]); document.querySelectorAll('.assembler-controls').forEach(node => { node.disabled = !root; }); syncState(); },
    clear() { bodyPreview.setModel(null); equipmentPreview.setModel(null); document.querySelectorAll('.assembler-controls').forEach(node => { node.disabled = true; }); },
    dispose() { bodyPreview.dispose(); equipmentPreview.dispose(); },
  };
}
