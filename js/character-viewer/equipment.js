import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { disposeObject } from './CharacterViewer.js?v=20260926-equipment1';

export const WEAPON_VISUALS = Object.freeze({
  oneHandSword: 'oneHandSword', twoHandSword: 'twoHandSword',
  oneHandMace: 'oneHandMace', twoHandMace: 'twoHandMace',
  staff: 'staff', bow: 'bow', gun: 'gun', '방패': 'shield', '치유서': 'healingBook'
});
export const ARMOR_VISUALS = Object.freeze({ plate: 'armor_plate', chain: 'armor_chain', leather: 'armor_leather', cloth: 'armor_cloth' });

export function allowsSlot(category, slot) {
  if (slot === 'top') return category.type === 'armor';
  if (category.type !== 'weapon') return false;
  if (slot === 'subWeapon') return category.handType !== 'twoHand' && category.slotType !== 'mainOnly';
  return category.slotType !== 'subOnly';
}

// Owns only preview equipment. Game equipment data and combat state are never mutated.
export class EquipmentPreview {
  constructor() { this.root = null; this.tokens = {}; this.attached = new Map(); }

  setModel(root) { this.clear(); this.root = root; }

  remove(slot) {
    const item = this.attached.get(slot);
    if (!item) return;
    item.scene.removeFromParent();
    disposeObject(item.scene);
    if (item.hiddenTop) item.hiddenTop.visible = item.topWasVisible;
    this.attached.delete(slot);
  }

  async equip(slot, category) {
    const token = this.tokens[slot] = (this.tokens[slot] || 0) + 1;
    this.remove(slot);
    if (!category || !this.root) return;
    if (!allowsSlot(category, slot)) throw new Error('이 카테고리는 선택한 슬롯에 장착할 수 없습니다.');
    const asset = slot === 'top' ? ARMOR_VISUALS[category.key] : WEAPON_VISUALS[category.key];
    if (!asset) throw new Error(`${category.label}: 아직 외형이 없는 카테고리입니다.`);
    const socketName = slot === 'top' ? 'Chest' : slot === 'subWeapon' || category.key === 'bow' ? 'Weapon_L' : 'Weapon_R';
    const socket = this.root.getObjectByName(socketName);
    if (!socket) throw new Error(`${socketName} 장착 지점이 없습니다.`);
    if (slot === 'top' && !this.root.getObjectByName('Top')) throw new Error('방어구 시제품은 공통 SD 베이스의 체형을 기준으로 합니다.');
    const root = this.root;
    const gltf = await new GLTFLoader().loadAsync(`/assets/characters/equipment/${asset}.glb`);
    if (token !== this.tokens[slot] || this.root !== root) { disposeObject(gltf.scene); return; }
    // The bow is held by the left hand and its arc faces +Z.
    if (category.key === 'bow') gltf.scene.rotation.y = -Math.PI / 2;
    const hiddenTop = slot === 'top' ? root.getObjectByName('Top') : null;
    const topWasVisible = hiddenTop?.visible;
    if (hiddenTop) hiddenTop.visible = false;
    socket.add(gltf.scene);
    this.attached.set(slot, { scene: gltf.scene, hiddenTop, topWasVisible });
  }

  clear() {
    for (const slot of ['mainWeapon', 'subWeapon', 'top']) {
      this.tokens[slot] = (this.tokens[slot] || 0) + 1;
      this.remove(slot);
    }
    this.root = null;
  }
}

export function setupEquipment(viewer) {
  const byId = id => document.getElementById(id);
  const preview = new EquipmentPreview();
  const selects = { mainWeapon: byId('equip-main'), subWeapon: byId('equip-sub'), top: byId('equip-top') };
  const choices = new Map();
  let categories = [], items = [], ready = false, operation = 0, catalogRequest = 0;
  const status = byId('equipment-status');
  const selected = slot => choices.get(selects[slot].value);

  function refreshEnabled() {
    byId('equipment-controls').disabled = !ready || !preview.root;
    const twoHand = selected('mainWeapon')?.handType === 'twoHand';
    if (twoHand) selects.subWeapon.value = '';
    selects.subWeapon.disabled = Boolean(twoHand);
  }

  async function apply() {
    const ticket = ++operation;
    refreshEnabled();
    if (!preview.root || !ready) return;
    status.textContent = '장비 외형 불러오는 중…';
    const results = await Promise.allSettled(Object.keys(selects).map(slot => preview.equip(slot, selected(slot))));
    if (ticket !== operation) return;
    const failed = results.filter(result => result.status === 'rejected');
    status.textContent = failed.length ? failed.map(result => result.reason.message).join(' / ')
      : selected('mainWeapon')?.handType === 'twoHand'
        ? '장착 완료 · 양손 무기는 보조 슬롯을 비웁니다. 양손 그립 IK·전용 공격 동작은 아직 없습니다.'
        : '장착 완료 · 외형 미리보기이며 게임 데이터에 저장하지 않습니다.';
  }

  function populate() {
    choices.clear();
    for (const [slot, select] of Object.entries(selects)) {
      const previous = select.value;
      select.replaceChildren(new Option('장착 안 함', ''));
      const inventory = document.createElement('optgroup'); inventory.label = '등록된 아이템';
      const samples = document.createElement('optgroup'); samples.label = '카테고리 시제품';
      function option(group, value, label, category) {
        const entry = new Option(label, value);
        entry.disabled = !(slot === 'top' ? ARMOR_VISUALS[category.key] : WEAPON_VISUALS[category.key]);
        if (entry.disabled) entry.textContent += ' (외형 미지원)';
        choices.set(value, category);
        group.append(entry);
      }
      for (const item of items) {
        if (slot === 'top' ? item.slot !== 'top' : !['mainWeapon', 'subWeapon'].includes(item.slot)) continue;
        const category = categories.find(c => c.type === (slot === 'top' ? 'armor' : 'weapon') && c.key === (slot === 'top' ? item.armorCategory : item.weaponCategory));
        if (category && allowsSlot(category, slot)) option(inventory, `item:${item.id}`, item.name, category);
      }
      for (const category of categories) {
        if (allowsSlot(category, slot)) option(samples, `category:${category.type}:${category.key}`, category.label, category);
      }
      select.append(inventory, samples);
      if ([...select.options].some(o => o.value === previous && !o.disabled)) select.value = previous;
    }
    refreshEnabled();
  }

  async function reloadCatalog() {
    const request = ++catalogRequest;
    byId('equip-refresh').disabled = true;
    status.textContent = '현재 아이템·카테고리 읽는 중…';
    try {
      const values = await Promise.all(['/api/categories', '/api/items'].map(async url => {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) throw new Error(`장비 데이터 HTTP ${response.status}`);
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error('장비 데이터는 배열이어야 합니다.');
        return data;
      }));
      if (request !== catalogRequest) return;
      [categories, items] = values;
      ready = true;
      populate();
      if (preview.root) await apply();
      else status.textContent = '장비 목록 준비 완료 · 모델을 먼저 불러오세요.';
    } catch (error) { status.textContent = `장비 목록 로딩 실패: ${error.message}`; }
    finally { if (request === catalogRequest) byId('equip-refresh').disabled = false; }
  }

  Object.values(selects).forEach(select => select.addEventListener('change', apply));
  byId('equip-refresh').addEventListener('click', reloadCatalog);
  byId('equip-clear').addEventListener('click', () => { Object.values(selects).forEach(select => { select.value = ''; }); apply(); });
  reloadCatalog();
  return {
    setModel(root) { ++operation; preview.setModel(root); refreshEnabled(); if (root) apply(); },
    clear() { ++operation; preview.clear(); refreshEnabled(); status.textContent = '모델을 불러오면 장비를 장착할 수 있습니다.'; }
  };
}
