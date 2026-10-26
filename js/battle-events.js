const BATTLE_EVENT_LABELS = {cast_start:"시전 시작",cast_complete:"시전 완료",cast_interrupt:"시전 중단",hit:"적중",damaged:"피격",heal:"치유",resource_drain:"자원 감소",death:"사망",revive:"부활",battle_entry:"전투 진입",skill_copy:"스킬 복제",reserve_swap:"예비대 교대",rule_override:"규칙 변경",channel_start:"채널링 시작",channel_tick:"채널링 적용",channel_complete:"채널링 완료",channel_interrupt:"채널링 중단",field_create:"필드 생성",field_tick:"필드 적용",field_expire:"필드 만료",forced_move:"강제 이동",damage_redirect:"피해 대리",transform_start:"변신 시작",transform_end:"변신 종료",summon_command:"소환수 명령"};
const battleEventSubscribers = new Map();
let combatEventHistory = [];
let combatEventQueue = [];
let combatEventDispatching = false;
let combatEventDepth = 0;
let combatEventSequence = 0;
let combatEventTick = 0;
let combatEventUnitIds = new WeakMap();
let combatEventNextUnitId = 1;
let battleContributions = new Map();
let contributionSummons = new WeakSet();

function emptyBattleContribution() {
  return {damageDealt:0,healingDone:0,kills:0,resourceRecovery:{},skillUsage:{},damageBySkill:{},healingBySkill:{}};
}

function registerBattleContribution(unit) {
  if (!unit || unit.isEntityPreview) return null;
  const owner = unit.isSummon ? (unit.owner ?? unit.summoner) : unit;
  const ownerId = unit.isSummon ? (owner ? snapshotEventUnit(owner).id : unit.ownerEventId) : snapshotEventUnit(unit).id;
  if (ownerId == null) return null;
  if (!battleContributions.has(ownerId)) battleContributions.set(ownerId,{direct:emptyBattleContribution(),summon:emptyBattleContribution(),groups:[]});
  const row = battleContributions.get(ownerId);
  if (!unit.isSummon) return {row,part:row.direct};
  let group = row.groups.find(g=>g.entityId === (unit.entityId ?? null) && g.summonType === (unit.summonType || 'temporary'));
  if (!group) {
    group = {entityId:unit.entityId ?? null,name:unit.summonTemplateName || unit.name,summonType:unit.summonType || 'temporary',count:0,...emptyBattleContribution()};
    row.groups.push(group);
  }
  if (!contributionSummons.has(unit)) { contributionSummons.add(unit); group.count++; }
  return {row,part:row.summon,group};
}

function accumulateBattleContribution(event, source, target) {
  const entry = registerBattleContribution(source);
  if (!entry) return;
  const skill = event.skillId || '(basic)';
  for (const part of [entry.part,entry.group].filter(Boolean)) {
    const add = (map,key,value) => { map[key] = (map[key] || 0) + value; };
    if (event.type === 'hit') { part.damageDealt += event.amount; add(part.damageBySkill,skill,event.amount); }
    if (event.type === 'heal') {
      if (event.resource === 'HP') { part.healingDone += event.amount; add(part.healingBySkill,skill,event.amount); }
      else add(part.resourceRecovery,event.resource,event.amount);
    }
    if (event.type === 'death' && target && !target.isSummon && target.side !== source.side) part.kills++;
    if (event.type === 'cast_complete') add(part.skillUsage,skill,1);
  }
}

function getBattleContribution(unit, duration = 0) {
  const entry = registerBattleContribution(unit);
  const row = structuredClone(entry?.row || {direct:emptyBattleContribution(),summon:emptyBattleContribution(),groups:[]});
  const total = emptyBattleContribution();
  for (const part of [row.direct,row.summon]) {
    for (const key of ['damageDealt','healingDone','kills']) total[key] += part[key];
    for (const key of ['resourceRecovery','skillUsage','damageBySkill','healingBySkill']) {
      for (const [id,value] of Object.entries(part[key])) total[key][id] = (total[key][id] || 0) + value;
    }
  }
  for (const part of [row.direct,row.summon,total,...row.groups]) {
    part.dps = duration > 0 ? part.damageDealt / duration : 0;
    part.hps = duration > 0 ? part.healingDone / duration : 0;
  }
  return {...row,total};
}

function subscribeBattleEvent(type, listener) {
  if (type !== "*" && !Object.hasOwn(BATTLE_EVENT_LABELS,type)) throw new Error("Unknown battle event");
  if (typeof listener !== "function") throw new Error("Battle event listener must be a function");
  if (!battleEventSubscribers.has(type)) battleEventSubscribers.set(type,new Set());
  battleEventSubscribers.get(type).add(listener);
  return () => battleEventSubscribers.get(type)?.delete(listener);
}

function snapshotEventUnit(unit) {
  if (!unit) return null;
  if (!combatEventUnitIds.has(unit)) combatEventUnitIds.set(unit,combatEventNextUnitId++);
  return Object.freeze({id:combatEventUnitIds.get(unit),name:String(unit.name ?? ""),side:unit.side ?? "",isSummon:Boolean(unit.isSummon),
    ...(unit.isSummon ? {summonType:unit.summonType ?? "temporary",ownerId:unit.ownerId ?? null,ownerEventId:unit.ownerEventId ?? null,entityId:unit.entityId ?? null} : {})});
}

function publishBattleEvents(events) {
  if (combatEventDepth >= 8) return;
  for (const event of events) {
    if (!Object.hasOwn(BATTLE_EVENT_LABELS,event.type) || event.source?.isEntityPreview || event.target?.isEntityPreview) continue;
    if (combatEventQueue.length >= 128) break;
    const snapshot = Object.freeze({id:++combatEventSequence,tick:combatEventTick,type:event.type,
      source:snapshotEventUnit(event.source),target:snapshotEventUnit(event.target),
      skillId:event.skill?.id ?? null,skillName:event.skill?.name ?? "",
      amount:Number(event.amount) || 0,hpDamage:Number(event.hpDamage) || 0,barrierDamage:Number(event.barrierDamage) || 0,
      damageType:event.damageType ?? null,resource:event.resource ?? null,moveType:event.moveType ?? null,
      periodic:Boolean(event.periodic),triggered:Boolean(event.triggered || event.skill?.triggered),reason:event.reason ?? null,depth:combatEventDepth});
    combatEventQueue.push({snapshot,source:event.source,target:event.target,depth:combatEventDepth});
  }
  if (combatEventDispatching) return;
  combatEventDispatching = true;
  let delivered = 0;
  try {
    while (combatEventQueue.length && delivered++ < 128) {
      const current = combatEventQueue.shift();
      accumulateBattleContribution(current.snapshot,current.source,current.target);
      combatEventHistory.push(current.snapshot);
      if (typeof recordBattleActionLog === 'function') recordBattleActionLog(current.snapshot);
      if (combatEventHistory.length > 1000) combatEventHistory.shift();
      combatEventDepth = current.depth + 1;
      const callbacks = new Set([...(battleEventSubscribers.get(current.snapshot.type) ?? []),...(battleEventSubscribers.get("*") ?? [])]);
      for (const callback of callbacks) {
        try { callback(current.snapshot,Object.freeze({source:current.source,target:current.target})); }
        catch(error) { if (typeof logError === "function") logError("battle-event","전투 이벤트 처리 실패",error); }
      }
    }
  } finally {
    combatEventQueue = [];combatEventDepth = 0;combatEventDispatching = false;
    if (typeof finalizeSummonDeaths === "function") finalizeSummonDeaths();
  }
  renderBattleEngineEvents();
}

function getBattleEvents(type = "all") {
  return combatEventHistory.filter(event => type === "all" || event.type === type);
}

function resetBattleEvents() {
  if (typeof clearBattleEventLogs === 'function') clearBattleEventLogs();
  combatEventHistory = [];combatEventQueue = [];combatEventSequence = 0;combatEventTick = 0;
  combatEventUnitIds = new WeakMap();combatEventNextUnitId = 1;
  battleContributions = new Map();contributionSummons = new WeakSet();
  renderBattleEngineEvents();
}

function renderBattleEngineEvents() {
  if (typeof renderBattleEventLogs === 'function') renderBattleEventLogs();
}
