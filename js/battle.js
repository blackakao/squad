function resetUnitForBattle(unit) {
  clearBattleEffects(unit);
  clearBattleChannel(unit);
  Object.values(unit.customResources ?? {}).forEach(resource => {
    resource.current = Math.min(Math.max(0, Number(resource.max) || 0), Math.max(0, Number(resource.initial) || 0));
  });
  unit.hp = unit.maxHp;
  unit.maxMp = Math.max(0, Number(unit.maxMp ?? DEFAULT_RESOURCE_VALUE));
  unit.mp = unit.maxMp;
  unit.maxSt = Math.max(0, Number(unit.maxSt ?? DEFAULT_RESOURCE_VALUE));
  unit.st = unit.maxSt;
  unit.baseBp = Math.max(0, Number(unit.baseBp ?? unit.bp ?? 0));
  unit.maxBp = unit.baseBp;
  unit.bp = unit.baseBp;
  unit.exhausted = false;
  unit.isMoving = false;
  unit.didAct = false;
  unit.alive = true;
  unit.battleRules = normalizeBattleRules(unit.battleRules);
  unit.revivesRemaining = unit.isSummon ? 0 : unit.battleRules.reviveCount;
  unit.reviveTicks = 0;
  unit.reviveInvulnerableTicks = 0;
  unit.entryTicks = unit.isSummon ? 0 : Math.max(0, Math.ceil(unit.battleRules.entryDelay * BASE_ATTACK_COOLDOWN));
  unit.isReserve = !unit.isSummon && Boolean(unit.startsInReserve);
  unit.isWaiting = unit.isReserve || unit.entryTicks > 0;
  if (unit.isWaiting) unit.alive = false;
  unit.vx = 0;
  unit.vy = 0;
  unit.attackCooldown = 0;
  unit.weaponAttackStates = (unit.weaponAttacks ?? []).map(weapon=>({weapon,cooldown:0,castTimer:0,target:null}));
  unit.skillCooldowns = {};
  unit.runtimeCopiedSkills = [];
  unit.runtimeRuleOverrides = [];
  unit.temporaryReserveTicks = null;
  unit.temporaryReturnUnit = null;
  unit.reservedForTemporarySwap = false;
  actionTargetCooldowns.delete(unit);
  unit.passiveLastTriggerTick = {};
  unit.castTimer = 0;
  unit.castDuration = 0;
  unit.pendingAction = null;
  unit.stats = createStats();
  unit.actualDamageTotal = 0;
  unit.moveDistanceTotal = 0;
  unit.effectType = null;
  unit.effectTimer = 0;
  unit.skillBubbleText = "";
  unit.skillBubbleTimer = 0;
}

let nextSummonId = 1;
let skillAreaImpacts = [];
let skillChainImpacts = [];
let battleFields = [];
const SKILL_AREA_IMPACT_MS = 400;
const MAX_ACTIVE_SUMMONS_PER_SIDE = 40;

function getSummonSquad(source) {
  return source.side === "enemy" ? enemySquad : playerSquad;
}

function canSummonBattleUnit(source, action, skill) {
  const squad = getSummonSquad(source);
  const config = getSummonConfiguration(source, action);
  if (!config) return false;
  const living = squad.filter(unit => unit.alive && unit.isSummon);
  return living.length < MAX_ACTIVE_SUMMONS_PER_SIDE && living.filter(unit => unit.summoner === source && unit.summonSkillId === skill?.id).length < config.limit;
}

function summonBattleUnits(source, action, skill, target = source) {
  if (!source.alive) return;
  const config = getSummonConfiguration(source, action);
  if (!config) return;
  const squad = getSummonSquad(source);
  for (let i = 0; i < config.count && canSummonBattleUnit(source, action, skill); i++) {
    const unit = createSummonedBattleUnit(source, {...config,spawnCenter:config.summonCenter === "target" ? target : source});
    unit.summonSkillId = skill?.id;
    unit.summonTicks = config.lifetime > 0 ? Math.max(1, Math.round(config.lifetime * BASE_ATTACK_COOLDOWN)) : null;
    squad.push(unit);
    addBattleEventLog(source, `${source.name}: ${config.name} 소환`);
  }
}

function createSummonedBattleUnit(source, config) {
    const angle = (nextSummonId * 2.4) % (Math.PI * 2);
    const center=config.spawnCenter ?? source;
    const unit = {
      id: `summon_${nextSummonId++}`, side: source.side, isSummon: true,
      summoner: source, entityId: config.entityId, role: config.role, ai: config.ai,
      summonBaseAi:config.ai,summonBaseSpeed:config.speed,
      isEntityPreview: Boolean(source.isEntityPreview),
      previewBounds: source.isEntityPreview ? source.previewBounds : undefined,
      name: `${config.name} (${source.name})`, faction: source.faction, portrait: safeEntityIcon(config.icon),
      maxHp: config.hp, maxMp: config.mp, maxSt: config.st, baseBp: 0,
      atk: config.atk, magic: config.magic, defense: config.defense, resistance: config.resistance,
      speed: config.speed, attackSpeed: config.attackSpeed, castSpeed: config.castTime,
      attackRange: config.attackRange, attackType: config.ai === "healer" ? "magic" : "physical",
      protectOwnerPercent:config.protectOwnerPercent,protectOwnerScope:config.protectOwnerScope,protectOwnerPriority:config.protectOwnerPriority,
      transferStateScope:config.transferStateScope,transferStatePriority:config.transferStatePriority,
      attributes: {}, skillIds: [], attackSkillId: "",
      x: center.x + Math.cos(angle) * COLLISION_DISTANCE,
      y: center.y + Math.sin(angle) * COLLISION_DISTANCE
    };
    resetUnitForBattle(unit);
    clampPosition(unit);
    return unit;
}

function updateSummonLifetimes() {
  [...playerSquad, ...enemySquad].forEach(unit => {
    if (!unit.isSummon || !unit.alive || unit.summonTicks == null) return;
    unit.summonTicks--;
    if (unit.summonTicks <= 0) {
      unit.hp = 0;
      syncAliveState(unit,{reason:"소환 수명 종료"});
      unit.pendingAction = null;
      unit.castTimer = 0;
      addBattleEventLog(unit, `${unit.name}: 소환 시간 종료`);
    }
  });
}

function updateResources() {
  const now = Date.now();
  if (!lastResourceUpdateAt) {
    lastResourceUpdateAt = now;
    return;
  }

  const elapsedSeconds = Math.max(0, (now - lastResourceUpdateAt) / 1000);
  lastResourceUpdateAt = now;

  [...playerSquad, ...enemySquad].forEach(unit => {
    if (!unit.alive) {
      return;
    }

    const maxMp = Math.max(0, Number(unit.maxMp ?? DEFAULT_RESOURCE_VALUE));
    const maxSt = Math.max(0, Number(unit.maxSt ?? DEFAULT_RESOURCE_VALUE));
    unit.maxMp = maxMp;
    unit.maxSt = maxSt;
    unit.mp = Math.min(maxMp, (Number(unit.mp) || 0) + MP_REGEN_PER_SECOND * elapsedSeconds);

    if (unit.exhausted) {
      const exhaustedRecoveryThreshold = maxSt * ST_EXHAUSTED_MIN_RECOVERY_RATIO;
      const exhaustedRegenPerSecond = maxSt * ST_EXHAUSTED_REGEN_RATIO_PER_SECOND + ST_EXHAUSTED_REGEN_FLAT_PER_SECOND;

      unit.st = Math.min(maxSt, (Number(unit.st) || 0) + exhaustedRegenPerSecond * elapsedSeconds);
      if (unit.isMoving) {
        unit.st = Math.max(0, unit.st - ST_MOVE_COST_PER_SECOND * elapsedSeconds);
      }
      if (unit.st >= exhaustedRecoveryThreshold) {
        unit.exhausted = false;
      }
    } else if (unit.isMoving) {
      unit.st = Math.max(0, (Number(unit.st) || 0) - ST_MOVE_COST_PER_SECOND * elapsedSeconds);
      if (unit.st <= 0) {
        unit.exhausted = true;
      }
    } else if (!unit.didAct) {
      unit.st = Math.min(maxSt, (Number(unit.st) || 0) + ST_IDLE_REGEN_PER_SECOND * elapsedSeconds);
    }

    unit.isMoving = false;
    unit.didAct = false;
  });
}

function hasEnoughMpForAction(unit) {
  return !isMagicAttackUnit(unit) || (Number(unit.mp) || 0) >= MP_ACTION_COST;
}

function spendMpForAction(unit) {
  if (!isMagicAttackUnit(unit)) {
    return;
  }

  unit.mp = Math.max(0, (Number(unit.mp) || 0) - MP_ACTION_COST);
}

function markAction(unit) {
  unit.didAct = true;
}

function hasEnoughStForPhysicalAttack(unit) {
  if (!isPhysicalAttackUnit(unit)) {
    return true;
  }

  if ((Number(unit.st) || 0) >= ST_PHYSICAL_ATTACK_COST) {
    return true;
  }

  unit.exhausted = true;
  return false;
}

function spendStForPhysicalAttack(unit) {
  if (!isPhysicalAttackUnit(unit)) {
    return;
  }

  unit.st = Math.max(0, (Number(unit.st) || 0) - ST_PHYSICAL_ATTACK_COST);
  if (unit.st <= 0) {
    unit.exhausted = true;
  }
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clampPosition(unit) {
  const margin = UNIT_RADIUS;
  const bounds = unit.isEntityPreview ? unit.previewBounds ?? canvas : canvas;
  unit.x = Math.max(margin, Math.min(bounds.width - margin, unit.x));
  unit.y = Math.max(margin, Math.min(bounds.height - margin, unit.y));
}

function syncAliveState(unit, context = {}) {
  const events = [];
  if (unit.hp <= 0) {
    const wasAlive = unit.alive;
    unit.hp = 0;
    unit.alive = false;
    if (wasAlive) {
      if (unit.pendingAction) events.push({type:"cast_interrupt",source:unit,target:unit.pendingAction.target,skill:unit.pendingAction.skill,reason:"사망"});
      if (unit.channelAction) events.push(...finishBattleChannel(unit,"사망",{deferEvents:true}));
      unit.pendingAction=null;unit.castTimer=0;unit.castDuration=0;
      unit.isWaiting = false;
      if (!unit.isSummon && unit.revivesRemaining > 0) {
        unit.revivesRemaining--;
        unit.reviveTicks = Math.max(1, Math.ceil(normalizeBattleRules(unit.battleRules).reviveDelay * BASE_ATTACK_COOLDOWN));
        unit.isWaiting = true;
        addBattleEventLog(unit, `${unit.name}: 부활 대기 (${(unit.reviveTicks / BASE_ATTACK_COOLDOWN).toFixed(1)}초)`);
      }
      events.push({type:"death",source:context.source ?? null,target:unit,skill:context.skill,periodic:context.periodic,reason:context.reason ?? "HP 소진"});
    }
  }
  if (!context.deferEvents) publishBattleEvents(events);
  return events;
}

function activateWaitingUnit(unit, type) {
  const rules = normalizeBattleRules(unit.battleRules);
  const preserveState = type === "reserve" || type === "swap";
  unit.alive = true;
  unit.isWaiting = false;
  unit.isReserve = false;
  unit.entryTicks = 0;
  unit.reviveTicks = 0;
  unit.hp = type === "revive" ? Math.max(1, unit.maxHp * rules.reviveHpPercent / 100) : preserveState ? Math.max(1, unit.hp) : unit.maxHp;
  if (type === "revive") {
    unit.mp = unit.maxMp * rules.reviveMpPercent / 100;
    unit.st = unit.maxSt * rules.reviveStPercent / 100;
    unit.exhausted = unit.st <= 0;
    unit.reviveInvulnerableTicks = Math.max(0, Math.ceil(rules.reviveInvulnerable * BASE_ATTACK_COOLDOWN));
    if (rules.revivePosition === "start" && Number.isFinite(unit.battleStartX) && Number.isFinite(unit.battleStartY)) {
      unit.x = unit.battleStartX;
      unit.y = unit.battleStartY;
      clampPosition(unit);
    }
  }
  unit.bp = type === "revive" ? 0 : preserveState ? unit.bp : unit.baseBp;
  unit.vx = 0;
  unit.vy = 0;
  if (!preserveState) unit.attackCooldown = 0;
  unit.pendingAction = null;
  unit.skillBubbleText = "";
  publishBattleEvents([{type:type === "revive" ? "revive" : "battle_entry",source:unit,target:unit}]);
  addBattleEventLog(unit, `${unit.name}: ${type === "revive" ? "부활" : preserveState ? "예비대 투입" : "전투 진입"}`);
}

function getReserveCandidates(source) {
  const squad = source.side === "enemy" ? enemySquad : playerSquad;
  return squad.filter(unit => !unit.isSummon && unit.isReserve && unit.isWaiting && !unit.reservedForTemporarySwap)
    .sort((a,b) => (a.reserveOrder ?? 0) - (b.reserveOrder ?? 0));
}

function swapBattleUnitWithReserve(source, target, action) {
  if (!source?.alive || !target?.alive || target.isSummon || source.side !== target.side) return null;
  const reserve = getReserveCandidates(source)[Math.max(1, Number(action.reserveIndex) || 1) - 1];
  if (!reserve) return null;
  const position = {x:target.x,y:target.y};
  clearBattleEffects(target);
  clearBattleChannel(target);
  target.pendingAction = null;
  target.castTimer = 0;
  target.castDuration = 0;
  target.alive = false;
  target.isReserve = true;
  target.isWaiting = true;
  target.entryTicks = 0;
  target.reviveTicks = 0;
  reserve.x = position.x;
  reserve.y = position.y;
  activateWaitingUnit(reserve,"swap");
  if (Number(action.duration) > 0) {
    target.reservedForTemporarySwap=true;
    reserve.temporaryReturnUnit=target;
    reserve.temporaryReserveTicks=Math.max(1,Math.ceil(action.duration*BASE_ATTACK_COOLDOWN));
  }
  publishBattleEvents([{type:"reserve_swap",source,target,reserve}]);
  addBattleEventLog(source,`${target.name} 퇴장 · ${reserve.name} 투입`);
  return reserve;
}

function reviveBattleUnitWithSkill(source,target,action,skill) {
  if (!source?.alive || !target || target.alive || target.isSummon || target.isWaiting || target.isReserve || target.side !== source.side || target.hp > 0) return false;
  clearBattleEffects(target);clearBattleChannel(target);
  target.alive=true;target.isWaiting=false;target.isReserve=false;target.entryTicks=0;target.reviveTicks=0;
  target.hp=Math.max(1,target.maxHp*Math.max(1,Math.min(100,Number(action.reviveHpPercent)||50))/100);
  target.mp=target.maxMp*Math.max(0,Math.min(100,Number(action.reviveMpPercent ?? 100)))/100;
  target.st=target.maxSt*Math.max(0,Math.min(100,Number(action.reviveStPercent ?? 100)))/100;
  target.bp=0;target.exhausted=target.st<=0;target.vx=0;target.vy=0;target.pendingAction=null;target.castTimer=0;target.castDuration=0;
  target.reviveInvulnerableTicks=Math.max(0,Math.ceil((Number(action.reviveInvulnerable)||0)*BASE_ATTACK_COOLDOWN));
  if (action.revivePosition === "start" && Number.isFinite(target.battleStartX) && Number.isFinite(target.battleStartY)) {
    target.x=target.battleStartX;target.y=target.battleStartY;clampPosition(target);
  }
  publishBattleEvents([{type:"revive",source,target,skill}]);
  addBattleEventLog(source,`${source.name}: ${target.name} 부활`);
  return true;
}

function deployReserveWithSkill(source,action,skill) {
  if (!source?.alive) return null;
  const reserve=getReserveCandidates(source)[Math.max(1,Number(action.reserveIndex)||1)-1];
  if (!reserve) return null;
  reserve.x=source.x;reserve.y=source.y;activateWaitingUnit(reserve,"swap");
  if (Number(action.duration) > 0) reserve.temporaryReserveTicks=Math.max(1,Math.ceil(action.duration*BASE_ATTACK_COOLDOWN));
  publishBattleEvents([{type:"reserve_deploy",source,target:reserve,skill}]);
  addBattleEventLog(source,`${reserve.name} 예비대 증원`);
  return reserve;
}

function returnTemporaryReserveUnit(unit) {
  const returning=unit.temporaryReturnUnit;
  unit.temporaryReserveTicks=null;unit.temporaryReturnUnit=null;
  if (unit.alive) {
    clearBattleEffects(unit);clearBattleChannel(unit);unit.pendingAction=null;unit.castTimer=0;unit.castDuration=0;
    unit.alive=false;unit.isReserve=true;unit.isWaiting=true;unit.entryTicks=0;unit.reviveTicks=0;
  }
  if (returning?.reservedForTemporarySwap) {
    returning.reservedForTemporarySwap=false;
    if (returning.isReserve && returning.isWaiting && returning.hp > 0) {
      returning.x=unit.x;returning.y=unit.y;activateWaitingUnit(returning,"swap");
      addBattleEventLog(returning,`${returning.name}: 시간제 교대 복귀`);
    }
  }
}

function updateTemporaryReserveDeployments() {
  [...playerSquad,...enemySquad].forEach(unit=>{
    if (unit.temporaryReserveTicks == null) return;
    if (!unit.alive || --unit.temporaryReserveTicks <= 0) returnTemporaryReserveUnit(unit);
  });
}

function deployReserveReinforcements(squad) {
  const regularUnits = squad.filter(unit => !unit.isSummon);
  const activeLimit = Math.max(1, Number(regularUnits[0]?.squadActiveLimit) || regularUnits.length || 1);
  const occupied = regularUnits.filter(unit => !unit.isReserve
    && (unit.alive || (unit.isWaiting && (unit.entryTicks > 0 || unit.reviveTicks > 0)))).length;
  let vacancies = Math.max(0, activeLimit - occupied);
  const reserves = regularUnits.filter(unit => unit.isReserve && unit.isWaiting)
    .sort((a,b) => (a.reserveOrder ?? 0) - (b.reserveOrder ?? 0));
  while (vacancies > 0 && reserves.length) {
    const reserve = reserves.shift();
    activateWaitingUnit(reserve, "reserve");
    vacancies--;
  }
}

function updateBattleReentries() {
  updateTemporaryReserveDeployments();
  [...playerSquad, ...enemySquad].forEach(unit => {
    if (unit.reviveInvulnerableTicks > 0) unit.reviveInvulnerableTicks--;
  });
  [...playerSquad, ...enemySquad].forEach(unit => {
    if (unit.alive || !unit.isWaiting) return;
    if (unit.entryTicks > 0 && --unit.entryTicks <= 0) activateWaitingUnit(unit, "entry");
    else if (unit.reviveTicks > 0 && --unit.reviveTicks <= 0) activateWaitingUnit(unit, "revive");
  });
  deployReserveReinforcements(playerSquad);
  deployReserveReinforcements(enemySquad);
}

function updateRuntimeRuleOverrides() {
  [...playerSquad,...enemySquad].forEach(unit => {
    const equipmentWasDisabled=(unit.runtimeRuleOverrides ?? []).some(rule=>rule.disableEquipmentEffects);
    if (!unit.alive) { unit.runtimeRuleOverrides=[]; return; }
    unit.runtimeRuleOverrides=(unit.runtimeRuleOverrides ?? []).filter(rule=>rule.remainingTicks === null || --rule.remainingTicks > 0);
    const equipmentIsDisabled=unit.runtimeRuleOverrides.some(rule=>rule.disableEquipmentEffects);
    if (equipmentWasDisabled !== equipmentIsDisabled) refreshBattleEquipmentRuleState(unit);
  });
}

function canSquadContinueBattle(squad) {
  return squad.some(unit => unit.alive || (!unit.isSummon && unit.isWaiting
    && (unit.isReserve || unit.entryTicks > 0 || unit.reviveTicks > 0)));
}

function triggerEffect(unit, effectType) {
  unit.effectType = effectType;
  unit.effectTimer = EFFECT_DURATION;
}

function placeSquadForBattle(units, side) {
  const fieldWidth = canvas.width || 400;
  const fieldHeight = canvas.height || 300;

  units.forEach(unit => {
    unit.x = side === "enemy"
      ? fieldWidth * (0.7 + Math.random() * 0.25)
      : fieldWidth * (0.05 + Math.random() * 0.25);
    unit.y = fieldHeight * (0.08 + Math.random() * 0.84);
    clampPosition(unit);
    unit.battleStartX = unit.x;
    unit.battleStartY = unit.y;
  });
}

let isImmediateBattleResolving = false;
let lastResolvedBattleResult = "";

async function finishBattle(result) {
  updateResources();
  lastBattleDurationMs = battleStartedAt ? Date.now() - battleStartedAt : lastBattleDurationMs;
  lastResolvedBattleResult = result;
  isBattleRunning = false;
  updateBattleButton();

  const record = createBattleRecord(result);
  [...playerSquad, ...enemySquad].forEach(clearBattleEffects);
  battleFields = [];
  battleRecordsJson.unshift(record);
  recordPage = 1;
  try {
    await saveBattleRecordsJson();
    renderBattleRecords();
  } catch (error) {
    logError("battle", "전투 종료 기록 저장 처리 중 실패했습니다.", error);
    alert("전투 기록을 저장하지 못했습니다.");
  }
  log(result);

  battleStartedAt = null;
  battleStartedAtText = "";
  lastResourceUpdateAt = null;
  clearBattleEventLogs();
}

function prepareBattleSession({ openScreen = true } = {}) {
  resetBattleEvents();
  skillAreaImpacts = [];
  skillChainImpacts = [];
  battleFields = [];
  playerSquad = playerSquad.filter(unit => !unit.isSummon);
  enemySquad = enemySquad.filter(unit => !unit.isSummon);
  projectiles = [];
  rebuildPlayerSquadFromSelection();
  if (battleMode === "team" && selectedEnemyTeamIndex !== "") {
    const enemyTeam = teamsJson[Number(selectedEnemyTeamIndex)];
    enemySquad = createSquadFromCharacterIds(getTeamCharacterIds(enemyTeam), "enemy", enemyTeam?.activeMemberCount);
  }

  if (playerSquad.length < 1) {
    alert("최소 1명 필요");
    return false;
  }

  if (enemySquad.length < 1) {
    alert("적을 1명 이상 추가해주세요");
    return false;
  }

  snapshotActiveBattleSideRules();

  const missingEntity = [...playerSquad, ...enemySquad].flatMap(unit => getEquippedSkills(unit))
    .flatMap(skill => skill.actions).find(action => action.type === 'summon_entity' && !getEntityById(action.entityId));
  if (missingEntity) { alert(`소환 Entity를 찾을 수 없습니다: ${missingEntity.entityId}`); return false; }
  battleEntitySnapshot = structuredClone(entitiesJson);

  if (openScreen) {
    openBattleScreenModal();
    showBattleScreenTab("status");
  }

  clearBattleEventLogs();
  playerSquad.forEach(resetUnitForBattle);
  enemySquad.forEach(resetUnitForBattle);
  placeSquadForBattle(playerSquad, "player");
  placeSquadForBattle(enemySquad, "enemy");

  lastBattleDurationMs = 0;
  battleStartedAt = Date.now();
  battleStartedAtText = new Date(battleStartedAt).toISOString();
  lastResourceUpdateAt = battleStartedAt;
  isBattleRunning = true;
  updateBattleButton();
  return true;
}

function startBattle() {
  if (isBattleRunning) {
    return;
  }

  if (!prepareBattleSession({ openScreen: true })) {
    return;
  }

  log("전투 시작!");
}

function abortBattle() {
  [...playerSquad, ...enemySquad].forEach(clearBattleEffects);
  skillAreaImpacts = [];
  skillChainImpacts = [];
  battleFields = [];
  if (!isBattleRunning) {
    return;
  }

  lastBattleDurationMs = battleStartedAt ? Date.now() - battleStartedAt : lastBattleDurationMs;
  isBattleRunning = false;
  battleStartedAt = null;
  battleStartedAtText = "";
  lastResourceUpdateAt = null;
  updateBattleButton();
  clearBattleEventLogs();
  log("전투 중단");
}

function toggleBattle() {
  if (isBattleRunning) {
    abortBattle();
  } else {
    startBattle();
  }
}

function setSpeed(speed) {
  gameSpeed = speed;
  log(`배속 x${speed}`);
}

function updateBattleButton() {
  battleBtnEl.innerText = "전투 시작";
  battleBtnEl.disabled = isBattleRunning || isImmediateBattleResolving;
  if (abortBattleBtnEl) {
    abortBattleBtnEl.disabled = !isBattleRunning || isImmediateBattleResolving;
  }
  if (quickBattleResultBtnEl) {
    quickBattleResultBtnEl.disabled = isImmediateBattleResolving;
  }
}

async function showImmediateBattleResult() {
  if (isImmediateBattleResolving) {
    return;
  }

  if (!isBattleRunning && !prepareBattleSession({ openScreen: false })) {
    return;
  }

  isImmediateBattleResolving = true;
  updateBattleButton();
  const maxTicks = 60 * 60 * 10;
  let ticks = 0;
  log("전투 결과를 바로 계산합니다.");

  try {
    while (isBattleRunning && ticks < maxTicks) {
      runBattleTick();
      ticks++;

      if (ticks % 1000 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    draw();
    updateStatusUI();

    if (isBattleRunning) {
      isImmediateBattleResolving = false;
      abortBattle();
      alert("제한 시간 안에 승패가 나지 않아 전투를 중단했습니다.");
      return;
    }

    log(`전투 결과 계산 완료 (${ticks}틱)`);
    alert(`전투 결과: ${lastResolvedBattleResult}`);
  } finally {
    isImmediateBattleResolving = false;
    updateBattleButton();
  }
}

window.startBattle = startBattle;
window.abortBattle = abortBattle;
window.showImmediateBattleResult = showImmediateBattleResult;

function updateMovement() {
  playerSquad.forEach(unit => moveUnit(unit, enemySquad));
  enemySquad.forEach(unit => moveUnit(unit, playerSquad));
}

function moveUnit(unit, targets) {
  if (!unit.alive) {
    return;
  }

  if (unit.castTimer > 0 || unit.channelAction || hasBattleState(unit,"stun") || hasBattleState(unit,"root")) {
    unit.vx = 0;
    unit.vy = 0;
    unit.isMoving = false;
    return;
  }

  if (unit.isSummon && unit.ai === "healer") {
    targets = getSummonSquad(unit).filter(candidate => candidate !== unit && candidate.alive && candidate.hp < candidate.maxHp);
  }
  const target = targets.find(candidate => candidate.alive);
  if (!target) {
    return;
  }

  const dx = target.x - unit.x;
  const dy = target.y - unit.y;
  const dist = Math.hypot(dx, dy);

  if (dist === 0) {
    return;
  }

  const speed = (unit.speed ?? ROLE_STATS[unit.role]?.speedMultiplier ?? 1) * (unit.exhausted ? EXHAUSTED_MOVE_MULTIPLIER : 1);
  const desiredRange = getUnitRange(unit);

  if (dist > desiredRange) {
    unit.vx = (dx / dist) * speed;
    unit.vy = (dy / dist) * speed;
  } else if (dist < desiredRange - 5 && ["ranged", "healer"].includes(unit.ai ?? unit.role)) {
    unit.vx = -(dx / dist) * speed;
    unit.vy = -(dy / dist) * speed;
  } else {
    unit.vx = 0;
    unit.vy = 0;
  }

  unit.isMoving = Math.hypot(unit.vx, unit.vy) > 0;

  const startX = unit.x, startY = unit.y;
  unit.x += unit.vx;
  unit.y += unit.vy;
  clampPosition(unit);
  unit.moveDistanceTotal = (unit.moveDistanceTotal ?? 0) + Math.hypot(unit.x-startX, unit.y-startY) / ATTACK_RANGE_UNIT;
}

function resolveCollision() {
  const units = [...playerSquad, ...enemySquad];

  for (let i = 0; i < units.length; i++) {
    for (let j = i + 1; j < units.length; j++) {
      const a = units[i];
      const b = units[j];

      if (!a.alive || !b.alive) {
        continue;
      }

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);

      if (dist >= COLLISION_DISTANCE || dist === 0) {
        continue;
      }

      const overlap = (COLLISION_DISTANCE - dist) / 2;
      const nx = dx / dist;
      const ny = dy / dist;

      a.x -= nx * overlap;
      a.y -= ny * overlap;
      b.x += nx * overlap;
      b.y += ny * overlap;

      clampPosition(a);
      clampPosition(b);
    }
  }
}

function updateCombat() {
  const alivePlayers = playerSquad.filter(unit => unit.alive);
  const aliveEnemies = enemySquad.filter(unit => unit.alive);

  const playersContinue = canSquadContinueBattle(playerSquad);
  const enemiesContinue = canSquadContinueBattle(enemySquad);
  if (!playersContinue || !enemiesContinue) {
    finishBattle(playersContinue === enemiesContinue ? "무승부" : playersContinue ? "승리" : "패배");
    return;
  }

  alivePlayers.forEach(unit => takeAction(unit, alivePlayers, aliveEnemies));
  aliveEnemies.forEach(unit => takeAction(unit, aliveEnemies, alivePlayers));
}

function takeAction(unit, allies, enemies) {
  if (!unit.alive) return;
  tickSkillCooldowns(unit);
  if (hasBattleState(unit,"stun")) return;
  const hasIndependentWeapons=(unit.weaponAttackStates?.length ?? 0)>1;
  if (hasIndependentWeapons) updateIndependentWeaponAttacks(unit,enemies);
  if (updateBattleChannel(unit)) return;
  if (updateCast(unit)) {
    return;
  }

  if (tryUseReadySkill(unit, allies, enemies)) {
    return;
  }

  if (hasIndependentWeapons) return;

  if (unit.attackCooldown > 0) {
    unit.attackCooldown--;
    return;
  }

  if ((unit.ai ?? unit.role) === "healer") {
    const target = findHealTarget(unit, allies);
    if (!target) {
      return;
    }

    if (!hasEnoughMpForAction(unit)) {
      return;
    }

    spendMpForAction(unit);
    startCast(unit, { type: "heal", target });
    return;
  }

  const target = findTarget(unit, enemies);
  if (!target) {
    return;
  }

  if (isMagicAttackUnit(unit)) {
    if (!hasEnoughMpForAction(unit)) {
      return;
    }

    spendMpForAction(unit);
    startCast(unit, { type: "attack", target, ranged: getUnitRange(unit) > ATTACK_RANGE_UNIT });
  } else {
    if (!hasEnoughStForPhysicalAttack(unit)) {
      return;
    }

    spendStForPhysicalAttack(unit);
    startCast(unit, { type: "attack", target, ranged: getUnitRange(unit) > ATTACK_RANGE_UNIT });
  }
}

function tickSkillCooldowns(unit) {
  Object.keys(unit.skillCooldowns ?? {}).forEach(skillId => {
    unit.skillCooldowns[skillId] = Math.max(0, (Number(unit.skillCooldowns[skillId]) || 0) - 1);
  });
}

function tryUseReadySkill(unit, allies, enemies) {
  if (hasBattleState(unit,"stun") || hasBattleState(unit,"silence")) return false;
  const nextSkillModifier=getNextSkillModifier(unit);
  const skill = getEquippedSkills(unit).find(candidate => {
    const cooldownLeft = Number(unit.skillCooldowns?.[candidate.id]) || 0;
    return cooldownLeft <= 0 && canPaySkillResourceCosts(unit, candidate, nextSkillModifier.resourceCostPercent) && resolveSkillTarget(unit, candidate, allies, enemies);
  });

  if (!skill) {
    return false;
  }

  const target = resolveSkillTarget(unit, skill, allies, enemies);
  const resourceSpent=spendSkillResourceCosts(unit, skill, nextSkillModifier.resourceCostPercent);
  consumeNextSkillModifier(unit,nextSkillModifier);
  showSkillBubble(unit, skill.name);
  startCast(unit, { type: "skill", target, skill, resourceSpent, skillModifier:nextSkillModifier, ranged: distance(unit, target) > ATTACK_RANGE_UNIT });
  return true;
}

function showSkillBubble(unit, text) {
  unit.skillBubbleText = String(text ?? "");
  unit.skillBubbleTimer = 90;
}

function resolveSkillTarget(unit, skill, allies, enemies) {
  if (!isSkillExecutable(skill)) return null;
  for (const action of skill.actions) {
    const target = resolveSkillActionTarget(unit, action, null, skill);
    if (target) return target;
  }
  return null;
}

function startCast(unit, action) {
  if (unit.channelAction) return;
  if (hasBattleState(unit,"stun") || (action.type === "skill" && hasBattleState(unit,"silence"))) return;
  const skill = action.type === "skill" ? action.skill : getUnitSkill(unit, action.type === "heal" ? DEFAULT_HEAL_SKILL_ID : DEFAULT_ATTACK_SKILL_ID);
  if (!isSkillExecutable(skill)) return;
  const castTime = normalizeSkillCastTime(unit.isSummon && action.type !== "skill" ? unit.castSpeed : skill?.castTime);
  const castDuration = Math.round((castTime == null ? getCastDuration(unit) : castTime * BASE_ATTACK_COOLDOWN) * (action.skillModifier?.castTimePercent ?? 100) / 100);

  markAction(unit);
  const pendingAction = { ...action, skill };
  unit.pendingAction = pendingAction;
  unit.castTimer = castDuration;
  unit.castDuration = castDuration;
  publishBattleEvents([{type:"cast_start",source:unit,target:action.target,skill}]);
  if (!unit.alive || unit.pendingAction !== pendingAction) return;
  if (castDuration <= 0) {
    unit.pendingAction = null;
    resolveCastAction(unit, pendingAction);
    if (action.type !== "skill" && !unit.channelAction) {
      setCooldownAfterCast(unit, castDuration);
    }
    return;
  }

}

function updateCast(unit) {
  if (unit.castTimer <= 0) {
    return false;
  }

  markAction(unit);
  unit.castTimer--;
  if (unit.castTimer <= 0) {
    const action = unit.pendingAction;

    unit.pendingAction = null;
    unit.castDuration = 0;
    resolveCastAction(unit, action);
    if (action.type !== "skill" && !unit.channelAction) {
      setCooldownAfterCast(unit, getCastDuration(unit));
    }
  }

  return true;
}

function setCooldownAfterCast(unit, castDuration) {
  unit.attackCooldown = Math.max(0, getAttackCooldown(unit) - castDuration);
}

function resolveCastAction(unit, action) {
  if (!unit.alive || !action) {
    return;
  }

  const completedSkill = action.skill ?? getUnitSkill(unit,action.type === "heal" ? DEFAULT_HEAL_SKILL_ID : DEFAULT_ATTACK_SKILL_ID);
  if (completedSkill.slot !== "passive" && normalizeSkillChannel(completedSkill.channel).duration > 0) {
    startBattleChannel(unit,action,completedSkill);return;
  }
  publishBattleEvents([{type:"cast_complete",source:unit,target:action.target,skill:completedSkill}]);
  if (!unit.alive || hasBattleState(unit,"stun") || (action.type === "skill" && hasBattleState(unit,"silence"))) return;

  if (action.type === "skill") {
    resolveSkillCast(unit, action);
  } else if (action.type === "heal") {
    spawnProjectile(unit, action.target, "heal", completedSkill);
  } else if (action.ranged) {
    spawnProjectile(unit, action.target, "attack", completedSkill);
  } else {
    doAttack(unit, action.target, completedSkill);
  }
}

function resolveSkillCast(unit, action) {
  const skill = action.skill;
  if (!skill) {
    return;
  }

  unit.skillCooldowns[skill.id] = getModifiedSkillCooldownTicks(skill,unit,action.skillModifier);
  dispatchSkillActions(unit, action.target, skill, true, false, null, action.resourceSpent);
}

function getIndependentWeaponSkill(unit,weapon,target) {
  const assigned=getSkillById(weapon.attackSkillId);
  const base=isSkillExecutable(assigned) && assigned.slot !== "passive"
    ? assigned : createDefaultAttackSkillForUnit({...unit,attackType:weapon.attackType,attackSkillId:""});
  const skill=structuredClone(base);
  const focusedCount=(unit.weaponAttackStates ?? []).filter(state=>state.focusTarget===target).length;
  skill.weaponDamagePercent=Math.max(0,100-(Number(unit.sameTargetWeaponPenaltyPercent)||0)*Math.max(0,focusedCount-1));
  skill.actions=skill.actions.map(action=>action.rangeMode === "mainWeapon"
    ? {...action,rangeMode:"custom",rangeValue:weapon.attackRange} : action);
  return skill;
}

function canPayIndependentWeaponCost(unit,weapon) {
  return weapon.attackType === "magic" ? (Number(unit.mp)||0)>=MP_ACTION_COST : (Number(unit.st)||0)>=ST_PHYSICAL_ATTACK_COST;
}

function spendIndependentWeaponCost(unit,weapon) {
  if (weapon.attackType === "magic") unit.mp=Math.max(0,(Number(unit.mp)||0)-MP_ACTION_COST);
  else {
    unit.st=Math.max(0,(Number(unit.st)||0)-ST_PHYSICAL_ATTACK_COST);
    if (unit.st<=0) unit.exhausted=true;
  }
}

function resolveIndependentWeaponAttack(unit,state) {
  const target=state.target;
  state.target=null;
  if (!unit.alive || !target?.alive) return;
  const skill=getIndependentWeaponSkill(unit,state.weapon,target);
  if (state.weapon.attackRange>1) spawnProjectile(unit,target,"attack",skill);
  else doAttack(unit,target,skill);
}

function updateIndependentWeaponAttacks(unit,enemies) {
  const resolving=[];
  unit.weaponAttackStates.forEach(state=>{
    if (state.cooldown>0) state.cooldown--;
    if (state.castTimer>0) {
      state.castTimer--;
      if (state.castTimer<=0) resolving.push(state);
      return;
    }
    if (state.cooldown>0 || !canPayIndependentWeaponCost(unit,state.weapon)) return;
    const range=state.weapon.attackRange*ATTACK_RANGE_UNIT;
    const target=enemies.filter(enemy=>enemy.alive && distance(unit,enemy)<=range).sort((a,b)=>distance(unit,a)-distance(unit,b))[0];
    if (!target) return;
    spendIndependentWeaponCost(unit,state.weapon);
    markAction(unit);
    state.target=target;
    state.focusTarget=target;
    state.cooldown=Math.max(1,Math.round(BASE_ATTACK_COOLDOWN*state.weapon.attackSpeed));
    state.castTimer=Math.max(0,Math.round(BASE_ATTACK_COOLDOWN*state.weapon.castSpeed));
    if (state.castTimer<=0) resolving.push(state);
  });
  resolving.forEach(state=>resolveIndependentWeaponAttack(unit,state));
}

function getClampedPosition(unit,x,y) {
  const margin=UNIT_RADIUS;
  const bounds=unit.isEntityPreview ? unit.previewBounds ?? canvas : canvas;
  return {x:Math.max(margin,Math.min(bounds.width-margin,x)),y:Math.max(margin,Math.min(bounds.height-margin,y))};
}

function moveUnitWithCollision(unit,desiredX,desiredY,{sweep=true}={}) {
  const startX=unit.x,startY=unit.y;
  const desired=getClampedPosition(unit,desiredX,desiredY);
  const vx=desired.x-startX,vy=desired.y-startY;
  if (!(Math.hypot(vx,vy)>0)) return 0;
  const units=unit.isEntityPreview ? [] : [...playerSquad,...enemySquad].filter(other=>other!==unit && other.alive);
  if (!sweep) {
    if (units.some(other=>Math.hypot(desired.x-other.x,desired.y-other.y)<COLLISION_DISTANCE)) return 0;
    unit.x=desired.x;unit.y=desired.y;
    return Math.hypot(vx,vy);
  }

  let maxT=1;
  for (const other of units) {
    const px=startX-other.x,py=startY-other.y;
    const startDistance=Math.hypot(px,py);
    const endDistance=Math.hypot(desired.x-other.x,desired.y-other.y);
    if (startDistance<COLLISION_DISTANCE) {
      if (endDistance>=startDistance) continue;
      maxT=0;break;
    }
    const a=vx*vx+vy*vy,b=2*(px*vx+py*vy),c=px*px+py*py-COLLISION_DISTANCE*COLLISION_DISTANCE;
    const discriminant=b*b-4*a*c;
    if (discriminant<0) continue;
    const hit=(-b-Math.sqrt(discriminant))/(2*a);
    if (hit>=0 && hit<=maxT) maxT=Math.max(0,hit);
  }
  unit.x=startX+vx*maxT;unit.y=startY+vy*maxT;
  return Math.hypot(unit.x-startX,unit.y-startY);
}

function createBattleField(source,target,action,skill) {
  if (source?.isEntityPreview) return;
  const center=action.fieldCenter === "self" || action.target === "self" ? source : target;
  if (!center || !(action.fieldRadius > 0) || !(action.fieldInterval > 0)) return;
  const snapshot=structuredClone(action);snapshot._actionIndex=skill?.actions?.indexOf(action) ?? -1;
  battleFields.push({source,skill,action:snapshot,x:center.x,y:center.y,
    remainingTicks:action.duration > 0 ? Math.max(1,Math.ceil(action.duration*BASE_ATTACK_COOLDOWN)) : null,
    nextTick:Math.max(1,Math.ceil(action.fieldInterval*BASE_ATTACK_COOLDOWN))});
  publishBattleEvents([{type:"field_create",source,target,skill}]);
  addBattleEventLog(source,`${source.name}: ${skill?.name ?? "필드"} 생성 (${action.fieldRadius} 반경)`);
}

function updateBattleFields() {
  battleFields=battleFields.filter(field => {
    const {source,skill,action}=field;
    if (--field.nextTick <= 0) {
      field.nextTick=Math.max(1,Math.ceil(action.fieldInterval*BASE_ATTACK_COOLDOWN));
      const own=source.side === "enemy" ? enemySquad : playerSquad;
      const other=source.side === "enemy" ? playerSquad : enemySquad;
      const resource=action.fieldEffect === "heal" ? getResourceField(action.healResource) : null;
      const drained=action.fieldEffect === "drain_resource" ? getResourceField(action.drainResource) : null;
      const targetPool=action.target === "enemy" ? other : action.target === "summon" ? own.filter(unit=>unit.isSummon && unit.summoner===source) : own;
      let targets=targetPool.filter(unit => unit.alive
        && distance(unit,field) <= action.fieldRadius*ATTACK_RANGE_UNIT
        && (!resource || normalizeResourceReference(action.healResource) === "BP" || (getUnitResourceState(unit,action.healResource) && getUnitResourceCurrent(unit,action.healResource) < getUnitResourceMax(unit,action.healResource)))
        && (!drained || getUnitResourceCurrent(unit,action.drainResource)>0));
      targets.sort((a,b)=>resource && normalizeResourceReference(action.healResource) !== "BP"
        ? getUnitResourceCurrent(a,action.healResource)/Math.max(1,getUnitResourceMax(a,action.healResource))-getUnitResourceCurrent(b,action.healResource)/Math.max(1,getUnitResourceMax(b,action.healResource)) || distance(a,field)-distance(b,field)
        : distance(a,field)-distance(b,field));
      if (action.target === "self") targets=targets.filter(unit=>unit===source);
      if (action.maxTargets > 0) targets=targets.slice(0,action.maxTargets);
      const applied={...action,type:action.fieldEffect,area:0,chainCount:0,
        ...(["add_buff","add_state"].includes(action.fieldEffect) ? {duration:action.fieldEffectDuration} : {}),
        ...(action.fieldEffect === "move" ? {moveType:action.fieldMoveType,distance:action.fieldDistance,_moveOrigin:{x:field.x,y:field.y}} : {})};
      for(const target of targets) applySkillAction(source,target,applied,skill,createSkillExecutionContext());
      publishBattleEvents([{type:"field_tick",source,skill}]);
    }
    if (field.remainingTicks === null || --field.remainingTicks > 0) return true;
    publishBattleEvents([{type:"field_expire",source,skill}]);
    return false;
  });
}

function dispatchSkillActions(source, preferredTarget, skill, allowProjectiles, forceProjectile = false, channelAction = null, resourceSpent = null) {
  if (!source?.alive || !isSkillExecutable(skill)) return;
  if (skillUsesExecutionResults(skill)) {
    dispatchSkillActionSequence(source,preferredTarget,skill,allowProjectiles,forceProjectile,channelAction,0,createSkillExecutionContext(resourceSpent));
    return;
  }
  const hasMovement = skill.actions.some(action => action.type === "move");
  skill.actions.forEach(action => {
    if (!source.alive || (channelAction && source.channelAction !== channelAction)) return;
    const target = resolveSkillActionTarget(source, action, preferredTarget, skill);
    if (!target) return;
    const ranged = allowProjectiles && !hasMovement && ["deal_damage", "heal", "drain_resource"].includes(action.type)
      && target !== source && (forceProjectile || distance(source, target) > ATTACK_RANGE_UNIT)
      && !(!isChainAction(action) && action.area > 0 && (action.areaCenter === "self" || action.target === "self"));
    if (ranged) {
      projectiles.push({source, target, type: action.type === "heal" ? "heal" : "skill", skill,
        skillAction: action, x: source.x, y: source.y});
    } else {
      applySkillAction(source, target, action, skill);
    }
  });
}

function dispatchSkillActionSequence(source, preferredTarget, skill, allowProjectiles, forceProjectile, channelAction, startIndex, execution) {
  const hasMovement = skill.actions.some(action => action.type === "move");
  for (let index=startIndex; index<skill.actions.length; index++) {
    if (!source.alive || (channelAction && source.channelAction !== channelAction)) return;
    const action=skill.actions[index];
    const target=resolveSkillActionTarget(source,action,preferredTarget,skill);
    if (!target) {
      execution.previousActualDamage=0;
      execution.previousActualHealing=0;
      execution.previousResourceDrained=0;
      continue;
    }
    const ranged=allowProjectiles && !hasMovement && ["deal_damage","heal","drain_resource"].includes(action.type)
      && target !== source && (forceProjectile || distance(source,target)>ATTACK_RANGE_UNIT)
      && !(!isChainAction(action) && action.area>0 && (action.areaCenter === "self" || action.target === "self"));
    if (ranged) {
      projectiles.push({source,target,type:action.type === "heal" ? "heal" : "skill",skill,skillAction:action,
        execution,resumeActionIndex:index+1,preferredTarget,allowProjectiles,forceProjectile,channelAction,x:source.x,y:source.y});
      return;
    }
    applySkillAction(source,target,action,skill,execution);
  }
}

function findTarget(unit, enemies) {
  const attackRange = getUnitRange(unit);
  return enemies.find(enemy => enemy.alive && distance(unit, enemy) <= attackRange);
}

function findHealTarget(healer, team) {
  const healRange = getUnitRange(healer);
  return team.find(unit => unit.alive && unit.hp < unit.maxHp && distance(healer, unit) <= healRange);
}

function applyHeal(healer, target, skill = getUnitSkill(healer, DEFAULT_HEAL_SKILL_ID)) {
  if (!target.alive || target.hp <= 0) {
    return;
  }

  applySkill(healer, target, skill);
}

function doAttack(attacker, target, skill = getUnitSkill(attacker, DEFAULT_ATTACK_SKILL_ID)) {
  applySkill(attacker, target, skill);
}

function spawnProjectile(source, target, type, skill) {
  dispatchSkillActions(source, target, skill, true, true);
}

function updateProjectiles() {
  const activeProjectiles = [];

  projectiles.forEach(projectile => {
    const { source, target, type, skill } = projectile;

    if (!source.alive) {
      return;
    }
    if (!target.alive) {
      if (projectile.resumeActionIndex != null) {
        projectile.execution.previousActualDamage=0;
        projectile.execution.previousActualHealing=0;
        projectile.execution.previousResourceDrained=0;
        dispatchSkillActionSequence(source,projectile.preferredTarget,skill,projectile.allowProjectiles,
          projectile.forceProjectile,projectile.channelAction,projectile.resumeActionIndex,projectile.execution);
      }
      return;
    }

    const dx = target.x - projectile.x;
    const dy = target.y - projectile.y;
    const dist = Math.hypot(dx, dy);

    if (dist <= PROJECTILE_SPEED || dist === 0) {
      if (projectile.skillAction) {
        applySkillAction(source, target, projectile.skillAction, skill, projectile.execution);
        if (projectile.resumeActionIndex != null) dispatchSkillActionSequence(source,projectile.preferredTarget,skill,
          projectile.allowProjectiles,projectile.forceProjectile,projectile.channelAction,projectile.resumeActionIndex,projectile.execution);
      } else if (type === "heal") {
        applyHeal(source, target, skill);
      } else if (type === "skill") {
        applySkill(source, target, skill);
      } else {
        doAttack(source, target, skill);
      }
      return;
    }

    projectile.x += (dx / dist) * PROJECTILE_SPEED;
    projectile.y += (dy / dist) * PROJECTILE_SPEED;
    activeProjectiles.push(projectile);
  });

  projectiles = activeProjectiles;
}

function updateEffects() {
  [...playerSquad, ...enemySquad].forEach(unit => {
    if (unit.effectTimer > 0) {
      unit.effectTimer--;
      if (unit.effectTimer === 0) {
        unit.effectType = null;
      }
    }
    if (unit.skillBubbleTimer > 0) {
      unit.skillBubbleTimer--;
      if (unit.skillBubbleTimer === 0) {
        unit.skillBubbleText = "";
      }
    }
  });
}

function drawSkillBubble(unit, statusOffset) {
  if (!unit.skillBubbleText || unit.skillBubbleTimer <= 0) {
    return;
  }

  const text = unit.skillBubbleText;
  ctx.save();
  ctx.font = `${11 * scale}px Arial`;
  const paddingX = 8 * scale;
  const width = Math.max(42 * scale, ctx.measureText(text).width + paddingX * 2);
  const height = 22 * scale;
  const x = unit.x - width / 2;
  const y = unit.y - statusOffset - 34 * scale;
  const radius = 8 * scale;

  ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
  ctx.strokeStyle = "#0d6efd";
  ctx.lineWidth = Math.max(1, 1.5 * scale);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(unit.x + 5 * scale, y + height);
  ctx.lineTo(unit.x, y + height + 6 * scale);
  ctx.lineTo(unit.x - 5 * scale, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#111827";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, unit.x, y + height / 2);
  ctx.restore();
}

function drawUnit(unit, isEnemy) {
  if (!unit.alive) {
    return;
  }

  const isBlinkFrame = unit.effectTimer > 0 && Math.floor(unit.effectTimer / 3) % 2 === 0;
  const baseColor = isEnemy ? "red" : getRoleColor(unit.role);
  const portraitImage = getCachedPortraitImage(unit.portrait);
  const portraitRadius = UNIT_RADIUS * 2.6 * scale;

  if (portraitImage?.complete && portraitImage.naturalWidth > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(unit.x, unit.y, portraitRadius, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(
      portraitImage,
      unit.x - portraitRadius,
      unit.y - portraitRadius,
      portraitRadius * 2,
      portraitRadius * 2
    );
    ctx.restore();

    ctx.strokeStyle = isBlinkFrame ? EFFECT_COLORS[unit.effectType] ?? baseColor : baseColor;
    ctx.lineWidth = Math.max(1, 2 * scale);
    ctx.beginPath();
    ctx.arc(unit.x, unit.y, portraitRadius, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = isBlinkFrame ? EFFECT_COLORS[unit.effectType] ?? baseColor : baseColor;
    ctx.beginPath();
    ctx.arc(unit.x, unit.y, UNIT_RADIUS * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  const hpRatio = unit.hp / unit.maxHp;
  const statusOffset = portraitImage?.complete && portraitImage.naturalWidth > 0 ? portraitRadius + 7 * scale : 12 * scale;

  ctx.fillStyle = "red";
  ctx.fillRect(unit.x - 10 * scale, unit.y - statusOffset, 20 * scale, 3 * scale);

  ctx.fillStyle = "green";
  ctx.fillRect(unit.x - 10 * scale, unit.y - statusOffset, 20 * scale * hpRatio, 3 * scale);

  ctx.fillStyle = "black";
  ctx.font = `${10 * scale}px Arial`;
  ctx.fillText(unit.name, unit.x - 12 * scale, unit.y - statusOffset - 4 * scale);

  drawSkillBubble(unit, statusOffset);
  const effectsText = getBattleEffectLabel(unit);
  if (effectsText) {
    ctx.save();ctx.fillStyle="#7c3aed";ctx.font=`${10 * scale}px Arial`;ctx.textAlign="center";
    ctx.fillText(effectsText,unit.x,unit.y + statusOffset + 12 * scale);ctx.restore();
  }
}

function drawProjectiles() {
  projectiles.forEach(projectile => {
    ctx.fillStyle = projectile.type === "heal" ? "#4fd88b" : "#ff9b54";
    ctx.beginPath();
    ctx.arc(projectile.x, projectile.y, 3 * scale, 0, Math.PI * 2);
    ctx.fill();
  });
}

function createSkillAreaIndicator(source, target, action, skill, phase, progress = 0) {
  if (isChainAction(action)) return null;
  if (source.isEntityPreview || !supportsActionArea(action.type) || !(action.area > 0)) return null;
  const center = getSkillAreaCenter(source, target, action);
  if (!center) return null;
  return {
    x: center.x, y: center.y, radius: action.area * ATTACK_RANGE_UNIT,
    color: source.side === "enemy" ? "#ef4444" : action.type === "heal" || action.type === "add_buff" || action.type.startsWith("delete_") ? "#16a34a" : action.type === "add_state" ? "#9333ea" : "#2563eb",
    label: `${source.side === "enemy" ? "적군" : "아군"} · ${skill?.name ?? "광역"}`,
    phase, progress
  };
}

function showSkillAreaImpact(source, target, action, skill) {
  const indicator = createSkillAreaIndicator(source, target, action, skill, "impact", 1);
  if (!indicator) return;
  skillAreaImpacts.push({ ...indicator, expiresAt: performance.now() + SKILL_AREA_IMPACT_MS });
  if (skillAreaImpacts.length > 128) skillAreaImpacts.shift();
}

function getSkillAreaIndicators(now = performance.now()) {
  skillAreaImpacts = skillAreaImpacts.filter(effect => effect.expiresAt > now);
  const indicators = skillAreaImpacts.map(effect => ({ ...effect, alpha: (effect.expiresAt - now) / SKILL_AREA_IMPACT_MS }));
  if (!isBattleRunning) return indicators;
  const append = (source, target, skill, phase, progress, skillAction = null) => {
    if (!source?.alive) return;
    (skillAction ? [skillAction] : skill?.actions ?? []).forEach(action => {
      const resolved = skillAction ? (target?.alive ? target : null) : resolveSkillActionTarget(source, action, target, skill);
      if (!resolved) return;
      const indicator = createSkillAreaIndicator(source, resolved, action, skill, phase, progress);
      if (indicator) indicators.push(indicator);
    });
  };
  [...playerSquad, ...enemySquad].forEach(unit => {
    if (unit.channelAction) {
      append(unit,unit.channelAction.target,unit.channelAction.skill,"cast",1-unit.channelTimer/Math.max(1,unit.channelDuration));
    }
    if (unit.castTimer > 0 && unit.pendingAction) {
      append(unit, unit.pendingAction.target, unit.pendingAction.skill, "cast", 1 - unit.castTimer / Math.max(1, unit.castDuration));
    }
  });
  projectiles.forEach(projectile => append(projectile.source, projectile.target, projectile.skill, "flight", 1, projectile.skillAction));
  return indicators;
}

function drawSkillAreas() {
  getSkillAreaIndicators().forEach(area => {
    ctx.save();
    ctx.fillStyle = area.color;
    ctx.strokeStyle = area.color;
    ctx.globalAlpha = area.phase === "impact" ? 0.28 * area.alpha : 0.12;
    ctx.beginPath();
    ctx.arc(area.x, area.y, area.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = area.alpha ?? 0.85;
    ctx.lineWidth = 2;
    ctx.setLineDash(area.phase === "cast" ? [6, 4] : []);
    ctx.stroke();
    ctx.setLineDash([]);
    if (area.phase === "cast") {
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(area.x, area.y, area.radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * area.progress);
      ctx.stroke();
    }
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    const phase = area.phase === "cast" ? "시전 중" : area.phase === "flight" ? "도달 중" : "발동";
    ctx.fillText(`${area.label} · ${phase}`, area.x, Math.max(12, area.y - area.radius - 7));
    ctx.restore();
  });
}

function showSkillChainImpact(source, targets, action) {
  if (source.isEntityPreview || targets.length < 2) return;
  skillChainImpacts.push({points: targets.map(unit => ({x:unit.x, y:unit.y})),
    color: source.side === "enemy" ? "#ef4444" : action.type === "heal" ? "#16a34a" : "#2563eb",
    expiresAt: performance.now() + 400});
  if (skillChainImpacts.length > 128) skillChainImpacts.shift();
}

function drawSkillChains() {
  const now = performance.now();
  skillChainImpacts = skillChainImpacts.filter(effect => effect.expiresAt > now);
  skillChainImpacts.forEach(effect => {
    ctx.save();ctx.strokeStyle=effect.color;ctx.fillStyle=effect.color;
    ctx.globalAlpha=(effect.expiresAt-now)/400;ctx.lineWidth=3;
    ctx.beginPath();
    effect.points.forEach((point,index) => {
      if (index === 0) ctx.moveTo(point.x,point.y);
      else ctx.lineTo(point.x,point.y);
    });
    ctx.stroke();
    effect.points.forEach(point => {ctx.beginPath();ctx.arc(point.x,point.y,5,0,Math.PI*2);ctx.fill();});
    ctx.restore();
  });
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBattleFields();
  drawSkillAreas();
  playerSquad.forEach(unit => drawUnit(unit, false));
  enemySquad.forEach(unit => drawUnit(unit, true));
  drawProjectiles();
  drawSkillChains();
}

function drawBattleFields() {
  battleFields.forEach(field=>{
    const color=field.source.side === "enemy" ? "#ef4444" : ["heal","add_buff"].includes(field.action.fieldEffect) ? "#16a34a" : field.action.fieldEffect === "move" ? "#0891b2" : "#7c3aed";
    ctx.save();ctx.strokeStyle=color;ctx.fillStyle=color;ctx.globalAlpha=.16;ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(field.x,field.y,field.action.fieldRadius*ATTACK_RANGE_UNIT,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=.8;ctx.stroke();ctx.font="11px sans-serif";ctx.textAlign="center";
    const time=field.remainingTicks === null ? "∞" : `${(field.remainingTicks/BASE_ATTACK_COOLDOWN).toFixed(1)}초`;
    ctx.fillText(`${field.skill?.name ?? "필드"} · ${time}`,field.x,Math.max(12,field.y-field.action.fieldRadius*ATTACK_RANGE_UNIT-7));ctx.restore();
  });
}

function resetGame() {
  resetBattleEvents();
  skillAreaImpacts = [];
  skillChainImpacts = [];
  battleFields = [];
  isBattleRunning = false;
  gameSpeed = 1;
  playerSquad = [];
  enemySquad = [];
  activeBattleSideBaseRules = { player: normalizeTeamBattleRules(), enemy: normalizeTeamBattleRules() };
  activeBattleSideRules = { player: normalizeTeamBattleRules(), enemy: normalizeTeamBattleRules() };
  clearBattleEventLogs();
  selectedBattleTeamIds.clear();
  selectedBattleCharacterIds.clear();
  selectedEnemyTeamIndex = "";
  projectiles = [];
  battleStartedAt = null;
  battleStartedAtText = "";
  lastResourceUpdateAt = null;
  lastBattleDurationMs = 0;

  initCharacters();
  renderBattleTeamButtons();
  renderBattleEnemyControls();
  renderBattleSelectionSummary();
  updateBattleButton();
  updateStatusUI();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  log("게임 초기화 완료");
}

let lastGameLoopAt = performance.now();

function runBattleTick() {
  if (isBattleRunning) {
    updateResources();

    for (let i = 0; i < gameSpeed; i++) {
      if (!isBattleRunning) {
        break;
      }

      combatEventTick++;
      updateBattleEffects();
      updateRuntimeRuleOverrides();
      updateBattleReentries();
      updateBattleFields();
      updateSummonLifetimes();
      updateMovement();
      resolveCollision();
      updateCombat();
      if (!isBattleRunning) break;
      updateProjectiles();
      updateEffects();
    }
  } else {
    updateEffects();
  }
}

function gameLoop() {
  const now = performance.now();
  const elapsed = Math.max(0, now - lastGameLoopAt);
  lastGameLoopAt = now;
  const tickCount = Math.max(1, Math.min(MAX_BATTLE_TICKS_PER_LOOP, Math.floor(elapsed / BATTLE_FRAME_MS) || 1));

  for (let tick = 0; tick < tickCount; tick++) {
    runBattleTick();
    if (!isBattleRunning) {
      break;
    }
  }

  draw();
  updateStatusUI();
  window.setTimeout(gameLoop, BATTLE_FRAME_MS);
}


