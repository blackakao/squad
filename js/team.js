function normalizeTeamBattleRules(rules = {}) {
  const percent = value => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, number) : 100;
  };
  return {
    damagePercent: percent(rules.damagePercent ?? 100),
    healingPercent: percent(rules.healingPercent ?? 100),
    resourceCostPercent: percent(rules.resourceCostPercent ?? 100),
    cooldownPercent: percent(rules.cooldownPercent ?? 100)
  };
}

function normalizeTeamSynergyRule(rule = {}) {
  const type = rule.type === "role" ? "role" : "faction";
  const percent = value => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, number) : 100;
  };
  return {
    type,
    value: String(rule.value ?? "").trim(),
    requiredCount: Math.max(1, Math.min(MAX_PLAYER_SQUAD, Math.floor(Number(rule.requiredCount) || 2))),
    damagePercent: percent(rule.damagePercent ?? 100),
    healingPercent: percent(rule.healingPercent ?? 100),
    resourceCostPercent: percent(rule.resourceCostPercent ?? 100),
    cooldownPercent: percent(rule.cooldownPercent ?? 100)
  };
}

function normalizeTeamSynergyRules(rules) {
  return (Array.isArray(rules) ? rules : []).map(normalizeTeamSynergyRule).filter(rule => rule.value);
}

function getActiveTeamSynergies(team) {
  const members = getTeamCharacterIds(team).map(id => characterJson[id]).filter(Boolean);
  return normalizeTeamSynergyRules(team?.synergyRules).filter(rule => members.filter(character =>
    rule.type === "role" ? normalizeRole(character.role) === rule.value : character.faction === rule.value
  ).length >= rule.requiredCount);
}

function getTeamRulesWithSynergies(team) {
  return getActiveTeamSynergies(team).reduce((rules, synergy) => ({
    damagePercent: rules.damagePercent * synergy.damagePercent / 100,
    healingPercent: rules.healingPercent * synergy.healingPercent / 100,
    resourceCostPercent: rules.resourceCostPercent * synergy.resourceCostPercent / 100,
    cooldownPercent: rules.cooldownPercent * synergy.cooldownPercent / 100
  }), normalizeTeamBattleRules(team?.battleRules));
}

let activeBattleSideBaseRules = { player: normalizeTeamBattleRules(), enemy: normalizeTeamBattleRules() };
let activeBattleSideRules = { player: normalizeTeamBattleRules(), enemy: normalizeTeamBattleRules() };

function getUnitTeamBattleRules(unit) {
  const synergiesDisabled=(unit?.runtimeRuleOverrides ?? []).some(override=>override.disableTeamSynergies);
  const base=(synergiesDisabled ? activeBattleSideBaseRules : activeBattleSideRules)[unit?.side] ?? normalizeTeamBattleRules();
  return (unit?.runtimeRuleOverrides ?? []).reduce((rules,override)=>({
    damagePercent:rules.damagePercent * override.damagePercent / 100,
    healingPercent:rules.healingPercent * override.healingPercent / 100,
    resourceCostPercent:rules.resourceCostPercent * override.resourceCostPercent / 100,
    cooldownPercent:rules.cooldownPercent * override.cooldownPercent / 100
  }),{...base});
}

function snapshotActiveBattleSideRules() {
  const playerTeamIndexes = [...selectedBattleTeamIds];
  const pureSingleTeam = playerTeamIndexes.length === 1 && selectedBattleCharacterIds.size === 0;
  activeBattleSideBaseRules = {
    player: pureSingleTeam ? normalizeTeamBattleRules(teamsJson[playerTeamIndexes[0]]?.battleRules) : normalizeTeamBattleRules(),
    enemy: battleMode === "team" && selectedEnemyTeamIndex !== "" ? normalizeTeamBattleRules(teamsJson[Number(selectedEnemyTeamIndex)]?.battleRules) : normalizeTeamBattleRules()
  };
  activeBattleSideRules = {
    player: pureSingleTeam ? getTeamRulesWithSynergies(teamsJson[playerTeamIndexes[0]]) : normalizeTeamBattleRules(),
    enemy: battleMode === "team" && selectedEnemyTeamIndex !== "" ? getTeamRulesWithSynergies(teamsJson[Number(selectedEnemyTeamIndex)]) : normalizeTeamBattleRules()
  };
  return structuredClone(activeBattleSideRules);
}

function normalizeTeamJson(teams) {
  if (!Array.isArray(teams)) {
    return [];
  }

  return teams
    .map(team => {
      const memberIds = Array.isArray(team.memberIds) ? team.memberIds : [];

      return {
        name: String(team.name ?? "").trim(),
        battleRules: normalizeTeamBattleRules(team.battleRules),
        synergyRules: normalizeTeamSynergyRules(team.synergyRules),
        memberIds: [...new Set(memberIds.map(id => Number(id)))]
          .filter(id => Number.isInteger(id) && characterJson[id])
          .slice(0, MAX_PLAYER_SQUAD),
        activeMemberCount: Math.max(1, Math.min(memberIds.length || 1,
          Math.floor(Number(team.activeMemberCount) || memberIds.length || 1)))
      };
    })
    .filter(team => team.name);
}

async function loadTeamJson() {
  const rawJson = await loadJsonFile("teams", []);
  teamsJson = normalizeTeamJson(rawJson);
}

async function saveTeamJson() {
  teamsJson = normalizeTeamJson(teamsJson);
  await saveJsonFile("teams", teamsJson);
  log("팀 편성 데이터가 저장되었습니다.");
}

function syncTeamsAfterCharacterDeletion(deletedIndexes) {
  const deletedSet = new Set(deletedIndexes);

  teamsJson = teamsJson.map(team => ({
    ...team,
    memberIds: (team.memberIds ?? [])
      .map(id => Number(id))
      .filter(id => Number.isInteger(id))
      .filter(id => !deletedSet.has(id))
      .map(id => id - deletedIndexes.filter(deletedIndex => deletedIndex < id).length)
      .filter(id => characterJson[id])
  }));

  selectedTeamMemberIds = selectedTeamMemberIds
    .filter(id => !deletedSet.has(id))
    .map(id => id - deletedIndexes.filter(deletedIndex => deletedIndex < id).length);
}

function getTeamCharacterIds(team) {
  return [...new Set((team?.memberIds ?? []).map(id => Number(id)))]
    .filter(id => Number.isInteger(id) && characterJson[id])
    .slice(0, MAX_PLAYER_SQUAD);
}

function getSelectedTeam() {
  return selectedTeamIndex !== "" ? teamsJson[Number(selectedTeamIndex)] : null;
}

function renderTeamPage() {
  if (selectedTeamIndex !== "" && !teamsJson[Number(selectedTeamIndex)]) {
    selectedTeamIndex = "";
    selectedTeamMemberIds = [];
    selectedTeamSynergyRules = [];
  }

  renderTeamList();
  renderTeamEditor();
}

function renderTeamList() {
  teamListEl.innerHTML = teamsJson.length
    ? teamsJson.map((team, index) => `
      <button class="team-list-button ${Number(selectedTeamIndex) === index ? "selected" : ""}" onclick="selectTeamForEdit(${index})">
        ${escapeHtml(team.name)} (${getTeamCharacterIds(team).length}/${MAX_PLAYER_SQUAD})
      </button>
    `).join("")
    : '<span class="empty-text">편성된 팀 없음</span>';
}

function renderTeamEditor() {
  const team = getSelectedTeam();

  if (!team) {
    teamSelectedNameEl.innerText = "팀을 선택하세요";
    teamMemberSummaryEl.innerText = `0 / ${MAX_PLAYER_SQUAD}`;
    teamMemberListEl.innerHTML = "";
    teamBattleRulesEl.querySelectorAll("input").forEach(input => { input.value = 100; input.disabled = true; });
    teamActiveMemberCountEl.value = 1;
    teamActiveMemberCountEl.disabled = true;
    teamSynergyRulesEl.querySelectorAll("button").forEach(button => { button.disabled = true; });
    teamSynergyRuleListEl.innerHTML = '<span class="empty-text">팀을 선택해주세요.</span>';
    teamCharacterListEl.innerHTML = characterJson.map((character, index) => `
      <button class="team-character-button" onclick="alert('먼저 팀을 선택해주세요.')">
        ${escapeHtml(character.name)} (${escapeHtml(getRoleLabel(character.role))})
      </button>
    `).join("");
    return;
  }

  const selectedIds = new Set(selectedTeamMemberIds);
  const rules = normalizeTeamBattleRules(team.battleRules);
  teamActiveMemberCountEl.disabled = false;
  teamActiveMemberCountEl.max = Math.max(1, selectedTeamMemberIds.length);
  teamActiveMemberCountEl.value = Math.max(1, Math.min(selectedTeamMemberIds.length || 1, Number(team.activeMemberCount) || selectedTeamMemberIds.length || 1));
  teamDamagePercentEl.value = rules.damagePercent;
  teamHealingPercentEl.value = rules.healingPercent;
  teamResourceCostPercentEl.value = rules.resourceCostPercent;
  teamCooldownPercentEl.value = rules.cooldownPercent;
  teamBattleRulesEl.querySelectorAll("input").forEach(input => { input.disabled = false; });
  teamSynergyRulesEl.querySelectorAll("button").forEach(button => { button.disabled = false; });
  renderSelectedTeamSynergies();
  teamSelectedNameEl.innerText = team.name;
  teamMemberSummaryEl.innerText = `${selectedTeamMemberIds.length} / ${MAX_PLAYER_SQUAD}`;
  teamMemberListEl.innerHTML = selectedTeamMemberIds.length
    ? selectedTeamMemberIds.map(id => {
      const character = characterJson[id];
      return `
        <div class="team-member-row">
          <span>${escapeHtml(character.name)} (${escapeHtml(getRoleLabel(character.role))})</span>
          <button onclick="removeCharacterFromSelectedTeam(${id})">삭제</button>
        </div>
      `;
    }).join("")
    : '<span class="empty-text">팀원이 없습니다.</span>';

  teamCharacterListEl.innerHTML = characterJson.map((character, index) => `
    <button class="team-character-button ${selectedIds.has(index) ? "selected" : ""}" onclick="toggleCharacterInSelectedTeam(${index})">
      ${escapeHtml(character.name)} (${escapeHtml(getRoleLabel(character.role))})
    </button>
  `).join("");
}

function selectTeamForEdit(index) {
  selectedTeamIndex = index;
  selectedTeamMemberIds = getTeamCharacterIds(teamsJson[index]);
  selectedTeamSynergyRules = normalizeTeamSynergyRules(teamsJson[index].synergyRules);
  renderTeamPage();
}

async function addTeamFromInput() {
  const name = teamNameEl.value.trim();

  if (!name) {
    alert("팀 이름을 입력해주세요.");
    return;
  }

  teamsJson.push({ name, memberIds: [], activeMemberCount: 1, battleRules: normalizeTeamBattleRules(), synergyRules: [] });
  selectedTeamIndex = teamsJson.length - 1;
  selectedTeamMemberIds = [];
  selectedTeamSynergyRules = [];
  teamNameEl.value = "";

  try {
    await saveTeamJson();
    renderTeamPage();
    renderBattleTeamButtons();
    renderBattleEnemyControls();
  } catch (error) {
    logError("team", "팀 추가 처리 중 실패했습니다.", error);
    alert("팀 편성 데이터를 저장하지 못했습니다.");
  }
}

async function deleteSelectedTeam() {
  const team = getSelectedTeam();

  if (!team) {
    alert("삭제할 팀을 선택해주세요.");
    return;
  }

  teamsJson.splice(Number(selectedTeamIndex), 1);
  selectedTeamIndex = "";
  selectedTeamMemberIds = [];
  selectedTeamSynergyRules = [];
  selectedBattleTeamIds.clear();
  selectedEnemyTeamIndex = "";
  rebuildPlayerSquadFromSelection();

  try {
    await saveTeamJson();
    renderTeamPage();
    renderBattleTeamButtons();
    renderBattleEnemyControls();
  } catch (error) {
    logError("team", "팀 삭제 처리 중 실패했습니다.", error);
    alert("팀 편성 데이터를 저장하지 못했습니다.");
  }
}

function toggleCharacterInSelectedTeam(characterId) {
  if (!getSelectedTeam()) {
    alert("먼저 팀을 선택해주세요.");
    return;
  }

  selectedTeamSynergyRules = collectSelectedTeamSynergies();
  if (selectedTeamMemberIds.includes(characterId)) {
    selectedTeamMemberIds = selectedTeamMemberIds.filter(id => id !== characterId);
  } else if (selectedTeamMemberIds.length < MAX_PLAYER_SQUAD) {
    selectedTeamMemberIds.push(characterId);
  } else {
    alert(`팀에는 최대 ${MAX_PLAYER_SQUAD}명까지 편성할 수 있습니다.`);
  }

  renderTeamEditor();
}

function removeCharacterFromSelectedTeam(characterId) {
  selectedTeamSynergyRules = collectSelectedTeamSynergies();
  selectedTeamMemberIds = selectedTeamMemberIds.filter(id => id !== characterId);
  renderTeamEditor();
}

function renderSelectedTeamSynergies() {
  if (!selectedTeamSynergyRules.length) {
    teamSynergyRuleListEl.innerHTML = '<span class="empty-text">설정된 시너지 없음</span>';
    return;
  }
  const factionOptions = factionsJson.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("");
  const roleOptions = ROLES.map(value => `<option value="${value}">${escapeHtml(getRoleLabel(value))}</option>`).join("");
  teamSynergyRuleListEl.innerHTML = selectedTeamSynergyRules.map((rule, index) => `
    <div class="team-synergy-rule" data-index="${index}">
      <label>기준<select data-field="type" onchange="changeSelectedTeamSynergyType(${index}, this.value)"><option value="faction" ${rule.type === "faction" ? "selected" : ""}>진영</option><option value="role" ${rule.type === "role" ? "selected" : ""}>계열</option></select></label>
      <label>값<select data-field="value">${rule.type === "role" ? roleOptions : factionOptions}</select></label>
      <label>필요 인원<input data-field="requiredCount" type="number" min="1" max="10" value="${rule.requiredCount}"></label>
      <label>피해(%)<input data-field="damagePercent" type="number" min="0" value="${rule.damagePercent}"></label>
      <label>치유(%)<input data-field="healingPercent" type="number" min="0" value="${rule.healingPercent}"></label>
      <label>비용(%)<input data-field="resourceCostPercent" type="number" min="0" value="${rule.resourceCostPercent}"></label>
      <label>쿨타임(%)<input data-field="cooldownPercent" type="number" min="0" value="${rule.cooldownPercent}"></label>
      <button type="button" class="team-synergy-remove" onclick="removeSelectedTeamSynergy(${index})">삭제</button>
    </div>`).join("");
  selectedTeamSynergyRules.forEach((rule, index) => {
    const select = teamSynergyRuleListEl.querySelector(`[data-index="${index}"] [data-field="value"]`);
    if (select) select.value = rule.value;
  });
}

function collectSelectedTeamSynergies() {
  return [...teamSynergyRuleListEl.querySelectorAll(".team-synergy-rule")].map(row => {
    const value = field => row.querySelector(`[data-field="${field}"]`)?.value;
    return normalizeTeamSynergyRule({type:value("type"), value:value("value"), requiredCount:value("requiredCount"), damagePercent:value("damagePercent"), healingPercent:value("healingPercent"), resourceCostPercent:value("resourceCostPercent"), cooldownPercent:value("cooldownPercent")});
  }).filter(rule => rule.value);
}

function addSelectedTeamSynergy() {
  if (!getSelectedTeam()) return;
  selectedTeamSynergyRules = collectSelectedTeamSynergies();
  selectedTeamSynergyRules.push(normalizeTeamSynergyRule({value:factionsJson[0] ?? "기본 진영"}));
  renderSelectedTeamSynergies();
}

function removeSelectedTeamSynergy(index) {
  selectedTeamSynergyRules = collectSelectedTeamSynergies().filter((_, ruleIndex) => ruleIndex !== index);
  renderSelectedTeamSynergies();
}

function changeSelectedTeamSynergyType(index, type) {
  selectedTeamSynergyRules = collectSelectedTeamSynergies();
  selectedTeamSynergyRules[index] = normalizeTeamSynergyRule({...selectedTeamSynergyRules[index], type, value:type === "role" ? ROLES[0] : factionsJson[0]});
  renderSelectedTeamSynergies();
}

async function saveSelectedTeam() {
  const team = getSelectedTeam();

  if (!team) {
    alert("저장할 팀을 선택해주세요.");
    return;
  }

  team.memberIds = [...new Set(selectedTeamMemberIds)].slice(0, MAX_PLAYER_SQUAD);
  team.activeMemberCount = Math.max(1, Math.min(team.memberIds.length || 1, Math.floor(Number(teamActiveMemberCountEl.value) || team.memberIds.length || 1)));
  team.battleRules = normalizeTeamBattleRules({
    damagePercent: teamDamagePercentEl.value,
    healingPercent: teamHealingPercentEl.value,
    resourceCostPercent: teamResourceCostPercentEl.value,
    cooldownPercent: teamCooldownPercentEl.value
  });
  team.synergyRules = collectSelectedTeamSynergies();

  try {
    await saveTeamJson();
    renderTeamPage();
    renderBattleTeamButtons();
    renderBattleEnemyControls();
  } catch (error) {
    logError("team", "팀 저장 처리 중 실패했습니다.", error);
    alert("팀 편성 데이터를 저장하지 못했습니다.");
  }
}

function createSquadFromCharacterIds(ids, side = "player", activeMemberCount = null) {
  const uniqueIds = [...new Set(ids)].filter(id => characterJson[id]).slice(0, MAX_PLAYER_SQUAD);
  const activeLimit = Math.max(1, Math.min(uniqueIds.length || 1, Math.floor(Number(activeMemberCount) || uniqueIds.length || 1)));
  return uniqueIds.map((id, index) => {
    const unit = createCharacter(characterJson[id], id, side);
    unit.startsInReserve = index >= activeLimit;
    unit.squadActiveLimit = activeLimit;
    unit.reserveOrder = index;
    return unit;
  });
}

function getSelectedBattleCharacterIds() {
  const ids = [];

  selectedBattleTeamIds.forEach(teamIndex => {
    ids.push(...getTeamCharacterIds(teamsJson[teamIndex]));
  });
  ids.push(...selectedBattleCharacterIds);

  return [...new Set(ids)].slice(0, MAX_PLAYER_SQUAD);
}

function rebuildPlayerSquadFromSelection() {
  const teamIndexes = [...selectedBattleTeamIds];
  const pureTeam = teamIndexes.length === 1 && selectedBattleCharacterIds.size === 0 ? teamsJson[teamIndexes[0]] : null;
  playerSquad = createSquadFromCharacterIds(getSelectedBattleCharacterIds(), "player", pureTeam?.activeMemberCount);
}

function renderBattleMemberList(title, members, emptyText = "선택 없음") {
  return `
    <section class="battle-selection-section">
      <div class="battle-selection-section-title">${escapeHtml(title)} <span>${members.length}명</span></div>
      ${members.length ? `
        <table class="battle-selection-table">
          <thead>
            <tr>
              <th>이름</th>
              <th>계열</th>
              <th>HP</th>
              <th>공격</th>
              <th>방어</th>
            </tr>
          </thead>
          <tbody>
            ${members.map(member => `
              <tr>
                <td>${escapeHtml(member.name ?? member.label ?? "")}</td>
                <td>${escapeHtml(getRoleLabel(member.role))}</td>
                <td>${Math.floor(Number(member.hp) || Number(member.maxHp) || 0)}</td>
                <td>${Number(member.atk) || 0} / ${Number(member.magic) || 0}</td>
                <td>${Number(member.defense) || 0} / ${Number(member.resistance) || 0}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      ` : `<div class="empty-text">${escapeHtml(emptyText)}</div>`}
    </section>
  `;
}

function getSelectedBattleTeamNames() {
  return [...selectedBattleTeamIds]
    .map(teamIndex => teamsJson[teamIndex]?.name)
    .filter(Boolean);
}

function getSelectedIndividualCharacters() {
  return [...selectedBattleCharacterIds]
    .filter(id => characterJson[id])
    .map(id => characterJson[id]);
}

function getSelectedPlayerCharacters() {
  return getSelectedBattleCharacterIds()
    .filter(id => characterJson[id])
    .map(id => characterJson[id]);
}

function renderBattleSelectionSummary() {
  if (!battleSelectionSummaryEl) {
    return;
  }

  const selectedTeamNames = getSelectedBattleTeamNames();
  const playerMembers = getSelectedPlayerCharacters();
  const individualMembers = getSelectedIndividualCharacters();
  const isTeamBattle = battleMode === "team";
  const enemyTeam = selectedEnemyTeamIndex !== "" ? teamsJson[Number(selectedEnemyTeamIndex)] : null;
  const enemyMembers = isTeamBattle
    ? getTeamCharacterIds(enemyTeam).map(id => characterJson[id]).filter(Boolean)
    : enemySquad;

  battleSelectionSummaryEl.innerHTML = `
    <div class="battle-selection-grid">
      <section class="battle-selection-section">
        <div class="battle-selection-section-title">아군 선택</div>
        <div class="battle-selection-meta">
          <div>팀: ${selectedTeamNames.length ? selectedTeamNames.map(escapeHtml).join(", ") : "선택 없음"}</div>
          <div>개별 선택: ${individualMembers.length ? individualMembers.map(member => escapeHtml(member.name)).join(", ") : "선택 없음"}</div>
          <div>합산 멤버: ${playerMembers.length} / ${MAX_PLAYER_SQUAD}</div>
        </div>
      </section>
      <section class="battle-selection-section">
        <div class="battle-selection-section-title">${isTeamBattle ? "상대 팀 선택" : "몬스터 선택"}</div>
        <div class="battle-selection-meta">
          ${isTeamBattle
            ? `<div>상대 팀: ${enemyTeam ? escapeHtml(enemyTeam.name) : "선택 없음"}</div>`
            : `<div>몬스터: ${enemyMembers.length ? enemyMembers.map(member => escapeHtml(member.name)).join(", ") : "선택 없음"}</div>`}
          <div>상대 멤버: ${enemyMembers.length}명</div>
        </div>
      </section>
    </div>
    <div class="battle-selection-grid">
      ${renderBattleMemberList("아군 멤버", playerMembers, "아군 팀 또는 캐릭터를 선택해주세요.")}
      ${renderBattleMemberList(isTeamBattle ? "상대 팀 멤버" : "몬스터 멤버", enemyMembers, isTeamBattle ? "상대 팀을 선택해주세요." : "몬스터를 추가해주세요.")}
    </div>
  `;
}

function renderBattleTeamButtons() {
  if (!battleTeamButtonsEl) {
    return;
  }

  battleTeamButtonsEl.innerHTML = teamsJson.length
    ? teamsJson.map((team, index) => `
      <button class="${selectedBattleTeamIds.has(index) ? "selected" : ""}" onclick="toggleBattleTeam(${index})">
        ${escapeHtml(team.name)} (${getTeamCharacterIds(team).length})
      </button>
    `).join("")
    : '<span class="empty-text">편성된 팀 없음</span>';
  renderBattleSelectionSummary();
}

function toggleBattleTeam(index) {
  if (selectedBattleTeamIds.has(index)) {
    selectedBattleTeamIds.delete(index);
  } else {
    const nextTeamIds = new Set(selectedBattleTeamIds);
    const nextIds = [];

    nextTeamIds.add(index);
    nextTeamIds.forEach(teamIndex => {
      nextIds.push(...getTeamCharacterIds(teamsJson[teamIndex]));
    });
    nextIds.push(...selectedBattleCharacterIds);

    if ([...new Set(nextIds)].length > MAX_PLAYER_SQUAD) {
      alert(`아군은 최대 ${MAX_PLAYER_SQUAD}명까지 선택할 수 있습니다.`);
      return;
    }
    selectedBattleTeamIds.add(index);
  }

  rebuildPlayerSquadFromSelection();
  renderBattleTeamButtons();
  initCharacters();
  renderBattleSelectionSummary();
  updateStatusUI();
}

function changeBattleMode(mode) {
  battleMode = mode === "team" ? "team" : "monster";
  enemySquad = [];
  selectedEnemyTeamIndex = "";
  renderBattleEnemyControls();
  renderBattleSelectionSummary();
  updateStatusUI();
}

function renderBattleEnemyControls() {
  if (!enemyButtonsEl) {
    return;
  }

  const isTeamBattle = battleMode === "team";
  enemyControlTitleEl.innerText = isTeamBattle ? "상대 팀" : "적 추가";
  enemyStatusTitleEl.innerText = isTeamBattle ? "상대 팀 상태" : "적 상태";

  if (!isTeamBattle) {
    if (typeof refreshMonsterUI === "function") {
      refreshMonsterUI();
    }
    return;
  }

  enemyButtonsEl.innerHTML = teamsJson.length
    ? teamsJson.map((team, index) => `
      <button class="${Number(selectedEnemyTeamIndex) === index ? "selected" : ""}" onclick="selectEnemyTeam(${index})">
        ${escapeHtml(team.name)} (${getTeamCharacterIds(team).length})
      </button>
    `).join("")
    : '<span class="empty-text">편성된 팀 없음</span>';
  renderBattleSelectionSummary();
}

function selectEnemyTeam(index) {
  selectedEnemyTeamIndex = index;
  enemySquad = createSquadFromCharacterIds(getTeamCharacterIds(teamsJson[index]), "enemy", teamsJson[index]?.activeMemberCount);
  renderBattleEnemyControls();
  renderBattleSelectionSummary();
  updateStatusUI();
}
