const SKILL_STORAGE_KEY = "squad-auto-battle-skills";
const DEFAULT_ATTACK_SKILL_ID = "skill_basic_weapon_attack";
const DEFAULT_HEAL_SKILL_ID = "skill_basic_heal";
const ACTIVE_ACTION_TYPES = ["deal_damage", "heal", "move", "transform", "add_state", "delete_state", "add_buff", "delete_buff", "summon_entity", "create_field"];
const LOCKED_ACTION_TYPES = ["override_rule", "copy_skill"];
const REMOVED_ACTION_TYPES = ["cast_skill"];
const ACTION_TYPES = [...ACTIVE_ACTION_TYPES, ...LOCKED_ACTION_TYPES, ...REMOVED_ACTION_TYPES];
const ACTION_TARGETS = ["self", "ally", "enemy"];
const ACTION_DAMAGE_TYPES = ["physical", "magic", "fixed"];
const ACTION_RESOURCES = ["HP", "MP", "ST", "BP"];
const HEAL_RESOURCES = ["HP", "MP", "ST", "BP"];
const ACTION_MOVE_TYPES = ["Walk", "Dash", "Teleport", "Knockback", "Pull", "Push"];
const MOVE_ACTION_TYPES = ["Dash", "Teleport"];
const RANGE_MODES = ["mainWeapon", "custom"];
const COEFFICIENT_TYPES = ["fixed", "calculated"];
const COEFFICIENT_FIELDS = ["str", "vit", "agi", "focus", "int", "wis", "hp", "mp", "st", "bp", "atk", "magic", "defense", "resistance"];
const COEFFICIENT_CALCS = ["flat", "percent"];
const RESOURCE_COST_MODES = ["fixed", "maxPercent", "currentPercent"];
const SKILL_SLOT_OPTIONS = [
  { key: "basic", label: "베이직" },
  { key: "active", label: "액티브" },
  { key: "passive", label: "패시브" }
];
const ACTION_TYPE_LABELS = {
  deal_damage: "피해",
  heal: "회복",
  move: "이동",
  transform: "변신",
  add_state: "상태 추가",
  delete_state: "상태 제거",
  add_buff: "버프 추가",
  delete_buff: "버프 제거",
  summon_entity: "개체 소환",
  create_field: "필드 생성",
  override_rule: "규칙 변경",
  copy_skill: "스킬 복사",
  cast_skill: "스킬 시전"
};
const ACTION_TARGET_LABELS = {
  self: "자신",
  ally: "아군",
  enemy: "적군"
};
const ACTION_DAMAGE_TYPE_LABELS = {
  physical: "물리",
  magic: "마법",
  fixed: "고정"
};
const ACTION_MOVE_TYPE_LABELS = {
  Walk: "걷기",
  Dash: "돌진",
  Teleport: "순간이동",
  Knockback: "넉백",
  Pull: "끌어오기",
  Push: "밀치기"
};
const RANGE_MODE_LABELS = {
  mainWeapon: "주장비",
  custom: "특정값"
};
const COEFFICIENT_TYPE_LABELS = {
  fixed: "고정계수",
  calculated: "계산계수"
};
const COEFFICIENT_FIELD_LABELS = {
  str: "힘",
  vit: "체력",
  agi: "민첩",
  focus: "집중",
  int: "지능",
  wis: "지혜",
  hp: "HP",
  mp: "MP",
  st: "ST",
  bp: "BP",
  atk: "공격력",
  magic: "마력",
  defense: "방어력",
  resistance: "저항력"
};
const COEFFICIENT_CALC_LABELS = {
  flat: "고정",
  percent: "%"
};
const RESOURCE_COST_MODE_LABELS = {
  fixed: "고정값",
  maxPercent: "전체의 %",
  currentPercent: "현재의 %"
};

function createDefaultCoefficient(type = "fixed") {
  return {
    type,
    field: "atk",
    calc: "percent",
    value: type === "fixed" ? 1 : 100
  };
}

function createDefaultResourceCost(resource = "MP") {
  return {
    resource,
    mode: "fixed",
    value: 0
  };
}

function createDefaultResourceCosts() {
  return [createDefaultResourceCost()];
}

function createDefaultAction(type = "deal_damage") {
  const coefficient = type === "heal"
    ? { ...createDefaultCoefficient("calculated"), field: "magic" }
    : { ...createDefaultCoefficient(type === "deal_damage" ? "calculated" : "fixed"), field: "atk" };

  return {
    type,
    target: type === "heal" ? "ally" : "enemy",
    rangeMode: "mainWeapon",
    rangeValue: 1,
    coefficients: [coefficient],
    healResource: "HP",
    damageType: type === "heal" ? "magic" : "physical",
    area: 0,
    critical: 0,
    penetration: 0,
    moveType: type === "move" ? "Dash" : "Walk",
    moveSpeed: 1,
    distance: type === "move" ? 10 : 0,
    duration: 0,
    fieldShape: "circle",
    fieldRadius: 0
  };
}

function createDefaultSkillJson() {
  return [
    { id: DEFAULT_ATTACK_SKILL_ID, name: "기본 무기 공격", slot: "basic", cooldown: 0, resourceCosts: [{ resource: "ST", mode: "fixed", value: 5 }], actions: [createDefaultAction("deal_damage")] },
    { id: DEFAULT_HEAL_SKILL_ID, name: "기본 회복", slot: "basic", cooldown: 0, resourceCosts: [{ resource: "MP", mode: "fixed", value: 5 }], actions: [createDefaultAction("heal")] }
  ];
}

function normalizeSkillCooldown(value) {
  const cooldown = Number(value);
  return Number.isFinite(cooldown) && cooldown >= 0 ? cooldown : 0;
}

function normalizeSkillSlot(slot) {
  return SKILL_SLOT_OPTIONS.some(option => option.key === slot) ? slot : "active";
}

function getSkillSlotLabel(slot) {
  return SKILL_SLOT_OPTIONS.find(option => option.key === slot)?.label ?? slot;
}

function getActionTargetsForType(type) {
  return type === "move" ? ["ally", "enemy"] : ACTION_TARGETS;
}

function normalizeActionType(type) {
  return ACTIVE_ACTION_TYPES.includes(type) ? type : "deal_damage";
}

function normalizeActionTarget(target, type = "deal_damage") {
  if (type === "move") {
    return ["ally", "enemy"].includes(target) ? target : "enemy";
  }
  if (ACTION_TARGETS.includes(target)) {
    return target;
  }
  return type === "heal" ? "ally" : "enemy";
}

function normalizeRange(action = {}) {
  const legacyRange = String(action.range ?? "");
  const rangeMode = RANGE_MODES.includes(action.rangeMode) ? action.rangeMode : legacyRange === "custom" ? "custom" : "mainWeapon";
  const rangeValue = Number(action.rangeValue ?? action.range_value ?? action.range);
  return {
    rangeMode,
    rangeValue: Number.isFinite(rangeValue) ? rangeValue : 1
  };
}

function normalizeCoefficient(coefficient = {}) {
  if (COEFFICIENT_TYPES.includes(coefficient.type)) {
    const type = coefficient.type;
    const field = COEFFICIENT_FIELDS.includes(coefficient.field) ? coefficient.field : "atk";
    const calc = COEFFICIENT_CALCS.includes(coefficient.calc) ? coefficient.calc : "percent";
    const value = Number(coefficient.value);
    return {
      type,
      field,
      calc,
      value: Number.isFinite(value) ? value : type === "fixed" ? 1 : 100
    };
  }

  const source = coefficient.source;
  const oldMode = coefficient.mode;
  const oldValue = Number(coefficient.value);
  if (source === "fixed" || !source) {
    return {
      type: "fixed",
      field: "atk",
      calc: "percent",
      value: Number.isFinite(oldValue) ? oldValue : 1
    };
  }

  return {
    type: "calculated",
    field: COEFFICIENT_FIELDS.includes(source) ? source : source === "stat" ? coefficient.stat ?? "str" : "atk",
    calc: oldMode === "percent" ? "percent" : "percent",
    value: oldMode === "percent" ? Number.isFinite(oldValue) ? oldValue : 100 : Number.isFinite(oldValue) ? oldValue * 100 : 100
  };
}

function normalizeActionCoefficients(action = {}) {
  if (action.type === "move") {
    return [];
  }
  if (Array.isArray(action.coefficients) && action.coefficients.length) {
    return action.coefficients.map(normalizeCoefficient);
  }

  if (String(action.value ?? "").trim() === "auto") {
    return [action.type === "heal" ? { ...createDefaultCoefficient("calculated"), field: "magic" } : createDefaultCoefficient("calculated")];
  }

  const migratedValue = Number(action.value);
  return [{ ...createDefaultCoefficient("fixed"), value: Number.isFinite(migratedValue) ? migratedValue : 1 }];
}

function normalizeResourceCost(cost = {}) {
  const raw = cost.resourceCost ?? cost.resource_cost ?? cost;
  const resource = ACTION_RESOURCES.includes(raw.resource) ? raw.resource : "MP";
  const mode = RESOURCE_COST_MODES.includes(raw.mode) ? raw.mode : "fixed";
  const value = Number(raw.value);
  return {
    resource,
    mode,
    value: Number.isFinite(value) ? value : 0
  };
}

function normalizeResourceCosts(action = {}) {
  const rawCosts = action.resourceCosts ?? action.resource_costs;
  if (Array.isArray(rawCosts)) {
    const costs = rawCosts.map(normalizeResourceCost);
    return costs.length ? costs : createDefaultResourceCosts();
  }
  return [normalizeResourceCost(action.resourceCost ?? action.resource_cost ?? { resource: action.resource })];
}

function normalizeSkillResourceCosts(skill = {}) {
  const rawCosts = skill.resourceCosts ?? skill.resource_costs;
  if (Array.isArray(rawCosts) && rawCosts.length) {
    return rawCosts.map(normalizeResourceCost);
  }

  const legacyCosts = Array.isArray(skill.actions)
    ? skill.actions.flatMap(action => {
      const actionCosts = action?.resourceCosts ?? action?.resource_costs;
      return Array.isArray(actionCosts) ? actionCosts : [];
    })
    : [];

  if (legacyCosts.length) {
    const seen = new Set();
    return legacyCosts
      .map(normalizeResourceCost)
      .filter(cost => {
        const key = `${cost.resource}:${cost.mode}:${cost.value}`;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
  }

  return createDefaultResourceCosts();
}

function normalizeSkillAction(action = {}) {
  const type = normalizeActionType(action.type);
  const damageTypeValue = action.damageType ?? action.damage_type;
  const moveTypeValue = action.moveType ?? action.move_type;
  const distanceValue = Number(action.distance);
  const moveSpeedValue = Number(action.moveSpeed ?? action.move_speed);
  const healResourceValue = action.healResource ?? action.heal_resource ?? action.effectResource ?? action.effect_resource ?? "HP";
  const range = normalizeRange(action);

  return {
    type,
    target: normalizeActionTarget(action.target, type),
    rangeMode: range.rangeMode,
    rangeValue: range.rangeValue,
    coefficients: normalizeActionCoefficients({ ...action, type }),
    healResource: HEAL_RESOURCES.includes(healResourceValue) ? healResourceValue : "HP",
    damageType: ACTION_DAMAGE_TYPES.includes(damageTypeValue) ? damageTypeValue : "physical",
    area: Number(action.area) || 0,
    critical: Number(action.critical) || 0,
    penetration: Number(action.penetration) || 0,
    moveType: type === "move"
      ? MOVE_ACTION_TYPES.includes(moveTypeValue) ? moveTypeValue : "Dash"
      : ACTION_MOVE_TYPES.includes(moveTypeValue) ? moveTypeValue : "Walk",
    moveSpeed: Number.isFinite(moveSpeedValue) ? Math.max(0, moveSpeedValue) : 1,
    distance: type === "move"
      ? Number.isFinite(distanceValue) ? Math.max(1, Math.min(10, distanceValue)) : 10
      : Number(action.distance) || 0,
    duration: Number(action.duration) || 0,
    fieldShape: String(action.fieldShape ?? action.field_shape ?? "circle"),
    fieldRadius: Number(action.fieldRadius ?? action.field_radius) || 0
  };
}

function normalizeSkillJson(skills) {
  const defaults = createDefaultSkillJson();
  const normalized = (Array.isArray(skills) && skills.length ? skills : defaults)
    .map((skill, index) => ({
      id: String(skill?.id ?? `skill_${Date.now()}_${index}`),
      name: String(skill?.name ?? "").trim(),
      slot: normalizeSkillSlot(String(skill?.slot ?? "active").trim()),
      cooldown: normalizeSkillCooldown(skill?.cooldown ?? skill?.reuseCooldown ?? skill?.reuse_cooldown),
      resourceCosts: normalizeSkillResourceCosts(skill),
      actions: Array.isArray(skill?.actions) && skill.actions.length ? skill.actions.map(normalizeSkillAction) : [createDefaultAction()]
    }))
    .filter(skill => skill.id && skill.name);

  defaults.forEach(defaultSkill => {
    if (!normalized.some(skill => skill.id === defaultSkill.id)) {
      normalized.unshift(defaultSkill);
    }
  });

  return normalized;
}

async function loadSkillJson() {
  let rawJson = null;

  try {
    const response = await fetch(API_URLS.skills, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    rawJson = await response.json();
    localStorage.setItem(SKILL_STORAGE_KEY, JSON.stringify(rawJson));
    log("스킬 데이터를 불러왔습니다.", "skill");
  } catch (error) {
    logError("skill", "스킬 API 데이터를 읽지 못했습니다. 브라우저 저장소를 확인합니다.", error);
  }

  if (!rawJson) {
    try {
      rawJson = JSON.parse(localStorage.getItem(SKILL_STORAGE_KEY) || "null");
      if (rawJson) {
        logWarn("skill", "스킬 API 대신 브라우저 저장소 데이터를 사용합니다.");
      }
    } catch (error) {
      logError("skill", "브라우저 저장소의 스킬 데이터를 읽지 못했습니다.", error);
      rawJson = null;
    }
  }

  skillsJson = normalizeSkillJson(rawJson || createDefaultSkillJson());
  localStorage.setItem(SKILL_STORAGE_KEY, JSON.stringify(skillsJson));
}

async function saveSkillJson() {
  skillsJson = normalizeSkillJson(skillsJson);
  localStorage.setItem(SKILL_STORAGE_KEY, JSON.stringify(skillsJson));

  try {
    await saveJsonFile("skills", skillsJson);
    log("스킬 데이터가 API와 브라우저 저장소에 저장되었습니다.", "skill");
  } catch (error) {
    logError("skill", "스킬 API 저장에 실패해 브라우저 저장소에만 저장했습니다.", error);
  }
}

function getSkillById(skillId) {
  return skillsJson.find(skill => skill.id === skillId);
}

function getSkillCooldownTicks(skill) {
  return Math.max(0, Math.round(normalizeSkillCooldown(skill?.cooldown) * BASE_ATTACK_COOLDOWN));
}

function getEquippedSkills(unit) {
  return (Array.isArray(unit?.skillIds) ? unit.skillIds : [])
    .map(getSkillById)
    .filter(skill => skill && !isDefaultSkill(skill.id) && skill.slot !== "passive");
}

function getActionRangePixels(source, action) {
  if (action.rangeMode === "custom") {
    return Math.max(1, Number(action.rangeValue) || 1) * ATTACK_RANGE_UNIT;
  }
  return getUnitRange(source);
}

function getSkillRangePixels(source, skill) {
  const ranges = skill.actions
    .map(action => getActionRangePixels(source, action))
    .filter(value => Number.isFinite(value) && value > 0);
  return ranges.length ? Math.max(...ranges) : getUnitRange(source);
}

function getSkillPrimaryTargetType(skill) {
  const targetAction = skill.actions.find(action => action.target && action.target !== "self");
  return targetAction?.target ?? "self";
}

function getResourceField(resource) {
  const normalized = String(resource ?? "").toUpperCase();
  if (normalized === "HP") return { current: "hp", max: "maxHp" };
  if (normalized === "MP") return { current: "mp", max: "maxMp" };
  if (normalized === "ST") return { current: "st", max: "maxSt" };
  if (normalized === "BP") return { current: "bp", max: "maxBp" };
  return null;
}

function getResourceCostAmount(unit, cost) {
  const field = getResourceField(cost.resource);
  if (!field) {
    return 0;
  }

  const value = Math.max(0, Number(cost.value) || 0);
  if (cost.mode === "maxPercent") {
    return (Math.max(0, Number(unit[field.max]) || 0) * value) / 100;
  }
  if (cost.mode === "currentPercent") {
    return (Math.max(0, Number(unit[field.current]) || 0) * value) / 100;
  }
  return value;
}

function getSkillResourceCosts(skill) {
  return normalizeSkillResourceCosts(skill);
}

function canPaySkillResourceCosts(unit, skill) {
  const totals = {};
  getSkillResourceCosts(skill).forEach(cost => {
    const field = getResourceField(cost.resource);
    if (!field) {
      return;
    }
    totals[field.current] = (totals[field.current] ?? 0) + getResourceCostAmount(unit, cost);
  });

  return Object.entries(totals).every(([currentKey, amount]) => (Number(unit[currentKey]) || 0) >= amount);
}

function spendSkillResourceCosts(unit, skill) {
  getSkillResourceCosts(skill).forEach(cost => {
    const field = getResourceField(cost.resource);
    if (!field) {
      return;
    }
    unit[field.current] = Math.max(0, (Number(unit[field.current]) || 0) - getResourceCostAmount(unit, cost));
  });
}

function getSkillOptionsHtml(selectedSkillId = "") {
  return [
    `<option value="">기본 공격</option>`,
    ...skillsJson.map(skill => `<option value="${skill.id}" ${skill.id === selectedSkillId ? "selected" : ""}>${escapeHtml(skill.name)}</option>`)
  ].join("");
}

function getCharacterSkillOptionsHtml(selectedSkillIds = []) {
  const selectedSet = new Set(selectedSkillIds);
  return skillsJson
    .filter(skill => !isDefaultSkill(skill.id))
    .map(skill => `<option value="${skill.id}" ${selectedSet.has(skill.id) ? "selected" : ""}>${escapeHtml(skill.name)} (${getSkillSlotLabel(skill.slot)})</option>`)
    .join("");
}

function isDefaultSkill(skillId) {
  return skillId === DEFAULT_ATTACK_SKILL_ID || skillId === DEFAULT_HEAL_SKILL_ID;
}

function createDefaultAttackSkillForUnit(unit) {
  const isMagic = getUnitAttackType(unit) === "magic";
  const action = createDefaultAction("deal_damage");
  action.damageType = isMagic ? "magic" : "physical";
  action.coefficients = [{ ...createDefaultCoefficient("calculated"), field: isMagic ? "magic" : "atk" }];
  return { id: DEFAULT_ATTACK_SKILL_ID, name: "기본 무기 공격", slot: "basic", actions: [action] };
}

function formatCoefficientSummary(coefficient) {
  if (coefficient.type === "fixed") {
    return `고정 ${coefficient.value}`;
  }
  return `${COEFFICIENT_FIELD_LABELS[coefficient.field] ?? coefficient.field} ${COEFFICIENT_CALC_LABELS[coefficient.calc] ?? coefficient.calc} ${coefficient.value}`;
}

function formatResourceCostSummary(resourceCost) {
  return `${resourceCost.resource} ${RESOURCE_COST_MODE_LABELS[resourceCost.mode]} ${resourceCost.value}`;
}

function formatResourceCostsSummary(resourceCosts) {
  return normalizeResourceCosts({ resourceCosts }).map(formatResourceCostSummary).join(" + ");
}

function formatRangeSummary(action) {
  return action.rangeMode === "mainWeapon" ? "주장비 사정거리" : `사정거리 ${action.rangeValue}`;
}

function formatActionSummary(action) {
  const coefficientText = action.coefficients.map(formatCoefficientSummary).join(" + ");
  const rangeText = formatRangeSummary(action);

  if (action.type === "deal_damage") {
    return `피해 / ${ACTION_TARGET_LABELS[action.target]} / ${ACTION_DAMAGE_TYPE_LABELS[action.damageType]} / ${rangeText} / ${coefficientText}`;
  }
  if (action.type === "heal") {
    return `회복 / ${ACTION_TARGET_LABELS[action.target]} / ${action.healResource} / ${rangeText} / ${coefficientText}`;
  }
  if (action.type === "move") {
    const speedText = action.moveType === "Dash" ? ` / 이동속도 +${action.moveSpeed}` : "";
    return `이동 / ${ACTION_TARGET_LABELS[action.target]} / ${ACTION_MOVE_TYPE_LABELS[action.moveType]} / 이동 거리 ${action.distance}${speedText}`;
  }
  if (action.type === "create_field") {
    return `필드 생성 / ${ACTION_TARGET_LABELS[action.target]} / 반경 ${action.fieldRadius} / ${rangeText} / ${coefficientText}`;
  }
  return `${ACTION_TYPE_LABELS[action.type] ?? action.type} / ${ACTION_TARGET_LABELS[action.target] ?? action.target}`;
}

function renderSkillPage() {
  if (!skillTableBodyEl) {
    return;
  }

  skillTableBodyEl.innerHTML = skillsJson.map((skill, index) => `
    <tr>
      <td><input type="checkbox" class="skill-check" value="${index}" ${isDefaultSkill(skill.id) ? "disabled" : ""}></td>
      <td>${escapeHtml(skill.name)}</td>
      <td>${escapeHtml(getSkillSlotLabel(skill.slot))}</td>
      <td>${skill.cooldown}</td>
      <td>${escapeHtml(`소모 ${formatResourceCostsSummary(skill.resourceCosts)}`)}<br>${skill.actions.map(action => escapeHtml(formatActionSummary(action))).join("<br>")}</td>
      <td><button type="button" onclick="openSkillModal(${index})">수정</button></td>
    </tr>
  `).join("");
}

function openSkillModal(index = "") {
  const skill = skillsJson[index];
  skillModalTitleEl.innerText = skill ? "스킬 수정" : "스킬 추가";
  skillEditIndexEl.value = skill ? index : "";
  skillNameEl.value = skill?.name ?? "";
  skillSlotEl.value = skill?.slot ?? "active";
  skillCooldownEl.value = skill?.cooldown ?? 0;
  renderSkillResourceCostsToForm(skill?.resourceCosts ?? normalizeSkillResourceCosts(skill));
  renderSkillActionRows(skill?.actions ?? [createDefaultAction()]);
  skillModalEl.classList.remove("hidden");
}

function closeSkillModal() {
  skillModalEl.classList.add("hidden");
  skillFormEl.reset();
  skillResourceCostsEl.innerHTML = "";
  skillActionsEl.innerHTML = "";
}

function renderSkillActionRows(actions) {
  skillActionsEl.innerHTML = actions.map((action, index) => renderSkillActionRow(normalizeSkillAction(action), index)).join("");
  skillActionsEl.querySelectorAll(".skill-action-row").forEach(updateSkillActionFieldVisibility);
}

function renderSkillActionRow(action, index) {
  const targetOptions = getActionTargetsForType(action.type);
  return `
    <div class="skill-action-row" data-action-index="${index}">
      <label class="skill-action-field">
        <span>액션 종류</span>
        <select class="skill-action-type" onchange="updateSkillActionFieldVisibility(this)">
          ${ACTIVE_ACTION_TYPES.map(type => `<option value="${type}" ${type === action.type ? "selected" : ""}>${ACTION_TYPE_LABELS[type] ?? type}</option>`).join("")}
        </select>
      </label>
      <label class="skill-action-field">
        <span>대상</span>
        <select class="skill-action-target">
          ${targetOptions.map(target => `<option value="${target}" ${target === action.target ? "selected" : ""}>${ACTION_TARGET_LABELS[target] ?? target}</option>`).join("")}
        </select>
      </label>
      <label class="skill-action-field" data-action-field="damageType">
        <span>피해 타입</span>
        <select class="skill-action-damage-type">
          ${ACTION_DAMAGE_TYPES.map(type => `<option value="${type}" ${type === action.damageType ? "selected" : ""}>${ACTION_DAMAGE_TYPE_LABELS[type] ?? type}</option>`).join("")}
        </select>
      </label>
      <label class="skill-action-field" data-action-field="moveType">
        <span>이동 방식</span>
        <select class="skill-action-move-type" onchange="updateSkillActionFieldVisibility(this)">
          ${MOVE_ACTION_TYPES.map(type => `<option value="${type}" ${type === action.moveType ? "selected" : ""}>${ACTION_MOVE_TYPE_LABELS[type] ?? type}</option>`).join("")}
        </select>
      </label>
      <label class="skill-action-field" data-action-field="moveSpeed">
        <span>이동속도</span>
        <input class="skill-action-move-speed" type="number" min="0" step="0.1" value="${action.moveSpeed}" placeholder="1">
      </label>
      <label class="skill-action-field" data-action-field="distance">
        <span>이동 거리</span>
        <input class="skill-action-distance" type="number" min="1" max="10" step="1" value="${action.distance}" placeholder="10">
      </label>
      <label class="skill-action-field" data-action-field="fieldRadius">
        <span>필드 반경</span>
        <input class="skill-action-field-radius" type="number" step="0.1" value="${action.fieldRadius}" placeholder="0">
      </label>
      <div class="skill-range-section" data-action-field="range">
        <div class="skill-subsection-header">사거리</div>
        <div class="skill-range-options">
          <label><input type="radio" name="skillRangeMode_${index}" value="mainWeapon" class="skill-range-mode" onchange="updateSkillRangeValueVisibility(this)" ${action.rangeMode === "mainWeapon" ? "checked" : ""}> 주장비</label>
          <label><input type="radio" name="skillRangeMode_${index}" value="custom" class="skill-range-mode" onchange="updateSkillRangeValueVisibility(this)" ${action.rangeMode === "custom" ? "checked" : ""}> 특정값</label>
          <label class="skill-inline-field skill-range-custom-field${action.rangeMode === "mainWeapon" ? " hidden" : ""}">
            <span>특정 사거리</span>
            <input class="skill-range-value" type="number" step="0.1" value="${action.rangeValue}" placeholder="사정거리">
          </label>
        </div>
      </div>
      <div class="skill-coefficients" data-action-field="coefficients">
        <div class="skill-coefficient-header">
          <span>계수</span>
          <button type="button" onclick="addSkillCoefficientRow(this)">계수 추가</button>
        </div>
        <label class="skill-inline-field skill-heal-resource-field" data-action-field="healResource">
          <span>회복대상값</span>
          <select class="skill-action-heal-resource">
            ${HEAL_RESOURCES.map(resource => `<option value="${resource}" ${resource === action.healResource ? "selected" : ""}>${resource}</option>`).join("")}
          </select>
        </label>
        <div class="skill-coefficient-label-row">
          <span>계수 유형</span>
          <span>필드</span>
          <span>값계산</span>
          <span>값입력</span>
          <span></span>
        </div>
        <div class="skill-coefficient-list">
          ${action.coefficients.map(coefficient => renderSkillCoefficientRow(coefficient)).join("")}
        </div>
      </div>
      <button type="button" onclick="removeSkillActionRow(this)">삭제</button>
    </div>
  `;
}

function renderSkillCoefficientRow(coefficient) {
  const normalized = normalizeCoefficient(coefficient);
  const detailFields = normalized.type === "calculated" ? `
      <select class="skill-coefficient-field">
        ${COEFFICIENT_FIELDS.map(field => `<option value="${field}" ${field === normalized.field ? "selected" : ""}>${COEFFICIENT_FIELD_LABELS[field] ?? field}</option>`).join("")}
      </select>
      <select class="skill-coefficient-calc">
        ${COEFFICIENT_CALCS.map(calc => `<option value="${calc}" ${calc === normalized.calc ? "selected" : ""}>${COEFFICIENT_CALC_LABELS[calc] ?? calc}</option>`).join("")}
      </select>
    ` : `
      <span class="skill-coefficient-empty"></span>
      <span class="skill-coefficient-empty"></span>
    `;
  return `
    <div class="skill-coefficient-row">
      <select class="skill-coefficient-type" onchange="refreshSkillCoefficientRow(this)">
        ${COEFFICIENT_TYPES.map(type => `<option value="${type}" ${type === normalized.type ? "selected" : ""}>${COEFFICIENT_TYPE_LABELS[type] ?? type}</option>`).join("")}
      </select>
      ${detailFields}
      <input class="skill-coefficient-value" type="number" step="0.1" value="${normalized.value}" placeholder="1">
      <button type="button" onclick="removeSkillCoefficientRow(this)">삭제</button>
    </div>
  `;
}

function renderSkillResourceCosts(resourceCosts) {
  return normalizeResourceCosts({ resourceCosts }).map(renderSkillResourceCostRow).join("");
}

function renderSkillResourceCostsToForm(resourceCosts) {
  skillResourceCostsEl.innerHTML = renderSkillResourceCosts(resourceCosts);
}

function renderSkillResourceCostRow(resourceCost) {
  const normalized = normalizeResourceCost(resourceCost);
  return `
    <div class="skill-resource-cost-row">
      <label class="skill-inline-field">
        <span>자원 종류</span>
        <select class="skill-resource-cost-resource">
          ${ACTION_RESOURCES.map(resource => `<option value="${resource}" ${resource === normalized.resource ? "selected" : ""}>${resource}</option>`).join("")}
        </select>
      </label>
      <label class="skill-inline-field">
        <span>소모 방식</span>
        <select class="skill-resource-cost-mode">
          ${RESOURCE_COST_MODES.map(mode => `<option value="${mode}" ${mode === normalized.mode ? "selected" : ""}>${RESOURCE_COST_MODE_LABELS[mode] ?? mode}</option>`).join("")}
        </select>
      </label>
      <label class="skill-inline-field">
        <span>소모치</span>
        <input class="skill-resource-cost-value" type="number" step="0.1" value="${normalized.value}" placeholder="0">
      </label>
      <button type="button" onclick="removeSkillResourceCostRow(this)">삭제</button>
    </div>
  `;
}

function addSkillActionRow() {
  const currentActions = readSkillActionsFromForm();
  currentActions.push(createDefaultAction());
  renderSkillActionRows(currentActions);
}

function removeSkillActionRow(button) {
  if (skillActionsEl.querySelectorAll(".skill-action-row").length <= 1) {
    alert("스킬에는 액션이 최소 1개 필요합니다.");
    return;
  }
  button.closest(".skill-action-row").remove();
}

function updateSkillActionFieldVisibility(selectOrRow) {
  const row = selectOrRow.closest?.(".skill-action-row") ?? selectOrRow;
  const type = row.querySelector(".skill-action-type")?.value ?? "deal_damage";
  updateSkillActionTargetOptions(row, type);
  normalizeMoveFields(row, type);
  const hiddenFieldsByType = {
    deal_damage: ["healResource", "moveType", "distance", "fieldRadius"],
    heal: ["damageType", "moveType", "distance", "fieldRadius", "moveSpeed"],
    move: ["damageType", "healResource", "range", "coefficients", "fieldRadius"]
  };
  const hiddenFields = [...(hiddenFieldsByType[type] ?? [])];
  const moveType = row.querySelector(".skill-action-move-type")?.value ?? "Dash";
  if (type !== "move" || moveType !== "Dash") {
    hiddenFields.push("moveSpeed");
  }

  row.querySelectorAll("[data-action-field]").forEach(field => {
    field.classList.toggle("hidden", hiddenFields.includes(field.dataset.actionField));
  });
}

function updateSkillActionTargetOptions(row, type) {
  const select = row.querySelector(".skill-action-target");
  const currentValue = select.value;
  const targets = getActionTargetsForType(type);
  const nextValue = targets.includes(currentValue) ? currentValue : targets[targets.length - 1];
  select.innerHTML = targets
    .map(target => `<option value="${target}" ${target === nextValue ? "selected" : ""}>${ACTION_TARGET_LABELS[target] ?? target}</option>`)
    .join("");
}

function normalizeMoveFields(row, type) {
  if (type !== "move") {
    return;
  }

  const moveTypeSelect = row.querySelector(".skill-action-move-type");
  if (!MOVE_ACTION_TYPES.includes(moveTypeSelect.value)) {
    moveTypeSelect.value = "Dash";
  }

  const distanceInput = row.querySelector(".skill-action-distance");
  const distanceValue = Number(distanceInput.value);
  if (!Number.isFinite(distanceValue) || distanceValue < 1) {
    distanceInput.value = 10;
  } else if (distanceValue > 10) {
    distanceInput.value = 10;
  }
}

function updateSkillRangeValueVisibility(radio) {
  const section = radio.closest(".skill-range-section");
  const checked = section.querySelector(".skill-range-mode:checked");
  const customField = section.querySelector(".skill-range-custom-field");
  customField.classList.toggle("hidden", checked?.value !== "custom");
}

function addSkillCoefficientRow(button) {
  const list = button.closest(".skill-coefficients").querySelector(".skill-coefficient-list");
  list.insertAdjacentHTML("beforeend", renderSkillCoefficientRow(createDefaultCoefficient()));
}

function refreshSkillCoefficientRow(select) {
  const row = select.closest(".skill-coefficient-row");
  row.outerHTML = renderSkillCoefficientRow({
    type: select.value,
    field: row.querySelector(".skill-coefficient-field")?.value,
    calc: row.querySelector(".skill-coefficient-calc")?.value,
    value: Number(row.querySelector(".skill-coefficient-value").value)
  });
}

function addSkillResourceCostRow(button) {
  const list = button.closest(".skill-resource-cost").querySelector(".skill-resource-cost-list");
  list.insertAdjacentHTML("beforeend", renderSkillResourceCostRow(createDefaultResourceCost()));
}

function removeSkillResourceCostRow(button) {
  const list = button.closest(".skill-resource-cost-list");
  if (list.querySelectorAll(".skill-resource-cost-row").length <= 1) {
    alert("자원 소모는 최소 1개 필요합니다.");
    return;
  }
  button.closest(".skill-resource-cost-row").remove();
}

function removeSkillCoefficientRow(button) {
  const list = button.closest(".skill-coefficient-list");
  if (list.querySelectorAll(".skill-coefficient-row").length <= 1) {
    alert("계수는 최소 1개 필요합니다.");
    return;
  }
  button.closest(".skill-coefficient-row").remove();
}

function readSkillCoefficientsFromRow(row) {
  const coefficients = [...row.querySelectorAll(".skill-coefficient-row")].map(coefficientRow => normalizeCoefficient({
    type: coefficientRow.querySelector(".skill-coefficient-type")?.value,
    field: coefficientRow.querySelector(".skill-coefficient-field")?.value,
    calc: coefficientRow.querySelector(".skill-coefficient-calc")?.value,
    value: Number(coefficientRow.querySelector(".skill-coefficient-value")?.value)
  }));
  return coefficients.length ? coefficients : [createDefaultCoefficient()];
}

function readSkillResourceCostsFromList(list) {
  const costs = [...(list?.querySelectorAll(".skill-resource-cost-row") ?? [])].map(costRow => normalizeResourceCost({
    resource: costRow.querySelector(".skill-resource-cost-resource")?.value,
    mode: costRow.querySelector(".skill-resource-cost-mode")?.value,
    value: Number(costRow.querySelector(".skill-resource-cost-value")?.value)
  }));
  return costs.length ? costs : createDefaultResourceCosts();
}

function readSkillResourceCostsFromForm() {
  return readSkillResourceCostsFromList(skillResourceCostsEl);
}

function readSkillRangeFromRow(row) {
  const checked = row.querySelector(".skill-range-mode:checked");
  const rangeValueInput = row.querySelector(".skill-range-value");
  return normalizeRange({
    rangeMode: checked?.value ?? "mainWeapon",
    rangeValue: Number(rangeValueInput?.value ?? 1)
  });
}

function readSkillActionsFromForm() {
  return [...skillActionsEl.querySelectorAll(".skill-action-row")].map(row => {
    const type = row.querySelector(".skill-action-type").value;
    const range = readSkillRangeFromRow(row);
    return normalizeSkillAction({
      type,
      target: row.querySelector(".skill-action-target")?.value,
      rangeMode: range.rangeMode,
      rangeValue: range.rangeValue,
      coefficients: type === "move" ? [] : readSkillCoefficientsFromRow(row),
      healResource: row.querySelector(".skill-action-heal-resource")?.value ?? "HP",
      damageType: row.querySelector(".skill-action-damage-type")?.value ?? "physical",
      moveType: row.querySelector(".skill-action-move-type")?.value ?? "Walk",
      moveSpeed: Number(row.querySelector(".skill-action-move-speed")?.value ?? 1),
      distance: Number(row.querySelector(".skill-action-distance")?.value ?? 0),
      fieldRadius: Number(row.querySelector(".skill-action-field-radius")?.value ?? 0)
    });
  });
}

async function saveSkillFromForm(event) {
  event?.preventDefault?.();
  logWarn("skill", "스킬 저장 버튼 동작이 시작되었습니다.", JSON.stringify({
    eventType: event?.type ?? "manual",
    skillName: skillNameEl?.value ?? "",
    actionRows: skillActionsEl?.querySelectorAll(".skill-action-row").length ?? 0,
    resourceCostRows: skillResourceCostsEl?.querySelectorAll(".skill-resource-cost-row").length ?? 0
  }, null, 2));

  let editIndex = "";
  let skill = null;

  try {
    editIndex = skillEditIndexEl.value;
    const previous = editIndex !== "" ? skillsJson[Number(editIndex)] : null;
    const actions = readSkillActionsFromForm();
    const resourceCosts = readSkillResourceCostsFromForm();
    skill = {
      id: previous?.id ?? `skill_${Date.now()}`,
      name: skillNameEl.value.trim(),
      slot: normalizeSkillSlot(skillSlotEl.value),
      cooldown: normalizeSkillCooldown(skillCooldownEl.value),
      resourceCosts,
      actions
    };

    logWarn("skill", "스킬 저장 폼을 읽었습니다.", JSON.stringify({
      editIndex,
      id: skill.id,
      name: skill.name,
      slot: skill.slot,
      cooldown: skill.cooldown,
      resourceCosts: skill.resourceCosts,
      actionTypes: skill.actions.map(action => action.type)
    }, null, 2));
  } catch (error) {
    logError("skill", "스킬 저장 폼을 읽는 중 실패했습니다.", error);
    alert("스킬 입력값을 읽는 중 문제가 발생했습니다. 로그를 확인하세요.");
    return;
  }

  if (!skill.name || !skill.actions.length) {
    logError("skill", "스킬 저장 검증에 실패했습니다.", JSON.stringify({
      hasName: Boolean(skill.name),
      actionCount: skill.actions.length
    }, null, 2));
    alert("스킬 이름과 액션을 입력하세요.");
    return;
  }

  if (editIndex !== "") {
    skillsJson[Number(editIndex)] = skill;
  } else {
    skillsJson.push(skill);
  }

  try {
    await saveSkillJson();
    logWarn("skill", "스킬 저장 데이터 반영이 완료되었습니다.", JSON.stringify({
      id: skill.id,
      name: skill.name,
      totalSkills: skillsJson.length
    }, null, 2));
  } catch (error) {
    logError("skill", "스킬 저장 요청이 실패했습니다.", error);
    alert("스킬 데이터를 저장하지 못했습니다. 로그를 확인하세요.");
    return;
  }

  try {
    renderSkillPage();
    renderItemPage();
    closeSkillModal();
  } catch (error) {
    logError("skill", "스킬은 저장됐지만 화면 갱신 중 실패했습니다.", error);
    alert("스킬은 저장됐지만 화면 갱신 중 문제가 발생했습니다. 로그를 확인하세요.");
  }
}

async function deleteSelectedSkills() {
  const checkedIndexes = [...document.querySelectorAll(".skill-check:checked")]
    .map(input => Number(input.value))
    .sort((a, b) => b - a);

  if (!checkedIndexes.length) {
    alert("삭제할 스킬을 선택하세요.");
    return;
  }

  const deletedIds = checkedIndexes.map(index => skillsJson[index]?.id).filter(Boolean);
  checkedIndexes.forEach(index => skillsJson.splice(index, 1));
  itemsJson.forEach(item => {
    if (deletedIds.includes(item.attackSkillId)) {
      item.attackSkillId = "";
    }
  });
  characterJson.forEach(character => {
    if (Array.isArray(character.skillIds)) {
      character.skillIds = character.skillIds.filter(skillId => !deletedIds.includes(skillId));
    }
  });

  try {
    await saveSkillJson();
    if (typeof saveCharacterJson === "function") {
      await saveCharacterJson();
    }
    await saveItemJson();
    renderSkillPage();
    renderItemPage();
  } catch (error) {
    logError("skill", "스킬 삭제 처리 중 실패했습니다.", error);
    alert("스킬 데이터를 삭제하지 못했습니다.");
  }
}

function getUnitSkill(unit, fallbackSkillId = DEFAULT_ATTACK_SKILL_ID) {
  if (fallbackSkillId === DEFAULT_ATTACK_SKILL_ID && !unit?.attackSkillId) {
    return createDefaultAttackSkillForUnit(unit);
  }
  return getSkillById(unit?.attackSkillId) ?? getSkillById(fallbackSkillId) ?? createDefaultSkillJson()[0];
}

function getActionTarget(action, context) {
  return action.target === "self" ? context.source : context.target;
}

function getCoefficientBaseValue(coefficient, source) {
  if (["hp", "mp", "st", "bp", "atk", "magic", "defense", "resistance"].includes(coefficient.field)) {
    return Number(source[coefficient.field]) || 0;
  }
  return Number(source.attributes?.[coefficient.field]) || 0;
}

function getCoefficientValue(coefficient, source) {
  if (coefficient.type === "fixed") {
    return Number(coefficient.value) || 0;
  }

  const baseValue = getCoefficientBaseValue(coefficient, source);
  const inputValue = Number(coefficient.value) || 0;
  return coefficient.calc === "percent" ? baseValue * inputValue / 100 : baseValue + inputValue;
}

function getActionCoefficientValue(action, source) {
  return action.coefficients.reduce((total, coefficient) => total + getCoefficientValue(coefficient, source), 0);
}

function applySkill(source, target, skill) {
  if (!source?.alive || !skill?.actions?.length) {
    return;
  }
  skill.actions.forEach(action => applySkillAction(source, target, action));
}

function applySkillAction(source, target, action) {
  const resolvedTarget = getActionTarget(action, { source, target });
  if (!resolvedTarget?.alive) {
    return;
  }

  if (action.type === "deal_damage") {
    applyActionDamage(source, resolvedTarget, action);
  } else if (action.type === "heal") {
    applyActionHeal(source, resolvedTarget, action);
  } else if (action.type === "move") {
    applyActionMove(source, resolvedTarget, action);
  } else if (action.type === "create_field") {
    applyCreateField(source, resolvedTarget, action);
  }
}

function applyActionDamage(source, target, action) {
  const rawDamage = getActionCoefficientValue(action, source);
  const damage = applyBarrierOrHpDamage(source, target, action, rawDamage);
  target.stats.taken += damage;
  source.stats.damage += damage;
  syncAliveState(target);
  triggerEffect(target, "damage");
}

function applyBarrierOrHpDamage(source, target, action, rawDamage) {
  const incomingDamage = Math.max(0, Number(rawDamage) || 0);
  const currentBp = Math.max(0, Number(target.bp) || 0);

  if (currentBp > 0) {
    const absorbedDamage = Math.min(currentBp, incomingDamage);
    target.bp = Math.max(0, currentBp - incomingDamage);
    return absorbedDamage;
  }

  const damage = getReducedDamage(source, target, action.damageType, incomingDamage);
  target.hp -= damage;
  return damage;
}

function applyActionHeal(source, target, action) {
  if (target.hp <= 0) {
    return;
  }

  const amount = getActionCoefficientValue(action, source);
  const resourceResult = applyResourceGain(target, action.healResource, amount);
  if (resourceResult.applied) {
    source.stats.heal += resourceResult.gained;
    triggerEffect(target, "heal");
    return;
  }

  const previousHp = target.hp;
  target.hp = Math.min(target.maxHp, target.hp + amount);
  source.stats.heal += target.hp - previousHp;
  triggerEffect(target, "heal");
}

function applyResourceGain(target, resource, amount) {
  const gain = Math.max(0, Number(amount) || 0);
  const normalizedResource = String(resource ?? "HP").toUpperCase();

  if (normalizedResource === "BP") {
    const previousBp = Math.max(0, Number(target.bp) || 0);
    target.bp = previousBp + gain;
    target.maxBp = Math.max(Number(target.maxBp) || 0, target.bp);
    return { applied: true, gained: target.bp - previousBp };
  }

  if (normalizedResource === "MP") {
    const previousMp = Math.max(0, Number(target.mp) || 0);
    target.mp = Math.min(Math.max(0, Number(target.maxMp) || 0), previousMp + gain);
    return { applied: true, gained: target.mp - previousMp };
  }

  if (normalizedResource === "ST") {
    const previousSt = Math.max(0, Number(target.st) || 0);
    target.st = Math.min(Math.max(0, Number(target.maxSt) || 0), previousSt + gain);
    return { applied: true, gained: target.st - previousSt };
  }

  if (normalizedResource !== "HP") {
    return { applied: true, gained: 0 };
  }

  return { applied: false, gained: 0 };
}

function applyActionMove(source, target, action) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const distanceRatio = Math.max(1, Math.min(10, Number(action.distance) || 10)) / 10;

  source.x += dx * distanceRatio;
  source.y += dy * distanceRatio;
  clampPosition(source);
}

function applyCreateField(source, target, action) {
  log(`필드 생성: ${source.name} -> ${target.name}, 반경 ${action.fieldRadius}`, "skill");
}
