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
  characterTableBodyEl.innerHTML = characterJson.map((character, index) => `
    <tr>
      <td><input type="checkbox" class="character-check" value="${index}"></td>
      <td>${escapeHtml(character.faction ?? getDefaultFactionName())}</td>
      <td>${escapeHtml(getRoleLabel(character.role))}</td>
      <td>${escapeHtml(character.name)}</td>
      <td>${character.hp}</td>
      <td>${character.atk}</td>
      <td>${character.magic}</td>
      <td>${character.speed}</td>
      <td>${character.attackSpeed}</td>
      <td>${character.defense}</td>
      <td>${character.resistance}</td>
      <td>${character.attackRange}</td>
      <td><button onclick="openCharacterModal(${index})">수정</button></td>
    </tr>
  `).join("");
}

function openCharacterModal(index = "") {
  const character = characterJson[index];

  characterModalTitleEl.innerText = character ? "캐릭터 수정" : "캐릭터 추가";
  characterEditIndexEl.value = character ? index : "";
  characterNameEl.value = character?.name ?? "";
  characterHpEl.value = character?.hp ?? 100;
  characterAtkEl.value = character?.atk ?? 10;
  characterMagicEl.value = character?.magic ?? getDefaultAbility(character?.role ?? "melee", "magic");
  characterSpeedEl.value = character?.speed ?? 1;
  characterAttackSpeedEl.value = character?.attackSpeed ?? getDefaultAbility(character?.role ?? "melee", "attackSpeed");
  characterDefenseEl.value = character?.defense ?? getDefaultAbility(character?.role ?? "melee", "defense");
  characterResistanceEl.value = character?.resistance ?? getDefaultAbility(character?.role ?? "melee", "resistance");
  characterAttackRangeEl.value = character?.attackRange ?? getDefaultAbility(character?.role ?? "melee", "attackRange");
  characterRoleEl.value = character?.role ?? "melee";
  renderCharacterFactionOptions();
  characterFactionEl.value = character?.faction ?? getDefaultFactionName();
  characterModalEl.classList.remove("hidden");
}

function closeCharacterModal() {
  characterModalEl.classList.add("hidden");
  characterFormEl.reset();
}

async function saveCharacterFromForm(event) {
  event.preventDefault();

  const editIndex = characterEditIndexEl.value;
  const previousAttributes = editIndex !== "" ? characterJson[Number(editIndex)]?.attributes : {};
  const character = {
    name: characterNameEl.value.trim(),
    hp: Number(characterHpEl.value),
    atk: Number(characterAtkEl.value),
    magic: Number(characterMagicEl.value),
    speed: Number(characterSpeedEl.value),
    attackSpeed: Number(characterAttackSpeedEl.value),
    defense: Number(characterDefenseEl.value),
    resistance: Number(characterResistanceEl.value),
    attackRange: Number(characterAttackRangeEl.value),
    role: characterRoleEl.value,
    faction: characterFactionEl.value,
    attributes: createCharacterAttributes(previousAttributes)
  };

  if (!character.name || !character.faction || character.hp < 1 || character.atk < 1 || character.magic < 0 || character.speed <= 0
    || character.attackSpeed <= 0 || character.defense < 0 || character.defense > 100
    || character.resistance < 0 || character.resistance > 100 || character.attackRange < 1) {
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
  try {
    await saveCharacterJson();
    refreshCharacterUI();
  } catch (error) {
    alert("캐릭터 데이터를 저장하지 못했습니다.");
  }
}

function createCharacter(characterData, index) {
  const role = characterData.role;

  return {
    id: index,
    role,
    name: characterData.name,
    hp: characterData.hp,
    maxHp: characterData.hp,
    atk: characterData.atk,
    magic: characterData.magic,
    speed: characterData.speed,
    attackSpeed: characterData.attackSpeed,
    defense: characterData.defense,
    resistance: characterData.resistance,
    attackRange: characterData.attackRange,
    attributes: createCharacterAttributes(characterData.attributes),
    faction: characterData.faction ?? getDefaultFactionName(),
    x: Math.random() * canvas.width * 0.3,
    y: Math.random() * canvas.height,
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
    button.onclick = () => toggleSelect(character, button);

    charactersEl.appendChild(button);
  });
}

function toggleSelect(character, button) {
  if (playerSquad.includes(character)) {
    playerSquad = playerSquad.filter(unit => unit !== character);
    button.style.background = "";
  } else if (playerSquad.length < MAX_PLAYER_SQUAD) {
    playerSquad.push(character);
    button.style.background = "lightblue";
  }

  updateStatusUI();
}
