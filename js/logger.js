const APP_LOG_STORAGE_KEY = "squad-auto-battle-logs";
const APP_LOG_LIMIT = 300;
let appLogs = [];

function loadAppLogs() {
  try {
    const parsed = JSON.parse(localStorage.getItem(APP_LOG_STORAGE_KEY) || "[]");
    appLogs = Array.isArray(parsed) ? parsed.slice(-APP_LOG_LIMIT) : [];
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
  const entry = {
    at: new Date().toISOString(),
    level,
    source,
    message,
    detail: typeof detail === "string" ? detail : formatLogError(detail)
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
  addAppLog("info", source, message);
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
        <div>${escapeLogHtml(entry.message)}</div>
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

window.addEventListener("error", event => {
  logError("window", event.message, event.error || `${event.filename}:${event.lineno}:${event.colno}`);
});

window.addEventListener("unhandledrejection", event => {
  logError("promise", "처리되지 않은 비동기 오류가 발생했습니다.", event.reason);
});
