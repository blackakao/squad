const PASSIVE_TRIGGER_LABELS = {battle_entry:"전투 진입시",hit:"자신이 적중시",damaged:"자신이 피격시",cast_complete:"자신의 시전 완료시",heal:"자신이 회복시",kill:"자신이 적 처치시"};

function normalizePassiveTrigger(trigger) {
  if (!trigger || typeof trigger !== "object") return null;
  const mitigation=trigger.recentAttackerMitigation;
  const damageType=["physical","magic","fixed"].includes(trigger.damageType) ? trigger.damageType : "";
  const events=[...new Set((Array.isArray(trigger.events) ? trigger.events : [trigger.event]).map(String).filter(event=>Object.hasOwn(PASSIVE_TRIGGER_LABELS,event)))];
  const event=events[0] ?? String(trigger.event ?? "");
  const {allowMultiplePerTick:_allowMultiplePerTick,recentAttackerMitigation:_recentAttackerMitigation,damageType:_damageType,events:_events,...rest}=trigger;
  return {...rest,event,chance:trigger.chance == null ? 100 : Number(trigger.chance),includePeriodic:trigger.includePeriodic === true,
    ...(events.length > 1 ? {events} : {}),
    ...(damageType ? {damageType} : {}),
    ...(trigger.allowMultiplePerTick === true ? {allowMultiplePerTick:true} : {}),
    ...(mitigation?.enabled ? {recentAttackerMitigation:{enabled:true,window:Math.max(.1,Number(mitigation.window) || 3),threshold:Math.max(2,Math.floor(Number(mitigation.threshold) || 2)),initialReductionPercent:Math.max(0,Math.min(100,Number(mitigation.initialReductionPercent) || 0)),additionalReductionPercent:Math.max(0,Math.min(100,Number(mitigation.additionalReductionPercent) || 0)),maxReductionPercent:Math.max(0,Math.min(100,Number(mitigation.maxReductionPercent) || 0))}} : {})};
}

function isPassiveTriggerConfigured(skill) {
  const trigger = skill.passiveTrigger;
  return Boolean(trigger && (trigger.events ?? [trigger.event]).some(event=>Object.hasOwn(PASSIVE_TRIGGER_LABELS,event))
    && Number.isFinite(trigger.chance) && trigger.chance >= 0 && trigger.chance <= 100);
}

function renderPassiveTriggerForm(skill = null) {
  const trigger = normalizePassiveTrigger(skill?.passiveTrigger);
  const select = document.getElementById("skillPassiveEvent");
  select.innerHTML = Object.entries(PASSIVE_TRIGGER_LABELS)
    .map(([key,label]) => `<option value="${key}">${label}</option>`).join("");
  if (trigger?.event && !Object.hasOwn(PASSIVE_TRIGGER_LABELS,trigger.event)) {
    select.insertAdjacentHTML("beforeend",`<option value="${escapeHtml(trigger.event)}" disabled>미지원: ${escapeHtml(trigger.event)}</option>`);
  }
  const selectedEvents=trigger?.events ?? (trigger?.event ? [trigger.event] : []);
  [...select.options].forEach(option=>option.selected=selectedEvents.includes(option.value));
  document.getElementById("skillPassiveChance").value = trigger?.chance ?? 100;
  document.getElementById("skillPassiveDamageType").value = trigger?.damageType ?? "";
  document.getElementById("skillPassivePeriodic").checked = trigger?.includePeriodic ?? false;
  document.getElementById("skillPassiveMultiplePerTick").checked = trigger?.allowMultiplePerTick ?? false;
  const mitigation=trigger?.recentAttackerMitigation;
  document.getElementById("skillPassiveRecentAttackersEnabled").checked=Boolean(mitigation?.enabled);
  document.getElementById("skillPassiveRecentAttackersWindow").value=mitigation?.window ?? 3;
  document.getElementById("skillPassiveRecentAttackersThreshold").value=mitigation?.threshold ?? 2;
  document.getElementById("skillPassiveRecentAttackersInitial").value=mitigation?.initialReductionPercent ?? 10;
  document.getElementById("skillPassiveRecentAttackersAdditional").value=mitigation?.additionalReductionPercent ?? 3;
  document.getElementById("skillPassiveRecentAttackersMax").value=mitigation?.maxReductionPercent ?? 25;
  updateSkillTypeFields();
}

function updatePassiveSkillFields() {
  const passive = document.getElementById("skillSlot").value === "passive";
  document.getElementById("skillPassiveFields").classList.toggle("hidden",!passive);
  document.getElementById("skillCastTime").disabled = passive;
  document.getElementById("skillChannelFields").classList.toggle("hidden",passive);
}

function updateSkillTypeFields() {
  updatePassiveSkillFields();
  const choice = isChoiceSkill(document.getElementById("skillSlot").value);
  document.getElementById("skillChoiceFields").classList.toggle("hidden", !choice);
  document.getElementById("skillActions").closest("section").classList.toggle("hidden", choice);
  document.getElementById("skillResourceCosts").closest("section").classList.toggle("hidden", choice);
}

function readPassiveTriggerForm() {
  const mitigationEnabled=document.getElementById("skillPassiveRecentAttackersEnabled").checked;
  const events=[...document.getElementById("skillPassiveEvent").selectedOptions].map(option=>option.value);
  return normalizePassiveTrigger({event:events[0] ?? "",events,
    chance:Number(document.getElementById("skillPassiveChance").value),damageType:document.getElementById("skillPassiveDamageType").value,includePeriodic:document.getElementById("skillPassivePeriodic").checked,allowMultiplePerTick:document.getElementById("skillPassiveMultiplePerTick").checked,
    ...(mitigationEnabled ? {recentAttackerMitigation:{enabled:true,window:Number(document.getElementById("skillPassiveRecentAttackersWindow").value),threshold:Number(document.getElementById("skillPassiveRecentAttackersThreshold").value),initialReductionPercent:Number(document.getElementById("skillPassiveRecentAttackersInitial").value),additionalReductionPercent:Number(document.getElementById("skillPassiveRecentAttackersAdditional").value),maxReductionPercent:Number(document.getElementById("skillPassiveRecentAttackersMax").value)}} : {})});
}

function getRecentAttackerDamageReductionPercent(target,source) {
  if (!target?.alive || !source || target === source) return 0;
  const passives=resolveSelectedSkillIds(target.skillIds,target.skillSelections).map(getSkillById)
    .filter(skill=>skill?.slot === "passive" && skill.passiveTrigger?.recentAttackerMitigation?.enabled && isSkillExecutable(skill) && !isUnitSkillDisabled(target,skill));
  let strongest=0;
  target.passiveRecentAttackers ??= new Map();
  for (const skill of passives) {
    const config=normalizePassiveTrigger(skill.passiveTrigger).recentAttackerMitigation;
    let attackers=target.passiveRecentAttackers.get(skill.id);
    if (!attackers) { attackers=new Map();target.passiveRecentAttackers.set(skill.id,attackers); }
    const windowTicks=Math.max(1,Math.ceil(config.window*BASE_ATTACK_COOLDOWN));
    for (const [attacker,lastTick] of attackers) if (combatEventTick-lastTick>windowTicks) attackers.delete(attacker);
    attackers.set(source,combatEventTick);
    if (attackers.size < config.threshold) continue;
    const reduction=config.initialReductionPercent+(attackers.size-config.threshold)*config.additionalReductionPercent;
    strongest=Math.max(strongest,Math.min(config.maxReductionPercent,reduction));
  }
  return Math.max(0,Math.min(100,strongest));
}

function handlePassiveBattleEvent(event, context) {
  // Proc effects (including delayed periodic effects) never trigger more passives.
  if (event.triggered || event.depth > 0) return;
  const triggerType = event.type === "death" ? "kill" : event.type;
  if (!Object.hasOwn(PASSIVE_TRIGGER_LABELS,triggerType)) return;
  if (["hit","damaged","heal"].includes(event.type) && event.amount <= 0) return;
  const owner = event.type === "damaged" ? context.target : context.source;
  if (!owner?.alive || owner.isEntityPreview) return;
  if (triggerType === "kill" && (!context.target || context.target.side === owner.side || event.reason !== "HP 소진")) return;
  const preferred = event.type === "battle_entry" ? owner : event.type === "damaged" ? context.source : context.target;
  const skills = resolveSelectedSkillIds(owner.skillIds, owner.skillSelections).map(getSkillById).filter(skill => skill?.slot === "passive" && isSkillExecutable(skill) && !isUnitSkillDisabled(owner,skill)).map(skill => getRuntimeItemSkill(owner,skill));
  for (const skill of skills) {
    if (!owner.alive) break;
    const trigger = skill.passiveTrigger;
    if (!(trigger.events ?? [trigger.event]).includes(triggerType) || (event.periodic && !trigger.includePeriodic)) continue;
    if (trigger.damageType && event.damageType !== trigger.damageType) continue;
    owner.passiveLastTriggerTick ??= {};
    owner.skillCooldowns ??= {};
    if ((!trigger.allowMultiplePerTick && owner.passiveLastTriggerTick[skill.id] === event.tick) || (owner.skillCooldowns[skill.id] ?? 0) > 0) continue;
    if (!canPaySkillResourceCosts(owner,skill) || !skill.actions.some(action => resolveSkillActionTarget(owner,action,preferred,skill))) continue;
    if (trigger.chance <= 0 || (trigger.chance < 100 && Math.random()*100 >= trigger.chance)) continue;
    owner.passiveLastTriggerTick[skill.id] = event.tick;
    owner.skillCooldowns[skill.id] = getSkillCooldownTicks(skill,owner);
    owner.skillCooldownTotals ??= {};
    owner.skillCooldownTotals[skill.id] = owner.skillCooldowns[skill.id];
    const resourceSpent=spendSkillResourceCosts(owner,skill);
    syncAliveState(owner,{source:owner,skill:{...skill,triggered:true},reason:"패시브 자원 소모"});
    if (!owner.alive) continue;
    addBattleEventLog(owner,`${owner.name}: 패시브 ${skill.name} 발동 (${PASSIVE_TRIGGER_LABELS[triggerType]})`);
    showSkillBubble(owner,skill.name,skill.icon);
    applySkill(owner,preferred,{...skill,triggered:true},createSkillExecutionContext(resourceSpent,event));
  }
}

subscribeBattleEvent("*",handlePassiveBattleEvent);
