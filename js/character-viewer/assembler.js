import { CharacterPartPreview } from './character-parts.js?v=20261017-color1';

import { PART_COLOR_PROFILES, randomPartColor } from './part-colors.js?v=20261017-color2';
import { applyOutfitVisibility, restoreOutfitVisibility } from './equipment-visibility.js?v=20261017-rules2';

const API = '/api/character-assets/parts';
const STORAGE_KEY = 'sdCharacterAssembler.v1';

export function setupAssembler(viewer, { onBusyChange = () => {}, onChange = () => {} } = {}) {
  const byId = id => document.getElementById(id);
  const state = { gender: 'female', bodyParts: {}, equipment: {} };
  let bodyCategories = [], equipmentCategories = [], catalogData = null;
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

  const visibilityTargets = () => ({
    bodyMeshes: viewer.model ? [viewer.model.getObjectByName('Mesh_0')].filter(node => node?.isSkinnedMesh) : [],
    hairRoots: [bodyPreview.instances.get('hair')?.owner].filter(Boolean),
    headwearRoot: equipmentPreview.instances.get('equipmentHead')?.source || null,
    clothesRoot: equipmentPreview.instances.get('clothes')?.source || null,
  });
  const applyVisibilityRules = () => applyOutfitVisibility(visibilityTargets());
  const restoreVisibilityRules = () => restoreOutfitVisibility(visibilityTargets());

  const getState = () => JSON.parse(JSON.stringify(state));
  const syncState = () => {
    const gender = viewer.model?.userData?.sdAppearance?.base;
    if (gender === 'male' || gender === 'female') state.gender = gender;
    state.bodyParts = {}; state.equipment = {};
    for (const category of bodyCategories) {
      const file = category.files.find(item => item.path === bodyPreview.selections.get(category.id));
      state.bodyParts[category.id] = file ? { assetId: file.id, name: file.displayName, color: bodyPreview.colors.get(category.id) || null } : null;
    }
    for (const category of equipmentCategories) {
      const file = category.files.find(item => item.path === equipmentPreview.selections.get(category.id));
      state.equipment[category.slot || category.id] = file ? { assetId: file.id, name: file.displayName, color: equipmentPreview.colors.get(category.id) || null } : null;
    }
    applyVisibilityRules();
    onChange(getState());
  };

  function renderCategory(category, preview, container) {
    const row = document.createElement('div'); row.className = 'assembler-part-row'; row.dataset.assemblerCategory = category.id;
    const label = document.createElement('label'); label.htmlFor = `assemble-${category.id}`; label.textContent = category.label;
    const select = document.createElement('select'); select.id = `assemble-${category.id}`;
    select.append(new Option('없음', ''));
    category.files.forEach(file => select.append(new Option(file.displayName, file.path)));
    select.value = preview.selections.get(category.id) || '';
    const picker = document.createElement('div'); picker.className = 'part-picker'; picker.append(select);
    const profile = category.colorProfile;
    if (profile) {
      const paletteButton = document.createElement('button'); paletteButton.type = 'button'; paletteButton.className = 'palette-button'; paletteButton.title = `${category.label} 색상`; paletteButton.setAttribute('aria-label', `${category.label} 색상 선택`);
      const palette = document.createElement('div'); palette.className = 'part-palette'; palette.hidden = true;
      const initial = preview.colors.get(category.id) || profile.colors[0]?.value;
      if (initial) { preview.colors.set(category.id, initial); paletteButton.style.setProperty('--part-color', initial); }
      for (const color of profile.colors) {
        const swatch = document.createElement('button'); swatch.type = 'button'; swatch.className = 'color-swatch'; swatch.title = color.label; swatch.setAttribute('aria-label', color.label); swatch.style.setProperty('--swatch', color.value);
        swatch.addEventListener('click', () => {
          preview.setColor(category.id, color.value); paletteButton.style.setProperty('--part-color', color.value); palette.hidden = true; syncState();
        });
        palette.append(swatch);
      }
      paletteButton.addEventListener('click', () => { palette.hidden = !palette.hidden; });
      picker.append(paletteButton, palette);
    }
    const partStatus = document.createElement('small'); partStatus.className = 'part-status'; partStatus.textContent = `${category.files.length}개`;
    select.addEventListener('change', async () => {
      const requested = select.value;
      if (!requested) { preview.remove(category.id); partStatus.textContent = '없음'; syncState(); return; }
      const asset = category.files.find(file => file.path === requested);
      try { await preview.load(category, asset, asset.displayName); if (select.value === requested) syncState(); }
      catch { select.value = preview.selections.get(category.id) || ''; }
    });
    row.append(label, picker, partStatus); container.append(row);
  }

  const render = data => {
    catalogData = data;
    const allParts = data.categories || [];
    const currentGenderOnly = category => ({ ...category, colorProfile: PART_COLOR_PROFILES[category.id] || null,
      files: (category.files || []).filter(file => !file.gender || file.gender === state.gender) });
    bodyCategories = allParts.filter(category => category.id !== 'clothes').map(currentGenderOnly);
    const clothes = allParts.filter(category => category.id === 'clothes').map(category => currentGenderOnly({ ...category, slot: 'clothes', label: '의류' }));
    equipmentCategories = [...clothes, ...(data.equipmentCategories || []).map(currentGenderOnly)];
    for (const [categories, preview] of [[bodyCategories, bodyPreview], [equipmentCategories, equipmentPreview]]) {
      for (const category of categories) {
        const selected = preview.selections.get(category.id);
        if (selected && !category.files.some(file => file.path === selected)) preview.remove(category.id);
      }
    }
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
      for (const category of categories) {
        if (!category.colorProfile) continue;
        const color = randomPartColor(category.colorProfile);
        if (!color) continue;
        preview.setColor(category.id, color.value);
        document.querySelector(`[data-assembler-category="${category.id}"] .palette-button`)?.style.setProperty('--part-color', color.value);
      }
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
        const asset = category.files.find(file => file.id === value?.assetId || file.aliases?.includes(value?.assetId) || file.path === value?.path || file.name === value?.name);
        const select = byId(`assemble-${category.id}`);
        if (!asset) { preview.remove(category.id); if (select) select.value = ''; document.querySelector(`[data-assembler-category="${category.id}"] .part-status`)?.replaceChildren('없음'); continue; }
        if (category.colorProfile) {
          const restoredColor = value?.color || category.colorProfile.colors[0]?.value;
          if (restoredColor) preview.colors.set(category.id, restoredColor);
          document.querySelector(`[data-assembler-category="${category.id}"] .palette-button`)?.style.setProperty('--part-color', restoredColor);
        }
        if (select) select.value = asset.path;
        jobs.push(preview.load(category, asset, asset.displayName).catch(() => { if (select) select.value = ''; }));
      }
    }
    await Promise.all(jobs); syncState();
  };

  const save = name => {
    syncState();
    const payload = { version: 2, name: name.trim() || '이름 없는 GLB 캐릭터', ...getState(), savedAt: new Date().toISOString() };
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
    setGender(gender) { state.gender = gender === 'male' ? 'male' : 'female'; if (catalogData) render(catalogData); },
    async setModel(root) { if (root) root.userData.sdAppearance = { ...(root.userData.sdAppearance || {}), base: state.gender }; await Promise.all([bodyPreview.setModel(root), equipmentPreview.setModel(root)]); document.querySelectorAll('.assembler-controls').forEach(node => { node.disabled = !root; }); syncState(); },
    clear() { restoreVisibilityRules(); bodyPreview.setModel(null); equipmentPreview.setModel(null); document.querySelectorAll('.assembler-controls').forEach(node => { node.disabled = true; }); },
    dispose() { restoreVisibilityRules(); bodyPreview.dispose(); equipmentPreview.dispose(); },
  };
}
