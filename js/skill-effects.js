const TIMED_EFFECT_ACTIONS = ["add_buff", "delete_buff", "add_state", "delete_state"];
const BUFF_STAT_LABELS = {shieldDefense:"방패 방어력",str:"힘",int:"지능",atk:"공격력", magic:"마력", adaptiveOffense:"적응형 공격 능력치", maxMp:"최대 MP", maxHp:"최대 HP", defense:"방어력", resistance:"저항력", speed:"이동속도", attackRange:"사거리", attackSpeed:"공격 간격(초)", castSpeed:"기본 시전시간(초)"};
const STATE_LABELS = {stun:"기절", root:"이동 불가", silence:"침묵", disarm:"기본 공격 금지", flee:"도주", polymorph:"양 변이 (공격·스킬 금지·도주)", sleep:"수면", charm:"현혹 (시전자에게 접근)", taunt:"도발 (시전자 공격)", periodic:"주기 효과만 적용"};
const EFFECT_CATEGORY_LABELS = {general:"일반",physical:"물리",magic:"마법"};
const EFFECT_CONSUME_LABELS = {hit:"자신이 적중",damaged:"자신이 피격",heal:"자신이 회복",cast_complete:"자신의 시전 완료"};
let nextEffectCasterId = 1;

function createDefaultSkillEffect(type) {
  const state = type.includes("state");
  return {id:state ? "stun" : "attack_up", name:state ? "기절" : "공격력 증가", state:"stun",
    stat:"atk", sourceStat:"magic", mode:"flat", value:10, nextCastTimePercent:100, nextResourceCostPercent:100, nextCooldownPercent:100, reflectPercent:20, reflectScope:"all", reflectDamageType:"fixed", proxyPercent:20, proxyPriority:100, proxyScope:"all", counterOnMelee:false, maxStacks:1, stackMode:"refresh",uses:0,consumeOn:"hit",consumePeriodic:false,
    category:"general",polarity:state ? "harmful" : "beneficial",tags:[],dispellable:true,dispelMode:"id",dispelTags:[],dispelCategory:"general",dispelPolarity:"any",
    movementStCostPercent:100,movementTriggerDistance:0,movementTriggerState:"stun",movementTriggerDuration:0};
}

function isEffectActionConfigured(action) {
  const effect = action.effect;
  if (!effect) return false;
  if (action.type.startsWith("delete_")) {
    const mode = effect.dispelMode ?? "id";
    return ["id","category","tags","all"].includes(mode)
      && (mode !== "id" || (typeof effect.id === "string" && Boolean(effect.id.trim())))
      && (mode !== "category" || Object.hasOwn(EFFECT_CATEGORY_LABELS,effect.dispelCategory ?? "general"))
      && (mode !== "tags" || (Array.isArray(effect.dispelTags) && effect.dispelTags.some(tag=>String(tag).trim())))
      && ["any","beneficial","harmful"].includes(effect.dispelPolarity ?? "any");
  }
  if (typeof effect.id !== "string" || !effect.id.trim()) return false;
  if (effect.stackBonuses != null && (!Array.isArray(effect.stackBonuses) || effect.stackBonuses.length>20
    || (action.type !== "add_buff" && effect.stackBonuses.length>0)
    || (effect.stackBonuses.length>0 && !["flat","percent","override","convert","attack_rate_percent","cast_time_percent","attribute"].includes(effect.mode))
    || effect.stackBonuses.some(bonus=>!Object.hasOwn(BUFF_STAT_LABELS,bonus?.stat) || bonus.stat === "adaptiveOffense"
      || !["flat","percent","attack_rate_percent","cast_time_percent","attribute"].includes(bonus.mode)
      || !Number.isFinite(Number(bonus.value)) || !Number.isInteger(Number(bonus.minStacks ?? 1)) || Number(bonus.minStacks ?? 1)<1 || Number(bonus.minStacks ?? 1)>100
      || (bonus.mode === "attack_rate_percent" && (bonus.stat !== "attackSpeed" || Number(bonus.value)<-100))
      || (bonus.mode === "cast_time_percent" && (bonus.stat !== "castSpeed" || Number(bonus.value)<-100))))) return false;
  if (!Object.hasOwn(EFFECT_CATEGORY_LABELS,effect.category ?? "general") || !["beneficial","harmful"].includes(effect.polarity ?? (action.type === "add_state" ? "harmful" : "beneficial"))) return false;
  if (effect.immunity && (action.type !== "add_buff" || !["state","harmful","all"].includes(effect.immunity.scope)
    || !["all",...Object.keys(EFFECT_CATEGORY_LABELS)].includes(effect.immunity.category)
    || !["all",...Object.keys(STATE_LABELS)].includes(effect.immunity.state))) return false;
  if (effect.periodic && !isPeriodicEffectConfigured(effect.periodic)) return false;
  if (action.type === "add_buff" && effect.mode === "attribute") return ["str","int"].includes(effect.stat) && Number.isFinite(Number(effect.value));
  if (action.type === "add_buff" && effect.mode === "immunity") return Boolean(effect.immunity);
  if (action.type === "add_buff" && effect.mode === "damage_pool") return Number.isFinite(Number(effect.value)) && Number(effect.value)>0 && Number(action.duration)>0 && Number(effect.maxStacks)>=2;
  if (action.type === "add_buff" && ["heal_absorb","basic_echo"].includes(effect.mode)) return Number.isFinite(Number(effect.value)) && Number(effect.value)>0;
  if (action.type === "add_buff" && ["damage_immunity","priority_attack_damage","received_healing_percent"].includes(effect.mode)) return true;
  if (action.type === "add_buff" && effect.mode === "cast_time_flat") return Number.isFinite(Number(effect.value));
  if (action.type === "add_buff" && effect.mode === "cast_time_percent") return effect.stat === "castSpeed" && Number.isFinite(Number(effect.value)) && Number(effect.value)>=-100;
  if (action.type === "add_buff" && effect.mode === "attack_rate_percent") return effect.stat === "attackSpeed" && Number.isFinite(Number(effect.value)) && Number(effect.value)>=-100;
  if (action.type === "add_buff" && ["damage_recovery","hp_floor"].includes(effect.mode)) return Number(action.duration)>0 && Number.isFinite(Number(effect.value)) && Number(effect.value)>0;
  if (action.type === "add_buff" && ["next_attack_miss","mark_damage_link"].includes(effect.mode)) return true;
  if (action.type === "add_buff" && effect.mode === "damage_link") return Number.isFinite(Number(effect.value)) && Number(effect.value)>0;
  if (action.type === "add_buff" && effect.mode === "basic_cycle_repeat") return Number(effect.value)>=1;
  if (action.type === "add_buff" && effect.mode === "attached_guard") return Number(effect.value)>0;
  if (action.type === "add_buff" && effect.mode === "barrier") return Number.isFinite(Number(effect.value)) && Number(effect.value)>0 && Number.isFinite(Number(effect.receivedDamagePercent ?? 100)) && Number.isFinite(Number(effect.breakRecreatePercent ?? 0));
  if (action.type === "add_buff" && ["disguise","stealth"].includes(effect.mode)) return true;
  if (action.type === "add_buff" && effect.mode === "melee_reaction") return Boolean(effect.reactionSkillId);
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
  if (periodic?.type === "interrupt") return Number.isFinite(Number(periodic.interval)) && Number(periodic.interval)>0;
  const coefficient=periodic.coefficient ?? {type:"fixed",value:periodic.value};
  const resourceDrains=Array.isArray(periodic.resourceDrains) ? periodic.resourceDrains : [];
  return ["damage","heal","interrupt"].includes(periodic.type) && Number.isFinite(Number(periodic.interval)) && Number(periodic.interval) > 0
    && ["fixed","calculated"].includes(coefficient.type) && Number.isFinite(Number(coefficient.value)) && Number(coefficient.value) >= 0
    && Number.isFinite(Number(periodic.growthInterval ?? 0)) && Number(periodic.growthInterval ?? 0) >= 0
    && Number.isFinite(Number(periodic.growthValue ?? 0)) && Number(periodic.growthValue ?? 0) >= 0
    && resourceDrains.every(drain=>Boolean(getResourceField(drain.resource)) && Number.isFinite(Number(drain.value)) && Number(drain.value) >= 0)
    && (periodic.type === "damage" ? ["physical","magic","fixed"].includes(periodic.damageType) : Boolean(getResourceField(periodic.resource)));
}

function normalizeSkillEffect(effect,type = "add_buff") {
  return {id:String(effect.id ?? "").trim(), name:String(effect.name || effect.id || "효과").trim(), state:effect.state,
    category:effect.category ?? "general",polarity:effect.polarity ?? (type.endsWith("state") ? "harmful" : "beneficial"),tags:[...new Set((Array.isArray(effect.tags) ? effect.tags : String(effect.tags ?? "").split(",")).map(tag=>String(tag).trim()).filter(Boolean))],dispellable:effect.dispellable !== false,
    dispelLimit:Math.max(0,Math.floor(Number(effect.dispelLimit) || 0)),dispelKinds:(Array.isArray(effect.dispelKinds) ? effect.dispelKinds : []).filter(kind=>["buff","state"].includes(kind)),
    dispelMode:effect.dispelMode ?? "id",dispelTags:[...new Set((Array.isArray(effect.dispelTags) ? effect.dispelTags : String(effect.dispelTags ?? "").split(",")).map(tag=>String(tag).trim()).filter(Boolean))],dispelCategory:effect.dispelCategory ?? "general",dispelPolarity:effect.dispelPolarity ?? "any",
    ...(effect.immunity ? {immunity:{scope:effect.immunity.scope,category:effect.immunity.category,state:effect.immunity.state}} : {}),
    barrierMode:["fixed","coefficient"].includes(effect.barrierMode) ? effect.barrierMode : "maxPercent",
    breakSkillId:String(effect.breakSkillId ?? "").trim(),
    echoHealPercent:Math.max(0,Number(effect.echoHealPercent ?? 100)),
    evadeDirect:effect.evadeDirect === true,holdAttacks:effect.holdAttacks === true,
    breakOnAttack:effect.breakOnAttack === true,
    stat:effect.stat, sourceStat:effect.sourceStat ?? effect.source_stat ?? "magic", mode:effect.mode, value:Number(effect.value) || 0,
    stackBonuses:(Array.isArray(effect.stackBonuses) ? effect.stackBonuses : []).map(bonus=>({
      stat:bonus.stat,mode:bonus.mode,value:Number(bonus.value) || 0,minStacks:Math.max(1,Math.min(100,Math.floor(Number(bonus.minStacks) || 1))),perStack:bonus.perStack === true,...(Number(bonus.perNStacks)>0 ? {perNStacks:Math.max(1,Math.min(100,Math.floor(Number(bonus.perNStacks))))} : {})
    })),
    requiredWeaponCount:Math.max(0,Math.floor(Number(effect.requiredWeaponCount) || 0)),
    repeatDelay:Math.max(0,Number(effect.repeatDelay) || 0),repeatDuration:Math.max(0,Number(effect.repeatDuration) || 0),
    weaponReserveCount:Math.max(0,Math.min(6,Math.floor(Number(effect.weaponReserveCount) || 0))),
    linkedEffectId:String(effect.linkedEffectId ?? ""),
    skillModifiers:(effect.skillModifiers ?? []).map(normalizeSelectionModifier),
    damageTypeFilter:["physical","magic","fixed"].includes(effect.damageTypeFilter) ? effect.damageTypeFilter : "",
    reflectBlockedMagic:effect.reflectBlockedMagic === true,markHealingLinkPercent:Math.max(0,Number(effect.markHealingLinkPercent) || 0),
    receivedDamagePercent:Math.max(0,Number(effect.receivedDamagePercent ?? 100)),
    breakRecreatePercent:Math.max(0,Number(effect.breakRecreatePercent) || 0),
    refundMpOnExpire:effect.refundMpOnExpire === true,
    guardHits:Math.max(1,Math.floor(Number(effect.guardHits) || 3)),
    countChoiceSkillId:String(effect.countChoiceSkillId ?? ""),
    requiredWeaponCategory:String(effect.requiredWeaponCategory ?? ""),
    requiredOwnedSummonAbsent:effect.requiredOwnedSummonAbsent === true,
    requiredOwnedSummonEntityId:String(effect.requiredOwnedSummonEntityId ?? effect.required_owned_summon_entity_id ?? "").trim(),
    nextCastTimePercent:Number.isFinite(Number(effect.nextCastTimePercent ?? effect.next_cast_time_percent)) ? Math.max(0,Number(effect.nextCastTimePercent ?? effect.next_cast_time_percent)) : 100,
    nextResourceCostPercent:Number.isFinite(Number(effect.nextResourceCostPercent ?? effect.next_resource_cost_percent)) ? Math.max(0,Number(effect.nextResourceCostPercent ?? effect.next_resource_cost_percent)) : 100,
    nextCooldownPercent:Number.isFinite(Number(effect.nextCooldownPercent ?? effect.next_cooldown_percent)) ? Math.max(0,Number(effect.nextCooldownPercent ?? effect.next_cooldown_percent)) : 100,
    reflectPercent:Number.isFinite(Number(effect.reflectPercent ?? effect.reflect_percent)) ? Math.max(0,Number(effect.reflectPercent ?? effect.reflect_percent)) : 20,
    reflectScope:["all","basic","skill"].includes(effect.reflectScope ?? effect.reflect_scope) ? (effect.reflectScope ?? effect.reflect_scope) : "all",
    reflectDamageType:["fixed","same"].includes(effect.reflectDamageType ?? effect.reflect_damage_type) ? (effect.reflectDamageType ?? effect.reflect_damage_type) : "fixed",
    proxyPercent:Number.isFinite(Number(effect.proxyPercent)) ? Math.max(1,Math.min(100,Number(effect.proxyPercent))) : 20,
    proxyPriority:Number.isFinite(Number(effect.proxyPriority)) ? Math.max(0,Math.min(999,Math.floor(Number(effect.proxyPriority)))) : 100,
    proxyScope:["all","basic","skill"].includes(effect.proxyScope) ? effect.proxyScope : "all",
    counterOnMelee:effect.counterOnMelee === true,
    reactionOnce:effect.reactionOnce === true,reactionInheritRemaining:effect.reactionInheritRemaining === true,
    reactionSkillId:String(effect.reactionSkillId ?? "").trim(),
    movementSpeedPercent:Number.isFinite(Number(effect.movementSpeedPercent)) ? Math.max(0,Number(effect.movementSpeedPercent)) : 100,
    breakDamagePercent:Math.max(0,Number(effect.breakDamagePercent) || 0),
    hitThreshold:Math.max(1,Math.min(100,Math.floor(Number(effect.hitThreshold) || 1))),
    movementStCostPercent:Number.isFinite(Number(effect.movementStCostPercent ?? effect.movement_st_cost_percent)) ? Math.max(0,Number(effect.movementStCostPercent ?? effect.movement_st_cost_percent)) : 100,
    movementTriggerDistance:Number.isFinite(Number(effect.movementTriggerDistance ?? effect.movement_trigger_distance)) ? Math.max(0,Number(effect.movementTriggerDistance ?? effect.movement_trigger_distance)) : 0,
    movementTriggerState:Object.hasOwn(STATE_LABELS,effect.movementTriggerState ?? effect.movement_trigger_state) ? (effect.movementTriggerState ?? effect.movement_trigger_state) : "stun",
    movementTriggerDuration:Number.isFinite(Number(effect.movementTriggerDuration ?? effect.movement_trigger_duration)) ? Math.max(0,Number(effect.movementTriggerDuration ?? effect.movement_trigger_duration)) : 0,
    uses:Math.max(0,Math.min(100,Math.floor(Number(effect.uses) || 0))),
    consumeOn:effect.mode === "damage_immunity" ? "damaged" : Object.hasOwn(EFFECT_CONSUME_LABELS,effect.consumeOn) ? effect.consumeOn : "hit",
    consumePeriodic:effect.consumePeriodic === true,
    maxStacks:Math.max(1, Math.min(100, Math.floor(Number(effect.maxStacks) || 1))),
    stackMode:["refresh","stack","reject"].includes(effect.stackMode) ? effect.stackMode : "refresh",
    ...(effect.periodic ? {periodic:{type:effect.periodic.type,interval:Math.max(1/60,Number(effect.periodic.interval)),
      value:Number(effect.periodic.value),coefficient:normalizeCoefficient(effect.periodic.coefficient ?? {type:"fixed",value:effect.periodic.value}),
      growthInterval:Math.max(0,Number(effect.periodic.growthInterval) || 0),growthValue:Math.max(0,Number(effect.periodic.growthValue) || 0),
      damageType:effect.periodic.damageType ?? "magic",resource:normalizeResourceReference(effect.periodic.resource,"HP"),
      resourceDrains:(Array.isArray(effect.periodic.resourceDrains) ? effect.periodic.resourceDrains : []).map(drain=>({resource:normalizeResourceReference(drain.resource,"MP"),value:Math.max(0,Number(drain.value) || 0)})).filter(drain=>drain.value>0)}} : {})};
}

function renderEffectStackBonusRow(bonus={stat:"speed",mode:"percent",value:20,minStacks:10,perStack:false}) {
  const options=(labels,selected)=>Object.entries(labels).map(([key,label])=>`<option value="${key}" ${key === selected ? "selected" : ""}>${label}</option>`).join("");
  const stats=Object.fromEntries(Object.entries(BUFF_STAT_LABELS).filter(([key])=>key !== "adaptiveOffense"));
  return `<div class="skill-effect-stack-bonus">
    <label>최소 중첩<input class="skill-bonus-min-stacks" type="number" min="1" max="100" step="1" value="${bonus.minStacks}"></label>
    <label>능력치<select class="skill-bonus-stat">${options(stats,bonus.stat)}</select></label>
    <label>계산<select class="skill-bonus-mode">${options({flat:"고정값 가산",percent:"기본 능력치의 % 가산",attack_rate_percent:"공격속도 증감 (%) · 음수: 감속",cast_time_percent:"모든 시전시간 증감 (%)",attribute:"기본 능력치 가산 (힘·지능)"},bonus.mode)}</select></label>
    <label>수치<input class="skill-bonus-value" type="number" step="0.1" value="${bonus.value}"></label>
    <label>몇 중첩마다 적용 (0: 기존 계산)<input class="skill-bonus-per-n-stacks" type="number" min="0" max="100" step="1" value="${bonus.perNStacks ?? 0}"></label>
    <label><input class="skill-bonus-per-stack" type="checkbox" ${bonus.perStack ? "checked" : ""}>현재 중첩 수만큼 적용</label>
    <button type="button" onclick="this.closest('.skill-effect-stack-bonus').remove()">보정 삭제</button>
  </div>`;
}

function addEffectStackBonus(button) {
  button.closest('.skill-effect-stack-bonus-settings').querySelector('.skill-effect-stack-bonus-list').insertAdjacentHTML('beforeend',renderEffectStackBonusRow());
}

function renderTimedEffectFields(action) {
  const effect = action.effect ?? createDefaultSkillEffect(action.type);
  const periodic = effect.periodic ?? {type:"", interval:1, value:10, coefficient:{type:"fixed",value:10}, growthInterval:0, growthValue:0, damageType:"magic", resource:"HP"};
  const periodicCoefficient=normalizeCoefficient(periodic.coefficient ?? {type:"fixed",value:periodic.value});
  const options = (labels, selected) => Object.entries(labels).map(([key,label]) => `<option value="${key}" ${key === selected ? "selected" : ""}>${label}</option>`).join("");
  return `<div data-action-field="timedEffect">
    <label><input type="checkbox" class="skill-effect-required-summon-absent" ${effect.requiredOwnedSummonAbsent ? "checked" : ""}>연결 소환수가 없을 때 적용</label>
    <label>연결 소환수<select class="skill-effect-required-summon"><option value="">조건 없음</option>${entitiesJson.map(entity=>`<option value="${escapeHtml(entity.entityId)}" ${effect.requiredOwnedSummonEntityId === entity.entityId ? "selected" : ""}>${escapeHtml(entity.name)} 생존 중</option>`).join("")}</select></label>
    <label>효과 ID<input class="skill-effect-id" value="${escapeHtml(effect.id)}"></label>
    <small>같은 시전자의 같은 ID는 갱신·중첩됩니다. 서로 다른 효과에는 다른 ID를 사용하세요. ID 해제는 해당 ID만, 분류/전체 해제는 ID와 무관하게 같은 종류의 해제 가능한 효과를 제거합니다.</small>
    <div data-action-field="effectDelete"><label>해제 최대 수 (0: 전체)<input class="skill-effect-dispel-limit" type="number" min="0" value="${effect.dispelLimit ?? 0}"></label><label><input class="skill-effect-dispel-mixed" type="checkbox" ${effect.dispelKinds?.length ? "checked" : ""}>버프·상태를 함께 검사</label>
      <label>해제 방식<select class="skill-effect-dispel-mode">${options({id:"효과 ID",category:"효과 분류",tags:"효과 태그",all:"전체"},effect.dispelMode ?? "id")}</select></label>
      <label>해제할 분류<select class="skill-effect-dispel-category">${options(EFFECT_CATEGORY_LABELS,effect.dispelCategory ?? "general")}</select></label>
      <label>해제할 태그 (쉼표 구분)<input class="skill-effect-dispel-tags" value="${escapeHtml((effect.dispelTags ?? []).join(", "))}" placeholder="예: poison, bleed"></label>
      <label>해제할 성격<select class="skill-effect-dispel-polarity">${options({any:"이로운 효과와 해로운 효과",beneficial:"이로운 효과만",harmful:"해로운 효과만"},effect.dispelPolarity ?? "any")}</select></label>
      <small>상태 제거는 상태만, 버프 제거는 버프만 해제합니다. 해제 불가 효과는 모든 방식에서 유지됩니다.</small>
    </div>
    <div data-action-field="effectAdd">
      <label>효과 분류<select class="skill-effect-category">${options(EFFECT_CATEGORY_LABELS,effect.category ?? "general")}</select></label>
      <label>효과 성격<select class="skill-effect-polarity">${options({beneficial:"이로운 효과",harmful:"해로운 효과"},effect.polarity ?? "beneficial")}</select></label>
      <label><input class="skill-effect-dispellable" type="checkbox" ${effect.dispellable !== false ? "checked" : ""}>해제 가능</label>
      <label class="skill-effect-reaction-settings ${effect.mode === "melee_reaction" ? "" : "hidden"}">근접 피격 반응 스킬<select class="skill-effect-reaction-skill"><option value="">사용 안 함</option>${skillsJson.filter(skill=>skill.slot !== "passive" && isSkillExecutable(skill)).map(skill=>`<option value="${escapeHtml(skill.id)}" ${effect.reactionSkillId === skill.id ? "selected" : ""}>${escapeHtml(skill.name)}</option>`).join("")}</select></label>
      <label>효과 이름<input class="skill-effect-name" value="${escapeHtml(effect.name)}"></label>
      <label>효과 태그 (쉼표 구분)<input class="skill-effect-tags" value="${escapeHtml((effect.tags ?? []).join(", "))}" placeholder="예: disease"></label>
      <label>지속시간 (초, 0: 전투 종료까지)<input class="skill-effect-duration" type="number" min="0" step="0.1" value="${action.duration ?? 5}"></label>
      <label>재적용 방식<select class="skill-effect-stack-mode"><option value="refresh" ${effect.stackMode === "refresh" ? "selected" : ""}>시간 갱신</option><option value="stack" ${effect.stackMode === "stack" ? "selected" : ""}>중첩 증가 + 시간 갱신</option><option value="reject" ${effect.stackMode === "reject" ? "selected" : ""}>효과가 있으면 대상 선택 제외</option></select></label>
      <label>최대 중첩<input class="skill-effect-max-stacks" type="number" min="1" max="100" value="${effect.maxStacks}"></label>
      <label><input class="skill-effect-refund-mp" type="checkbox" ${effect.refundMpOnExpire ? "checked" : ""}> 자연 만료 시 실제 소모 MP 반환</label>
      <label>사용 횟수 (0: 횟수 제한 없음)<input class="skill-effect-uses" type="number" min="0" max="100" step="1" value="${effect.uses ?? 0}"></label>
      <label><input class="skill-effect-break-attack" type="checkbox" ${effect.breakOnAttack ? "checked" : ""}>공격 실행 시 해제</label>
      <label>추가타 버프의 피해 대비 치유 (%)<input class="skill-effect-echo-heal" type="number" min="0" value="${effect.echoHealPercent ?? 100}"></label>
      <label>횟수 소모 조건<select class="skill-effect-consume-on">${options(EFFECT_CONSUME_LABELS,effect.consumeOn ?? "hit")}</select></label>
      <label><input class="skill-effect-consume-periodic" type="checkbox" ${effect.consumePeriodic ? "checked" : ""}>주기 피해·회복도 횟수 소모</label>
      <small>사용 횟수가 1 이상일 때만 행동마다 1회 소모합니다. 피해 무시는 피격 조건을 사용하며 실제 피해가 발생하기 전에 소모됩니다.</small>
      <label>이동 ST 소모 (%)<input class="skill-effect-movement-st-cost-percent" type="number" min="0" step="1" value="${effect.movementStCostPercent ?? 100}"></label>
      <label>이동 발동 거리 (m, 0: 없음)<input class="skill-effect-movement-trigger-distance" type="number" min="0" step="0.1" value="${effect.movementTriggerDistance ?? 0}"></label>
      <label>이동 발동 상태<select class="skill-effect-movement-trigger-state">${options(STATE_LABELS,effect.movementTriggerState ?? "stun")}</select></label>
      <label>이동 발동 상태 지속시간 (초)<input class="skill-effect-movement-trigger-duration" type="number" min="0" step="0.1" value="${effect.movementTriggerDuration ?? 0}"></label>
      <small>효과가 적용된 뒤 누적 이동 거리가 기준에 도달하면 지정 상태를 1회 부여합니다.</small>
      <div data-action-field="effectBuff">
        <div class="skill-effect-stack-bonus-settings">
          <div class="skill-subsection-header">중첩 조건부 보정</div>
          <div class="skill-effect-stack-bonus-list">${(effect.stackBonuses ?? []).map(renderEffectStackBonusRow).join("")}</div>
          <button type="button" onclick="addEffectStackBonus(this)">중첩 보정 추가</button>
          <small>능력치 버프에서 기준 중첩에 도달하면 적용하며, 이 효과가 만료·해제되면 보정도 함께 사라집니다.</small>
        </div>
        <label>능력치<select class="skill-effect-stat">${options(BUFF_STAT_LABELS,effect.stat)}</select></label>
        <label>계산<select class="skill-effect-mode" onchange="updateSkillEffectModeVisibility(this)"><option value="flat" ${effect.mode === "flat" ? "selected" : ""}>고정값 가산</option><option value="percent" ${effect.mode === "percent" ? "selected" : ""}>기본 능력치의 % 가산</option><option value="override" ${effect.mode === "override" ? "selected" : ""}>최종값 고정 (0: 삭제)</option><option value="attribute" ${effect.mode === "attribute" ? "selected" : ""}>기본 능력치 가산 (힘·지능)</option><option value="cast_time_flat" ${effect.mode === "cast_time_flat" ? "selected" : ""}>모든 시전시간 증감 (초)</option><option value="cast_time_percent" ${effect.mode === "cast_time_percent" ? "selected" : ""}>모든 시전시간 증감 (%) · 음수: 단축</option><option value="attack_rate_percent" ${effect.mode === "attack_rate_percent" ? "selected" : ""}>공격속도 증감 (%) · 음수: 감속</option><option value="convert" ${effect.mode === "convert" ? "selected" : ""}>다른 능력치의 % 전환</option><option value="next_skill_modifier" ${effect.mode === "next_skill_modifier" ? "selected" : ""}>다음 1회 스킬 보정</option><option value="damage_recovery" ${effect.mode === "damage_recovery" ? "selected" : ""}>받은 피해 저장 후 만료 시 회복 (%)</option><option value="hp_floor" ${effect.mode === "hp_floor" ? "selected" : ""}>죽음 방지 · 최소 HP</option><option value="mark_damage_link" ${effect.mode === "mark_damage_link" ? "selected" : ""}>받은 피해를 현재 징벌대상에 전달</option><option value="next_attack_miss" ${effect.mode === "next_attack_miss" ? "selected" : ""}>다음 공격 1회 빗나감</option><option value="damage_link" ${effect.mode === "damage_link" ? "selected" : ""}>시전자가 받은 실제 피해를 대상에 전달 (%)</option><option value="attached_guard" ${effect.mode === "attached_guard" ? "selected" : ""}>부착 방벽 · 직접 공격 방어</option><option value="basic_cycle_repeat" ${effect.mode === "basic_cycle_repeat" ? "selected" : ""}>주기 강화 일반 공격 반복</option><option value="barrier" ${effect.mode === "barrier" ? "selected" : ""}>시간제 보호막 · 공격으로 소진 시 반응</option><option value="damage_reflect" ${effect.mode === "damage_reflect" ? "selected" : ""}>받은 피해 반사</option><option value="heal_absorb" ${effect.mode === "heal_absorb" ? "selected" : ""}>다른 시전자 HP 치유 흡수 (수치: 흡수량)</option><option value="basic_echo" ${effect.mode === "basic_echo" ? "selected" : ""}>기본 공격 추가타 (수치: 피해 %)</option><option value="damage_pool" ${effect.mode === "damage_pool" ? "selected" : ""}>스킬 피해 누적 · 최대 중첩 폭발 (수치: 피해 %)</option><option value="periodic" ${effect.mode === "periodic" ? "selected" : ""}>주기 효과만 적용</option><option value="immunity" ${effect.mode === "immunity" ? "selected" : ""}>능력치 변경 없이 면역 적용</option><option value="received_healing_percent" ${effect.mode === "received_healing_percent" ? "selected" : ""}>받는 회복량 (%)</option><option value="priority_attack_damage" ${effect.mode === "priority_attack_damage" ? "selected" : ""}>최우선 공격력 고정 피해</option><option value="damage_immunity" ${effect.mode === "damage_immunity" ? "selected" : ""}>피해 무시</option><option value="damage_proxy" ${effect.mode === "damage_proxy" ? "selected" : ""}>피해 대리 수신</option><option value="stealth" ${effect.mode === "stealth" ? "selected" : ""}>은신 · 직접 타겟 제외</option><option value="disguise" ${effect.mode === "disguise" ? "selected" : ""}>적 외형 위장·직접 타겟 제외</option><option value="melee_reaction" ${effect.mode === "melee_reaction" ? "selected" : ""}>근접 피격 반응 스킬</option></select></label>
        <div class="skill-effect-barrier-settings ${effect.mode === "barrier" ? "" : "hidden"}">
          <label>보호막 유지 중 받는 피해 (%)<input class="skill-effect-barrier-received" type="number" min="0" value="${effect.receivedDamagePercent ?? 100}"></label>
          <label>공격 소진 시 1회 재생성 (%)<input class="skill-effect-barrier-recreate" type="number" min="0" value="${effect.breakRecreatePercent ?? 0}"></label>
          <label>보호막 수치 기준<select class="skill-effect-barrier-mode"><option value="maxPercent" ${!["fixed","coefficient"].includes(effect.barrierMode) ? "selected" : ""}>대상 최대 HP의 %</option><option value="coefficient" ${effect.barrierMode === "coefficient" ? "selected" : ""}>액션 계수</option><option value="fixed" ${effect.barrierMode === "fixed" ? "selected" : ""}>고정량</option></select></label>
          <label>공격으로 소진 시 실행할 스킬 ID<input class="skill-effect-break-skill" value="${escapeHtml(effect.breakSkillId ?? "")}"></label>
        </div>
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
        <div class="skill-effect-counter-settings ${effect.mode === "damage_immunity" ? "" : "hidden"}">
          <label>피해 무시 타입<select class="skill-effect-damage-type-filter">${options({"":"모든 피해",physical:"물리",magic:"마법",fixed:"고정"},effect.damageTypeFilter ?? "")}</select></label>
          <label><input class="skill-effect-reflect-blocked-magic" type="checkbox" ${effect.reflectBlockedMagic ? "checked" : ""}>차단한 마법 공격 반사</label>
          <label><input class="skill-effect-counter-on-melee" type="checkbox" ${effect.counterOnMelee ? "checked" : ""}>1m 이하 직접 공격을 무시하면 즉시 기본 공격으로 반격</label>
          <small>DOT와 필드 주기 피해는 피해 무시 횟수와 반격을 소모하지 않습니다. 반사 피해와 반격으로 발생한 공격에는 연쇄 반격하지 않습니다.</small>
        </div>
        <label>면역 범위<select class="skill-effect-immunity-scope">${options({"":"면역 없음",state:"모든 상태",harmful:"해로운 효과",all:"모든 상태·버프"},effect.immunity?.scope ?? "")}</select></label>
        <label>면역 분류<select class="skill-effect-immunity-category">${options({all:"모든 분류",...EFFECT_CATEGORY_LABELS},effect.immunity?.category ?? "all")}</select></label>
        <label>면역 상태<select class="skill-effect-immunity-state">${options({all:"상태 제한 없음",...STATE_LABELS},effect.immunity?.state ?? "all")}</select></label>
        <small>면역은 새 효과 부여만 막습니다. 기존 효과와 직접 피해는 유지됩니다. 분류·상태 제한은 모두 만족해야 하며, 특정 상태를 고르면 버프는 차단하지 않습니다.</small>
        <label>중첩당 수치<input class="skill-effect-value" type="number" step="0.1" value="${effect.value}"></label>
        <small>음수는 감소입니다. 공격 간격·기본 시전시간은 감소할수록 빨라집니다. 스킬에 직접 지정한 시전시간은 바꾸지 않습니다.</small>
      </div>
      <label data-action-field="effectState">상태<select class="skill-effect-state">${options(STATE_LABELS,effect.state)}</select></label>
      <label data-action-field="effectState">상태 적용에 필요한 적중 횟수<input class="skill-effect-hit-threshold" type="number" min="1" max="100" step="1" value="${effect.hitThreshold ?? 1}"></label>
      <label data-action-field="effectState">해제 누적 피해 (최대 HP %, 0: 피해로 해제하지 않음)<input class="skill-effect-break-damage" type="number" min="0" step="0.1" value="${effect.breakDamagePercent ?? 0}"></label>
      <label data-action-field="effectState">상태 이동속도 (%)<input class="skill-effect-movement-speed-percent" type="number" min="0" step="1" value="${effect.movementSpeedPercent ?? 100}"></label>
      <div>
        <label>주기 효과<select class="skill-effect-periodic-type">${options({"":"없음",damage:"주기 피해",heal:"주기 회복",interrupt:"주기 시전 차단"},periodic.type)}</select></label>
        <label>적용 간격 (초)<input class="skill-effect-periodic-interval" type="number" min="${1/60}" step="any" value="${periodic.interval}"></label>
        <label>회당 계산 기준<select class="skill-effect-periodic-coefficient-type"><option value="fixed" ${periodicCoefficient.type === "fixed" ? "selected" : ""}>고정값</option><option value="calculated" ${periodicCoefficient.type === "calculated" ? "selected" : ""}>능력치 계수</option></select></label>
        <label>기준 능력치<select class="skill-effect-periodic-coefficient-field">${COEFFICIENT_FIELDS.map(field=>`<option value="${field}" ${periodicCoefficient.field === field ? "selected" : ""}>${COEFFICIENT_FIELD_LABELS[field] ?? field}</option>`).join("")}</select></label>
        <label>계산 방식<select class="skill-effect-periodic-coefficient-calc"><option value="percent" ${periodicCoefficient.calc === "percent" ? "selected" : ""}>퍼센트</option><option value="flat" ${periodicCoefficient.calc === "flat" ? "selected" : ""}>고정 가산</option></select></label>
        <label>중첩당 회당 값<input class="skill-effect-periodic-value" type="number" min="0" step="0.1" value="${periodicCoefficient.value}"></label>
        <label>증가 간격 (초, 0: 증가 없음)<input class="skill-effect-periodic-growth-interval" type="number" min="0" step="0.1" value="${periodic.growthInterval ?? 0}"></label>
        <label>간격당 값 증가<input class="skill-effect-periodic-growth-value" type="number" min="0" step="0.1" value="${periodic.growthValue ?? 0}"></label>
        <label>피해 타입<select class="skill-effect-periodic-damage">${options({physical:"물리",magic:"마법",fixed:"고정"},periodic.damageType)}</select></label>
        <label>회복 자원<select class="skill-effect-periodic-resource">${renderResourceOptions(periodic.resource)}</select></label>
        <label>추가 자원 감소<input class="skill-effect-periodic-resource-drains" value="${escapeHtml((periodic.resourceDrains ?? []).map(drain=>`${drain.resource}:${drain.value}`).join(", "))}" placeholder="예: MP:1, ST:1"></label>
        <small>첫 적용은 한 간격 뒤입니다. 갱신해도 다음 적용까지의 시간은 유지하며, 중첩 수만큼 회당 수치가 증가합니다. 능력치·행동 제한 없이 쓰려면 위에서 ‘주기 효과만 적용’을 선택하세요.</small>
      </div>
    </div>
  </div>`;
}

function readSkillEffectFromRow(row) {
  const value = name => row.querySelector(`.skill-effect-${name}`)?.value;
  return {reactionOnce:row.dataset.reactionOnce === "true",reactionInheritRemaining:row.dataset.reactionInherit === "true",requiredWeaponCount:Number(row.dataset.requiredWeaponCount) || 0,repeatDelay:Number(row.dataset.repeatDelay) || 0,repeatDuration:Number(row.dataset.repeatDuration) || 0,weaponReserveCount:Number(row.dataset.weaponReserveCount) || 0,linkedEffectId:row.dataset.linkedEffectId ?? "",skillModifiers:JSON.parse(row.dataset.skillModifiers || "[]"),damageTypeFilter:value("damage-type-filter") ?? row.dataset.damageTypeFilter ?? "",reflectBlockedMagic:row.querySelector(".skill-effect-reflect-blocked-magic")?.checked ?? (row.dataset.reflectBlockedMagic === "true"),markHealingLinkPercent:Number(row.dataset.markHealingLink) || 0,receivedDamagePercent:Number(value("barrier-received") ?? row.dataset.barrierReceived ?? 100),breakRecreatePercent:Number(value("barrier-recreate") ?? row.dataset.barrierRecreate) || 0,refundMpOnExpire:row.querySelector(".skill-effect-refund-mp")?.checked ?? (row.dataset.refundMp === "true"),guardHits:Number(row.dataset.guardHits) || 3,countChoiceSkillId:row.dataset.countChoice ?? "",evadeDirect:row.dataset.evadeDirect === "true",holdAttacks:row.dataset.holdAttacks === "true",requiredOwnedSummonAbsent:row.querySelector('.skill-effect-required-summon-absent')?.checked === true,id:value("id"),name:value("name"),stat:value("stat"),sourceStat:value("source-stat"),state:value("state"),mode:value("mode"),requiredOwnedSummonEntityId:value("required-summon") ?? "",tags:String(value("tags") ?? "").split(",").map(tag=>tag.trim()).filter(Boolean),
    stackBonuses:[...row.querySelectorAll('.skill-effect-stack-bonus')].map(bonus=>({
      stat:bonus.querySelector('.skill-bonus-stat').value,mode:bonus.querySelector('.skill-bonus-mode').value,
      value:Number(bonus.querySelector('.skill-bonus-value').value),minStacks:Number(bonus.querySelector('.skill-bonus-min-stacks').value),perNStacks:Number(bonus.querySelector('.skill-bonus-per-n-stacks')?.value || 0),perStack:bonus.querySelector('.skill-bonus-per-stack').checked
    })),
    barrierMode:value("barrier-mode") ?? "maxPercent",breakSkillId:value("break-skill") ?? "",
    reactionSkillId:value("reaction-skill") ?? "",
    movementSpeedPercent:Number(value("movement-speed-percent") ?? 100),
    hitThreshold:Number(value("hit-threshold") ?? 1),breakDamagePercent:Number(value("break-damage") ?? 0),
    category:value("category"),polarity:value("polarity"),dispellable:row.querySelector('.skill-effect-dispellable')?.checked ?? true,
    dispelMode:value("dispel-mode"),dispelTags:String(value("dispel-tags") ?? "").split(",").map(tag=>tag.trim()).filter(Boolean),dispelCategory:value("dispel-category"),dispelPolarity:value("dispel-polarity"),
    ...(value("immunity-scope") && (row.querySelector('.skill-action-type')?.value === "add_buff" || row.querySelector('.skill-action-field-effect')?.value === "add_buff") ? {immunity:{scope:value("immunity-scope"),category:value("immunity-category"),state:value("immunity-state")}} : {}),
    value:Number(value("value")),nextCastTimePercent:Number(value("next-cast-time-percent")),nextResourceCostPercent:Number(value("next-resource-cost-percent")),nextCooldownPercent:Number(value("next-cooldown-percent")),reflectPercent:Number(value("reflect-percent")),reflectScope:value("reflect-scope"),reflectDamageType:value("reflect-damage-type"),proxyPercent:Number(value("proxy-percent")),proxyPriority:Number(value("proxy-priority")),proxyScope:value("proxy-scope"),maxStacks:Number(value("max-stacks")),stackMode:value("stack-mode"),
    dispelLimit:Number(value("dispel-limit")),dispelKinds:row.querySelector(".skill-effect-dispel-mixed")?.checked ? ["buff","state"] : [],
    echoHealPercent:Number(value("echo-heal")),breakOnAttack:row.querySelector(".skill-effect-break-attack")?.checked ?? false,uses:Number(value("uses")),consumeOn:value("consume-on"),consumePeriodic:row.querySelector('.skill-effect-consume-periodic')?.checked ?? false,counterOnMelee:row.querySelector('.skill-effect-counter-on-melee')?.checked ?? false,
    movementStCostPercent:Number(value("movement-st-cost-percent")),movementTriggerDistance:Number(value("movement-trigger-distance")),movementTriggerState:value("movement-trigger-state"),movementTriggerDuration:Number(value("movement-trigger-duration")),
    ...(value("periodic-type") ? {periodic:{type:value("periodic-type"),interval:Number(value("periodic-interval")),value:Number(value("periodic-value")),
      coefficient:{type:value("periodic-coefficient-type"),field:value("periodic-coefficient-field"),calc:value("periodic-coefficient-calc"),value:Number(value("periodic-value"))},
      growthInterval:Number(value("periodic-growth-interval")),growthValue:Number(value("periodic-growth-value")),damageType:value("periodic-damage"),resource:value("periodic-resource"),
      resourceDrains:String(value("periodic-resource-drains") ?? "").split(",").map(entry=>{const [resource,amount]=entry.split(":");return {resource:String(resource ?? "").trim(),value:Number(amount)};}).filter(drain=>drain.resource && Number.isFinite(drain.value) && drain.value>0)}} : {})};
}

function updateSkillEffectModeVisibility(select) {
  select.closest('[data-action-field="effectAdd"]')?.querySelector('.skill-effect-reaction-settings')?.classList.toggle('hidden',select.value !== 'melee_reaction');
  select.closest('[data-action-field="effectBuff"]')?.querySelector('.skill-effect-proxy-settings')?.classList.toggle('hidden',select.value !== 'damage_proxy');
  select.closest('[data-action-field="effectBuff"]')?.querySelector('.skill-effect-convert-settings')?.classList.toggle('hidden',select.value !== 'convert');
  select.closest('[data-action-field="effectBuff"]')?.querySelector('.skill-effect-next-skill-settings')?.classList.toggle('hidden',select.value !== 'next_skill_modifier');
  select.closest('[data-action-field="effectBuff"]')?.querySelector('.skill-effect-barrier-settings')?.classList.toggle('hidden',select.value !== 'barrier');
  select.closest('[data-action-field="effectBuff"]')?.querySelector('.skill-effect-reflect-settings')?.classList.toggle('hidden',select.value !== 'damage_reflect');
  select.closest('[data-action-field="effectBuff"]')?.querySelector('.skill-effect-counter-settings')?.classList.toggle('hidden',select.value !== 'damage_immunity');
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
  return (unit.activeEffects ?? []).some(effect => effect.kind === "state" && (effect.state === state
    || (effect.state === "polymorph" && ["disarm","silence","flee"].includes(state))
    || (effect.state === "sleep" && state === "stun")
    || (effect.state === "charm" && ["disarm","silence"].includes(state))));
}

function getSingleTargetMarkPassive(unit) {
  const base=resolveSelectedSkillIds(unit?.skillIds,unit?.skillSelections).map(getSkillById)
    .find(skill=>skill?.slot === "passive" && skill.singleTargetMark && !isUnitSkillDisabled(unit,skill));
  return base ? getRuntimeSelectionSkill(unit,getRuntimeItemSkill(unit,base)) : null;
}

function getSingleMarkedTarget(unit) {
  const passive=getSingleTargetMarkPassive(unit);
  if (!passive || unit.effectCasterId == null) return null;
  return [...playerSquad,...enemySquad].find(target=>target.alive && target.side!==unit.side && (target.activeEffects ?? []).some(effect=>effect.id===passive.singleTargetMark.effectId && effect.casterId===unit.effectCasterId)) ?? null;
}

function initializeMarkExecution(source,target,execution) {
  if (!Object.hasOwn(execution,"primaryTarget")) execution.primaryTarget=target;
  if (!Object.hasOwn(execution,"priorMarkTarget")) execution.priorMarkTarget=getSingleMarkedTarget(source);
}

function getMarkedMagicDamageMultiplier(source,target,action) {
  if (action.damageType!=="magic" || getSingleMarkedTarget(source)!==target) return 1;
  return (getSingleTargetMarkPassive(source)?.markMagicDamagePercent || 100)/100;
}

function applySingleMarkDamageBonus(source,target,action,skill,actual,execution) {
  if (!source.alive || !(actual>0) || source.side===target.side || action.periodic || action.reflected || action.countered || action.damageLinked || skill?.triggered) return;
  const passive=getSingleTargetMarkPassive(source);
  if (!passive) return;
  if (execution.primaryTarget===target) {
    for (const unit of [...playerSquad,...enemySquad]) {
      const previous=unit.activeEffects?.length;
      unit.activeEffects=(unit.activeEffects ?? []).filter(effect=>!(effect.id===passive.singleTargetMark.effectId && effect.casterId===source.effectCasterId));
      if (previous!==unit.activeEffects.length) recalculateBattleBuffs(unit);
    }
    if (target.alive) applyTimedEffectAction(source,target,{type:"add_buff",duration:0,effect:{id:passive.singleTargetMark.effectId,name:"징벌대상",stat:"atk",mode:"flat",value:0,category:"magic",polarity:"harmful",dispellable:true}},passive);
  }
  const marked=getSingleMarkedTarget(source);
  if (marked) applyActionDamage(source,marked,{type:"deal_damage",damageType:"magic",markProc:true,settledDamage:true,
    coefficients:[{type:"fixed",value:actual*passive.singleTargetMark.bonusPercent/100*getMarkedMagicDamageMultiplier(source,marked,{damageType:"magic"})}]},
    {id:passive.id,name:passive.name,slot:"passive",triggered:true});
}

function prepareAttackOutcome(unit,target,skill) {
  if (!unit?.alive || !skill || skill.triggered || skill._attackOutcomeChecked || !skill.actions?.some(action=>action.type==="deal_damage")) return skill;
  const result={...skill,_attackOutcomeChecked:true};
  const passive=getSingleTargetMarkPassive(unit);
  if (skill.slot==="basic" && passive?.basicAttackMpGain>0) {
    const before=unit.mp;unit.mp=Math.min(unit.maxMp,unit.mp+passive.basicAttackMpGain);
    if (unit.mp>before) publishBattleEvents([{type:"heal",source:unit,target:unit,skill:{...passive,triggered:true},resource:"MP",amount:unit.mp-before}]);
  }
  const miss=(unit.activeEffects ?? []).find(effect=>effect.mode==="next_attack_miss");
  if (miss) {
    consumeBattleEffectUse(unit,miss,"실명 공격 실패");result._attackMissed=true;
    publishBattleEvents([{type:"attack_miss",source:unit,target,skill,reason:miss.name}]);
  }
  return result;
}

function applyMarkedLinkDamage(unit,amount,healing=false) {
  if (!(amount>0) || !unit.alive) return;
  const marked=getSingleMarkedTarget(unit);
  if (!marked) return;
  for (const effect of unit.activeEffects ?? []) {
    if (effect.mode!=="mark_damage_link") continue;
    const percent=healing ? effect.markHealingLinkPercent : effect.value;
    if (!(percent>0) || !marked.alive) continue;
    applyActionDamage(unit,marked,{type:"deal_damage",damageType:"fixed",settledDamage:true,damageLinked:true,coefficients:[{type:"fixed",value:amount*percent/100}]},
      {id:effect.skillId,name:effect.name,triggered:true});
  }
}

function getCombatCyclePassive(unit) {
  return resolveSelectedSkillIds(unit?.skillIds,unit?.skillSelections).map(getSkillById)
    .find(skill=>skill?.slot === "passive" && skill.passiveTrigger?.combatCycle && !isUnitSkillDisabled(unit,skill));
}

function getCombatCyclePhase(unit) {
  if (unit?.combatCycle?.phase === "active" && !(unit.activeEffects ?? []).some(effect=>effect.skillId === unit.combatCycle.skillId)) unit.combatCycle.phase="spent";
  return unit?.combatCycle?.phase ?? "ready";
}

function isOffensiveSkill(skill) {
  return (skill?.actions ?? []).some(action=>action.target === "enemy" && (["deal_damage","add_state","add_buff","override_rule","move"].includes(action.type)
    || (action.type === "command_summon" && ["attack","companion_attack"].includes(action.summonCommand))));
}

function getCombatStMultiplier(unit,attackIntent=false) {
  const passive=getCombatCyclePassive(unit);
  if (!passive) return 1;
  const phase=getCombatCyclePhase(unit);
  return phase === "active" || (phase === "ready" && attackIntent) ? Math.max(1,Number(passive.passiveTrigger.combatCycle.stMultiplier) || 3) : 1;
}

function beginCombatCycle(unit) {
  const base=getCombatCyclePassive(unit);
  if (!unit?.alive || !base || getCombatCyclePhase(unit)!=="ready") return;
  const passive=getRuntimeSelectionSkill(unit,getRuntimeItemSkill(unit,base));
  unit.combatCycle={phase:"active",skillId:base.id};
  applySkill(unit,unit,{...passive,triggered:true});
}

function beginOffensiveAction(unit,skill) {
  if (!isOffensiveSkill(skill)) return;
  if (getCombatCyclePassive(unit) || hasEvasiveConcealment(unit)) breakAttackConcealment(unit,skill,true);
  beginCombatCycle(unit);
}

function resetCombatCycle(unit) {
  const passive=getCombatCyclePassive(unit);
  if (!passive) return;
  unit.activeEffects=(unit.activeEffects ?? []).filter(effect=>effect.skillId !== passive.id);
  unit.combatCycle={phase:"ready",skillId:passive.id};
  recalculateBattleBuffs(unit);
}

function hasEvasiveConcealment(unit) {
  return (unit?.activeEffects ?? []).some(effect=>effect.mode === "stealth" && effect.evadeDirect);
}

function isDirectHostileSkill(source,target,skill) {
  return target && source.side !== target.side && !(skill?.actions ?? []).some(action=>action.area>0 || action.battlefieldArea || action.type === "create_field");
}

function getUnitBattleForm(unit) {
  return (unit?.activeEffects ?? []).find(effect=>effect.kind === "transform");
}

// A companion remains the same persistent summon while fused: skills and cooldowns
// are borrowed by its owner, and its HP belongs to the owner's shared pool.
function getCompanionPassive(unit) {
  return limitOptionalSkillIds(unit?.skillIds).map(getSkillById).find(skill=>skill?.companion && !isUnitSkillDisabled(unit,skill));
}

function getCompanionModifiers(unit, entityId="") {
  return limitOptionalSkillIds(unit?.skillIds).map(getSkillById).filter(skill=>skill?.slot === "optional" && !isUnitSkillDisabled(unit,skill))
    .map(skill=>skill.selectionModifier?.companion).filter(value=>value && (!value.entityId || value.entityId === entityId));
}

function getCompanionEntityIds(unit) {
  const config=getCompanionPassive(unit)?.companion;
  if (!config) return [];
  const selected=getChoiceSummonEntityId(unit,config.choiceSkillId,config.entityIds[0]);
  return getCompanionModifiers(unit).some(value=>value.all) ? [selected,...config.entityIds.filter(id=>id!==selected)] : [selected];
}

function getOwnedCompanions(unit, aliveOnly=true) {
  const ids=getCompanionEntityIds(unit);
  return ids.flatMap(id=>(unit.summons ?? []).filter(beast=>beast.entityId === id && !beast.removed && (!aliveOnly || beast.alive)));
}

function hasDeadCompanion(unit) {
  return getCompanionEntityIds(unit).some(id=>!(unit.summons ?? []).some(beast=>beast.entityId === id && beast.alive && !beast.removed));
}

function spawnCompanion(unit,entityId,skill) {
  const action=normalizeSkillAction({type:"summon_entity",target:"self",entityId,count:1,limit:1,limitScope:"entity",duration:0});
  const before=new Set(unit.summons ?? []);
  summonBattleUnits(unit,action,skill);
  const beast=(unit.summons ?? []).find(candidate=>!before.has(candidate) && candidate.entityId === entityId);
  if (!beast) return null;
  const modifiers=getCompanionModifiers(unit,entityId);
  const add=modifiers.reduce((sum,value)=>sum+value.attackAdd,0);
  const percent=1+modifiers.reduce((sum,value)=>sum+value.attackPercent-100,0)/100;
  const final=modifiers.reduce((value,modifier)=>value*modifier.finalAttackPercent/100,1);
  beast.atk=Math.max(0,(beast.atk+add)*percent);
  beast.companionAttackMultiplier=final;
  recalculateBattleBuffs(beast);
  beast.companionBaseSpeed=beast.speed;
  return beast;
}

function getCompanionCommandActor(unit,beast) {
  return beast.fusedInto === unit ? unit : beast;
}

function resolveCompanionCommandTarget(source,action,preferredTarget,skill) {
  if (!getCompanionPassive(source)) return null;
  const mode=action.summonCommand,beasts=getOwnedCompanions(source);
  if (mode === "companion_spawn") return getCompanionEntityIds(source).some(id=>!(source.summons ?? []).some(beast=>beast.entityId === id && !beast.removed)) ? source : null;
  if (mode === "companion_revive") return !source.companionFusion && hasDeadCompanion(source) ? source : null;
  if (mode === "companion_fuse") return !source.companionFusion && beasts.some(beast=>beast.entityId === getCompanionEntityIds(source)[0]) ? source : null;
  if (mode === "companion_heal") return beasts.some(beast=>{const actor=getCompanionCommandActor(source,beast);return actor.hp<actor.maxHp && distance(source,actor)<=getActionRangePixels(source,action);}) ? source : null;
  if (mode === "companion_reset") return beasts.some(beast=>beast.skillIds.some(id=>(getCompanionCommandActor(source,beast).skillCooldowns?.[id] ?? 0)>0)) ? source : null;
  if (mode === "companion_unleash") return beasts.length ? source : null;
  if (mode !== "companion_attack" || (!source.companionFusion && hasDeadCompanion(source))) return null;
  const eligible=target=>target?.alive && beasts.some(beast=>{
    const actor=getCompanionCommandActor(source,beast);
    return canDirectlyTarget(actor,target) && distance(actor,target)<=getActionRangePixels(beast,action)
      && !["stun","disarm","flee","charm"].some(state=>hasBattleState(actor,state));
  });
  const enemies=source.side === "enemy" ? playerSquad : enemySquad;
  return eligible(preferredTarget) ? preferredTarget : enemies.filter(eligible).sort((a,b)=>distance(source,a)-distance(source,b))[0] ?? null;
}

function syncCompanionFusionStats(unit) {
  const fusion=unit.companionFusion;
  if (!fusion) return;
  const beast=fusion.beast;
  const next={maxHp:beast.maxHp,atk:beast.atk,defense:beast.defense || 0,resistance:beast.resistance || 0};
  const signature=JSON.stringify([next,beast.companionBaseSpeed ?? beast.speed,beast.attackSpeed]);
  if (fusion.signature === signature) return;
  fusion.signature=signature;
  fusion.effect.modifiers=next;
  fusion.effect.companionSpeed=beast.companionBaseSpeed ?? beast.speed;
  fusion.effect.companionAttackSpeed=beast.attackSpeed;
  recalculateBattleBuffs(unit);
}

function syncCompanionSkillCooldowns(unit) {
  const beast=unit?.companionFusion?.beast;
  if (!beast) return;
  for (const id of beast.skillIds) {
    beast.skillCooldowns[id]=unit.skillCooldowns[id] ?? 0;
    beast.skillCooldownTotals[id]=unit.skillCooldownTotals[id] ?? 0;
  }
}

function beginCompanionFusion(unit,skill,duration=10) {
  if (unit.companionFusion || !unit.alive) return false;
  const beast=getOwnedCompanions(unit).find(candidate=>candidate.entityId === getCompanionEntityIds(unit)[0]);
  if (!beast) return false;
  interruptCombatCasting(beast,"합체");
  for (const state of unit.weaponAttackStates ?? []) {state.castTimer=0;state.target=null;state.preparedAttackSkill=null;}
  const hp=unit.hp+beast.hp;
  const permanent=getCompanionModifiers(unit).some(value=>value.permanentFusion);
  const effect={kind:"transform",id:"companion_fusion",name:`합체 · ${beast.summonTemplateName}`,mode:"flat",modifiers:{},companionFusion:true,
    receivedDamagePercent:100,stacks:1,remainingTicks:permanent ? null : Math.ceil(duration*BASE_ATTACK_COOLDOWN),usesRemaining:null,skillId:skill?.id};
  unit.companionFusion={beast,effect};
  beast.fusedInto=unit;beast.suspendedTicks=1;
  (unit.activeEffects ??= []).push(effect);
  for (const id of beast.skillIds) {
    unit.skillCooldowns[id]=beast.skillCooldowns[id] ?? 0;
    unit.skillCooldownTotals[id]=beast.skillCooldownTotals[id] ?? 0;
  }
  syncCompanionFusionStats(unit);
  unit.hp=Math.min(unit.maxHp,hp);
  publishBattleEvents([{type:"transform_start",source:unit,target:unit,skill,reason:effect.name}]);
  return true;
}

function endCompanionFusion(unit,{dead=false,reset=false}={}) {
  const fusion=unit?.companionFusion;
  if (!fusion) return;
  const beast=fusion.beast,ratio=Math.max(0,Math.min(1,unit.hp/Math.max(1,unit.maxHp)));
  if (beast.skillIds.includes(unit.pendingAction?.skill?.id)) interruptCombatCasting(unit,"합체 해제");
  for (const id of beast.skillIds) {
    beast.skillCooldowns[id]=unit.skillCooldowns[id] ?? 0;
    beast.skillCooldownTotals[id]=unit.skillCooldownTotals[id] ?? 0;
    delete unit.skillCooldowns[id];delete unit.skillCooldownTotals[id];
  }
  unit.companionFusion=null;
  beast.fusedInto=null;beast.suspendedTicks=0;
  unit.activeEffects=(unit.activeEffects ?? []).filter(effect=>effect!==fusion.effect);
  recalculateBattleBuffs(unit);
  if (!dead) {
    unit.hp=unit.maxHp*ratio;beast.hp=beast.maxHp*ratio;
    beast.x=unit.x+COLLISION_DISTANCE;beast.y=unit.y;clampPosition(beast);
    moveUnitWithCollision(beast,beast.x,beast.y,{sweep:false});
  } else {
    unit.hp=0;beast.hp=0;
    syncAliveState(beast,{source:unit,forceDeath:true,preventRevival:true,reason:"합체 사망"});
  }
  if (!reset) publishBattleEvents([{type:"transform_end",source:unit,target:unit,skill:getSkillById(fusion.effect.skillId),reason:dead ? "합체 사망" : "합체 해제"}]);
}

function executeCompanionCommand(source,target,action,skill) {
  if (!resolveCompanionCommandTarget(source,action,target,skill)) return false;
  const mode=action.summonCommand;
  if (mode === "companion_spawn") {
    for (const id of getCompanionEntityIds(source)) if (!(source.summons ?? []).some(beast=>beast.entityId === id && !beast.removed)) spawnCompanion(source,id,skill);
    if (getCompanionModifiers(source).some(value=>value.permanentFusion)) beginCompanionFusion(source,skill,0);
    return true;
  }
  if (mode === "companion_fuse") return beginCompanionFusion(source,skill,action.duration);
  if (mode === "companion_revive") {
    const id=getCompanionEntityIds(source).find(id=>!(source.summons ?? []).some(beast=>beast.entityId === id && beast.alive && !beast.removed));
    let beast=getOwnedCompanions(source,false).find(beast=>beast.entityId === id);
    if (beast) {
      clearBattleEffects(beast);
      if (!reactivatePersistentSummon(beast,beast.maxHp)) return false;
      pendingSummonDeaths.delete(beast);
      beast.runtimeRuleOverrides=[];beast.pendingAction=null;beast.castTimer=0;beast.castDuration=0;
      beast.mp=beast.maxMp;beast.st=beast.maxSt;beast.exhausted=false;
      beast.x=source.x+COLLISION_DISTANCE;beast.y=source.y;clampPosition(beast);
    } else beast=spawnCompanion(source,id,skill);
    if (beast) publishBattleEvents([{type:"revive",source,target:beast,skill}]);
    return Boolean(beast);
  }
  const healed=new Set();
  for (const beast of getOwnedCompanions(source)) {
    const actor=getCompanionCommandActor(source,beast);
    if (mode === "companion_attack") {
      if (!canDirectlyTarget(actor,target) || distance(actor,target)>getActionRangePixels(beast,action)
        || ["stun","disarm","flee","charm"].some(state=>hasBattleState(actor,state))) continue;
      // Command damage always uses the beast's attack, even while fused.
      const amount=getActionCoefficientValue(action,beast,target);
      applyActionDamage(actor,target,{...action,type:"deal_damage",coefficients:[{type:"fixed",value:amount}]},skill);
    }
    if (mode === "companion_heal" && !healed.has(actor) && distance(source,actor)<=getActionRangePixels(source,action)) {
      applyActionHeal(source,actor,{...action,type:"heal",healResource:"HP"},skill);healed.add(actor);
    }
    if (["companion_reset","companion_unleash"].includes(mode)) for (const id of beast.skillIds) {
      beast.skillCooldowns[id]=actor.skillCooldowns[id]=0;
      beast.skillCooldownTotals[id]=actor.skillCooldownTotals[id]=0;
    }
    if (mode === "companion_unleash") {
      for (const effect of [{id:"companion_unleash_atk",name:"야수해방 · 공격력",stat:"atk",mode:"percent",value:100},
        {id:"companion_unleash_speed",name:"야수해방 · 공격속도",stat:"attackSpeed",mode:"attack_rate_percent",value:30}])
        applyTimedEffectAction(source,beast,normalizeSkillAction({type:"add_buff",target:"summon",duration:action.duration,effect}),skill);
      if (source.companionFusion) syncCompanionFusionStats(source);
    }
  }
  publishBattleEvents([{type:"summon_command",source,target,skill,reason:COMPANION_COMMAND_LABELS[mode]}]);
  return true;
}

function getTauntTarget(unit) {
  const effect=(unit?.activeEffects ?? []).find(effect=>effect.kind === "state" && effect.state === "taunt");
  if (!effect) return null;
  return [...playerSquad,...enemySquad].find(target=>target.effectCasterId === effect.casterId && target.alive && isUnitBattleTargetable(target) && !(target.suspendedTicks>0) && !(target.activeEffects ?? []).some(effect=>["stealth","disguise"].includes(effect.mode))) ?? null;
}

function getLifeCycleForm(unit) {
  return (unit?.activeEffects ?? []).find(effect=>effect.kind === "transform" && effect.lifeCycle);
}

function isUnitBattleTargetable(unit) {
  return !unit?.fusedInto && unit?.targetable !== false && !getUnitBattleForm(unit)?.untargetable;
}

function getLethalTransformationPassive(unit) {
  return resolveSelectedSkillIds(unit?.skillIds,unit?.skillSelections).map(getSkillById)
    .find(skill=>skill?.slot === "passive" && skill.passiveTrigger?.lethalTransformation && !isUnitSkillDisabled(unit,skill));
}

function getFormSkill(unit,skill) {
  if (skill?.summonVariant && (skill.summonVariant.companion ? !unit.companionFusion && hasDeadCompanion(unit) : !getLivingOwnedSummons(unit,skill.summonVariant.entityId).length)) {
    const replacement=getSkillById(skill.summonVariant.absentSkillId);
    if (replacement) return {...replacement,internal:false};
  }
  const row=getUnitBattleForm(unit)?.skillReplacements?.find(row=>row.skillId === skill?.id);
  const replacement=row && getSkillById(row.replacementSkillId);
  return replacement ? {...replacement,id:skill.id,formVariantId:replacement.id,internal:false} : skill;
}

function getLifeCycleFormLabel(unit) {
  const fusion=unit?.companionFusion;
  if (fusion) return `${fusion.effect.name} · ${fusion.effect.remainingTicks === null ? "상시 유지" : `${(fusion.effect.remainingTicks/BASE_ATTACK_COOLDOWN).toFixed(1)}초`}`;
  const form=getLifeCycleForm(unit);
  if (form) return `${form.name} · 육신 복귀 ${(Math.max(0,form.remainingTicks)/BASE_ATTACK_COOLDOWN).toFixed(1)}초`;
  return getLethalTransformationPassive(unit)?.passiveTrigger.lethalTransformation.bodyName || "";
}

function tryEnterLethalTransformation(unit,context={}) {
  if (getLifeCycleForm(unit)) {unit.hp=0;return true;}
  const passive=getLethalTransformationPassive(unit);
  if (!unit.alive || !passive || unit.isSummon) return false;
  const config=passive.passiveTrigger.lethalTransformation;
  interruptBattleCast(unit,"형태 전환");
  for (const state of unit.weaponAttackStates ?? []) {state.castTimer=0;state.target=null;}
  unit.hp=0;unit.alive=true;unit.vx=unit.vy=0;unit.isMoving=false;
  applyTransformation(unit,unit,{duration:config.duration,transform:config.transform},{...passive,triggered:true});
  const form=getUnitBattleForm(unit);
  if (form) {form.lifeCycle=true;form.dispellable=false;}
  unit.hp=0;
  return Boolean(form);
}

function canDirectlyTarget(source,target) {
  if (target.fusedInto) return false;
  const taunt=source.side !== target.side && getTauntTarget(source);
  if (taunt && target!==taunt) return false;
  return source.side === target.side || (isUnitBattleTargetable(target) && !(target.suspendedTicks>0)
    && !(target.activeEffects ?? []).some(effect=>effect.kind === "buff" && ["disguise","stealth"].includes(effect.mode)));
}

function processStateDamage(source,target,action,actual) {
  if (!(actual>0) || !target.alive) return;
  const direct=!action.periodic && !action.reflected && !action.countered && source.side !== target.side;
  const modifiers=direct ? getPassiveAttackStateModifiers(source) : {extension:0,preserveSleep:false};
  const removed=new Set();
  for (const effect of target.activeEffects ?? []) {
    if (effect.kind !== "state" || effect.polarity !== "harmful") continue;
    if (!(effect.state === "sleep" && modifiers.preserveSleep) && effect.breakDamagePercent>0) {
      effect.damageTaken=(effect.damageTaken ?? 0)+actual;
      if (effect.damageTaken >= effect.breakDamageThreshold) {removed.add(effect);continue;}
    }
    if (modifiers.extension>0 && Number.isFinite(effect.remainingTicks)) effect.remainingTicks+=Math.ceil(modifiers.extension*BASE_ATTACK_COOLDOWN);
  }
  if (removed.size) {target.activeEffects=target.activeEffects.filter(effect=>!removed.has(effect));recalculateBattleBuffs(target);}
}

function getUnitPassiveConversions(unit) {
  const ids=resolveSelectedSkillIds(unit?.skillIds,unit?.skillSelections);
  return ids.map(getSkillById).find(skill=>skill?.slot === "passive" && skill.passiveConversions)?.passiveConversions ?? null;
}

function restorePassiveStatConversion(unit) {
  const state=unit.passiveStatConversionState;
  if (!state) return;
  unit[state.source]=state.sourceValue;
  unit[state.target]=state.targetValue;
  unit.passiveStatConversionState=null;
}

function applyPassiveStatConversion(unit) {
  const conversions=getUnitPassiveConversions(unit);
  const rule=conversions?.stat;
  unit.adaptiveOffenseOverride=conversions?.adaptiveOffense || "";
  if (!rule || rule.source === rule.target) return;
  const sourceValue=Math.max(0,Number(unit[rule.source]) || 0);
  const targetValue=Math.max(0,Number(unit[rule.target]) || 0);
  unit.passiveStatConversionState={source:rule.source,target:rule.target,sourceValue,targetValue};
  unit[rule.target]=targetValue+sourceValue*rule.percent/100;
  if (rule.consumeSource) unit[rule.source]=0;
}

function applyPassiveResourceConversion(unit,{resetCurrent=false}={}) {
  const rule=getUnitPassiveConversions(unit)?.resource;
  if (!rule || rule.source === rule.target) return;
  const sourceField=getResourceField(rule.source),targetField=getResourceField(rule.target);
  if (!sourceField || !targetField) return;
  const sourceMax=sourceField.max,targetMax=targetField.max;
  const rawSourceMax=Math.max(0,Number(unit[sourceMax]) || 0);
  const rawTargetMax=Math.max(0,Number(unit[targetMax]) || 0);
  unit.passiveResourceConversionState={sourceMax,targetMax,sourceValue:rawSourceMax,targetValue:rawTargetMax};
  unit[targetMax]=rawTargetMax+rawSourceMax*rule.percent/100;
  if (rule.consumeSource) unit[sourceMax]=0;
  if (resetCurrent) {
    unit[targetField.current]=unit[targetMax];
    if (rule.consumeSource) unit[sourceField.current]=0;
  } else {
    unit[targetField.current]=Math.min(unit[targetMax],Math.max(0,Number(unit[targetField.current]) || 0));
    if (rule.consumeSource) unit[sourceField.current]=0;
  }
}

function restorePassiveResourceConversion(unit) {
  const state=unit.passiveResourceConversionState;
  if (!state) return;
  unit[state.sourceMax]=state.sourceValue;
  unit[state.targetMax]=state.targetValue;
  unit.passiveResourceConversionState=null;
}

// Use the same stepped stack calculation for combat and attribute bonuses.
function getEffectStackBonuses(effect) {
  return (effect.stackBonuses ?? []).filter(bonus=>effect.stacks>=bonus.minStacks).map(bonus=>({...bonus,
    stacks:bonus.perNStacks>0 ? Math.floor(effect.stacks/bonus.perNStacks) : bonus.perStack ? effect.stacks : 1}));
}

function applyIncomingDamageLinks(unit,amount,action) {
  if (amount>0) for (const effect of unit.activeEffects ?? []) if (effect.mode === "damage_recovery") effect.storedDamage=(effect.storedDamage || 0)+amount;
  if (!(amount>0) || action.damageLinked || unit.effectCasterId == null) return;
  applyMarkedLinkDamage(unit,amount);
  for (const target of [...playerSquad,...enemySquad]) {
    if (!target.alive || target.side === unit.side) continue;
    for(const effect of (target.activeEffects ?? []).filter(effect=>effect.mode === "damage_link" && effect.casterId === unit.effectCasterId)) {
      const base=getSkillById(effect.skillId);
      applyActionDamage(unit,target,{type:"deal_damage",target:"enemy",damageType:"fixed",settledDamage:true,damageLinked:true,coefficients:[{type:"fixed",value:amount*effect.value/100}]},{id:effect.skillId,name:effect.name,slot:base?.slot ?? "passive",triggered:true});
    }
  }
}

function getTimedBarriers(unit) {
  return (unit?.activeEffects ?? []).filter(effect=>effect.kind === "buff" && effect.mode === "barrier" && effect.shieldRemaining>0);
}

function getUnitBarrierValue(unit) {
  return Math.max(0,Number(unit?.bp) || 0)+getTimedBarriers(unit).reduce((sum,effect)=>sum+effect.shieldRemaining,0);
}

function getUnitBarrierMax(unit) {
  return Math.max(0,Number(unit?.maxBp) || 0)+getTimedBarriers(unit).reduce((sum,effect)=>sum+effect.shieldInitial,0);
}

function applyBarrierBreakReaction(defender,attacker,action,effects) {
  if (!defender?.alive || !attacker || attacker.side === defender.side || action.reflected) return;
  for (const effect of effects) {
    if (effect.breakRecreatePercent>0 && effect.shieldRemaining<=0 && (effect.remainingTicks === null || effect.remainingTicks>0)) {
      const caster=[...playerSquad,...enemySquad].find(unit=>unit.effectCasterId === effect.casterId);
      if (caster) {
        publishBattleEvents([{type:"barrier_break",source:defender,target:defender,skill:getSkillById(effect.skillId),reason:"내면의 보호막"}]);
        applyTimedEffectAction(caster,defender,{type:"add_buff",duration:effect.remainingTicks === null ? 0 : effect.remainingTicks/BASE_ATTACK_COOLDOWN,
          effect:{...effect,barrierMode:"fixed",value:effect.shieldInitial*effect.breakRecreatePercent/100,breakRecreatePercent:0,refundMpOnExpire:false}},
          {id:effect.skillId,name:effect.name,triggered:true});
      }
    }
    const reaction=getSkillById(effect.breakSkillId);
    if (!reaction || !isSkillExecutable(reaction) || isUnitSkillDisabled(defender,reaction)) continue;
    publishBattleEvents([{type:"barrier_break",source:defender,target:attacker,skill:reaction,reason:effect.name}]);
    applySkill(defender,attacker,{...reaction,triggered:true});
  }
}

function updateAttributeBuffs(unit,restoreOnly=false) {
  const applyDelta=(delta,sign)=>{
    for (const [key,amount] of Object.entries(delta)) {
      const field={hp:"maxHp",mp:"maxMp",st:"maxSt",bp:"maxBp"}[key] ?? key;
      const base=unit.effectBaseStats?.[field];
      if (base) {base.value+=sign*amount;base.original=(Number(base.original) || 0)+sign*amount;}
      else unit[field]=(Number(unit[field]) || 0)+sign*amount;
    }
  };
  if (unit.attributeBuffState) {
    applyDelta(unit.attributeBuffState.delta,-1);unit.attributes=unit.attributeBuffState.base;
    unit.attributeBuffState=null;
  }
  if (restoreOnly) return;
  const effects=[...(unit.activeEffects ?? []),...getSelectedOptionalStatEffects(unit)].flatMap(effect=>effect.kind === "buff" ? [effect,...getEffectStackBonuses(effect)] : [])
    .filter(effect=>effect.mode === "attribute" && ["str","int"].includes(effect.stat));
  if (!effects.length) {
    unit.hp=Math.min(unit.hp,unit.maxHp);unit.mp=Math.min(unit.mp,unit.maxMp);unit.st=Math.min(unit.st,unit.maxSt);return;
  }
  const base={...(unit.attributes ?? {})},next={...base};
  for (const effect of effects) next[effect.stat]=Math.max(0,(Number(next[effect.stat]) || 0)+effect.value*(effect.stacks ?? 1));
  const before=getStatAbilityBonus(base),after=getStatAbilityBonus(next);
  const delta=Object.fromEntries(Object.keys(after).map(key=>[key,after[key]-before[key]]).filter(([,value])=>value));
  applyDelta(delta,1);unit.attributes=next;unit.attributeBuffState={base,delta};
  unit.hp=Math.min(unit.hp,unit.maxHp);unit.mp=Math.min(unit.mp,unit.maxMp);unit.st=Math.min(unit.st,unit.maxSt);
}

function getSummonFocusTarget(unit) {
  const pending=unit.pendingAction?.target;
  const target=pending?.side !== unit.side && pending?.alive ? pending : unit.combatFocusTarget;
  return target?.alive && canDirectlyTarget(unit,target) && distance(unit,target)<=getUnitRange(unit)
    && !unit.removed && !(unit.suspendedTicks>0) && !["stun","disarm","flee","charm"].some(state=>hasBattleState(unit,state)) ? target : null;
}

function getSummonSynergyEffects(unit) {
  if (!unit?.alive) return [];
  const effects=[];
  for (const skill of resolveSelectedSkillIds(unit.skillIds,unit.skillSelections).map(getSkillById).filter(skill=>skill?.ownedSummonAura && !isUnitSkillDisabled(unit,skill))) {
    const config=skill.ownedSummonAura;
    const count=getLivingOwnedSummons(unit).filter(summon=>(!config.entityIds.length || config.entityIds.includes(summon.entityId))
      && !summon.removed && distance(unit,summon)<=config.radius*ATTACK_RANGE_UNIT).length;
    for (const [stat,mode,value] of [["atk","percent",config.attackPercent],["defense","flat",config.defense],["resistance","flat",config.resistance]])
      if (count && value) effects.push({kind:"buff",stat,mode,value:value*count,stacks:1});
  }
  if (unit.isSummon && unit.summonFocusAttackPercent>0) {
    const target=getSummonFocusTarget(unit);
    const count=target ? getLivingOwnedSummons(unit.owner ?? unit.summoner).filter(summon=>getSummonFocusTarget(summon)===target).length : 0;
    if (count>=2) effects.push({kind:"buff",stat:"atk",mode:"percent",value:count*unit.summonFocusAttackPercent,stacks:1});
  }
  return effects;
}

function updateSummonSynergies() {
  for (const unit of [...playerSquad,...enemySquad]) {
    if (!unit.summonFocusAttackPercent && !(unit.skillIds ?? []).some(id=>getSkillById(id)?.ownedSummonAura) && !unit.summonSynergySignature) continue;
    const signature=JSON.stringify(getSummonSynergyEffects(unit));
    if (unit.summonSynergySignature===signature) continue;
    unit.summonSynergySignature=signature;
    recalculateBattleBuffs(unit);
  }
}

function getSelectedOptionalStatEffects(unit) {
  return limitOptionalSkillIds(unit?.skillIds).map(getSkillById).filter(skill=>skill?.slot === "optional" && !isUnitSkillDisabled(unit,skill))
    .flatMap(skill=>(skill.selectionModifier?.statEffects ?? []).filter(effect=>(!effect.requiredWeaponCount || (unit.weaponAttacks ?? []).length>=effect.requiredWeaponCount) && (!effect.requiredWeaponCategory ||
      (unit.weaponAttacks ?? []).some(weapon=>weapon.weaponCategory === effect.requiredWeaponCategory)))
      .map(effect=>({...effect,kind:"buff",stacks:effect.countChoiceSkillId ? getSelectedSummonCount(unit,effect.countChoiceSkillId) : 1})));
}

function recalculateBattleBuffs(unit) {
  if (unit.companionUnscaledAttack != null) unit.atk=unit.companionUnscaledAttack;
  unit.activeEffects=(unit.activeEffects ?? []).filter(effect=>!effect.linkedEffectId || unit.activeEffects.some(parent=>parent.id === effect.linkedEffectId && parent.casterId === effect.casterId));
  restorePassiveStatConversion(unit);
  updateAttributeBuffs(unit);
  const previousMaxHp=Math.max(0,Number(unit.maxHp) || 0);
  const previousMaxMp=Math.max(0,Number(unit.maxMp) || 0);
  unit.effectBaseStats ??= {};
  const buffs = [...(unit.activeEffects ?? []), ...getSelectedOptionalStatEffects(unit), ...getSummonSynergyEffects(unit), ...getBattleFieldAuraEffects(unit)].flatMap(effect => {
    if (effect.kind === "state" && effect.movementSpeedPercent != null && effect.movementSpeedPercent !== 100)
      return [{stat:"speed",value:effect.movementSpeedPercent-100,mode:"percent",stacks:effect.stacks ?? 1}];
    if(effect.kind === "buff" && ["flat","percent","override","convert","attack_rate_percent","cast_time_percent","attribute"].includes(effect.mode)) {
      if (effect.requiredOwnedSummonEntityId) {
        const caster=[...playerSquad,...enemySquad].find(candidate=>candidate.effectCasterId === effect.casterId);
        if (!caster || Boolean(getLivingOwnedSummons(caster,effect.requiredOwnedSummonEntityId).length) === effect.requiredOwnedSummonAbsent) return [];
      }
      if (effect.stat === "shieldDefense" && effect.mode === "percent") {
        const base=unit.effectBaseStats?.shieldDefense?.value ?? (Number(unit.shieldDefense) || 0);
        return [effect,{...effect,stat:"defense",mode:"flat",value:base*effect.value/100},...getEffectStackBonuses(effect)];
      }
      return [effect,...getEffectStackBonuses(effect)];
    }
    if(effect.kind === "transform") return [
      ...Object.entries(effect.modifiers ?? {}).filter(([,value])=>Number(value)!==0).map(([stat,value])=>({stat,value:Number(value),mode:effect.mode,stacks:1})),
      ...(effect.companionFusion ? [{stat:"speed",mode:"override",value:effect.companionSpeed,stacks:1},{stat:"attackSpeed",mode:"override",value:effect.companionAttackSpeed,stacks:1}] : [])];
    return [];
  });
  unit.effectAttackRateMultiplier=Math.max(.1,1+buffs.filter(effect=>effect.stat === "attackSpeed" && effect.mode === "attack_rate_percent")
    .reduce((sum,effect)=>sum+effect.stacks*effect.value,0)/100);
  unit.effectCastTimeAdd=(unit.activeEffects ?? []).filter(effect=>effect.kind === "transform").reduce((sum,effect)=>sum+(effect.castTimeAdd || 0),0)
    + [...(unit.activeEffects ?? []),...getSelectedOptionalStatEffects(unit)].filter(effect=>effect.mode === "cast_time_flat").reduce((sum,effect)=>sum+effect.value*(effect.stacks ?? 1),0);
  unit.effectCastTimeMultiplier=Math.max(0,1+buffs.filter(effect=>effect.stat === "castSpeed" && effect.mode === "cast_time_percent")
    .reduce((sum,effect)=>sum+effect.stacks*effect.value,0)/100);
  for (const buff of buffs) {
    if (["cast_time_percent","attribute"].includes(buff.mode)) continue;
    if (!Object.hasOwn(unit.effectBaseStats,buff.stat)) {
      const fallback = buff.stat === "speed" ? (typeof ROLE_STATS !== "undefined" ? ROLE_STATS[unit.role]?.speedMultiplier : null) ?? 1
        : ["attackSpeed", "attackRange"].includes(buff.stat) ? 1 : 0;
      unit.effectBaseStats[buff.stat] = {original:unit[buff.stat], value:Number(unit[buff.stat] ?? fallback)};
    }
  }
  for (const [stat, base] of Object.entries(unit.effectBaseStats)) {
    const current = buffs.filter(effect => effect.stat === stat && !["cast_time_percent","attribute"].includes(effect.mode));
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
    const value=override ? override.value : (base.value + delta)/(stat === "attackSpeed" ? unit.effectAttackRateMultiplier : 1);
    unit[stat] = Math.max(stat === "attackSpeed" ? 0.1 : stat === "attackRange" ? 1 : 0,value);
  }
  if (unit.maxHp !== previousMaxHp) unit.hp=unit.maxHp > previousMaxHp
    ? Math.min(unit.maxHp,Math.max(0,Number(unit.hp) || 0)+(unit.maxHp-previousMaxHp))
    : Math.min(Math.max(0,Number(unit.hp) || 0),unit.maxHp);
  if (unit.maxMp !== previousMaxMp) unit.mp=Math.min(unit.maxMp,Math.max(0,Number(unit.mp) || 0)+Math.max(0,unit.maxMp-previousMaxMp));
  applyPassiveStatConversion(unit);
  if (unit.companionAttackMultiplier != null) {
    unit.companionUnscaledAttack=unit.atk;
    unit.atk*=unit.companionAttackMultiplier;
  }
  if (unit.lockedMovementSpeed != null) unit.speed=Math.min(Number(unit.speed) || 0,unit.lockedMovementSpeed);
  if (getLifeCycleForm(unit)) unit.hp=0;
}

function clearBattleEffects(unit) {
  endCompanionFusion(unit,{dead:!unit.alive,reset:true});
  clearBattleChannel(unit);
  unit.weaponFlower=null;unit.weaponDeployment=null;unit.delayedEffectRepeats=[];
  unit.activeEffects = [];
  recalculateBattleBuffs(unit);
}

function interruptCombatCasting(unit,reason) {
  interruptBattleCast(unit,reason);
  for (const state of unit.weaponAttackStates ?? []) if (state.castTimer>0) {
    state.castTimer=0;state.target=null;state.preparedAttackSkill=null;
    publishBattleEvents([{type:"cast_interrupt",source:unit,target:unit,reason}]);
  }
}

function interruptBattleCast(unit, reason = "상태 효과") {
  if (unit.channelAction) finishBattleChannel(unit,reason);
  const pending = unit.pendingAction;
  if (!pending) return;
  if (pending.type === "skill") {
    if (pending.skill.consecutiveUses>1 && unit.skillConsecutiveUses) unit.skillConsecutiveUses[pending.skill.id]=0;
    unit.skillCooldowns ??= {};
    unit.skillCooldowns[pending.skill.id] = pending.skill?.runtimeCombo
      ? getComboStepCooldownTicks(pending.skill,unit,pending.skillModifier)
      : getModifiedSkillCooldownTicks(pending.skill,unit,pending.skillModifier);
    unit.skillCooldownTotals ??= {};
    unit.skillCooldownTotals[pending.skill.id] = unit.skillCooldowns[pending.skill.id];
  } else unit.attackCooldown = getAttackCooldown(unit);
  unit.pendingAction = null;unit.castTimer=0;unit.castDuration=0;
  publishBattleEvents([{type:"cast_interrupt",source:unit,target:pending.target,skill:pending.skill,reason}]);
}

function matchesEffectDispel(instance, action) {
  const kind = action.type === "delete_state" ? "state" : "buff";
  const config = action.effect;
  if (!(config.dispelKinds?.length ? config.dispelKinds.includes(instance.kind) : instance.kind === kind) || instance.dispellable === false) return false;
  const polarity = instance.polarity ?? (instance.kind === "state" ? "harmful" : "beneficial");
  if (config.dispelPolarity && config.dispelPolarity !== "any" && config.dispelPolarity !== polarity) return false;
  const mode = config.dispelMode ?? "id";
  if (mode === "all") return true;
  if (mode === "category") return (instance.category ?? "general") === (config.dispelCategory ?? "general");
  if (mode === "tags") {
    const tags=new Set(instance.tags ?? []);
    return (config.dispelTags ?? []).some(tag=>tags.has(tag));
  }
  return instance.id === config.id;
}

function blocksEffectApplication(target, source, config, kind) {
  return [...(target.activeEffects ?? []),...getSelectedOptionalStatEffects(target)].some(instance => {
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

function getProjectedPeriodicDamage(source,target,action,config,stacks=1) {
  const coefficient=config.periodic.coefficient ?? {type:"fixed",value:config.periodic.value};
  const pulses=Math.floor(Math.max(0,action.duration)*BASE_ATTACK_COOLDOWN/Math.max(1,Math.ceil(config.periodic.interval*BASE_ATTACK_COOLDOWN)));
  const raw=getCoefficientValue(coefficient,source,target)*pulses*stacks*getUnitTeamBattleRules(source).damagePercent/100*getPassiveTargetDamageMultiplierPercent(source,target,{periodic:true})/100;
  return getReducedDamage(source,target,config.periodic.damageType,raw*getUnitIncomingRulePercent(target,"receivedDamagePercent")/100);
}

function applyTimedEffectAction(source,target,action,skill,execution=null) {
  if (action.periodicCopies>1 && !action.type.startsWith("delete_") && action.effect?.periodic?.type === "damage") {
    let first=null,total=0;
    for(let i=0;i<action.periodicCopies;i++) {
      const copy={...action,periodicCopies:1,_suppressDamagePool:true,effect:{...action.effect,
        id:i ? `${action.effect.id}__copy_${i+1}` : action.effect.id,name:i ? `${action.effect.name} · 복제 ${i}` : action.effect.name}};
      const applied=applyTimedEffectAction(source,target,copy,skill,execution);
      if (applied) {first ??= applied;total+=getProjectedPeriodicDamage(source,target,copy,applied,applied.stacks);}
    }
    recordSkillDamagePool(source,target,action,skill,total);
    return first;
  }
  const kind = action.type.endsWith("state") ? "state" : "buff";
  target.activeEffects ??= [];
  let config = normalizeSkillEffect(action.effect,action.type);
  if (action.type.startsWith("delete_")) {
    const removed=target.activeEffects.filter(effect => matchesEffectDispel(effect,action)).slice(0,config.dispelLimit || Infinity);
    target.activeEffects = target.activeEffects.filter(effect => !removed.includes(effect));
    recalculateBattleBuffs(target);
    if (removed.length) {
      const scope=config.dispelMode === "id" ? config.id : config.dispelMode === "category" ? EFFECT_CATEGORY_LABELS[config.dispelCategory] : config.dispelMode === "tags" ? config.dispelTags.join(", ") : "전체";
      publishBattleEvents(removed.map(effect=>({type:"dispel",source,target,skill,amount:1,reason:effect.name ?? effect.id})));
    }
    return removed.length;
  }
  if (kind === "state" && config.polarity === "harmful") {
    const transferTarget=[...playerSquad,...enemySquad]
      .filter(unit=>unit.alive && unit.isSummon && unit.summoner === target
        && (unit.transferStateScope === "all" || unit.transferStateScope === config.category))
      .sort((a,b)=>a.transferStatePriority-b.transferStatePriority)[0];
    if (transferTarget) {
      target=transferTarget;
    }
  }
  target.activeEffects ??= [];
  source.effectCasterId ??= nextEffectCasterId++;
  if (kind === "buff" && config.stat === "adaptiveOffense") {
    const resolvedStat=target.adaptiveOffenseOverride || ((Number(target.magic) || 0) > (Number(target.atk) || 0) ? "magic" : "atk");
    config={...config,stat:resolvedStat,adaptiveStat:"adaptiveOffense"};
  }
  if (blocksEffectApplication(target,source,config,kind)) {
    return;
  }
  if (kind === "state" && config.hitThreshold>1) {
    target.effectHitCounts ??= {};
    const key=`${source.effectCasterId}:${config.id}`;
    target.effectHitCounts[key]=Math.min(config.hitThreshold,(target.effectHitCounts[key] ?? 0)+1);
    if (target.effectHitCounts[key]<config.hitThreshold) return;
  }
  const reservedWeapons=config.weaponReserveCount>0 ? getAvailableControlledWeapons(target).slice(0,config.weaponReserveCount) : [];
  if (config.weaponReserveCount>reservedWeapons.length) return;
  const existingAny = target.activeEffects.find(effect => effect.kind === kind && effect.id === config.id);
  if (config.stackMode === "reject" && existingAny) return;
  const existing = target.activeEffects.find(effect => effect.kind === kind && effect.id === config.id && effect.casterId === source.effectCasterId);
  const stacks = config.stackMode === "stack" ? Math.min(config.maxStacks,(existing?.stacks ?? 0)+1) : 1;
  const sourceBase=(target.effectBaseStats?.[config.sourceStat]?.value ?? Number(target[config.sourceStat])) || 0;
  const periodicCoefficient=config.periodic?.coefficient;
  const periodicSourceBase=periodicCoefficient?.type === "calculated" ? getCoefficientBaseValue(periodicCoefficient,source,target) : 0;
  const instance = {...config,periodic:config.periodic,periodicSourceBase,periodicElapsedTicks:0,immunity:config.immunity,kind,stacks,casterId:source.effectCasterId,casterName:source.name,
    reservedWeaponSlots:reservedWeapons.map(state=>state.weapon.slot),weaponsReleased:false,
    storedDamage:0,
    damageTaken:0,breakDamageThreshold:Math.max(0,Number(target.maxHp) || 0)*config.breakDamagePercent/100,
    ...(config.mode === "convert" ? {conversionBase:sourceBase} : {}),
    refundMp:config.refundMpOnExpire ? Math.max(0,Number(execution?.resourceSpent?.MP) || 0) : 0,
    skillId:skill?.id,triggered:Boolean(skill?.triggered),remainingTicks:action.duration > 0 ? Math.max(1,Math.ceil(action.duration * BASE_ATTACK_COOLDOWN)) : null,
    usesRemaining:config.mode === "next_skill_modifier" ? 1 : config.uses > 0 ? config.uses : null,
    movementStartDistance:Number(target.moveDistanceTotal) || 0,movementTriggerConsumed:false,
    nextPeriodicTick:config.periodic ? (existing?.periodic?.interval === config.periodic.interval ? existing.nextPeriodicTick : null) ?? Math.max(1,Math.ceil(config.periodic.interval * BASE_ATTACK_COOLDOWN)) : null};
  if (config.mode === "heal_absorb") instance.absorbRemaining=(existing?.absorbRemaining ?? 0)+config.value;
  if (config.mode === "attached_guard") {instance.guardInitial=config.value;instance.guardRemaining=config.value;instance.guardRemainingHits=config.guardHits;}
  if (config.mode === "barrier" && config.linkedEffectId && !target.activeEffects.some(effect=>effect.id === config.linkedEffectId && effect.casterId === source.effectCasterId)) return;
  if (config.mode === "barrier") {
    instance.shieldInitial=config.barrierMode === "coefficient" ? Math.max(0,getActionCoefficientValue(action,source,target,execution)) : config.barrierMode === "fixed" ? config.value : Math.max(0,Number(target.maxHp) || 0)*config.value/100;
    instance.shieldRemaining=instance.shieldInitial;
  }
  if (existing) Object.assign(existing,instance);
  else target.activeEffects.push(instance);
  if (config.mode === "disguise") {
    const enemies=getActiveBattleEntities(target.side === "enemy" ? playerSquad : enemySquad);
    instance.disguisePortrait=enemies.sort((a,b)=>distance(target,a)-distance(target,b))[0]?.portrait ?? "";
    if (existing) existing.disguisePortrait=instance.disguisePortrait;
  }
  for (const state of reservedWeapons) {state.castTimer=0;state.target=null;state.preparedAttackSkill=null;}
  recalculateBattleBuffs(target);
  if (config.periodic?.type === "damage" && !action._suppressDamagePool && !skill?.triggered && skill?.slot === "active") {
    recordSkillDamagePool(source,target,action,skill,getProjectedPeriodicDamage(source,target,action,config,stacks));
  }
  if (kind === "state" && ["disarm","polymorph","flee","sleep","charm"].includes(config.state)) {
    for (const state of target.weaponAttackStates ?? []) {state.castTimer=0;state.target=null;}
  }
  if (kind === "state" && (["stun","polymorph","flee","sleep","charm"].includes(config.state)
    || (config.state === "disarm" && (target.pendingAction?.type === "attack" || target.weaponAttackStates?.some(state=>state.castTimer>0)))
    || (config.state === "silence" && (target.pendingAction?.type === "skill" || target.channelAction?.type === "skill")))) interruptBattleCast(target,config.name);
  return existing ?? instance;
}

// Reactions use the existing action executor and cannot recursively react to reactions.
function applyMeleeReaction(defender, attacker, action, skill, effects) {
  if (!defender?.alive || !attacker?.alive || action.periodic || action.reflected || action.countered || skill?.triggered
    || getActionRangePixels(attacker,action) > ATTACK_RANGE_UNIT) return;
  for (const effect of effects) {
    if (!defender.alive || !attacker.alive || !defender.activeEffects?.includes(effect)) continue;
    const reaction=getSkillById(effect.reactionSkillId);
    if (!reaction || !isSkillExecutable(reaction) || isUnitSkillDisabled(defender,reaction)) continue;
    const remaining=(effect.remainingTicks ?? 0)/BASE_ATTACK_COOLDOWN;
    if (effect.reactionOnce) {defender.activeEffects=defender.activeEffects.filter(candidate=>candidate!==effect);recalculateBattleBuffs(defender);}
    const runtime=getRuntimeSelectionSkill(defender,getRuntimeItemSkill(defender,reaction));
    applySkill(defender,attacker,{...runtime,triggered:true,actions:runtime.actions.map(action=>effect.reactionInheritRemaining && action.duration>0 ? {...action,duration:remaining} : action)});
  }
}

function applyPeriodicEffect(target,effect) {
  const source = [...playerSquad,...enemySquad].find(unit => unit.effectCasterId === effect.casterId);
  if (!source || !target.alive) return;
  const periodic = effect.periodic;
  const coefficient=periodic.coefficient ?? {type:"fixed",value:periodic.value};
  const growthTicks=periodic.growthInterval > 0 ? periodic.growthInterval * BASE_ATTACK_COOLDOWN : 0;
  const growthSteps=growthTicks > 0 ? Math.floor((effect.periodicElapsedTicks ?? 0)/growthTicks) : 0;
  const inputValue=Number(coefficient.value) + growthSteps * (Number(periodic.growthValue) || 0);
  const base=Number(effect.periodicSourceBase) || 0;
  const amount=(coefficient.type === "fixed" ? inputValue : coefficient.calc === "percent" ? base*inputValue/100 : base+inputValue) * effect.stacks;
  const action = {coefficients:[{type:"fixed",value:amount}],damageType:periodic.damageType,healResource:periodic.resource,periodic:true};
  const skill = {id:effect.skillId,name:`${effect.name} (주기)`,triggered:effect.triggered};
  if (periodic.type === "interrupt") {
    interruptBattleCast(target,effect.name);
    for(const state of target.weaponAttackStates ?? []) if(state.castTimer>0) {
      state.castTimer=0;state.target=null;
      publishBattleEvents([{type:"cast_interrupt",source:target,target,skill,reason:effect.name}]);
    }
  } else if (periodic.type === "damage") applyActionDamage(source,target,action,skill);
  else applyActionHeal(source,target,action,skill);
  for (const drain of periodic.resourceDrains ?? []) {
    applyActionResourceDrain(source,target,{type:"drain_resource",drainResource:drain.resource,coefficients:[{type:"fixed",value:drain.value*effect.stacks}],periodic:true},skill);
  }
}

function applyTransformation(source,target,action,skill) {
  if(!target?.alive || getLifeCycleForm(target)) return;
  const transform=normalizeTransformation(action.transform);
  const removed=(target.activeEffects ?? []).filter(effect=>effect.kind === "transform");
  target.activeEffects=(target.activeEffects ?? []).filter(effect=>effect.kind !== "transform");
  recalculateBattleBuffs(target);
  const instance={...transform,kind:"transform",id:transform.id,name:transform.name,mode:transform.mode,modifiers:transform.modifiers,
    skillIds:transform.skillIds,attackSkillId:transform.attackSkillId,receivedDamagePercent:transform.receivedDamagePercent,
    castTimeAdd:transform.castTimeAdd,periodicHealPercent:transform.periodicHealPercent,regenTicks:BASE_ATTACK_COOLDOWN,
    distanceDamageMinRange:transform.distanceDamageMinRange,distanceDamagePercent:transform.distanceDamagePercent,
    damageExitStun:transform.damageExitStun,immobile:transform.immobile,exitHpBelow:transform.exitHpBelow,retreatHpBelow:transform.retreatHpBelow,stacks:1,
    remainingTicks:action.duration>0 ? Math.max(1,Math.ceil(action.duration*BASE_ATTACK_COOLDOWN)) : null,usesRemaining:null,skillId:skill?.id};
  target.activeEffects.push(instance);
  recalculateBattleBuffs(target);
  publishBattleEvents([...removed.map(effect=>({type:"transform_end",source:target,target,skill,reason:`${effect.name} 교체`})),{type:"transform_start",source,target,skill,reason:transform.name}]);
}

function breakAttackConcealment(unit,skill,atStart=false) {
  if (!skill || skill.triggered || !(atStart ? isOffensiveSkill(skill) : skill.actions?.some(action=>action.type === "deal_damage"))) return;
  const previous=unit.activeEffects ?? [];
  unit.activeEffects=previous.filter(effect=>!effect.breakOnAttack);
  if (previous.length !== unit.activeEffects.length) recalculateBattleBuffs(unit);
}

function processTransformationDamage(unit,actual) {
  if (!(actual>0) || !unit.alive) return;
  const effects=(unit.activeEffects ?? []).filter(effect=>effect.kind === "transform" && effect.damageExitStun>0);
  if (!effects.length) return;
  unit.activeEffects=unit.activeEffects.filter(effect=>!effects.includes(effect));
  recalculateBattleBuffs(unit);
  for (const effect of effects) {
    publishBattleEvents([{type:"transform_end",source:unit,target:unit,skill:{id:effect.skillId,name:effect.name},reason:"피해로 해제"}]);
    applyTimedEffectAction(unit,unit,{type:"add_state",duration:effect.damageExitStun,effect:{id:`${effect.id}_damage_stun`,name:`${effect.name} · 기절`,state:"stun",polarity:"harmful"}},{id:effect.skillId,name:effect.name});
  }
}

function updateProximityPassives(unit) {
  if (!unit.alive || unit.isWaiting || unit.isReserve) return;
  const skills=resolveSelectedSkillIds(unit.skillIds,unit.skillSelections).map(getSkillById)
    .filter(skill=>skill?.slot === "passive" && skill.passiveTrigger?.event === "alone" && isSkillExecutable(skill));
  for (const skill of skills) {
    const trigger=skill.passiveTrigger;
    const ids=new Set(skill.actions.map(action=>action.effect?.id).filter(Boolean));
    const active=(unit.activeEffects ?? []).some(effect=>effect.skillId === skill.id && ids.has(effect.id));
    const alone=!isUnitSkillDisabled(unit,skill) && ![...playerSquad,...enemySquad].some(other=>other !== unit && other.alive && !other.isWaiting && !other.isReserve && !(other.suspendedTicks>0) && distance(unit,other)<=trigger.aloneRadius*ATTACK_RANGE_UNIT);
    unit.proximityPassiveActive ??= {};
    if ((!alone && active) || (unit.proximityPassiveActive[skill.id] && !active)) {
      unit.activeEffects=unit.activeEffects.filter(effect=>!(effect.skillId === skill.id && ids.has(effect.id)));
      recalculateBattleBuffs(unit);
      if (trigger.aloneLossDuration>0 && trigger.aloneLossDamagePercent!==100) applySkill(unit,unit,{id:skill.id,name:skill.name,triggered:true,actions:[normalizeSkillAction({type:"override_rule",target:"self",duration:trigger.aloneLossDuration,
        ruleOverride:{id:`${skill.id}_alone_loss`,receivedDamagePercent:trigger.aloneLossDamagePercent}})]});
    }
    if (alone && !active) applySkill(unit,unit,{...skill,triggered:true});
    unit.proximityPassiveActive[skill.id]=alone;
  }
}

// Each caster keeps a separate remaining damage budget on each target.
function recordSkillDamagePool(source,target,action,skill,amount) {
  if (!source?.alive || !target?.alive || source.side === target.side || !(amount>0) || skill?.slot !== "active"
    || skill.triggered || action.periodic || action.reflected || action.countered || action.settledDamage) return;
  const passives=resolveSelectedSkillIds(source.skillIds,source.skillSelections).map(getSkillById)
    .filter(passive=>passive?.slot === "passive" && isSkillExecutable(passive) && !isUnitSkillDisabled(source,passive))
    .map(passive=>getRuntimeSelectionSkill(source,getRuntimeItemSkill(source,passive)));
  for (const passive of passives) for (const poolAction of passive.actions.filter(candidate=>candidate.effect?.mode === "damage_pool")) {
    const config=poolAction.effect;
    const previous=(target.activeEffects ?? []).find(effect=>effect.mode === "damage_pool" && effect.id === config.id && effect.casterId === source.effectCasterId);
    const remaining=previous?.poolRemaining ?? 0;
    applyTimedEffectAction(source,target,poolAction,{...passive,triggered:true});
    const pool=(target.activeEffects ?? []).find(effect=>effect.mode === "damage_pool" && effect.id === config.id && effect.casterId === source.effectCasterId);
    if (!pool) continue;
    pool.poolRemaining=remaining+amount*config.value/100;
    pool.poolPulseTicks=BASE_ATTACK_COOLDOWN;
    if (pool.stacks>=config.maxStacks) {
      target.activeEffects=target.activeEffects.filter(effect=>effect !== pool);
      recalculateBattleBuffs(target);
      dealDamagePool(source,target,pool,pool.poolRemaining,false);
    }
  }
}

function dealDamagePool(source,target,effect,amount,periodic) {
  return applyActionDamage(source,target,{type:"deal_damage",target:"enemy",damageType:"fixed",periodic,settledDamage:true,
    coefficients:[{type:"fixed",value:amount}]},{id:effect.skillId,name:effect.name,slot:"passive",triggered:true});
}

function absorbOtherHealing(source,target,amount) {
  source.effectCasterId ??= nextEffectCasterId++;
  for (const effect of target.activeEffects ?? []) {
    if (effect.mode !== "heal_absorb" || effect.casterId === source.effectCasterId || !(effect.absorbRemaining>0)) continue;
    const absorbed=Math.min(amount,effect.absorbRemaining);
    amount-=absorbed;effect.absorbRemaining-=absorbed;
    if (!(amount>0)) break;
  }
  const effects=target.activeEffects ?? [];
  target.activeEffects=effects.filter(effect=>effect.mode !== "heal_absorb" || effect.absorbRemaining>0);
  if (effects.length !== target.activeEffects.length) recalculateBattleBuffs(target);
  return amount;
}

function recordHealingCurse(source,target,gained) {
  if (!(gained>0) || !target.alive) return;
  const passives=resolveSelectedSkillIds(source.skillIds,source.skillSelections).map(getSkillById)
    .filter(skill=>skill?.slot === "passive" && isSkillExecutable(skill) && !isUnitSkillDisabled(source,skill));
  for (const passive of passives) {
    const duration=Number(passive.passiveTrigger?.healingCurseDuration) || 0;
    if (duration>0) applyTimedEffectAction(source,target,{type:"add_buff",duration,effect:{id:`${passive.id}_heal_curse`,name:"인형의저주",mode:"heal_absorb",value:gained,polarity:"harmful",category:"magic",dispellable:true}},
      {...passive,triggered:true});
  }
}

function applyBasicEcho(attacker,target,action,skill,actual) {
  if (!attacker.alive || !skill || skill.triggered || action.reflected || action.countered) return;
  const buffs=[...(attacker.activeEffects ?? [])].filter(effect=>effect.mode === "basic_echo");
  for (const buff of buffs) {
    const caster=[...playerSquad,...enemySquad].find(unit=>unit.effectCasterId === buff.casterId) ?? attacker;
    const proc={id:buff.skillId,name:buff.name,slot:"passive",triggered:true};
    const extra=target.alive && skill.slot === "basic" && !action.periodic ? applyActionDamage(attacker,target,{type:"deal_damage",target:"enemy",damageType:"fixed",settledDamage:true,
      coefficients:[{type:"fixed",value:actual*buff.value/100}]},proc) : 0;
    if (attacker.alive) applyActionHeal(caster,attacker,{healResource:"HP",coefficients:[{type:"fixed",value:(actual+extra)*buff.echoHealPercent/100}]},proc);
  }
}

function updateDelayedEffectRepeats(unit,previousEntries=null) {
  const ready=[];
  unit.delayedEffectRepeats=(unit.delayedEffectRepeats ?? []).filter(entry=>{if (previousEntries && !previousEntries.includes(entry)) return true;if (--entry.remainingTicks<=0) {ready.push(entry);return false;}return true;});
  for (const entry of ready) {
    const base=getSkillById(entry.skillId);
    if (!unit.alive || !base || isUnitSkillDisabled(unit,base)) continue;
    const skill=getRuntimeSelectionSkill(unit,getRuntimeItemSkill(unit,base));
    const repeated={...skill,name:"홍염",triggered:true,actions:skill.actions.map(action=>({...action,duration:entry.duration,effect:action.effect ? {...action.effect,repeatDelay:0,repeatDuration:0} : action.effect}))};
    applySkill(unit,unit,repeated);
    showSkillBubble(unit,repeated.name,repeated.icon);
    publishBattleEvents([{type:"effect_repeat",source:unit,target:unit,skill:repeated,reason:"종료 후 지연 재적용"}]);
  }
}

function updateBattleEffects() {
  updateSummonSynergies();
  [...playerSquad,...enemySquad].forEach(unit => {
    if (unit.companionFusion) syncCompanionFusionStats(unit);
    if (unit.alive && !unit.isWaiting && !unit.isReserve) unit.undamagedTicks=(unit.undamagedTicks || 0)+1;
    updateRepeatingPassives(unit);
    updateProximityPassives(unit);
    if (!unit.activeEffects?.length) {if (unit.alive) updateDelayedEffectRepeats(unit);else unit.delayedEffectRepeats=[];return;}
    const linkedState=unit.activeEffects.filter(effect=>effect.requiredOwnedSummonEntityId).map(effect=>{
      const caster=[...playerSquad,...enemySquad].find(candidate=>candidate.effectCasterId === effect.casterId);
      return `${effect.id}:${caster && getLivingOwnedSummons(caster,effect.requiredOwnedSummonEntityId).length ? 1 : 0}`;
    }).join("|");
    if (unit.linkedSummonEffectState !== linkedState) {
      unit.linkedSummonEffectState=linkedState;
      recalculateBattleBuffs(unit);
    }
    if (!unit.alive) {clearBattleEffects(unit);return;}
    const previousRepeats=[...(unit.delayedEffectRepeats ?? [])];
    const previousLength = unit.activeEffects.length;
    unit.activeEffects = unit.activeEffects.filter(effect => {
      if (!unit.alive) return false;
      if (effect.kind === "transform" && effect.exitHpBelow > 0 && unit.maxHp > 0 && unit.hp / unit.maxHp * 100 <= effect.exitHpBelow) {
        unit.retreatHpBelow=Math.max(Number(unit.retreatHpBelow) || 0,Number(effect.retreatHpBelow) || 0);
        publishBattleEvents([{type:"transform_end",source:unit,target:unit,skill:{id:effect.skillId,name:effect.name},reason:"저체력 자동 해제"}]);
        return false;
      }
      if (effect.mode === "damage_pool" && --effect.poolPulseTicks<=0) {
        const source=[...playerSquad,...enemySquad].find(candidate=>candidate.effectCasterId === effect.casterId);
        const pulses=Math.max(1,Math.ceil(effect.remainingTicks/BASE_ATTACK_COOLDOWN));
        const amount=(effect.poolRemaining ?? 0)/pulses;
        effect.poolRemaining=Math.max(0,(effect.poolRemaining ?? 0)-amount);
        effect.poolPulseTicks=BASE_ATTACK_COOLDOWN;
        if (source) dealDamagePool(source,unit,effect,amount,true);
      }
      if (effect.kind === "transform" && effect.periodicHealPercent>0 && --effect.regenTicks<=0) {
        effect.regenTicks=BASE_ATTACK_COOLDOWN;
        applyActionHeal(unit,unit,{healResource:"HP",coefficients:[{type:"fixed",value:unit.maxHp*effect.periodicHealPercent/100}]},{id:effect.skillId,name:effect.name,triggered:true});
      }
      if (effect.periodic) effect.periodicElapsedTicks=(effect.periodicElapsedTicks ?? 0)+1;
      if (effect.periodic && --effect.nextPeriodicTick <= 0) {
        applyPeriodicEffect(unit,effect);
        effect.nextPeriodicTick = Math.max(1,Math.ceil(effect.periodic.interval * BASE_ATTACK_COOLDOWN));
      }
      if (!unit.alive) return false;
      if (effect.remainingTicks === null || --effect.remainingTicks > 0) return true;
      if (effect.mode === "damage_recovery" && effect.storedDamage>0) {
        applyActionHeal(unit,unit,{healResource:"HP",coefficients:[{type:"fixed",value:effect.storedDamage*effect.value/100}]},{id:effect.skillId,name:effect.name,triggered:true});
      }
      if (effect.mode === "hp_floor" && effect.repeatDuration>0) {
        unit.delayedEffectRepeats ??= [];
        unit.delayedEffectRepeats.push({remainingTicks:Math.ceil(effect.repeatDelay*BASE_ATTACK_COOLDOWN),duration:effect.repeatDuration,skillId:effect.skillId});
      }
      if (effect.refundMpOnExpire && effect.refundMp>0) {
        const caster=[...playerSquad,...enemySquad].find(candidate=>candidate.alive && candidate.effectCasterId === effect.casterId);
        if (caster) {
          const before=getUnitResourceCurrent(caster,"MP");
          setUnitResourceCurrent(caster,"MP",Math.min(caster.maxMp,before+effect.refundMp));
          publishBattleEvents([{type:"resource_refund",source:caster,target:caster,skill:getSkillById(effect.skillId),resource:"MP",amount:getUnitResourceCurrent(caster,"MP")-before,reason:"축복 자연 만료"}]);
        }
      }
      if (effect.kind === "transform" && effect.returnHpPercent>0) {
        interruptBattleCast(unit,"형태 복귀");
        for (const state of unit.weaponAttackStates ?? []) {state.castTimer=0;state.target=null;}
        unit.hp=Math.max(1,unit.maxHp*effect.returnHpPercent/100);
      }
      if(effect.kind === "transform" && !effect.companionFusion) publishBattleEvents([{type:"transform_end",source:unit,target:unit,skill:{id:effect.skillId,name:effect.name},reason:"만료"}]);
      return false;
    });
    if (unit.companionFusion && !unit.activeEffects.includes(unit.companionFusion.effect)) endCompanionFusion(unit);
    if (!unit.alive) clearBattleEffects(unit);
    else {
      if (unit.activeEffects.length !== previousLength) recalculateBattleBuffs(unit);
      updateDelayedEffectRepeats(unit,previousRepeats);
    }
  });
}

function getBattleEffectLabel(unit) {
  return (unit.activeEffects ?? []).map(effect => `${effect.name}×${effect.stacks}${effect.usesRemaining === null ? "" : ` ${effect.usesRemaining}회`} ${effect.remainingTicks === null ? "∞" : (effect.remainingTicks/BASE_ATTACK_COOLDOWN).toFixed(1)+"초"}`).join(" · ");
}

function getMovementStCostPercent(unit) {
  return (unit?.activeEffects ?? []).reduce((percent,effect)=>percent*Math.max(0,Number(effect.movementStCostPercent ?? 100))/100,100);
}

function processMovementEffectTriggers(unit) {
  for (const effect of [...(unit?.activeEffects ?? [])]) {
    if (effect.movementTriggerConsumed || !(effect.movementTriggerDistance > 0) || !(effect.movementTriggerDuration > 0)) continue;
    if ((Number(unit.moveDistanceTotal) || 0) - (Number(effect.movementStartDistance) || 0) < effect.movementTriggerDistance) continue;
    effect.movementTriggerConsumed=true;
    const source=[...playerSquad,...enemySquad].find(candidate=>candidate.effectCasterId === effect.casterId) ?? unit;
    applyTimedEffectAction(source,unit,{type:"add_state",duration:effect.movementTriggerDuration,effect:{
      id:`${effect.id}_movement_trigger`,name:`${effect.name} · 이동 발동`,state:effect.movementTriggerState,
      category:effect.category,polarity:"harmful",dispellable:true,maxStacks:1,stackMode:"refresh"
    }},{id:effect.skillId,name:effect.name,triggered:effect.triggered});
  }
}

function consumeBattleEffectUse(unit,effect,reason) {
  if (effect.usesRemaining === null || effect.usesRemaining == null) return false;
  effect.usesRemaining--;
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

function consumeDamageImmunity(unit,periodic=false,damageType="") {
  const effect=(unit.activeEffects ?? []).find(candidate => candidate.kind === "buff" && candidate.mode === "damage_immunity"
    && (!candidate.damageTypeFilter || candidate.damageTypeFilter === damageType)
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
    if (["damage_immunity","next_skill_modifier","next_attack_miss"].includes(effect.mode) || effect.usesRemaining == null || effect.consumeOn !== event.type) continue;
    if (event.periodic && !effect.consumePeriodic) continue;
    if (["hit","damaged","heal"].includes(event.type) && event.amount <= 0) continue;
    consumeBattleEffectUse(owner,effect,EFFECT_CONSUME_LABELS[event.type]);
  }
}

subscribeBattleEvent("*",consumeEffectsForBattleEvent);
