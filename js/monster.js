async function loadMonsterJson() {
  const rawJson = await loadJsonFile("monsters", DEFAULT_MONSTER_JSON);
  monsterJson = normalizeCombatJson(rawJson, DEFAULT_MONSTER_JSON, "label");
}

async function saveMonsterJson() {
  await saveJsonFile("monsters", monsterJson);
  log("몬스터 데이터가 저장되었습니다.");
}

function refreshMonsterUI() {
  renderEnemyButtons();
  renderMonsterTable();
}

function renderEnemyButtons() {
  enemyButtonsEl.innerHTML = monsterJson.map((monster, index) => (
    `<button onclick="selectEnemy(${index})">${escapeHtml(monster.label)}</button>`
  )).join("");
}

function renderMonsterTable() {
  monsterTableBodyEl.innerHTML = monsterJson.map((monster, index) => `
    <tr>
      <td><input type="checkbox" class="monster-check" value="${index}"></td>
      <td>${escapeHtml(monster.label)}</td>
      <td>${monster.hp}</td>
      <td>${monster.mp}</td>
      <td>${monster.st}</td>
      <td>${monster.atk}</td>
      <td>${monster.magic}</td>
      <td>${monster.speed}</td>
      <td>${monster.attackSpeed}</td>
      <td>${monster.castSpeed}</td>
      <td>${monster.defense}</td>
      <td>${monster.resistance}</td>
      <td>${monster.attackRange}</td>
      <td>${escapeHtml(getRoleLabel(monster.role))}</td>
      <td><button onclick="openMonsterModal(${index})">수정</button></td>
    </tr>
  `).join("");
}

function openMonsterModal(index = "") {
  const monster = monsterJson[index];

  monsterModalTitleEl.innerText = monster ? "몬스터 수정" : "몬스터 추가";
  monsterEditIndexEl.value = monster ? index : "";
  monsterLabelEl.value = monster?.label ?? "";
  monsterHpEl.value = monster?.hp ?? 2000;
  monsterMpEl.value = monster?.mp ?? DEFAULT_RESOURCE_VALUE;
  monsterStEl.value = monster?.st ?? DEFAULT_RESOURCE_VALUE;
  monsterAtkEl.value = monster?.atk ?? 10;
  monsterMagicEl.value = monster?.magic ?? getDefaultAbility(monster?.role ?? "melee", "magic");
  monsterSpeedEl.value = monster?.speed ?? 1;
  monsterAttackSpeedEl.value = monster?.attackSpeed ?? getDefaultAbility(monster?.role ?? "melee", "attackSpeed");
  monsterCastSpeedEl.value = monster?.castSpeed ?? getDefaultAbility(monster?.role ?? "melee", "castSpeed");
  monsterDefenseEl.value = monster?.defense ?? getDefaultAbility(monster?.role ?? "melee", "defense");
  monsterResistanceEl.value = monster?.resistance ?? getDefaultAbility(monster?.role ?? "melee", "resistance");
  monsterAttackRangeEl.value = monster?.attackRange ?? getDefaultAbility(monster?.role ?? "melee", "attackRange");
  monsterRoleEl.value = monster?.role ?? "melee";
  monsterModalEl.classList.remove("hidden");
}

function closeMonsterModal() {
  monsterModalEl.classList.add("hidden");
  monsterFormEl.reset();
}

async function saveMonsterFromForm(event) {
  event.preventDefault();

  const editIndex = monsterEditIndexEl.value;
  const monster = {
    label: monsterLabelEl.value.trim(),
    hp: Number(monsterHpEl.value),
    mp: Number(monsterMpEl.value),
    st: Number(monsterStEl.value),
    atk: Number(monsterAtkEl.value),
    magic: Number(monsterMagicEl.value),
    speed: Number(monsterSpeedEl.value),
    attackSpeed: Number(monsterAttackSpeedEl.value),
    castSpeed: Number(monsterCastSpeedEl.value),
    defense: Number(monsterDefenseEl.value),
    resistance: Number(monsterResistanceEl.value),
    attackRange: Number(monsterAttackRangeEl.value),
    role: monsterRoleEl.value
  };

  if (!monster.label || monster.hp < 1 || monster.mp < 0 || monster.st < 0 || monster.atk < 1 || monster.magic < 0 || monster.speed <= 0
    || monster.attackSpeed <= 0 || monster.castSpeed < 0 || monster.defense < 0 || monster.defense > 100
    || monster.resistance < 0 || monster.resistance > 100 || monster.attackRange < 1) {
    alert("몬스터 정보를 올바르게 입력해주세요.");
    return;
  }

  if (editIndex !== "") {
    monsterJson[Number(editIndex)] = monster;
  } else {
    monsterJson.push(monster);
  }

  try {
    await saveMonsterJson();
    refreshMonsterUI();
    closeMonsterModal();
  } catch (error) {
    logError("monster", "몬스터 저장 처리 중 실패했습니다.", error);
    alert("몬스터 데이터를 저장하지 못했습니다.");
  }
}

async function deleteSelectedMonsters() {
  const checkedIndexes = [...document.querySelectorAll(".monster-check:checked")]
    .map(input => Number(input.value))
    .sort((a, b) => b - a);

  if (checkedIndexes.length === 0) {
    alert("삭제할 몬스터를 선택해주세요.");
    return;
  }

  checkedIndexes.forEach(index => monsterJson.splice(index, 1));
  try {
    await saveMonsterJson();
    refreshMonsterUI();
    updateStatusUI();
  } catch (error) {
    logError("monster", "몬스터 삭제 처리 중 실패했습니다.", error);
    alert("몬스터 데이터를 저장하지 못했습니다.");
  }
}

function createEnemy(monsterIndex) {
  const monster = monsterJson[monsterIndex];
  if (!monster) {
    return null;
  }

  const role = monster.role;

  return {
    id: enemySquad.length,
    role,
    name: `${monster.label}-${enemySquad.length + 1}`,
    hp: monster.hp,
    maxHp: monster.hp,
    mp: monster.mp,
    maxMp: monster.mp,
    st: monster.st,
    maxSt: monster.st,
    atk: monster.atk,
    magic: monster.magic,
    speed: monster.speed,
    attackSpeed: monster.attackSpeed,
    castSpeed: monster.castSpeed,
    defense: monster.defense,
    resistance: monster.resistance,
    attackRange: monster.attackRange,
    faction: "몬스터",
    x: Math.random() * 100 + 250,
    y: Math.random() * 200 + 50,
    vx: 0,
    vy: 0,
    attackCooldown: 0,
    alive: true,
    stats: createStats(),
    effectType: null,
    effectTimer: 0
  };
}

function selectEnemy(monsterIndex) {
  const enemy = createEnemy(monsterIndex);
  if (!enemy) {
    alert("존재하지 않는 몬스터입니다.");
    return;
  }

  enemySquad.push(enemy);
  updateStatusUI();
  log(`${enemy.name} 추가됨`);
}
