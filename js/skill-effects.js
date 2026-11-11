const TIMED_EFFECT_ACTIONS = ["add_buff", "delete_buff", "add_state", "delete_state"];
const BUFF_STAT_LABELS = {str:"힘",int:"지능",atk:"공격력", magic:"마력", adaptiveOffense:"적응형 공격 능력치", maxMp:"최대 MP", maxHp:"최대 HP", defense:"방어력", resistance:"저항력", speed:"이동속도", attackRange:"사거리", attackSpeed:"공격 간격(초)", castSpeed:"기본 시전시간(초)"};
const STATE_LABELS = {stun:"기절", root:"이동 불가", silence:"침묵", disarm:"기본 공격 금지", flee:"도주", polymorph:"양 변이 (공격·스킬 금지·도주)", sleep:"수면", charm:"현혹 (시전자에게 접근)", periodic:"주기 효과만 적용"};
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
  if (action.type === "add_buff" && effect.mode === "damage_immunity") return true;
  if (action.type === "add_buff" && effect.mode === "cast_time_percent") return effect.stat === "castSpeed" && Number.isFinite(Number(effect.value)) && Number(effect.value)>=-100;
  if (action.type === "add_buff" && effect.mode === "attack_rate_percent") return effect.stat === "attackSpeed" && Number.isFinite(Number(effect.value)) && Number(effect.value)>=-100;
  if (action.type === "add_buff" && effect.mode === "damage_link") return Number.isFinite(Number(effect.value)) && Number(effect.value)>0;
  if (action.type === "add_buff" && effect.mode === "barrier") return Number.isFinite(Number(effect.value)) && Number(effect.value)>0;
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
  const coefficient=periodic.coefficient ?? {type:"fixed",value:periodic.value};
  const resourceDrains=Array.isArray(periodic.resourceDrains) ? periodic.resourceDrains : [];
  return ["damage","heal"].includes(periodic.type) && Number.isFinite(Number(periodic.interval)) && Number(periodic.interval) > 0
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
    breakOnAttack:effect.breakOnAttack === true,
    stat:effect.stat, sourceStat:effect.sourceStat ?? effect.source_stat ?? "magic", mode:effect.mode, value:Number(effect.value) || 0,
    stackBonuses:(Array.isArray(effect.stackBonuses) ? effect.stackBonuses : []).map(bonus=>({
      stat:bonus.stat,mode:bonus.mode,value:Number(bonus.value) || 0,minStacks:Math.max(1,Math.min(100,Math.floor(Number(bonus.minStacks) || 1))),perStack:bonus.perStack === true,...(Number(bonus.perNStacks)>0 ? {perNStacks:Math.max(1,Math.min(100,Math.floor(Number(bonus.perNStacks))))} : {})
    })),
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
        <label>계산<select class="skill-effect-mode" onchange="updateSkillEffectModeVisibility(this)"><option value="flat" ${effect.mode === "flat" ? "selected" : ""}>고정값 가산</option><option value="percent" ${effect.mode === "percent" ? "selected" : ""}>기본 능력치의 % 가산</option><option value="override" ${effect.mode === "override" ? "selected" : ""}>최종값 고정 (0: 삭제)</option><option value="attribute" ${effect.mode === "attribute" ? "selected" : ""}>기본 능력치 가산 (힘·지능)</option><option value="cast_time_percent" ${effect.mode === "cast_time_percent" ? "selected" : ""}>모든 시전시간 증감 (%) · 음수: 단축</option><option value="attack_rate_percent" ${effect.mode === "attack_rate_percent" ? "selected" : ""}>공격속도 증감 (%) · 음수: 감속</option><option value="convert" ${effect.mode === "convert" ? "selected" : ""}>다른 능력치의 % 전환</option><option value="next_skill_modifier" ${effect.mode === "next_skill_modifier" ? "selected" : ""}>다음 1회 스킬 보정</option><option value="damage_link" ${effect.mode === "damage_link" ? "selected" : ""}>시전자가 받은 실제 피해를 대상에 전달 (%)</option><option value="barrier" ${effect.mode === "barrier" ? "selected" : ""}>시간제 보호막 · 공격으로 소진 시 반응</option><option value="damage_reflect" ${effect.mode === "damage_reflect" ? "selected" : ""}>받은 피해 반사</option><option value="heal_absorb" ${effect.mode === "heal_absorb" ? "selected" : ""}>다른 시전자 HP 치유 흡수 (수치: 흡수량)</option><option value="basic_echo" ${effect.mode === "basic_echo" ? "selected" : ""}>기본 공격 추가타 (수치: 피해 %)</option><option value="damage_pool" ${effect.mode === "damage_pool" ? "selected" : ""}>스킬 피해 누적 · 최대 중첩 폭발 (수치: 피해 %)</option><option value="periodic" ${effect.mode === "periodic" ? "selected" : ""}>주기 효과만 적용</option><option value="immunity" ${effect.mode === "immunity" ? "selected" : ""}>능력치 변경 없이 면역 적용</option><option value="damage_immunity" ${effect.mode === "damage_immunity" ? "selected" : ""}>피해 무시</option><option value="damage_proxy" ${effect.mode === "damage_proxy" ? "selected" : ""}>피해 대리 수신</option><option value="stealth" ${effect.mode === "stealth" ? "selected" : ""}>은신 · 직접 타겟 제외</option><option value="disguise" ${effect.mode === "disguise" ? "selected" : ""}>적 외형 위장·직접 타겟 제외</option><option value="melee_reaction" ${effect.mode === "melee_reaction" ? "selected" : ""}>근접 피격 반응 스킬</option></select></label>
        <div class="skill-effect-barrier-settings ${effect.mode === "barrier" ? "" : "hidden"}">
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
        <label>주기 효과<select class="skill-effect-periodic-type">${options({"":"없음",damage:"주기 피해",heal:"주기 회복"},periodic.type)}</select></label>
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
  return {requiredOwnedSummonAbsent:row.querySelector('.skill-effect-required-summon-absent')?.checked === true,id:value("id"),name:value("name"),stat:value("stat"),sourceStat:value("source-stat"),state:value("state"),mode:value("mode"),requiredOwnedSummonEntityId:value("required-summon") ?? "",tags:String(value("tags") ?? "").split(",").map(tag=>tag.trim()).filter(Boolean),
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

function getUnitBattleForm(unit) {
  return (unit?.activeEffects ?? []).find(effect=>effect.kind === "transform");
}

function getLifeCycleForm(unit) {
  return (unit?.activeEffects ?? []).find(effect=>effect.kind === "transform" && effect.lifeCycle);
}

function isUnitBattleTargetable(unit) {
  return unit?.targetable !== false && !getUnitBattleForm(unit)?.untargetable;
}

function getLethalTransformationPassive(unit) {
  return resolveSelectedSkillIds(unit?.skillIds,unit?.skillSelections).map(getSkillById)
    .find(skill=>skill?.slot === "passive" && skill.passiveTrigger?.lethalTransformation && !isUnitSkillDisabled(unit,skill));
}

function getFormSkill(unit,skill) {
  if (skill?.summonVariant && !getLivingOwnedSummons(unit,skill.summonVariant.entityId).length) {
    const replacement=getSkillById(skill.summonVariant.absentSkillId);
    if (replacement) return {...replacement,internal:false};
  }
  const row=getUnitBattleForm(unit)?.skillReplacements?.find(row=>row.skillId === skill?.id);
  const replacement=row && getSkillById(row.replacementSkillId);
  return replacement ? {...replacement,id:skill.id,formVariantId:replacement.id,internal:false} : skill;
}

function getLifeCycleFormLabel(unit) {
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
  if (!(amount>0) || action.damageLinked || unit.effectCasterId == null) return;
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
  const effects=(unit.activeEffects ?? []).flatMap(effect=>effect.kind === "buff" ? [effect,...getEffectStackBonuses(effect)] : [])
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

function recalculateBattleBuffs(unit) {
  restorePassiveStatConversion(unit);
  updateAttributeBuffs(unit);
  const previousMaxHp=Math.max(0,Number(unit.maxHp) || 0);
  const previousMaxMp=Math.max(0,Number(unit.maxMp) || 0);
  unit.effectBaseStats ??= {};
  const buffs = [...(unit.activeEffects ?? []), ...getBattleFieldAuraEffects(unit)].flatMap(effect => {
    if (effect.kind === "state" && effect.movementSpeedPercent != null && effect.movementSpeedPercent !== 100)
      return [{stat:"speed",value:effect.movementSpeedPercent-100,mode:"percent",stacks:effect.stacks ?? 1}];
    if(effect.kind === "buff" && ["flat","percent","override","convert","attack_rate_percent","cast_time_percent","attribute"].includes(effect.mode)) {
      if (effect.requiredOwnedSummonEntityId) {
        const caster=[...playerSquad,...enemySquad].find(candidate=>candidate.effectCasterId === effect.casterId);
        if (!caster || Boolean(getLivingOwnedSummons(caster,effect.requiredOwnedSummonEntityId).length) === effect.requiredOwnedSummonAbsent) return [];
      }
      return [effect,...getEffectStackBonuses(effect)];
    }
    if(effect.kind === "transform") return Object.entries(effect.modifiers ?? {}).filter(([,value])=>Number(value)!==0)
      .map(([stat,value])=>({stat,value:Number(value),mode:effect.mode,stacks:1}));
    return [];
  });
  unit.effectAttackRateMultiplier=Math.max(.1,1+buffs.filter(effect=>effect.stat === "attackSpeed" && effect.mode === "attack_rate_percent")
    .reduce((sum,effect)=>sum+effect.stacks*effect.value,0)/100);
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
  if (getLifeCycleForm(unit)) unit.hp=0;
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

function applyTimedEffectAction(source,target,action,skill,execution=null) {
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
  const existingAny = target.activeEffects.find(effect => effect.kind === kind && effect.id === config.id);
  if (config.stackMode === "reject" && existingAny) return;
  const existing = target.activeEffects.find(effect => effect.kind === kind && effect.id === config.id && effect.casterId === source.effectCasterId);
  const stacks = config.stackMode === "stack" ? Math.min(config.maxStacks,(existing?.stacks ?? 0)+1) : 1;
  const sourceBase=(target.effectBaseStats?.[config.sourceStat]?.value ?? Number(target[config.sourceStat])) || 0;
  const periodicCoefficient=config.periodic?.coefficient;
  const periodicSourceBase=periodicCoefficient?.type === "calculated" ? getCoefficientBaseValue(periodicCoefficient,source,target) : 0;
  const instance = {...config,periodic:config.periodic,periodicSourceBase,periodicElapsedTicks:0,immunity:config.immunity,kind,stacks,casterId:source.effectCasterId,casterName:source.name,
    damageTaken:0,breakDamageThreshold:Math.max(0,Number(target.maxHp) || 0)*config.breakDamagePercent/100,
    ...(config.mode === "convert" ? {conversionBase:sourceBase} : {}),
    skillId:skill?.id,triggered:Boolean(skill?.triggered),remainingTicks:action.duration > 0 ? Math.max(1,Math.ceil(action.duration * BASE_ATTACK_COOLDOWN)) : null,
    usesRemaining:config.mode === "next_skill_modifier" ? 1 : config.uses > 0 ? config.uses : null,
    movementStartDistance:Number(target.moveDistanceTotal) || 0,movementTriggerConsumed:false,
    nextPeriodicTick:config.periodic ? (existing?.periodic?.interval === config.periodic.interval ? existing.nextPeriodicTick : null) ?? Math.max(1,Math.ceil(config.periodic.interval * BASE_ATTACK_COOLDOWN)) : null};
  if (config.mode === "heal_absorb") instance.absorbRemaining=(existing?.absorbRemaining ?? 0)+config.value;
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
  recalculateBattleBuffs(target);
  if (config.periodic?.type === "damage" && !skill?.triggered && skill?.slot === "active") {
    const coefficient=config.periodic.coefficient ?? {type:"fixed",value:config.periodic.value};
    const pulses=Math.floor(Math.max(0,action.duration)*BASE_ATTACK_COOLDOWN/Math.max(1,Math.ceil(config.periodic.interval*BASE_ATTACK_COOLDOWN)));
    const raw=getCoefficientValue(coefficient,source,target)*pulses*stacks*getUnitTeamBattleRules(source).damagePercent/100*getPassiveTargetDamageMultiplierPercent(source,target,{periodic:true})/100;
    const projected=getReducedDamage(source,target,config.periodic.damageType,raw*getUnitIncomingRulePercent(target,"receivedDamagePercent")/100);
    recordSkillDamagePool(source,target,action,skill,projected);
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
    applySkill(defender,attacker,{...reaction,triggered:true});
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
  if (periodic.type === "damage") applyActionDamage(source,target,action,skill);
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
    damageExitStun:transform.damageExitStun,immobile:transform.immobile,exitHpBelow:transform.exitHpBelow,retreatHpBelow:transform.retreatHpBelow,stacks:1,
    remainingTicks:action.duration>0 ? Math.max(1,Math.ceil(action.duration*BASE_ATTACK_COOLDOWN)) : null,usesRemaining:null,skillId:skill?.id};
  target.activeEffects.push(instance);
  recalculateBattleBuffs(target);
  publishBattleEvents([...removed.map(effect=>({type:"transform_end",source:target,target,skill,reason:`${effect.name} 교체`})),{type:"transform_start",source,target,skill,reason:transform.name}]);
}

function breakAttackConcealment(unit,skill) {
  if (!skill || skill.triggered || !skill.actions?.some(action=>action.type === "deal_damage")) return;
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
      applySkill(unit,unit,{id:skill.id,name:skill.name,triggered:true,actions:[normalizeSkillAction({type:"override_rule",target:"self",duration:trigger.aloneLossDuration,
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
    .filter(passive=>passive?.slot === "passive" && isSkillExecutable(passive) && !isUnitSkillDisabled(source,passive));
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

function updateBattleEffects() {
  [...playerSquad,...enemySquad].forEach(unit => {
    if (unit.alive && !unit.isWaiting && !unit.isReserve) unit.undamagedTicks=(unit.undamagedTicks || 0)+1;
    updateRepeatingPassives(unit);
    updateProximityPassives(unit);
    if (!unit.activeEffects?.length) return;
    const linkedState=unit.activeEffects.filter(effect=>effect.requiredOwnedSummonEntityId).map(effect=>{
      const caster=[...playerSquad,...enemySquad].find(candidate=>candidate.effectCasterId === effect.casterId);
      return `${effect.id}:${caster && getLivingOwnedSummons(caster,effect.requiredOwnedSummonEntityId).length ? 1 : 0}`;
    }).join("|");
    if (unit.linkedSummonEffectState !== linkedState) {
      unit.linkedSummonEffectState=linkedState;
      recalculateBattleBuffs(unit);
    }
    if (!unit.alive) {clearBattleEffects(unit);return;}
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
      if (effect.periodic) effect.periodicElapsedTicks=(effect.periodicElapsedTicks ?? 0)+1;
      if (effect.periodic && --effect.nextPeriodicTick <= 0) {
        applyPeriodicEffect(unit,effect);
        effect.nextPeriodicTick = Math.max(1,Math.ceil(effect.periodic.interval * BASE_ATTACK_COOLDOWN));
      }
      if (!unit.alive) return false;
      if (effect.remainingTicks === null || --effect.remainingTicks > 0) return true;
      if (effect.kind === "transform" && effect.returnHpPercent>0) {
        interruptBattleCast(unit,"형태 복귀");
        for (const state of unit.weaponAttackStates ?? []) {state.castTimer=0;state.target=null;}
        unit.hp=Math.max(1,unit.maxHp*effect.returnHpPercent/100);
      }
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
