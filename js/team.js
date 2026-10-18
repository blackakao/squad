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
  const pureSingleTeam = battleMode !== 'duel' && playerTeamIndexes.length === 1 && selectedBattleCharacterIds.size === 0;
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
        skillSelections: Object.fromEntries(Object.entries(team.skillSelections ?? {}).map(([characterId, selections]) => [characterId,
          Object.fromEntries(Object.entries(selections ?? {}).filter(([skillId, optionId]) => {
            const skill = getSkillById(skillId);
            return skill?.slot === "choice_team" && normalizeSkillChoice(skill.choice).options.some(option => option.id === String(optionId));
          }).map(([skillId, optionId]) => [String(skillId), String(optionId)]))])),
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
      .filter(id => characterJson[id]),
    skillSelections: Object.fromEntries(Object.entries(team.skillSelections ?? {}).flatMap(([rawId, selections]) => {
      const id = Number(rawId);
      if (!Number.isInteger(id) || deletedSet.has(id)) return [];
      const shifted = id - deletedIndexes.filter(deletedIndex => deletedIndex < id).length;
      return characterJson[shifted] ? [[shifted, selections]] : [];
    }))
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
      <button class="team-list-button ${selectedTeamIndex !== "" && Number(selectedTeamIndex) === index ? "selected" : ""}" onclick="selectTeamForEdit(${index})">
        ${escapeHtml(team.name)} (${getTeamCharacterIds(team).length}/${MAX_PLAYER_SQUAD})
      </button>
    `).join("")
    : '<span class="empty-text">편성된 팀 없음</span>';
}

function renderTeamCharacterIdentity(character) {
  return `<span class="team-character-identity"><span class="team-portrait">${renderPortraitCell(character.portrait,character.name)}</span><span><strong>${escapeHtml(character.name)}</strong><small>${escapeHtml(getRoleLabel(character.role))} · 개인 전투력 ${formatCombatPower(getCharacterCombatPower(character).total)}</small></span></span>`;
}

function renderTeamEditor() {
  endTeamCharacterDrag();
  const team = getSelectedTeam();
  const scrollTop = teamCharacterListEl.scrollTop;
  selectedTeamMemberIds = selectedTeamMemberIds.filter(id=>characterJson[id]);
  const selectedIds = new Set(team ? selectedTeamMemberIds : []);
  teamSelectedNameEl.textContent = team?.name || '팀을 선택하세요';
  teamMemberSummaryEl.textContent = `${selectedIds.size} / ${MAX_PLAYER_SQUAD}`;
  document.getElementById('teamSaveButton').disabled = !team;
  document.getElementById('teamCharacterCount').textContent = `${characterJson.length}명`;
  teamMemberListEl.innerHTML = selectedIds.size ? [...selectedIds].map(id=>`
    <div class="team-member-row" data-character-id="${id}">${renderTeamCharacterIdentity(characterJson[id])}
      ${renderTeamSkillChoices(id, team)}
      <button type="button" onclick="removeCharacterFromSelectedTeam(${id})" aria-label="${escapeHtml(characterJson[id].name)} 편성 제외">제외</button>
    </div>`).join('') : `<p class="empty-text">${team ? '팀원이 없습니다. 캐릭터를 여기에 놓아주세요.' : '상단에서 팀을 선택하거나 추가해주세요.'}</p>`;
  teamCharacterListEl.innerHTML = characterJson.map((character,id)=>`
    <button type="button" class="team-character-button ${selectedIds.has(id) ? 'selected' : ''}"
      data-character-id="${id}" draggable="${Boolean(team)}" aria-pressed="${selectedIds.has(id)}"
      onclick="toggleCharacterInSelectedTeam(${id})" ondragstart="startTeamCharacterDrag(event,${id})" ondragend="endTeamCharacterDrag()">
      ${renderTeamCharacterIdentity(character)}${selectedIds.has(id) ? '<span class="badge text-bg-secondary">편성 중</span>' : ''}
    </button>`).join('') || '<p class="empty-text">등록된 캐릭터가 없습니다.</p>';
  teamCharacterListEl.querySelectorAll('img').forEach(img=>{img.draggable=false;});
  teamCharacterListEl.scrollTop = scrollTop;
  if (typeof renderTeamSynergyPreview === 'function') renderTeamSynergyPreview();
  requestAnimationFrame(updateTeamWorkspaceHeight);
}

function getCharacterChoiceSkills(characterId, slot) {
  return (characterJson[characterId]?.skillIds ?? []).map(getSkillById).filter(skill => skill?.slot === slot && isSkillExecutable(skill));
}

function renderChoiceSelect(skill, selectedOptionId, onchange) {
  const choice = normalizeSkillChoice(skill.choice);
  const selected = getChoiceSkillOption(skill, selectedOptionId)?.id;
  return `<label class="team-skill-choice"><span>${escapeHtml(skill.name)}</span><select onchange="${onchange}">${choice.options.map(option =>
    `<option value="${escapeHtml(option.id)}" ${option.id === selected ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}</select></label>`;
}

function renderTeamSkillChoices(characterId, team) {
  const skills = getCharacterChoiceSkills(characterId, "choice_team");
  if (!skills.length) return "";
  return `<div class="team-skill-choices">${skills.map(skill => renderChoiceSelect(skill, team?.skillSelections?.[characterId]?.[skill.id],
    `setTeamSkillChoice(${characterId},'${escapeHtml(skill.id)}',this.value)`)).join("")}</div>`;
}

function setTeamSkillChoice(characterId, skillId, optionId) {
  const team = getSelectedTeam();
  if (!team) return;
  team.skillSelections ??= {};
  team.skillSelections[characterId] ??= {};
  team.skillSelections[characterId][skillId] = optionId;
  setTeamEditStatus("선택 스킬 설정이 변경되었습니다. 저장 버튼을 눌러주세요.");
}

function updateTeamWorkspaceHeight() {
  const page = document.getElementById('teamPage');
  if (!page || page.classList.contains('hidden')) return;
  const workspace = page.querySelector('.team-manager'), panel = page.querySelector('.panel');
  const bottom = parseFloat(getComputedStyle(page).paddingBottom) + parseFloat(getComputedStyle(panel).paddingBottom)
    + parseFloat(getComputedStyle(panel).borderBottomWidth) + parseFloat(getComputedStyle(panel).marginBottom);
  workspace.style.setProperty('--team-workspace-height',`${Math.max(0,innerHeight - (workspace.getBoundingClientRect().top + scrollY) - bottom)}px`);
}

function setTeamEditStatus(message) {
  document.getElementById('teamEditStatus').textContent = message;
}

function getTeamAssignmentError(id) {
  if (!getSelectedTeam()) return '먼저 팀을 선택해주세요.';
  if (!Number.isInteger(id) || !characterJson[id]) return '편성할 캐릭터를 찾을 수 없습니다.';
  if (selectedTeamMemberIds.includes(id)) return '이미 편성된 캐릭터입니다.';
  if (selectedTeamMemberIds.length >= MAX_PLAYER_SQUAD) return `팀에는 최대 ${MAX_PLAYER_SQUAD}명까지 편성할 수 있습니다.`;
  return '';
}

let teamCharacterDrag = null;
function startTeamCharacterDrag(event,id) {
  endTeamCharacterDrag();
  if (!getSelectedTeam() || !characterJson[id]) { event.preventDefault(); return; }
  const preview = event.currentTarget.querySelector('.team-character-identity').cloneNode(true);
  preview.classList.add('team-drag-preview');
  preview.querySelectorAll('small').forEach(el=>el.remove());
  document.body.appendChild(preview);
  teamCharacterDrag = {id,teamIndex:selectedTeamIndex,source:event.currentTarget,preview};
  event.dataTransfer.setData('application/x-squad-character',String(id));
  event.dataTransfer.effectAllowed = 'copy';
  event.dataTransfer.setDragImage(preview,22,22);
  event.currentTarget.classList.add('is-dragging');
  const error = getTeamAssignmentError(id);
  const target = document.getElementById('teamDropTarget');
  target.classList.add(error ? 'drop-blocked' : 'drop-allowed');
  setTeamEditStatus(error || '현재 팀 편성 영역에 놓아주세요.');
}

function allowTeamCharacterDrop(event) {
  if (!teamCharacterDrag) return;
  const allowed = teamCharacterDrag.teamIndex === selectedTeamIndex && !getTeamAssignmentError(teamCharacterDrag.id);
  if (allowed) event.preventDefault();
  event.dataTransfer.dropEffect = allowed ? 'copy' : 'none';
  event.currentTarget.classList.toggle('drop-hover',allowed);
}

function leaveTeamCharacterDrop(event) {
  if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.classList.remove('drop-hover');
}

function dropTeamCharacter(event) {
  event.preventDefault();
  const drag = teamCharacterDrag;
  const validPayload = drag && event.dataTransfer.getData('application/x-squad-character') === String(drag.id);
  endTeamCharacterDrag();
  if (!validPayload || drag.teamIndex !== selectedTeamIndex) return;
  const error = getTeamAssignmentError(drag.id);
  if (error) { setTeamEditStatus(error); return; }
  toggleCharacterInSelectedTeam(drag.id);
}

function endTeamCharacterDrag() {
  if (!teamCharacterDrag) return;
  teamCharacterDrag.preview.remove();
  teamCharacterDrag.source.classList.remove('is-dragging');
  teamCharacterDrag = null;
  document.getElementById('teamDropTarget')?.classList.remove('drop-allowed','drop-blocked','drop-hover');
  setTeamEditStatus('');
}

if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  window.addEventListener('resize',updateTeamWorkspaceHeight);
  document.addEventListener('dragend',endTeamCharacterDrag);
  document.addEventListener('drop',endTeamCharacterDrag);
  document.addEventListener('keydown',event=>{if(event.key==='Escape') endTeamCharacterDrag();});
  document.addEventListener('DOMContentLoaded',()=>{
    const observer = new ResizeObserver(()=>requestAnimationFrame(updateTeamWorkspaceHeight));
    for (const el of document.querySelectorAll('.nav, body > h2, #teamPage .team-list-panel')) observer.observe(el);
  });
}

function selectTeamForEdit(index) {
  endTeamCharacterDrag();
  setTeamEditStatus('');
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

  teamsJson.push({ name, memberIds: [], activeMemberCount: 1, battleRules: normalizeTeamBattleRules(), synergyRules: [] });
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
  } else {
    const error = getTeamAssignmentError(characterId);
    if (error) { setTeamEditStatus(error); return; }
    selectedTeamMemberIds.push(characterId);
  }

  renderTeamEditor();
  setTeamEditStatus('편성이 변경되었습니다. 저장 버튼을 눌러주세요.');
}

function removeCharacterFromSelectedTeam(characterId) {
  selectedTeamMemberIds = selectedTeamMemberIds.filter(id => id !== characterId);
  renderTeamEditor();
  setTeamEditStatus('편성이 변경되었습니다. 저장 버튼을 눌러주세요.');
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
    setTeamEditStatus('팀 편성을 저장했습니다.');
  } catch (error) {
    logError("team", "팀 저장 처리 중 실패했습니다.", error);
    alert("팀 편성 데이터를 저장하지 못했습니다.");
  }
}

function createSquadFromCharacterIds(ids, side = "player", activeMemberCount = null, skillSelections = {}) {
  const uniqueIds = [...new Set(ids)].filter(id => characterJson[id]).slice(0, MAX_PLAYER_SQUAD);
  const activeLimit = Math.max(1, Math.min(uniqueIds.length || 1, Math.floor(Number(activeMemberCount) || uniqueIds.length || 1)));
  const evaluation = typeof evaluateSynergies === "function" ? evaluateSynergies(uniqueIds.map(id => characterJson[id])) : null;
  return uniqueIds.map((id, index) => {
    const unit = createCharacter(characterJson[id], id, side, evaluation?.modifiers[index]);
    unit.skillSelections = {...(skillSelections[id] ?? {})};
    unit.synergySources = evaluation?.sources[index] || [];
    unit.startsInReserve = index >= activeLimit;
    unit.squadActiveLimit = activeLimit;
    unit.reserveOrder = index;
    return unit;
  });
}

function getSelectedBattleCharacterIds() {
  if (battleMode === 'duel') return getDuelCharacterIds('player');
  const ids = [];

  selectedBattleTeamIds.forEach(teamIndex => {
    ids.push(...getTeamCharacterIds(teamsJson[teamIndex]));
  });
  ids.push(...selectedBattleCharacterIds);

  return [...new Set(ids)].slice(0, MAX_PLAYER_SQUAD);
}

function rebuildPlayerSquadFromSelection() {
  if (battleMode === 'duel') {
    playerSquad = createDuelSquad('player');
    return;
  }
  const teamIndexes = [...selectedBattleTeamIds];
  const pureTeam = teamIndexes.length === 1 && selectedBattleCharacterIds.size === 0 ? teamsJson[teamIndexes[0]] : null;
  const selections = {};
  getSelectedBattleCharacterIds().forEach(id => {
    const teamSelections = teamIndexes.map(index => teamsJson[index]?.skillSelections?.[id]).find(Boolean) ?? {};
    selections[id] = {...teamSelections, ...(selectedPreBattleSkillChoices[id] ?? {})};
  });
  playerSquad = createSquadFromCharacterIds(getSelectedBattleCharacterIds(), "player", pureTeam?.activeMemberCount, selections);
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
                <td>${renderCategoryIcon("role", normalizeRole(member.role), getRoleLabel(member.role))}</td>
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
  if (battleMode === 'duel') {
    battleSelectionSummaryEl.innerHTML = `<p>양쪽에서 한 명씩 선택해 1:1 대결을 시작하세요. 같은 캐릭터끼리도 대결할 수 있습니다.</p><div class="battle-selection-grid">${['player','enemy'].map(side => renderBattleMemberList(side === 'player' ? '아군 캐릭터' : '상대 캐릭터', getDuelCharacterIds(side).map(id=>characterJson[id]), '캐릭터를 선택해주세요.')).join('')}</div>${renderDuelSkillChoices()}`;
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
    ${renderPreBattleSkillChoices()}
  `;
}

function renderPreBattleSkillChoices() {
  const rows = getSelectedBattleCharacterIds().flatMap(characterId => getCharacterChoiceSkills(characterId, "choice_prebattle").map(skill => ({characterId,skill})));
  if (!rows.length) return "";
  return `<section class="battle-selection-section"><div class="battle-selection-section-title">전투 직전 선택 스킬 <span>${rows.length}개</span></div>
    <div class="battle-skill-choice-list">${rows.map(({characterId,skill}) => {
      const choice = normalizeSkillChoice(skill.choice);
      const selected = getChoiceSkillOption(skill, selectedPreBattleSkillChoices[characterId]?.[skill.id])?.id;
      return `<label class="battle-skill-choice-row"><span>${escapeHtml(characterJson[characterId].name)} · ${escapeHtml(skill.name)}</span><select onchange="setPreBattleSkillChoice(${characterId},'${escapeHtml(skill.id)}',this.value)">${choice.options.map(option =>
        `<option value="${escapeHtml(option.id)}" ${option.id === selected ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}</select></label>`;
    }).join("")}</div></section>`;
}

function setPreBattleSkillChoice(characterId, skillId, optionId) {
  selectedPreBattleSkillChoices[characterId] ??= {};
  selectedPreBattleSkillChoices[characterId][skillId] = optionId;
  rebuildPlayerSquadFromSelection();
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
  if (battleMode === 'duel') return;
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
  if (isBattleRunning) { document.querySelectorAll('input[name="battleMode"]').forEach(el=>{el.checked=el.value===battleMode;}); return; }
  battleMode = ['team','duel'].includes(mode) ? mode : 'monster';
  enemySquad = battleMode === 'duel' ? createDuelSquad('enemy') : [];
  selectedEnemyTeamIndex = "";
  rebuildPlayerSquadFromSelection();
  renderBattleEnemyControls();
  renderBattleSelectionSummary();
  updateStatusUI();
}

function renderBattleEnemyControls() {
  if (!enemyButtonsEl) {
    return;
  }
  const duel = battleMode === 'duel';
  document.getElementById('battleGroupSelection')?.classList.toggle('hidden',duel);
  document.getElementById('battleDuelPlayer')?.classList.toggle('hidden',!duel);
  if (duel) {
    document.getElementById('battleDuelPlayer').innerHTML = renderDuelPicker('player');
    enemyControlTitleEl.innerText = '상대 캐릭터';
    enemyStatusTitleEl.innerText = '상대 캐릭터 상태';
    enemyButtonsEl.innerHTML = renderDuelPicker('enemy');
    renderBattleSelectionSummary();
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
  if (battleMode !== 'team') return;
  selectedEnemyTeamIndex = index;
  enemySquad = createSquadFromCharacterIds(getTeamCharacterIds(teamsJson[index]), "enemy", teamsJson[index]?.activeMemberCount);
  renderBattleEnemyControls();
  renderBattleSelectionSummary();
  updateStatusUI();
}

function getDuelCharacterIds(side) {
  const id = duelCharacterIds[side];
  return Number.isInteger(id) && characterJson[id] ? [id] : [];
}

function createDuelSquad(side) {
  const ids = getDuelCharacterIds(side);
  return createSquadFromCharacterIds(ids,side,1,ids.length ? {[ids[0]]:duelSkillChoices[side]} : {});
}

function renderDuelPicker(side) {
  const label = side === 'player' ? '아군 캐릭터' : '상대 캐릭터';
  return `<div id="duel-${side}" class="duel-character-buttons" role="group" aria-label="${label} 선택">${characterJson.map((character,id)=>{
    const selected = duelCharacterIds[side] === id;
    return `<button type="button" class="duel-character-button ${selected ? 'selected' : ''}" data-character-id="${id}" aria-pressed="${selected}" onclick="selectDuelCharacter('${side}',${id})">${renderBattleCharacterButtonContent(character)}</button>`;
  }).join('') || '<p class="empty-text">등록된 캐릭터가 없습니다.</p>'}</div>`;
}

function selectDuelCharacter(side,value) {
  if (isBattleRunning || battleMode !== 'duel' || !['player','enemy'].includes(side)) return;
  const id = value === '' ? '' : Number(value);
  duelCharacterIds[side] = Number.isInteger(id) && characterJson[id] ? id : '';
  document.querySelectorAll(`#duel-${side} [data-character-id]`).forEach(button => {
    const selected = Number(button.dataset.characterId) === duelCharacterIds[side];
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  duelSkillChoices[side] = {};
  playerSquad = createDuelSquad('player');
  enemySquad = createDuelSquad('enemy');
  renderBattleSelectionSummary();
  updateStatusUI();
}

function renderDuelSkillChoices() {
  return ['player','enemy'].map(side=>getDuelCharacterIds(side).map(id=>{
    const skills = ['choice_team','choice_prebattle'].flatMap(slot=>getCharacterChoiceSkills(id,slot));
    if (!skills.length) return '';
    return `<section class="battle-selection-section"><h5>${side==='player' ? '아군' : '상대'} 선택 스킬</h5>${skills.map(skill=>{
      const selected=getChoiceSkillOption(skill,duelSkillChoices[side][skill.id])?.id;
      return `<label class="battle-skill-choice-row">${escapeHtml(skill.name)}<select onchange="setDuelSkillChoice('${side}','${escapeHtml(skill.id)}',this.value)">${normalizeSkillChoice(skill.choice).options.map(option=>`<option value="${escapeHtml(option.id)}" ${selected===option.id?'selected':''}>${escapeHtml(option.label)}</option>`).join('')}</select></label>`;
    }).join('')}</section>`;
  }).join('')).join('');
}

function setDuelSkillChoice(side,skillId,optionId) {
  if (isBattleRunning || !['player','enemy'].includes(side)) return;
  duelSkillChoices[side][skillId]=optionId;
  playerSquad=createDuelSquad('player');
  enemySquad=createDuelSquad('enemy');
}
