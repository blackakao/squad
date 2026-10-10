const SKILL_STORAGE_KEY = "squad-auto-battle-skills";
const DEFAULT_ATTACK_SKILL_ID = "skill_basic_weapon_attack";
const DEFAULT_HEAL_SKILL_ID = "skill_basic_heal";
const ACTIVE_ACTION_TYPES = ["deal_damage", "heal", "drain_resource", "move", "summon_entity", "command_summon", "create_field", "transform", "copy_skill", "revive_ally", "deploy_reserve", "swap_reserve", "swap_equipment_set", "override_rule", ...TIMED_EFFECT_ACTIONS];
const LOCKED_ACTION_TYPES = [];
const REMOVED_ACTION_TYPES = ["cast_skill"];
const ACTION_TYPES = [...ACTIVE_ACTION_TYPES, ...LOCKED_ACTION_TYPES, ...REMOVED_ACTION_TYPES];
const ACTION_TARGETS = ["self", "ally", "enemy", "summon"];
const ACTION_DAMAGE_TYPES = ["physical", "magic", "fixed"];
const ACTION_RESOURCES = ["HP", "MP", "ST", "BP"];
const HEAL_RESOURCES = ["HP", "MP", "ST", "BP"];
const CUSTOM_RESOURCE_PREFIX = "custom:";
const ACTION_MOVE_TYPES = ["Walk", "Dash", "Teleport", "Knockback", "Pull", "Push"];
const MOVE_ACTION_TYPES = ["Dash", "Teleport", "Knockback", "Pull", "Push"];
const RANGE_MODES = ["mainWeapon", "custom"];
const COEFFICIENT_TYPES = ["fixed", "calculated"];
const COEFFICIENT_FIELDS = ["str", "vit", "agi", "focus", "int", "wis", "hp", "mp", "st", "bp", "atk", "magic", "defense", "resistance", "actualDamageTotal", "moveDistanceTotal", "targetEffectStacks", "targetEffectIdStacks", "ownedSummonCount", "previousActualDamage", "executionActualDamage", "previousActualHealing", "executionActualHealing", "previousResourceDrained", "executionResourceDrained", "resourceSpentTotal", "hpResourceSpent", "mpResourceSpent", "stResourceSpent", "bpResourceSpent"];
const COEFFICIENT_CALCS = ["flat", "percent"];
const RESOURCE_COST_MODES = ["fixed", "maxPercent", "currentPercent"];
const TRANSFORM_STATS = ["atk","magic","defense","resistance","speed","attackRange","attackSpeed","castSpeed"];
const SUMMON_INHERIT_STATS = ["hp","mp","st","atk","magic","defense","resistance","speed"];
const SKILL_SLOT_OPTIONS = [
  { key: "basic", label: "베이직" },
  { key: "active", label: "액티브" },
  { key: "passive", label: "패시브" }
];
const ACTION_TYPE_LABELS = {
  deal_damage: "피해",
  heal: "회복",
  drain_resource: "자원 감소",
  move: "이동",
  transform: "변신",
  add_state: "상태 추가",
  delete_state: "상태 제거",
  add_buff: "버프 추가",
  delete_buff: "버프 제거",
  summon_entity: "개체 소환",
  command_summon:"소환수 명령",
  create_field: "필드 생성",
  override_rule: "규칙 변경",
  copy_skill: "스킬 복제",
  swap_reserve: "예비대 교대",
  deploy_reserve: "예비대 증원",
  revive_ally: "아군 부활",
  swap_equipment_set: "장비 세트 교체",
  cast_skill: "스킬 시전"
};
const ACTION_TARGET_LABELS = {
  self: "자신",
  ally: "아군",
  enemy: "적군",
  summon: "내 소환수"
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
  actualDamageTotal: "전투 누적 실제 피해량 (HP+BP)",
  moveDistanceTotal: "전투 누적 이동 거리 (사거리 단위)",
  targetEffectStacks: "대상의 전체 효과 중첩 합계",
  targetEffectIdStacks: "대상의 특정 효과 ID 중첩 합계",
  ownedSummonCount: "살아 있는 자기 소환수 수",
  previousActualDamage: "직전 액션의 실제 피해량",
  executionActualDamage: "현재 스킬 실행의 누적 실제 피해량",
  previousActualHealing: "직전 액션의 실제 치유량",
  executionActualHealing: "현재 스킬 실행의 누적 실제 치유량",
  previousResourceDrained: "직전 액션의 실제 대상 자원 감소량",
  executionResourceDrained: "현재 스킬 실행의 누적 대상 자원 감소량",
  resourceSpentTotal: "이번 시전의 전체 실제 자원 소모량",
  hpResourceSpent: "이번 시전의 실제 HP 소모량",
  mpResourceSpent: "이번 시전의 실제 MP 소모량",
  stResourceSpent: "이번 시전의 실제 ST 소모량",
  bpResourceSpent: "이번 시전의 실제 BP 소모량",
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
    value: type === "fixed" ? 1 : 100,
    effectId: ""
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
    target: type === "command_summon" ? "summon" : type === "transform" || type === "deploy_reserve" ? "self" : ["heal", "add_buff", "delete_state", "copy_skill", "revive_ally", "swap_reserve", "swap_equipment_set", "override_rule"].includes(type) ? "ally" : "enemy",
    rangeMode: "mainWeapon",
    rangeValue: 1,
    minRange: 0,
    chainCount: 0,
    chainRange: 3,
    coefficients: [coefficient],
    healResource: "HP",
    drainResource: "MP",
    damageType: type === "heal" ? "magic" : "physical",
    area: 0,
    critical: 0,
    penetration: 0,
    moveType: type === "move" ? "Dash" : "Walk",
    moveSpeed: 1,
    distance: type === "move" ? 10 : 0,
    duration: TIMED_EFFECT_ACTIONS.includes(type) || ["create_field","transform","override_rule","deploy_reserve"].includes(type) ? 5 : 0,
    ...(TIMED_EFFECT_ACTIONS.includes(type) ? {effect:createDefaultSkillEffect(type)} : {}),
    fieldShape: "circle",
    fieldRadius: type === "create_field" ? 3 : 0,
    fieldEffect: "deal_damage",
    fieldEffectDuration: 5,
    fieldMoveType: "Push",
    fieldDistance: 1,
    fieldCenter: "target",
    fieldInterval: 1,
    ...(type === "copy_skill" ? {copySourceIndex:1,copySlot:1} : {}),
    ...(["swap_reserve","deploy_reserve"].includes(type) ? {reserveIndex:1} : {}),
    ...(type === "revive_ally" ? {reviveHpPercent:50,reviveMpPercent:100,reviveStPercent:100,reviveInvulnerable:0,revivePosition:"death"} : {}),
    ...(type === "command_summon" ? {summonCommand:"hold"} : {}),
    ...(type === "swap_equipment_set" ? {equipmentSetIndex:1} : {}),
    ...(type === "override_rule" ? {ruleOverride:{id:"skill_rule",damagePercent:100,receivedDamagePercent:100,healingPercent:100,receivedHealingPercent:100,resourceCostPercent:100,cooldownPercent:100,disableTeamSynergies:false,disableEquipmentEffects:false,disableAllSkills:false,disabledSkillIds:[]}} : {}),
    ...(type === "transform" ? {transform:{id:"battle_form",name:"전투 형태",mode:"flat",modifiers:{atk:10,magic:0,defense:0,resistance:0,speed:0,attackRange:0,attackSpeed:0,castSpeed:0},skillIds:[],attackSkillId:""}} : {})
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

function normalizeSkillCastTime(value) {
  if (value === "" || value == null) return null;
  return normalizeSkillCooldown(value);
}

function normalizeTransformation(transform = {}) {
  const modifiers={};
  for(const stat of TRANSFORM_STATS) {
    const value=Number(transform.modifiers?.[stat]);
    modifiers[stat]=Number.isFinite(value) ? value : 0;
  }
  return {id:String(transform.id ?? "battle_form").trim(),name:String(transform.name ?? "전투 형태").trim(),
    mode:transform.mode === "percent" ? "percent" : "flat",modifiers,
    skillIds:[...new Set(Array.isArray(transform.skillIds) ? transform.skillIds.map(String).filter(Boolean) : [])].slice(0,10),
    attackSkillId:String(transform.attackSkillId ?? "")};
}

function isTransformationConfigured(transform) {
  const normalized=normalizeTransformation(transform);
  return Boolean(normalized.id && normalized.name) && TRANSFORM_STATS.every(stat=>Number.isFinite(normalized.modifiers[stat]));
}

function normalizeSkillSlot(slot) {
  return SKILL_SLOT_OPTIONS.some(option => option.key === slot) ? slot : "active";
}

function getSkillSlotLabel(slot) {
  return SKILL_SLOT_OPTIONS.find(option => option.key === slot)?.label ?? slot;
}

function getActionTargetsForType(type) {
  if (type === "command_summon") return ["summon"];
  if (["transform","deploy_reserve"].includes(type)) return ["self"];
  if (type === "copy_skill") return ["ally"];
  if (["revive_ally","swap_reserve","swap_equipment_set","override_rule"].includes(type)) return ["self", "ally"];
  return type === "move" ? ["ally", "enemy", "summon"] : ACTION_TARGETS;
}

function normalizeActionType(type) {
  return typeof type === "string" && type ? type : "deal_damage";
}

function isSkillActionSupported(action) {
  if (!ACTIVE_ACTION_TYPES.includes(action?.type)) return false;
  if (TIMED_EFFECT_ACTIONS.includes(action.type)) return isEffectActionConfigured(action);
  if (action.type === "create_field") return ["deal_damage","heal","drain_resource","move","add_buff","add_state"].includes(action.fieldEffect ?? "deal_damage")
    && Number(action.fieldRadius) > 0 && Number(action.fieldInterval) > 0
    && ((action.fieldEffect ?? "deal_damage") !== "move" || ["Knockback","Push","Pull"].includes(action.fieldMoveType ?? "Push"))
    && (!["add_buff","add_state"].includes(action.fieldEffect) || isEffectActionConfigured({...action,type:action.fieldEffect}));
  if (action.type === "transform") return isTransformationConfigured(action.transform);
  const moveType = action.moveType ?? action.move_type;
  return action.type !== "move" || !moveType || MOVE_ACTION_TYPES.includes(moveType);
}

function getUnsupportedActionNames(skill) {
  return [...new Set((skill?.actions ?? []).filter(action => !isSkillActionSupported(action)).map(action =>
    action.type === "move" ? `이동: ${ACTION_MOVE_TYPE_LABELS[action.moveType ?? action.move_type] ?? action.moveType ?? action.move_type}` : ACTION_TYPE_LABELS[action.type] ?? action.type
  ))];
}

function isSkillExecutable(skill) {
  return Boolean(skill?.actions?.length) && skill.actions.every(isSkillActionSupported)
    && (skill.slot !== "passive" || isPassiveTriggerConfigured(skill)) && isSkillChannelConfigured(skill);
}

function renderActionTypeOptions(selectedType) {
  const locked = [...LOCKED_ACTION_TYPES];
  if (selectedType && !ACTIVE_ACTION_TYPES.includes(selectedType) && !locked.includes(selectedType)) locked.push(selectedType);
  return ACTIVE_ACTION_TYPES.map(type => `<option value="${type}" ${type === selectedType ? "selected" : ""}>${ACTION_TYPE_LABELS[type]} · 지원</option>`).join("")
    + locked.map(type => `<option value="${escapeHtml(type)}" disabled ${type === selectedType ? "selected" : ""}>${escapeHtml(ACTION_TYPE_LABELS[type] ?? type)} · 미지원 (잠금)</option>`).join("");
}

function normalizeActionTarget(target, type = "deal_damage") {
  if (type === "command_summon") return "summon";
  if (type === "summon_entity") return ACTION_TARGETS.includes(target) ? target : "self";
  if (type === "transform") return "self";
  if (type === "copy_skill") return "ally";
  if (type === "deploy_reserve") return "self";
  if (["revive_ally","swap_reserve","swap_equipment_set","override_rule"].includes(type)) return ["self", "ally"].includes(target) ? target : "ally";
  if (type === "move") {
    return ["ally", "enemy"].includes(target) ? target : "enemy";
  }
  if (ACTION_TARGETS.includes(target)) {
    return target;
  }
  return ["heal", "add_buff", "delete_state"].includes(type) ? "ally" : "enemy";
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
      value: Number.isFinite(value) ? value : type === "fixed" ? 1 : 100,
      effectId: String(coefficient.effectId ?? coefficient.effect_id ?? "").trim()
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
      value: Number.isFinite(oldValue) ? oldValue : 1,
      effectId: ""
    };
  }

  return {
    type: "calculated",
    field: COEFFICIENT_FIELDS.includes(source) ? source : source === "stat" ? coefficient.stat ?? "str" : "atk",
    calc: oldMode === "percent" ? "percent" : "percent",
    value: oldMode === "percent" ? Number.isFinite(oldValue) ? oldValue : 100 : Number.isFinite(oldValue) ? oldValue * 100 : 100,
    effectId: String(coefficient.effectId ?? coefficient.effect_id ?? "").trim()
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

function normalizeCustomResourceId(value) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
}

function normalizeCustomResourceDefinitions(resources = []) {
  const seen = new Set();
  return (Array.isArray(resources) ? resources : []).flatMap(resource => {
    const id = normalizeCustomResourceId(resource?.id);
    if (!id || seen.has(id)) return [];
    seen.add(id);
    const max = Math.max(0, Number(resource?.max) || 0);
    return [{ id, name: String(resource?.name ?? id).trim() || id,
      initial: Math.min(max, Math.max(0, Number(resource?.initial) || 0)), max }];
  });
}

function createBattleCustomResources(resources = []) {
  return Object.fromEntries(normalizeCustomResourceDefinitions(resources).map(resource => [resource.id, {
    id: resource.id, name: resource.name, initial: resource.initial, current: resource.initial, max: resource.max
  }]));
}

function normalizeResourceReference(resource, fallback = "MP") {
  const raw = String(resource ?? "").trim();
  const builtin = raw.toUpperCase();
  if (ACTION_RESOURCES.includes(builtin)) return builtin;
  if (raw.toLowerCase().startsWith(CUSTOM_RESOURCE_PREFIX)) {
    const id = normalizeCustomResourceId(raw.slice(CUSTOM_RESOURCE_PREFIX.length));
    if (id) return `${CUSTOM_RESOURCE_PREFIX}${id}`;
  }
  return fallback;
}

function getCustomResourceDefinitions() {
  const sources = [
    ...(typeof characterJson !== "undefined" && Array.isArray(characterJson) ? characterJson : []),
    ...(typeof monsterJson !== "undefined" && Array.isArray(monsterJson) ? monsterJson : [])
  ];
  return normalizeCustomResourceDefinitions(sources.flatMap(source => source?.customResources ?? []));
}

function getResourceLabel(resource) {
  const normalized = normalizeResourceReference(resource, String(resource ?? ""));
  if (!normalized.startsWith(CUSTOM_RESOURCE_PREFIX)) return normalized;
  const id = normalized.slice(CUSTOM_RESOURCE_PREFIX.length);
  return getCustomResourceDefinitions().find(item => item.id === id)?.name ?? id;
}

function renderResourceOptions(selectedResource) {
  const selected = normalizeResourceReference(selectedResource, String(selectedResource ?? ""));
  const custom = getCustomResourceDefinitions();
  if (selected.startsWith(CUSTOM_RESOURCE_PREFIX) && !custom.some(item => `${CUSTOM_RESOURCE_PREFIX}${item.id}` === selected)) {
    const id = selected.slice(CUSTOM_RESOURCE_PREFIX.length);
    custom.push({ id, name: `${id} (정의 없음)` });
  }
  return [
    ...ACTION_RESOURCES.map(resource => ({ value: resource, label: resource })),
    ...custom.map(resource => ({ value: `${CUSTOM_RESOURCE_PREFIX}${resource.id}`, label: resource.name }))
  ].map(option => `<option value="${escapeHtml(option.value)}" ${option.value === selected ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("");
}

function renderCustomResourceEditor(container, resources = []) {
  if (!container) return;
  container.innerHTML = normalizeCustomResourceDefinitions(resources).map(renderCustomResourceRow).join("");
}

function renderCustomResourceRow(resource = {}) {
  const normalized = normalizeCustomResourceDefinitions([{ id: resource.id || "resource", name: resource.name, initial: resource.initial, max: resource.max }])[0];
  return `<div class="custom-resource-row">
    <label>ID<input class="custom-resource-id" value="${escapeHtml(resource.id ? normalized.id : "")}" placeholder="soul"></label>
    <label>이름<input class="custom-resource-name" value="${escapeHtml(resource.name ? normalized.name : "")}" placeholder="영혼 포인트"></label>
    <label>초기값<input class="custom-resource-initial" type="number" min="0" step="0.1" value="${Number(resource.initial) || 0}"></label>
    <label>최대값<input class="custom-resource-max" type="number" min="0" step="0.1" value="${Number(resource.max) || 100}"></label>
    <button type="button" onclick="this.closest('.custom-resource-row').remove()">삭제</button>
  </div>`;
}

function addCustomResourceRow(container) {
  if (!container) return;
  container.insertAdjacentHTML("beforeend", renderCustomResourceRow({ max: 100 }));
}

function readCustomResourcesFromEditor(container) {
  if (!container) return [];
  return normalizeCustomResourceDefinitions([...container.querySelectorAll(".custom-resource-row")].map(row => ({
    id: row.querySelector(".custom-resource-id")?.value,
    name: row.querySelector(".custom-resource-name")?.value,
    initial: row.querySelector(".custom-resource-initial")?.value,
    max: row.querySelector(".custom-resource-max")?.value
  })));
}

function normalizeResourceCost(cost = {}) {
  const raw = cost.resourceCost ?? cost.resource_cost ?? cost;
  const resource = normalizeResourceReference(raw.resource, "MP");
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
  if (!isSkillActionSupported({ ...action, type })) return { ...action, type };
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
    minRange: normalizeSkillCooldown(action.minRange),
    targetHpBelow: Math.min(100, normalizeSkillCooldown(action.targetHpBelow ?? 100)),
    targetCooldown: normalizeSkillCooldown(action.targetCooldown),
    ...(TIMED_EFFECT_ACTIONS.includes(type) ? {effect:normalizeSkillEffect(action.effect,type)} : {}),
    chainCount: Math.min(20, Math.floor(normalizeSkillCooldown(action.chainCount))),
    chainRange: normalizeSkillCooldown(action.chainRange ?? 3),
    coefficients: normalizeActionCoefficients({ ...action, type }),
    healResource: normalizeResourceReference(healResourceValue, "HP"),
    drainResource: normalizeResourceReference(action.drainResource ?? action.drain_resource, "MP"),
    damageType: ACTION_DAMAGE_TYPES.includes(damageTypeValue) ? damageTypeValue : "physical",
    area: normalizeSkillCooldown(action.area),
    areaCenter: action.areaCenter === "self" ? "self" : "target",
    maxTargets: Math.floor(normalizeSkillCooldown(action.maxTargets)),
    ...(type === "summon_entity" ? {
      entityId: String(action.entityId ?? ""),
      summonCenter:action.summonCenter === "target" ? "target" : "self",
      inheritStats:Object.fromEntries(SUMMON_INHERIT_STATS.map(stat=>{
        const value=Number(action.inheritStats?.[stat] ?? action.inherit_stats?.[stat]);
        return [stat,Number.isFinite(value) ? Math.max(0,Math.min(1000,value)) : 0];
      })),
      count: Math.max(1, Math.min(10, Math.floor(Number(action.count) || 1))),
      limit: Math.max(1, Math.min(20, Math.floor(Number(action.limit) || 3))),
      protectOwnerPercent: Math.max(0,Math.min(100,Number(action.protectOwnerPercent) || 0)),
      protectOwnerScope: ["all","basic","skill"].includes(action.protectOwnerScope) ? action.protectOwnerScope : "all",
      protectOwnerPriority: Math.max(0,Math.min(999,Math.floor(Number(action.protectOwnerPriority) || 0))),
      transferStateScope: ["all","general","physical","magic"].includes(action.transferStateScope) ? action.transferStateScope : "none",
      transferStatePriority: Math.max(0,Math.min(999,Math.floor(Number(action.transferStatePriority) || 0)))
    } : {}),
    ...(type === "transform" ? {transform:normalizeTransformation(action.transform)} : {}),
    ...(type === "copy_skill" ? {
      copySourceIndex: Math.max(1, Math.min(4, Math.floor(Number(action.copySourceIndex ?? action.copy_source_index) || 1))),
      copySlot: Math.max(1, Math.min(4, Math.floor(Number(action.copySlot ?? action.copy_slot) || 1)))
    } : {}),
    ...(["swap_reserve","deploy_reserve"].includes(type) ? {
      reserveIndex: Math.max(1, Math.min(10, Math.floor(Number(action.reserveIndex ?? action.reserve_index) || 1)))
    } : {}),
    ...(type === "revive_ally" ? {
      reviveHpPercent:Math.max(1,Math.min(100,Number(action.reviveHpPercent) || 50)),
      reviveMpPercent:Math.max(0,Math.min(100,Number(action.reviveMpPercent ?? 100))),
      reviveStPercent:Math.max(0,Math.min(100,Number(action.reviveStPercent ?? 100))),
      reviveInvulnerable:normalizeSkillCooldown(action.reviveInvulnerable),
      revivePosition:action.revivePosition === "start" ? "start" : "death"
    } : {}),
    ...(type === "command_summon" ? {summonCommand:["hold","release","recall","dismiss"].includes(action.summonCommand) ? action.summonCommand : "hold"} : {}),
    ...(type === "swap_equipment_set" ? {
      equipmentSetIndex: Math.max(1, Math.min(3, Math.floor(Number(action.equipmentSetIndex ?? action.equipment_set_index) || 1)))
    } : {}),
    ...(type === "override_rule" ? {ruleOverride:{
      id:String(action.ruleOverride?.id ?? action.rule_override?.id ?? "skill_rule").trim() || "skill_rule",
      disableTeamSynergies:Boolean(action.ruleOverride?.disableTeamSynergies ?? action.rule_override?.disable_team_synergies),
      disableEquipmentEffects:Boolean(action.ruleOverride?.disableEquipmentEffects ?? action.rule_override?.disable_equipment_effects),
      disableAllSkills:Boolean(action.ruleOverride?.disableAllSkills ?? action.rule_override?.disable_all_skills),
      disabledSkillIds:[...new Set(Array.isArray(action.ruleOverride?.disabledSkillIds ?? action.rule_override?.disabled_skill_ids) ? (action.ruleOverride?.disabledSkillIds ?? action.rule_override?.disabled_skill_ids).map(String).filter(Boolean) : [])].slice(0,20),
      ...Object.fromEntries(["damagePercent","receivedDamagePercent","healingPercent","receivedHealingPercent","resourceCostPercent","cooldownPercent"].map(key=>{
        const value=Number(action.ruleOverride?.[key] ?? action.rule_override?.[key]);
        return [key,Number.isFinite(value) ? Math.max(0,value) : 100];
      }))
    }} : {}),
    critical: Number(action.critical) || 0,
    penetration: Number(action.penetration) || 0,
    moveType: type === "move"
      ? MOVE_ACTION_TYPES.includes(moveTypeValue) ? moveTypeValue : "Dash"
      : ACTION_MOVE_TYPES.includes(moveTypeValue) ? moveTypeValue : "Walk",
    moveSpeed: Number.isFinite(moveSpeedValue) ? Math.max(0, moveSpeedValue) : 1,
    distance: type === "move"
      ? Number.isFinite(distanceValue) ? Math.max(1, Math.min(10, distanceValue)) : 10
      : Number(action.distance) || 0,
    duration: normalizeSkillCooldown(action.duration ?? (type === "summon_entity" ? 20 : 0)),
    fieldShape: String(action.fieldShape ?? action.field_shape ?? "circle"),
    fieldRadius: Number(action.fieldRadius ?? action.field_radius) || 0,
    fieldEffect:["deal_damage","heal","drain_resource","move","add_buff","add_state"].includes(action.fieldEffect ?? action.field_effect) ? (action.fieldEffect ?? action.field_effect) : "deal_damage",
    fieldEffectDuration:normalizeSkillCooldown(action.fieldEffectDuration ?? action.field_effect_duration ?? 5),
    ...(type === "create_field" && ["add_buff","add_state"].includes(action.fieldEffect ?? action.field_effect) ? {effect:normalizeSkillEffect(action.effect,action.fieldEffect ?? action.field_effect)} : {}),
    fieldMoveType:["Knockback","Push","Pull"].includes(action.fieldMoveType ?? action.field_move_type) ? (action.fieldMoveType ?? action.field_move_type) : "Push",
    fieldDistance:Math.max(1,Math.min(10,Number(action.fieldDistance ?? action.field_distance) || 1)),
    fieldCenter:(action.fieldCenter ?? action.field_center) === "self" ? "self" : "target",
    fieldInterval:Math.max(1/60,Number(action.fieldInterval ?? action.field_interval) || 1)
  };
}

function normalizeSkillJson(skills) {
  const defaults = createDefaultSkillJson();
  const normalized = (Array.isArray(skills) && skills.length ? skills : defaults)
    .map((skill, index) => ({
      id: String(skill?.id ?? `skill_${Date.now()}_${index}`),
      name: String(skill?.name ?? "").trim(),
      description: String(skill?.description ?? ""),
      slot: normalizeSkillSlot(String(skill?.slot ?? "active").trim()),
      cooldown: normalizeSkillCooldown(skill?.cooldown ?? skill?.reuseCooldown ?? skill?.reuse_cooldown),
      castTime: normalizeSkillCastTime(skill?.castTime),
      channel:normalizeSkillChannel(skill?.channel),
      ...(skill?.slot === "passive" || skill?.passiveTrigger ? {passiveTrigger:normalizePassiveTrigger(skill?.passiveTrigger)} : {}),
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

  try {
    await saveJsonFile("skills", skillsJson);
    localStorage.setItem(SKILL_STORAGE_KEY, JSON.stringify(skillsJson));
    log("스킬 데이터가 API와 브라우저 저장소에 저장되었습니다.", "skill");
  } catch (error) {
    logError("skill", "스킬 API 저장에 실패했습니다.", error);
    throw error;
  }
}

function getSkillById(skillId) {
  return skillsJson.find(skill => skill.id === skillId);
}

function getSkillCooldownTicks(skill, unit = null) {
  const percent = getUnitTeamBattleRules(unit).cooldownPercent;
  return Math.max(0, Math.round(normalizeSkillCooldown(skill?.cooldown) * BASE_ATTACK_COOLDOWN * percent / 100));
}

function getModifiedSkillCooldownTicks(skill,unit,modifier=null) {
  return Math.max(0,Math.round(getSkillCooldownTicks(skill,unit)*(modifier?.cooldownPercent ?? 100)/100));
}

function isUnitSkillDisabled(unit, skillOrId) {
  const skill=typeof skillOrId === "string" ? (getSkillById(skillOrId) ?? {id:skillOrId}) : skillOrId;
  if ((unit?.runtimeRuleOverrides ?? []).some(rule=>rule.disableAllSkills)) return Boolean(skill);
  const ids=new Set((unit?.runtimeRuleOverrides ?? []).flatMap(rule=>rule.disabledSkillIds ?? []));
  return Boolean(skill && (ids.has(skill.id) || (skill.copiedFrom && ids.has(skill.copiedFrom))));
}

function getUnitIncomingRulePercent(unit,key) {
  return (unit?.runtimeRuleOverrides ?? []).reduce((percent,rule)=>percent * (Number.isFinite(Number(rule[key])) ? Math.max(0,Number(rule[key])) : 100) / 100,100);
}

function getEquippedSkills(unit) {
  const transform=(unit?.activeEffects ?? []).find(effect=>effect.kind === "transform");
  const equippedIds=transform?.skillIds?.length ? transform.skillIds : unit?.skillIds;
  const equipped = (Array.isArray(equippedIds) ? equippedIds : [])
    .map(getSkillById)
    .filter(skill => skill && !isDefaultSkill(skill.id) && skill.slot !== "passive" && isSkillExecutable(skill) && !isUnitSkillDisabled(unit,skill));
  const copied = (Array.isArray(unit?.runtimeCopiedSkills) ? unit.runtimeCopiedSkills : [])
    .filter(skill => skill && isSkillExecutable(skill) && !isUnitSkillDisabled(unit,skill));
  return [...equipped, ...copied];
}

function getCopyableUnitSkills(unit) {
  return (Array.isArray(unit?.skillIds) ? unit.skillIds : [])
    .map(getSkillById)
    .filter(skill => skill && skill.slot === "active" && !skill.copiedFrom
      && isSkillExecutable(skill) && !skill.actions.some(action => action.type === "copy_skill"));
}

function getCopySkillCandidate(source, action, preferredTarget = null) {
  const ownSquad = source.side === "enemy" ? enemySquad : playerSquad;
  const index = Math.max(1, Number(action.copySourceIndex) || 1) - 1;
  const candidates = ownSquad.filter(unit => unit !== source && !unit.isSummon
    && (unit.alive || unit.isWaiting) && getCopyableUnitSkills(unit)[index]);
  return candidates.includes(preferredTarget) ? preferredTarget : candidates[0] ?? null;
}

function getReserveSwapTarget(source, action, preferredTarget = null) {
  const squad = source.side === "enemy" ? enemySquad : playerSquad;
  if (!getReserveCandidates(source)[Math.max(1, Number(action.reserveIndex) || 1) - 1]) return null;
  const candidates = action.target === "self" ? [source] : squad.filter(unit => unit !== source && unit.alive && !unit.isSummon && !unit.isReserve);
  return candidates.includes(preferredTarget) ? preferredTarget : candidates[0] ?? null;
}

function copyUnitSkill(source, target, action) {
  const original = getCopyableUnitSkills(target)[Math.max(1, Number(action.copySourceIndex) || 1) - 1];
  if (!original) return null;
  const slot = Math.max(1, Math.min(4, Number(action.copySlot) || 1));
  const copy = structuredClone(original);
  copy.id = `runtime_copy_${slot}_${original.id}`;
  copy.name = `복제 · ${original.name}`;
  copy.slot = "active";
  copy.copiedFrom = original.id;
  copy.copySlot = slot;
  const previous = (source.runtimeCopiedSkills ?? []).find(skill => skill.copySlot === slot);
  if (previous) delete source.skillCooldowns[previous.id];
  source.runtimeCopiedSkills = (source.runtimeCopiedSkills ?? []).filter(skill => skill.copySlot !== slot);
  source.runtimeCopiedSkills.push(copy);
  source.skillCooldowns[copy.id] = 0;
  publishBattleEvents([{type:"skill_copy",source,target,skill:copy,reason:original.name}]);
  addBattleEventLog(source,`${source.name}: ${target.name}의 ${original.name} 복제`);
  return copy;
}

function applyRuleOverride(source,target,action,skill=null) {
  const config=action.ruleOverride;
  if (!target?.alive || !config?.id) return null;
  const equipmentWasDisabled=(target.runtimeRuleOverrides ?? []).some(rule=>rule.disableEquipmentEffects);
  const instance={...config,remainingTicks:action.duration>0 ? Math.max(1,Math.ceil(action.duration*BASE_ATTACK_COOLDOWN)) : null,sourceName:source.name,skillId:skill?.id};
  target.runtimeRuleOverrides=(target.runtimeRuleOverrides ?? []).filter(rule=>rule.id!==instance.id);
  target.runtimeRuleOverrides.push(instance);
  const equipmentIsDisabled=target.runtimeRuleOverrides.some(rule=>rule.disableEquipmentEffects);
  if (equipmentWasDisabled !== equipmentIsDisabled) refreshBattleEquipmentRuleState(target);
  if (isUnitSkillDisabled(target,target.pendingAction?.skill) || isUnitSkillDisabled(target,target.channelAction?.skill)) {
    interruptBattleCast(target,"스킬 금지 규칙");
  }
  publishBattleEvents([{type:"rule_override",source,target,skill,reason:instance.id}]);
  addBattleEventLog(target,`${target.name}: ${instance.id} 규칙 적용 (${action.duration || "전투 종료까지"}초)`);
  return instance;
}

function getActionRangePixels(source, action) {
  if (action.rangeMode === "custom") {
    return Math.max(1, Number(action.rangeValue) || 1) * ATTACK_RANGE_UNIT;
  }
  return getUnitRange(source);
}

function isChainAction(action) {
  return ["deal_damage", "heal"].includes(action.type) && action.chainCount > 0;
}

function supportsActionArea(type) {
  return ["deal_damage","heal","drain_resource","command_summon",...TIMED_EFFECT_ACTIONS].includes(type);
}

function getActionMinimumRangePixels(action) {
  // Minimum range constrains a selected target, not the area hit shape.
  if (action.target === "self" || (action.type === "summon_entity" && action.summonCenter !== "target")
    || (!isChainAction(action) && action.area > 0 && action.areaCenter === "self" && supportsActionArea(action.type))) return 0;
  return normalizeSkillCooldown(action.minRange) * ATTACK_RANGE_UNIT;
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
  const reference = normalizeResourceReference(resource, "");
  const normalized = reference.toUpperCase();
  if (normalized === "HP") return { current: "hp", max: "maxHp" };
  if (normalized === "MP") return { current: "mp", max: "maxMp" };
  if (normalized === "ST") return { current: "st", max: "maxSt" };
  if (normalized === "BP") return { current: "bp", max: "maxBp" };
  if (reference.startsWith(CUSTOM_RESOURCE_PREFIX)) return { customId: reference.slice(CUSTOM_RESOURCE_PREFIX.length) };
  return null;
}

function getUnitResourceState(unit, resource) {
  const field = getResourceField(resource);
  if (!field) return null;
  if (field.customId) return unit?.customResources?.[field.customId] ?? null;
  return { current: Number(unit?.[field.current]) || 0, max: Number(unit?.[field.max]) || 0, field };
}

function getUnitResourceCurrent(unit, resource) {
  return Math.max(0, Number(getUnitResourceState(unit, resource)?.current) || 0);
}

function getUnitResourceMax(unit, resource) {
  return Math.max(0, Number(getUnitResourceState(unit, resource)?.max) || 0);
}

function setUnitResourceCurrent(unit, resource, value) {
  const field = getResourceField(resource);
  if (!field) return false;
  const next = Math.max(0, Number(value) || 0);
  if (field.customId) {
    if (!unit?.customResources?.[field.customId]) return false;
    unit.customResources[field.customId].current = next;
  } else unit[field.current] = next;
  return true;
}

function getResourceCostAmount(unit, cost, modifierPercent = 100) {
  const field = getResourceField(cost.resource);
  if (!field) {
    return 0;
  }

  const value = Math.max(0, Number(cost.value) || 0);
  let amount = value;
  if (cost.mode === "maxPercent") amount = (getUnitResourceMax(unit, cost.resource) * value) / 100;
  else if (cost.mode === "currentPercent") amount = (getUnitResourceCurrent(unit, cost.resource) * value) / 100;
  return amount * getUnitTeamBattleRules(unit).resourceCostPercent / 100 * Math.max(0,Number(modifierPercent) || 0) / 100;
}

function getSkillResourceCosts(skill) {
  return normalizeSkillResourceCosts(skill);
}

function canPaySkillResourceCosts(unit, skill, modifierPercent = 100) {
  const totals = {};
  getSkillResourceCosts(skill).forEach(cost => {
    const field = getResourceField(cost.resource);
    if (!field) {
      return;
    }
    const key = normalizeResourceReference(cost.resource);
    totals[key] = (totals[key] ?? 0) + getResourceCostAmount(unit, cost, modifierPercent);
  });

  return Object.entries(totals).every(([resource, amount]) => getUnitResourceState(unit, resource) && getUnitResourceCurrent(unit, resource) >= amount);
}

function spendSkillResourceCosts(unit, skill, modifierPercent = 100) {
  const spent={total:0,HP:0,MP:0,ST:0,BP:0};
  getSkillResourceCosts(skill).forEach(cost => {
    const field = getResourceField(cost.resource);
    if (!field) {
      return;
    }
    const before=getUnitResourceCurrent(unit,cost.resource);
    setUnitResourceCurrent(unit,cost.resource,before-getResourceCostAmount(unit,cost,modifierPercent));
    const amount=before-getUnitResourceCurrent(unit,cost.resource);
    spent[cost.resource]=(spent[cost.resource] ?? 0)+amount;
    spent.total+=amount;
  });
  return spent;
}

function getSkillOptionsHtml(selectedSkillId = "") {
  return [
    `<option value="">기본 공격</option>`,
    ...skillsJson.map(skill => `<option value="${skill.id}" ${skill.id === selectedSkillId ? "selected" : !isSkillExecutable(skill) || skill.slot === "passive" ? "disabled" : ""}>${escapeHtml(skill.name)}${skill.slot === "passive" ? " · 패시브 (사용 스킬에 장착)" : isSkillExecutable(skill) ? "" : " · 미지원 (전투 사용 불가)"}</option>`)
  ].join("");
}

function getCharacterSkillOptionsHtml(selectedSkillIds = []) {
  const selectedSet = new Set(selectedSkillIds);
  return skillsJson
    .filter(skill => !isDefaultSkill(skill.id))
    .map(skill => `<option value="${skill.id}" ${selectedSet.has(skill.id) ? "selected" : !isSkillExecutable(skill) ? "disabled" : ""}>${escapeHtml(skill.name)} (${getSkillSlotLabel(skill.slot)})${isSkillExecutable(skill) ? "" : " · 미지원 (전투 사용 불가)"}</option>`)
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
  return { id: DEFAULT_ATTACK_SKILL_ID, name: "기본 무기 공격", slot: "basic", castTime: getSkillById(DEFAULT_ATTACK_SKILL_ID)?.castTime ?? null, channel: normalizeSkillChannel(getSkillById(DEFAULT_ATTACK_SKILL_ID)?.channel), actions: [action] };
}

function formatCoefficientSummary(coefficient) {
  if (coefficient.type === "fixed") {
    return `고정 ${coefficient.value}`;
  }
  return `${COEFFICIENT_FIELD_LABELS[coefficient.field] ?? coefficient.field}${coefficient.field === "targetEffectIdStacks" ? ` (${coefficient.effectId || "ID 미설정"})` : ""} ${COEFFICIENT_CALC_LABELS[coefficient.calc] ?? coefficient.calc} ${coefficient.value}`;
}

function formatResourceCostSummary(resourceCost) {
  return `${getResourceLabel(resourceCost.resource)} ${RESOURCE_COST_MODE_LABELS[resourceCost.mode]} ${resourceCost.value}`;
}

function formatResourceCostsSummary(resourceCosts) {
  return normalizeResourceCosts({ resourceCosts }).map(formatResourceCostSummary).join(" + ");
}

function formatRangeSummary(action) {
  const maximum = action.rangeMode === "mainWeapon" ? "주장비 사정거리" : `사정거리 ${action.rangeValue}`;
  return getActionMinimumRangePixels(action) > 0 ? `최소 거리 ${action.minRange} / ${maximum}` : maximum;
}

function formatActionSummary(action) {
  if (!isSkillActionSupported(action)) return `${getUnsupportedActionNames({actions:[action]}).join(", ")} · 미지원`;
  if (TIMED_EFFECT_ACTIONS.includes(action.type)) {
    const effect = action.effect;
    if (action.type.startsWith("delete_")) return `${ACTION_TYPE_LABELS[action.type]} / ${effect.dispelMode === "all" ? "전체" : effect.dispelMode === "category" ? EFFECT_CATEGORY_LABELS[effect.dispelCategory] : effect.id} / ${effect.dispelPolarity === "harmful" ? "해로운 효과만" : effect.dispelPolarity === "beneficial" ? "이로운 효과만" : "모든 성격"}`;
    const value = action.type === "add_state" ? STATE_LABELS[effect.state] : effect.mode === "immunity" ? "면역" : effect.mode === "damage_immunity" ? "피해 무시" : effect.mode === "periodic" ? "주기 효과만 적용" : effect.mode === "damage_reflect" ? `실제 피해 ${effect.reflectPercent}% 반사 (${effect.reflectScope === "basic" ? "기본 공격" : effect.reflectScope === "skill" ? "스킬" : "모든 피해"})` : effect.mode === "next_skill_modifier" ? `다음 스킬 시전 ${effect.nextCastTimePercent}% · 비용 ${effect.nextResourceCostPercent}% · 쿨타임 ${effect.nextCooldownPercent}%` : effect.mode === "override" ? `${BUFF_STAT_LABELS[effect.stat]} 최종 ${effect.value}` : effect.mode === "convert" ? `${BUFF_STAT_LABELS[effect.sourceStat]}의 ${effect.value}%를 ${BUFF_STAT_LABELS[effect.stat]}에 전환` : `${BUFF_STAT_LABELS[effect.stat]} ${effect.value}${effect.mode === "percent" ? "%" : ""}`;
    const periodic = effect.periodic ? ` / ${effect.periodic.interval}초마다 ${effect.periodic.value} ${effect.periodic.type === "damage" ? `${ACTION_DAMAGE_TYPE_LABELS[effect.periodic.damageType]} 피해` : `${getResourceLabel(effect.periodic.resource)} 회복`}` : "";
    const immune = effect.immunity ? ` / 면역: ${effect.immunity.scope === "state" ? "상태" : effect.immunity.scope === "harmful" ? "해로운 효과" : "상태·버프"}·${EFFECT_CATEGORY_LABELS[effect.immunity.category] ?? "모든 분류"}·${STATE_LABELS[effect.immunity.state] ?? "모든 상태"}` : "";
    return `${ACTION_TYPE_LABELS[action.type]} / ${effect.name} / ${value} / ${action.duration || "무제한"}초 / 최대 ${effect.maxStacks}중첩${effect.uses > 0 ? ` / ${effect.uses}회 사용` : ""}${periodic} / ${EFFECT_CATEGORY_LABELS[effect.category] ?? "일반"}${effect.dispellable === false ? "·해제 불가" : ""}${immune}`;
  }
  const coefficientText = action.coefficients.map(formatCoefficientSummary).join(" + ");
  const rangeText = formatRangeSummary(action) + (isChainAction(action)
    ? ` / 추가 연쇄 ${action.chainCount}회 / 연쇄 거리 ${action.chainRange} / 최대 ${Math.min(action.chainCount + 1, action.maxTargets > 0 ? action.maxTargets : Infinity)}명`
    : action.area > 0 ? ` / 광역 반경 ${action.area} (${action.areaCenter === "self" ? "자신" : "대상"} 중심, ${action.maxTargets > 0 ? `${action.maxTargets}명` : "전체"})` : "");
  if (action.type === "summon_entity") {
    const entity = getEntityById(action.entityId);
    const protection=action.protectOwnerPercent > 0 ? ` / 소환자 피해 ${action.protectOwnerPercent}% 대리` : "";
    const transfer=action.transferStateScope !== "none" ? ` / ${EFFECT_CATEGORY_LABELS[action.transferStateScope] ?? "모든"} 상태이상 이전` : "";
    const inheritance=Object.values(action.inheritStats ?? {}).some(value=>value>0) ? " / 소환자 능력치 계승" : "";
    return `소환 / ${entity?.name ?? "Entity 선택 필요"} ${action.count}체 / ${action.summonCenter === "target" ? `${ACTION_TARGET_LABELS[action.target]} 주변` : "시전자 주변"} / 동시 ${action.limit}체 / 수명 ${action.duration || "무제한"}초${inheritance}${protection}${transfer}`;
  }

  if (action.type === "deal_damage") {
    return `피해 / ${ACTION_TARGET_LABELS[action.target]} / ${ACTION_DAMAGE_TYPE_LABELS[action.damageType]} / ${rangeText} / ${coefficientText}`;
  }
  if (action.type === "heal") {
    return `회복 / ${ACTION_TARGET_LABELS[action.target]} / ${getResourceLabel(action.healResource)} / ${rangeText} / ${coefficientText}`;
  }
  if(action.type === "transform") return `변신 / ${action.transform.name} / ${action.duration || "무제한"}초 / ${action.transform.mode === "percent" ? "%" : "고정값"} 능력치 변경${action.transform.skillIds.length ? ` / 액티브 ${action.transform.skillIds.length}개 교체` : ""}${action.transform.attackSkillId ? " / 기본 공격 교체" : ""}`;
  if(action.type === "copy_skill") return `스킬 복제 / 아군의 ${action.copySourceIndex}번째 액티브 / 내 복제 슬롯 ${action.copySlot}`;
  if(action.type === "command_summon") return `소환수 명령 / ${{hold:"정지",release:"행동 재개",recall:"복귀",dismiss:"소환 해제"}[action.summonCommand]} / ${rangeText}`;
  if(action.type === "revive_ally") return `아군 부활 / HP ${action.reviveHpPercent}% · MP ${action.reviveMpPercent}% · ST ${action.reviveStPercent}% / 무적 ${action.reviveInvulnerable}초 / ${action.revivePosition === "start" ? "시작" : "사망"} 위치`;
  if(action.type === "deploy_reserve") return `예비대 증원 / 예비대 ${action.reserveIndex}순번 / ${action.duration || "전투 종료까지"}${action.duration ? "초" : ""}`;
  if(action.type === "swap_reserve") return `예비대 교대 / ${ACTION_TARGET_LABELS[action.target]} 퇴장 / 예비대 ${action.reserveIndex}순번 투입${action.duration > 0 ? ` / ${action.duration}초 뒤 복귀` : ""}`;
  if(action.type === "swap_equipment_set") return `장비 세트 교체 / ${ACTION_TARGET_LABELS[action.target]} / 세트 ${action.equipmentSetIndex}`;
  if(action.type === "override_rule") return `규칙 변경 / ${action.ruleOverride.id} / 주는 피해 ${action.ruleOverride.damagePercent}% · 받는 피해 ${action.ruleOverride.receivedDamagePercent}% · 주는 치유 ${action.ruleOverride.healingPercent}% · 받는 치유 ${action.ruleOverride.receivedHealingPercent}% · 비용 ${action.ruleOverride.resourceCostPercent}% · 쿨타임 ${action.ruleOverride.cooldownPercent}%${action.ruleOverride.disableTeamSynergies ? " · 팀 시너지 무효" : ""}${action.ruleOverride.disableEquipmentEffects ? " · 장비 효과 무효" : ""}${action.ruleOverride.disableAllSkills ? " · 모든 스킬 금지" : action.ruleOverride.disabledSkillIds.length ? ` · 스킬 ${action.ruleOverride.disabledSkillIds.length}개 금지` : ""} / ${action.duration || "무제한"}초`;
  if (action.type === "drain_resource") return `자원 감소 / ${ACTION_TARGET_LABELS[action.target]} / ${getResourceLabel(action.drainResource)} / ${rangeText} / ${coefficientText}`;
  if (action.type === "move") {
    const speedText = action.moveType === "Dash" ? ` / 이동속도 +${action.moveSpeed}` : "";
    return `이동 / ${ACTION_TARGET_LABELS[action.target]} / ${ACTION_MOVE_TYPE_LABELS[action.moveType]} / 이동 거리 ${action.distance}${speedText}`;
  }
  if (action.type === "create_field") {
    const timed=["add_buff","add_state"].includes(action.fieldEffect);
    const effectText=action.fieldEffect === "move" ? `${ACTION_MOVE_TYPE_LABELS[action.fieldMoveType]} ${action.fieldDistance}` : timed ? `${ACTION_TYPE_LABELS[action.fieldEffect]} (${action.effect?.name || action.effect?.id || "효과"}, ${action.fieldEffectDuration || "무제한"}초)` : ACTION_TYPE_LABELS[action.fieldEffect];
    return `필드 생성 / ${ACTION_TARGET_LABELS[action.target]}에게 ${effectText} / ${action.fieldCenter === "self" ? "자신" : "대상"} 위치 / 반경 ${action.fieldRadius} / ${action.fieldInterval}초 간격 / ${action.duration || "무제한"}초 / ${rangeText}${action.fieldEffect === "move" || timed ? "" : ` / ${coefficientText}`}`;
  }
  return `${ACTION_TYPE_LABELS[action.type] ?? action.type} / ${ACTION_TARGET_LABELS[action.target] ?? action.target}`;
}

function getSkillDescription(skill) {
  if (String(skill.description ?? "").trim()) return skill.description;
  return skill.actions.map(action => {
    const target = ACTION_TARGET_LABELS[action.target] ?? "대상";
    const area = action.area > 0 ? `반경 ${action.area} 범위의 ` : "";
    if (action.type === "deal_damage") return `${area}${target}에게 ${ACTION_DAMAGE_TYPE_LABELS[action.damageType]} 피해를 줍니다.`;
    if (action.type === "heal") return `${area}${target}의 ${getResourceLabel(action.healResource)}를 회복합니다.`;
    if (action.type === "drain_resource") return `${area}${target}의 ${getResourceLabel(action.drainResource)}를 감소시킵니다.`;
    if (action.type === "move") {
      const movement = {Dash:"돌진",Teleport:"순간이동",Knockback:"넉백",Pull:"끌어오기",Push:"밀치기"}[action.moveType] ?? "이동";
      return `${target}에게 ${movement} 효과를 적용합니다.`;
    }
    if(action.type === "transform") return `${action.transform.name}(으)로 ${action.duration || "전투 종료까지"}${action.duration ? "초 동안" : ""} 변신합니다.`;
    if (action.type === "summon_entity") return `${action.summonCenter === "target" ? target : "자신"} 주변에 ${getEntityById(action.entityId)?.name ?? "Entity"} ${action.count}체를 소환합니다.`;
    if (action.type === "create_field") return `${action.fieldCenter === "self" ? "자신" : target} 위치에 반경 ${action.fieldRadius}의 ${action.fieldEffect === "move" ? ACTION_MOVE_TYPE_LABELS[action.fieldMoveType] : ACTION_TYPE_LABELS[action.fieldEffect]} 필드를 생성합니다.`;
    if (action.type === "copy_skill") return `아군의 ${action.copySourceIndex}번째 액티브 스킬을 복제 슬롯 ${action.copySlot}에 복제합니다.`;
    if (action.type === "command_summon") return `내 소환수에게 ${{hold:"정지",release:"행동 재개",recall:"소환자 위치 복귀",dismiss:"소환 해제"}[action.summonCommand]} 명령을 내립니다.`;
    if (action.type === "revive_ally") return `쓰러진 ${target}을 최대 HP ${action.reviveHpPercent}%로 부활시킵니다.`;
    if (action.type === "deploy_reserve") return `예비대 ${action.reserveIndex}순번을 ${action.duration || "전투 종료까지"}${action.duration ? "초 동안" : ""} 추가 투입합니다.`;
    if (action.type === "swap_reserve") return `${target}을 대기시키고 예비대 ${action.reserveIndex}순번을 투입${action.duration > 0 ? `한 뒤 ${action.duration}초 후 복귀시킵니다` : "합니다"}.`;
    if (action.type === "swap_equipment_set") return `${target}의 장비를 세트 ${action.equipmentSetIndex}(으)로 교체합니다.`;
    if (action.type === "override_rule") return `${target}에게 ${action.ruleOverride.id} 규칙을 ${action.duration || "전투 종료까지"}${action.duration ? "초 동안" : ""} 적용합니다${action.ruleOverride.disableAllSkills ? " (모든 스킬 금지)" : action.ruleOverride.disabledSkillIds.length ? ` (${action.ruleOverride.disabledSkillIds.length}개 스킬 금지)` : ""}.`;
    if (TIMED_EFFECT_ACTIONS.includes(action.type) && isSkillActionSupported(action)) return `${target}: ${formatActionSummary(action)}.`;
    return `${ACTION_TYPE_LABELS[action.type] ?? action.type} 효과입니다.`;
  }).join(" ");
}

function summarizeSkillDescription(skill) {
  const description = getSkillDescription(skill).replace(/\s+/g, " ").trim();
  return description.length > 120 ? description.slice(0, 120) + "…" : description;
}

function renderSkillPage() {
  if (!skillTableBodyEl) {
    return;
  }

  skillTableBodyEl.innerHTML = skillsJson.map((skill, index) => `
    <tr>
      <td><input type="checkbox" class="skill-check" value="${index}" ${isDefaultSkill(skill.id) ? "disabled" : ""}></td>
      <td>${escapeHtml(skill.name)}</td>
      <td>${renderCategoryIcon("skill", skill.slot, getSkillSlotLabel(skill.slot))}</td>
      <td>${skill.cooldown}<br>${skill.slot === "passive" ? `패시브 · ${escapeHtml(PASSIVE_TRIGGER_LABELS[skill.passiveTrigger?.event] ?? "조건 미설정")} · ${skill.passiveTrigger?.chance ?? 100}%` : `시전 ${skill.castTime == null ? "유닛 기준" : `${skill.castTime}초`}${skill.channel?.duration > 0 ? `<br>채널링 ${skill.channel.duration}초 · ${skill.channel.interval}초 간격` : ""}`}</td>
      <td class="skill-description" title="${escapeHtml(getSkillDescription(skill))}">${escapeHtml(summarizeSkillDescription(skill))}
        ${!isSkillExecutable(skill) ? `<div class="skill-support-warning">전투 사용 불가 · ${skill.slot === "passive" && !isPassiveTriggerConfigured(skill) ? "패시브 조건 설정 필요" : `미지원: ${escapeHtml(getUnsupportedActionNames(skill).join(", "))}`}</div>` : ""}
      </td>
      <td><button type="button" onclick="openSkillModal(${index})">수정</button></td>
    </tr>
  `).join("");
}

function openSkillModal(index = "") {
  const skill = skillsJson[index];
  skillModalTitleEl.innerText = skill ? "스킬 수정" : "스킬 추가";
  skillEditIndexEl.value = skill ? index : "";
  skillNameEl.value = skill?.name ?? "";
  skillDescriptionEl.value = skill?.description ?? "";
  skillSlotEl.value = skill?.slot ?? "active";
  skillCooldownEl.value = skill?.cooldown ?? 0;
  skillCastTimeEl.value = skill?.castTime ?? "";
  renderPassiveTriggerForm(skill);
  renderSkillChannelForm(skill);
  const channelDisclosure = document.getElementById("skillChannelDisclosure");
  if (channelDisclosure) channelDisclosure.open = Number(skill?.channel?.duration ?? 0) > 0;
  renderSkillResourceCostsToForm(skill?.resourceCosts ?? normalizeSkillResourceCosts(skill));
  renderSkillActionRows(skill?.actions ?? [createDefaultAction()]);
  skillModalEl.classList.remove("hidden");
}

function closeSkillModal() {
  if (document.getElementById('entityEditorModal')) closeEntityEditor();
  skillModalEl.classList.add("hidden");
  skillFormEl.reset();
  skillResourceCostsEl.innerHTML = "";
  skillActionsEl.innerHTML = "";
}

function renderSkillActionRows(actions) {
  skillActionsEl.innerHTML = actions.map((action, index) => renderSkillActionRow(normalizeSkillAction(action), index)).join("");
  skillActionsEl.querySelectorAll(".skill-action-row").forEach(updateSkillActionFieldVisibility);
  skillActionsEl.querySelectorAll(".skill-action-row").forEach(row => refreshEntityAction(row, true));
}

function renderSkillActionRow(action, index) {
  if (!isSkillActionSupported(action)) {
    const options = action.type === "move"
      ? `<option value="unsupported_move" selected disabled>${escapeHtml(getUnsupportedActionNames({actions:[action]})[0])} · 미지원 (잠금)</option>${renderActionTypeOptions("")}`
      : renderActionTypeOptions(action.type);
    return `<div class="skill-action-row skill-action-row-unsupported" data-action-index="${index}" data-unsupported-action="${escapeHtml(JSON.stringify(action))}">
      <div class="skill-action-card-header"><div><span>ACTION ${index + 1}</span><strong>지원되지 않는 액션</strong></div><button type="button" onclick="removeSkillActionRow(this)">삭제</button></div>
      <label class="skill-action-field skill-action-type-field"><span>액션 종류</span><select class="skill-action-type" onchange="renderSkillActionRows(readSkillActionsFromForm())">${options}</select></label>
      <div class="skill-support-warning">미지원 액션이거나 효과 설정이 누락되었습니다. 원본 데이터는 보존되지만 이 스킬 전체는 전투에서 사용하지 않습니다. 저장하려면 지원 설정으로 바꾸거나 삭제하세요.</div>
      ${TIMED_EFFECT_ACTIONS.includes(action.type) ? '<button type="button" onclick="replaceMissingEffectAction(this)">기본 효과 설정으로 교체</button>' : ""}
    </div>`;
  }
  const targetOptions = getActionTargetsForType(action.type);
  return `
    <div class="skill-action-row" data-action-index="${index}">
      <div class="skill-action-card-header">
        <div><span>ACTION ${index + 1}</span><strong>액션 설정</strong></div>
        <button type="button" onclick="removeSkillActionRow(this)">삭제</button>
      </div>
      <label class="skill-action-field skill-action-type-field">
        <span>액션 종류</span>
        <select class="skill-action-type" onchange="changeSkillActionType(this)">
          ${renderActionTypeOptions(action.type)}
        </select>
      </label>
      <label class="skill-action-field skill-action-target-field">
        <span>대상 (액션별 선택)</span>
        <select class="skill-action-target">
          ${targetOptions.map(target => `<option value="${target}" ${target === action.target ? "selected" : ""}>${ACTION_TARGET_LABELS[target] ?? target}</option>`).join("")}
        </select>
        <small>각 액션의 사거리 안에서 대상을 찾습니다. 회복은 해당 자원이 부족한 대상을 우선합니다.</small>
      </label>
      <div class="skill-action-condition-field">
        <label class="skill-action-field"><span>대상 HP 이하 (%) · 100: 제한 없음</span><input class="skill-action-target-hp" type="number" min="0" max="100" step="1" value="${action.targetHpBelow ?? 100}"></label>
        <label class="skill-action-field"><span>대상별 쿨타임 (초) · 0: 제한 없음</span><input class="skill-action-target-cooldown" type="number" min="0" step="0.1" value="${action.targetCooldown ?? 0}"></label>
        <small>동일 시전자의 같은 스킬·액션 기준입니다. 효과 적용 시 쿨타임을 시작하며, 광역·연쇄도 각 대상을 검사합니다.</small>
      </div>
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
      <div class="skill-action-field" data-action-field="fieldSettings">
        <label>필드 적용 효과<select class="skill-action-field-effect" onchange="changeSkillFieldEffect(this)">
          <option value="deal_damage" ${action.fieldEffect === "deal_damage" ? "selected" : ""}>피해</option>
          <option value="heal" ${action.fieldEffect === "heal" ? "selected" : ""}>회복</option>
          <option value="drain_resource" ${action.fieldEffect === "drain_resource" ? "selected" : ""}>자원 감소</option>
          <option value="move" ${action.fieldEffect === "move" ? "selected" : ""}>강제 이동</option>
          <option value="add_buff" ${action.fieldEffect === "add_buff" ? "selected" : ""}>버프 부여</option>
          <option value="add_state" ${action.fieldEffect === "add_state" ? "selected" : ""}>상태 부여</option>
        </select></label>
        <label>강제 이동 방식<select class="skill-action-field-move-type"><option value="Push" ${action.fieldMoveType === "Push" ? "selected" : ""}>중심에서 밀치기</option><option value="Knockback" ${action.fieldMoveType === "Knockback" ? "selected" : ""}>중심에서 넉백</option><option value="Pull" ${action.fieldMoveType === "Pull" ? "selected" : ""}>중심으로 끌어오기</option></select></label>
        <label>강제 이동 거리<input class="skill-action-field-distance" type="number" min="1" max="10" step="0.1" value="${action.fieldDistance ?? 1}"></label>
        <label>설치 중심<select class="skill-action-field-center"><option value="target" ${action.fieldCenter === "target" ? "selected" : ""}>선택 대상 위치</option><option value="self" ${action.fieldCenter === "self" ? "selected" : ""}>시전자 위치</option></select></label>
        <label>필드 반경<input class="skill-action-field-radius" type="number" min="0.1" step="0.1" value="${action.fieldRadius}" placeholder="3"></label>
        <label>지속시간 (초, 0: 전투 종료까지)<input class="skill-action-field-duration" type="number" min="0" step="0.1" value="${action.duration}"></label>
        <label>적용 간격 (초)<input class="skill-action-field-interval" type="number" min="${1/60}" step="any" value="${action.fieldInterval}"></label>
        <small>생성 순간의 위치에 고정됩니다. 각 간격마다 범위 안의 유효 대상을 다시 찾습니다. 강제 이동은 계수를 사용하지 않고 필드 중심을 기준으로 적용됩니다.</small>
      </div>
      <div class="skill-range-section" data-action-field="range">
        <div data-action-field="chain">
          <label>추가 연쇄 횟수 (0: 사용 안 함)<input class="skill-action-chain-count" type="number" min="0" max="20" step="1" value="${action.chainCount}" onchange="updateSkillActionFieldVisibility(this)"></label>
          <label>연쇄 거리<input class="skill-action-chain-range" type="number" min="0" step="0.1" value="${action.chainRange}"></label>
          <small>연쇄 사용 시 원형 광역 대신 첫 대상부터 가까운 다음 대상으로 이어집니다. 같은 대상은 한 번만 적용하며, 횟수 2는 최대 3명입니다. 회복은 부족한 자원이 있는 대상만 이어집니다.</small>
        </div>
        <div data-action-field="area">
          <label>광역 반경 (0: 단일)<input class="skill-action-area" type="number" min="0" step="0.1" value="${action.area}"></label>
          <label>광역 중심<select class="skill-action-area-center"><option value="target" ${action.areaCenter === "target" ? "selected" : ""}>선택 대상</option><option value="self" ${action.areaCenter === "self" ? "selected" : ""}>자신</option></select></label>
        </div>
        <label data-action-field="maxTargets">최대 대상 수 (0: 별도 제한 없음)<input class="skill-action-max-targets" type="number" min="0" step="1" value="${action.maxTargets}"></label>
        <div class="skill-subsection-header">사거리</div>
        <label>최소 거리 (0: 제한 없음)<input class="skill-action-min-range" type="number" min="0" step="0.1" value="${action.minRange}"></label>
        <small>시전자와 지정 대상 사이 거리입니다. 자신·소환·자신 중심 광역에는 적용하지 않으며, 광역 피해의 내부 빈 공간을 만들지는 않습니다. 최대 사거리보다 크면 대상을 선택할 수 없습니다.</small>
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
            ${renderResourceOptions(action.healResource)}
          </select>
        </label>
        <label class="skill-inline-field" data-action-field="drainResource">
          <span>감소 대상 자원</span>
          <select class="skill-action-drain-resource">
            ${renderResourceOptions(action.drainResource)}
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
      ${renderTransformActionArea(action)}
      ${renderCopySkillActionArea(action)}
      ${renderSummonCommandActionArea(action)}
      ${renderReserveSwapActionArea(action)}
      ${renderReviveAllyActionArea(action)}
      ${renderEquipmentSetSwapActionArea(action)}
      ${renderRuleOverrideActionArea(action)}
      ${renderTimedEffectFields(action.type === "create_field" ? {...action,type:action.fieldEffect,duration:action.fieldEffectDuration} : action)}
      ${renderEntityActionArea(action)}
    </div>
  `;
}

function renderSkillCoefficientRow(coefficient) {
  const normalized = normalizeCoefficient(coefficient);
  const effectIdField = normalized.type === "calculated" && normalized.field === "targetEffectIdStacks"
    ? `<label class="skill-coefficient-effect-id">효과 ID<input class="skill-coefficient-effect-id-input" value="${escapeHtml(normalized.effectId)}" placeholder="예: bleed"></label>` : "";
  const detailFields = normalized.type === "calculated" ? `
      <select class="skill-coefficient-field" onchange="refreshSkillCoefficientRow(this)">
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
      ${effectIdField}
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
          ${renderResourceOptions(normalized.resource)}
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
  if (row.dataset.unsupportedAction) return;
  const type = row.querySelector(".skill-action-type")?.value ?? "deal_damage";
  const fieldEffect = row.querySelector(".skill-action-field-effect")?.value ?? "deal_damage";
  const fieldTimedEffect = type === "create_field" && ["add_buff","add_state"].includes(fieldEffect);
  updateSkillActionTargetOptions(row, type);
  normalizeMoveFields(row, type);
  const hiddenFieldsByType = {
    deal_damage: ["healResource", "drainResource", "moveType", "distance", "fieldSettings"],
    heal: ["damageType", "drainResource", "moveType", "distance", "fieldSettings", "moveSpeed"],
    drain_resource: ["damageType", "healResource", "moveType", "distance", "fieldSettings", "moveSpeed"],
    command_summon:["damageType","healResource","drainResource","moveType","distance","moveSpeed","coefficients","fieldSettings"],
    move: ["damageType", "healResource", "drainResource", "coefficients", "fieldSettings"],
    transform:["damageType","healResource","drainResource","moveType","distance","moveSpeed","coefficients","fieldSettings","range"],
    copy_skill:["damageType","healResource","drainResource","moveType","distance","moveSpeed","coefficients","fieldSettings","range"],
    swap_reserve:["damageType","healResource","drainResource","moveType","distance","moveSpeed","coefficients","fieldSettings","range"],
    deploy_reserve:["damageType","healResource","drainResource","moveType","distance","moveSpeed","coefficients","fieldSettings","range"],
    revive_ally:["damageType","healResource","drainResource","moveType","distance","moveSpeed","coefficients","fieldSettings"],
    swap_equipment_set:["damageType","healResource","drainResource","moveType","distance","moveSpeed","coefficients","fieldSettings","range"],
    override_rule:["damageType","healResource","drainResource","moveType","distance","moveSpeed","coefficients","fieldSettings","range"]
  };
  const hiddenFields = [...(hiddenFieldsByType[type] ?? [])];
  if (!TIMED_EFFECT_ACTIONS.includes(type) && !fieldTimedEffect) hiddenFields.push("timedEffect");
  else {
    hiddenFields.push("coefficients", "damageType", "healResource", "drainResource", "moveType", "distance", "moveSpeed");
    if (!fieldTimedEffect) hiddenFields.push("fieldSettings");
    if (type.startsWith("delete_")) hiddenFields.push("effectAdd");
    else hiddenFields.push("effectDelete");
    const effectType=fieldTimedEffect ? fieldEffect : type;
    if (effectType !== "add_buff") hiddenFields.push("effectBuff");
    if (effectType !== "add_state") hiddenFields.push("effectState");
  }
  if (!supportsActionArea(type) && type !== "create_field") hiddenFields.push("area", "chain", "maxTargets");
  else if (TIMED_EFFECT_ACTIONS.includes(type)) hiddenFields.push("chain");
  if (type === "create_field") hiddenFields.push("area","chain","moveType","distance","moveSpeed");
  else hiddenFields.push("fieldSettings");
  if (Number(row.querySelector(".skill-action-chain-count")?.value) > 0) hiddenFields.push("area");
  if (type !== "summon_entity") hiddenFields.push("summon");
  else hiddenFields.push("coefficients", "damageType", "healResource", "drainResource", "moveType", "distance", "fieldSettings");
  if(type !== "transform") hiddenFields.push("transform");
  if(type !== "copy_skill") hiddenFields.push("copySkill");
  if(type !== "command_summon") hiddenFields.push("summonCommand");
  if(!["swap_reserve","deploy_reserve"].includes(type)) hiddenFields.push("reserveSwap");
  if(type !== "revive_ally") hiddenFields.push("reviveAlly");
  if(type !== "swap_equipment_set") hiddenFields.push("equipmentSetSwap");
  if(type !== "override_rule") hiddenFields.push("ruleOverride");
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
    effectId: row.querySelector(".skill-coefficient-effect-id-input")?.value,
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
    effectId: coefficientRow.querySelector(".skill-coefficient-effect-id-input")?.value,
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
    if (row.dataset.unsupportedAction) {
      const original = JSON.parse(row.dataset.unsupportedAction);
      if (type === "unsupported_move" || (type === original.type && original.type !== "move")) return original;
      return normalizeSkillAction(createDefaultAction(type));
    }
    const range = readSkillRangeFromRow(row);
    return normalizeSkillAction({
      type,
      target: row.querySelector(".skill-action-target")?.value,
      rangeMode: range.rangeMode,
      rangeValue: range.rangeValue,
      minRange: Number(row.querySelector(".skill-action-min-range")?.value ?? 0),
      targetHpBelow: Number(row.querySelector(".skill-action-target-hp")?.value ?? 100),
      targetCooldown: Number(row.querySelector(".skill-action-target-cooldown")?.value ?? 0),
      ...(TIMED_EFFECT_ACTIONS.includes(type) || (type === "create_field" && ["add_buff","add_state"].includes(row.querySelector('.skill-action-field-effect')?.value)) ? {effect:readSkillEffectFromRow(row)} : {}),
      ...(type === "transform" ? {transform:{id:row.querySelector('.skill-transform-id')?.value,name:row.querySelector('.skill-transform-name')?.value,
        mode:row.querySelector('.skill-transform-mode')?.value,modifiers:Object.fromEntries([...row.querySelectorAll('.skill-transform-stat')].map(input=>[input.dataset.stat,Number(input.value)])),
        skillIds:[...row.querySelectorAll('.skill-transform-skills option:checked')].map(option=>option.value),
        attackSkillId:row.querySelector('.skill-transform-attack-skill')?.value ?? ""}} : {}),
      ...(type === "copy_skill" ? {
        copySourceIndex:Number(row.querySelector('.skill-copy-source-index')?.value ?? 1),
        copySlot:Number(row.querySelector('.skill-copy-slot')?.value ?? 1)
      } : {}),
      ...(["swap_reserve","deploy_reserve"].includes(type) ? {
        reserveIndex:Number(row.querySelector('.skill-reserve-index')?.value ?? 1)
      } : {}),
      ...(type === "revive_ally" ? {
        reviveHpPercent:Number(row.querySelector('.skill-revive-hp')?.value ?? 50),
        reviveMpPercent:Number(row.querySelector('.skill-revive-mp')?.value ?? 100),
        reviveStPercent:Number(row.querySelector('.skill-revive-st')?.value ?? 100),
        reviveInvulnerable:Number(row.querySelector('.skill-revive-invulnerable')?.value ?? 0),
        revivePosition:row.querySelector('.skill-revive-position')?.value ?? "death"
      } : {}),
      ...(type === "command_summon" ? {summonCommand:row.querySelector('.skill-summon-command')?.value ?? "hold"} : {}),
      ...(type === "swap_equipment_set" ? {
        equipmentSetIndex:Number(row.querySelector('.skill-equipment-set-index')?.value ?? 1)
      } : {}),
      ...(type === "override_rule" ? {ruleOverride:{
        id:row.querySelector('.skill-rule-id')?.value,
        disableTeamSynergies:Boolean(row.querySelector('.skill-rule-disable-synergies')?.checked),
        disableEquipmentEffects:Boolean(row.querySelector('.skill-rule-disable-equipment')?.checked),
        disableAllSkills:Boolean(row.querySelector('.skill-rule-disable-all')?.checked),
        disabledSkillIds:[...row.querySelectorAll('.skill-rule-disabled-skills option:checked')].map(option=>option.value),
        damagePercent:Number(row.querySelector('.skill-rule-damage')?.value ?? 100),
        receivedDamagePercent:Number(row.querySelector('.skill-rule-received-damage')?.value ?? 100),
        healingPercent:Number(row.querySelector('.skill-rule-healing')?.value ?? 100),
        receivedHealingPercent:Number(row.querySelector('.skill-rule-received-healing')?.value ?? 100),
        resourceCostPercent:Number(row.querySelector('.skill-rule-cost')?.value ?? 100),
        cooldownPercent:Number(row.querySelector('.skill-rule-cooldown')?.value ?? 100)
      }} : {}),
      chainCount: Number(row.querySelector(".skill-action-chain-count")?.value ?? 0),
      chainRange: Number(row.querySelector(".skill-action-chain-range")?.value ?? 3),
      coefficients: type === "move" ? [] : readSkillCoefficientsFromRow(row),
      healResource: row.querySelector(".skill-action-heal-resource")?.value ?? "HP",
      drainResource: row.querySelector(".skill-action-drain-resource")?.value ?? "MP",
      damageType: row.querySelector(".skill-action-damage-type")?.value ?? "physical",
      moveType: row.querySelector(".skill-action-move-type")?.value ?? "Walk",
      moveSpeed: Number(row.querySelector(".skill-action-move-speed")?.value ?? 1),
      distance: Number(row.querySelector(".skill-action-distance")?.value ?? 0),
      fieldRadius: Number(row.querySelector(".skill-action-field-radius")?.value ?? 0),
      fieldEffect: row.querySelector(".skill-action-field-effect")?.value,
      fieldEffectDuration:Number(row.querySelector('.skill-effect-duration')?.value ?? 5),
      fieldMoveType:row.querySelector(".skill-action-field-move-type")?.value,
      fieldDistance:Number(row.querySelector(".skill-action-field-distance")?.value ?? 1),
      fieldCenter: row.querySelector(".skill-action-field-center")?.value,
      fieldInterval: Number(row.querySelector(".skill-action-field-interval")?.value ?? 1),
      area: Number(row.querySelector(".skill-action-area")?.value ?? 0),
      areaCenter: row.querySelector(".skill-action-area-center")?.value,
      maxTargets: Number(row.querySelector(".skill-action-max-targets")?.value ?? 0),
      entityId: row.querySelector('.skill-action-entity-id')?.value,
      summonCenter:row.querySelector('.skill-action-summon-center')?.value ?? "self",
      inheritStats:Object.fromEntries([...row.querySelectorAll('.skill-action-inherit-stat')].map(input=>[input.dataset.stat,Number(input.value)])),
      count: Number(row.querySelector('.skill-action-count')?.value ?? 1),
      limit: Number(row.querySelector('.skill-action-limit')?.value ?? 3),
      protectOwnerPercent: Number(row.querySelector('.skill-action-protect-percent')?.value ?? 0),
      protectOwnerScope: row.querySelector('.skill-action-protect-scope')?.value ?? "all",
      protectOwnerPriority: Number(row.querySelector('.skill-action-protect-priority')?.value ?? 0),
      transferStateScope: row.querySelector('.skill-action-transfer-state')?.value ?? "none",
      transferStatePriority: Number(row.querySelector('.skill-action-transfer-priority')?.value ?? 0),
      duration: Number(row.querySelector(type === "create_field" ? '.skill-action-field-duration' : type === "transform" ? '.skill-transform-duration' : type === "override_rule" ? '.skill-rule-duration' : ["swap_reserve","deploy_reserve"].includes(type) ? '.skill-reserve-duration' : TIMED_EFFECT_ACTIONS.includes(type) ? '.skill-effect-duration' : '.skill-action-duration')?.value ?? (type === "create_field" ? 0 : 20))
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
      description: skillDescriptionEl.value.trim(),
      slot: normalizeSkillSlot(skillSlotEl.value),
      cooldown: normalizeSkillCooldown(skillCooldownEl.value),
      castTime: normalizeSkillCastTime(skillCastTimeEl.value),
      channel:readSkillChannelForm(),
      ...(skillSlotEl.value === "passive" ? {passiveTrigger:readPassiveTriggerForm()} : {}),
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

  if (skill.actions.some(action => action.type === 'summon_entity' && !getEntityById(action.entityId))) {
    alert('모든 소환 액션에 Entity를 선택하세요.');
    return;
  }
  if (skill.actions.some(action => action.coefficients?.some(coefficient => coefficient.field === "targetEffectIdStacks" && !coefficient.effectId))) {
    alert("특정 효과 ID 중첩 계수에 효과 ID를 입력하세요.");
    return;
  }
  if (!isSkillChannelConfigured(skill)) {
    alert("채널링의 적용 간격은 0보다 큰 값으로 설정하세요.");return;
  }
  if (skill.slot === "passive" && !isPassiveTriggerConfigured(skill)) {
    alert("패시브의 발동 조건과 0~100 사이의 발동 확률을 설정하세요.");
    return;
  }
  if (!isSkillExecutable(skill)) {
    alert(`미지원 액션을 지원 액션으로 변경하거나 삭제하세요: ${getUnsupportedActionNames(skill).join(", ")}`);
    return;
  }

  const skillsBeforeSave = skillsJson.slice();
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
    skillsJson = skillsBeforeSave;
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
  monsterJson.forEach(monster => {
    monster.skillIds = (monster.skillIds ?? []).filter(id => !deletedIds.includes(id));
  });

  try {
    await saveSkillJson();
    if (typeof saveCharacterJson === "function") {
      await saveCharacterJson();
    }
    await saveItemJson();
    await saveMonsterJson();
    renderSkillPage();
    renderItemPage();
  } catch (error) {
    logError("skill", "스킬 삭제 처리 중 실패했습니다.", error);
    alert("스킬 데이터를 삭제하지 못했습니다.");
  }
}

function getUnitSkill(unit, fallbackSkillId = DEFAULT_ATTACK_SKILL_ID) {
  const transform=(unit?.activeEffects ?? []).find(effect=>effect.kind === "transform");
  const assigned = getSkillById(transform?.attackSkillId || unit?.attackSkillId);
  if (isSkillExecutable(assigned) && assigned.slot !== "passive" && !isUnitSkillDisabled(unit,assigned)) return assigned;
  if (fallbackSkillId === DEFAULT_ATTACK_SKILL_ID) {
    return isUnitSkillDisabled(unit,DEFAULT_ATTACK_SKILL_ID) ? null : createDefaultAttackSkillForUnit(unit);
  }
  if (isUnitSkillDisabled(unit,fallbackSkillId)) return null;
  const fallback = getSkillById(fallbackSkillId);
  return (isSkillExecutable(fallback) && !isUnitSkillDisabled(unit,fallback) ? fallback : null)
    ?? createDefaultSkillJson().find(skill => skill.id === fallbackSkillId)
    ?? createDefaultSkillJson()[0];
}

function resolveSkillActionTarget(source, action, preferredTarget = null, skill = null) {
  if (!source?.alive || !isSkillActionSupported(action)) return null;
  const forcedMovement = action.type === "move" && ["Knockback","Pull","Push"].includes(action.moveType);
  if (action.type === "move" && !forcedMovement && (hasBattleState(source,"stun") || hasBattleState(source,"root"))) return null;
  if (action.type === "summon_entity") {
    if (!canSummonBattleUnit(source,action,skill)) return null;
    if (action.summonCenter !== "target") return isActionTargetEligible(source,source,action,skill) ? source : null;
    const ownSquad=source.side === "enemy" ? enemySquad : playerSquad;
    const squad=action.target === "enemy" ? (source.side === "enemy" ? playerSquad : enemySquad) : action.target === "summon" ? ownSquad.filter(unit=>unit.isSummon && unit.summoner===source) : ownSquad;
    const minimum=getActionMinimumRangePixels(action),maximum=getActionRangePixels(source,action);
    const candidates=(action.target === "self" ? [source] : squad).filter(unit=>unit.alive && (action.target !== "ally" || unit !== source) && isActionTargetEligible(source,unit,action,skill)
      && distance(source,unit)>=minimum && distance(source,unit)<=maximum).sort((a,b)=>distance(source,a)-distance(source,b));
    return candidates.includes(preferredTarget) ? preferredTarget : candidates[0] ?? null;
  }
  if (action.type === "copy_skill") return getCopySkillCandidate(source, action, preferredTarget);
  if (action.type === "deploy_reserve") return getReserveCandidates(source)[Math.max(1,Number(action.reserveIndex)||1)-1] ? source : null;
  if (action.type === "revive_ally") {
    const squad=source.side === "enemy" ? enemySquad : playerSquad;
    const range=getActionRangePixels(source,action),minimumRange=getActionMinimumRangePixels(action);
    const candidates=squad.filter(unit=>!unit.alive && !unit.isSummon && !unit.isWaiting && !unit.isReserve && unit.hp <= 0
      && distance(source,unit) >= minimumRange && distance(source,unit) <= range).sort((a,b)=>distance(source,a)-distance(source,b));
    return candidates.includes(preferredTarget) ? preferredTarget : candidates[0] ?? null;
  }
  if (action.type === "swap_reserve") return getReserveSwapTarget(source, action, preferredTarget);
  const ownSquad = source.side === "enemy" ? enemySquad : playerSquad;
  const otherSquad = source.side === "enemy" ? playerSquad : enemySquad;
  const selfArea = !isChainAction(action) && action.area > 0 && (action.areaCenter === "self" || action.target === "self") && supportsActionArea(action.type);
  const range = selfArea ? action.area * ATTACK_RANGE_UNIT : getActionRangePixels(source, action);
  const pool = action.target === "self" && !selfArea ? [source] : action.target === "enemy" ? otherSquad
    : action.target === "summon" ? ownSquad.filter(unit=>unit.isSummon && unit.summoner===source) : ownSquad;
  const minimumRange = getActionMinimumRangePixels(action);
  let candidates = pool.filter(unit => {
    const targetDistance = distance(source, unit);
    return unit.alive && isActionTargetEligible(source, unit, action, skill) && targetDistance >= minimumRange && targetDistance <= range;
  });
  if (action.type === "swap_equipment_set") {
    const setIndex=Math.max(0,Math.min(2,Math.floor(Number(action.equipmentSetIndex)||1)-1));
    candidates=candidates.filter(unit=>!unit.isSummon && unit.equipmentLoadouts?.[setIndex]);
  }
  const resource = action.type === "heal" ? getResourceField(action.healResource ?? "HP") : null;
  const drainedResource = action.type === "drain_resource" ? getResourceField(action.drainResource ?? "MP") : null;
  if (action.type.startsWith("delete_")) {
    candidates = candidates.filter(unit => unit.activeEffects?.some(effect => matchesEffectDispel(effect,action)));
  }
  if (resource && normalizeResourceReference(action.healResource) !== "BP") {
    candidates = candidates.filter(unit => getUnitResourceState(unit, action.healResource) && getUnitResourceCurrent(unit, action.healResource) < getUnitResourceMax(unit, action.healResource));
    candidates.sort((a, b) => getUnitResourceCurrent(a, action.healResource) / Math.max(1, getUnitResourceMax(a, action.healResource)) - getUnitResourceCurrent(b, action.healResource) / Math.max(1, getUnitResourceMax(b, action.healResource)) || distance(source, a) - distance(source, b));
  } else {
    if (drainedResource) candidates = candidates.filter(unit => getUnitResourceCurrent(unit, action.drainResource) > 0);
    candidates.sort((a, b) => distance(source, a) - distance(source, b));
  }
  return candidates.includes(preferredTarget) ? preferredTarget : candidates[0] ?? null;
}

function getCoefficientBaseValue(coefficient, source, target = null, execution = null) {
  if (coefficient.field === "actualDamageTotal") return source.actualDamageTotal ?? 0;
  if (coefficient.field === "moveDistanceTotal") return source.moveDistanceTotal ?? 0;
  if (coefficient.field === "targetEffectStacks") return (target?.activeEffects ?? []).reduce((sum, effect) => sum + (effect.stacks || 0), 0);
  if (coefficient.field === "targetEffectIdStacks") return (target?.activeEffects ?? []).filter(effect => effect.id === coefficient.effectId).reduce((sum, effect) => sum + (effect.stacks || 0), 0);
  if (coefficient.field === "ownedSummonCount") return [...playerSquad, ...enemySquad].filter(unit => unit.alive && unit.isSummon && unit.summoner === source).length;
  if (coefficient.field === "previousActualDamage") return execution?.previousActualDamage ?? 0;
  if (coefficient.field === "executionActualDamage") return execution?.actualDamage ?? 0;
  if (coefficient.field === "previousActualHealing") return execution?.previousActualHealing ?? 0;
  if (coefficient.field === "executionActualHealing") return execution?.actualHealing ?? 0;
  if (coefficient.field === "previousResourceDrained") return execution?.previousResourceDrained ?? 0;
  if (coefficient.field === "executionResourceDrained") return execution?.resourceDrained ?? 0;
  if (coefficient.field === "resourceSpentTotal") return execution?.resourceSpent?.total ?? 0;
  if (coefficient.field === "hpResourceSpent") return execution?.resourceSpent?.HP ?? 0;
  if (coefficient.field === "mpResourceSpent") return execution?.resourceSpent?.MP ?? 0;
  if (coefficient.field === "stResourceSpent") return execution?.resourceSpent?.ST ?? 0;
  if (coefficient.field === "bpResourceSpent") return execution?.resourceSpent?.BP ?? 0;
  if (["hp", "mp", "st", "bp", "atk", "magic", "defense", "resistance"].includes(coefficient.field)) {
    return Number(source[coefficient.field]) || 0;
  }
  return Number(source.attributes?.[coefficient.field]) || 0;
}

function getCoefficientValue(coefficient, source, target = null, execution = null) {
  if (coefficient.type === "fixed") {
    return Number(coefficient.value) || 0;
  }

  const baseValue = getCoefficientBaseValue(coefficient, source, target, execution);
  const inputValue = Number(coefficient.value) || 0;
  return coefficient.calc === "percent" ? baseValue * inputValue / 100 : baseValue + inputValue;
}

function getActionCoefficientValue(action, source, target = null, execution = null) {
  return action.coefficients.reduce((total, coefficient) => total + getCoefficientValue(coefficient, source, target, execution), 0);
}

function renderTransformActionArea(action) {
  const transform=normalizeTransformation(action.transform);
  const selectedSkills=new Set(transform.skillIds);
  return `<div class="skill-action-field" data-action-field="transform">
    <div class="skill-subsection-header">변신 설정</div>
    <label>형태 ID<input class="skill-transform-id" value="${escapeHtml(transform.id)}"></label>
    <label>표시 이름<input class="skill-transform-name" value="${escapeHtml(transform.name)}"></label>
    <label>능력치 계산<select class="skill-transform-mode"><option value="flat" ${transform.mode === "flat" ? "selected" : ""}>고정값 가산</option><option value="percent" ${transform.mode === "percent" ? "selected" : ""}>기본 능력치의 % 가산</option></select></label>
    <label>지속시간 (초, 0: 전투 종료까지)<input class="skill-transform-duration" type="number" min="0" step="0.1" value="${action.duration ?? 5}"></label>
    <label>형태 액티브 스킬<select class="skill-transform-skills" multiple size="5">${skillsJson.filter(skill=>skill.slot === "active" && isSkillExecutable(skill)).map(skill=>`<option value="${escapeHtml(skill.id)}" ${selectedSkills.has(skill.id) ? "selected" : ""}>${escapeHtml(skill.name)}</option>`).join("")}</select></label>
    <label>형태 기본 공격<select class="skill-transform-attack-skill">${getSkillOptionsHtml(transform.attackSkillId)}</select></label>
    <div class="skill-transform-modifiers">${TRANSFORM_STATS.map(stat=>`<label>${BUFF_STAT_LABELS[stat] ?? stat}<input class="skill-transform-stat" data-stat="${stat}" type="number" step="0.1" value="${transform.modifiers[stat]}"></label>`).join("")}</div>
    <small>형태 스킬을 하나 이상 선택하면 변신 중 원래 액티브 목록을 교체합니다. 새 변신은 기존 변신을 교체하며 만료·사망·전투 종료 시 원래 능력치와 스킬로 복원합니다.</small>
  </div>`;
}

function renderCopySkillActionArea(action) {
  return `<div class="skill-action-field" data-action-field="copySkill">
    <div class="skill-subsection-header">스킬 복제 설정</div>
    <label>대상의 액티브 순번<select class="skill-copy-source-index">${[1,2,3,4].map(index=>`<option value="${index}" ${index === action.copySourceIndex ? "selected" : ""}>${index}번째 액티브</option>`).join("")}</select></label>
    <label>내 복제 슬롯<select class="skill-copy-slot">${[1,2,3,4].map(index=>`<option value="${index}" ${index === action.copySlot ? "selected" : ""}>복제 슬롯 ${index}</option>`).join("")}</select></label>
    <small>대기 중인 아군도 선택합니다. 패시브와 다른 복제 스킬은 복제 후보에서 제외하며 같은 복제 슬롯을 다시 사용하면 기존 복제본을 교체합니다.</small>
  </div>`;
}

function renderSummonCommandActionArea(action) {
  return `<div class="skill-action-field" data-action-field="summonCommand">
    <div class="skill-subsection-header">소환수 명령 설정</div>
    <label>명령<select class="skill-summon-command"><option value="hold" ${action.summonCommand === "hold" ? "selected" : ""}>정지</option><option value="release" ${action.summonCommand === "release" ? "selected" : ""}>행동 재개</option><option value="recall" ${action.summonCommand === "recall" ? "selected" : ""}>소환자 위치로 복귀</option><option value="dismiss" ${action.summonCommand === "dismiss" ? "selected" : ""}>소환 해제</option></select></label>
    <small>정지는 이동과 자체 행동을 멈추고, 행동 재개는 Entity의 원래 AI와 이동속도를 복구합니다. 광역 반경과 최대 대상 수로 여러 소환수에게 동시에 명령할 수 있습니다.</small>
  </div>`;
}

function renderReserveSwapActionArea(action) {
  return `<div class="skill-action-field" data-action-field="reserveSwap">
    <div class="skill-subsection-header">예비대 ${action.type === "deploy_reserve" ? "증원" : "교대"} 설정</div>
    <label>투입할 예비대 순번<select class="skill-reserve-index">${Array.from({length:10},(_,offset)=>offset+1).map(index=>`<option value="${index}" ${index === action.reserveIndex ? "selected" : ""}>대기 중 예비대 ${index}순번</option>`).join("")}</select></label>
    <label>지속시간 (초, 0: 전투 종료까지)<input class="skill-reserve-duration" type="number" min="0" step="0.1" value="${action.duration ?? 0}"></label>
    <small>현재 대기 중인 예비대를 편성 순서대로 셉니다. 증원은 전장 인원 제한을 넘겨 추가 투입합니다. 시간제 교대는 만료되거나 투입 유닛이 먼저 쓰러지면 원래 유닛이 복귀합니다.</small>
  </div>`;
}

function renderReviveAllyActionArea(action) {
  return `<div class="skill-action-field" data-action-field="reviveAlly">
    <div class="skill-subsection-header">아군 부활 설정</div>
    <label>HP 회복 (%)<input class="skill-revive-hp" type="number" min="1" max="100" step="1" value="${action.reviveHpPercent ?? 50}"></label>
    <label>MP 회복 (%)<input class="skill-revive-mp" type="number" min="0" max="100" step="1" value="${action.reviveMpPercent ?? 100}"></label>
    <label>ST 회복 (%)<input class="skill-revive-st" type="number" min="0" max="100" step="1" value="${action.reviveStPercent ?? 100}"></label>
    <label>부활 무적 (초)<input class="skill-revive-invulnerable" type="number" min="0" step="0.1" value="${action.reviveInvulnerable ?? 0}"></label>
    <label>부활 위치<select class="skill-revive-position"><option value="death" ${action.revivePosition === "death" ? "selected" : ""}>사망 위치</option><option value="start" ${action.revivePosition === "start" ? "selected" : ""}>전투 시작 위치</option></select></label>
    <small>부활·진입 대기 중이 아닌 사망한 일반 아군만 선택합니다. 소환수와 예비대는 대상에서 제외합니다.</small>
  </div>`;
}

function renderEquipmentSetSwapActionArea(action) {
  return `<div class="skill-action-field" data-action-field="equipmentSetSwap">
    <div class="skill-subsection-header">장비 세트 교체 설정</div>
    <label>교체할 세트<select class="skill-equipment-set-index">${[1,2,3].map(index=>`<option value="${index}" ${index === action.equipmentSetIndex ? "selected" : ""}>세트 ${index}</option>`).join("")}</select></label>
    <small>대상에게 해당 세트가 없으면 실패합니다. 현재 HP·자원·효과·스킬 쿨타임은 유지하고 장비 능력치와 무기 공격만 교체합니다.</small>
  </div>`;
}

function applyBattleEquipmentLoadout(target,loadout,index) {
  const disabled=(target.runtimeRuleOverrides ?? []).some(rule=>rule.disableEquipmentEffects);
  const applied=disabled && loadout.withoutEquipment ? loadout.withoutEquipment : loadout;
  const current={hp:target.hp,mp:target.mp,st:target.st,bp:target.bp};
  const combatStats=["atk","magic","speed","attackSpeed","castSpeed","defense","resistance","attackRange"];
  for (const stat of combatStats) {
    target[stat]=applied[stat];
    if (target.effectBaseStats?.[stat]) {
      target.effectBaseStats[stat].original=applied[stat];
      target.effectBaseStats[stat].value=applied[stat];
    }
  }
  target.maxHp=applied.maxHp;target.maxMp=applied.maxMp;target.maxSt=applied.maxSt;target.baseBp=applied.baseBp;target.maxBp=applied.baseBp;
  target.hp=Math.min(current.hp,target.maxHp);target.mp=Math.min(current.mp,target.maxMp);target.st=Math.min(current.st,target.maxSt);target.bp=Math.min(current.bp,target.maxBp);
  target.attackType=applied.attackType;target.attackSkillId=applied.attackSkillId;
  target.weaponAttacks=structuredClone(applied.weaponAttacks ?? []);
  target.sameTargetWeaponPenaltyPercent=applied.sameTargetWeaponPenaltyPercent;
  target.weaponAttackStates=target.weaponAttacks.map(weapon=>({weapon,cooldown:getAttackCooldown(target),castTimer:0,target:null,focusTarget:null}));
  target.activeEquipmentSet=index;
  recalculateBattleBuffs(target);
}

function refreshBattleEquipmentRuleState(target) {
  const index=Math.max(0,Math.min(2,Number(target?.activeEquipmentSet)||0));
  const loadout=target?.equipmentLoadouts?.[index];
  if (loadout) applyBattleEquipmentLoadout(target,loadout,index);
}

function swapBattleEquipmentSet(source,target,action,skill=null) {
  if (!target?.alive || target.isSummon) return false;
  const index=Math.max(0,Math.min(2,Math.floor(Number(action.equipmentSetIndex)||1)-1));
  const loadout=target.equipmentLoadouts?.[index];
  if (!loadout) {
    addBattleEventLog(source,`${target.name}: 장비 세트 ${index+1} 없음`);
    return false;
  }
  applyBattleEquipmentLoadout(target,loadout,index);
  publishBattleEvents([{type:"equipment_set_swap",source,target,skill,reason:loadout.name}]);
  addBattleEventLog(source,`${target.name}: ${loadout.name} 장비 세트로 교체`);
  return true;
}

function renderRuleOverrideActionArea(action) {
  const rule=action.ruleOverride ?? {id:"skill_rule",damagePercent:100,receivedDamagePercent:100,healingPercent:100,receivedHealingPercent:100,resourceCostPercent:100,cooldownPercent:100,disableTeamSynergies:false,disableEquipmentEffects:false,disableAllSkills:false,disabledSkillIds:[]};
  const disabled=new Set(rule.disabledSkillIds ?? []);
  return `<div class="skill-action-field" data-action-field="ruleOverride">
    <div class="skill-subsection-header">규칙 변경 설정</div>
    <label>규칙 ID<input class="skill-rule-id" value="${escapeHtml(rule.id)}" placeholder="예: command_attack"></label>
    <label>주는 피해(%)<input class="skill-rule-damage" type="number" min="0" step="1" value="${rule.damagePercent}"></label>
    <label>받는 피해(%)<input class="skill-rule-received-damage" type="number" min="0" step="1" value="${rule.receivedDamagePercent}"></label>
    <label>주는 치유(%)<input class="skill-rule-healing" type="number" min="0" step="1" value="${rule.healingPercent}"></label>
    <label>받는 치유(%, 0: 치유 금지)<input class="skill-rule-received-healing" type="number" min="0" step="1" value="${rule.receivedHealingPercent}"></label>
    <label>스킬 자원 비용(%)<input class="skill-rule-cost" type="number" min="0" step="1" value="${rule.resourceCostPercent}"></label>
    <label>재사용 대기시간(%)<input class="skill-rule-cooldown" type="number" min="0" step="1" value="${rule.cooldownPercent}"></label>
    <label class="skill-inline-check"><input class="skill-rule-disable-synergies" type="checkbox" ${rule.disableTeamSynergies ? "checked" : ""}> 팀 편성 시너지 무효</label>
    <label class="skill-inline-check"><input class="skill-rule-disable-equipment" type="checkbox" ${rule.disableEquipmentEffects ? "checked" : ""}> 장비 능력치·무기 효과 무효</label>
    <label class="skill-inline-check"><input class="skill-rule-disable-all" type="checkbox" ${rule.disableAllSkills ? "checked" : ""}> 모든 스킬 금지</label>
    <label>금지할 스킬<select class="skill-rule-disabled-skills" multiple size="6">${skillsJson.map(skill=>`<option value="${escapeHtml(skill.id)}" ${disabled.has(skill.id) ? "selected" : ""}>${escapeHtml(skill.name)} (${getSkillSlotLabel(skill.slot)})</option>`).join("")}</select></label>
    <label>지속시간 (초, 0: 전투 종료까지)<input class="skill-rule-duration" type="number" min="0" step="0.1" value="${action.duration}"></label>
    <small>팀 배율에 곱해서 적용합니다. 모든 스킬 금지는 기본 공격·회복과 이후 복제되는 스킬도 차단합니다. 개별 선택은 액티브·패시브·장비 연결 여부와 관계없이 적용됩니다. 같은 규칙 ID를 다시 적용하면 값과 지속시간을 갱신합니다.</small>
  </div>`;
}

function createSkillExecutionContext(resourceSpent = null) {
  return {previousActualDamage:0,actualDamage:0,previousActualHealing:0,actualHealing:0,previousResourceDrained:0,resourceDrained:0,
    resourceSpent:resourceSpent ?? {total:0,HP:0,MP:0,ST:0,BP:0}};
}

function skillUsesExecutionResults(skill) {
  return skill.actions.some(action => action.coefficients?.some(coefficient => ["previousActualDamage","executionActualDamage","previousActualHealing","executionActualHealing","previousResourceDrained","executionResourceDrained","resourceSpentTotal","hpResourceSpent","mpResourceSpent","stResourceSpent","bpResourceSpent"].includes(coefficient.field)));
}

function applySkill(source, target, skill, execution = createSkillExecutionContext()) {
  if (!source?.alive || !isSkillExecutable(skill)) {
    return;
  }
  skill.actions.forEach(action => {
    const resolved = resolveSkillActionTarget(source, action, target, skill);
    if (resolved) applySkillAction(source, resolved, action, skill, execution);
    else {
      execution.previousActualDamage=0;
      execution.previousActualHealing=0;
      execution.previousResourceDrained=0;
    }
  });
}

function applySkillAction(source, target, action, skill = null, execution = createSkillExecutionContext()) {
  if (!isSkillActionSupported(action)) return;
  if (action.type === "summon_entity") {
    if (!isActionTargetEligible(source, source, action, skill)) return;
    markActionTargetCooldown(source, source, action, skill);
    summonBattleUnits(source, action, skill, target);
    execution.previousActualDamage = 0;
    execution.previousActualHealing = 0;
    execution.previousResourceDrained = 0;
    return;
  }
  if (action.type === "copy_skill") {
    copyUnitSkill(source,target,action);
    execution.previousActualDamage = 0;
    execution.previousActualHealing = 0;
    execution.previousResourceDrained = 0;
    return;
  }
  if (action.type === "revive_ally") {
    reviveBattleUnitWithSkill(source,target,action,skill);
    execution.previousActualDamage=execution.previousActualHealing=execution.previousResourceDrained=0;
    return;
  }
  if (action.type === "deploy_reserve") {
    deployReserveWithSkill(source,action,skill);
    execution.previousActualDamage=execution.previousActualHealing=execution.previousResourceDrained=0;
    return;
  }
  if (action.type === "swap_reserve") {
    swapBattleUnitWithReserve(source,target,action);
    execution.previousActualDamage = 0;
    execution.previousActualHealing = 0;
    execution.previousResourceDrained = 0;
    return;
  }
  if (action.type === "swap_equipment_set") {
    swapBattleEquipmentSet(source,target,action,skill);
    execution.previousActualDamage = 0;
    execution.previousActualHealing = 0;
    execution.previousResourceDrained = 0;
    return;
  }
  if (action.type === "override_rule") {
    applyRuleOverride(source,target,action,skill);
    execution.previousActualDamage = 0;
    execution.previousActualHealing = 0;
    execution.previousResourceDrained = 0;
    return;
  }
  const targets = getSkillActionTargets(source, target, action, skill);
  if (isChainAction(action)) {
    showSkillChainImpact(source, targets, action);
  } else if (action.area > 0 && supportsActionArea(action.type)) {
    showSkillAreaImpact(source, target, action, skill);
  }
  let actualDamage = 0;
  let actualHealing = 0;
  let resourceDrained = 0;
  targets.forEach(resolvedTarget => {
    if (!resolvedTarget.alive || !isActionTargetEligible(source, resolvedTarget, action, skill)) return;
    markActionTargetCooldown(source, resolvedTarget, action, skill);
    if (action.type === "deal_damage") {
      actualDamage += applyActionDamage(source, resolvedTarget, action, skill, execution);
    } else if (action.type === "heal") {
      actualHealing += applyActionHeal(source, resolvedTarget, action, skill, execution);
    } else if (action.type === "drain_resource") {
      resourceDrained += applyActionResourceDrain(source,resolvedTarget,action,skill,execution);
    } else if (action.type === "move") {
      applyActionMove(source, resolvedTarget, action);
    } else if (action.type === "command_summon") {
      applySummonCommand(source,resolvedTarget,action,skill);
    } else if (TIMED_EFFECT_ACTIONS.includes(action.type)) {
      applyTimedEffectAction(source, resolvedTarget, action, skill);
    } else if (action.type === "transform") {
      applyTransformation(source,resolvedTarget,action,skill);
    } else if (action.type === "create_field") {
      applyCreateField(source, resolvedTarget, action, skill);
    }
  });
  execution.previousActualDamage = action.type === "deal_damage" ? actualDamage : 0;
  execution.previousActualHealing = action.type === "heal" ? actualHealing : 0;
  execution.previousResourceDrained = action.type === "drain_resource" ? resourceDrained : 0;
  execution.actualDamage += actualDamage;
  execution.actualHealing += actualHealing;
  execution.resourceDrained += resourceDrained;
  return {actualDamage,actualHealing,resourceDrained};
}

function getSkillAreaCenter(source, target, action) {
  return action.target === "self" || action.areaCenter === "self" ? source : target;
}

function getSkillActionTargets(source, target, action, skill = null) {
  const ownSquad = source.side === "enemy" ? enemySquad : playerSquad;
  const otherSquad = source.side === "enemy" ? playerSquad : enemySquad;
  const drainedResource = action.type === "drain_resource" ? getResourceField(action.drainResource ?? "MP") : null;
  const targetPool=action.target === "enemy" ? otherSquad : action.target === "summon" ? ownSquad.filter(unit=>unit.isSummon && unit.summoner===source) : ownSquad;
  const candidates = targetPool.filter(unit => isActionTargetEligible(source, unit, action, skill)
    && (!drainedResource || getUnitResourceCurrent(unit, action.drainResource) > 0)
    && (!action.type.startsWith("delete_") || unit.activeEffects?.some(effect=>matchesEffectDispel(effect,action))));
  if (isChainAction(action)) {
    const first = action.target === "self" ? source : target;
    if (!first?.alive || !candidates.includes(first)) return [];
    const selected = [first];
    const limit = Math.min(1 + Math.min(20, Math.floor(action.chainCount)), action.maxTargets > 0 ? action.maxTargets : Infinity);
    const resource = action.type === "heal" ? getResourceField(action.healResource ?? "HP") : null;
    while (selected.length < limit) {
      const previous = selected[selected.length - 1];
      const next = candidates.filter(unit => unit.alive && !selected.includes(unit)
        && distance(previous, unit) <= action.chainRange * ATTACK_RANGE_UNIT
        && (!resource || normalizeResourceReference(action.healResource) === "BP" || (getUnitResourceState(unit, action.healResource) && getUnitResourceCurrent(unit, action.healResource) < getUnitResourceMax(unit, action.healResource)))
        && (!drainedResource || getUnitResourceCurrent(unit, action.drainResource) > 0))
        .sort((a, b) => distance(previous, a) - distance(previous, b))[0];
      if (!next) break;
      selected.push(next);
    }
    return selected;
  }
  const center = getSkillAreaCenter(source, target, action);
  if (action.area > 0 && supportsActionArea(action.type)) {
    if (!center) return [];
    const hits = candidates.filter(unit => unit.alive && distance(unit, center) <= action.area * ATTACK_RANGE_UNIT)
      .sort((a, b) => distance(a, center) - distance(b, center));
    return action.maxTargets > 0 ? hits.slice(0, action.maxTargets) : hits;
  }
  const resolved = action.target === "self" ? source : target;
  return resolved?.alive && candidates.includes(resolved) ? [resolved] : [];
}

function applyActionDamage(source, target, action, skill = null, execution = null) {
  if (!target.alive) return 0;
  if (target.reviveInvulnerableTicks > 0) {
    const context={source,target,skill,periodic:action.periodic,damageType:action.damageType,amount:0,hpDamage:0,barrierDamage:0};
    publishBattleEvents([{...context,type:"hit"},{...context,type:"damaged"}]);
    addBattleEventLog(target,`${target.name}: 부활 무적으로 피해 무시`);
    return 0;
  }
  const immunity=consumeDamageImmunity(target,Boolean(action.periodic));
  if (immunity) {
    const context={source,target,skill,periodic:action.periodic,damageType:action.damageType,amount:0,hpDamage:0,barrierDamage:0};
    publishBattleEvents([{...context,type:"hit"},{...context,type:"damaged"}]);
    addBattleEventLog(target,`${target.name}: ${immunity.name} 효과로 피해 무시`);
    return 0;
  }
  const rawDamage = getActionCoefficientValue(action, source, target, execution) * getUnitTeamBattleRules(source).damagePercent / 100 * (Number(skill?.weaponDamagePercent ?? 100) / 100);
  let remainingRaw=Math.max(0,Number(rawDamage) || 0);
  const portions=[];
  for (const route of getDamageProxyRoutes(target,skill)) {
    if (!(remainingRaw>0)) break;
    const assigned=Math.min(remainingRaw,Math.max(0,rawDamage) * route.effect.proxyPercent / 100);
    remainingRaw-=assigned;
    portions.push({recipient:route.protector,raw:assigned,proxy:true,effect:route.effect});
  }
  portions.push({recipient:target,raw:remainingRaw,proxy:false});
  const reflections=portions.map(portion=>getDamageReflectionEffects(portion.recipient,skill,action));
  const results=portions.map(portion=>applyDamagePortion(source,portion.recipient,action,skill,portion.raw,!portion.proxy));
  const actualTotal=results.reduce((sum,result)=>sum+result.actual,0);
  source.stats.damage+=actualTotal;
  source.actualDamageTotal=(source.actualDamageTotal ?? 0)+actualTotal;
  const targetResult=results[results.length-1];
  const hitContext={source,target,skill,periodic:action.periodic,damageType:action.damageType,amount:actualTotal,
    hpDamage:results.reduce((sum,result)=>sum+result.hpDamage,0),barrierDamage:results.reduce((sum,result)=>sum+result.barrierDamage,0)};
  const events=[{...hitContext,type:"hit"},{...targetResult.context,type:"damaged"},...targetResult.channelEvents,...targetResult.deathEvents];
  portions.slice(0,-1).forEach((portion,index)=>{
    const result=results[index];
    events.push({type:"damage_redirect",source:target,target:portion.recipient,skill,amount:result.actual,damageType:action.damageType,reason:portion.effect.name},
      {...result.context,type:"damaged"},...result.channelEvents,...result.deathEvents);
  });
  publishBattleEvents(events);
  for(const [index,portion] of portions.entries()) {
    if(results[index].actual>0) triggerEffect(portion.recipient,"damage");
    if(portion.proxy) addBattleEventLog(target,`${target.name}의 피해 ${formatBattleEventValue(results[index].actual)}를 ${portion.recipient.name}이 대리 수신`);
  }
  addBattleEventLog(source, `${source.name}가 ${target.name}에게 ${skill?.name ?? "공격"} 행동을 하여 총 ${formatBattleEventValue(actualTotal)} 피해 발생`);
  portions.forEach((portion,index)=>applyDamageReflection(portion.recipient,source,action,skill,results[index].actual,reflections[index]));
  return actualTotal;
}

function getDamageReflectionEffects(unit,skill,action) {
  if (action.reflected) return [];
  const basic=skill?.slot === "basic" || skill?.id === DEFAULT_ATTACK_SKILL_ID;
  return (unit?.activeEffects ?? []).filter(effect=>effect.kind === "buff" && effect.mode === "damage_reflect"
    && (effect.reflectScope === "all" || (effect.reflectScope === "basic") === basic));
}

function applyDamageReflection(reflector,attacker,originalAction,originalSkill,actualDamage,effects) {
  if (!(actualDamage>0) || !attacker?.alive || !effects?.length) return 0;
  const percent=effects.reduce((sum,effect)=>sum+effect.reflectPercent*effect.stacks,0);
  const damageType=effects.some(effect=>effect.reflectDamageType === "same") ? originalAction.damageType : "fixed";
  const action={type:"deal_damage",target:"enemy",coefficients:[{type:"fixed",value:actualDamage*percent/100}],damageType,periodic:false,reflected:true};
  const reflectedSkill={id:`reflected_${originalSkill?.id ?? "damage"}`,name:`${effects.map(effect=>effect.name).join(" + ")} (반사)`,slot:"passive",triggered:true};
  const reflected=applyActionDamage(reflector,attacker,action,reflectedSkill);
  if(reflected>0) addBattleEventLog(reflector,`${reflector.name}: ${attacker.name}에게 ${formatBattleEventValue(reflected)} 피해 반사`);
  return reflected;
}

function getDamageProxyRoutes(target,skill) {
  const basic=skill?.slot === "basic" || skill?.id === DEFAULT_ATTACK_SKILL_ID;
  const effectRoutes=(target.activeEffects ?? []).filter(effect=>effect.kind === "buff" && effect.mode === "damage_proxy"
      && (effect.proxyScope === "all" || (effect.proxyScope === "basic") === basic))
    .map((effect,index)=>({effect,index,protector:[...playerSquad,...enemySquad].find(unit=>unit.effectCasterId === effect.casterId)}))
    .filter(route=>route.protector?.alive && route.protector !== target && route.protector.side === target.side);
  const summonRoutes=[...playerSquad,...enemySquad]
    .filter(unit=>unit.alive && unit.isSummon && unit.summoner === target && unit.protectOwnerPercent > 0
      && (unit.protectOwnerScope === "all" || (unit.protectOwnerScope === "basic") === basic))
    .map((protector,index)=>({protector,index:effectRoutes.length+index,effect:{name:protector.name,proxyPercent:protector.protectOwnerPercent,proxyPriority:protector.protectOwnerPriority}}));
  return [...effectRoutes,...summonRoutes].sort((a,b)=>a.effect.proxyPriority-b.effect.proxyPriority || a.index-b.index);
}

function applyDamagePortion(source,target,action,skill,rawDamage,skipImmunity=false) {
  rawDamage=Math.max(0,Number(rawDamage) || 0) * getUnitIncomingRulePercent(target,"receivedDamagePercent") / 100;
  const hpBefore=Math.max(0,target.hp),bpBefore=Math.max(0,Number(target.bp) || 0);
  if (target.reviveInvulnerableTicks > 0) return {actual:0,hpDamage:0,barrierDamage:0,deathEvents:[],channelEvents:[],
    context:{source,target,skill,periodic:action.periodic,damageType:action.damageType,amount:0,hpDamage:0,barrierDamage:0}};
  const immunity=!skipImmunity && rawDamage>0 ? consumeDamageImmunity(target,Boolean(action.periodic)) : null;
  if(!immunity) applyBarrierOrHpDamage(source,target,action,rawDamage);
  const deathEvents=syncAliveState(target,{source,skill,periodic:action.periodic,deferEvents:true});
  const hpDamage=Math.max(0,hpBefore-target.hp),barrierDamage=Math.max(0,bpBefore-(Number(target.bp) || 0));
  const actual=hpDamage+barrierDamage;
  target.stats.taken+=actual;
  const channelEvents=target.channelAction && actual>0 && normalizeSkillChannel(target.channelAction.skill.channel).interruptOnDamage
    ? finishBattleChannel(target,"피해",{deferEvents:true}) : [];
  if(immunity) addBattleEventLog(target,`${target.name}: ${immunity.name} 효과로 대리 피해 무시`);
  return {actual,hpDamage,barrierDamage,deathEvents,channelEvents,
    context:{source,target,skill,periodic:action.periodic,damageType:action.damageType,amount:actual,hpDamage,barrierDamage}};
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

function applyActionHeal(source, target, action, skill = null, execution = null) {
  if (target.hp <= 0) {
    return 0;
  }

  const amount = getActionCoefficientValue(action, source, target, execution) * getUnitTeamBattleRules(source).healingPercent / 100 * getUnitIncomingRulePercent(target,"receivedHealingPercent") / 100;
  const resourceResult = applyResourceGain(target, action.healResource, amount);
  if (resourceResult.applied) {
    source.stats.heal += resourceResult.gained;
    if (resourceResult.gained > 0) publishBattleEvents([{type:"heal",source,target,skill,periodic:action.periodic,amount:resourceResult.gained,resource:normalizeResourceReference(action.healResource,"HP")}]);
    triggerEffect(target, "heal");
    addBattleEventLog(source, `${source.name}가 ${target.name}에게 ${skill?.name ?? "회복"} 행동을 하여 ${formatBattleEventValue(resourceResult.gained)} ${getResourceLabel(action.healResource)} 회복 발생`);
    return resourceResult.gained;
  }

  const previousHp = target.hp;
  target.hp = Math.min(target.maxHp, target.hp + amount);
  const gained = target.hp - previousHp;
  source.stats.heal += gained;
  if (gained > 0) publishBattleEvents([{type:"heal",source,target,skill,periodic:action.periodic,amount:gained,resource:"HP"}]);
  triggerEffect(target, "heal");
  addBattleEventLog(source, `${source.name}가 ${target.name}에게 ${skill?.name ?? "회복"} 행동을 하여 ${formatBattleEventValue(gained)} HP 회복 발생`);
  return gained;
}

function applyActionResourceDrain(source,target,action,skill=null,execution=null) {
  if (!target.alive) return 0;
  const resource=normalizeResourceReference(action.drainResource,"MP");
  if (resource === "HP" && target.reviveInvulnerableTicks > 0) return 0;
  const field=getResourceField(resource);
  if (!field || !getUnitResourceState(target,resource)) return 0;
  const before=getUnitResourceCurrent(target,resource);
  const requested=Math.max(0,getActionCoefficientValue(action,source,target,execution));
  setUnitResourceCurrent(target,resource,before-requested);
  const drained=before-getUnitResourceCurrent(target,resource);
  const deathEvents=resource === "HP" ? syncAliveState(target,{source,skill,reason:"HP 자원 소진",deferEvents:true}) : [];
  if (drained > 0) publishBattleEvents([{type:"resource_drain",source,target,skill,amount:drained,resource},...deathEvents]);
  else if (deathEvents.length) publishBattleEvents(deathEvents);
  addBattleEventLog(source,`${source.name}가 ${target.name}의 ${resource}를 ${formatBattleEventValue(drained)} 감소`);
  return drained;
}

function applyResourceGain(target, resource, amount) {
  const gain = Math.max(0, Number(amount) || 0);
  const normalizedResource = normalizeResourceReference(resource, "HP");

  if (normalizedResource.startsWith(CUSTOM_RESOURCE_PREFIX)) {
    const state = getUnitResourceState(target, normalizedResource);
    if (!state) return { applied: true, gained: 0 };
    const previous = getUnitResourceCurrent(target, normalizedResource);
    setUnitResourceCurrent(target, normalizedResource, Math.min(getUnitResourceMax(target, normalizedResource), previous + gain));
    return { applied: true, gained: getUnitResourceCurrent(target, normalizedResource) - previous };
  }

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
  const moveType = action.moveType ?? "Dash";
  const forced = ["Knockback","Pull","Push"].includes(moveType);
  const movedUnit = forced ? target : source;
  if (!movedUnit?.alive || (!forced && (hasBattleState(source,"stun") || hasBattleState(source,"root")))) return 0;
  const origin=action._moveOrigin ?? source;
  const dx = target.x - origin.x, dy = target.y - origin.y;
  const length = Math.hypot(dx,dy);
  if (length === 0) return 0;
  let desiredX, desiredY;
  if (forced) {
    const direction = moveType === "Pull" ? -1 : 1;
    const amount = Math.max(1,Math.min(10,Number(action.distance) || 10)) * ATTACK_RANGE_UNIT;
    desiredX = target.x + dx / length * amount * direction;
    desiredY = target.y + dy / length * amount * direction;
  } else {
    const ratio = Math.max(1,Math.min(10,Number(action.distance) || 10)) / 10;
    desiredX = source.x + dx * ratio;
    desiredY = source.y + dy * ratio;
  }
  const moved = moveUnitWithCollision(movedUnit,desiredX,desiredY,{sweep:moveType !== "Teleport"});
  movedUnit.moveDistanceTotal = (movedUnit.moveDistanceTotal ?? 0) + moved / ATTACK_RANGE_UNIT;
  if (forced && moved > 0) publishBattleEvents([{type:"forced_move",source,target,moveType,amount:moved / ATTACK_RANGE_UNIT}]);
  return moved;
}

function applySummonCommand(source,target,action,skill=null) {
  if (!source?.alive || !target?.alive || !target.isSummon || target.summoner !== source) return false;
  if (action.summonCommand === "hold") {
    target.ai="stationary";target.speed=0;target.isMoving=false;target.pendingAction=null;target.castTimer=0;target.castDuration=0;clearBattleChannel(target);
  } else if (action.summonCommand === "release") {
    target.ai=target.summonBaseAi;target.speed=target.summonBaseSpeed;
  } else if (action.summonCommand === "recall") {
    const dx=target.x-source.x,dy=target.y-source.y,length=Math.hypot(dx,dy) || 1;
    moveUnitWithCollision(target,source.x+dx/length*COLLISION_DISTANCE,source.y+dy/length*COLLISION_DISTANCE,{sweep:false});
    target.isMoving=false;
  } else if (action.summonCommand === "dismiss") {
    target.hp=0;syncAliveState(target,{source,skill,reason:"소환 해제"});target.pendingAction=null;target.castTimer=0;
  } else return false;
  publishBattleEvents([{type:"summon_command",source,target,skill,reason:action.summonCommand}]);
  addBattleEventLog(source,`${source.name}: ${target.name} 소환수 명령 (${{hold:"정지",release:"행동 재개",recall:"복귀",dismiss:"해제"}[action.summonCommand]})`);
  return true;
}

function applyCreateField(source, target, action, skill = null) {
  createBattleField(source,target,action,skill);
}

// Per-caster runtime references stay outside serialized unit data.
let actionTargetCooldowns = new WeakMap();
function actionTargetCooldownKey(action, skill) {
  return skill ? `${skill.id}:${action._actionIndex ?? skill.actions.indexOf(action)}` : action;
}
function isActionTargetEligible(source, target, action, skill) {
  const threshold = action.targetHpBelow ?? 100;
  if (threshold < 100 && (!(target.maxHp > 0) || target.hp / target.maxHp * 100 > threshold)) return false;
  const until = actionTargetCooldowns.get(source)?.get(actionTargetCooldownKey(action, skill))?.get(target) ?? 0;
  return combatEventTick >= until;
}
function markActionTargetCooldown(source, target, action, skill) {
  if (!(action.targetCooldown > 0)) return;
  if (!actionTargetCooldowns.has(source)) actionTargetCooldowns.set(source, new Map());
  const actions = actionTargetCooldowns.get(source), key = actionTargetCooldownKey(action, skill);
  if (!actions.has(key)) actions.set(key, new WeakMap());
  actions.get(key).set(target, combatEventTick + Math.ceil(action.targetCooldown * BASE_ATTACK_COOLDOWN));
}
