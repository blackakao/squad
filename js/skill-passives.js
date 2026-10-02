const PASSIVE_TRIGGER_LABELS = {hit:"자신이 적중시",damaged:"자신이 피격시",cast_complete:"자신의 시전 완료시",heal:"자신이 회복시",kill:"자신이 적 처치시"};

function normalizePassiveTrigger(trigger) {
  if (!trigger || typeof trigger !== "object") return null;
  return {...trigger,event:String(trigger.event ?? ""),chance:trigger.chance == null ? 100 : Number(trigger.chance),includePeriodic:trigger.includePeriodic === true};
}

function isPassiveTriggerConfigured(skill) {
  const trigger = skill.passiveTrigger;
  return Boolean(trigger && Object.hasOwn(PASSIVE_TRIGGER_LABELS,trigger.event)
    && Number.isFinite(trigger.chance) && trigger.chance >= 0 && trigger.chance <= 100);
}

function renderPassiveTriggerForm(skill = null) {
  const trigger = normalizePassiveTrigger(skill?.passiveTrigger);
  const select = document.getElementById("skillPassiveEvent");
  select.innerHTML = '<option value="">조건 선택 필요</option>' + Object.entries(PASSIVE_TRIGGER_LABELS)
    .map(([key,label]) => `<option value="${key}">${label}</option>`).join("");
  if (trigger?.event && !Object.hasOwn(PASSIVE_TRIGGER_LABELS,trigger.event)) {
    select.insertAdjacentHTML("beforeend",`<option value="${escapeHtml(trigger.event)}" disabled>미지원: ${escapeHtml(trigger.event)}</option>`);
  }
  select.value = trigger?.event ?? "";
  document.getElementById("skillPassiveChance").value = trigger?.chance ?? 100;
  document.getElementById("skillPassivePeriodic").checked = trigger?.includePeriodic ?? false;
  updatePassiveSkillFields();
}

function updatePassiveSkillFields() {
  const passive = document.getElementById("skillSlot").value === "passive";
  document.getElementById("skillPassiveFields").classList.toggle("hidden",!passive);
  document.getElementById("skillCastTime").disabled = passive;
  document.getElementById("skillChannelFields").classList.toggle("hidden",passive);
}

function readPassiveTriggerForm() {
  return normalizePassiveTrigger({event:document.getElementById("skillPassiveEvent").value,
    chance:Number(document.getElementById("skillPassiveChance").value),includePeriodic:document.getElementById("skillPassivePeriodic").checked});
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
  const preferred = event.type === "damaged" ? context.source : context.target;
  const skills = [...new Set(owner.skillIds ?? [])].map(getSkillById).filter(skill => skill?.slot === "passive" && isSkillExecutable(skill) && !isUnitSkillDisabled(owner,skill));
  for (const skill of skills) {
    if (!owner.alive) break;
    const trigger = skill.passiveTrigger;
    if (trigger.event !== triggerType || (event.periodic && !trigger.includePeriodic)) continue;
    owner.passiveLastTriggerTick ??= {};
    owner.skillCooldowns ??= {};
    if (owner.passiveLastTriggerTick[skill.id] === event.tick || (owner.skillCooldowns[skill.id] ?? 0) > 0) continue;
    if (!canPaySkillResourceCosts(owner,skill) || !skill.actions.some(action => resolveSkillActionTarget(owner,action,preferred,skill))) continue;
    if (trigger.chance <= 0 || (trigger.chance < 100 && Math.random()*100 >= trigger.chance)) continue;
    owner.passiveLastTriggerTick[skill.id] = event.tick;
    owner.skillCooldowns[skill.id] = getSkillCooldownTicks(skill,owner);
    const resourceSpent=spendSkillResourceCosts(owner,skill);
    syncAliveState(owner,{source:owner,skill:{...skill,triggered:true},reason:"패시브 자원 소모"});
    if (!owner.alive) continue;
    addBattleEventLog(owner,`${owner.name}: 패시브 ${skill.name} 발동 (${PASSIVE_TRIGGER_LABELS[triggerType]})`);
    showSkillBubble(owner,skill.name);
    applySkill(owner,preferred,{...skill,triggered:true},createSkillExecutionContext(resourceSpent));
  }
}

subscribeBattleEvent("*",handlePassiveBattleEvent);
