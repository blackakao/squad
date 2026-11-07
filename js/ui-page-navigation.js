// Browser page navigation and form option initialization. Loaded after ui.js.
async function showPage(pageName) {
  document.getElementById("runePage")?.classList.toggle("hidden",pageName !== "rune");
  if (pageName === "rune") {await loadSkillJson();await loadRuneJson();renderRunePage();editRune();}
  document.getElementById("synergyPage")?.classList.toggle("hidden", pageName !== "synergy");
  document.getElementById("simulationPage")?.classList.toggle("hidden", pageName !== "simulation");
  document.getElementById("iconPage").classList.toggle("hidden", pageName !== "icon");
  battlePageEl.classList.toggle("hidden", pageName !== "battle");
  monsterPageEl.classList.toggle("hidden", pageName !== "monster");
  characterPageEl.classList.toggle("hidden", pageName !== "character");
  teamPageEl.classList.toggle("hidden", pageName !== "team");
  factionPageEl.classList.toggle("hidden", pageName !== "faction");
  statsPageEl.classList.toggle("hidden", pageName !== "stats");
  recordPageEl.classList.toggle("hidden", pageName !== "record");
  equipmentPageEl.classList.toggle("hidden", pageName !== "equipment");
  itemPageEl.classList.toggle("hidden", pageName !== "item");
  categoryPageEl.classList.toggle("hidden", pageName !== "category");
  skillPageEl.classList.toggle("hidden", pageName !== "skill");
  imagePageEl.classList.toggle("hidden", pageName !== "image");
  layoutPageEl.classList.toggle("hidden", pageName !== "layout");
  logPageEl.classList.toggle("hidden", pageName !== "log");

  if (pageName === "synergy") {
    await loadFactionJson();
    await loadSynergyJson();
    renderSynergyPage();
  } else if (pageName === "simulation") {
    await SimulationPage.open();
  } else if (pageName === "icon") {
    await renderIconPage();
  } else if (pageName === "monster") {
    await loadMonsterJson();
    enemySquad = [];
    refreshMonsterUI();
    updateStatusUI();
  } else if (pageName === "character") {
    await loadFactionJson();
    await loadSkillJson();
    await loadCharacterJson();
    playerSquad = [];
    selectedBattleTeamIds.clear();
    selectedBattleCharacterIds.clear();
    refreshCharacterUI();
  } else if (pageName === "team") {
    await loadSynergyJson();
    await loadCharacterJson();
    await loadTeamJson();
    renderTeamPage();
  } else if (pageName === "faction") {
    await loadFactionJson();
    await loadCharacterJson();
    renderFactionPage();
  } else if (pageName === "stats") {
    await loadCharacterJson();
    renderStatsPage();
  } else if (pageName === "record") {
    await loadBattleRecordsJson();
    renderBattleRecords();
  } else if (pageName === "equipment") {
    await loadCategoryJson();
    await loadSkillJson();
    await loadItemJson();
    await loadCharacterJson();
    renderEquipmentPage();
  } else if (pageName === "item") {
    await loadCategoryJson();
    await loadSkillJson();
    await loadItemJson();
    renderItemPage();
  } else if (pageName === "category") {
    await loadCategoryJson();
    await loadSkillJson();
    await loadItemJson();
    renderCategoryPage();
  } else if (pageName === "skill") {
    await loadSkillJson();
    await loadCharacterJson();
    await loadItemJson();
    renderSkillPage();
  } else if (pageName === "image") {
    renderImageGeneratorPage();
  } else if (pageName === "layout") {
    renderLayoutSettingsPage();
  } else if (pageName === "log") {
    renderLogPage();
  }

  if (pageName === "battle") {
    await loadSynergyJson();
    await loadTeamJson();
    renderBattleTeamButtons();
    renderBattleEnemyControls();
    resizeCanvas();
  }
}

function initRoleOptions() {
  const roleOptions = ROLES.map(role => `<option value="${role}">${getRoleLabel(role)}</option>`).join("");
  monsterRoleEl.innerHTML = roleOptions;
  characterRoleEl.innerHTML = roleOptions;
  if (characterRoleFilterEl) {
    characterRoleFilterEl.innerHTML = `<option value="all">전체</option>${roleOptions}`;
  }
  itemSlotEl.innerHTML = EQUIPMENT_SLOTS.map(slot => `<option value="${slot.key}">${slot.label}</option>`).join("");
  renderCategoryOptions();
  if (itemSlotFilterEl) {
    itemSlotFilterEl.innerHTML = `<option value="all">전체</option>${EQUIPMENT_SLOTS.map(slot => `<option value="${slot.key}">${slot.label}</option>`).join("")}`;
  }
  if (equipmentItemSlotFilterEl) {
    equipmentItemSlotFilterEl.innerHTML = `<option value="all">전체</option>${EQUIPMENT_SLOTS.map(slot => `<option value="${slot.key}">${slot.label}</option>`).join("")}`;
  }
  renderCharacterFactionOptions();
}

function renderCharacterFactionOptions() {
  characterFactionEl.innerHTML = factionsJson.map(faction => `<option value="${escapeHtml(faction)}">${escapeHtml(faction)}</option>`).join("");
}

