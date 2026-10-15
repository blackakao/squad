import { CharacterPartPreview } from './character-parts.js?v=20261016-equipment1';

const API = '/api/character-assets/parts';

export function setupGlbEquipment(viewer, { onBusyChange = () => {}, onCombinationChange = () => {} } = {}) {
  const byId = id => document.getElementById(id);
  const list = byId('glb-equipment-categories');
  const summary = byId('glb-equipment-status');
  const controls = byId('glb-equipment-controls');
  let categories = [];

  const preview = new CharacterPartPreview(viewer, (id, state, message) => {
    const row = list.querySelector(`[data-category="${id}"]`);
    if (row) {
      row.dataset.state = state;
      row.querySelector('.part-status').textContent = message;
    }
    summary.textContent = message;
  }, () => [], onBusyChange);
  preview.setMode('glb');

  const notify = () => onCombinationChange(getState());
  const getState = () => {
    const parts = preview.getState().parts;
    const equipment = {};
    for (const category of categories) equipment[category.slot] = parts[category.id] || null;
    return { source: 'glb-equipment', equipment, loading: preview.pendingLoads > 0 };
  };

  const render = data => {
    categories = data.equipmentCategories || [];
    preview.setCategories(categories);
    list.replaceChildren();
    for (const category of categories) {
      const row = document.createElement('div');
      row.className = 'glb-part-row';
      row.dataset.category = category.id;
      const label = document.createElement('label');
      label.htmlFor = `glb-equipment-${category.slot}`;
      label.textContent = category.label;
      const select = document.createElement('select');
      select.id = `glb-equipment-${category.slot}`;
      select.append(new Option('없음', ''));
      category.files.forEach(file => select.append(new Option(file.displayName, file.path)));
      select.value = preview.selections.get(category.id) || '';
      const status = document.createElement('p');
      status.className = 'part-status hint';
      status.textContent = `${category.files.length}개 GLB · ${category.folder}`;
      select.addEventListener('change', async () => {
        const requested = select.value;
        if (!requested) {
          preview.remove(category.id);
          status.textContent = '없음 · 이 슬롯의 GLB 장비만 제거됨';
          notify();
          return;
        }
        const asset = category.files.find(file => file.path === requested);
        try {
          await preview.load(category, asset || requested, asset?.displayName || requested.split('/').pop());
          if (select.value === requested) notify();
        } catch {
          select.value = preview.selections.get(category.id) || '';
        }
      });
      row.append(label, select, status);
      list.append(row);
    }
  };

  const refresh = async () => {
    summary.textContent = 'GLB 장비 폴더 검색 중…';
    try {
      const response = await fetch(API, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      render(data);
      const total = categories.reduce((sum, category) => sum + category.files.length, 0);
      summary.textContent = `${categories.length}개 슬롯 · GLB 장비 ${total}개 발견`;
      return data;
    } catch (error) {
      summary.textContent = `GLB 장비 목록 실패: ${error.message}. server.py를 다시 시작하세요.`;
      return { equipmentCategories: [] };
    }
  };

  byId('glb-equipment-refresh').addEventListener('click', refresh);
  byId('glb-equipment-clear').addEventListener('click', () => {
    categories.forEach(category => {
      preview.remove(category.id);
      const select = byId(`glb-equipment-${category.slot}`);
      if (select) select.value = '';
    });
    summary.textContent = '모든 GLB 장비를 해제했습니다.';
    notify();
  });

  refresh();
  return {
    preview,
    refresh,
    getState,
    async setModel(root) { await preview.setModel(root); controls.disabled = !root; },
    clear() { preview.setModel(null); controls.disabled = true; },
    dispose() { preview.dispose(); },
  };
}
