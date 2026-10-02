const TIMED_EFFECT_ACTIONS = ["add_buff", "delete_buff", "add_state", "delete_state"];
const BUFF_STAT_LABELS = {atk:"공격력", magic:"마력", defense:"방어력", resistance:"저항력", speed:"이동속도", attackRange:"사거리", attackSpeed:"공격 간격(초)", castSpeed:"기본 시전시간(초)"};
const STATE_LABELS = {stun:"기절", root:"이동 불가", silence:"침묵", periodic:"주기 효과만 적용"};
const EFFECT_CATEGORY_LABELS = {general:"일반",physical:"물리",magic:"마법"};
const EFFECT_CONSUME_LABELS = {hit:"자신이 적중",damaged:"자신이 피격",heal:"자신이 회복",cast_complete:"자신의 시전 완료"};
let nextEffectCasterId = 1;

function createDefaultSkillEffect(type) {
  const state = type.includes("state");
  return {id:state ? "stun" : "attack_up", name:state ? "기절" : "공격력 증가", state:"stun",
    stat:"atk", sourceStat:"magic", mode:"flat", value:10, nextCastTimePercent:100, nextResourceCostPercent:100, nextCooldownPercent:100, reflectPercent:20, reflectScope:"all", reflectDamageType:"fixed", proxyPercent:20, proxyPriority:100, proxyScope:"all", maxStacks:1, stackMode:"refresh",uses:0,consumeOn:"hit",consumePeriodic:false,
    category:"general",polarity:state ? "harmful" : "beneficial",dispellable:true,dispelMode:"id",dispelCategory:"general",dispelPolarity:"any"};
}

function isEffectActionConfigured(action) {
  const effect = action.effect;
  if (!effect) return false;
  if (action.type.startsWith("delete_")) {
    const mode = effect.dispelMode ?? "id";
    return ["id","category","all"].includes(mode)
      && (mode !== "id" || (typeof effect.id === "string" && Boolean(effect.id.trim())))
      && (mode !== "category" || Object.hasOwn(EFFECT_CATEGORY_LABELS,effect.dispelCategory ?? "general"))
      && ["any","beneficial","harmful"].includes(effect.dispelPolarity ?? "any");
  }
  if (typeof effect.id !== "string" || !effect.id.trim()) return false;
  if (!Object.hasOwn(EFFECT_CATEGORY_LABELS,effect.category ?? "general") || !["beneficial","harmful"].includes(effect.polarity ?? (action.type === "add_state" ? "harmful" : "beneficial"))) return false;
  if (effect.immunity && (action.type !== "add_buff" || !["state","harmful","all"].includes(effect.immunity.scope)
    || !["all",...Object.keys(EFFECT_CATEGORY_LABELS)].includes(effect.immunity.category)
    || !["all",...Object.keys(STATE_LABELS)].includes(effect.immunity.state))) return false;
  if (effect.periodic && !isPeriodicEffectConfigured(effect.periodic)) return false;
  if (action.type === "add_buff" && effect.mode === "immunity") return Boolean(effect.immunity);
  if (action.type === "add_buff" && effect.mode === "damage_immunity") return true;
  if (action.type === "add_buff" && effect.mode === "damage_reflect") return Number(effect.reflectPercent)>0 && Number.isFinite(Number(effect.reflectPercent)) && ["all","basic","skill"].includes(effect.reflectScope ?? "all") && ["fixed","same"].includes(effect.reflectDamageType ?? "fixed");
  if (action.type === "add_buff" && effect.mode === "next_skill_modifier") return [effect.nextCastTimePercent,effect.nextResourceCostPercent,effect.nextCooldownPercent].every(value=>Number.isFinite(Number(value)) && Number(value)>=0);
  if (action.type === "add_buff" && effect.mode === "damage_proxy") return Number(effect.proxyPercent) > 0 && Number(effect.proxyPercent) <= 100
    && Number.isFinite(Number(effect.proxyPriority)) && ["all","basic","skill"].includes(effect.proxyScope ?? "all");
  if ((effect.state === "periodic" && action.type === "add_state") || (effect.mode === "periodic" && action.type === "add_buff")) return Boolean(effect.periodic);
  return action.type === "add_state" ? Object.hasOwn(STATE_LABELS, effect.state)
    : Object.hasOwn(BUFF_STAT_LABELS, effect.stat) && ["flat", "percent", "override", "convert"].includes(effect.mode)
      && Number.isFinite(Number(effect.value)) && (effect.mode !== "convert" || Object.hasOwn(BUFF_STAT_LABELS,effect.sourceStat));
}

function isPeriodicEffectConfigured(periodic) {
  return ["damage","heal"].includes(periodic.type) && Number.isFinite(Number(periodic.interval)) && Number(periodic.interval) > 0
    && Number.isFinite(Number(periodic.value)) && Number(periodic.value) >= 0
    && (periodic.type === "damage" ? ["physical","magic","fixed"].includes(periodic.damageType) : Boolean(getResourceField(periodic.resource)));
}

function normalizeSkillEffect(effect,type = "add_buff") {
  return {id:String(effect.id ?? "").trim(), name:String(effect.name || effect.id || "효과").trim(), state:effect.state,
    category:effect.category ?? "general",polarity:effect.polarity ?? (type.endsWith("state") ? "harmful" : "beneficial"),dispellable:effect.dispellable !== false,
    dispelMode:effect.dispelMode ?? "id",dispelCategory:effect.dispelCategory ?? "general",dispelPolarity:effect.dispelPolarity ?? "any",
    ...(effect.immunity ? {immunity:{scope:effect.immunity.scope,category:effect.immunity.category,state:effect.immunity.state}} : {}),
    stat:effect.stat, sourceStat:effect.sourceStat ?? effect.source_stat ?? "magic", mode:effect.mode, value:Number(effect.value) || 0,
    nextCastTimePercent:Number.isFinite(Number(effect.nextCastTimePercent ?? effect.next_cast_time_percent)) ? Math.max(0,Number(effect.nextCastTimePercent ?? effect.next_cast_time_percent)) : 100,
    nextResourceCostPercent:Number.isFinite(Number(effect.nextResourceCostPercent ?? effect.next_resource_cost_percent)) ? Math.max(0,Number(effect.nextResourceCostPercent ?? effect.next_resource_cost_percent)) : 100,
    nextCooldownPercent:Number.isFinite(Number(effect.nextCooldownPercent ?? effect.next_cooldown_percent)) ? Math.max(0,Number(effect.nextCooldownPercent ?? effect.next_cooldown_percent)) : 100,
    reflectPercent:Number.isFinite(Number(effect.reflectPercent ?? effect.reflect_percent)) ? Math.max(0,Number(effect.reflectPercent ?? effect.reflect_percent)) : 20,
    reflectScope:["all","basic","skill"].includes(effect.reflectScope ?? effect.reflect_scope) ? (effect.reflectScope ?? effect.reflect_scope) : "all",
    reflectDamageType:["fixed","same"].includes(effect.reflectDamageType ?? effect.reflect_damage_type) ? (effect.reflectDamageType ?? effect.reflect_damage_type) : "fixed",
    proxyPercent:Number.isFinite(Number(effect.proxyPercent)) ? Math.max(1,Math.min(100,Number(effect.proxyPercent))) : 20,
    proxyPriority:Number.isFinite(Number(effect.proxyPriority)) ? Math.max(0,Math.min(999,Math.floor(Number(effect.proxyPriority)))) : 100,
    proxyScope:["all","basic","skill"].includes(effect.proxyScope) ? effect.proxyScope : "all",
    uses:Math.max(0,Math.min(100,Math.floor(Number(effect.uses) || 0))),
    consumeOn:effect.mode === "damage_immunity" ? "damaged" : Object.hasOwn(EFFECT_CONSUME_LABELS,effect.consumeOn) ? effect.consumeOn : "hit",
    consumePeriodic:effect.consumePeriodic === true,
    maxStacks:Math.max(1, Math.min(20, Math.floor(Number(effect.maxStacks) || 1))),
    stackMode:effect.stackMode === "stack" ? "stack" : "refresh",
    ...(effect.periodic ? {periodic:{type:effect.periodic.type,interval:Math.max(1/60,Number(effect.periodic.interval)),
      value:Number(effect.periodic.value),damageType:effect.periodic.damageType ?? "magic",resource:normalizeResourceReference(effect.periodic.resource,"HP")}} : {})};
}

function renderTimedEffectFields(action) {
  const effect = action.effect ?? createDefaultSkillEffect(action.type);
  const periodic = effect.periodic ?? {type:"", interval:1, value:10, damageType:"magic", resource:"HP"};
  const options = (labels, selected) => Object.entries(labels).map(([key,label]) => `<option value="${key}" ${key === selected ? "selected" : ""}>${label}</option>`).join("");
  return `<div data-action-field="timedEffect">
    <label>효과 ID<input class="skill-effect-id" value="${escapeHtml(effect.id)}"></label>
    <small>같은 시전자의 같은 ID는 갱신·중첩됩니다. 서로 다른 효과에는 다른 ID를 사용하세요. ID 해제는 해당 ID만, 분류/전체 해제는 ID와 무관하게 같은 종류의 해제 가능한 효과를 제거합니다.</small>
    <div data-action-field="effectDelete">
      <label>해제 방식<select class="skill-effect-dispel-mode">${options({id:"효과 ID",category:"효과 분류",all:"전체"},effect.dispelMode ?? "id")}</select></label>
      <label>해제할 분류<select class="skill-effect-dispel-category">${options(EFFECT_CATEGORY_LABELS,effect.dispelCategory ?? "general")}</select></label>
      <label>해제할 성격<select class="skill-effect-dispel-polarity">${options({any:"이로운 효과와 해로운 효과",beneficial:"이로운 효과만",harmful:"해로운 효과만"},effect.dispelPolarity ?? "any")}</select></label>
      <small>상태 제거는 상태만, 버프 제거는 버프만 해제합니다. 해제 불가 효과는 모든 방식에서 유지됩니다.</small>
    </div>
    <div data-action-field="effectAdd">
      <label>효과 분류<select class="skill-effect-category">${options(EFFECT_CATEGORY_LABELS,effect.category ?? "general")}</select></label>
      <label>효과 성격<select class="skill-effect-polarity">${options({beneficial:"이로운 효과",harmful:"해로운 효과"},effect.polarity ?? "beneficial")}</select></label>
      <label><input class="skill-effect-dispellable" type="checkbox" ${effect.dispellable !== false ? "checked" : ""}>해제 가능</label>
      <label>효과 이름<input class="skill-effect-name" value="${escapeHtml(effect.name)}"></label>
      <label>지속시간 (초, 0: 전투 종료까지)<input class="skill-effect-duration" type="number" min="0" step="0.1" value="${action.duration ?? 5}"></label>
      <label>재적용 방식<select class="skill-effect-stack-mode"><option value="refresh" ${effect.stackMode === "refresh" ? "selected" : ""}>시간 갱신</option><option value="stack" ${effect.stackMode === "stack" ? "selected" : ""}>중첩 증가 + 시간 갱신</option></select></label>
      <label>최대 중첩<input class="skill-effect-max-stacks" type="number" min="1" max="20" value="${effect.maxStacks}"></label>
      <label>사용 횟수 (0: 횟수 제한 없음)<input class="skill-effect-uses" type="number" min="0" max="100" step="1" value="${effect.uses ?? 0}"></label>
      <label>횟수 소모 조건<select class="skill-effect-consume-on">${options(EFFECT_CONSUME_LABELS,effect.consumeOn ?? "hit")}</select></label>
      <label><input class="skill-effect-consume-periodic" type="checkbox" ${effect.consumePeriodic ? "checked" : ""}>주기 피해·회복도 횟수 소모</label>
      <small>사용 횟수가 1 이상일 때만 행동마다 1회 소모합니다. 피해 무시는 피격 조건을 사용하며 실제 피해가 발생하기 전에 소모됩니다.</small>
      <div data-action-field="effectBuff">
        <label>능력치<select class="skill-effect-stat">${options(BUFF_STAT_LABELS,effect.stat)}</select></label>
        <label>계산<select class="skill-effect-mode" onchange="updateSkillEffectModeVisibility(this)"><option value="flat" ${effect.mode === "flat" ? "selected" : ""}>고정값 가산</option><option value="percent" ${effect.mode === "percent" ? "selected" : ""}>기본 능력치의 % 가산</option><option value="override" ${effect.mode === "override" ? "selected" : ""}>최종값 고정 (0: 삭제)</option><option value="convert" ${effect.mode === "convert" ? "selected" : ""}>다른 능력치의 % 전환</option><option value="next_skill_modifier" ${effect.mode === "next_skill_modifier" ? "selected" : ""}>다음 1회 스킬 보정</option><option value="damage_reflect" ${effect.mode === "damage_reflect" ? "selected" : ""}>받은 피해 반사</option><option value="periodic" ${effect.mode === "periodic" ? "selected" : ""}>주기 효과만 적용</option><option value="immunity" ${effect.mode === "immunity" ? "selected" : ""}>능력치 변경 없이 면역 적용</option><option value="damage_immunity" ${effect.mode === "damage_immunity" ? "selected" : ""}>피해 무시</option><option value="damage_proxy" ${effect.mode === "damage_proxy" ? "selected" : ""}>피해 대리 수신</option></select></label>
        <div class="skill-effect-reflect-settings ${effect.mode === "damage_reflect" ? "" : "hidden"}">
          <label>반사 비율 (%)<input class="skill-effect-reflect-percent" type="number" min="0.1" step="0.1" value="${effect.reflectPercent ?? 20}"></label>
          <label>반사 대상 피해<select class="skill-effect-reflect-scope">${options({all:"모든 피해",basic:"기본 공격",skill:"스킬 피해"},effect.reflectScope ?? "all")}</select></label>
          <label>반사 피해 유형<select class="skill-effect-reflect-damage-type">${options({fixed:"고정 피해",same:"받은 피해와 동일"},effect.reflectDamageType ?? "fixed")}</select></label>
          <small>보호막을 포함해 실제로 감소한 수치만 반사합니다. 반사 피해는 다시 반사되지 않습니다.</small>
        </div>
        <div class="skill-effect-next-skill-settings ${effect.mode === "next_skill_modifier" ? "" : "hidden"}">
          <label>다음 시전시간 (%)<input class="skill-effect-next-cast-time-percent" type="number" min="0" step="1" value="${effect.nextCastTimePercent ?? 100}"></label>
          <label>다음 자원 비용 (%)<input class="skill-effect-next-resource-cost-percent" type="number" min="0" step="1" value="${effect.nextResourceCostPercent ?? 100}"></label>
          <label>다음 쿨타임 (%)<input class="skill-effect-next-cooldown-percent" type="number" min="0" step="1" value="${effect.nextCooldownPercent ?? 100}"></label>
          <small>다음 액티브 또는 채널링 스킬이 실제로 시작될 때 1회 소모합니다. 기본 공격·회복과 패시브에는 사용하지 않습니다.</small>
        </div>
        <div class="skill-effect-convert-settings ${effect.mode === "convert" ? "" : "hidden"}">
          <label>전환 원본 능력치<select class="skill-effect-source-stat">${options(BUFF_STAT_LABELS,effect.sourceStat ?? "magic")}</select></label>
          <small>효과를 부여하는 순간의 원본 능력치를 기준으로 계산합니다. 다른 버프나 전환으로 바뀐 값은 다시 참조하지 않아 순환 계산이 발생하지 않습니다.</small>
        </div>
        <div class="skill-effect-proxy-settings ${effect.mode === "damage_proxy" ? "" : "hidden"}">
          <label>대리 수신 비율 (%)<input class="skill-effect-proxy-percent" type="number" min="1" max="100" step="1" value="${effect.proxyPercent ?? 20}"></label>
          <label>우선순위<input class="skill-effect-proxy-priority" type="number" min="0" max="999" step="1" value="${effect.proxyPriority ?? 100}"></label>
          <label>대상 피해<select class="skill-effect-proxy-scope">${options({all:"모든 피해",basic:"기본 공격",skill:"스킬 피해"},effect.proxyScope ?? "all")}</select></label>
          <small>이 버프를 부여한 살아 있는 아군이 피해를 대신 받습니다. 우선순위 숫자가 낮을수록 먼저 분배하며 대리 피해는 다시 전달하지 않습니다.</small>
        </div>
        <label>면역 범위<select class="skill-effect-immunity-scope">${options({"":"면역 없음",state:"모든 상태",harmful:"해로운 효과",all:"모든 상태·버프"},effect.immunity?.scope ?? "")}</select></label>
        <label>면역 분류<select class="skill-effect-immunity-category">${options({all:"모든 분류",...EFFECT_CATEGORY_LABELS},effect.immunity?.category ?? "all")}</select></label>
        <label>면역 상태<select class="skill-effect-immunity-state">${options({all:"상태 제한 없음",...STATE_LABELS},effect.immunity?.state ?? "all")}</select></label>
        <small>면역은 새 효과 부여만 막습니다. 기존 효과와 직접 피해는 유지됩니다. 분류·상태 제한은 모두 만족해야 하며, 특정 상태를 고르면 버프는 차단하지 않습니다.</small>
        <label>중첩당 수치<input class="skill-effect-value" type="number" step="0.1" value="${effect.value}"></label>
        <small>음수는 감소입니다. 공격 간격·기본 시전시간은 감소할수록 빨라집니다. 스킬에 직접 지정한 시전시간은 바꾸지 않습니다.</small>
      </div>
      <label data-action-field="effectState">상태<select class="skill-effect-state">${options(STATE_LABELS,effect.state)}</select></label>
      <div>
        <label>주기 효과<select class="skill-effect-periodic-type">${options({"":"없음",damage:"주기 피해",heal:"주기 회복"},periodic.type)}</select></label>
        <label>적용 간격 (초)<input class="skill-effect-periodic-interval" type="number" min="${1/60}" step="any" value="${periodic.interval}"></label>
        <label>중첩당 회당 수치<input class="skill-effect-periodic-value" type="number" min="0" step="0.1" value="${periodic.value}"></label>
        <label>피해 타입<select class="skill-effect-periodic-damage">${options({physical:"물리",magic:"마법",fixed:"고정"},periodic.damageType)}</select></label>
        <label>회복 자원<select class="skill-effect-periodic-resource">${renderResourceOptions(periodic.resource)}</select></label>
        <small>첫 적용은 한 간격 뒤입니다. 갱신해도 다음 적용까지의 시간은 유지하며, 중첩 수만큼 회당 수치가 증가합니다. 능력치·행동 제한 없이 쓰려면 위에서 ‘주기 효과만 적용’을 선택하세요.</small>
      </div>
    </div>
  </div>`;
}

function readSkillEffectFromRow(row) {
  const value = name => row.querySelector(`.skill-effect-${name}`)?.value;
  return {id:value("id"),name:value("name"),stat:value("stat"),sourceStat:value("source-stat"),state:value("state"),mode:value("mode"),
    category:value("category"),polarity:value("polarity"),dispellable:row.querySelector('.skill-effect-dispellable')?.checked ?? true,
    dispelMode:value("dispel-mode"),dispelCategory:value("dispel-category"),dispelPolarity:value("dispel-polarity"),
    ...(value("immunity-scope") && (row.querySelector('.skill-action-type')?.value === "add_buff" || row.querySelector('.skill-action-field-effect')?.value === "add_buff") ? {immunity:{scope:value("immunity-scope"),category:value("immunity-category"),state:value("immunity-state")}} : {}),
    value:Number(value("value")),nextCastTimePercent:Number(value("next-cast-time-percent")),nextResourceCostPercent:Number(value("next-resource-cost-percent")),nextCooldownPercent:Number(value("next-cooldown-percent")),reflectPercent:Number(value("reflect-percent")),reflectScope:value("reflect-scope"),reflectDamageType:value("reflect-damage-type"),proxyPercent:Number(value("proxy-percent")),proxyPriority:Number(value("proxy-priority")),proxyScope:value("proxy-scope"),maxStacks:Number(value("max-stacks")),stackMode:value("stack-mode"),
    uses:Number(value("uses")),consumeOn:value("consume-on"),consumePeriodic:row.querySelector('.skill-effect-consume-periodic')?.checked ?? false,
    ...(value("periodic-type") ? {periodic:{type:value("periodic-type"),interval:Number(value("periodic-interval")),value:Number(value("periodic-value")),damageType:value("periodic-damage"),resource:value("periodic-resource")}} : {})};
}

function updateSkillEffectModeVisibility(select) {
  select.closest('[data-action-field="effectBuff"]')?.querySelector('.skill-effect-proxy-settings')?.classList.toggle('hidden',select.value !== 'damage_proxy');
  select.closest('[data-action-field="effectBuff"]')?.querySelector('.skill-effect-convert-settings')?.classList.toggle('hidden',select.value !== 'convert');
  select.closest('[data-action-field="effectBuff"]')?.querySelector('.skill-effect-next-skill-settings')?.classList.toggle('hidden',select.value !== 'next_skill_modifier');
  select.closest('[data-action-field="effectBuff"]')?.querySelector('.skill-effect-reflect-settings')?.classList.toggle('hidden',select.value !== 'damage_reflect');
}

function replaceMissingEffectAction(button) {
  const row = button.closest(".skill-action-row");
  const rows = [...skillActionsEl.querySelectorAll(".skill-action-row")];
  const actions = readSkillActionsFromForm();
  actions[rows.indexOf(row)] = createDefaultAction(row.querySelector(".skill-action-type").value);
  renderSkillActionRows(actions);
}

function changeSkillActionType(select) {
  if (TIMED_EFFECT_ACTIONS.includes(select.value)) {
    const row = select.closest(".skill-action-row");
    const actions = readSkillActionsFromForm();
    const index = [...skillActionsEl.querySelectorAll(".skill-action-row")].indexOf(row);
    actions[index] = {...actions[index], effect:createDefaultSkillEffect(select.value), duration:5};
    renderSkillActionRows(actions);
  } else updateSkillActionFieldVisibility(select);
}

function changeSkillFieldEffect(select) {
  const row=select.closest(".skill-action-row");
  if (!row) return;
  const actions=readSkillActionsFromForm();
  const index=[...skillActionsEl.querySelectorAll(".skill-action-row")].indexOf(row);
  if (["add_buff","add_state"].includes(select.value)) {
    actions[index]={...actions[index],fieldEffect:select.value,fieldEffectDuration:5,effect:createDefaultSkillEffect(select.value)};
    renderSkillActionRows(actions);
  } else updateSkillActionFieldVisibility(row);
}

function hasBattleState(unit, state) {
  return (unit.activeEffects ?? []).some(effect => effect.kind === "state" && effect.state === state);
}

function recalculateBattleBuffs(unit) {
  unit.effectBaseStats ??= {};
  const buffs = (unit.activeEffects ?? []).flatMap(effect => {
    if(effect.kind === "buff" && ["flat","percent","override","convert"].includes(effect.mode)) return [effect];
    if(effect.kind === "transform") return Object.entries(effect.modifiers ?? {}).filter(([,value])=>Number(value)!==0)
      .map(([stat,value])=>({stat,value:Number(value),mode:effect.mode,stacks:1}));
    return [];
  });
  for (const buff of buffs) {
    if (!Object.hasOwn(unit.effectBaseStats,buff.stat)) {
      const fallback = buff.stat === "speed" ? (typeof ROLE_STATS !== "undefined" ? ROLE_STATS[unit.role]?.speedMultiplier : null) ?? 1
        : ["attackSpeed", "attackRange"].includes(buff.stat) ? 1 : 0;
      unit.effectBaseStats[buff.stat] = {original:unit[buff.stat], value:Number(unit[buff.stat] ?? fallback)};
    }
  }
  for (const [stat, base] of Object.entries(unit.effectBaseStats)) {
    const current = buffs.filter(effect => effect.stat === stat);
    if (!current.length) {
      if (base.original === undefined) delete unit[stat];
      else unit[stat] = base.original;
      delete unit.effectBaseStats[stat];
      continue;
    }
    const override=[...current].reverse().find(effect=>effect.mode === "override");
    const delta = current.reduce((sum,effect) => sum + (effect.mode === "flat" ? effect.stacks * effect.value
      : effect.mode === "percent" ? effect.stacks * effect.value * base.value / 100
      : effect.mode === "convert" ? effect.stacks * effect.value * effect.conversionBase / 100 : 0),0);
    const value=override ? override.value : base.value + delta;
    unit[stat] = Math.max(stat === "attackSpeed" ? 0.1 : stat === "attackRange" ? 1 : 0,value);
  }
}

function clearBattleEffects(unit) {
  clearBattleChannel(unit);
  unit.activeEffects = [];
  recalculateBattleBuffs(unit);
}

function interruptBattleCast(unit, reason = "상태 효과") {
  if (unit.channelAction) finishBattleChannel(unit,reason);
  const pending = unit.pendingAction;
  if (!pending) return;
  if (pending.type === "skill") {
    unit.skillCooldowns ??= {};
    unit.skillCooldowns[pending.skill.id] = getModifiedSkillCooldownTicks(pending.skill,unit,pending.skillModifier);
  } else unit.attackCooldown = getAttackCooldown(unit);
  unit.pendingAction = null;unit.castTimer=0;unit.castDuration=0;
  publishBattleEvents([{type:"cast_interrupt",source:unit,target:pending.target,skill:pending.skill,reason}]);
}

function matchesEffectDispel(instance, action) {
  const kind = action.type === "delete_state" ? "state" : "buff";
  const config = action.effect;
  if (instance.kind !== kind || instance.dispellable === false) return false;
  const polarity = instance.polarity ?? (instance.kind === "state" ? "harmful" : "beneficial");
  if (config.dispelPolarity && config.dispelPolarity !== "any" && config.dispelPolarity !== polarity) return false;
  const mode = config.dispelMode ?? "id";
  return mode === "all" || (mode === "category" ? (instance.category ?? "general") === (config.dispelCategory ?? "general") : instance.id === config.id);
}

function blocksEffectApplication(target, source, config, kind) {
  return (target.activeEffects ?? []).some(instance => {
    const immunity = instance.immunity;
    if (!immunity || instance.kind !== "buff") return false;
    if (instance.id === config.id && instance.kind === kind && instance.casterId === source.effectCasterId) return false;
    if (immunity.scope === "state" && kind !== "state") return false;
    if (immunity.scope === "harmful" && config.polarity !== "harmful") return false;
    if (immunity.category !== "all" && immunity.category !== config.category) return false;
    if (immunity.state !== "all" && (kind !== "state" || immunity.state !== config.state)) return false;
    return true;
  });
}

function applyTimedEffectAction(source,target,action,skill) {
  const kind = action.type.endsWith("state") ? "state" : "buff";
  target.activeEffects ??= [];
  const config = normalizeSkillEffect(action.effect,action.type);
  if (action.type.startsWith("delete_")) {
    const previousLength = target.activeEffects.length;
    target.activeEffects = target.activeEffects.filter(effect => !matchesEffectDispel(effect,action));
    recalculateBattleBuffs(target);
    if (target.activeEffects.length !== previousLength) addBattleEventLog(source,`${source.name} → ${target.name}: ${previousLength-target.activeEffects.length}개 효과 해제 (${config.dispelMode === "id" ? config.id : config.dispelMode === "category" ? EFFECT_CATEGORY_LABELS[config.dispelCategory] : "전체"})`);
    return;
  }
  if (kind === "state" && config.polarity === "harmful") {
    const transferTarget=[...playerSquad,...enemySquad]
      .filter(unit=>unit.alive && unit.isSummon && unit.summoner === target
        && (unit.transferStateScope === "all" || unit.transferStateScope === config.category))
      .sort((a,b)=>a.transferStatePriority-b.transferStatePriority)[0];
    if (transferTarget) {
      addBattleEventLog(target,`${target.name}: ${config.name} 상태이상을 ${transferTarget.name}에게 이전`);
      target=transferTarget;
    }
  }
  target.activeEffects ??= [];
  source.effectCasterId ??= nextEffectCasterId++;
  if (blocksEffectApplication(target,source,config,kind)) {
    addBattleEventLog(source,`${source.name} → ${target.name}: ${config.name} 부여 차단 (면역)`);
    return;
  }
  const existing = target.activeEffects.find(effect => effect.kind === kind && effect.id === config.id && effect.casterId === source.effectCasterId);
  const stacks = config.stackMode === "stack" ? Math.min(config.maxStacks,(existing?.stacks ?? 0)+1) : 1;
  const sourceBase=(target.effectBaseStats?.[config.sourceStat]?.value ?? Number(target[config.sourceStat])) || 0;
  const instance = {...config,periodic:config.periodic,immunity:config.immunity,kind,stacks,casterId:source.effectCasterId,casterName:source.name,
    ...(config.mode === "convert" ? {conversionBase:sourceBase} : {}),
    skillId:skill?.id,triggered:Boolean(skill?.triggered),remainingTicks:action.duration > 0 ? Math.max(1,Math.ceil(action.duration * BASE_ATTACK_COOLDOWN)) : null,
    usesRemaining:config.mode === "next_skill_modifier" ? 1 : config.uses > 0 ? config.uses : null,
    nextPeriodicTick:config.periodic ? (existing?.periodic?.interval === config.periodic.interval ? existing.nextPeriodicTick : null) ?? Math.max(1,Math.ceil(config.periodic.interval * BASE_ATTACK_COOLDOWN)) : null};
  if (existing) Object.assign(existing,instance);
  else target.activeEffects.push(instance);
  recalculateBattleBuffs(target);
  if (kind === "state" && (config.state === "stun" || (config.state === "silence" && (target.pendingAction?.type === "skill" || target.channelAction?.type === "skill")))) interruptBattleCast(target,config.name);
  addBattleEventLog(source,`${source.name} → ${target.name}: ${config.name} ${stacks}중첩 (${action.duration || "무제한"}초)`);
}

function applyPeriodicEffect(target,effect) {
  const source = [...playerSquad,...enemySquad].find(unit => unit.effectCasterId === effect.casterId);
  if (!source || !target.alive) return;
  const periodic = effect.periodic;
  const action = {coefficients:[{type:"fixed",value:periodic.value * effect.stacks}],damageType:periodic.damageType,healResource:periodic.resource,periodic:true};
  const skill = {id:effect.skillId,name:`${effect.name} (주기)`,triggered:effect.triggered};
  if (periodic.type === "damage") applyActionDamage(source,target,action,skill);
  else applyActionHeal(source,target,action,skill);
}

function applyTransformation(source,target,action,skill) {
  if(!target?.alive) return;
  const transform=normalizeTransformation(action.transform);
  const removed=(target.activeEffects ?? []).filter(effect=>effect.kind === "transform");
  target.activeEffects=(target.activeEffects ?? []).filter(effect=>effect.kind !== "transform");
  recalculateBattleBuffs(target);
  const instance={kind:"transform",id:transform.id,name:transform.name,mode:transform.mode,modifiers:transform.modifiers,
    skillIds:transform.skillIds,attackSkillId:transform.attackSkillId,stacks:1,
    remainingTicks:action.duration>0 ? Math.max(1,Math.ceil(action.duration*BASE_ATTACK_COOLDOWN)) : null,usesRemaining:null,skillId:skill?.id};
  target.activeEffects.push(instance);
  recalculateBattleBuffs(target);
  publishBattleEvents([...removed.map(effect=>({type:"transform_end",source:target,target,skill,reason:`${effect.name} 교체`})),{type:"transform_start",source,target,skill,reason:transform.name}]);
  addBattleEventLog(target,`${target.name}: ${transform.name} 변신 (${action.duration || "무제한"}초)`);
}

function updateBattleEffects() {
  [...playerSquad,...enemySquad].forEach(unit => {
    if (!unit.activeEffects?.length) return;
    if (!unit.alive) {clearBattleEffects(unit);return;}
    const previousLength = unit.activeEffects.length;
    unit.activeEffects = unit.activeEffects.filter(effect => {
      if (!unit.alive) return false;
      if (effect.periodic && --effect.nextPeriodicTick <= 0) {
        applyPeriodicEffect(unit,effect);
        effect.nextPeriodicTick = Math.max(1,Math.ceil(effect.periodic.interval * BASE_ATTACK_COOLDOWN));
      }
      if (!unit.alive) return false;
      if (effect.remainingTicks === null || --effect.remainingTicks > 0) return true;
      addBattleEventLog(unit,`${unit.name}: ${effect.name} 만료`);
      if(effect.kind === "transform") publishBattleEvents([{type:"transform_end",source:unit,target:unit,skill:{id:effect.skillId,name:effect.name},reason:"만료"}]);
      return false;
    });
    if (!unit.alive) clearBattleEffects(unit);
    else if (unit.activeEffects.length !== previousLength) recalculateBattleBuffs(unit);
  });
}

function getBattleEffectLabel(unit) {
  return (unit.activeEffects ?? []).map(effect => `${effect.name}×${effect.stacks}${effect.usesRemaining === null ? "" : ` ${effect.usesRemaining}회`} ${effect.remainingTicks === null ? "∞" : (effect.remainingTicks/BASE_ATTACK_COOLDOWN).toFixed(1)+"초"}`).join(" · ");
}

function consumeBattleEffectUse(unit,effect,reason) {
  if (effect.usesRemaining === null || effect.usesRemaining == null) return false;
  effect.usesRemaining--;
  addBattleEventLog(unit,`${unit.name}: ${effect.name} 횟수 소모 (${Math.max(0,effect.usesRemaining)}회 남음, ${reason})`);
  if (effect.usesRemaining <= 0) {
    unit.activeEffects = (unit.activeEffects ?? []).filter(candidate => candidate !== effect);
    recalculateBattleBuffs(unit);
  }
  return true;
}

function getNextSkillModifier(unit) {
  const effects=(unit?.activeEffects ?? []).filter(effect=>effect.kind === "buff" && effect.mode === "next_skill_modifier" && effect.usesRemaining > 0);
  return {effects,
    castTimePercent:effects.reduce((value,effect)=>value*effect.nextCastTimePercent/100,100),
    resourceCostPercent:effects.reduce((value,effect)=>value*effect.nextResourceCostPercent/100,100),
    cooldownPercent:effects.reduce((value,effect)=>value*effect.nextCooldownPercent/100,100)};
}

function consumeNextSkillModifier(unit,modifier) {
  for (const effect of modifier?.effects ?? []) {
    if ((unit.activeEffects ?? []).includes(effect)) consumeBattleEffectUse(unit,effect,"다음 스킬 시작");
  }
}

function consumeDamageImmunity(unit,periodic=false) {
  const effect=(unit.activeEffects ?? []).find(candidate => candidate.kind === "buff" && candidate.mode === "damage_immunity"
    && (candidate.usesRemaining == null || candidate.usesRemaining > 0) && (!periodic || candidate.consumePeriodic));
  if (!effect) return null;
  consumeBattleEffectUse(unit,effect,"피해 무시");
  return effect;
}

function consumeEffectsForBattleEvent(event,context) {
  const owner=event.type === "damaged" ? context.target : context.source;
  if (!owner?.alive || !Object.hasOwn(EFFECT_CONSUME_LABELS,event.type)) return;
  const effects=[...(owner.activeEffects ?? [])];
  for (const effect of effects) {
    if (["damage_immunity","next_skill_modifier"].includes(effect.mode) || effect.usesRemaining == null || effect.consumeOn !== event.type) continue;
    if (event.periodic && !effect.consumePeriodic) continue;
    if (["hit","damaged","heal"].includes(event.type) && event.amount <= 0) continue;
    consumeBattleEffectUse(owner,effect,EFFECT_CONSUME_LABELS[event.type]);
  }
}

subscribeBattleEvent("*",consumeEffectsForBattleEvent);
