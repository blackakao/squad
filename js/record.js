const RECORDS_PER_PAGE = 10;
let recordPage = 1;

function normalizeRecordEvents(events) {
  if (!Array.isArray(events)) return [];
  const unit=entry=>entry ? {id:Number(entry.id) || 0,name:String(entry.name ?? ""),side:String(entry.side ?? ""),isSummon:Boolean(entry.isSummon)} : null;
  return events.slice(-1000).map(event=>({
    id:Number(event?.id) || 0,tick:Math.max(0,Number(event?.tick) || 0),type:String(event?.type ?? ""),
    source:unit(event?.source),target:unit(event?.target),skillId:event?.skillId == null ? null : String(event.skillId),skillName:String(event?.skillName ?? ""),
    amount:Number(event?.amount) || 0,hpDamage:Number(event?.hpDamage) || 0,barrierDamage:Number(event?.barrierDamage) || 0,
    damageType:event?.damageType == null ? null : String(event.damageType),resource:event?.resource == null ? null : String(event.resource),
    moveType:event?.moveType == null ? null : String(event.moveType),periodic:Boolean(event?.periodic),triggered:Boolean(event?.triggered),
    reason:event?.reason == null ? null : String(event.reason),depth:Math.max(0,Number(event?.depth) || 0)
  })).filter(event=>event.type);
}

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
      durationSeconds: Number(record.durationSeconds) || 0,
      events: normalizeRecordEvents(record.events)
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
      <td>${renderRecordEvents(record.events)}</td>
    </tr>
    `;
  }).join("");

  renderRecordPagination(pageCount);
}

function renderRecordEvents(events = []) {
  if (!events.length) return "-";
  return `<details class="record-events"><summary>${events.length}건 보기</summary><div class="record-event-list">${events.map(event => {
    const label=BATTLE_EVENT_LABELS[event.type] ?? event.type;
    const amount=["hit","damaged","heal","resource_drain","damage_redirect","forced_move"].includes(event.type) ? ` · ${event.amount.toFixed(1)}${event.resource ? ` ${escapeHtml(event.resource)}` : ""}` : "";
    return `<div><time>${(event.tick/60).toFixed(2)}s</time> ${escapeHtml(label)} · ${escapeHtml(event.source?.name || "환경")} → ${escapeHtml(event.target?.name || "-")}${event.skillName ? ` · ${escapeHtml(event.skillName)}` : ""}${amount}${event.reason ? ` · ${escapeHtml(event.reason)}` : ""}</div>`;
  }).join("")}</div></details>`;
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
    logError("record", "전투 기록 삭제 처리 중 실패했습니다.", error);
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
    logError("record", "전투 기록 전체 삭제 처리 중 실패했습니다.", error);
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
    durationSeconds,
    events:normalizeRecordEvents(getBattleEvents())
  };
}
