const ITEM_STORAGE_KEY = "squad-auto-battle-items";

function normalizeEquipmentRules(rules = {}) {
  return {
    extraWeaponSlots: Math.max(0, Math.min(5, Math.floor(Number(rules?.extraWeaponSlots) || 0))),
    twoHandSingleSlot: rules?.twoHandSingleSlot === true,
    sameTargetWeaponPenaltyPercent: Math.max(0, Math.min(100, Number(rules?.sameTargetWeaponPenaltyPercent) || 0))
  };
}

function getCharacterEquipmentSlots(character = {}) {
  const rules = normalizeEquipmentRules(character?.equipmentRules);
  return [
    ...EQUIPMENT_SLOTS,
    ...Array.from({ length: rules.extraWeaponSlots }, (_, index) => ({
      key: `extraWeapon${index + 1}`,
      label: `추가 무기 ${index + 1}`,
      weaponOnly: true
    }))
  ];
}

function createEquipmentSlots(source = {}, character = {}) {
  return getCharacterEquipmentSlots(character).reduce((equipment, slot) => {
    equipment[slot.key] = typeof source?.[slot.key] === "string" ? source[slot.key] : "";
    return equipment;
  }, {});
}

function normalizeEquipmentSets(character = {}) {
  const rawSets = Array.isArray(character.equipmentSets) && character.equipmentSets.length
    ? character.equipmentSets.slice(0, 3)
    : [{ name: "세트 1", equipment: character.equipment }];
  return rawSets.map((set, index) => ({
    name: String(set?.name ?? `세트 ${index + 1}`).trim() || `세트 ${index + 1}`,
    equipment: createEquipmentSlots(set?.equipment, character)
  }));
}

function normalizeCharacterEquipmentSets(character = {}) {
  const equipmentSets = normalizeEquipmentSets(character);
  const activeEquipmentSet = Math.max(0, Math.min(equipmentSets.length - 1, Math.floor(Number(character.activeEquipmentSet) || 0)));
  return {
    ...character,
    equipmentSets,
    activeEquipmentSet,
    equipment: createEquipmentSlots(equipmentSets[activeEquipmentSet].equipment, character)
  };
}

function syncActiveEquipmentSet(character) {
  const normalized = normalizeCharacterEquipmentSets(character);
  normalized.equipmentSets[normalized.activeEquipmentSet].equipment = createEquipmentSlots(character.equipment, normalized);
  character.equipmentSets = normalized.equipmentSets;
  character.activeEquipmentSet = normalized.activeEquipmentSet;
  character.equipment = createEquipmentSlots(normalized.equipmentSets[normalized.activeEquipmentSet].equipment, normalized);
  return character;
}

function isCharacterWeaponSlot(character, slotKey) {
  return isWeaponSlot(slotKey) || getCharacterEquipmentSlots(character).some(slot => slot.key === slotKey && slot.weaponOnly);
}

function createEmptyItemStats() {
  return ABILITY_ROWS.reduce((stats, [, key]) => {
    stats[key] = 0;
    return stats;
  }, {});
}

function createDefaultItemJson() {
  return [
    { id: "main_weapon_sample1", name: "주무기 샘플1", slot: "mainWeapon", weaponCategory: "oneHandSword", handType: "oneHand", ...createEmptyItemStats(), atk: 18, attackSpeed: -0.1, attackRange: 1 },
    { id: "sub_weapon_sample1", name: "보조무기 샘플1", slot: "subWeapon", weaponCategory: "oneHandSword", handType: "oneHand", ...createEmptyItemStats(), mp: 20, atk: 6, magic: 6, castSpeed: -0.1, attackRange: 1 },
    { id: "top_sample1", name: "상의 샘플1", slot: "top", armorCategory: "plate", ...createEmptyItemStats(), hp: 350, defense: 8, resistance: 2 },
    { id: "bottom_sample1", name: "하의 샘플1", slot: "bottom", armorCategory: "leather", ...createEmptyItemStats(), hp: 180, st: 30, speed: 0.1, defense: 4, resistance: 1 },
    { id: "accessory_sample1", name: "장신구 샘플1", slot: "accessory", ...createEmptyItemStats(), mp: 40, st: 20, atk: 4, magic: 10, castSpeed: -0.2, resistance: 5 },
    { id: "special_sample1", name: "특수장비 샘플1", slot: "special", ...createEmptyItemStats(), hp: 100, mp: 10, st: 10, atk: 3, magic: 3, speed: 0.1, defense: 1, resistance: 1 }
  ];
}

function isWeaponSlot(slotKey) {
  return WEAPON_SLOT_KEYS.includes(slotKey);
}

function isWeaponItem(item) {
  return isWeaponSlot(item?.slot);
}

function getWeaponCategoryLabel(categoryKey) {
  return getWeaponCategories().find(category => category.key === categoryKey)?.label ?? "-";
}

function getArmorCategoryLabel(categoryKey) {
  return getArmorCategories().find(category => category.key === categoryKey)?.label ?? "-";
}

function getHandTypeLabel(handTypeKey) {
  return HAND_TYPES.find(type => type.key === handTypeKey)?.label ?? "-";
}

function getDefaultWeaponCategory(item) {
  return isWeaponItem(item) || ["주무기 샘플1", "보조무기 샘플1", "강검"].includes(item?.name)
    ? "oneHandSword"
    : "";
}

function getDefaultHandType(item) {
  if (!isWeaponItem(item) && !["주무기 샘플1", "보조무기 샘플1", "강검"].includes(item?.name)) {
    return "";
  }

  return getWeaponCategory(item?.weaponCategory ?? "oneHandSword")?.handType ?? "oneHand";
}

function getDefaultArmorCategory(item) {
  return isArmorSlot(item?.slot) ? getArmorCategories()[0]?.key ?? "" : "";
}

function applyWeaponCategoryStats(item) {
  const category = getWeaponCategory(item.weaponCategory);
  if (!category) {
    return item;
  }

  return {
    ...item,
    weaponCategory: category.key,
    handType: category.handType,
    attackRange: category.attackRange,
    attackSpeed: category.attackSpeed,
    castSpeed: category.castSpeed,
    attackType: category.attackType,
    attackSkillId: item.attackSkillId ?? ""
  };
}

function normalizeItemJson(items) {
  const defaults = createDefaultItemJson();
  if (!Array.isArray(items)) {
    return defaults;
  }

  const validSlots = EQUIPMENT_SLOTS.map(slot => slot.key);
  const normalized = items.map((item, index) => {
    const stats = createEmptyItemStats();
    ABILITY_ROWS.forEach(([, key]) => {
      const value = Number(item[key]);
      stats[key] = Number.isFinite(value) ? value : 0;
    });

    return {
      id: String(item.id ?? `item_${Date.now()}_${index}`),
      name: String(item.name ?? "").trim(),
      slot: String(item.slot ?? ""),
      weaponCategory: String(item.weaponCategory ?? getDefaultWeaponCategory(item)),
      handType: String(item.handType ?? getDefaultHandType(item)),
      attackType: String(item.attackType ?? ""),
      attackSkillId: String(item.attackSkillId ?? ""),
      armorCategory: String(item.armorCategory ?? getDefaultArmorCategory(item)),
      ...(Object.keys(normalizeItemStatModifiers(item.statModifiers)).length ? {statModifiers:normalizeItemStatModifiers(item.statModifiers)} : {}),
      ...(normalizeItemSkillModifiers(item.skillModifiers).length ? {skillModifiers:normalizeItemSkillModifiers(item.skillModifiers)} : {}),
      ...stats
    };
  }).filter(item => item.name && validSlots.includes(item.slot))
    .map(item => {
      if (isWeaponItem(item)) {
        return applyWeaponCategoryStats({
          ...item,
          weaponCategory: getWeaponCategories().some(category => category.key === item.weaponCategory) ? item.weaponCategory : getWeaponCategories()[0]?.key
        });
      }

      if (isArmorSlot(item.slot)) {
        return {
          ...item,
          weaponCategory: "",
          handType: "",
          attackType: "",
          attackSkillId: "",
          armorCategory: getArmorCategories().some(category => category.key === item.armorCategory) ? item.armorCategory : getArmorCategories()[0]?.key
        };
      }

      return {
        ...item,
        armorCategory: "",
        weaponCategory: "",
        handType: "",
        attackType: "",
        attackSkillId: ""
      };
    })
    .filter(item => !isWeaponItem(item) || item.weaponCategory);

  return normalized;
}

async function loadItemJson() {
  let rawJson = null;

  try {
    const response = await fetch(API_URLS.items, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    rawJson = await response.json();
    localStorage.setItem(ITEM_STORAGE_KEY, JSON.stringify(rawJson));
    log("아이템 데이터를 불러왔습니다.", "item");
  } catch (error) {
    logError("item", "아이템 API 데이터를 읽지 못했습니다. 브라우저 저장소를 확인합니다.", error);
  }

  if (!rawJson) {
    try {
      rawJson = JSON.parse(localStorage.getItem(ITEM_STORAGE_KEY) || "null");
      if (rawJson) {
        logWarn("item", "아이템 API 대신 브라우저 저장소 데이터를 사용합니다.");
      }
    } catch (error) {
      logError("item", "브라우저 저장소의 아이템 데이터를 읽지 못했습니다.", error);
      rawJson = null;
    }
  }

  itemsJson = normalizeItemJson(rawJson || createDefaultItemJson());
}

async function saveItemJson() {
  try {
    await saveJsonFile("items", itemsJson);
    localStorage.setItem(ITEM_STORAGE_KEY, JSON.stringify(itemsJson));
    log("아이템 데이터가 API와 브라우저 저장소에 저장되었습니다.", "item");
  } catch (error) {
    logError("item", "아이템 API 저장에 실패했습니다.", error);
    throw error;
  }
}

function getSlotLabel(slotKey) {
  return EQUIPMENT_SLOTS.find(slot => slot.key === slotKey)?.label ?? slotKey;
}

function getSlotOptionsHtml() {
  return `<option value="all">전체</option>${EQUIPMENT_SLOTS.map(slot => `<option value="${slot.key}">${slot.label}</option>`).join("")}`;
}

function initEquipmentFilters() {
  if (itemSlotFilterEl) {
    itemSlotFilterEl.innerHTML = getSlotOptionsHtml();
    itemSlotFilterEl.value = selectedItemSlotFilter;
  }

  if (equipmentItemSlotFilterEl) {
    equipmentItemSlotFilterEl.innerHTML = getSlotOptionsHtml();
    equipmentItemSlotFilterEl.value = selectedEquipmentItemSlotFilter;
  }
}

function syncItemWeaponFields() {
  const isWeapon = isWeaponSlot(itemSlotEl.value);
  const isArmor = isArmorSlot(itemSlotEl.value);
  const weaponCategory = getWeaponCategory(itemWeaponCategoryEl.value);
  document.querySelectorAll(".item-weapon-field").forEach(row => {
    row.classList.toggle("hidden", !isWeapon);
  });
  document.querySelectorAll(".item-armor-field").forEach(row => {
    row.classList.toggle("hidden", !isArmor);
  });
  if (isWeapon && weaponCategory) {
    itemHandTypeEl.value = getHandTypeLabel(weaponCategory.handType);
    itemWeaponSlotTypeEl.value = getWeaponSlotTypeLabel(weaponCategory.slotType);
    itemAttackRangeEl.value = weaponCategory.attackRange;
    itemAttackSpeedEl.value = weaponCategory.attackSpeed;
    itemCastSpeedEl.value = weaponCategory.castSpeed;
    itemAttackRangeEl.disabled = true;
    itemAttackSpeedEl.disabled = true;
    itemCastSpeedEl.disabled = true;
    if (itemAttackSkillEl) {
      itemAttackSkillEl.disabled = false;
    }
  } else {
    itemHandTypeEl.value = "";
    itemWeaponSlotTypeEl.value = "";
    itemAttackRangeEl.disabled = false;
    itemAttackSpeedEl.disabled = false;
    itemCastSpeedEl.disabled = false;
    if (itemAttackSkillEl) {
      itemAttackSkillEl.value = "";
      itemAttackSkillEl.disabled = true;
    }
  }
}

function getItemById(itemId) {
  return itemsJson.find(item => item.id === itemId);
}

function getCharacterEquipmentBonus(character) {
  const equipment = createEquipmentSlots(character?.equipment, character);
  const countedTwoHandIds = new Set();

  return getCharacterEquipmentSlots(character).reduce((bonus, slot) => {
    const item = getItemById(equipment[slot.key]);
    if (!item) {
      return bonus;
    }

    if (isWeaponItem(item) && item.handType === "twoHand") {
      if (countedTwoHandIds.has(item.id)) {
        return bonus;
      }
      countedTwoHandIds.add(item.id);
    }

    ABILITY_ROWS.forEach(([, key]) => {
      if (isWeaponItem(item) && (key === "attackSpeed" || key === "castSpeed")) {
        return;
      }
      bonus[key] += Number(item[key]) || 0;
    });
    return bonus;
  }, createEmptyItemStats());
}

function getCharacterBaseWithoutEquipment(character) {
  return applyCharacterStatAbilities({
    ...character,
    equipment: createEquipmentSlots({}, character)
  });
}

function formatSignedValue(value) {
  const number = Number(value) || 0;
  return number > 0 ? `+${number}` : String(number);
}

function getItemStatSummary(item) {
  const weaponSummary = isWeaponItem(item)
    ? [`무기 카테고리 ${getWeaponCategoryLabel(item.weaponCategory)}`, `착용 방식 ${getHandTypeLabel(item.handType)}`, `착용 가능 슬롯 ${getWeaponSlotTypeLabel(getWeaponCategory(item.weaponCategory)?.slotType)}`, `공격 타입 ${getWeaponAttackTypeLabel(getWeaponCategory(item.weaponCategory)?.attackType)}`, `작동스킬 ${getSkillById(item.attackSkillId)?.name ?? "기본 공격"}`]
    : [];
  const armorSummary = isArmorSlot(item.slot)
    ? [`방어구 카테고리 ${getArmorCategoryLabel(item.armorCategory)}`]
    : [];
  const statSummary = ABILITY_ROWS
    .map(([label, key]) => Number(item[key]) ? `${label} ${formatSignedValue(item[key])}` : "")
    .filter(Boolean);

  const modifierSummary = getItemExtraDetails({...item,...Object.fromEntries(ITEM_SECONDARY_STATS.map(([,key])=>[key,0]))});
  return [...weaponSummary, ...armorSummary, ...statSummary, ...modifierSummary].join("\n") || "능력치 없음";
}

function getFilteredItems(slotFilter) {
  const equipmentCharacter = characterJson?.[selectedEquipmentCharacterIndex] ?? null;
  return itemsJson
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => {
      if (slotFilter === "all") {
        return true;
      }

      if (isWeaponSlot(slotFilter)) {
        return isWeaponItem(item) && canEquipItemToSlot(item, slotFilter, equipmentCharacter);
      }

      return item.slot === slotFilter;
    });
}

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
function getCharacterModifierItems(character) {
  const seen = new Set();
  return getCharacterEquipmentSlots(character).flatMap(slot => {
    const item = getItemById(character?.equipment?.[slot.key]);
    if (!item) return [];
    if (isWeaponItem(item) && item.handType === "twoHand") {
      if (seen.has(item.id)) return [];
      seen.add(item.id);
    }
    return [item];
  });
}

function normalizeItemStatModifiers(source = {}) {
  return Object.fromEntries(CHARACTER_STAT_DEFS.flatMap(({key}) => {
    const value = Number(source?.[key]);
    return Number.isFinite(value) && value !== 0 ? [[key, value]] : [];
  }));
}

function getCharacterEffectiveAttributes(character) {
  const attributes = createCharacterAttributes(character.attributes);
  const items = getCharacterModifierItems(character);
  for (const {key} of CHARACTER_STAT_DEFS) {
    attributes[key] = Math.max(0, attributes[key] + (Number(character.runtimeSynergyModifiers?.[key]) || 0) + items.reduce((sum, item) => sum + (Number(item.statModifiers?.[key]) || 0), 0));
  }
  return attributes;
}

function getCharacterItemSkillModifiers(character) {
  return getCharacterModifierItems(character).flatMap(item => normalizeItemSkillModifiers(item.skillModifiers));
}

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

async function saveEquipmentSetChange(character) {
  characterJson[Number(selectedEquipmentCharacterIndex)] = applyCharacterStatAbilities(syncActiveEquipmentSet(character));
  await saveCharacterJson();
  playerSquad = [];
  refreshCharacterUI();
  renderEquipmentPage();
}

async function activateEquipmentSet(index) {
  const character = characterJson[selectedEquipmentCharacterIndex];
  if (!character) return;
  syncActiveEquipmentSet(character);
  const target = Math.max(0, Math.min(character.equipmentSets.length - 1, Number(index) || 0));
  character.activeEquipmentSet = target;
  character.equipment = createEquipmentSlots(character.equipmentSets[target].equipment, character);
  try {
    await saveEquipmentSetChange(character);
  } catch (error) {
    logError("equipment", "장비 세트 전환 저장 처리 중 실패했습니다.", error);
    alert("장비 세트를 전환하지 못했습니다.");
  }
}

async function copyActiveEquipmentSet() {
  const character = characterJson[selectedEquipmentCharacterIndex];
  if (!character) return;
  syncActiveEquipmentSet(character);
  if (character.equipmentSets.length >= 3) return;
  const source = character.equipmentSets[character.activeEquipmentSet];
  character.equipmentSets.push({name:`세트 ${character.equipmentSets.length + 1}`, equipment:createEquipmentSlots(source.equipment, character)});
  character.activeEquipmentSet = character.equipmentSets.length - 1;
  character.equipment = createEquipmentSlots(character.equipmentSets[character.activeEquipmentSet].equipment, character);
  try {
    await saveEquipmentSetChange(character);
  } catch (error) {
    logError("equipment", "장비 세트 복제 저장 처리 중 실패했습니다.", error);
    alert("장비 세트를 복제하지 못했습니다.");
  }
}

async function deleteActiveEquipmentSet() {
  const character = characterJson[selectedEquipmentCharacterIndex];
  if (!character) return;
  syncActiveEquipmentSet(character);
  if (character.equipmentSets.length <= 1) return;
  character.equipmentSets.splice(character.activeEquipmentSet, 1);
  character.activeEquipmentSet = Math.min(character.activeEquipmentSet, character.equipmentSets.length - 1);
  character.equipment = createEquipmentSlots(character.equipmentSets[character.activeEquipmentSet].equipment, character);
  try {
    await saveEquipmentSetChange(character);
  } catch (error) {
    logError("equipment", "장비 세트 삭제 저장 처리 중 실패했습니다.", error);
    alert("장비 세트를 삭제하지 못했습니다.");
  }
}

function canEquipItemToSlot(item, slotKey, character = null) {
  if (!item) {
    return false;
  }

  if (isWeaponItem(item)) {
    const category = getWeaponCategory(item.weaponCategory);
    if (!(character ? isCharacterWeaponSlot(character, slotKey) : isWeaponSlot(slotKey)) || !category) {
      return false;
    }

    const rules = normalizeEquipmentRules(character?.equipmentRules);
    if (slotKey.startsWith("extraWeapon")) return category.handType === "oneHand" || rules.twoHandSingleSlot;
    if (category.handType === "twoHand" && rules.twoHandSingleSlot) return true;

    if (category.slotType === "mainOnly") {
      return slotKey === "mainWeapon";
    }

    if (category.slotType === "subOnly") {
      return slotKey === "subWeapon";
    }

    return true;
  }

  return item.slot === slotKey;
}

function clearTwoHandWeaponIfNeeded(equipment, slotKey, character = null) {
  if (!(character ? isCharacterWeaponSlot(character, slotKey) : isWeaponSlot(slotKey))) {
    return;
  }

  const currentItem = getItemById(equipment[slotKey]);
  if (isWeaponItem(currentItem) && currentItem.handType === "twoHand") {
    if (normalizeEquipmentRules(character?.equipmentRules).twoHandSingleSlot) return;
    getCharacterEquipmentSlots(character ?? {}).filter(slot => isCharacterWeaponSlot(character ?? {}, slot.key)).forEach(({ key: weaponSlot }) => {
      if (equipment[weaponSlot] === currentItem.id) {
        equipment[weaponSlot] = "";
      }
    });
  }
}

function equipItemToSlot(equipment, item, slotKey, character = null) {
  if (isWeaponItem(item)) {
    const rules = normalizeEquipmentRules(character?.equipmentRules);
    if (isWeaponSlot(slotKey)) {
      WEAPON_SLOT_KEYS.forEach(key => clearTwoHandWeaponIfNeeded(equipment, key, character));
    }

    if (getWeaponCategory(item.weaponCategory)?.handType === "twoHand" && !rules.twoHandSingleSlot) {
      WEAPON_SLOT_KEYS.forEach(weaponSlot => {
        equipment[weaponSlot] = item.id;
      });
      return;
    }
  }

  equipment[slotKey] = item.id;
}

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
}

function equipSelectedInventoryItem(slotKey) {
  if (!selectedInventoryItemId) return;
  return dropEquipmentItem({preventDefault() {}, dataTransfer: {getData: () => selectedInventoryItemId}}, slotKey);
}

function renderEquipmentAbilityPreview() {
  const character = characterJson[selectedEquipmentCharacterIndex];
  if (!character) {
    equipmentAbilityPreviewEl.innerHTML = "";
    return;
  }

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

async function dropEquipmentItem(event, slotKey) {
  event.preventDefault();
  const character = characterJson[selectedEquipmentCharacterIndex];
  const item = getItemById(event.dataTransfer.getData("text/plain"));
  endEquipmentDrag();
  if (!character || !canEquipItemToSlot(item, slotKey, character)) {
    alert("해당 슬롯에 착용할 수 없는 장비입니다.");
    return;
  }

  character.equipment = createEquipmentSlots(character.equipment, character);
  equipItemToSlot(character.equipment, item, slotKey, character);
  syncActiveEquipmentSet(character);
  characterJson[Number(selectedEquipmentCharacterIndex)] = applyCharacterStatAbilities(character);
  try {
    await saveCharacterJson();
    playerSquad = [];
    refreshCharacterUI();
    renderEquipmentPage();
  } catch (error) {
    logError("equipment", "장비 착용 저장 처리 중 실패했습니다.", error);
    alert("장비 착용 정보를 저장하지 못했습니다.");
  }
}

async function unequipItem(slotKey) {
  const character = characterJson[selectedEquipmentCharacterIndex];
  if (!character) {
    return;
  }

  character.equipment = createEquipmentSlots(character.equipment, character);
  const currentItem = getItemById(character.equipment[slotKey]);
  if (isWeaponItem(currentItem) && currentItem.handType === "twoHand" && !normalizeEquipmentRules(character.equipmentRules).twoHandSingleSlot) {
    WEAPON_SLOT_KEYS.forEach(weaponSlot => {
      if (character.equipment[weaponSlot] === currentItem.id) {
        character.equipment[weaponSlot] = "";
      }
    });
  } else {
    character.equipment[slotKey] = "";
  }
  syncActiveEquipmentSet(character);
  characterJson[Number(selectedEquipmentCharacterIndex)] = applyCharacterStatAbilities(character);
  try {
    await saveCharacterJson();
    playerSquad = [];
    refreshCharacterUI();
    renderEquipmentPage();
  } catch (error) {
    logError("equipment", "장비 해제 저장 처리 중 실패했습니다.", error);
    alert("장비 해제 정보를 저장하지 못했습니다.");
  }
}

const ITEM_TABLE_COLUMNS = [['name','이름'],['handType','착용방식'],['atk','공격력'],['magic','마력'],['defense','방어력'],['resistance','저항력'],['attackRange','사정거리'],['skill','작동스킬'],['extra','부가 능력치']];
const ITEM_SECONDARY_STATS = [['HP','hp'],['MP','mp'],['ST','st'],['이동속도','speed'],['공격속도','attackSpeed'],['시전속도','castSpeed']];
let itemTableSort = {key:'', direction:1};
let itemMutationPending = false;
function getItemCategoryLabel(item) {
  return isWeaponItem(item) ? getWeaponCategoryLabel(item.weaponCategory) : isArmorSlot(item.slot) ? getArmorCategoryLabel(item.armorCategory) : getSlotLabel(item.slot);
}
function getItemExtraDetails(item) {
  return [...ITEM_SECONDARY_STATS.filter(([,key])=>Number(item[key])).map(([label,key])=>`${label} ${formatSignedValue(item[key])}`),
    ...CHARACTER_STAT_DEFS.filter(({key})=>Number(item.statModifiers?.[key])).map(({label,key})=>`${label} ${formatSignedValue(item.statModifiers[key])}`),
    ...normalizeItemSkillModifiers(item.skillModifiers).map(row=>{
      const skill=getSkillById(row.skillId);
      const target=getItemSkillTargets(skill).find(t=>t.target===row.target && t.signature===row.signature);
      return `${skill?.name ?? '삭제된 스킬'} · ${target?.label ?? '대상 변경됨 (미적용)'} ${formatSignedValue(row.value)}`;
    })];
}
function getItemSortValue(item,key) {
  if (['atk','magic','defense','resistance','attackRange'].includes(key)) return Number(item[key])||0;
  if (key==='category') return getItemCategoryLabel(item);
  if (key==='handType') return getHandTypeLabel(item.handType);
  if (key==='skill') return isWeaponItem(item) ? getSkillById(item.attackSkillId)?.name ?? '기본 공격' : '';
  if (key==='extra') return getItemExtraDetails(item).join(' · ');
  return item.name;
}
function sortItemTable(key) {
  if (!ITEM_TABLE_COLUMNS.some(([k])=>k===key)) return;
  itemTableSort={key,direction:itemTableSort.key===key ? -itemTableSort.direction : 1};
  renderItemPage();
}
function renderItemPage() {
  if (!itemTableBodyEl) return;
  initEquipmentFilters();
  const header=document.getElementById('itemTableHeader');
  if (!header.children.length) header.innerHTML=ITEM_TABLE_COLUMNS.map(([key,label])=>`<th scope="col" data-sort-key="${key}" onclick="sortItemTable('${key}')"><button type="button" class="item-sort-button">${label}<span aria-hidden="true"></span></button></th>`).join('')+'<th scope="col">수정</th>';
  header.querySelectorAll('[data-sort-key]').forEach(th=>{
    const active=th.dataset.sortKey===itemTableSort.key;
    th.setAttribute('aria-sort',active ? itemTableSort.direction===1 ? 'ascending' : 'descending' : 'none');
    th.querySelector('span').textContent=active ? itemTableSort.direction===1 ? ' ↑' : ' ↓' : '';
  });
  const items=getFilteredItems(selectedItemSlotFilter);
  if (itemTableSort.key) items.sort((a,b)=>{
    const x=getItemSortValue(a.item,itemTableSort.key), y=getItemSortValue(b.item,itemTableSort.key);
    return (typeof x==='number' ? x-y : x.localeCompare(y,'ko',{numeric:true}))*itemTableSort.direction || a.index-b.index;
  });
  itemTableBodyEl.innerHTML=items.map(({item,index})=>{
    const details=getItemExtraDetails(item);
    const skillCount=normalizeItemSkillModifiers(item.skillModifiers).length;
    const statDetails=details.slice(0,details.length-skillCount);
    const summary=[...statDetails.slice(0,2),...(statDetails.length>2 ? [`외 ${statDetails.length-2}`] : []),...(skillCount ? [`스킬 보조 ${skillCount}`] : [])].join(' · ');
    return `<tr data-item-index="${index}"><td><div class="item-identity">${equipmentItemIcon(item)}<strong>${escapeHtml(item.name)}</strong></div></td>
      <td>${isWeaponItem(item) ? item.handType==='twoHand' ? '양손' : '한손' : '-'}</td>
      ${['atk','magic','defense','resistance','attackRange'].map(key=>`<td class="item-number ${Number(item[key]) ? '' : 'item-zero'}">${Number(item[key])||'-'}</td>`).join('')}
      <td>${escapeHtml(getItemSortValue(item,'skill')||'-')}</td>
      <td>${details.length ? `<details class="item-extra"><summary>${escapeHtml(summary)}</summary><ul>${details.map(text=>`<li>${escapeHtml(text)}</li>`).join('')}</ul></details>` : '<span class="item-zero">-</span>'}</td>
      <td><button type="button" onclick="openItemModal(${index})">수정</button></td></tr>`;
  }).join('') || '<tr><td colspan="10">표시할 아이템이 없습니다.</td></tr>';
}

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

async function saveItemFromForm(event) {
  event.preventDefault();
  if (itemMutationPending) return;
  let modifiers;
  try { modifiers=readItemModifiers(); } catch(error) { alert(error.message);return; }
  const before=itemsJson.slice();
  const editIndex = itemEditIndexEl.value;
  const isWeapon = isWeaponSlot(itemSlotEl.value);
  const weaponCategory = isWeapon ? getWeaponCategory(itemWeaponCategoryEl.value) : null;
  const item = {
    ...modifiers,
    id: editIndex !== "" ? itemsJson[Number(editIndex)].id : `item_${Date.now()}`,
    name: itemNameEl.value.trim(),
    slot: itemSlotEl.value,
    weaponCategory: isWeapon ? weaponCategory?.key ?? "" : "",
    handType: isWeapon ? weaponCategory?.handType ?? "" : "",
    attackType: isWeapon ? weaponCategory?.attackType ?? BARE_HAND_ATTACK_TYPE : "",
    attackSkillId: isWeapon ? itemAttackSkillEl?.value ?? "" : "",
    armorCategory: isArmorSlot(itemSlotEl.value) ? itemArmorCategoryEl.value : "",
    hp: Number(itemHpEl.value),
    mp: Number(itemMpEl.value),
    st: Number(itemStEl.value),
    atk: Number(itemAtkEl.value),
    magic: Number(itemMagicEl.value),
    speed: Number(itemSpeedEl.value),
    attackSpeed: isWeapon ? Number(weaponCategory?.attackSpeed ?? 0) : Number(itemAttackSpeedEl.value),
    castSpeed: isWeapon ? Number(weaponCategory?.castSpeed ?? BARE_HAND_CAST_SPEED) : Number(itemCastSpeedEl.value),
    defense: Number(itemDefenseEl.value),
    resistance: Number(itemResistanceEl.value),
    attackRange: isWeapon ? Number(weaponCategory?.attackRange ?? 1) : Number(itemAttackRangeEl.value)
  };

  if (!item.name || !EQUIPMENT_SLOTS.some(slot => slot.key === item.slot) || (isWeapon && !item.weaponCategory)) {
    alert("아이템 정보를 올바르게 입력하세요.");
    return;
  }

  if (editIndex !== "") {
    itemsJson[Number(editIndex)] = item;
  } else {
    itemsJson.push(item);
  }

  itemMutationPending=true;
  try {
    await saveItemJson();
  } catch (error) {
    itemsJson=before;
    logError("item", "아이템 저장 요청이 실패했습니다.", error);
    alert("아이템 데이터를 저장하지 못했습니다.");
    return;
  } finally { itemMutationPending=false; }

  try {
    await loadCharacterJson();
    renderItemPage();
    if (!equipmentPageEl.classList.contains("hidden")) {
      renderEquipmentPage();
    }
    closeItemModal();
  } catch (error) {
    logError("item", "아이템 저장 후 화면 갱신 중 실패했습니다.", error);
    alert("아이템은 저장됐지만 화면 갱신 중 문제가 발생했습니다.");
  }
}

async function deleteItemFromModal() {
  if (itemMutationPending || itemEditIndexEl.value==='') return;
  const index=Number(itemEditIndexEl.value), item=itemsJson[index];
  if(!item) return;
  itemMutationPending=true;
  let rawCharacters;
  try {
  // Characters (all saved loadouts) are the only persistent item-ID owners.
  // Detach first: if item saving fails, the item remains and no reference dangles.
  const response=await fetch(API_URLS.characters,{cache:'no-store'});
  if(!response.ok) { alert('장착 참조를 확인하지 못했습니다. 다시 시도하세요.');return; }
  rawCharacters=await response.json();
  } catch(error) {
    logError('item','장착 참조 조회 실패',error);
    alert('장착 참조를 확인하지 못했습니다. 다시 시도하세요.');return;
  } finally { itemMutationPending=false; }
  const references=rawCharacters.filter(c=>Object.values(c.equipment ?? {}).includes(item.id) || (c.equipmentSets ?? []).some(set=>Object.values(set.equipment ?? {}).includes(item.id))).map(c=>c.name);
  if (!window.confirm(`"${item.name}" 아이템을 삭제하시겠습니까?`+(references.length ? `\n장착 중: ${references.join(', ')}\n모든 장비 세트에서 해제됩니다.` : ''))) return;
  const cleaned=structuredClone(rawCharacters);
  for (const character of cleaned) {
    for (const equipment of [character.equipment,...(character.equipmentSets ?? []).map(set=>set.equipment)]) {
      if(equipment) for (const key of Object.keys(equipment)) if(equipment[key]===item.id) equipment[key]='';
    }
  }
  itemMutationPending=true;
  const before=itemsJson.slice();
  try {
    if(references.length) await saveJsonFile('characters',cleaned);
    itemsJson.splice(index,1);
    await saveItemJson();
  } catch(error) {
    itemsJson=before;
    logError('item','아이템 삭제 저장 실패',error);
    alert('아이템을 삭제하지 못했습니다. 장비 해제가 먼저 저장됐을 수 있습니다. 장착 상태를 확인하고 다시 시도하세요.');
    return;
  } finally {
    itemMutationPending=false;
    await loadCharacterJson();
    renderItemPage();renderEquipmentPage();refreshCharacterUI();
  }
  closeItemModal();
}
