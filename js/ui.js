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
const equipmentPageEl = document.getElementById("equipmentPage");
const itemPageEl = document.getElementById("itemPage");
const logPageEl = document.getElementById("logPage");
const monsterTableBodyEl = document.getElementById("monsterTableBody");
const recordTableBodyEl = document.getElementById("recordTableBody");
const recordPaginationEl = document.getElementById("recordPagination");
const monsterModalEl = document.getElementById("monsterModal");
const monsterModalTitleEl = document.getElementById("monsterModalTitle");
const monsterFormEl = document.getElementById("monsterForm");
const monsterEditIndexEl = document.getElementById("monsterEditIndex");
const monsterLabelEl = document.getElementById("monsterLabel");
const monsterHpEl = document.getElementById("monsterHp");
const monsterMpEl = document.getElementById("monsterMp");
const monsterStEl = document.getElementById("monsterSt");
const monsterAtkEl = document.getElementById("monsterAtk");
const monsterMagicEl = document.getElementById("monsterMagic");
const monsterSpeedEl = document.getElementById("monsterSpeed");
const monsterAttackSpeedEl = document.getElementById("monsterAttackSpeed");
const monsterCastSpeedEl = document.getElementById("monsterCastSpeed");
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
const characterMpEl = document.getElementById("characterMp");
const characterStEl = document.getElementById("characterSt");
const characterAtkEl = document.getElementById("characterAtk");
const characterMagicEl = document.getElementById("characterMagic");
const characterSpeedEl = document.getElementById("characterSpeed");
const characterAttackSpeedEl = document.getElementById("characterAttackSpeed");
const characterCastSpeedEl = document.getElementById("characterCastSpeed");
const characterDefenseEl = document.getElementById("characterDefense");
const characterResistanceEl = document.getElementById("characterResistance");
const characterAttackRangeEl = document.getElementById("characterAttackRange");
const characterRoleEl = document.getElementById("characterRole");
const characterFactionEl = document.getElementById("characterFaction");
const statCharacterButtonsEl = document.getElementById("statCharacterButtons");
const statSelectedNameEl = document.getElementById("statSelectedName");
const statPointSummaryEl = document.getElementById("statPointSummary");
const statRowsEl = document.getElementById("statRows");
const statAbilityPreviewEl = document.getElementById("statAbilityPreview");
const equipmentCharacterButtonsEl = document.getElementById("equipmentCharacterButtons");
const equipmentSlotGridEl = document.getElementById("equipmentSlotGrid");
const equipmentItemTableBodyEl = document.getElementById("equipmentItemTableBody");
const equipmentAbilityPreviewEl = document.getElementById("equipmentAbilityPreview");
const equipmentItemSlotFilterEl = document.getElementById("equipmentItemSlotFilter");
const itemTableBodyEl = document.getElementById("itemTableBody");
const itemSlotFilterEl = document.getElementById("itemSlotFilter");
const itemModalEl = document.getElementById("itemModal");
const itemModalTitleEl = document.getElementById("itemModalTitle");
const itemFormEl = document.getElementById("itemForm");
const itemEditIndexEl = document.getElementById("itemEditIndex");
const itemNameEl = document.getElementById("itemName");
const itemSlotEl = document.getElementById("itemSlot");
const itemHpEl = document.getElementById("itemHp");
const itemMpEl = document.getElementById("itemMp");
const itemStEl = document.getElementById("itemSt");
const itemAtkEl = document.getElementById("itemAtk");
const itemMagicEl = document.getElementById("itemMagic");
const itemSpeedEl = document.getElementById("itemSpeed");
const itemAttackSpeedEl = document.getElementById("itemAttackSpeed");
const itemCastSpeedEl = document.getElementById("itemCastSpeed");
const itemDefenseEl = document.getElementById("itemDefense");
const itemResistanceEl = document.getElementById("itemResistance");
const itemAttackRangeEl = document.getElementById("itemAttackRange");

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
const EQUIPMENT_SLOTS = [
  { key: "mainWeapon", label: "주무기" },
  { key: "subWeapon", label: "보조무기" },
  { key: "top", label: "상의" },
  { key: "bottom", label: "하의" },
  { key: "accessory", label: "장신구" },
  { key: "special", label: "특수장비" }
];
const ABILITY_ROWS = [
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
const CHARACTER_STAT_MAX = 50;
const CHARACTER_STAT_TOTAL = 150;
const CHARACTER_STAT_STEP = 10;
const DEFAULT_RESOURCE_VALUE = 100;
const MP_ACTION_COST = 5;
const MP_REGEN_PER_SECOND = 1;
const ST_MOVE_COST_PER_SECOND = 1;
const ST_IDLE_REGEN_PER_SECOND = 10;
const ST_EXHAUSTED_MIN_RECOVERY_RATIO = 0.6;
const ST_EXHAUSTED_REGEN_RATIO_PER_SECOND = 0.05;
const ST_EXHAUSTED_REGEN_FLAT_PER_SECOND = 25;
const ST_PHYSICAL_ATTACK_COST = 10;
const EXHAUSTED_MOVE_MULTIPLIER = 0.5;
const EXHAUSTED_ATTACK_SPEED_MULTIPLIER = 0.7;
const API_URLS = {
  monsters: "/api/monsters",
  characters: "/api/characters",
  factions: "/api/factions",
  records: "/api/records",
  items: "/api/items"
};
const DEFAULT_MONSTER_JSON = [
  { label: "슬라임", hp: 2000, mp: DEFAULT_RESOURCE_VALUE, st: DEFAULT_RESOURCE_VALUE, atk: 8, magic: 10, speed: 1.2, attackSpeed: 1, castSpeed: 0.5, defense: 0, resistance: 0, attackRange: 1, role: "melee" },
  { label: "오크", hp: 2000, mp: DEFAULT_RESOURCE_VALUE, st: DEFAULT_RESOURCE_VALUE, atk: 12, magic: 10, speed: 1, attackSpeed: 0.1, castSpeed: 3, defense: 0, resistance: 0, attackRange: 1, role: "ranged" },
  { label: "드래곤", hp: 2000, mp: DEFAULT_RESOURCE_VALUE, st: DEFAULT_RESOURCE_VALUE, atk: 20, magic: 10, speed: 1.2, attackSpeed: 1, castSpeed: 0.5, defense: 0, resistance: 0, attackRange: 1, role: "melee" }
];

const ROLE_STATS = {
  tank: { hp: 2000, mp: DEFAULT_RESOURCE_VALUE, st: DEFAULT_RESOURCE_VALUE, atk: 10, magic: 10, color: "gray", attackRange: 1, attackSpeed: 2, castSpeed: 1, defense: 0, resistance: 0, speedMultiplier: 1.2 },
  melee: { hp: 2000, mp: DEFAULT_RESOURCE_VALUE, st: DEFAULT_RESOURCE_VALUE, atk: 10, magic: 10, color: "yellow", attackRange: 1, attackSpeed: 1, castSpeed: 0.5, defense: 0, resistance: 0, speedMultiplier: 1.2 },
  ranged: { hp: 2000, mp: DEFAULT_RESOURCE_VALUE, st: DEFAULT_RESOURCE_VALUE, atk: 12, magic: 10, color: "blue", attackRange: 1, attackSpeed: 0.1, castSpeed: 3, defense: 0, resistance: 0, speedMultiplier: 1 },
  healer: { hp: 2000, mp: DEFAULT_RESOURCE_VALUE, st: DEFAULT_RESOURCE_VALUE, atk: 10, magic: 10, color: "violet", attackRange: 1, attackSpeed: 0.1, castSpeed: 2, defense: 0, resistance: 0, speedMultiplier: 1 },
  special: { hp: 2000, mp: DEFAULT_RESOURCE_VALUE, st: DEFAULT_RESOURCE_VALUE, atk: 10, magic: 10, color: "orange", attackRange: 1, attackSpeed: 1, castSpeed: 1, defense: 0, resistance: 0, speedMultiplier: 1 }
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
let itemsJson = [];
let battleStartedAt = null;
let battleStartedAtText = "";
let lastBattleDurationMs = 0;
let lastResourceUpdateAt = null;
let selectedStatCharacterIndex = "";
let selectedEquipmentCharacterIndex = "";
let selectedItemSlotFilter = "all";
let selectedEquipmentItemSlotFilter = "all";

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

function getBaseCharacterAbilities(role) {
  const normalizedRole = normalizeRole(role);
  const roleStat = ROLE_STATS[normalizedRole] ?? ROLE_STATS.melee;

  return {
    hp: roleStat.hp,
    mp: roleStat.mp,
    st: roleStat.st,
    atk: roleStat.atk,
    magic: roleStat.magic,
    speed: roleStat.speedMultiplier,
    attackSpeed: roleStat.attackSpeed,
    castSpeed: roleStat.castSpeed,
    defense: roleStat.defense,
    resistance: roleStat.resistance,
    attackRange: roleStat.attackRange
  };
}

function getStatAbilityBonus(attributes = {}) {
  const str = Number(attributes.str) || 0;
  const vit = Number(attributes.vit) || 0;
  const agi = Number(attributes.agi) || 0;
  const focus = Number(attributes.focus) || 0;
  const int = Number(attributes.int) || 0;
  const wis = Number(attributes.wis) || 0;

  return {
    hp: vit * 50,
    mp: Math.floor(int / 10) * 10 + wis,
    st: agi,
    atk: str + Math.floor(focus / 5),
    magic: int,
    speed: Math.floor(agi / 5) * 0.1,
    attackSpeed: Math.floor(agi / 10) * 0.1 + Math.floor(focus / 20) * 0.1,
    castSpeed: Math.floor(agi / 10) * 0.1 + Math.floor(focus / 5) * 0.1,
    defense: Math.floor(str / 10) + Math.floor(vit / 5),
    resistance: Math.floor(vit / 10) + Math.floor(int / 10) + Math.floor(wis / 5),
    attackRange: 0
  };
}

function applyCharacterStatAbilities(character) {
  const attributes = createCharacterAttributes(character.attributes);
  const base = getBaseCharacterAbilities(character.role);
  const bonus = getStatAbilityBonus(attributes);
  const equipment = createEquipmentSlots(character.equipment);
  const equipmentBonus = getCharacterEquipmentBonus({ equipment });

  return {
    ...character,
    attributes,
    equipment,
    hp: base.hp + bonus.hp + equipmentBonus.hp,
    mp: base.mp + bonus.mp + equipmentBonus.mp,
    st: base.st + bonus.st + equipmentBonus.st,
    atk: base.atk + bonus.atk + equipmentBonus.atk,
    magic: base.magic + bonus.magic + equipmentBonus.magic,
    speed: Math.round((base.speed + bonus.speed + equipmentBonus.speed) * 10) / 10,
    attackSpeed: Math.max(0.1, Math.round((base.attackSpeed - bonus.attackSpeed + equipmentBonus.attackSpeed) * 100) / 100),
    castSpeed: Math.max(0, Math.round((base.castSpeed - bonus.castSpeed + equipmentBonus.castSpeed) * 100) / 100),
    defense: base.defense + bonus.defense + equipmentBonus.defense,
    resistance: base.resistance + bonus.resistance + equipmentBonus.resistance,
    attackRange: Math.max(1, base.attackRange + bonus.attackRange + equipmentBonus.attackRange)
  };
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
  const exhaustedMultiplier = unit.exhausted ? EXHAUSTED_ATTACK_SPEED_MULTIPLIER : 1;
  return Math.max(1, Math.round(BASE_ATTACK_COOLDOWN * (attackSpeed / exhaustedMultiplier)));
}

function getCastDuration(unit) {
  const castSpeed = Math.max(0, Number(unit.castSpeed ?? getDefaultAbility(unit.role, "castSpeed")));
  return Math.max(0, Math.round(BASE_ATTACK_COOLDOWN * castSpeed));
}

function isMagicRole(role) {
  return normalizeRole(role) === "ranged" || normalizeRole(role) === "healer";
}

function isPhysicalAttackRole(role) {
  const normalizedRole = normalizeRole(role);
  return normalizedRole === "tank" || normalizedRole === "melee";
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
        mp: roleStat.mp,
        st: roleStat.st,
        atk: roleStat.atk,
        magic: roleStat.magic,
        speed: roleStat.speedMultiplier,
        attackSpeed: roleStat.attackSpeed,
        castSpeed: roleStat.castSpeed,
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
        mp: normalizeCombatValue(item.mp, getDefaultAbility(role, "mp"), 0),
        st: normalizeCombatValue(item.st, getDefaultAbility(role, "st"), 0),
        atk: Number(item.atk),
        magic: normalizeCombatValue(item.magic, getDefaultAbility(role, "magic"), 0),
        speed: normalizeCombatValue(item.speed, getDefaultAbility(role, "speedMultiplier"), 0.1),
        attackSpeed: normalizeCombatValue(item.attackSpeed, getDefaultAbility(role, "attackSpeed"), 0.1),
        castSpeed: normalizeCombatValue(item.castSpeed, getDefaultAbility(role, "castSpeed"), 0),
        defense: Math.min(100, normalizeCombatValue(item.defense, getDefaultAbility(role, "defense"), 0)),
        resistance: Math.min(100, normalizeCombatValue(item.resistance, getDefaultAbility(role, "resistance"), 0)),
        attackRange: normalizeCombatValue(item.attackRange, getDefaultAbility(role, "attackRange"), 1),
        role
      };

      if (nameKey === "name") {
        normalizedItem.attributes = createCharacterAttributes(item.attributes);
        normalizedItem.equipment = createEquipmentSlots(item.equipment);
        normalizedItem.faction = normalizeFactionName(item.faction) || getDefaultFactionName();
        return applyCharacterStatAbilities(normalizedItem);
      }

      return normalizedItem;
    })
    .filter(item => item[nameKey] && item.hp > 0 && item.mp >= 0 && item.st >= 0 && item.atk > 0 && item.magic >= 0 && item.speed > 0
      && item.attackSpeed > 0 && item.castSpeed >= 0 && item.defense >= 0 && item.resistance >= 0 && item.attackRange >= 1 && ROLES.includes(item.role));

  return normalized.length > 0 ? normalized : defaults.map(item => ({ ...item }));
}

async function showPage(pageName) {
  battlePageEl.classList.toggle("hidden", pageName !== "battle");
  monsterPageEl.classList.toggle("hidden", pageName !== "monster");
  characterPageEl.classList.toggle("hidden", pageName !== "character");
  factionPageEl.classList.toggle("hidden", pageName !== "faction");
  statsPageEl.classList.toggle("hidden", pageName !== "stats");
  recordPageEl.classList.toggle("hidden", pageName !== "record");
  equipmentPageEl.classList.toggle("hidden", pageName !== "equipment");
  itemPageEl.classList.toggle("hidden", pageName !== "item");
  logPageEl.classList.toggle("hidden", pageName !== "log");

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
  } else if (pageName === "equipment") {
    await loadItemJson();
    await loadCharacterJson();
    renderEquipmentPage();
  } else if (pageName === "item") {
    await loadItemJson();
    renderItemPage();
  } else if (pageName === "log") {
    renderLogPage();
  }

  if (pageName === "battle") {
    resizeCanvas();
  }
}

function initRoleOptions() {
  const roleOptions = ROLES.map(role => `<option value="${role}">${getRoleLabel(role)}</option>`).join("");
  monsterRoleEl.innerHTML = roleOptions;
  characterRoleEl.innerHTML = roleOptions;
  itemSlotEl.innerHTML = EQUIPMENT_SLOTS.map(slot => `<option value="${slot.key}">${slot.label}</option>`).join("");
  if (itemSlotFilterEl) {
    itemSlotFilterEl.innerHTML = `<option value="all">전체</option>${EQUIPMENT_SLOTS.map(slot => `<option value="${slot.key}">${slot.label}</option>`).join("")}`;
  }
  if (equipmentItemSlotFilterEl) {
    equipmentItemSlotFilterEl.innerHTML = `<option value="all">전체</option>${EQUIPMENT_SLOTS.map(slot => `<option value="${slot.key}">${slot.label}</option>`).join("")}`;
  }
  renderCharacterFactionOptions();
}

function renderCharacterFactionOptions() {
  characterFactionEl.innerHTML = factionsJson.map(faction => `<option value="${escapeHtml(faction)}">${escapeHtml(faction)}</option>`).join("");
}

function renderStatus(units, colorResolver) {
  return units.map(unit => {
    const hpRatio = Math.max(0, (unit.hp / unit.maxHp) * 100);
    const hpText = `${Math.floor(unit.hp)} / ${unit.maxHp}`;
    const maxMp = Math.max(0, Number(unit.maxMp ?? DEFAULT_RESOURCE_VALUE));
    const mp = Math.max(0, Number(unit.mp ?? maxMp));
    const mpRatio = maxMp > 0 ? Math.max(0, Math.min(100, (mp / maxMp) * 100)) : 0;
    const mpText = `${Math.floor(mp)} / ${maxMp}`;
    const maxSt = Math.max(0, Number(unit.maxSt ?? DEFAULT_RESOURCE_VALUE));
    const st = Math.max(0, Number(unit.st ?? maxSt));
    const stRatio = maxSt > 0 ? Math.max(0, Math.min(100, (st / maxSt) * 100)) : 0;
    const stText = `${Math.floor(st)} / ${maxSt}`;
    const castDuration = Math.max(0, Number(unit.castDuration ?? 0));
    const castTimer = Math.max(0, Number(unit.castTimer ?? 0));
    const isCasting = castDuration > 0 && castTimer > 0;
    const castRatio = isCasting ? Math.max(0, Math.min(100, ((castDuration - castTimer) / castDuration) * 100)) : 0;
    const castRemainingText = isCasting ? `${(castTimer / BASE_ATTACK_COOLDOWN).toFixed(1)}초` : "-";
    const castText = isCasting ? `시전 중 ${castRemainingText}` : "시전 대기";
    const exhaustedText = unit.exhausted ? " · 지침" : "";
    const dpsText = `DPS ${getUnitDps(unit).toFixed(1)}`;

    return `
      <div class="unit-status">
        <div>${unit.name} (${getRoleLabel(unit.role)})</div>
        <div class="hp-track">
          <div class="hp-fill" style="width:${hpRatio}%; background:${colorResolver(unit)};"></div>
          <div class="hp-label">HP ${hpText} · ${dpsText}</div>
        </div>
        <div class="mp-track">
          <div class="mp-fill" style="width:${mpRatio}%;"></div>
          <div class="hp-label">MP ${mpText}</div>
        </div>
        <div class="st-track">
          <div class="st-fill" style="width:${stRatio}%;"></div>
          <div class="hp-label">ST ${stText}${exhaustedText}</div>
        </div>
        <div class="cast-track${isCasting ? " casting" : ""}">
          <div class="cast-fill" style="width:${castRatio}%;"></div>
          <div class="hp-label">${castText}</div>
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
