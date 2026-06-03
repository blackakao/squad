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

function openCharacterModal(index = "") {
  const character = characterJson[index];

  characterModalTitleEl.innerText = character ? "캐릭터 수정" : "캐릭터 추가";
  characterEditIndexEl.value = character ? index : "";
  characterNameEl.value = character?.name ?? "";
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
  const character = applyCharacterStatAbilities({
    name: characterNameEl.value.trim(),
    role: characterRoleEl.value,
    faction: characterFactionEl.value,
    attributes: createCharacterAttributes(previousAttributes)
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
  const derivedCharacter = applyCharacterStatAbilities(characterData);
  const role = derivedCharacter.role;

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
    atk: derivedCharacter.atk,
    magic: derivedCharacter.magic,
    speed: derivedCharacter.speed,
    attackSpeed: derivedCharacter.attackSpeed,
    castSpeed: derivedCharacter.castSpeed,
    defense: derivedCharacter.defense,
    resistance: derivedCharacter.resistance,
    attackRange: derivedCharacter.attackRange,
    attributes: derivedCharacter.attributes,
    faction: derivedCharacter.faction ?? getDefaultFactionName(),
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
