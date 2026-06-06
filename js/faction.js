const FACTION_STORAGE_KEY = "squad-auto-battle-factions";

async function loadFactionJson() {
  let rawJson = null;

  try {
    const response = await fetch(API_URLS.factions, { cache: "no-store" });
    if (response.ok) {
      rawJson = await response.json();
    }
  } catch (error) {
    rawJson = null;
    logError("faction", "진영 API 데이터를 읽지 못했습니다.", error);
  }

  if (!rawJson) {
    try {
      rawJson = JSON.parse(localStorage.getItem(FACTION_STORAGE_KEY) || "null");
    } catch (error) {
      rawJson = null;
      logError("faction", "브라우저 저장소의 진영 데이터를 읽지 못했습니다.", error);
    }
  }

  factionsJson = normalizeFactionJson(rawJson);
}

async function saveFactionJson() {
  localStorage.setItem(FACTION_STORAGE_KEY, JSON.stringify(factionsJson));

  try {
    await saveJsonFile("factions", factionsJson);
    log("진영 데이터가 저장되었습니다.");
  } catch (error) {
    logError("faction", "진영 API 저장에 실패해 브라우저 저장소에만 저장했습니다.", error);
  }
}

function normalizeFactionJson(items) {
  if (!Array.isArray(items)) {
    return [...DEFAULT_FACTIONS];
  }

  const names = items
    .map(item => normalizeFactionName(typeof item === "string" ? item : item?.name))
    .filter(Boolean);
  const uniqueNames = [...new Set(names)];

  return uniqueNames.length > 0 ? uniqueNames : [...DEFAULT_FACTIONS];
}

function renderFactionPage() {
  ensureCharacterFactions();

  factionTableBodyEl.innerHTML = factionsJson.map((faction, index) => {
    const members = characterJson.filter(character => character.faction === faction);

    return `
      <tr>
        <td><input type="checkbox" class="faction-check" value="${index}"></td>
        <td>${escapeHtml(faction)}</td>
        <td>${renderFactionMemberTable(members)}</td>
        <td><button onclick="editFactionName(${index})">수정</button></td>
      </tr>
    `;
  }).join("");
}

function ensureCharacterFactions() {
  characterJson.forEach(character => {
    if (character.faction && !factionsJson.includes(character.faction)) {
      factionsJson.push(character.faction);
    }
  });
}

function renderFactionMemberTable(members) {
  if (members.length === 0) {
    return '<span class="empty-text">소속 캐릭터 없음</span>';
  }

  return `
    <table class="member-table">
      <thead>
        <tr>
          <th>이름</th>
          <th>계열</th>
        </tr>
      </thead>
      <tbody>
        ${members.map(character => `
          <tr>
            <td>${escapeHtml(character.name)}</td>
            <td>${escapeHtml(getRoleLabel(character.role))}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

async function addFactionFromInput() {
  const factionName = normalizeFactionName(factionNameEl.value);

  if (!factionName) {
    alert("추가할 진영 이름을 입력해주세요.");
    return;
  }

  if (factionsJson.includes(factionName)) {
    alert("이미 존재하는 진영입니다.");
    return;
  }

  factionsJson.push(factionName);
  factionNameEl.value = "";

  try {
    await saveFactionJson();
    renderCharacterFactionOptions();
    renderFactionPage();
  } catch (error) {
    logError("faction", "진영 추가 처리 중 실패했습니다.", error);
    alert("진영 데이터를 저장하지 못했습니다.");
  }
}

async function editFactionName(index) {
  const currentName = factionsJson[index];
  if (!currentName) {
    return;
  }

  const nextName = normalizeFactionName(prompt("수정할 진영 이름을 입력해주세요.", currentName));
  if (!nextName || nextName === currentName) {
    return;
  }

  if (factionsJson.includes(nextName)) {
    alert("이미 존재하는 진영입니다.");
    return;
  }

  factionsJson[index] = nextName;
  characterJson.forEach(character => {
    if (character.faction === currentName) {
      character.faction = nextName;
    }
  });

  playerSquad = [];
  try {
    await saveFactionJson();
    await saveCharacterJson();
    refreshCharacterUI();
    renderCharacterFactionOptions();
    renderFactionPage();
  } catch (error) {
    logError("faction", "진영 이름 수정 처리 중 실패했습니다.", error);
    alert("진영 이름을 수정하지 못했습니다.");
  }
}

async function deleteSelectedFactions() {
  const checkedIndexes = [...document.querySelectorAll(".faction-check:checked")]
    .map(input => Number(input.value))
    .sort((a, b) => b - a);

  if (checkedIndexes.length === 0) {
    alert("삭제할 진영을 선택해주세요.");
    return;
  }

  if (checkedIndexes.length >= factionsJson.length) {
    alert("진영은 최소 1개 이상 필요합니다.");
    return;
  }

  const deletedFactions = checkedIndexes.map(index => factionsJson[index]);
  checkedIndexes.forEach(index => factionsJson.splice(index, 1));
  const fallbackFaction = getDefaultFactionName();

  characterJson.forEach(character => {
    if (deletedFactions.includes(character.faction)) {
      character.faction = fallbackFaction;
    }
  });

  playerSquad = [];
  try {
    await saveFactionJson();
    await saveCharacterJson();
    refreshCharacterUI();
    renderCharacterFactionOptions();
    renderFactionPage();
  } catch (error) {
    logError("faction", "진영 삭제 처리 중 실패했습니다.", error);
    alert("진영 데이터를 저장하지 못했습니다.");
  }
}
