function normalizeTeamJson(teams) {
  if (!Array.isArray(teams)) {
    return [];
  }

  return teams
    .map(team => {
      const memberIds = Array.isArray(team.memberIds) ? team.memberIds : [];

      return {
        name: String(team.name ?? "").trim(),
        memberIds: [...new Set(memberIds.map(id => Number(id)))]
          .filter(id => Number.isInteger(id) && characterJson[id])
          .slice(0, MAX_PLAYER_SQUAD)
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
    teamCharacterListEl.innerHTML = characterJson.map((character, index) => `
      <button class="team-character-button" onclick="alert('먼저 팀을 선택해주세요.')">
        ${escapeHtml(character.name)} (${escapeHtml(getRoleLabel(character.role))})
      </button>
    `).join("");
    return;
  }

  const selectedIds = new Set(selectedTeamMemberIds);
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
  renderTeamPage();
}

async function addTeamFromInput() {
  const name = teamNameEl.value.trim();

  if (!name) {
    alert("팀 이름을 입력해주세요.");
    return;
  }

  teamsJson.push({ name, memberIds: [] });
  selectedTeamIndex = teamsJson.length - 1;
  selectedTeamMemberIds = [];
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
  selectedTeamMemberIds = selectedTeamMemberIds.filter(id => id !== characterId);
  renderTeamEditor();
}

async function saveSelectedTeam() {
  const team = getSelectedTeam();

  if (!team) {
    alert("저장할 팀을 선택해주세요.");
    return;
  }

  team.memberIds = [...new Set(selectedTeamMemberIds)].slice(0, MAX_PLAYER_SQUAD);

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

function createSquadFromCharacterIds(ids, side = "player") {
  return [...new Set(ids)]
    .filter(id => characterJson[id])
    .slice(0, MAX_PLAYER_SQUAD)
    .map(id => createCharacter(characterJson[id], id, side));
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
  playerSquad = createSquadFromCharacterIds(getSelectedBattleCharacterIds(), "player");
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
  enemySquad = createSquadFromCharacterIds(getTeamCharacterIds(teamsJson[index]), "enemy");
  renderBattleEnemyControls();
  renderBattleSelectionSummary();
  updateStatusUI();
}
