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
const statsPageEl = document.getElementById("statsPage");
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
const monsterMagicEl = document.getElementById("monsterMagic");
const monsterSpeedEl = document.getElementById("monsterSpeed");
const monsterAttackSpeedEl = document.getElementById("monsterAttackSpeed");
const monsterDefenseEl = document.getElementById("monsterDefense");
const monsterResistanceEl = document.getElementById("monsterResistance");
const monsterAttackRangeEl = document.getElementById("monsterAttackRange");
const monsterRoleEl = document.getElementById("monsterRole");
const characterTableBodyEl = document.getElementById("characterTableBody");
const factionPageEl = document.getElementById("factionPage");
const factionNameEl = document.getElementById("factionName");
const factionTableBodyEl = document.getElementById("factionTableBody");
const characterModalEl = document.getElementById("characterModal");
const characterModalTitleEl = document.getElementById("characterModalTitle");
const characterFormEl = document.getElementById("characterForm");
const characterEditIndexEl = document.getElementById("characterEditIndex");
const characterNameEl = document.getElementById("characterName");
const characterHpEl = document.getElementById("characterHp");
const characterAtkEl = document.getElementById("characterAtk");
const characterMagicEl = document.getElementById("characterMagic");
const characterSpeedEl = document.getElementById("characterSpeed");
const characterAttackSpeedEl = document.getElementById("characterAttackSpeed");
const characterDefenseEl = document.getElementById("characterDefense");
const characterResistanceEl = document.getElementById("characterResistance");
const characterAttackRangeEl = document.getElementById("characterAttackRange");
const characterRoleEl = document.getElementById("characterRole");
const characterFactionEl = document.getElementById("characterFaction");
const statCharacterButtonsEl = document.getElementById("statCharacterButtons");
const statSelectedNameEl = document.getElementById("statSelectedName");
const statPointSummaryEl = document.getElementById("statPointSummary");
const statRowsEl = document.getElementById("statRows");

const ROLES = ["tank", "melee", "ranged", "healer", "special"];
const ROLE_ALIASES = {
  mlee: "melee"
};
const ROLE_LABELS = {
  tank: "1종 전투계열",
  melee: "2종 전투계열",
  ranged: "마법사",
  healer: "지원가",
  special: "특수"
};
const DEFAULT_FACTIONS = ["기본 진영"];
const CHARACTER_STAT_DEFS = [
  { key: "str", label: "힘" },
  { key: "vit", label: "체력" },
  { key: "agi", label: "민첩" },
  { key: "focus", label: "집중" },
  { key: "int", label: "지능" },
  { key: "wis", label: "지혜" }
];
const CHARACTER_STAT_MAX = 50;
const CHARACTER_STAT_TOTAL = 150;
const CHARACTER_STAT_STEP = 10;
const API_URLS = {
  monsters: "/api/monsters",
  characters: "/api/characters",
  factions: "/api/factions",
  records: "/api/records"
};
const DEFAULT_MONSTER_JSON = [
  { label: "슬라임", hp: 80, atk: 8, magic: 10, speed: 1.2, attackSpeed: 1, defense: 0, resistance: 0, attackRange: 1, role: "melee" },
  { label: "오크", hp: 120, atk: 12, magic: 10, speed: 1, attackSpeed: 1, defense: 0, resistance: 0, attackRange: 1, role: "ranged" },
  { label: "드래곤", hp: 200, atk: 20, magic: 10, speed: 1.2, attackSpeed: 1, defense: 0, resistance: 0, attackRange: 1, role: "melee" }
];

const ROLE_STATS = {
  tank: { hp: 150, atk: 10, magic: 10, color: "gray", attackRange: 1, attackSpeed: 1, defense: 0, resistance: 0, speedMultiplier: 1.2 },
  melee: { hp: 100, atk: 10, magic: 10, color: "yellow", attackRange: 1, attackSpeed: 1, defense: 0, resistance: 0, speedMultiplier: 1.2 },
  ranged: { hp: 100, atk: 12, magic: 10, color: "blue", attackRange: 1, attackSpeed: 1, defense: 0, resistance: 0, speedMultiplier: 1 },
  healer: { hp: 100, atk: 10, magic: 10, color: "violet", attackRange: 1, attackSpeed: 1, defense: 0, resistance: 0, speedMultiplier: 1 },
  special: { hp: 100, atk: 10, magic: 10, color: "orange", attackRange: 1, attackSpeed: 1, defense: 0, resistance: 0, speedMultiplier: 1 }
};

const BASE_ATTACK_COOLDOWN = 60;
const ATTACK_RANGE_UNIT = 30;
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
let factionsJson = [];
let battleRecordsJson = [];
let battleStartedAt = null;
let battleStartedAtText = "";
let lastBattleDurationMs = 0;
let selectedStatCharacterIndex = "";

function createStats() {
  return { damage: 0, taken: 0, heal: 0 };
}

function normalizeRole(role) {
  const key = String(role ?? "").trim();
  return ROLE_ALIASES[key] ?? key;
}

function getRoleLabel(role) {
  return ROLE_LABELS[normalizeRole(role)] ?? role;
}

function normalizeCombatValue(value, fallback, min = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min ? number : fallback;
}

function getDefaultAbility(role, key) {
  return ROLE_STATS[normalizeRole(role)]?.[key] ?? ROLE_STATS.melee[key];
}

function createCharacterAttributes(source = {}) {
  return CHARACTER_STAT_DEFS.reduce((attributes, stat) => {
    const value = Number(source[stat.key] ?? 0);
    attributes[stat.key] = Math.max(0, Math.min(CHARACTER_STAT_MAX, Math.floor(value / CHARACTER_STAT_STEP) * CHARACTER_STAT_STEP));
    return attributes;
  }, {});
}

function getAttributeTotal(attributes) {
  return CHARACTER_STAT_DEFS.reduce((total, stat) => total + Number(attributes?.[stat.key] ?? 0), 0);
}

function getBattleElapsedSeconds() {
  if (battleStartedAt) {
    return Math.max(0.001, (Date.now() - battleStartedAt) / 1000);
  }

  return Math.max(0.001, lastBattleDurationMs / 1000);
}

function getUnitDps(unit) {
  const elapsedSeconds = getBattleElapsedSeconds();
  return (unit.stats?.damage ?? 0) / elapsedSeconds;
}

function getRoleColor(role) {
  return ROLE_STATS[normalizeRole(role)]?.color ?? "black";
}

function getUnitRange(unit) {
  return Math.max(1, Number(unit.attackRange ?? getDefaultAbility(unit.role, "attackRange"))) * ATTACK_RANGE_UNIT;
}

function getAttackCooldown(unit) {
  const attackSpeed = Math.max(0.1, Number(unit.attackSpeed ?? getDefaultAbility(unit.role, "attackSpeed")));
  return Math.max(1, Math.round(BASE_ATTACK_COOLDOWN / attackSpeed));
}

function isMagicRole(role) {
  return normalizeRole(role) === "ranged" || normalizeRole(role) === "healer";
}

function getReducedDamage(attacker, target) {
  const isMagicDamage = isMagicRole(attacker.role);
  const rawDamage = Number(isMagicDamage ? attacker.magic : attacker.atk) || 0;
  const mitigation = Math.max(0, Math.min(100, Number(isMagicDamage ? target.resistance : target.defense) || 0));
  return Math.max(0, Math.round(rawDamage * (1 - mitigation / 100) * 10) / 10);
}

function getHealAmount(healer) {
  return Math.max(0, Number(isMagicRole(healer.role) ? healer.magic : healer.atk) || 0);
}

function normalizeFactionName(value) {
  return String(value ?? "").trim();
}

function getDefaultFactionName() {
  return factionsJson[0] ?? DEFAULT_FACTIONS[0];
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
        magic: roleStat.magic,
        speed: roleStat.speedMultiplier,
        attackSpeed: roleStat.attackSpeed,
        defense: roleStat.defense,
        resistance: roleStat.resistance,
        attackRange: roleStat.attackRange,
        role,
        faction: getDefaultFactionName()
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
    .map(item => {
      const role = normalizeRole(item.role);
      const normalizedItem = {
        [nameKey]: String(item[nameKey] ?? item.label ?? item.name ?? "").trim(),
        hp: Number(item.hp),
        atk: Number(item.atk),
        magic: normalizeCombatValue(item.magic, getDefaultAbility(role, "magic"), 0),
        speed: normalizeCombatValue(item.speed, getDefaultAbility(role, "speedMultiplier"), 0.1),
        attackSpeed: normalizeCombatValue(item.attackSpeed, getDefaultAbility(role, "attackSpeed"), 0.1),
        defense: Math.min(100, normalizeCombatValue(item.defense, getDefaultAbility(role, "defense"), 0)),
        resistance: Math.min(100, normalizeCombatValue(item.resistance, getDefaultAbility(role, "resistance"), 0)),
        attackRange: normalizeCombatValue(item.attackRange, getDefaultAbility(role, "attackRange"), 1),
        role
      };

      if (nameKey === "name") {
        normalizedItem.attributes = createCharacterAttributes(item.attributes);
        normalizedItem.faction = normalizeFactionName(item.faction) || getDefaultFactionName();
      }

      return normalizedItem;
    })
    .filter(item => item[nameKey] && item.hp > 0 && item.atk > 0 && item.magic >= 0 && item.speed > 0
      && item.attackSpeed > 0 && item.defense >= 0 && item.resistance >= 0 && item.attackRange >= 1 && ROLES.includes(item.role));

  return normalized.length > 0 ? normalized : defaults.map(item => ({ ...item }));
}

async function showPage(pageName) {
  battlePageEl.classList.toggle("hidden", pageName !== "battle");
  monsterPageEl.classList.toggle("hidden", pageName !== "monster");
  characterPageEl.classList.toggle("hidden", pageName !== "character");
  factionPageEl.classList.toggle("hidden", pageName !== "faction");
  statsPageEl.classList.toggle("hidden", pageName !== "stats");
  recordPageEl.classList.toggle("hidden", pageName !== "record");

  if (pageName === "monster") {
    await loadMonsterJson();
    enemySquad = [];
    refreshMonsterUI();
    updateStatusUI();
  } else if (pageName === "character") {
    await loadFactionJson();
    await loadCharacterJson();
    playerSquad = [];
    refreshCharacterUI();
  } else if (pageName === "faction") {
    await loadFactionJson();
    await loadCharacterJson();
    renderFactionPage();
  } else if (pageName === "stats") {
    await loadCharacterJson();
    renderStatsPage();
  } else if (pageName === "record") {
    await loadBattleRecordsJson();
    renderBattleRecords();
  }

  if (pageName === "battle") {
    resizeCanvas();
  }
}

function initRoleOptions() {
  const roleOptions = ROLES.map(role => `<option value="${role}">${getRoleLabel(role)}</option>`).join("");
  monsterRoleEl.innerHTML = roleOptions;
  characterRoleEl.innerHTML = roleOptions;
  renderCharacterFactionOptions();
}

function renderCharacterFactionOptions() {
  characterFactionEl.innerHTML = factionsJson.map(faction => `<option value="${escapeHtml(faction)}">${escapeHtml(faction)}</option>`).join("");
}

function renderStatus(units, colorResolver) {
  return units.map(unit => {
    const hpRatio = Math.max(0, (unit.hp / unit.maxHp) * 100);
    const hpText = `${Math.floor(unit.hp)} / ${unit.maxHp}`;
    const dpsText = `DPS ${getUnitDps(unit).toFixed(1)}`;

    return `
      <div class="unit-status">
        <div>${unit.name} (${getRoleLabel(unit.role)})</div>
        <div class="hp-track">
          <div class="hp-fill" style="width:${hpRatio}%; background:${colorResolver(unit)};"></div>
          <div class="hp-label">${hpText} · ${dpsText}</div>
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
