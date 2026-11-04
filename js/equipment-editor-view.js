// Browser-only item editor UI. Loaded after equipment.js.
function renderItemModifiers(item) {
  document.getElementById('itemStatModifiers').innerHTML=CHARACTER_STAT_DEFS.map(({key,label})=>`<label>${escapeHtml(label)}<input type="number" step="any" data-stat-key="${key}" value="${Number(item?.statModifiers?.[key])||0}"></label>`).join('');
  document.getElementById('itemSkillModifiers').innerHTML='';
  normalizeItemSkillModifiers(item?.skillModifiers).forEach(addItemSkillModifierRow);
}
function addItemSkillModifierRow(modifier=null) {
  const row=document.createElement('div');row.className='item-skill-modifier';
  const skills=skillsJson.filter(skill=>isSkillExecutable(skill) && !isDefaultSkill(skill.id));
  row.innerHTML=`<label>스킬<select class="item-modifier-skill" onchange="updateItemModifierTargets(this.closest('.item-skill-modifier'))"><option value="">스킬 선택</option>${skills.map(skill=>`<option value="${escapeHtml(skill.id)}">${escapeHtml(skill.name)}</option>`).join('')}</select></label><label>대상 효과 · 보조 항목<select class="item-modifier-target"></select></label><label>보정값<input class="item-modifier-value" type="number" step="any" value="${modifier?.value ?? 0}"></label><button type="button" onclick="this.closest('.item-skill-modifier').remove()">보조 삭제</button>`;
  document.getElementById('itemSkillModifiers').appendChild(row);
  if(modifier && !skills.some(s=>s.id===modifier.skillId)) row.querySelector('select').add(new Option('삭제되거나 미지원인 스킬',modifier.skillId));
  row.querySelector('select').value=modifier?.skillId ?? '';
  updateItemModifierTargets(row,modifier);
}
function updateItemModifierTargets(row, modifier=null) {
  const targets=getItemSkillTargets(getSkillById(row.querySelector('.item-modifier-skill').value));
  row.modifierTargets=targets;
  const select=row.querySelector('.item-modifier-target');
  select.innerHTML='<option value="">보조 항목 선택</option>'+targets.map((target,i)=>`<option value="${i}">${escapeHtml(target.label)}</option>`).join('');
  if (modifier) {
    const index=targets.findIndex(t=>t.target===modifier.target && t.signature===modifier.signature);
    if(index>=0) select.value=String(index);
    else {select.add(new Option('대상 변경됨 · 다시 선택하거나 삭제하세요','stale'));select.value='stale';}
  }
}
function readItemModifiers() {
  const statModifiers=normalizeItemStatModifiers(Object.fromEntries([...document.querySelectorAll('#itemStatModifiers input')].map(input=>[input.dataset.statKey,Number(input.value)])));
  const skillModifiers=[...document.querySelectorAll('.item-skill-modifier')].map(row=>{
    const skillId=row.querySelector('.item-modifier-skill').value;
    const selection=row.querySelector('.item-modifier-target').value;
    const target=selection!=='' ? row.modifierTargets[Number(selection)] : null;
    const value=Number(row.querySelector('.item-modifier-value').value);
    if(!skillId || !target || !Number.isFinite(value) || !value) throw new Error('스킬 보조의 스킬·대상·0이 아닌 보정값을 확인하세요.');
    return {skillId,target:target.target,signature:target.signature,value};
  });
  return {...(Object.keys(statModifiers).length ? {statModifiers} : {}),...(skillModifiers.length ? {skillModifiers} : {})};
}

function changeItemSlotFilter(slotKey) {
  selectedItemSlotFilter = slotKey;
  renderItemPage();
}

function openItemModal(index = "") {
  if (itemMutationPending) return;
  const item = itemsJson[index];
  itemModalTitleEl.innerText = item ? "아이템 수정" : "아이템 추가";
  itemEditIndexEl.value = item ? index : "";
  itemNameEl.value = item?.name ?? "";
  itemSlotEl.value = item?.slot ?? EQUIPMENT_SLOTS[0].key;
  renderCategoryOptions();
  itemWeaponCategoryEl.value = item?.weaponCategory || getWeaponCategories()[0]?.key || "";
  if (itemAttackSkillEl) {
    itemAttackSkillEl.innerHTML = getSkillOptionsHtml(item?.attackSkillId ?? "");
    itemAttackSkillEl.value = item?.attackSkillId ?? "";
  }
  itemArmorCategoryEl.value = item?.armorCategory || getArmorCategories()[0]?.key || "";
  itemHpEl.value = item?.hp ?? 0;
  itemMpEl.value = item?.mp ?? 0;
  itemStEl.value = item?.st ?? 0;
  itemAtkEl.value = item?.atk ?? 0;
  itemMagicEl.value = item?.magic ?? 0;
  itemSpeedEl.value = item?.speed ?? 0;
  itemAttackSpeedEl.value = item?.attackSpeed ?? 0;
  itemCastSpeedEl.value = item?.castSpeed ?? 0;
  itemDefenseEl.value = item?.defense ?? 0;
  itemResistanceEl.value = item?.resistance ?? 0;
  itemAttackRangeEl.value = item?.attackRange ?? 0;
  syncItemWeaponFields();
  renderItemModifiers(item);
  document.getElementById("itemDeleteButton").classList.toggle("hidden", !item);
  itemModalEl.classList.remove("hidden");
}

function closeItemModal() {
  if (itemMutationPending) return;
  itemModalEl.classList.add("hidden");
  itemFormEl.reset();
}


// Equipment page and character selection rendering.
function renderAbilityTable(baseCharacter, equippedCharacter) {
  return `
    <table class="stat-ability-table">
      <thead>
        <tr>
          <th>능력치</th>
          <th>기본</th>
          <th>장비 적용</th>
          <th>변화</th>
        </tr>
      </thead>
      <tbody>
        ${ABILITY_ROWS.map(([label, key]) => `
          <tr>
            <th>${label}</th>
            <td>${baseCharacter[key]}</td>
            <td>${equippedCharacter[key]}</td>
            <td>${formatAbilityDelta(baseCharacter[key], equippedCharacter[key])}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderEquipmentPage() {
  endEquipmentDrag();
  if (!characterJson.length) {
    selectedEquipmentCharacterIndex = "";
  } else if (selectedEquipmentCharacterIndex === "" || !characterJson[selectedEquipmentCharacterIndex]) {
    selectedEquipmentCharacterIndex = 0;
  }

  renderEquipmentCharacterButtons();
  renderEquipmentSetControls();
  renderEquipmentSlots();
  initEquipmentFilters();
  renderEquipmentItemTable();
  renderEquipmentAbilityPreview();
}

function renderEquipmentCharacterButtons() {
  equipmentCharacterButtonsEl.innerHTML = characterJson.map((character, index) => `
    <button
      type="button"
      class="stat-character-button ${Number(selectedEquipmentCharacterIndex) === index ? "selected" : ""}"
      onclick="selectEquipmentCharacter(${index})"
    >
      ${escapeHtml(character.name)}
    </button>
  `).join("");
}

let selectedInventoryItemId = "";
let equipmentDragState = null;

function equipmentItemIcon(item, slotKey = "") {
  const group = item?.weaponCategory ? "weapon" : item?.armorCategory ? "armor" : "slot";
  const key = item?.weaponCategory || item?.armorCategory || item?.slot || slotKey;
  const label = group === "weapon" ? getWeaponCategoryLabel(key) : group === "armor" ? getArmorCategoryLabel(key) : getSlotLabel(key);
  return `<span class="equipment-icon">${renderCategoryIcon(group, key, label)}</span>`;
}

// Match the existing equipment bonus policy: a two-handed item is counted once.

// Equipment slots and set control rendering.
function renderEquipmentSlots() {
  const character = characterJson[selectedEquipmentCharacterIndex];
  if (!character) {
    equipmentSlotGridEl.innerHTML = `<div class="empty-text">캐릭터를 선택하세요.</div>`;
    return;
  }

  const equipment = createEquipmentSlots(character.equipment, character);
  const rules = normalizeEquipmentRules(character.equipmentRules);
  equipmentSlotGridEl.innerHTML = `<div class="equipment-rule-summary">추가 무기 ${rules.extraWeaponSlots}칸 · 양손 무기 ${rules.twoHandSingleSlot ? "단일 슬롯" : "두 슬롯 점유"} · 집중 감산 ${rules.sameTargetWeaponPenaltyPercent}%</div>` + getCharacterEquipmentSlots(character).map(slot => {
    const item = getItemById(equipment[slot.key]);
    return `
      <div class="equipment-slot ${item ? "occupied" : ""}" data-slot="${slot.key}" ondragover="allowEquipmentDrop(event)" ondragleave="this.classList.remove('drop-hover')" ondrop="dropEquipmentItem(event, '${slot.key}')">
        <div class="equipment-slot-title">${renderCategoryIcon("slot", slot.key, slot.label)}</div>
        <button type="button" class="equipment-slot-target" aria-label="${escapeHtml(slot.label)}: ${escapeHtml(item?.name || '비어 있음')}" onclick="equipSelectedInventoryItem('${slot.key}')" ${item ? `draggable="true" data-item-id="${escapeHtml(item.id)}" ondragstart="dragEquipmentItem(event, this.dataset.itemId, '${slot.key}')" ondragend="endEquipmentDrag()"` : ""}>
          ${equipmentItemIcon(item, slot.key)}
        </button>
        <div class="equipment-slot-item ${item ? "" : "empty"}">
          ${item ? escapeHtml(item.name) : "비어 있음"}
        </div>
        <button type="button" class="equipment-unequip" aria-label="${escapeHtml(slot.label)} 해제" onclick="unequipItem('${slot.key}')" ${item ? "" : "disabled"}>해제</button>
      </div>
    `;
  }).join("");
}

function renderEquipmentSetControls() {
  const character = characterJson[selectedEquipmentCharacterIndex];
  if (!character) {
    equipmentSetControlsEl.innerHTML = "";
    return;
  }
  const normalized = normalizeCharacterEquipmentSets(character);
  character.equipmentSets = normalized.equipmentSets;
  character.activeEquipmentSet = normalized.activeEquipmentSet;
  equipmentSetControlsEl.innerHTML = `<label>장비 세트 <select aria-label="장비 세트" onchange="activateEquipmentSet(this.value)">${normalized.equipmentSets.map((set, index) => `<option value="${index}" ${index === normalized.activeEquipmentSet ? "selected" : ""}>${escapeHtml(set.name)}</option>`).join("")}</select></label><button type="button" onclick="copyActiveEquipmentSet()" ${normalized.equipmentSets.length >= 3 ? "disabled" : ""}>복제</button><button type="button" onclick="deleteActiveEquipmentSet()" ${normalized.equipmentSets.length <= 1 ? "disabled" : ""}>삭제</button>`;
}


// Equipment inventory list and detail rendering.
function renderEquipmentItemTable() {
  const query = document.getElementById("equipmentItemSearch").value.trim().toLocaleLowerCase();
  const filteredItems = getFilteredItems(selectedEquipmentItemSlotFilter).filter(({item}) => item.name.toLocaleLowerCase().includes(query));
  document.getElementById("equipmentItemCount").textContent = `${filteredItems.length}개`;
  equipmentItemTableBodyEl.innerHTML = filteredItems.map(({ item }) => `
    <button type="button" class="inventory-item ${selectedInventoryItemId === item.id ? 'selected' : ''}" draggable="true" data-item-id="${escapeHtml(item.id)}"
      aria-pressed="${selectedInventoryItemId === item.id}" title="${escapeHtml(item.name + '\n' + getSlotLabel(item.slot) + '\n' + getItemStatSummary(item))}"
      onclick="selectInventoryItem(this.dataset.itemId)" ondragstart="dragEquipmentItem(event, this.dataset.itemId)" ondragend="endEquipmentDrag()">
      ${equipmentItemIcon(item)}<span class="inventory-item-name">${escapeHtml(item.name)}</span>
    </button>
  `).join("") || `<p class="empty-text">조건에 맞는 아이템이 없습니다.</p>`;
  renderInventoryItemDetail();
}

function selectInventoryItem(itemId) {
  selectedInventoryItemId = itemId;
  equipmentItemTableBodyEl.querySelectorAll('[data-item-id]').forEach(el => {
    el.classList.toggle('selected', el.dataset.itemId === itemId);
    el.setAttribute('aria-pressed', String(el.dataset.itemId === itemId));
  });
  renderInventoryItemDetail();
}

function renderInventoryItemDetail() {
  const item = getItemById(selectedInventoryItemId);
  const detail = document.getElementById('equipmentItemDetail');
  if (!item) { detail.textContent = '아이템을 선택하면 상세정보를 확인할 수 있습니다.'; return; }
  const character = characterJson[selectedEquipmentCharacterIndex];
  const slots = character ? getCharacterEquipmentSlots(character).filter(slot => canEquipItemToSlot(item, slot.key, character)).map(slot => slot.label) : [];
  detail.innerHTML = `<strong>${escapeHtml(item.name)}</strong><div>${escapeHtml(getSlotLabel(item.slot))} · ${escapeHtml(item.weaponCategory ? getWeaponCategoryLabel(item.weaponCategory) : item.armorCategory ? getArmorCategoryLabel(item.armorCategory) : '')}</div><pre>${escapeHtml(getItemStatSummary(item))}</pre><div>장착 가능: ${escapeHtml(slots.join(', ') || '캐릭터를 선택하세요')}</div>`;
  detail.insertAdjacentHTML('beforeend',renderWeaponDpsPreview(character,item));
}


// Equipment ability preview and selected character UI.
function renderEquipmentAbilityPreview() {
  const character = characterJson[selectedEquipmentCharacterIndex];
  const combatPowerEl = document.getElementById('equipmentCombatPower');
  if (!character) {
    equipmentAbilityPreviewEl.innerHTML = "";
    combatPowerEl.innerHTML = "";
    return;
  }

  combatPowerEl.innerHTML = renderCombatPowerComparison(
    getCharacterCombatPower({...character, equipment: {}}),
    getCharacterCombatPower(character), ['무장비', '현재']
  );
  equipmentAbilityPreviewEl.innerHTML = renderAbilityTable(
    getCharacterBaseWithoutEquipment(character),
    applyCharacterStatAbilities(character)
  );
  equipmentAbilityPreviewEl.querySelectorAll('tbody tr').forEach(row => {
    const delta = row.lastElementChild;
    delta.classList.toggle('equipment-delta', delta.textContent.trim() !== '-');
  });
}

function selectEquipmentCharacter(index) {
  selectedEquipmentCharacterIndex = index;
  renderEquipmentPage();
}


// Drag-and-drop presentation handlers. Equipment mutations stay in equipment.js.
function dragEquipmentItem(event, itemId, sourceSlot = "") {
  endEquipmentDrag();
  const item = getItemById(itemId);
  if (!item) { event.preventDefault(); return; }
  selectInventoryItem(itemId);
  const preview = event.currentTarget.querySelector('.equipment-icon').cloneNode(true);
  preview.classList.add('equipment-drag-preview');
  preview.querySelectorAll('img').forEach(img => img.removeAttribute('data-icon-background'));
  document.body.appendChild(preview);
  equipmentDragState = {itemId, sourceSlot, source: event.currentTarget, preview};
  event.dataTransfer.setData("text/plain", itemId);
  event.dataTransfer.effectAllowed = 'copyMove';
  event.dataTransfer.setDragImage(preview, 34, 34);
  event.currentTarget.classList.add('is-dragging');
  const character = characterJson[selectedEquipmentCharacterIndex];
  equipmentSlotGridEl.querySelectorAll('[data-slot]').forEach(el => {
    const allowed = !!character && canEquipItemToSlot(item, el.dataset.slot, character);
    el.classList.toggle('drop-allowed', allowed);
    el.classList.toggle('drop-blocked', !allowed);
  });
}

function allowEquipmentDrop(event) {
  if (!equipmentDragState) return;
  event.preventDefault();
  const allowed = event.currentTarget.classList.contains('drop-allowed');
  event.dataTransfer.dropEffect = allowed ? 'copy' : 'none';
  event.currentTarget.classList.toggle('drop-hover', allowed);
}

function endEquipmentDrag() {
  equipmentDragState?.preview.remove();
  equipmentDragState?.source.classList.remove('is-dragging');
  equipmentDragState = null;
  equipmentSlotGridEl.querySelectorAll('[data-slot]').forEach(el => el.classList.remove('drop-allowed', 'drop-blocked', 'drop-hover'));
  document.querySelector('.equipment-inventory')?.classList.remove('drop-hover');
}

function allowInventoryReturn(event) {
  if (!equipmentDragState?.sourceSlot) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  event.currentTarget.classList.add('drop-hover');
}

function returnEquipmentItem(event) {
  if (!equipmentDragState?.sourceSlot) return;
  event.preventDefault();
  const slot = equipmentDragState.sourceSlot;
  endEquipmentDrag();
  return unequipItem(slot);
}

function changeEquipmentItemSlotFilter(slotKey) {
  selectedEquipmentItemSlotFilter = slotKey;
  renderEquipmentItemTable();
}

async 