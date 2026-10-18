async function loadCharacterJson() {
  const defaults = createDefaultCharacterJson();
  const rawJson = await loadJsonFile("characters", defaults);
  characterJson = normalizeCombatJson(rawJson, defaults, "name");
  ensureCharacterFactions();
}

async function saveCharacterJson() {
  await saveJsonFile("characters", characterJson);
  log("캐릭터 데이터가 저장되었습니다.");
}

function refreshCharacterUI() {
  renderCharacterTable();
  initCharacters();
  updateStatusUI();
}

const CHARACTER_TABLE_COLUMNS = [
  ['name', '이름'], ['role', '계열'], ['faction', '진영'],
  ['combatPower', '종합전투력'], ['hp', 'HP'], ['mp', 'MP'], ['st', 'ST'], ['atk', '공격력'], ['magic', '마력'],
  ['speed', '이동속도'], ['attackSpeed', '공격속도'], ['castSpeed', '시전속도'],
  ['defense', '방어력'], ['resistance', '저항력'], ['attackRange', '사정거리']
];
let characterTableSort = { key: '', direction: 'asc' };
const characterNameCollator = new Intl.Collator('ko', { numeric: true, sensitivity: 'base' });
let characterDeletePending = false;

function characterSortValue(character, key) {
  if (key === 'combatPower') return getCharacterCombatPower(character).total;
  if (key === 'name') return String(character.name ?? '');
  if (key === 'role' || key === 'faction') {
    const value = key === 'role' ? normalizeRole(character.role) : character.faction ?? getDefaultFactionName();
    return iconMappings.find(mapping => mapping.group === key && mapping.key === value)?.label
      || (key === 'role' ? getRoleLabel(value) : value);
  }
  const value = Number(character[key]);
  return Number.isFinite(value) ? value : 0;
}

function sortCharacterTable(key) {
  if (!CHARACTER_TABLE_COLUMNS.some(([column]) => column === key)) return;
  characterTableSort = { key, direction: characterTableSort.key === key && characterTableSort.direction === 'asc' ? 'desc' : 'asc' };
  renderCharacterTable();
}

function renderCharacterTable() {
  const header = document.getElementById('characterTableHeader');
  if (!header.children.length) {
    header.innerHTML = CHARACTER_TABLE_COLUMNS.map(([key, label]) => `<th scope="col" data-sort-key="${key}" onclick="sortCharacterTable('${key}')"><button type="button" class="character-sort-button" title="${label}: 클릭하여 정렬">${label}<span class="character-sort-direction" aria-hidden="true"></span></button></th>`).join('') + '<th scope="col">수정</th>';
  }
  header.querySelectorAll('[data-sort-key]').forEach(th => {
    const active = th.dataset.sortKey === characterTableSort.key;
    th.setAttribute('aria-sort', active ? (characterTableSort.direction === 'asc' ? 'ascending' : 'descending') : 'none');
    th.querySelector('.character-sort-direction').textContent = active ? (characterTableSort.direction === 'asc' ? ' ↑' : ' ↓') : '';
  });
  const visibleCharacters = characterJson
    .map((character, index) => ({ character, index }))
    .filter(({ character }) => selectedCharacterRoleFilter === "all" || normalizeRole(character.role) === selectedCharacterRoleFilter);

  if (characterTableSort.key) {
    const { key, direction } = characterTableSort;
    visibleCharacters.sort((a, b) => {
      const left = characterSortValue(a.character, key);
      const right = characterSortValue(b.character, key);
      const comparison = typeof left === 'number' ? left - right : characterNameCollator.compare(left, right);
      return comparison * (direction === 'asc' ? 1 : -1) || a.index - b.index;
    });
  }

  characterTableBodyEl.innerHTML = visibleCharacters.map(({ character, index }) => `
    <tr data-character-index="${index}">
      <td><div class="character-identity"><span class="character-portrait">${renderPortraitCell(character.portrait, character.name)}</span><span class="character-name">${escapeHtml(character.name)}</span></div></td>
      <td>${renderCategoryIcon("role", normalizeRole(character.role), getRoleLabel(character.role))}</td>
      <td>${renderCategoryIcon("faction", character.faction ?? getDefaultFactionName(), character.faction ?? getDefaultFactionName())}</td>
      <td data-cp="total" title="${COMBAT_POWER_TOOLTIP}">${formatCombatPower(getCharacterCombatPower(character).total)}</td>
      <td>${character.hp}</td>
      <td>${character.mp}</td>
      <td>${character.st}</td>
      <td>${character.atk}</td>
      <td>${character.magic}</td>
      <td>${character.speed}</td>
      <td>${character.attackSpeed}</td>
      <td>${character.castSpeed}</td>
      <td>${character.defense}</td>
      <td>${character.resistance}</td>
      <td>${character.attackRange}</td>
      <td><button onclick="openCharacterModal(${index})">수정</button></td>
    </tr>
  `).join("") || '<tr><td colspan="16" class="character-empty">조건에 맞는 캐릭터가 없습니다.</td></tr>';
}

function changeCharacterRoleFilter(role) {
  selectedCharacterRoleFilter = role;
  renderCharacterTable();
}

function openCharacterModal(index = "") {
  if (characterDeletePending) return;
  const character = characterJson[index];

  characterModalTitleEl.innerText = character ? "캐릭터 수정" : "캐릭터 추가";
  characterEditIndexEl.value = character ? index : "";
  document.getElementById('characterDeleteButton').classList.toggle('hidden', !character);
  characterNameEl.value = character?.name ?? "";
  resetPortraitDraft("character", character?.portrait ?? "");
  resetPortraitAppearance(character?.appearance);
  characterRoleEl.value = character?.role ?? "melee";
  renderCharacterFactionOptions();
  characterFactionEl.value = character?.faction ?? getDefaultFactionName();
  renderCharacterSkillPicker(character?.skillIds ?? []);
  const equipmentRules = normalizeEquipmentRules(character?.equipmentRules);
  characterExtraWeaponSlotsEl.value = equipmentRules.extraWeaponSlots;
  characterTwoHandSingleSlotEl.checked = equipmentRules.twoHandSingleSlot;
  characterSameTargetWeaponPenaltyEl.value = equipmentRules.sameTargetWeaponPenaltyPercent;
  const battleRules = normalizeBattleRules(character?.battleRules);
  characterEntryDelayEl.value = battleRules.entryDelay;
  characterReviveCountEl.value = battleRules.reviveCount;
  characterReviveDelayEl.value = battleRules.reviveDelay;
  characterReviveHpPercentEl.value = battleRules.reviveHpPercent;
  characterReviveMpPercentEl.value = battleRules.reviveMpPercent;
  characterReviveStPercentEl.value = battleRules.reviveStPercent;
  characterReviveInvulnerableEl.value = battleRules.reviveInvulnerable;
  characterRevivePositionEl.value = battleRules.revivePosition;
  renderCustomResourceEditor(characterCustomResourcesEl, character?.customResources);
  characterModalEl.classList.remove("hidden");
}

function closeCharacterModal() {
  if (characterDeletePending) return;
  characterModalEl.classList.add("hidden");
  characterFormEl.reset();
  resetPortraitDraft("character");
  resetPortraitAppearance();
}

async function saveCharacterFromForm(event) {
  event.preventDefault();
  if (characterDeletePending) return;

  const editIndex = characterEditIndexEl.value;
  const previousCharacter = editIndex !== "" ? characterJson[Number(editIndex)] : null;
  const previousAttributes = previousCharacter?.attributes ?? {};
  const character = applyCharacterStatAbilities({
    name: characterNameEl.value.trim(),
    role: characterRoleEl.value,
    faction: characterFactionEl.value,
    skillIds: [...characterSkillsEl.querySelectorAll('input[type="checkbox"]:checked')].map(input => input.value),
    equipmentRules: normalizeEquipmentRules({
      extraWeaponSlots: characterExtraWeaponSlotsEl.value,
      twoHandSingleSlot: characterTwoHandSingleSlotEl.checked,
      sameTargetWeaponPenaltyPercent: characterSameTargetWeaponPenaltyEl.value
    }),
    battleRules: normalizeBattleRules({
      entryDelay: characterEntryDelayEl.value,
      reviveCount: characterReviveCountEl.value,
      reviveDelay: characterReviveDelayEl.value,
      reviveHpPercent: characterReviveHpPercentEl.value,
      reviveMpPercent: characterReviveMpPercentEl.value,
      reviveStPercent: characterReviveStPercentEl.value,
      reviveInvulnerable: characterReviveInvulnerableEl.value,
      revivePosition: characterRevivePositionEl.value
    }),
    customResources: readCustomResourcesFromEditor(characterCustomResourcesEl),
    attributes: createCharacterAttributes(previousAttributes),
    equipment: previousCharacter?.equipment,
    equipmentSets: previousCharacter?.equipmentSets,
    activeEquipmentSet: previousCharacter?.activeEquipmentSet,
    portrait: await getPortraitForSave("character", previousCharacter?.portrait, characterNameEl.value.trim()),
    ...(portraitAppearanceDraft ? { appearance: { ...portraitAppearanceDraft } } : {})
  });

  if (!character.name || !character.faction || !ROLES.includes(character.role)) {
    alert("캐릭터 정보를 올바르게 입력해주세요.");
    return;
  }

  if (editIndex !== "") {
    characterJson[Number(editIndex)] = character;
  } else {
    characterJson.push(character);
  }

  playerSquad = [];
  try {
    await saveCharacterJson();
    refreshCharacterUI();
    closeCharacterModal();
  } catch (error) {
    logError("character", "캐릭터 저장 처리 중 실패했습니다.", error);
    alert("캐릭터 데이터를 저장하지 못했습니다.");
  }
}

function renderCharacterSkillPicker(selectedSkillIds = null) {
  if (!characterSkillsEl) return;
  const classSkills = typeof getSkillsForClass === "function" ? getSkillsForClass(characterNameEl.value.trim()) : [];
  const selected = new Set(selectedSkillIds ?? [...characterSkillsEl.querySelectorAll('input[type="checkbox"]:checked')].map(input => input.value));
  characterSkillsEl.innerHTML = classSkills.map(skill => `
    <label class="character-skill-option">
      <input type="checkbox" value="${escapeHtml(skill.id)}" ${selected.has(skill.id) ? "checked" : ""}>
      ${recordImagePath(skill.icon) ? `<img src="${escapeHtml(skill.icon)}" alt="" onerror="this.hidden=true">` : `<span class="character-skill-placeholder">${escapeHtml(getSkillShortName(skill).slice(0, 1) || "S")}</span>`}
      <span><strong>${escapeHtml(getSkillShortName(skill))}</strong><small>${escapeHtml(getSkillSlotLabel(skill.slot))}</small></span>
    </label>`).join("") || '<div class="empty-text">이 클래스에 등록된 스킬이 없습니다.</div>';
}

function refreshCharacterSkillPicker(selectAll = false) {
  const classSkills = typeof getSkillsForClass === "function" ? getSkillsForClass(characterNameEl.value.trim()) : [];
  renderCharacterSkillPicker(selectAll ? classSkills.map(skill => skill.id) : null);
}

async function deleteCharacterFromModal() {
  if (characterDeletePending || characterEditIndexEl.value === '') return;
  const index = Number(characterEditIndexEl.value);
  const character = characterJson[index];
  if (!character || !window.confirm(`"${character.name}" 캐릭터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
  const deletedIndexes = [index];
  const previousCharacters = [...characterJson];
  const previousTeams = teamsJson;
  const previousTeamSelection = selectedTeamMemberIds;
  let characterSaved = false;
  characterDeletePending = true;
  characterFormEl.querySelectorAll('.character-modal-actions button').forEach(button => { button.disabled = true; });

  characterJson.splice(index, 1);
  playerSquad = [];
  enemySquad = [];
  selectedEnemyTeamIndex = "";
  selectedBattleCharacterIds.clear();
  selectedBattleTeamIds.clear();
  if (typeof syncTeamsAfterCharacterDeletion === "function") {
    syncTeamsAfterCharacterDeletion(deletedIndexes);
  }
  try {
    await saveCharacterJson();
    characterSaved = true;
    if (typeof saveTeamJson === "function") {
      await saveTeamJson();
    }
  } catch (error) {
    if (!characterSaved) {
      characterJson = previousCharacters;
      teamsJson = previousTeams;
      selectedTeamMemberIds = previousTeamSelection;
    }
    logError("character", "캐릭터 삭제 처리 중 실패했습니다.", error);
    alert(characterSaved ? "캐릭터는 삭제됐지만 팀 편성 저장에 실패했습니다. 팀 편성을 확인하고 다시 저장해주세요." : "캐릭터 데이터를 저장하지 못했습니다. 다시 시도해주세요.");
  } finally {
    characterDeletePending = false;
    characterFormEl.querySelectorAll('.character-modal-actions button').forEach(button => { button.disabled = false; });
    if (characterSaved) {
      refreshCharacterUI();
      if (typeof renderBattleTeamButtons === 'function') {
        renderBattleTeamButtons();
        renderBattleEnemyControls();
      }
      closeCharacterModal();
    }
  }
}

function createCharacter(characterData, index, side = "player", synergyModifiers = null) {
  const originalData = characterData;
  if (synergyModifiers) characterData = {...characterData, runtimeSynergyModifiers:synergyModifiers};
  const derivedCharacter = applyCharacterStatAbilities(characterData);
  const unequippedCharacter = applyCharacterStatAbilities({...characterData,equipment:{}});
  const equipmentLoadouts = normalizeEquipmentSets(derivedCharacter).map(set => {
    const equipped = applyCharacterStatAbilities({...derivedCharacter,equipment:set.equipment});
    const weapon = getEquippedWeaponItemForCombat(equipped);
    return {name:set.name,attributes:getCharacterEffectiveAttributes(equipped),itemSkillModifiers:getCharacterItemSkillModifiers(equipped),maxHp:equipped.hp,maxMp:equipped.mp,maxSt:equipped.st,baseBp:Math.max(0,Number(equipped.bp)||0),
      atk:equipped.atk,magic:equipped.magic,speed:equipped.speed,attackSpeed:equipped.attackSpeed,castSpeed:equipped.castSpeed,
      defense:equipped.defense,resistance:equipped.resistance,attackRange:equipped.attackRange,attackType:equipped.attackType,
      attackSkillId:weapon?.attackSkillId ?? "",weaponAttacks:getCharacterWeaponAttacks(equipped),
      sameTargetWeaponPenaltyPercent:equipped.equipmentRules.sameTargetWeaponPenaltyPercent,
      withoutEquipment:{name:`${set.name} (장비 효과 무효)`,attributes:getCharacterEffectiveAttributes(unequippedCharacter),itemSkillModifiers:[],maxHp:unequippedCharacter.hp,maxMp:unequippedCharacter.mp,maxSt:unequippedCharacter.st,baseBp:Math.max(0,Number(unequippedCharacter.bp)||0),
        atk:unequippedCharacter.atk,magic:unequippedCharacter.magic,speed:unequippedCharacter.speed,attackSpeed:unequippedCharacter.attackSpeed,castSpeed:unequippedCharacter.castSpeed,
        defense:unequippedCharacter.defense,resistance:unequippedCharacter.resistance,attackRange:unequippedCharacter.attackRange,attackType:unequippedCharacter.attackType,
        attackSkillId:"",weaponAttacks:[],sameTargetWeaponPenaltyPercent:0}};
  });
  if (synergyModifiers && Object.keys(synergyModifiers).length) {
    const plain = createCharacter(originalData, index, side);
    equipmentLoadouts.forEach((loadout, i) => { loadout.withoutSynergy = plain.equipmentLoadouts[i]; });
  }
  const equippedWeapon = getEquippedWeaponItemForCombat(derivedCharacter);
  const role = derivedCharacter.role;
  const fieldWidth = canvas.width || 400;
  const fieldHeight = canvas.height || 300;
  const x = side === "enemy"
    ? fieldWidth * (0.7 + Math.random() * 0.25)
    : fieldWidth * (Math.random() * 0.3);

  return {
    id: index,
    side,
    role,
    name: derivedCharacter.name,
    hp: derivedCharacter.hp,
    maxHp: derivedCharacter.hp,
    mp: derivedCharacter.mp,
    maxMp: derivedCharacter.mp,
    st: derivedCharacter.st,
    maxSt: derivedCharacter.st,
    bp: Math.max(0, Number(derivedCharacter.bp) || 0),
    baseBp: Math.max(0, Number(derivedCharacter.bp) || 0),
    maxBp: Math.max(0, Number(derivedCharacter.bp) || 0),
    customResources: createBattleCustomResources(derivedCharacter.customResources),
    battleRules: normalizeBattleRules(derivedCharacter.battleRules),
    atk: derivedCharacter.atk,
    magic: derivedCharacter.magic,
    speed: derivedCharacter.speed,
    attackSpeed: derivedCharacter.attackSpeed,
    castSpeed: derivedCharacter.castSpeed,
    attackType: derivedCharacter.attackType,
    attackSkillId: equippedWeapon?.attackSkillId ?? "",
    weaponAttacks: getCharacterWeaponAttacks(derivedCharacter),
    sameTargetWeaponPenaltyPercent: derivedCharacter.equipmentRules.sameTargetWeaponPenaltyPercent,
    equipmentLoadouts,
    activeEquipmentSet: derivedCharacter.activeEquipmentSet ?? 0,
    skillIds: Array.isArray(derivedCharacter.skillIds) ? derivedCharacter.skillIds : [],
    skillCooldowns: {},
    defense: derivedCharacter.defense,
    resistance: derivedCharacter.resistance,
    attackRange: derivedCharacter.attackRange,
    attributes: getCharacterEffectiveAttributes(derivedCharacter),
    itemSkillModifiers: getCharacterItemSkillModifiers(derivedCharacter),
    faction: derivedCharacter.faction ?? getDefaultFactionName(),
    portrait: derivedCharacter.portrait,
    x,
    y: Math.random() * fieldHeight,
    vx: 0,
    vy: 0,
    attackCooldown: 0,
    alive: true,
    stats: createStats(),
    effectType: null,
    effectTimer: 0
  };
}

function initCharacters() {
  charactersEl.innerHTML = "";
  allCharacters = [];

  characterJson.forEach((characterData, index) => {
    const character = createCharacter(characterData, index);
    const button = document.createElement("button");

    allCharacters.push(character);
    button.innerText = character.name;
    button.onclick = () => toggleSelect(character.id);
    button.style.background = selectedBattleCharacterIds.has(character.id) ? "lightblue" : "";

    charactersEl.appendChild(button);
  });
}

function toggleSelect(characterId) {
  if (selectedBattleCharacterIds.has(characterId)) {
    selectedBattleCharacterIds.delete(characterId);
  } else {
    const nextIds = getSelectedBattleCharacterIds();
    if (!nextIds.includes(characterId) && nextIds.length >= MAX_PLAYER_SQUAD) {
      alert(`아군은 최대 ${MAX_PLAYER_SQUAD}명까지 선택할 수 있습니다.`);
      return;
    }
    selectedBattleCharacterIds.add(characterId);
  }

  rebuildPlayerSquadFromSelection();
  initCharacters();
  renderBattleSelectionSummary();
  updateStatusUI();
}
