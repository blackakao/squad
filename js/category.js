function createDefaultCategoryRows() {
  return [
    ...DEFAULT_CATEGORIES.weapons.map(category => ({ type: "weapon", ...category })),
    ...DEFAULT_CATEGORIES.armors.map(category => ({ type: "armor", ...category }))
  ];
}

function cloneDefaultCategories() {
  return {
    weapons: DEFAULT_CATEGORIES.weapons.map(category => ({ ...category })),
    armors: DEFAULT_CATEGORIES.armors.map(category => ({ ...category }))
  };
}

function createCategoryKey(label, existingKeys) {
  const base = String(label ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "_")
    .replace(/^_+|_+$/g, "") || `category_${Date.now()}`;
  let key = base;
  let suffix = 2;

  while (existingKeys.includes(key)) {
    key = `${base}_${suffix}`;
    suffix += 1;
  }

  return key;
}

function normalizeWeaponCategory(category, index) {
  const fallback = DEFAULT_CATEGORIES.weapons[index] ?? DEFAULT_CATEGORIES.weapons[0];
  const handType = HAND_TYPES.some(type => type.key === category?.handType) ? category.handType : fallback.handType;
  const slotType = WEAPON_SLOT_TYPES.some(type => type.key === category?.slotType) ? category.slotType : fallback.slotType;
  const attackRange = Number(category?.attackRange);
  const attackSpeed = Number(category?.attackSpeed);

  return {
    key: String(category?.key ?? fallback.key ?? `weapon_${index}`).trim(),
    label: String(category?.label ?? fallback.label ?? "").trim(),
    handType,
    attackRange: Number.isFinite(attackRange) && attackRange >= 1 ? attackRange : fallback.attackRange,
    attackSpeed: Number.isFinite(attackSpeed) ? attackSpeed : fallback.attackSpeed ?? 0,
    slotType
  };
}

function normalizeArmorCategory(category, index) {
  const fallback = DEFAULT_CATEGORIES.armors[index] ?? DEFAULT_CATEGORIES.armors[0];

  return {
    key: String(category?.key ?? fallback.key ?? `armor_${index}`).trim(),
    label: String(category?.label ?? fallback.label ?? "").trim()
  };
}

function normalizeCategoryJson(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return cloneDefaultCategories();
  }

  const weapons = rows
    .filter(row => row?.type === "weapon")
    .map(normalizeWeaponCategory)
    .filter(category => category.key && category.label);
  const armors = rows
    .filter(row => row?.type === "armor")
    .map(normalizeArmorCategory)
    .filter(category => category.key && category.label);

  return {
    weapons: weapons.length ? weapons : cloneDefaultCategories().weapons,
    armors: armors.length ? armors : cloneDefaultCategories().armors
  };
}

function flattenCategoryJson() {
  return [
    ...categoriesJson.weapons.map(category => ({ type: "weapon", ...category })),
    ...categoriesJson.armors.map(category => ({ type: "armor", ...category }))
  ];
}

async function loadCategoryJson() {
  const rawJson = await loadJsonFile("categories", createDefaultCategoryRows());
  categoriesJson = normalizeCategoryJson(rawJson);
}

async function saveCategoryJson() {
  await saveJsonFile("categories", flattenCategoryJson());
  log("장비 카테고리 데이터가 저장되었습니다.", "category");
}

function getWeaponCategories() {
  return categoriesJson.weapons.length ? categoriesJson.weapons : DEFAULT_CATEGORIES.weapons;
}

function getArmorCategories() {
  return categoriesJson.armors.length ? categoriesJson.armors : DEFAULT_CATEGORIES.armors;
}

function getWeaponCategory(categoryKey) {
  return getWeaponCategories().find(category => category.key === categoryKey) ?? getWeaponCategories()[0];
}

function getArmorCategory(categoryKey) {
  return getArmorCategories().find(category => category.key === categoryKey) ?? getArmorCategories()[0];
}

function getWeaponSlotTypeLabel(slotTypeKey) {
  return WEAPON_SLOT_TYPES.find(type => type.key === slotTypeKey)?.label ?? "-";
}

function isArmorSlot(slotKey) {
  return ARMOR_SLOT_KEYS.includes(slotKey);
}

function renderCategoryOptions() {
  if (itemWeaponCategoryEl) {
    itemWeaponCategoryEl.innerHTML = getWeaponCategories()
      .map(category => `<option value="${category.key}">${escapeHtml(category.label)}</option>`)
      .join("");
  }

  if (itemArmorCategoryEl) {
    itemArmorCategoryEl.innerHTML = getArmorCategories()
      .map(category => `<option value="${category.key}">${escapeHtml(category.label)}</option>`)
      .join("");
  }

  if (weaponCategoryHandTypeEl) {
    weaponCategoryHandTypeEl.innerHTML = HAND_TYPES
      .map(type => `<option value="${type.key}">${type.label}</option>`)
      .join("");
  }

  if (weaponCategorySlotTypeEl) {
    weaponCategorySlotTypeEl.innerHTML = WEAPON_SLOT_TYPES
      .map(type => `<option value="${type.key}">${type.label}</option>`)
      .join("");
  }
}

function renderCategoryPage() {
  renderCategoryOptions();
  renderWeaponCategoryTable();
  renderArmorCategoryTable();
}

function renderWeaponCategoryTable() {
  weaponCategoryTableBodyEl.innerHTML = getWeaponCategories().map((category, index) => `
    <tr>
      <td><input type="checkbox" class="weapon-category-check" value="${index}"></td>
      <td>${escapeHtml(category.label)}</td>
      <td>${getHandTypeLabel(category.handType)}</td>
      <td>${category.attackRange}</td>
      <td>${category.attackSpeed}</td>
      <td>${getWeaponSlotTypeLabel(category.slotType)}</td>
      <td><button type="button" onclick="openWeaponCategoryModal(${index})">수정</button></td>
    </tr>
  `).join("");
}

function renderArmorCategoryTable() {
  armorCategoryTableBodyEl.innerHTML = getArmorCategories().map((category, index) => `
    <tr>
      <td><input type="checkbox" class="armor-category-check" value="${index}"></td>
      <td>${escapeHtml(category.label)}</td>
      <td><button type="button" onclick="openArmorCategoryModal(${index})">수정</button></td>
    </tr>
  `).join("");
}

function openWeaponCategoryModal(index = "") {
  renderCategoryOptions();
  const category = getWeaponCategories()[index];
  weaponCategoryModalTitleEl.innerText = category ? "무기 카테고리 수정" : "무기 카테고리 추가";
  weaponCategoryEditIndexEl.value = category ? index : "";
  weaponCategoryNameEl.value = category?.label ?? "";
  weaponCategoryHandTypeEl.value = category?.handType ?? "oneHand";
  weaponCategoryAttackRangeEl.value = category?.attackRange ?? 1;
  weaponCategoryAttackSpeedEl.value = category?.attackSpeed ?? 0;
  weaponCategorySlotTypeEl.value = category?.slotType ?? "both";
  weaponCategoryModalEl.classList.remove("hidden");
}

function closeWeaponCategoryModal() {
  weaponCategoryModalEl.classList.add("hidden");
  weaponCategoryFormEl.reset();
}

async function saveWeaponCategoryFromForm(event) {
  event.preventDefault();
  const editIndex = weaponCategoryEditIndexEl.value;
  const existingKeys = getWeaponCategories().map(category => category.key);
  const previous = editIndex !== "" ? categoriesJson.weapons[Number(editIndex)] : null;
  const category = {
    key: previous?.key ?? createCategoryKey(weaponCategoryNameEl.value, existingKeys),
    label: weaponCategoryNameEl.value.trim(),
    handType: weaponCategoryHandTypeEl.value,
    attackRange: Number(weaponCategoryAttackRangeEl.value),
    attackSpeed: Number(weaponCategoryAttackSpeedEl.value),
    slotType: weaponCategorySlotTypeEl.value
  };

  if (!category.label || !Number.isFinite(category.attackRange) || category.attackRange < 1 || !Number.isFinite(category.attackSpeed)) {
    alert("무기 카테고리 정보를 올바르게 입력하세요.");
    return;
  }

  if (editIndex !== "") {
    categoriesJson.weapons[Number(editIndex)] = category;
  } else {
    categoriesJson.weapons.push(category);
  }

  await saveCategoryJson();
  await loadItemJson();
  await loadCharacterJson();
  playerSquad = [];
  refreshCharacterUI();
  renderCategoryPage();
  renderItemPage();
  if (!equipmentPageEl.classList.contains("hidden")) {
    renderEquipmentPage();
  }
  closeWeaponCategoryModal();
}

async function deleteSelectedWeaponCategories() {
  const checkedIndexes = [...document.querySelectorAll(".weapon-category-check:checked")]
    .map(input => Number(input.value))
    .sort((a, b) => b - a);

  if (!checkedIndexes.length) {
    alert("삭제할 무기 카테고리를 선택하세요.");
    return;
  }

  const usedKeys = new Set(itemsJson.filter(isWeaponItem).map(item => item.weaponCategory));
  if (checkedIndexes.some(index => usedKeys.has(categoriesJson.weapons[index]?.key))) {
    alert("사용 중인 무기 카테고리는 삭제할 수 없습니다.");
    return;
  }

  checkedIndexes.forEach(index => categoriesJson.weapons.splice(index, 1));
  await saveCategoryJson();
  renderCategoryPage();
}

function openArmorCategoryModal(index = "") {
  const category = getArmorCategories()[index];
  armorCategoryModalTitleEl.innerText = category ? "방어구 카테고리 수정" : "방어구 카테고리 추가";
  armorCategoryEditIndexEl.value = category ? index : "";
  armorCategoryNameEl.value = category?.label ?? "";
  armorCategoryModalEl.classList.remove("hidden");
}

function closeArmorCategoryModal() {
  armorCategoryModalEl.classList.add("hidden");
  armorCategoryFormEl.reset();
}

async function saveArmorCategoryFromForm(event) {
  event.preventDefault();
  const editIndex = armorCategoryEditIndexEl.value;
  const existingKeys = getArmorCategories().map(category => category.key);
  const previous = editIndex !== "" ? categoriesJson.armors[Number(editIndex)] : null;
  const category = {
    key: previous?.key ?? createCategoryKey(armorCategoryNameEl.value, existingKeys),
    label: armorCategoryNameEl.value.trim()
  };

  if (!category.label) {
    alert("방어구 카테고리 이름을 입력하세요.");
    return;
  }

  if (editIndex !== "") {
    categoriesJson.armors[Number(editIndex)] = category;
  } else {
    categoriesJson.armors.push(category);
  }

  await saveCategoryJson();
  await loadItemJson();
  await loadCharacterJson();
  renderCategoryPage();
  renderItemPage();
  if (!equipmentPageEl.classList.contains("hidden")) {
    renderEquipmentPage();
  }
  closeArmorCategoryModal();
}

async function deleteSelectedArmorCategories() {
  const checkedIndexes = [...document.querySelectorAll(".armor-category-check:checked")]
    .map(input => Number(input.value))
    .sort((a, b) => b - a);

  if (!checkedIndexes.length) {
    alert("삭제할 방어구 카테고리를 선택하세요.");
    return;
  }

  const usedKeys = new Set(itemsJson.filter(item => isArmorSlot(item.slot)).map(item => item.armorCategory));
  if (checkedIndexes.some(index => usedKeys.has(categoriesJson.armors[index]?.key))) {
    alert("사용 중인 방어구 카테고리는 삭제할 수 없습니다.");
    return;
  }

  checkedIndexes.forEach(index => categoriesJson.armors.splice(index, 1));
  await saveCategoryJson();
  renderCategoryPage();
}
