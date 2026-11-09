function normalizeSkillChannel(channel) {
  if (!channel || typeof channel !== "object") return {duration:0,interval:1,interruptOnDamage:true,lockTarget:false,receivedDamagePercent:100};
  const receivedDamagePercent=Number(channel.receivedDamagePercent);
  return {...(Array.isArray(channel.pulseResourceCosts) && channel.pulseResourceCosts.length ? {pulseResourceCosts:channel.pulseResourceCosts.map(normalizeResourceCost)} : {}),duration:normalizeSkillCooldown(channel.duration),interval:channel.interval == null ? 1 : Number(channel.interval),
    interruptOnDamage:channel.interruptOnDamage !== false,lockTarget:channel.lockTarget === true,
    receivedDamagePercent:Number.isFinite(receivedDamagePercent) ? Math.max(0,receivedDamagePercent) : 100};
}

function isSkillChannelConfigured(skill) {
  const channel = normalizeSkillChannel(skill?.channel);
  return skill?.slot === "passive" || channel.duration === 0 || (Number.isFinite(channel.interval) && channel.interval > 0);
}

function renderSkillChannelForm(skill) {
  const channel = normalizeSkillChannel(skill?.channel);
  document.getElementById("skillChannelPulseCosts").value=JSON.stringify(channel.pulseResourceCosts ?? []);
  document.getElementById("skillChannelDuration").value = channel.duration;
  document.getElementById("skillChannelInterval").value = channel.interval;
  document.getElementById("skillChannelDamage").checked = channel.interruptOnDamage;
  document.getElementById("skillChannelLockTarget").checked = channel.lockTarget;
  document.getElementById("skillChannelReceivedDamagePercent").value = channel.receivedDamagePercent;
}

function readSkillChannelForm() {
  return normalizeSkillChannel({pulseResourceCosts:JSON.parse(document.getElementById("skillChannelPulseCosts").value || "[]"),duration:document.getElementById("skillChannelDuration").value,
    interval:document.getElementById("skillChannelInterval").value,interruptOnDamage:document.getElementById("skillChannelDamage").checked,
    lockTarget:document.getElementById("skillChannelLockTarget").checked,
    receivedDamagePercent:document.getElementById("skillChannelReceivedDamagePercent").value});
}

function clearBattleChannel(unit) {
  unit.channelAction=null;unit.channelTimer=0;unit.channelDuration=0;unit.channelPulseTimer=0;
}

function startBattleChannel(unit,action,skill) {
  const channel=normalizeSkillChannel(skill.channel);
  unit.channelAction={...action,skill};
  unit.channelTimer=Math.max(1,Math.ceil(channel.duration*BASE_ATTACK_COOLDOWN));
  unit.channelDuration=unit.channelTimer;
  unit.channelPulseTimer=Math.max(1,Math.ceil(channel.interval*BASE_ATTACK_COOLDOWN));
  unit.vx=0;unit.vy=0;unit.isMoving=false;
  publishBattleEvents([{type:"channel_start",source:unit,target:action.target,skill}]);
}

function finishBattleChannel(unit,reason=null,options={}) {
  const action=unit.channelAction;
  if (!action) return [];
  clearBattleChannel(unit);
  if (action.type === "skill") {
    unit.skillCooldowns ??= {};
    unit.skillCooldowns[action.skill.id]=getModifiedSkillCooldownTicks(action.skill,unit,action.skillModifier);
  } else unit.attackCooldown=getAttackCooldown(unit);
  const events=[{type:reason ? "channel_interrupt" : "channel_complete",source:unit,target:action.target,skill:action.skill,reason}];
  if (reason) events.push({type:"cast_interrupt",source:unit,target:action.target,skill:action.skill,reason});
  else events.push({type:"cast_complete",source:unit,target:action.target,skill:action.skill,resourceSpent:action.resourceSpent});
  if (!options.deferEvents) publishBattleEvents(events);
  return events;
}

function updateBattleChannel(unit) {
  const action=unit.channelAction;
  if (!action) return false;
  if (!unit.alive || hasBattleState(unit,"stun") || (action.type === "skill" && hasBattleState(unit,"silence"))) {
    finishBattleChannel(unit,!unit.alive ? "사망" : "상태 효과");return true;
  }
  markAction(unit);
  unit.channelTimer--;unit.channelPulseTimer--;
  if (unit.channelPulseTimer <= 0) {
    unit.channelPulseTimer=Math.max(1,Math.ceil(normalizeSkillChannel(action.skill.channel).interval*BASE_ATTACK_COOLDOWN));
    publishBattleEvents([{type:"channel_tick",source:unit,target:action.target,skill:action.skill}]);
    if (unit.channelAction !== action || !unit.alive) return true;
    const costs=normalizeSkillChannel(action.skill.channel).pulseResourceCosts ?? [];
    const pulseSkill={resourceCosts:costs};
    if (costs.length && !canPaySkillResourceCosts(unit,pulseSkill)) {finishBattleChannel(unit,"자원 부족");return true;}
    const spent=costs.length ? spendSkillResourceCosts(unit,pulseSkill) : action.resourceSpent;
    if (costs.length) {
      syncAliveState(unit,{source:unit,skill:action.skill,reason:"채널링 자원 소모"});
      if (!unit.alive) {finishBattleChannel(unit,"사망");return true;}
    }
    dispatchSkillActions(unit,action.target,action.skill,true,false,action,spent);
  }
  if (unit.channelAction === action && unit.channelTimer <= 0) finishBattleChannel(unit);
  return true;
}
