const canvas = document.getElementById("battleCanvas");
const ctx = canvas.getContext("2d");

const charactersEl = document.getElementById("characters");
const playerStatusEl = document.getElementById("playerStatus");
const enemyStatusEl = document.getElementById("enemyStatus");
const battleBtnEl = document.getElementById("battleBtn");
const enemyButtonsEl = document.getElementById("enemyButtons");
const battlePageEl = document.getElementById("root");
const monsterPageEl = document.getElementById("monsterPage");
const characterPageEl = document.getElementById("characterPage");
const recordPageEl = document.getElementById("recordPage");
const monsterTableBodyEl = document.getElementById("monsterTableBody");
const recordTableBodyEl = document.getElementById("recordTableBody");
const recordPaginationEl = document.getElementById("recordPagination");
const monsterModalEl = document.getElementById("monsterModal");
const monsterModalTitleEl = document.getElementById("monsterModalTitle");
const monsterFormEl = document.getElementById("monsterForm");
const monsterEditIndexEl = document.getElementById("monsterEditIndex");
const monsterLabelEl = document.getElementById("monsterLabel");
const monsterHpEl = document.getElementById("monsterHp");
const monsterAtkEl = document.getElementById("monsterAtk");
const monsterSpeedEl = document.getElementById("monsterSpeed");
const monsterRoleEl = document.getElementById("monsterRole");
const characterTableBodyEl = document.getElementById("characterTableBody");
const characterModalEl = document.getElementById("characterModal");
const characterModalTitleEl = document.getElementById("characterModalTitle");
const characterFormEl = document.getElementById("characterForm");
const characterEditIndexEl = document.getElementById("characterEditIndex");
const characterNameEl = document.getElementById("characterName");
const characterHpEl = document.getElementById("characterHp");
const characterAtkEl = document.getElementById("characterAtk");
const characterSpeedEl = document.getElementById("characterSpeed");
const characterRoleEl = document.getElementById("characterRole");

const ROLES = ["tank", "melee", "ranged", "healer"];
const API_URLS = {
  monsters: "/api/monsters",
  characters: "/api/characters",
  records: "/api/records"
};
const DEFAULT_MONSTER_JSON = [
  { label: "슬라임", hp: 80, atk: 8, speed: 1.2, role: "melee" },
  { label: "오크", hp: 120, atk: 12, speed: 1, role: "ranged" },
  { label: "드래곤", hp: 200, atk: 20, speed: 1.2, role: "melee" }
];

const ROLE_STATS = {
  tank: { hp: 150, atk: 10, color: "gray", range: 10, speedMultiplier: 1.2 },
  melee: { hp: 100, atk: 10, color: "yellow", range: 10, speedMultiplier: 1.2 },
  ranged: { hp: 100, atk: 12, color: "blue", range: 60, speedMultiplier: 1 },
  healer: { hp: 100, atk: 10, color: "violet", range: 60, speedMultiplier: 1 }
};

const ATTACK_COOLDOWN = 30;
const COLLISION_DISTANCE = 10;
const UNIT_RADIUS = 5;
const MAX_PLAYER_SQUAD = 10;
const PROJECTILE_SPEED = 7;
const EFFECT_DURATION = 18;
const EFFECT_COLORS = {
  damage: "#fff18f",
  heal: "#8fffc1"
};

let allCharacters = [];
let playerSquad = [];
let enemySquad = [];
let projectiles = [];
let isBattleRunning = false;
let gameSpeed = 1;
let scale = 1;
let monsterJson = [];
let characterJson = [];
let battleRecordsJson = [];
let battleStartedAt = null;
let battleStartedAtText = "";

function createStats() {
  return { damage: 0, taken: 0, heal: 0 };
}

function getRoleColor(role) {
  return ROLE_STATS[role]?.color ?? "black";
}

function getUnitRange(role) {
  return ROLE_STATS[role]?.range ?? 10;
}

function createDefaultCharacterJson() {
  const characters = [];

  ROLES.forEach(role => {
    const roleStat = ROLE_STATS[role];

    for (let i = 0; i < 5; i++) {
      characters.push({
        name: `${role}${i + 1}`,
        hp: roleStat.hp,
        atk: roleStat.atk,
        speed: roleStat.speedMultiplier,
        role
      });
    }
  });

  return characters;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char]));
}

function normalizeCombatJson(items, defaults, nameKey) {
  if (!Array.isArray(items)) {
    return defaults.map(item => ({ ...item }));
  }

  if (items.length === 0) {
    return [];
  }

  const normalized = items
    .map(item => ({
      [nameKey]: String(item[nameKey] ?? item.label ?? item.name ?? "").trim(),
      hp: Number(item.hp),
      atk: Number(item.atk),
      speed: Number(item.speed ?? ROLE_STATS[item.role]?.speedMultiplier ?? 1),
      role: String(item.role ?? "").trim()
    }))
    .filter(item => item[nameKey] && item.hp > 0 && item.atk > 0 && item.speed > 0 && ROLES.includes(item.role));

  return normalized.length > 0 ? normalized : defaults.map(item => ({ ...item }));
}

async function showPage(pageName) {
  battlePageEl.classList.toggle("hidden", pageName !== "battle");
  monsterPageEl.classList.toggle("hidden", pageName !== "monster");
  characterPageEl.classList.toggle("hidden", pageName !== "character");
  recordPageEl.classList.toggle("hidden", pageName !== "record");

  if (pageName === "monster") {
    await loadMonsterJson();
    enemySquad = [];
    refreshMonsterUI();
    updateStatusUI();
  } else if (pageName === "character") {
    await loadCharacterJson();
    playerSquad = [];
    refreshCharacterUI();
  } else if (pageName === "record") {
    await loadBattleRecordsJson();
    renderBattleRecords();
  }

  if (pageName === "battle") {
    resizeCanvas();
  }
}

function initRoleOptions() {
  monsterRoleEl.innerHTML = ROLES.map(role => `<option value="${role}">${role}</option>`).join("");
  characterRoleEl.innerHTML = ROLES.map(role => `<option value="${role}">${role}</option>`).join("");
}

function renderStatus(units, colorResolver) {
  return units.map(unit => {
    const hpRatio = Math.max(0, (unit.hp / unit.maxHp) * 100);

    return `
      <div class="unit-status">
        <div>${unit.name} (${unit.role})</div>
        <div class="unit-meta">${Math.floor(unit.hp)} / ${unit.maxHp}</div>
        <div class="hp-track">
          <div class="hp-fill" style="width:${hpRatio}%; background:${colorResolver(unit)};"></div>
        </div>
      </div>
    `;
  }).join("");
}

function updateStatusUI() {
  playerStatusEl.innerHTML = renderStatus(playerSquad, unit => getRoleColor(unit.role));
  enemyStatusEl.innerHTML = renderStatus(enemySquad, () => "red");
}

function resizeCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
  scale = canvas.width / 400;
}
