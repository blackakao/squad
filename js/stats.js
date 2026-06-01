function renderStatsPage() {
  if (!characterJson.length) {
    selectedStatCharacterIndex = "";
  } else if (selectedStatCharacterIndex === "" || !characterJson[selectedStatCharacterIndex]) {
    selectedStatCharacterIndex = 0;
  }

  renderStatCharacterButtons();
  renderStatEditor();
}

function renderStatCharacterButtons() {
  statCharacterButtonsEl.innerHTML = characterJson.map((character, index) => `
    <button
      type="button"
      class="stat-character-button ${Number(selectedStatCharacterIndex) === index ? "selected" : ""}"
      onclick="selectStatCharacter(${index})"
    >
      ${escapeHtml(character.name)}
    </button>
  `).join("");
}

function renderStatEditor() {
  const character = characterJson[selectedStatCharacterIndex];

  if (!character) {
    statSelectedNameEl.innerText = "캐릭터를 선택하세요";
    statPointSummaryEl.innerText = `0 / ${CHARACTER_STAT_TOTAL}`;
    statRowsEl.innerHTML = "";
    return;
  }

  character.attributes = createCharacterAttributes(character.attributes);
  const usedPoints = getAttributeTotal(character.attributes);

  statSelectedNameEl.innerText = character.name;
  statPointSummaryEl.innerText = `${usedPoints} / ${CHARACTER_STAT_TOTAL}`;
  statPointSummaryEl.classList.toggle("over", usedPoints > CHARACTER_STAT_TOTAL);
  statRowsEl.innerHTML = CHARACTER_STAT_DEFS.map(stat => {
    const value = character.attributes[stat.key] ?? 0;
    const canDecrease = value >= CHARACTER_STAT_STEP;
    const canIncrease = value + CHARACTER_STAT_STEP <= CHARACTER_STAT_MAX
      && usedPoints + CHARACTER_STAT_STEP <= CHARACTER_STAT_TOTAL;

    return `
      <div class="stat-row">
        <div class="stat-label">${stat.label}</div>
        <button type="button" onclick="changeCharacterStat('${stat.key}', -${CHARACTER_STAT_STEP})" ${canDecrease ? "" : "disabled"}>-</button>
        <div class="stat-value">${value}</div>
        <button type="button" onclick="changeCharacterStat('${stat.key}', ${CHARACTER_STAT_STEP})" ${canIncrease ? "" : "disabled"}>+</button>
      </div>
    `;
  }).join("");
}

function selectStatCharacter(index) {
  selectedStatCharacterIndex = index;
  renderStatsPage();
}

function changeCharacterStat(statKey, delta) {
  const character = characterJson[selectedStatCharacterIndex];
  if (!character) {
    return;
  }

  character.attributes = createCharacterAttributes(character.attributes);
  const currentValue = character.attributes[statKey] ?? 0;
  const nextValue = Math.max(0, Math.min(CHARACTER_STAT_MAX, currentValue + delta));
  const nextTotal = getAttributeTotal(character.attributes) - currentValue + nextValue;

  if (nextTotal > CHARACTER_STAT_TOTAL) {
    return;
  }

  character.attributes[statKey] = nextValue;
  renderStatEditor();
}

function resetSelectedCharacterStats() {
  const character = characterJson[selectedStatCharacterIndex];
  if (!character) {
    return;
  }

  character.attributes = createCharacterAttributes();
  renderStatEditor();
}

async function saveSelectedCharacterStats() {
  const character = characterJson[selectedStatCharacterIndex];
  if (!character) {
    alert("스탯을 적용할 캐릭터를 선택해주세요.");
    return;
  }

  try {
    await saveCharacterJson();
    playerSquad = [];
    refreshCharacterUI();
    renderStatsPage();
  } catch (error) {
    alert("캐릭터 스탯을 저장하지 못했습니다.");
  }
}
