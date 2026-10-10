// Display mappings are independent of gameplay identifiers and source names.
const ICON_GROUPS = { role: "잡 클래스", slot: "장비 슬롯", weapon: "무기 카테고리", armor: "방어구 카테고리", skill: "스킬 유형", faction: "진영" };
let iconMappings = [];
let iconMappingsReady = false;
let iconSaving = false;
let iconPreviewVersion = 0;

function safeCategoryIcon(path) {
  const value = String(path ?? "").trim();
  return /^\/?assets\/images\/(?:portraits|skills|items|icons|generated)\/(?!.*(?:\.\.|[\\?#]))[^\x00-\x1f]+\.(?:png|jpe?g|webp|gif)$/i.test(value) ? value : "";
}

function iconTargets(group) {
  if (group === "role") return ROLES.map(key => ({ key, label: getRoleLabel(key) }));
  if (group === "slot") return EQUIPMENT_SLOTS;
  if (group === "weapon") return getWeaponCategories();
  if (group === "armor") return getArmorCategories();
  if (group === "skill") return SKILL_SLOT_OPTIONS;
  if (group === "faction") return factionsJson.map(key => ({ key, label: key }));
  return [];
}

async function loadIconMappings() {
  try {
    const response = await fetch("/api/icon-mappings", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const rows = await response.json();
    if (!Array.isArray(rows)) throw new Error("아이콘 설정은 배열이어야 합니다.");
    iconMappings = rows.filter(row => row && Object.hasOwn(ICON_GROUPS, row.group) && typeof row.key === "string")
      .map(row => ({ group: row.group, key: row.key, label: String(row.label ?? ""), icon: safeCategoryIcon(row.icon),
        removeBackground: row.removeBackground !== false, backgroundTolerance: normalizeIconTolerance(row.backgroundTolerance) }));
    iconMappingsReady = true;
  } catch (error) {
    logError("icons", "아이콘 설정을 읽지 못했습니다. 아이콘 관리에서 다시 시도해주세요.", error);
  }
}

function categoryIconContent(group, key, original) {
  const mapping = iconMappings.find(row => row.group === group && row.key === key);
  const label = mapping?.label || original;
  const path = safeCategoryIcon(mapping?.icon);
  const background = mapping?.removeBackground !== false ? ` data-icon-background="${normalizeIconTolerance(mapping?.backgroundTolerance)}"` : "";
  return path ? `<img${background} src="${escapeHtml(path)}" alt="${escapeHtml(label)}" title="${escapeHtml(label === original ? label : `${label} (${original})`)}">` : escapeHtml(label);
}

document.addEventListener("load", async event => {
  const img = event.target;
  if (img.tagName !== "IMG" || !img.hasAttribute("data-icon-background")) return;
  const tolerance = img.dataset.iconBackground;
  const source = img.getAttribute("src");
  // Remove the trigger before changing src to avoid recursively processing PNGs.
  img.removeAttribute("data-icon-background");
  img.dataset.iconProcessing = "true";
  try {
    const processed = await getIconBackgroundPreview(source, tolerance);
    if (img.isConnected && img.getAttribute("src") === source) img.src = processed;
  } catch (error) {
    logError("icons", "배경 제거에 실패해 원본 아이콘을 표시합니다.", error);
  } finally { delete img.dataset.iconProcessing; }
}, true);

function renderCategoryIcon(group, key, original) {
  return `<span class="category-icon" data-icon-group="${escapeHtml(group)}" data-icon-key="${escapeHtml(key)}" data-icon-original="${escapeHtml(original)}">${categoryIconContent(group, key, original)}</span>`;
}

function refreshCategoryIcons() {
  document.querySelectorAll("[data-icon-group]").forEach(el => {
    el.innerHTML = categoryIconContent(el.dataset.iconGroup, el.dataset.iconKey, el.dataset.iconOriginal);
  });
}

document.addEventListener("error", event => {
  const img = event.target;
  if (img.tagName === "IMG" && img.parentElement?.classList.contains("category-icon")) {
    img.parentElement.textContent = img.alt;
  }
}, true);

function resetIconEditor() {
  const form = document.getElementById("iconMappingForm");
  form.reset();
  updateIconTargets();
}

function updateIconTargets(selectedKey) {
  const form = document.getElementById("iconMappingForm");
  const targets = [...iconTargets(form.elements.group.value)];
  iconMappings.filter(row => row.group === form.elements.group.value).forEach(row => {
    if (!targets.some(target => target.key === row.key)) targets.push({ key: row.key, label: `${row.key} (현재 대상 없음)` });
  });
  form.elements.key.innerHTML = targets.map(row => `<option value="${escapeHtml(row.key)}">${escapeHtml(row.label)}</option>`).join("");
  if (selectedKey !== undefined) form.elements.key.value = selectedKey;
  selectIconMapping();
}

function selectIconMapping() {
  const form = document.getElementById("iconMappingForm");
  const row = iconMappings.find(row => row.group === form.elements.group.value && row.key === form.elements.key.value);
  form.elements.label.value = row?.label || "";
  form.elements.icon.value = row?.icon || "";
  form.elements.file.value = "";
  form.elements.removeBackground.checked = row?.removeBackground !== false;
  form.elements.backgroundTolerance.value = normalizeIconTolerance(row?.backgroundTolerance);
  previewIconMapping();
}

async function previewIconMapping() {
  const version = ++iconPreviewVersion;
  const form = document.getElementById("iconMappingForm");
  const preview = document.getElementById("iconMappingPreview");
  const label = form.elements.label.value.trim() || form.elements.key.selectedOptions[0]?.textContent || "대상을 선택하세요";
  preview.replaceChildren();
  const file = form.elements.file.files[0];
  const enabled = form.elements.removeBackground.checked;
  const tolerance = normalizeIconTolerance(form.elements.backgroundTolerance.value);
  document.getElementById("iconToleranceValue").textContent = tolerance;
  form.elements.backgroundTolerance.disabled = !enabled || iconSaving;
  if (file && (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) || file.size > 5 * 1024 * 1024)) {
    preview.textContent = "5MB 이하의 PNG, JPG, WEBP, GIF를 선택하세요.";
    return;
  }
  const path = file ? URL.createObjectURL(file) : safeCategoryIcon(form.elements.icon.value);
  if (!path) { preview.textContent = label; return; }
  let processed = path;
  if (enabled) {
    preview.textContent = "배경 처리 중…";
    try { processed = await getIconBackgroundPreview(path, tolerance); }
    catch (error) {
      logError("icons", "배경 미리보기 실패", error);
      if (version === iconPreviewVersion) preview.textContent = `${label} (이미지를 확인해주세요)`;
      if (file) URL.revokeObjectURL(path);
      return;
    }
  }
  if (version !== iconPreviewVersion) { if (file) URL.revokeObjectURL(path); return; }
  preview.replaceChildren();
  const img = document.createElement("img");
  img.alt = label;
  img.title = label;
  img.onload = () => { if (file) URL.revokeObjectURL(path); };
  img.onerror = () => { if (file) URL.revokeObjectURL(path); preview.textContent = `${label} (이미지를 확인해주세요)`; };
  img.src = processed;
  preview.append(img);
}

async function renderIconPage() {
  if (!iconMappingsReady) await loadIconMappings();
  const form = document.getElementById("iconMappingForm");
  form.elements.group.innerHTML = Object.entries(ICON_GROUPS).map(([key, label]) => `<option value="${key}">${label}</option>`).join("");
  resetIconEditor();
  renderIconMappingRows();
  document.getElementById("iconMappingStatus").textContent = iconMappingsReady ? "" : "설정을 읽지 못했습니다. 이 화면을 다시 열어 재시도하세요.";
}

function renderIconMappingRows() {
  document.getElementById("iconMappingRows").innerHTML = iconMappings.map((row, index) => {
    const original = iconTargets(row.group).find(target => target.key === row.key)?.label || `${row.key} (현재 대상 없음)`;
    return `<tr><td>${ICON_GROUPS[row.group]}</td><td>${escapeHtml(original)}</td><td>${escapeHtml(row.label || original)}</td><td>${renderCategoryIcon(row.group, row.key, original)}</td><td><button type="button" onclick="editIconMapping(${index})">수정</button> <button type="button" onclick="deleteIconMapping(${index})">해제</button></td></tr>`;
  }).join("") || '<tr><td colspan="5">등록된 아이콘이 없습니다. 대상 단어를 선택해 등록하세요.</td></tr>';
}

function editIconMapping(index) {
  if (iconSaving) return;
  const row = iconMappings[index];
  document.getElementById("iconMappingForm").elements.group.value = row.group;
  updateIconTargets(row.key);
}

async function persistIconMappings(buildRows) {
  if (iconSaving || !iconMappingsReady) return;
  iconSaving = true;
  const page = document.getElementById("iconPage");
  const controls = [...page.querySelectorAll("input, select, button")];
  controls.forEach(el => { el.disabled = true; });
  const status = document.getElementById("iconMappingStatus");
  status.textContent = "저장 중…";
  try {
    const rows = await buildRows();
    await saveJsonFile("iconMappings", rows);
    iconMappings = rows;
    refreshCategoryIcons();
    renderIconMappingRows();
    status.textContent = "저장했습니다.";
  } catch (error) {
    logError("icons", "아이콘 설정 저장 실패", error);
    status.textContent = `저장하지 못했습니다: ${error.message}`;
  } finally {
    iconSaving = false;
    controls.forEach(el => { el.disabled = false; });
    document.getElementById("iconMappingForm").elements.backgroundTolerance.disabled = !document.getElementById("iconMappingForm").elements.removeBackground.checked;
  }
}

async function saveIconMapping(event) {
  event.preventDefault();
  const form = event.target;
  const group = form.elements.group.value;
  const key = form.elements.key.value;
  const label = form.elements.label.value.trim();
  const enteredPath = form.elements.icon.value.trim();
  const file = form.elements.file.files[0];
  const removeBackground = form.elements.removeBackground.checked;
  const backgroundTolerance = normalizeIconTolerance(form.elements.backgroundTolerance.value);
  if (!key) return;
  if (!file && enteredPath && !safeCategoryIcon(enteredPath)) {
    document.getElementById("iconMappingStatus").textContent = "assets/images 하위의 PNG, JPG, WEBP, GIF 경로를 입력하세요.";
    return;
  }
  await persistIconMappings(async () => {
    let icon = safeCategoryIcon(enteredPath);
    if (file) {
      if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error("5MB 이하의 PNG, JPG, WEBP, GIF를 선택하세요.");
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("이미지를 읽지 못했습니다."));
        reader.readAsDataURL(file);
      });
      icon = await uploadImageAsset("icons", dataUrl, `${group}-${key}`);
      form.elements.icon.value = icon;
      form.elements.file.value = "";
    }
    return [...iconMappings.filter(row => row.group !== group || row.key !== key), { group, key, label, icon, removeBackground, backgroundTolerance }];
  });
  previewIconMapping();
}

async function deleteIconMapping(index) {
  await persistIconMappings(async () => iconMappings.filter((_, rowIndex) => rowIndex !== index));
  selectIconMapping();
}
