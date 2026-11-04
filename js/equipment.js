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

function equipSelectedInventoryItem(slotKey) {
  if (!selectedInventoryItemId) return;
  return dropEquipmentItem({preventDefault() {}, dataTransfer: {getData: () => selectedInventoryItemId}}, slotKey);
}

function dropEquipmentItem(event, slotKey) {
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
