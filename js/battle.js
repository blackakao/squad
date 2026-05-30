function resetUnitForBattle(unit) {
  unit.hp = unit.maxHp;
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

  battleStartedAt = Date.now();
  battleStartedAtText = new Date(battleStartedAt).toISOString();
  isBattleRunning = true;
  updateBattleButton();
  log("전투 시작!");
}

function stopBattle() {
  isBattleRunning = false;
  battleStartedAt = null;
  battleStartedAtText = "";
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

  const speed = unit.speed ?? ROLE_STATS[unit.role]?.speedMultiplier ?? 1;
  const desiredRange = getUnitRange(unit.role);

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
    if (heal(unit, allies)) {
      unit.attackCooldown = ATTACK_COOLDOWN;
    }
    return;
  }

  const target = findTarget(unit, enemies);
  if (!target) {
    return;
  }

  if (unit.role === "ranged") {
    spawnProjectile(unit, target, "attack");
  } else {
    doAttack(unit, target);
  }

  unit.attackCooldown = ATTACK_COOLDOWN;
}

function findTarget(unit, enemies) {
  if (unit.role === "ranged") {
    return enemies.find(enemy => enemy.alive);
  }

  return enemies.find(enemy => enemy.alive && distance(unit, enemy) < 30);
}

function heal(healer, team) {
  const target = team.find(unit => unit.alive && unit.hp < unit.maxHp);
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

  const amount = 10;
  const previousHp = target.hp;

  target.hp = Math.min(target.maxHp, target.hp + amount);
  healer.stats.heal += target.hp - previousHp;
  triggerEffect(target, "heal");
}

function doAttack(attacker, target) {
  const damage = attacker.atk;

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

  initCharacters();
  updateBattleButton();
  updateStatusUI();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  log("게임 초기화 완료");
}

function gameLoop() {
  if (isBattleRunning) {
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


