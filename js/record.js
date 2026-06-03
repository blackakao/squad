const RECORDS_PER_PAGE = 10;
let recordPage = 1;

function normalizeRecordJson(records) {
  if (!Array.isArray(records)) {
    return [];
  }

  const normalizeMember = member => {
    if (typeof member === "string") {
      return { name: member, role: "", hp: 0, maxHp: 0, mp: 0, maxMp: 0, st: 0, maxSt: 0, dps: 0 };
    }

    return {
      name: String(member.name ?? "").trim(),
      role: String(member.role ?? "").trim(),
      hp: Number(member.hp) || 0,
      maxHp: Number(member.maxHp) || 0,
      mp: Number(member.mp) || 0,
      maxMp: Number(member.maxMp) || 0,
      st: Number(member.st) || 0,
      maxSt: Number(member.maxSt) || 0,
      dps: Number(member.dps) || 0
    };
  };

  return records
    .map(record => ({
      battleAt: String(record.battleAt ?? "").trim(),
      result: String(record.result ?? "").trim(),
      playerMembers: Array.isArray(record.playerMembers) ? record.playerMembers.map(normalizeMember) : [],
      monsterMembers: Array.isArray(record.monsterMembers) ? record.monsterMembers.map(normalizeMember) : [],
      durationSeconds: Number(record.durationSeconds) || 0
    }))
    .filter(record => record.battleAt && record.result);
}

async function loadBattleRecordsJson() {
  const rawJson = await loadJsonFile("records", []);
  battleRecordsJson = normalizeRecordJson(rawJson);
  recordPage = 1;
}

async function saveBattleRecordsJson() {
  await saveJsonFile("records", battleRecordsJson);
  log("전투 기록이 저장되었습니다.");
}

function formatMemberResource(current, max) {
  return max > 0 ? `${Math.floor(current)} / ${max}` : "-";
}

function sortMembersByDps(members) {
  return [...members].sort((a, b) => (Number(b.dps) || 0) - (Number(a.dps) || 0));
}

function renderMemberTable(members) {
  const sortedMembers = sortMembersByDps(members);

  return `
    <table class="member-table">
      <thead>
        <tr>
          <th>이름</th>
          <th>계열</th>
          <th>HP</th>
          <th>DPS</th>
        </tr>
      </thead>
      <tbody>
        ${sortedMembers.map(member => `
          <tr>
            <td>${escapeHtml(member.name)}</td>
            <td>${escapeHtml(getRoleLabel(member.role))}</td>
            <td>${Math.floor(member.hp)} / ${member.maxHp}</td>
            <td>${member.dps.toFixed(1)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function formatBattleAt(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return escapeHtml(value).slice(0, 16).replace("T", " ");
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function getRecordPageCount() {
  return Math.max(1, Math.ceil(battleRecordsJson.length / RECORDS_PER_PAGE));
}

function renderBattleRecords() {
  const pageCount = getRecordPageCount();
  recordPage = Math.min(Math.max(1, recordPage), pageCount);

  const startIndex = (recordPage - 1) * RECORDS_PER_PAGE;
  const visibleRecords = battleRecordsJson.slice(startIndex, startIndex + RECORDS_PER_PAGE);

  recordTableBodyEl.innerHTML = visibleRecords.map((record, index) => {
    const originalIndex = startIndex + index;

    return `
    <tr>
      <td><input type="checkbox" class="record-check" value="${originalIndex}"></td>
      <td>${formatBattleAt(record.battleAt)}</td>
      <td>${escapeHtml(record.result)}</td>
      <td>${renderMemberTable(record.playerMembers)}</td>
      <td>${renderMemberTable(record.monsterMembers)}</td>
      <td>${record.durationSeconds.toFixed(1)}초</td>
    </tr>
    `;
  }).join("");

  renderRecordPagination(pageCount);
}

function renderRecordPagination(pageCount = getRecordPageCount()) {
  recordPaginationEl.innerHTML = `
    <button onclick="setRecordPage(${recordPage - 1})" ${recordPage <= 1 ? "disabled" : ""}>이전</button>
    <span>${recordPage} / ${pageCount}</span>
    <button onclick="setRecordPage(${recordPage + 1})" ${recordPage >= pageCount ? "disabled" : ""}>다음</button>
  `;
}

function setRecordPage(page) {
  recordPage = Math.min(Math.max(1, page), getRecordPageCount());
  renderBattleRecords();
}

async function deleteSelectedBattleRecords() {
  const checkedIndexes = [...document.querySelectorAll(".record-check:checked")]
    .map(input => Number(input.value))
    .sort((a, b) => b - a);

  if (checkedIndexes.length === 0) {
    alert("삭제할 전투 기록을 선택해주세요.");
    return;
  }

  checkedIndexes.forEach(index => battleRecordsJson.splice(index, 1));
  recordPage = Math.min(recordPage, getRecordPageCount());

  try {
    await saveBattleRecordsJson();
    renderBattleRecords();
  } catch (error) {
    alert("전투 기록을 저장하지 못했습니다.");
  }
}

async function clearBattleRecords() {
  battleRecordsJson = [];
  recordPage = 1;
  try {
    await saveBattleRecordsJson();
    renderBattleRecords();
  } catch (error) {
    alert("전투 기록을 저장하지 못했습니다.");
  }
}

function createRecordMembers(units, durationSeconds) {
  return sortMembersByDps(units.map(unit => {
    const maxMp = Math.max(0, Number(unit.maxMp ?? DEFAULT_RESOURCE_VALUE));
    const maxSt = Math.max(0, Number(unit.maxSt ?? DEFAULT_RESOURCE_VALUE));

    return {
      name: unit.name,
      role: unit.role,
      hp: Math.max(0, Math.floor(Number(unit.hp) || 0)),
      maxHp: Number(unit.maxHp) || 0,
      mp: Math.max(0, Math.floor(Number(unit.mp) || 0)),
      maxMp,
      st: Math.max(0, Math.floor(Number(unit.st) || 0)),
      maxSt,
      dps: durationSeconds > 0 ? (Number(unit.stats?.damage) || 0) / durationSeconds : 0
    };
  }));
}

function createBattleRecord(result) {
  const durationSeconds = battleStartedAt ? (Date.now() - battleStartedAt) / 1000 : 0;

  return {
    battleAt: battleStartedAtText || new Date().toISOString(),
    result,
    playerMembers: createRecordMembers(playerSquad, durationSeconds),
    monsterMembers: createRecordMembers(enemySquad, durationSeconds),
    durationSeconds
  };
}
