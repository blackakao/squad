let statDraftCharacterIndex = "";
let statDraftAttributes = null;

function getSelectedStatCharacter() {
  return characterJson[selectedStatCharacterIndex];
}

function syncStatDraftAttributes() {
  const character = getSelectedStatCharacter();
  if (!character) {
    statDraftCharacterIndex = "";
    statDraftAttributes = null;
    return;
  }

  const selectedKey = String(selectedStatCharacterIndex);
  if (statDraftCharacterIndex !== selectedKey || !statDraftAttributes) {
    statDraftCharacterIndex = selectedKey;
    statDraftAttributes = createCharacterAttributes(character.attributes);
  }
}

function renderStatsPage() {
  if (!characterJson.length) {
    selectedStatCharacterIndex = "";
  } else if (selectedStatCharacterIndex === "" || !characterJson[selectedStatCharacterIndex]) {
    selectedStatCharacterIndex = 0;
  }

  syncStatDraftAttributes();
  renderStatCharacterButtons();
  renderStatEditor();
  renderStatAbilityPreview();
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
  const character = getSelectedStatCharacter();

  if (!character) {
    statSelectedNameEl.innerText = "캐릭터를 선택하세요";
    statPointSummaryEl.innerText = `0 / ${CHARACTER_STAT_TOTAL}`;
    statPointSummaryEl.classList.remove("over");
    statRowsEl.innerHTML = "";
    return;
  }

  syncStatDraftAttributes();
  const usedPoints = getAttributeTotal(statDraftAttributes);

  statSelectedNameEl.innerText = character.name;
  statPointSummaryEl.innerText = `${usedPoints} / ${CHARACTER_STAT_TOTAL}`;
  statPointSummaryEl.classList.toggle("over", usedPoints > CHARACTER_STAT_TOTAL);
  statRowsEl.innerHTML = CHARACTER_STAT_DEFS.map(stat => {
    const value = statDraftAttributes[stat.key] ?? 0;
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

function formatAbilityDelta(currentValue, previewValue) {
  const delta = Math.round((previewValue - currentValue) * 100) / 100;
  if (delta === 0) {
    return "-";
  }

  return delta > 0 ? `+${delta}` : String(delta);
}

function renderStatAbilityPreview() {
  const character = getSelectedStatCharacter();

  if (!character) {
    statAbilityPreviewEl.innerHTML = "";
    return;
  }

  syncStatDraftAttributes();
  const currentCharacter = applyCharacterStatAbilities(character);
  const previewCharacter = applyCharacterStatAbilities({
    ...character,
    attributes: statDraftAttributes
  });
  const abilityRows = [
    ["HP", "hp"],
    ["MP", "mp"],
    ["ST", "st"],
    ["공격력", "atk"],
    ["마력", "magic"],
    ["이동속도", "speed"],
    ["공격속도", "attackSpeed"],
    ["시전속도", "castSpeed"],
    ["방어력", "defense"],
    ["저항력", "resistance"],
    ["사정거리", "attackRange"]
  ];

  statAbilityPreviewEl.innerHTML = `
    <table class="stat-ability-table">
      <thead>
        <tr>
          <th>능력치</th>
          <th>현재</th>
          <th>예상</th>
          <th>변동</th>
        </tr>
      </thead>
      <tbody>
        ${abilityRows.map(([label, key]) => `
          <tr>
            <th>${label}</th>
            <td>${currentCharacter[key]}</td>
            <td>${previewCharacter[key]}</td>
            <td>${formatAbilityDelta(currentCharacter[key], previewCharacter[key])}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function selectStatCharacter(index) {
  selectedStatCharacterIndex = index;
  statDraftCharacterIndex = "";
  statDraftAttributes = null;
  renderStatsPage();
}

function changeCharacterStat(statKey, delta) {
  const character = getSelectedStatCharacter();
  if (!character) {
    return;
  }

  syncStatDraftAttributes();
  const currentValue = statDraftAttributes[statKey] ?? 0;
  const nextValue = Math.max(0, Math.min(CHARACTER_STAT_MAX, currentValue + delta));
  const nextTotal = getAttributeTotal(statDraftAttributes) - currentValue + nextValue;

  if (nextTotal > CHARACTER_STAT_TOTAL) {
    return;
  }

  statDraftAttributes[statKey] = nextValue;
  renderStatEditor();
  renderStatAbilityPreview();
}

function resetSelectedCharacterStats() {
  const character = getSelectedStatCharacter();
  if (!character) {
    return;
  }

  statDraftAttributes = createCharacterAttributes();
  renderStatEditor();
  renderStatAbilityPreview();
}

async function saveSelectedCharacterStats() {
  const character = getSelectedStatCharacter();
  if (!character) {
    alert("스탯을 적용할 캐릭터를 선택해주세요.");
    return;
  }

  try {
    statDraftAttributes = createCharacterAttributes(statDraftAttributes);
    characterJson[Number(selectedStatCharacterIndex)] = applyCharacterStatAbilities({
      ...character,
      attributes: statDraftAttributes
    });
    await saveCharacterJson();
    playerSquad = [];
    refreshCharacterUI();
    statDraftCharacterIndex = "";
    renderStatsPage();
  } catch (error) {
    logError("stats", "캐릭터 스탯 저장 처리 중 실패했습니다.", error);
    alert("캐릭터 스탯을 저장하지 못했습니다.");
  }
}
