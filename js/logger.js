const APP_LOG_STORAGE_KEY = "squad-auto-battle-logs";
const APP_LOG_LIMIT = 300;
let appLogs = [];

function loadAppLogs() {
  try {
    const parsed = JSON.parse(localStorage.getItem(APP_LOG_STORAGE_KEY) || "[]");
    appLogs = Array.isArray(parsed)
      ? parsed
        .filter(entry => entry?.level === "warn" || entry?.level === "error")
        .map(entry => ({ ...entry, count: Number(entry.count) || 1 }))
        .slice(-APP_LOG_LIMIT)
      : [];
  } catch (error) {
    appLogs = [];
  }
}

function saveAppLogs() {
  try {
    localStorage.setItem(APP_LOG_STORAGE_KEY, JSON.stringify(appLogs.slice(-APP_LOG_LIMIT)));
  } catch (error) {
    console.error("로그 저장 실패", error);
  }
}

function formatLogError(error) {
  if (!error) {
    return "";
  }

  if (error instanceof Error) {
    return `${error.name}: ${error.message}${error.stack ? `\n${error.stack}` : ""}`;
  }

  try {
    return JSON.stringify(error);
  } catch (jsonError) {
    return String(error);
  }
}

function escapeLogHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char]));
}

function addAppLog(level, source, message, detail = "") {
  if (level === "info") {
    console.log(`[${source}] ${message}`, detail || "");
    return;
  }

  const normalizedDetail = typeof detail === "string" ? detail : formatLogError(detail);
  const existingEntry = appLogs.find(entry =>
    entry.level === level
    && entry.source === source
    && entry.message === message
    && entry.detail === normalizedDetail
  );

  if (existingEntry) {
    existingEntry.at = new Date().toISOString();
    existingEntry.count = (Number(existingEntry.count) || 1) + 1;
    saveAppLogs();
    renderLogPage();
    if (level === "error") {
      console.error(`[${source}] ${message}`, detail);
    } else {
      console.warn(`[${source}] ${message}`, detail);
    }
    return;
  }

  const entry = {
    at: new Date().toISOString(),
    level,
    source,
    message,
    detail: normalizedDetail,
    count: 1
  };

  appLogs.push(entry);
  appLogs = appLogs.slice(-APP_LOG_LIMIT);
  saveAppLogs();

  if (level === "error") {
    console.error(`[${source}] ${message}`, detail);
  } else if (level === "warn") {
    console.warn(`[${source}] ${message}`, detail);
  } else {
    console.log(`[${source}] ${message}`, detail || "");
  }

  renderLogPage();
}

function log(message, source = "app") {
  console.log(`[${source}] ${message}`);
}

function logWarn(source, message, detail = "") {
  addAppLog("warn", source, message, detail);
}

function logError(source, message, error = "") {
  addAppLog("error", source, message, formatLogError(error));
}

function formatLogTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function renderLogPage() {
  const tableBody = document.getElementById("logTableBody");
  if (!tableBody) {
    return;
  }

  tableBody.innerHTML = appLogs.slice().reverse().map(entry => `
    <tr class="log-row ${entry.level}">
      <td>${escapeLogHtml(formatLogTime(entry.at))}</td>
      <td>${escapeLogHtml(entry.level)}</td>
      <td>${escapeLogHtml(entry.source)}</td>
      <td>
        <div>${escapeLogHtml(entry.message)}${entry.count > 1 ? ` (${entry.count}회)` : ""}</div>
        ${entry.detail ? `<pre>${escapeLogHtml(entry.detail)}</pre>` : ""}
      </td>
    </tr>
  `).join("");
}

function clearAppLogs() {
  appLogs = [];
  saveAppLogs();
  renderLogPage();
}

loadAppLogs();

function attachSkillSaveClickLogger() {
  const button = document.getElementById("skillSaveButton");
  if (!button || button.dataset.logClickBound === "true") {
    return;
  }

  button.addEventListener("click", () => {
    logWarn("skill", "스킬 저장 버튼 클릭 이벤트를 감지했습니다.", JSON.stringify({
      saveSkillFromFormType: typeof window.saveSkillFromForm,
      formNoValidate: Boolean(document.getElementById("skillForm")?.noValidate),
      skillName: document.getElementById("skillName")?.value ?? "",
      actionRows: document.querySelectorAll("#skillActions .skill-action-row").length,
      resourceCostRows: document.querySelectorAll("#skillResourceCosts .skill-resource-cost-row").length
    }, null, 2));
  }, { capture: true });

  button.dataset.logClickBound = "true";
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", attachSkillSaveClickLogger);
} else {
  attachSkillSaveClickLogger();
}

window.addEventListener("error", event => {
  logError("runtime", "브라우저 스크립트 오류가 발생했습니다.", {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error ? formatLogError(event.error) : ""
  });
});

window.addEventListener("unhandledrejection", event => {
  logError("runtime", "처리되지 않은 비동기 오류가 발생했습니다.", event.reason);
});
