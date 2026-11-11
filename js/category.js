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
  const attackType = WEAPON_ATTACK_TYPES.some(type => type.key === category?.attackType) ? category.attackType : fallback.attackType ?? BARE_HAND_ATTACK_TYPE;
  const attackRange = Number(category?.attackRange);
  const attackSpeed = Number(category?.attackSpeed);
  const castSpeed = Number(category?.castSpeed);

  return {
    key: String(category?.key ?? fallback.key ?? `weapon_${index}`).trim(),
    label: String(category?.label ?? fallback.label ?? "").trim(),
    handType,
    attackRange: Number.isFinite(attackRange) && attackRange >= 1 ? attackRange : fallback.attackRange,
    attackSpeed: Number.isFinite(attackSpeed) && attackSpeed > 0 ? attackSpeed : fallback.attackSpeed ?? BARE_HAND_ATTACK_SPEED,
    castSpeed: Number.isFinite(castSpeed) && castSpeed >= 0 ? castSpeed : fallback.castSpeed ?? BARE_HAND_CAST_SPEED,
    attackType,
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

function getWeaponAttackTypeLabel(attackTypeKey) {
  return WEAPON_ATTACK_TYPES.find(type => type.key === attackTypeKey)?.label ?? "-";
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

  if (weaponCategoryAttackTypeEl) {
    weaponCategoryAttackTypeEl.innerHTML = WEAPON_ATTACK_TYPES
      .map(type => `<option value="${type.key}">${type.label}</option>`)
      .join("");
  }
}

function renderCategoryName(group, category) {
  return `<span class="category-name">${renderCategoryIcon(group, category.key, category.label)}<span>${escapeHtml(category.label)}</span></span>`;
}

function renderCategoryPage() {
  renderCategoryOptions();
  renderWeaponCategoryTable();
  renderArmorCategoryTable();
  renderWeaponDpsTable();
}

let weaponDpsSaving = false;

function showCategoryTab(tab) {
  const dps = tab === "dps";
  document.getElementById("categorySettingsPanel").classList.toggle("hidden", dps);
  document.getElementById("weaponDpsPanel").classList.toggle("hidden", !dps);
  document.getElementById("categorySettingsTab").setAttribute("aria-selected", String(!dps));
  document.getElementById("weaponDpsTab").setAttribute("aria-selected", String(dps));
}

function calculateWeaponDps(power, castSpeed, attackSpeed) {
  const cycle = Number(castSpeed) + Number(attackSpeed);
  return Number.isFinite(cycle) && cycle > 0 && Number.isFinite(Number(power))
    ? Number(power) / cycle : 0;
}

function renderWeaponDpsTable() {
  if (weaponDpsSaving) return;
  const body = document.getElementById("weaponDpsTableBody");
  if (!body) return;
  body.innerHTML = itemsJson.filter(isWeaponItem).map(item => {
    const category = getWeaponCategory(item.weaponCategory);
    const stat = category.attackType === "magic" ? "magic" : "atk";
    const numeric = (field, value, min, label) => `<input type="number" data-field="${field}" value="${value}" min="${min}" step="any" required aria-label="${escapeHtml(item.name)} ${label}">`;
    return `<tr data-item-id="${escapeHtml(item.id)}">
      <td><div class="weapon-dps-name">${equipmentItemIcon(item)}<input data-field="name" value="${escapeHtml(item.name)}" required aria-label="장비명"></div></td>
      <td><label class="weapon-dps-power">${stat === "magic" ? "마력" : "공격력"}${numeric("power", item[stat], 0, stat === "magic" ? "마력" : "공격력")}</label></td>
      <td>${numeric("castSpeed", category.castSpeed, 0, "시전속도")}</td>
      <td>${numeric("attackSpeed", category.attackSpeed, 0, "공격속도")}</td>
      <td><output data-dps>${calculateWeaponDps(item[stat], category.castSpeed, category.attackSpeed).toFixed(2)}</output></td>
      <td>${numeric("attackRange", category.attackRange, 1, "사정거리")}</td>
      <td><select data-field="attackSkillId" aria-label="${escapeHtml(item.name)} 적용스킬">${getSkillOptionsHtml(item.attackSkillId)}</select></td>
    </tr>`;
  }).join("") || '<tr><td colspan="7">등록된 무기가 없습니다.</td></tr>';
  resetWeaponDpsChanges();
  document.getElementById("weaponDpsStatus").textContent = "";
}

function resetWeaponDpsChanges() {
  const body = document.getElementById('weaponDpsTableBody');
  body.querySelectorAll('[data-field]').forEach(input => { input.dataset.originalValue = input.value; });
  body.querySelectorAll('[data-dps]').forEach(output => { output.dataset.originalValue = output.textContent; });
  body.querySelectorAll('.weapon-dps-changed').forEach(cell => cell.classList.remove('weapon-dps-changed'));
}

function updateWeaponDpsPreview(event) {
  const row = event.target.closest("tr[data-item-id]");
  if (!row) return;
  const value = field => row.querySelector(`[data-field="${field}"]`).value;
  row.querySelector("[data-dps]").textContent = calculateWeaponDps(value("power"), value("castSpeed"), value("attackSpeed")).toFixed(2);
  row.querySelectorAll('[data-field]').forEach(input => {
    const unchanged = input.type === 'number' && input.value !== '' && input.dataset.originalValue !== ''
      ? Number(input.value) === Number(input.dataset.originalValue) : input.value === input.dataset.originalValue;
    input.closest('td').classList.toggle('weapon-dps-changed', !unchanged);
  });
  const output = row.querySelector('[data-dps]');
  output.closest('td').classList.toggle('weapon-dps-changed', output.textContent !== output.dataset.originalValue);
  document.getElementById("weaponDpsStatus").textContent = document.querySelector('#weaponDpsTableBody .weapon-dps-changed') ? "미저장 변경사항이 있습니다." : "";
}

async function saveWeaponDpsSettings(event) {
  event.preventDefault();
  if (weaponDpsSaving) return;
  const form = document.getElementById("weaponDpsForm");
  if (!form.reportValidity()) return;
  const status = document.getElementById("weaponDpsStatus");
  const previousCategories = flattenCategoryJson();
  const nextCategories = previousCategories.map(category => ({ ...category }));
  const nextItems = itemsJson.map(item => ({ ...item }));
  const configuredCategories = new Map();
  for (const row of form.querySelectorAll("tr[data-item-id]")) {
    const item = nextItems.find(candidate => candidate.id === row.dataset.itemId);
    const category = nextCategories.find(candidate => candidate.type === "weapon" && candidate.key === item?.weaponCategory);
    if (!item || !category) { status.textContent = "장비 목록이 변경되었습니다. 페이지를 다시 열어주세요."; return; }
    const value = field => row.querySelector(`[data-field="${field}"]`).value;
    const name = value("name").trim();
    const power = Number(value("power"));
    const settings = Object.fromEntries(["castSpeed", "attackSpeed", "attackRange"].map(field => [field, Number(value(field))]));
    const skillId = value("attackSkillId");
    if (!name || !Number.isFinite(power) || power < 0
      || Object.values(settings).some(number => !Number.isFinite(number))
      || settings.castSpeed < 0 || settings.attackSpeed <= 0 || settings.attackRange < 1
      || (skillId && !skillsJson.some(skill => skill.id === skillId && skill.slot !== "optional" && skill.slot !== "passive" && !skill.internal && isSkillExecutable(skill)))) {
      status.textContent = "장비명·능력치·주기·사정거리·적용스킬을 확인해주세요.";
      return;
    }
    const signature = JSON.stringify(settings);
    if (configuredCategories.has(category.key) && configuredCategories.get(category.key) !== signature) {
      status.textContent = "같은 무기 카테고리의 주기와 사정거리는 동일하게 설정해주세요.";
      return;
    }
    configuredCategories.set(category.key, signature);
    Object.assign(category, settings);
    Object.assign(item, settings, { name, attackSkillId: skillId, [category.attackType === "magic" ? "magic" : "atk"]: power });
  }
  weaponDpsSaving = true;
  const controls = [...categoryPageEl.querySelectorAll("input, select, button")];
  controls.forEach(control => { control.disabled = true; });
  status.textContent = "저장 중…";
  let categoriesSaved = false;
  let itemsSaved = false;
  try {
    await saveJsonFile("categories", nextCategories);
    categoriesSaved = true;
    await saveJsonFile("items", nextItems);
    itemsSaved = true;
    resetWeaponDpsChanges();
    categoriesJson = normalizeCategoryJson(nextCategories);
    itemsJson = normalizeItemJson(nextItems);
    try { localStorage.setItem(ITEM_STORAGE_KEY, JSON.stringify(nextItems)); }
    catch (error) { logWarn("item", "서버 저장 완료. 브라우저 캐시를 갱신하지 못했습니다.", error); }
    playerSquad = [];
    refreshCharacterUI();
    renderItemPage();
    renderWeaponCategoryTable();
    if (!equipmentPageEl.classList.contains("hidden")) renderEquipmentPage();
    status.textContent = "저장했습니다.";
    log("무기 DPS 설정을 저장했습니다.", "category");
  } catch (error) {
    logError("category", "무기 DPS 설정 저장 실패", error);
    if (itemsSaved) {
      status.textContent = "설정은 저장됐지만 화면 갱신에 실패했습니다. 새로고침해주세요.";
      return;
    }
    let restored = !categoriesSaved;
    if (categoriesSaved) {
      try { await saveJsonFile("categories", previousCategories); restored = true; }
      catch (rollbackError) { logError("category", "무기 카테고리 복원 실패", rollbackError); }
    }
    status.textContent = restored ? "저장하지 못했습니다. 입력값을 유지했으니 다시 시도해주세요."
      : "저장과 복원에 실패했습니다. 서버의 카테고리와 장비 설정을 다시 확인해주세요.";
  } finally {
    weaponDpsSaving = false;
    controls.forEach(control => { control.disabled = false; });
  }
}

function renderWeaponCategoryTable() {
  weaponCategoryTableBodyEl.innerHTML = getWeaponCategories().map((category, index) => `
    <tr>
      <td><input type="checkbox" class="weapon-category-check" value="${index}"></td>
      <td>${renderCategoryName("weapon", category)}</td>
      <td>${getHandTypeLabel(category.handType)}</td>
      <td>${category.attackRange}</td>
      <td>${category.attackSpeed}</td>
      <td>${category.castSpeed}</td>
      <td>${getWeaponAttackTypeLabel(category.attackType)}</td>
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
      <td>${renderCategoryIcon("armor", category.key, `${category.label} 상의`)}</td>
      <td>${renderCategoryIcon("armorBottom", category.key, `${category.label} 하의`)}</td>
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
  weaponCategoryAttackSpeedEl.value = category?.attackSpeed ?? BARE_HAND_ATTACK_SPEED;
  weaponCategoryCastSpeedEl.value = category?.castSpeed ?? BARE_HAND_CAST_SPEED;
  weaponCategoryAttackTypeEl.value = category?.attackType ?? BARE_HAND_ATTACK_TYPE;
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
    castSpeed: Number(weaponCategoryCastSpeedEl.value),
    attackType: weaponCategoryAttackTypeEl.value,
    slotType: weaponCategorySlotTypeEl.value
  };

  if (!category.label
    || !Number.isFinite(category.attackRange) || category.attackRange < 1
    || !Number.isFinite(category.attackSpeed) || category.attackSpeed <= 0
    || !Number.isFinite(category.castSpeed) || category.castSpeed < 0
    || !WEAPON_ATTACK_TYPES.some(type => type.key === category.attackType)) {
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
