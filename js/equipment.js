const ITEM_STORAGE_KEY = "squad-auto-battle-items";

function createEquipmentSlots(source = {}) {
  return EQUIPMENT_SLOTS.reduce((equipment, slot) => {
    equipment[slot.key] = typeof source?.[slot.key] === "string" ? source[slot.key] : "";
    return equipment;
  }, {});
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
    attackSpeed: category.attackSpeed
  };
}

function normalizeItemJson(items) {
  const defaults = createDefaultItemJson();
  if (!Array.isArray(items) || items.length === 0) {
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
      armorCategory: String(item.armorCategory ?? getDefaultArmorCategory(item)),
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
          armorCategory: getArmorCategories().some(category => category.key === item.armorCategory) ? item.armorCategory : getArmorCategories()[0]?.key
        };
      }

      return {
        ...item,
        armorCategory: "",
        weaponCategory: "",
        handType: ""
      };
    })
    .filter(item => !isWeaponItem(item) || item.weaponCategory);

  return normalized.length ? normalized : defaults;
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
  localStorage.setItem(ITEM_STORAGE_KEY, JSON.stringify(itemsJson));

  try {
    await saveJsonFile("items", itemsJson);
    log("아이템 데이터가 API와 브라우저 저장소에 저장되었습니다.", "item");
  } catch (error) {
    logError("item", "아이템 API 저장에 실패해 브라우저 저장소에만 저장했습니다.", error);
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

function normalizeItemFormActions() {
  if (!itemFormEl || itemFormEl.dataset.actionsNormalized === "true") {
    return;
  }

  itemFormEl.querySelectorAll("button").forEach(button => button.remove());

  const saveButton = document.createElement("button");
  saveButton.type = "submit";
  saveButton.textContent = "저장";

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.textContent = "취소";
  cancelButton.onclick = closeItemModal;

  itemFormEl.appendChild(saveButton);
  itemFormEl.appendChild(cancelButton);
  itemFormEl.dataset.actionsNormalized = "true";
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
    itemAttackRangeEl.disabled = true;
    itemAttackSpeedEl.disabled = true;
  } else {
    itemHandTypeEl.value = "";
    itemWeaponSlotTypeEl.value = "";
    itemAttackRangeEl.disabled = false;
    itemAttackSpeedEl.disabled = false;
  }
}

function getItemById(itemId) {
  return itemsJson.find(item => item.id === itemId);
}

function getCharacterEquipmentBonus(character) {
  const equipment = createEquipmentSlots(character?.equipment);
  const countedTwoHandIds = new Set();

  return EQUIPMENT_SLOTS.reduce((bonus, slot) => {
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
      bonus[key] += Number(item[key]) || 0;
    });
    return bonus;
  }, createEmptyItemStats());
}

function getCharacterBaseWithoutEquipment(character) {
  return applyCharacterStatAbilities({
    ...character,
    equipment: createEquipmentSlots()
  });
}

function formatSignedValue(value) {
  const number = Number(value) || 0;
  return number > 0 ? `+${number}` : String(number);
}

function getItemStatSummary(item) {
  const weaponSummary = isWeaponItem(item)
    ? [`무기 카테고리 ${getWeaponCategoryLabel(item.weaponCategory)}`, `착용 방식 ${getHandTypeLabel(item.handType)}`, `착용 가능 슬롯 ${getWeaponSlotTypeLabel(getWeaponCategory(item.weaponCategory)?.slotType)}`]
    : [];
  const armorSummary = isArmorSlot(item.slot)
    ? [`방어구 카테고리 ${getArmorCategoryLabel(item.armorCategory)}`]
    : [];
  const statSummary = ABILITY_ROWS
    .map(([label, key]) => Number(item[key]) ? `${label} ${formatSignedValue(item[key])}` : "")
    .filter(Boolean);

  return [...weaponSummary, ...armorSummary, ...statSummary].join("\n") || "능력치 없음";
}

function getFilteredItems(slotFilter) {
  return itemsJson
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => {
      if (slotFilter === "all") {
        return true;
      }

      if (isWeaponSlot(slotFilter)) {
        return isWeaponItem(item) && canEquipItemToSlot(item, slotFilter);
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
  if (!characterJson.length) {
    selectedEquipmentCharacterIndex = "";
  } else if (selectedEquipmentCharacterIndex === "" || !characterJson[selectedEquipmentCharacterIndex]) {
    selectedEquipmentCharacterIndex = 0;
  }

  renderEquipmentCharacterButtons();
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

function renderEquipmentSlots() {
  const character = characterJson[selectedEquipmentCharacterIndex];
  if (!character) {
    equipmentSlotGridEl.innerHTML = `<div class="empty-text">캐릭터를 선택하세요.</div>`;
    return;
  }

  const equipment = createEquipmentSlots(character.equipment);
  equipmentSlotGridEl.innerHTML = EQUIPMENT_SLOTS.map(slot => {
    const item = getItemById(equipment[slot.key]);
    return `
      <div class="equipment-slot" ondragover="allowEquipmentDrop(event)" ondrop="dropEquipmentItem(event, '${slot.key}')">
        <div class="equipment-slot-title">${slot.label}</div>
        <div class="equipment-slot-item ${item ? "" : "empty"}">
          ${item ? escapeHtml(item.name) : "비어 있음"}
        </div>
        <button type="button" onclick="unequipItem('${slot.key}')" ${item ? "" : "disabled"}>해제</button>
      </div>
    `;
  }).join("");
}

function canEquipItemToSlot(item, slotKey) {
  if (!item) {
    return false;
  }

  if (isWeaponItem(item)) {
    const category = getWeaponCategory(item.weaponCategory);
    if (!isWeaponSlot(slotKey) || !category) {
      return false;
    }

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

function clearTwoHandWeaponIfNeeded(equipment, slotKey) {
  if (!isWeaponSlot(slotKey)) {
    return;
  }

  const currentItem = getItemById(equipment[slotKey]);
  if (isWeaponItem(currentItem) && currentItem.handType === "twoHand") {
    WEAPON_SLOT_KEYS.forEach(weaponSlot => {
      if (equipment[weaponSlot] === currentItem.id) {
        equipment[weaponSlot] = "";
      }
    });
  }
}

function equipItemToSlot(equipment, item, slotKey) {
  if (isWeaponItem(item)) {
    WEAPON_SLOT_KEYS.forEach(weaponSlot => clearTwoHandWeaponIfNeeded(equipment, weaponSlot));

    if (getWeaponCategory(item.weaponCategory)?.handType === "twoHand") {
      WEAPON_SLOT_KEYS.forEach(weaponSlot => {
        equipment[weaponSlot] = item.id;
      });
      return;
    }
  }

  equipment[slotKey] = item.id;
}

function renderEquipmentItemTable() {
  const filteredItems = getFilteredItems(selectedEquipmentItemSlotFilter);
  equipmentItemTableBodyEl.innerHTML = filteredItems.map(({ item }) => `
    <tr draggable="true" ondragstart="dragEquipmentItem(event, '${item.id}')">
      <td>
        <div class="equipment-list-item" tabindex="0">
          ${escapeHtml(item.name)}
          <div class="equipment-tooltip">
            <div class="equipment-tooltip-title">${escapeHtml(item.name)}</div>
            <div>${getSlotLabel(item.slot)}</div>
            <pre>${escapeHtml(getItemStatSummary(item))}</pre>
          </div>
        </div>
      </td>
    </tr>
  `).join("");
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
}

function selectEquipmentCharacter(index) {
  selectedEquipmentCharacterIndex = index;
  renderEquipmentPage();
}

function dragEquipmentItem(event, itemId) {
  event.dataTransfer.setData("text/plain", itemId);
}

function allowEquipmentDrop(event) {
  event.preventDefault();
}

function changeEquipmentItemSlotFilter(slotKey) {
  selectedEquipmentItemSlotFilter = slotKey;
  renderEquipmentItemTable();
}

async function dropEquipmentItem(event, slotKey) {
  event.preventDefault();
  const character = characterJson[selectedEquipmentCharacterIndex];
  const item = getItemById(event.dataTransfer.getData("text/plain"));
  if (!character || !canEquipItemToSlot(item, slotKey)) {
    alert("해당 슬롯에 착용할 수 없는 장비입니다.");
    return;
  }

  character.equipment = createEquipmentSlots(character.equipment);
  equipItemToSlot(character.equipment, item, slotKey);
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

  character.equipment = createEquipmentSlots(character.equipment);
  const currentItem = getItemById(character.equipment[slotKey]);
  if (isWeaponItem(currentItem) && currentItem.handType === "twoHand") {
    WEAPON_SLOT_KEYS.forEach(weaponSlot => {
      if (character.equipment[weaponSlot] === currentItem.id) {
        character.equipment[weaponSlot] = "";
      }
    });
  } else {
    character.equipment[slotKey] = "";
  }
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

function renderItemPage() {
  if (!itemTableBodyEl) {
    return;
  }

  initEquipmentFilters();
  const filteredItems = getFilteredItems(selectedItemSlotFilter);
  itemTableBodyEl.innerHTML = filteredItems.map(({ item, index }) => `
    <tr>
      <td><input type="checkbox" class="item-check" value="${index}"></td>
      <td>${escapeHtml(item.name)}</td>
      <td>${getSlotLabel(item.slot)}</td>
      <td>${isWeaponItem(item) ? getWeaponCategoryLabel(item.weaponCategory) : "-"}</td>
      <td>${isArmorSlot(item.slot) ? getArmorCategoryLabel(item.armorCategory) : "-"}</td>
      <td>${isWeaponItem(item) ? getHandTypeLabel(item.handType) : "-"}</td>
      ${ABILITY_ROWS.map(([, key]) => `<td>${item[key]}</td>`).join("")}
      <td><button type="button" onclick="openItemModal(${index})">수정</button></td>
    </tr>
  `).join("");
}

function changeItemSlotFilter(slotKey) {
  selectedItemSlotFilter = slotKey;
  renderItemPage();
}

function openItemModal(index = "") {
  normalizeItemFormActions();
  const item = itemsJson[index];
  itemModalTitleEl.innerText = item ? "아이템 수정" : "아이템 추가";
  itemEditIndexEl.value = item ? index : "";
  itemNameEl.value = item?.name ?? "";
  itemSlotEl.value = item?.slot ?? EQUIPMENT_SLOTS[0].key;
  renderCategoryOptions();
  itemWeaponCategoryEl.value = item?.weaponCategory || getWeaponCategories()[0]?.key || "";
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
  itemModalEl.classList.remove("hidden");
}

function closeItemModal() {
  itemModalEl.classList.add("hidden");
  itemFormEl.reset();
}

async function saveItemFromForm(event) {
  event.preventDefault();
  const editIndex = itemEditIndexEl.value;
  const isWeapon = isWeaponSlot(itemSlotEl.value);
  const weaponCategory = isWeapon ? getWeaponCategory(itemWeaponCategoryEl.value) : null;
  const item = {
    id: editIndex !== "" ? itemsJson[Number(editIndex)].id : `item_${Date.now()}`,
    name: itemNameEl.value.trim(),
    slot: itemSlotEl.value,
    weaponCategory: isWeapon ? weaponCategory?.key ?? "" : "",
    handType: isWeapon ? weaponCategory?.handType ?? "" : "",
    armorCategory: isArmorSlot(itemSlotEl.value) ? itemArmorCategoryEl.value : "",
    hp: Number(itemHpEl.value),
    mp: Number(itemMpEl.value),
    st: Number(itemStEl.value),
    atk: Number(itemAtkEl.value),
    magic: Number(itemMagicEl.value),
    speed: Number(itemSpeedEl.value),
    attackSpeed: isWeapon ? Number(weaponCategory?.attackSpeed ?? 0) : Number(itemAttackSpeedEl.value),
    castSpeed: Number(itemCastSpeedEl.value),
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

  try {
    await saveItemJson();
  } catch (error) {
    logError("item", "아이템 저장 요청이 실패했습니다.", error);
    alert("아이템 데이터를 저장하지 못했습니다.");
    return;
  }

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

async function deleteSelectedItems() {
  const checkedIndexes = [...document.querySelectorAll(".item-check:checked")]
    .map(input => Number(input.value))
    .sort((a, b) => b - a);

  if (!checkedIndexes.length) {
    alert("삭제할 아이템을 선택하세요.");
    return;
  }

  const deletedIds = checkedIndexes.map(index => itemsJson[index]?.id).filter(Boolean);
  checkedIndexes.forEach(index => itemsJson.splice(index, 1));
  characterJson.forEach(character => {
    character.equipment = createEquipmentSlots(character.equipment);
    EQUIPMENT_SLOTS.forEach(slot => {
      if (deletedIds.includes(character.equipment[slot.key])) {
        character.equipment[slot.key] = "";
      }
    });
  });
  characterJson = characterJson.map(character => applyCharacterStatAbilities(character));

  try {
    await saveItemJson();
    await saveCharacterJson();
    renderItemPage();
    renderEquipmentPage();
    refreshCharacterUI();
  } catch (error) {
    logError("item", "아이템 삭제 처리 중 실패했습니다.", error);
    alert("아이템 데이터를 삭제하지 못했습니다.");
  }
}
