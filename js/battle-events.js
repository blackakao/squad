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
  return Object.freeze({id:combatEventUnitIds.get(unit),name:String(unit.name ?? ""),side:unit.side ?? "",isSummon:Boolean(unit.isSummon)});
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
      combatEventHistory.push(current.snapshot);
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
  }
  renderBattleEngineEvents();
}

function getBattleEvents(type = "all") {
  return combatEventHistory.filter(event => type === "all" || event.type === type);
}

function resetBattleEvents() {
  combatEventHistory = [];combatEventQueue = [];combatEventSequence = 0;combatEventTick = 0;
  combatEventUnitIds = new WeakMap();combatEventNextUnitId = 1;
  renderBattleEngineEvents();
}

function renderBattleEngineEvents() {
  if (typeof document === "undefined") return;
  const panel = document.getElementById("battleEngineEvents");
  const list = document.getElementById("battleEngineEventList");
  if (!panel?.open || !list) return;
  const type = document.getElementById("battleEngineEventFilter")?.value ?? "all";
  const events = getBattleEvents(type).slice(-200).reverse();
  list.innerHTML = events.map(event => `<div class="battle-event-log-row ${event.source?.side === "enemy" ? "enemy" : "player"}">
    <span class="battle-event-log-time">${(event.tick/60).toFixed(2)}s</span>
    <span>${BATTLE_EVENT_LABELS[event.type]} · ${escapeHtml(event.source?.name || "환경")} → ${escapeHtml(event.target?.name || "-")}
    ${escapeHtml(event.skillName)} ${event.periodic ? "(주기)" : ""} ${event.triggered ? "(패시브)" : ""} ${["hit","damaged","heal","resource_drain","damage_redirect"].includes(event.type) ? `${event.amount.toFixed(1)} ${event.resource ?? ""}` : ""}${event.type === "forced_move" ? `${event.amount.toFixed(1)} 거리` : ""}
    ${event.reason ? `(${escapeHtml(event.reason)})` : ""}</span></div>`).join("") || '<div class="battle-event-log-empty">해당 이벤트가 없습니다.</div>';
}
