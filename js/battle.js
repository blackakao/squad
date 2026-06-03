function resetUnitForBattle(unit) {
  unit.hp = unit.maxHp;
  unit.maxMp = Math.max(0, Number(unit.maxMp ?? DEFAULT_RESOURCE_VALUE));
  unit.mp = unit.maxMp;
  unit.maxSt = Math.max(0, Number(unit.maxSt ?? DEFAULT_RESOURCE_VALUE));
  unit.st = unit.maxSt;
  unit.exhausted = false;
  unit.isMoving = false;
  unit.didAct = false;
  unit.alive = true;
  unit.vx = 0;
  unit.vy = 0;
  unit.attackCooldown = 0;
  unit.stats = createStats();
  unit.effectType = null;
  unit.effectTimer = 0;
}

function log(message) {
  console.log(message);
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
  return !isMagicRole(unit.role) || (Number(unit.mp) || 0) >= MP_ACTION_COST;
}

function spendMpForAction(unit) {
  if (!isMagicRole(unit.role)) {
    return;
  }

  unit.mp = Math.max(0, (Number(unit.mp) || 0) - MP_ACTION_COST);
}

function markAction(unit) {
  unit.didAct = true;
}

function hasEnoughStForPhysicalAttack(unit) {
  if (!isPhysicalAttackRole(unit.role)) {
    return true;
  }

  if ((Number(unit.st) || 0) >= ST_PHYSICAL_ATTACK_COST) {
    return true;
  }

  unit.exhausted = true;
  return false;
}

function spendStForPhysicalAttack(unit) {
  if (!isPhysicalAttackRole(unit.role)) {
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

  unit.x = Math.max(margin, Math.min(canvas.width - margin, unit.x));
  unit.y = Math.max(margin, Math.min(canvas.height - margin, unit.y));
}

function syncAliveState(unit) {
  if (unit.hp <= 0) {
    unit.hp = 0;
    unit.alive = false;
  }
}

function triggerEffect(unit, effectType) {
  unit.effectType = effectType;
  unit.effectTimer = EFFECT_DURATION;
}

async function finishBattle(result) {
  updateResources();
  lastBattleDurationMs = battleStartedAt ? Date.now() - battleStartedAt : lastBattleDurationMs;
  isBattleRunning = false;
  updateBattleButton();

  const record = createBattleRecord(result);
  battleRecordsJson.unshift(record);
  recordPage = 1;
  try {
    await saveBattleRecordsJson();
    renderBattleRecords();
  } catch (error) {
    alert("전투 기록을 저장하지 못했습니다.");
  }
  log(result);

  battleStartedAt = null;
  battleStartedAtText = "";
  lastResourceUpdateAt = null;
}

function startBattle() {
  if (playerSquad.length < 1) {
    alert("최소 1명 필요");
    return;
  }

  if (enemySquad.length < 1) {
    alert("적을 1명 이상 추가해주세요");
    return;
  }

  playerSquad.forEach(resetUnitForBattle);
  enemySquad.forEach(resetUnitForBattle);

  lastBattleDurationMs = 0;
  battleStartedAt = Date.now();
  battleStartedAtText = new Date(battleStartedAt).toISOString();
  lastResourceUpdateAt = battleStartedAt;
  isBattleRunning = true;
  updateBattleButton();
  log("전투 시작!");
}

function stopBattle() {
  lastBattleDurationMs = battleStartedAt ? Date.now() - battleStartedAt : lastBattleDurationMs;
  isBattleRunning = false;
  battleStartedAt = null;
  battleStartedAtText = "";
  lastResourceUpdateAt = null;
  updateBattleButton();
  log("전투 중지");
}

function toggleBattle() {
  if (isBattleRunning) {
    stopBattle();
  } else {
    startBattle();
  }
}

function setSpeed(speed) {
  gameSpeed = speed;
  log(`배속 x${speed}`);
}

function updateBattleButton() {
  battleBtnEl.innerText = isBattleRunning ? "전투 중지" : "전투 시작";
}

function updateMovement() {
  playerSquad.forEach(unit => moveUnit(unit, enemySquad));
  enemySquad.forEach(unit => moveUnit(unit, playerSquad));
}

function moveUnit(unit, targets) {
  if (!unit.alive) {
    return;
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
  } else if (dist < desiredRange - 5 && (unit.role === "ranged" || unit.role === "healer")) {
    unit.vx = -(dx / dist) * speed;
    unit.vy = -(dy / dist) * speed;
  } else {
    unit.vx = 0;
    unit.vy = 0;
  }

  unit.isMoving = Math.hypot(unit.vx, unit.vy) > 0;

  unit.x += unit.vx;
  unit.y += unit.vy;
  clampPosition(unit);
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

  if (alivePlayers.length === 0 || aliveEnemies.length === 0) {
    finishBattle(alivePlayers.length > 0 ? "승리" : "패배");
    return;
  }

  alivePlayers.forEach(unit => takeAction(unit, alivePlayers, aliveEnemies));
  aliveEnemies.forEach(unit => takeAction(unit, aliveEnemies, alivePlayers));
}

function takeAction(unit, allies, enemies) {
  if (unit.attackCooldown > 0) {
    unit.attackCooldown--;
    return;
  }

  if (unit.role === "healer") {
    if (!hasEnoughMpForAction(unit)) {
      return;
    }

    if (heal(unit, allies)) {
      spendMpForAction(unit);
      markAction(unit);
      unit.attackCooldown = getAttackCooldown(unit);
    }
    return;
  }

  const target = findTarget(unit, enemies);
  if (!target) {
    return;
  }

  if (unit.role === "ranged") {
    if (!hasEnoughMpForAction(unit)) {
      return;
    }

    spendMpForAction(unit);
    markAction(unit);
    spawnProjectile(unit, target, "attack");
  } else {
    if (!hasEnoughStForPhysicalAttack(unit)) {
      return;
    }

    spendStForPhysicalAttack(unit);
    markAction(unit);
    doAttack(unit, target);
  }

  unit.attackCooldown = getAttackCooldown(unit);
}

function findTarget(unit, enemies) {
  const attackRange = getUnitRange(unit);
  return enemies.find(enemy => enemy.alive && distance(unit, enemy) <= attackRange);
}

function heal(healer, team) {
  const healRange = getUnitRange(healer);
  const target = team.find(unit => unit.alive && unit.hp < unit.maxHp && distance(healer, unit) <= healRange);
  if (!target) {
    return false;
  }

  spawnProjectile(healer, target, "heal");
  return true;
}

function applyHeal(healer, target) {
  if (!target.alive || target.hp <= 0) {
    return;
  }

  const amount = getHealAmount(healer);
  const previousHp = target.hp;

  target.hp = Math.min(target.maxHp, target.hp + amount);
  healer.stats.heal += target.hp - previousHp;
  triggerEffect(target, "heal");
}

function doAttack(attacker, target) {
  const damage = getReducedDamage(attacker, target);

  target.hp -= damage;
  target.stats.taken += damage;
  attacker.stats.damage += damage;

  syncAliveState(target);
  triggerEffect(target, "damage");
}

function spawnProjectile(source, target, type) {
  projectiles.push({
    source,
    target,
    type,
    x: source.x,
    y: source.y
  });
}

function updateProjectiles() {
  const activeProjectiles = [];

  projectiles.forEach(projectile => {
    const { source, target, type } = projectile;

    if (!target.alive || !source.alive) {
      return;
    }

    const dx = target.x - projectile.x;
    const dy = target.y - projectile.y;
    const dist = Math.hypot(dx, dy);

    if (dist <= PROJECTILE_SPEED || dist === 0) {
      if (type === "heal") {
        applyHeal(source, target);
      } else {
        doAttack(source, target);
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
  });
}

function drawUnit(unit, isEnemy) {
  if (!unit.alive) {
    return;
  }

  const isBlinkFrame = unit.effectTimer > 0 && Math.floor(unit.effectTimer / 3) % 2 === 0;
  const baseColor = isEnemy ? "red" : getRoleColor(unit.role);

  ctx.fillStyle = isBlinkFrame ? EFFECT_COLORS[unit.effectType] ?? baseColor : baseColor;
  ctx.beginPath();
  ctx.arc(unit.x, unit.y, UNIT_RADIUS * scale, 0, Math.PI * 2);
  ctx.fill();

  const hpRatio = unit.hp / unit.maxHp;

  ctx.fillStyle = "red";
  ctx.fillRect(unit.x - 10 * scale, unit.y - 12 * scale, 20 * scale, 3 * scale);

  ctx.fillStyle = "green";
  ctx.fillRect(unit.x - 10 * scale, unit.y - 12 * scale, 20 * scale * hpRatio, 3 * scale);

  ctx.fillStyle = "black";
  ctx.font = `${10 * scale}px Arial`;
  ctx.fillText(unit.name, unit.x - 12 * scale, unit.y - 16 * scale);
}

function drawProjectiles() {
  projectiles.forEach(projectile => {
    ctx.fillStyle = projectile.type === "heal" ? "#4fd88b" : "#ff9b54";
    ctx.beginPath();
    ctx.arc(projectile.x, projectile.y, 3 * scale, 0, Math.PI * 2);
    ctx.fill();
  });
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  playerSquad.forEach(unit => drawUnit(unit, false));
  enemySquad.forEach(unit => drawUnit(unit, true));
  drawProjectiles();
}

function resetGame() {
  isBattleRunning = false;
  gameSpeed = 1;
  playerSquad = [];
  enemySquad = [];
  projectiles = [];
  battleStartedAt = null;
  battleStartedAtText = "";
  lastResourceUpdateAt = null;
  lastBattleDurationMs = 0;

  initCharacters();
  updateBattleButton();
  updateStatusUI();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  log("게임 초기화 완료");
}

function gameLoop() {
  if (isBattleRunning) {
    updateResources();

    for (let i = 0; i < gameSpeed; i++) {
      if (!isBattleRunning) {
        break;
      }

      updateMovement();
      resolveCollision();
      updateCombat();
      updateProjectiles();
      updateEffects();
    }
  } else {
    updateEffects();
  }

  draw();
  updateStatusUI();
  requestAnimationFrame(gameLoop);
}


