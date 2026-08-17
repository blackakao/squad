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

function renderCharacterTable() {
  const visibleCharacters = characterJson
    .map((character, index) => ({ character, index }))
    .filter(({ character }) => selectedCharacterRoleFilter === "all" || normalizeRole(character.role) === selectedCharacterRoleFilter);

  characterTableBodyEl.innerHTML = visibleCharacters.map(({ character, index }) => `
    <tr>
      <td><input type="checkbox" class="character-check" value="${index}"></td>
      <td>${renderPortraitCell(character.portrait, character.name)}</td>
      <td>${escapeHtml(character.faction ?? getDefaultFactionName())}</td>
      <td>${escapeHtml(getRoleLabel(character.role))}</td>
      <td>${escapeHtml(character.name)}</td>
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
  `).join("");
}

function changeCharacterRoleFilter(role) {
  selectedCharacterRoleFilter = role;
  renderCharacterTable();
}

function openCharacterModal(index = "") {
  const character = characterJson[index];

  characterModalTitleEl.innerText = character ? "캐릭터 수정" : "캐릭터 추가";
  characterEditIndexEl.value = character ? index : "";
  characterNameEl.value = character?.name ?? "";
  resetPortraitDraft("character", character?.portrait ?? "");
  characterRoleEl.value = character?.role ?? "melee";
  renderCharacterFactionOptions();
  characterFactionEl.value = character?.faction ?? getDefaultFactionName();
  characterModalEl.classList.remove("hidden");
}

function closeCharacterModal() {
  characterModalEl.classList.add("hidden");
  characterFormEl.reset();
  resetPortraitDraft("character");
}

async function saveCharacterFromForm(event) {
  event.preventDefault();

  const editIndex = characterEditIndexEl.value;
  const previousCharacter = editIndex !== "" ? characterJson[Number(editIndex)] : null;
  const previousAttributes = previousCharacter?.attributes ?? {};
  const character = applyCharacterStatAbilities({
    name: characterNameEl.value.trim(),
    role: characterRoleEl.value,
    faction: characterFactionEl.value,
    attributes: createCharacterAttributes(previousAttributes),
    portrait: await getPortraitForSave("character", previousCharacter?.portrait)
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

async function deleteSelectedCharacters() {
  const checkedIndexes = [...document.querySelectorAll(".character-check:checked")]
    .map(input => Number(input.value))
    .sort((a, b) => b - a);

  if (checkedIndexes.length === 0) {
    alert("삭제할 캐릭터를 선택해주세요.");
    return;
  }

  checkedIndexes.forEach(index => characterJson.splice(index, 1));
  playerSquad = [];
  enemySquad = [];
  selectedEnemyTeamIndex = "";
  selectedBattleCharacterIds.clear();
  selectedBattleTeamIds.clear();
  if (typeof syncTeamsAfterCharacterDeletion === "function") {
    syncTeamsAfterCharacterDeletion(checkedIndexes);
  }
  try {
    await saveCharacterJson();
    if (typeof saveTeamJson === "function") {
      await saveTeamJson();
    }
    refreshCharacterUI();
    if (typeof renderBattleTeamButtons === "function") {
      renderBattleTeamButtons();
      renderBattleEnemyControls();
    }
  } catch (error) {
    logError("character", "캐릭터 삭제 처리 중 실패했습니다.", error);
    alert("캐릭터 데이터를 저장하지 못했습니다.");
  }
}

function createCharacter(characterData, index, side = "player") {
  const derivedCharacter = applyCharacterStatAbilities(characterData);
  const equippedWeapon = getEquippedWeaponItemForCombat(derivedCharacter);
  const role = derivedCharacter.role;
  const fieldWidth = canvas.width || 400;
  const fieldHeight = canvas.height || 300;
  const x = side === "enemy"
    ? fieldWidth * (0.7 + Math.random() * 0.25)
    : fieldWidth * (Math.random() * 0.3);

  return {
    id: index,
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
    atk: derivedCharacter.atk,
    magic: derivedCharacter.magic,
    speed: derivedCharacter.speed,
    attackSpeed: derivedCharacter.attackSpeed,
    castSpeed: derivedCharacter.castSpeed,
    attackType: derivedCharacter.attackType,
    attackSkillId: equippedWeapon?.attackSkillId ?? "",
    defense: derivedCharacter.defense,
    resistance: derivedCharacter.resistance,
    attackRange: derivedCharacter.attackRange,
    attributes: derivedCharacter.attributes,
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
