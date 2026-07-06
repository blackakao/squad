const canvas = document.getElementById("battleCanvas");
const ctx = canvas.getContext("2d");

const charactersEl = document.getElementById("characters");
const playerStatusEl = document.getElementById("playerStatus");
const enemyStatusEl = document.getElementById("enemyStatus");
const battleBtnEl = document.getElementById("battleBtn");
const enemyButtonsEl = document.getElementById("enemyButtons");
const battleTeamButtonsEl = document.getElementById("battleTeamButtons");
const battleSelectionSummaryEl = document.getElementById("battleSelectionSummary");
const enemyControlTitleEl = document.getElementById("enemyControlTitle");
const enemyStatusTitleEl = document.getElementById("enemyStatusTitle");
const battlePageEl = document.getElementById("root");
const monsterPageEl = document.getElementById("monsterPage");
const characterPageEl = document.getElementById("characterPage");
const teamPageEl = document.getElementById("teamPage");
const statsPageEl = document.getElementById("statsPage");
const recordPageEl = document.getElementById("recordPage");
const equipmentPageEl = document.getElementById("equipmentPage");
const itemPageEl = document.getElementById("itemPage");
const categoryPageEl = document.getElementById("categoryPage");
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
const monsterPortraitEl = document.getElementById("monsterPortrait");
const monsterPortraitPreviewEl = document.getElementById("monsterPortraitPreview");
const characterTableBodyEl = document.getElementById("characterTableBody");
const characterRoleFilterEl = document.getElementById("characterRoleFilter");
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
const characterPortraitEl = document.getElementById("characterPortrait");
const characterPortraitPreviewEl = document.getElementById("characterPortraitPreview");
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
const itemWeaponCategoryEl = document.getElementById("itemWeaponCategory");
const itemArmorCategoryEl = document.getElementById("itemArmorCategory");
const itemHandTypeEl = document.getElementById("itemHandType");
const itemWeaponSlotTypeEl = document.getElementById("itemWeaponSlotType");
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
const weaponCategoryTableBodyEl = document.getElementById("weaponCategoryTableBody");
const armorCategoryTableBodyEl = document.getElementById("armorCategoryTableBody");
const weaponCategoryModalEl = document.getElementById("weaponCategoryModal");
const weaponCategoryModalTitleEl = document.getElementById("weaponCategoryModalTitle");
const weaponCategoryFormEl = document.getElementById("weaponCategoryForm");
const weaponCategoryEditIndexEl = document.getElementById("weaponCategoryEditIndex");
const weaponCategoryNameEl = document.getElementById("weaponCategoryName");
const weaponCategoryHandTypeEl = document.getElementById("weaponCategoryHandType");
const weaponCategoryAttackRangeEl = document.getElementById("weaponCategoryAttackRange");
const weaponCategoryAttackSpeedEl = document.getElementById("weaponCategoryAttackSpeed");
const weaponCategoryCastSpeedEl = document.getElementById("weaponCategoryCastSpeed");
const weaponCategoryAttackTypeEl = document.getElementById("weaponCategoryAttackType");
const weaponCategorySlotTypeEl = document.getElementById("weaponCategorySlotType");
const armorCategoryModalEl = document.getElementById("armorCategoryModal");
const armorCategoryModalTitleEl = document.getElementById("armorCategoryModalTitle");
const armorCategoryFormEl = document.getElementById("armorCategoryForm");
const armorCategoryEditIndexEl = document.getElementById("armorCategoryEditIndex");
const armorCategoryNameEl = document.getElementById("armorCategoryName");
const teamNameEl = document.getElementById("teamName");
const teamListEl = document.getElementById("teamList");
const teamSelectedNameEl = document.getElementById("teamSelectedName");
const teamMemberSummaryEl = document.getElementById("teamMemberSummary");
const teamMemberListEl = document.getElementById("teamMemberList");
const teamCharacterListEl = document.getElementById("teamCharacterList");
const battleScreenModalEl = document.getElementById("battleScreenModal");

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
const WEAPON_SLOT_KEYS = ["mainWeapon", "subWeapon"];
const ARMOR_SLOT_KEYS = ["top", "bottom"];
const HAND_TYPES = [
  { key: "oneHand", label: "한손착용" },
  { key: "twoHand", label: "양손착용" }
];
const WEAPON_SLOT_TYPES = [
  { key: "mainOnly", label: "주무기 자리만" },
  { key: "subOnly", label: "보조무기 자리만" },
  { key: "both", label: "양쪽 다 착용 가능" }
];
const WEAPON_ATTACK_TYPES = [
  { key: "physical", label: "물리" },
  { key: "magic", label: "마법" }
];
const BARE_HAND_ATTACK_SPEED = 1;
const BARE_HAND_CAST_SPEED = 0.5;
const BARE_HAND_ATTACK_TYPE = "physical";
const DEFAULT_CATEGORIES = {
  weapons: [
    { key: "oneHandSword", label: "한손검", handType: "oneHand", attackRange: 1, attackSpeed: 1, castSpeed: 0.5, attackType: "physical", slotType: "both" },
    { key: "twoHandSword", label: "양손검", handType: "twoHand", attackRange: 1, attackSpeed: 1.2, castSpeed: 0.5, attackType: "physical", slotType: "mainOnly" },
    { key: "oneHandMace", label: "한손둔기", handType: "oneHand", attackRange: 1, attackSpeed: 1.1, castSpeed: 0.5, attackType: "physical", slotType: "both" },
    { key: "twoHandMace", label: "양손둔기", handType: "twoHand", attackRange: 1, attackSpeed: 1.3, castSpeed: 0.5, attackType: "physical", slotType: "mainOnly" },
    { key: "staff", label: "지팡이", handType: "twoHand", attackRange: 3, attackSpeed: 1, castSpeed: 1, attackType: "magic", slotType: "mainOnly" },
    { key: "bow", label: "활", handType: "twoHand", attackRange: 5, attackSpeed: 1, castSpeed: 0.5, attackType: "physical", slotType: "mainOnly" },
    { key: "gun", label: "총", handType: "twoHand", attackRange: 5, attackSpeed: 0.8, castSpeed: 0.5, attackType: "physical", slotType: "mainOnly" }
  ],
  armors: [
    { key: "plate", label: "판금" },
    { key: "chain", label: "사슬" },
    { key: "leather", label: "가죽" },
    { key: "cloth", label: "천" }
  ]
};
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
  teams: "/api/teams",
  records: "/api/records",
  items: "/api/items",
  categories: "/api/categories"
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
const PORTRAIT_MAX_SIZE = 256;
const PORTRAIT_MAX_FILE_SIZE = 5 * 1024 * 1024;
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
let teamsJson = [];
let battleRecordsJson = [];
let itemsJson = [];
let categoriesJson = {
  weapons: DEFAULT_CATEGORIES.weapons.map(category => ({ ...category })),
  armors: DEFAULT_CATEGORIES.armors.map(category => ({ ...category }))
};
let battleStartedAt = null;
let battleStartedAtText = "";
let lastBattleDurationMs = 0;
let lastResourceUpdateAt = null;
let selectedStatCharacterIndex = "";
let selectedEquipmentCharacterIndex = "";
let selectedItemSlotFilter = "all";
let selectedEquipmentItemSlotFilter = "all";
let selectedCharacterRoleFilter = "all";
let selectedTeamIndex = "";
let selectedTeamMemberIds = [];
let selectedBattleTeamIds = new Set();
let selectedBattleCharacterIds = new Set();
let selectedEnemyTeamIndex = "";
let battleMode = "monster";
const portraitImageCache = new Map();
const portraitDrafts = {
  monster: { dataUrl: "", cleared: false },
  character: { dataUrl: "", cleared: false }
};

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
    attackSpeed: Math.floor(agi / 10) * -0.1,
    castSpeed: Math.floor(focus / 10) * -0.1,
    defense: Math.floor(str / 10) + Math.floor(vit / 5),
    resistance: Math.floor(vit / 10) + Math.floor(int / 10) + Math.floor(wis / 5),
    attackRange: 0
  };
}

function getEquippedWeaponItemForCombat(character) {
  const equipment = createEquipmentSlots(character?.equipment);
  const mainWeapon = getItemById(equipment.mainWeapon);

  if (isWeaponItem(mainWeapon)) {
    return mainWeapon;
  }

  const subWeapon = getItemById(equipment.subWeapon);
  return isWeaponItem(subWeapon) ? subWeapon : null;
}

function getWeaponCombatSettings(character) {
  const weapon = getEquippedWeaponItemForCombat(character);
  const category = getWeaponCategory(weapon?.weaponCategory);
  const categoryAttackSpeed = Number(category?.attackSpeed);
  const categoryCastSpeed = Number(category?.castSpeed);

  if (!category) {
    return {
      attackSpeed: BARE_HAND_ATTACK_SPEED,
      castSpeed: BARE_HAND_CAST_SPEED,
      attackType: BARE_HAND_ATTACK_TYPE
    };
  }

  return {
    attackSpeed: Number.isFinite(categoryAttackSpeed) && categoryAttackSpeed > 0 ? categoryAttackSpeed : BARE_HAND_ATTACK_SPEED,
    castSpeed: Math.max(0, Number.isFinite(categoryCastSpeed) ? categoryCastSpeed : BARE_HAND_CAST_SPEED),
    attackType: WEAPON_ATTACK_TYPES.some(type => type.key === category.attackType) ? category.attackType : BARE_HAND_ATTACK_TYPE
  };
}

function applyCharacterStatAbilities(character) {
  const attributes = createCharacterAttributes(character.attributes);
  const base = getBaseCharacterAbilities(character.role);
  const bonus = getStatAbilityBonus(attributes);
  const equipment = createEquipmentSlots(character.equipment);
  const equipmentBonus = getCharacterEquipmentBonus({ equipment });
  const weaponCombat = getWeaponCombatSettings({ ...character, equipment });

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
    attackSpeed: Math.max(0.1, Math.round((weaponCombat.attackSpeed + bonus.attackSpeed) * 100) / 100),
    castSpeed: Math.max(0, Math.round((weaponCombat.castSpeed + bonus.castSpeed) * 100) / 100),
    attackType: weaponCombat.attackType,
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

function getUnitAttackType(unit) {
  if (WEAPON_ATTACK_TYPES.some(type => type.key === unit?.attackType)) {
    return unit.attackType;
  }

  return isMagicRole(unit?.role) ? "magic" : "physical";
}

function isMagicAttackUnit(unit) {
  return getUnitAttackType(unit) === "magic";
}

function isPhysicalAttackRole(role) {
  const normalizedRole = normalizeRole(role);
  return normalizedRole === "tank" || normalizedRole === "melee";
}

function isPhysicalAttackUnit(unit) {
  return getUnitAttackType(unit) === "physical";
}

function getReducedDamage(attacker, target) {
  const isMagicDamage = isMagicAttackUnit(attacker);
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

function normalizePortrait(value) {
  const portrait = String(value ?? "").trim();
  return portrait.startsWith("data:image/") ? portrait : "";
}

function getPortraitElements(type) {
  if (type === "monster") {
    return { input: monsterPortraitEl, preview: monsterPortraitPreviewEl };
  }

  return { input: characterPortraitEl, preview: characterPortraitPreviewEl };
}

function setPortraitPreview(type, dataUrl) {
  const { preview } = getPortraitElements(type);
  if (!preview) {
    return;
  }

  const portrait = normalizePortrait(dataUrl);
  preview.src = portrait;
  preview.classList.toggle("hidden", !portrait);
}

function resetPortraitDraft(type, dataUrl = "") {
  const { input } = getPortraitElements(type);
  if (input) {
    input.value = "";
  }

  portraitDrafts[type] = { dataUrl: normalizePortrait(dataUrl), cleared: false };
  setPortraitPreview(type, dataUrl);
}

function clearPortrait(type) {
  const { input } = getPortraitElements(type);
  if (input) {
    input.value = "";
  }

  portraitDrafts[type] = { dataUrl: "", cleared: true };
  setPortraitPreview(type, "");
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });
}

async function resizePortraitDataUrl(dataUrl) {
  const image = await loadImage(dataUrl);
  const ratio = Math.min(1, PORTRAIT_MAX_SIZE / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * ratio));
  const height = Math.max(1, Math.round(image.height * ratio));
  const buffer = document.createElement("canvas");
  const bufferCtx = buffer.getContext("2d");

  buffer.width = width;
  buffer.height = height;
  bufferCtx.drawImage(image, 0, 0, width, height);
  return buffer.toDataURL("image/png");
}

async function previewPortraitFile(type) {
  const { input } = getPortraitElements(type);
  const file = input?.files?.[0];

  if (!file) {
    return;
  }

  if (!file.type.startsWith("image/")) {
    alert("이미지 파일을 선택해주세요.");
    input.value = "";
    return;
  }

  if (file.size > PORTRAIT_MAX_FILE_SIZE) {
    alert("초상화 파일은 5MB 이하로 선택해주세요.");
    input.value = "";
    return;
  }

  try {
    const dataUrl = await resizePortraitDataUrl(await readFileAsDataUrl(file));
    portraitDrafts[type] = { dataUrl, cleared: false };
    setPortraitPreview(type, dataUrl);
  } catch (error) {
    logError("portrait", "초상화 파일을 읽는 중 실패했습니다.", error);
    alert("초상화 파일을 읽지 못했습니다.");
    input.value = "";
  }
}

async function getPortraitForSave(type, previousPortrait = "") {
  const draft = portraitDrafts[type] ?? { dataUrl: "", cleared: false };
  const { input } = getPortraitElements(type);

  if (draft.cleared) {
    return "";
  }

  if (!draft.dataUrl && input?.files?.[0]) {
    const file = input.files[0];
    if (file.type.startsWith("image/") && file.size <= PORTRAIT_MAX_FILE_SIZE) {
      try {
        const dataUrl = await resizePortraitDataUrl(await readFileAsDataUrl(file));
        portraitDrafts[type] = { dataUrl, cleared: false };
        setPortraitPreview(type, dataUrl);
        return dataUrl;
      } catch (error) {
        logError("portrait", "초상화 파일을 읽는 중 실패했습니다.", error);
        alert("초상화 파일을 읽지 못했습니다.");
      }
    }
  }

  return normalizePortrait(draft.dataUrl) || normalizePortrait(previousPortrait);
}

function renderPortraitCell(portrait, label) {
  const normalizedPortrait = normalizePortrait(portrait);

  if (!normalizedPortrait) {
    return `<span class="empty-text">없음</span>`;
  }

  return `<img class="portrait-thumb" src="${normalizedPortrait}" alt="${escapeHtml(label)} 초상화">`;
}

function getCachedPortraitImage(portrait) {
  const normalizedPortrait = normalizePortrait(portrait);

  if (!normalizedPortrait) {
    return null;
  }

  const cached = portraitImageCache.get(normalizedPortrait);
  if (cached) {
    return cached;
  }

  const image = new Image();
  image.src = normalizedPortrait;
  portraitImageCache.set(normalizedPortrait, image);
  return image;
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
        role,
        portrait: normalizePortrait(item.portrait)
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
  teamPageEl.classList.toggle("hidden", pageName !== "team");
  factionPageEl.classList.toggle("hidden", pageName !== "faction");
  statsPageEl.classList.toggle("hidden", pageName !== "stats");
  recordPageEl.classList.toggle("hidden", pageName !== "record");
  equipmentPageEl.classList.toggle("hidden", pageName !== "equipment");
  itemPageEl.classList.toggle("hidden", pageName !== "item");
  categoryPageEl.classList.toggle("hidden", pageName !== "category");
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
    selectedBattleTeamIds.clear();
    selectedBattleCharacterIds.clear();
    refreshCharacterUI();
  } else if (pageName === "team") {
    await loadCharacterJson();
    await loadTeamJson();
    renderTeamPage();
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
    await loadCategoryJson();
    await loadItemJson();
    await loadCharacterJson();
    renderEquipmentPage();
  } else if (pageName === "item") {
    await loadCategoryJson();
    await loadItemJson();
    renderItemPage();
  } else if (pageName === "category") {
    await loadCategoryJson();
    await loadItemJson();
    renderCategoryPage();
  } else if (pageName === "log") {
    renderLogPage();
  }

  if (pageName === "battle") {
    await loadTeamJson();
    renderBattleTeamButtons();
    renderBattleEnemyControls();
    resizeCanvas();
  }
}

function initRoleOptions() {
  const roleOptions = ROLES.map(role => `<option value="${role}">${getRoleLabel(role)}</option>`).join("");
  monsterRoleEl.innerHTML = roleOptions;
  characterRoleEl.innerHTML = roleOptions;
  if (characterRoleFilterEl) {
    characterRoleFilterEl.innerHTML = `<option value="all">전체</option>${roleOptions}`;
  }
  itemSlotEl.innerHTML = EQUIPMENT_SLOTS.map(slot => `<option value="${slot.key}">${slot.label}</option>`).join("");
  renderCategoryOptions();
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
  if (!canvas?.parentElement) {
    return;
  }

  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
  scale = canvas.width / 400;
}

function openBattleScreenModal() {
  battleScreenModalEl.classList.remove("hidden");
  resizeCanvas();
  updateStatusUI();
}

function closeBattleScreenModal() {
  battleScreenModalEl.classList.add("hidden");
}
