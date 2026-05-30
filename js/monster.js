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
      <td>${monster.atk}</td>
      <td>${monster.speed}</td>
      <td>${escapeHtml(monster.role)}</td>
      <td><button onclick="openMonsterModal(${index})">수정</button></td>
    </tr>
  `).join("");
}

function openMonsterModal(index = "") {
  const monster = monsterJson[index];

  monsterModalTitleEl.innerText = monster ? "몬스터 수정" : "몬스터 추가";
  monsterEditIndexEl.value = monster ? index : "";
  monsterLabelEl.value = monster?.label ?? "";
  monsterHpEl.value = monster?.hp ?? 100;
  monsterAtkEl.value = monster?.atk ?? 10;
  monsterSpeedEl.value = monster?.speed ?? 1;
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
    atk: Number(monsterAtkEl.value),
    speed: Number(monsterSpeedEl.value),
    role: monsterRoleEl.value
  };

  if (!monster.label || monster.hp < 1 || monster.atk < 1 || monster.speed <= 0) {
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
    atk: monster.atk,
    speed: monster.speed,
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
