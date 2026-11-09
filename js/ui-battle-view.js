// Browser battle presentation. Loaded after ui.js.
function renderBattleSkillRow(unit) {
  if (typeof getSkillById !== "function") return "";
  const transform = (unit?.activeEffects ?? []).find(effect => effect.kind === "transform");
  const ids = transform?.skillIds?.length ? transform.skillIds : unit?.skillIds;
  const skills = [
    ...(Array.isArray(ids) ? ids.map(getSkillById).filter(Boolean).map(skill=>getFormSkill(unit,skill)) : []),
    ...(Array.isArray(unit?.runtimeCopiedSkills) ? unit.runtimeCopiedSkills : [])
  ].filter(skill => !isDefaultSkill(skill.id));
  if (!skills.length) return "";
  return `<div class="battle-skill-row" aria-label="${escapeHtml(unit.name)} 장착 스킬">${skills.map(skill => {
    const remaining = Math.max(0, Number(unit.skillCooldowns?.[skill.id]) || 0);
    const total = Math.max(remaining, Number(unit.skillCooldownTotals?.[skill.id]) || 0);
    const angle = total > 0 ? Math.max(0, Math.min(360, remaining / total * 360)) : 0;
    const seconds = remaining > 0 ? Math.ceil(remaining / BASE_ATTACK_COOLDOWN * 10) / 10 : 0;
    const icon = recordImagePath(skill.icon);
    const effortResource=skill.id === "skill_class_guardian_endurance" ? unit.customResources?.effort_magic : null;
    const effortText=effortResource ? ` · 노력[마법] ${Math.round((Number(effortResource.current) || 0)*10)/10}` : "";
    const combo=typeof normalizeSkillCombo === "function" ? normalizeSkillCombo(skill.combo) : null;
    const comboIndex=combo ? Math.max(0,Math.min(combo.stages.length-1,Math.floor(Number(unit.skillComboStages?.[skill.id]) || 0))) : 0;
    const comboText=combo ? ` · ${combo.stages[comboIndex].name} (${comboIndex+1}/${combo.stages.length})` : "";
    const conversion=skill.passiveConversions?.stat;
    const conversionState=unit.passiveStatConversionState;
    const convertedAttack=conversion?.target === "atk" && conversionState?.source === conversion.source && conversionState?.target === conversion.target
      ? Math.max(0,(Number(conversionState.sourceValue) || 0)*(Number(conversion.percent) || 0)/100) : null;
    const conversionText=convertedAttack == null ? "" : `\n추가된 공격력: ${Math.round(convertedAttack*10)/10}`;
    const tooltip = `${skill.name}${conversionText}${comboText}${effortText}${remaining > 0 ? ` · ${seconds}초` : ""}`;
    return `<span class="battle-skill-tooltip" data-tooltip="${escapeHtml(tooltip)}" tabindex="0" aria-label="${escapeHtml(tooltip)}">
      <span class="battle-skill-icon" aria-hidden="true">
        ${icon ? `<img src="${escapeHtml(icon)}" alt="" onerror="this.hidden=true">` : `<span class="battle-skill-placeholder">${escapeHtml(String(skill.name).slice(0, 1))}</span>`}
        ${remaining > 0 ? `<span class="battle-skill-cooldown" style="--cooldown-angle:${angle}deg"></span><span class="battle-skill-time">${seconds}</span>` : ""}
      </span>
    </span>`;
  }).join("")}</div>`;
}

let battleSkillTooltipEl = null;

function hideBattleSkillTooltip() {
  if (battleSkillTooltipEl) battleSkillTooltipEl.hidden = true;
}

function showBattleSkillTooltip(target, clientX, clientY) {
  const label = target?.dataset?.tooltip;
  if (!label) return hideBattleSkillTooltip();
  if (!battleSkillTooltipEl) {
    battleSkillTooltipEl = document.createElement("div");
    battleSkillTooltipEl.className = "battle-skill-floating-tooltip";
    battleSkillTooltipEl.setAttribute("role", "tooltip");
    document.body.appendChild(battleSkillTooltipEl);
  }
  battleSkillTooltipEl.textContent = label;
  battleSkillTooltipEl.hidden = false;
  const gap = 10;
  const bounds = battleSkillTooltipEl.getBoundingClientRect();
  battleSkillTooltipEl.style.left = `${Math.max(gap, Math.min(window.innerWidth - bounds.width - gap, clientX + gap))}px`;
  battleSkillTooltipEl.style.top = `${Math.max(gap, Math.min(window.innerHeight - bounds.height - gap, clientY + gap))}px`;
}

document.addEventListener("pointermove", event => {
  const target = event.target.closest?.(".battle-skill-tooltip");
  if (target) showBattleSkillTooltip(target, event.clientX, event.clientY);
  else hideBattleSkillTooltip();
});
document.addEventListener("pointerleave", hideBattleSkillTooltip);
document.addEventListener("focusin", event => {
  const target = event.target.closest?.(".battle-skill-tooltip");
  if (!target) return;
  const bounds = target.getBoundingClientRect();
  showBattleSkillTooltip(target, bounds.right, bounds.top);
});
document.addEventListener("focusout", event => {
  if (event.target.closest?.(".battle-skill-tooltip")) hideBattleSkillTooltip();
});

// Presentation-only classification; summon lifetimes and combat rules stay independent.
const MAIN_SUMMON_STATUS_ENTITY_IDS = new Set([
  'knight_magic_horse',
  'star_companion', 'legacy_4ac380c5973655c4', 'puppet_doll',
  'demon_brute'
]);

function renderStatus(units, colorResolver, summonRows = false) {
  return units.filter(unit => summonRows ? unit.isSummon : !unit.isSummon).map(unit => {
    const companions = summonRows ? [] : units.filter(summon => summon.isSummon && !summon.removed
      && (summon.owner ?? summon.summoner) === unit && ((battleEntitySnapshot ?? entitiesJson).find(entity => entity.entityId === summon.entityId)?.mainSummon ?? MAIN_SUMMON_STATUS_ENTITY_IDS.has(summon.entityId)));
    const hpRatio = Math.max(0, (unit.hp / unit.maxHp) * 100);
    const hpText = `${Math.floor(unit.hp)} / ${unit.maxHp}`;
    const maxMp = Math.max(0, Number(unit.maxMp ?? DEFAULT_RESOURCE_VALUE));
    const mp = Math.max(0, Number(unit.mp ?? maxMp));
    const mpRatio = maxMp > 0 ? Math.max(0, Math.min(100, (mp / maxMp) * 100)) : 0;
    const mpText = `${Math.floor(mp)} / ${maxMp}`;
    const maxSt = Math.max(0, Number(unit.maxSt ?? DEFAULT_RESOURCE_VALUE));
    const st = Math.max(0, Number(unit.st ?? maxSt));
    const stRatio = maxSt > 0 ? Math.max(0, Math.min(100, (st / maxSt) * 100)) : 0;
    const stText = `${Math.floor(st)} / ${maxSt}`;
    const bp = getUnitBarrierValue(unit);
    const maxBp = Math.max(bp, getUnitBarrierMax(unit));
    const bpRatio = maxBp > 0 ? Math.max(0, Math.min(100, (bp / maxBp) * 100)) : 0;
    const bpText = maxBp > 0 ? `${Math.floor(bp)} / ${maxBp}` : `${Math.floor(bp)}`;
    const isChanneling = Boolean(unit.channelAction);
    const castDuration = Math.max(0, Number(isChanneling ? unit.channelDuration : unit.castDuration ?? 0));
    const castTimer = Math.max(0, Number(isChanneling ? unit.channelTimer : unit.castTimer ?? 0));
    const isCasting = castDuration > 0 && castTimer > 0;
    const castRatio = isCasting ? Math.max(0, Math.min(100, ((castDuration - castTimer) / castDuration) * 100)) : 0;
    const castRemainingText = isCasting ? `${(castTimer / BASE_ATTACK_COOLDOWN).toFixed(1)}초` : "-";
    const waitingTicks = Math.max(0, Number(unit.entryTicks || unit.reviveTicks) || 0);
    const waitingLabel = unit.isReserve ? "예비대 대기" : unit.entryTicks > 0 ? "진입 대기" : unit.reviveTicks > 0 ? "부활 대기" : "";
    const castText = unit.isReserve ? waitingLabel : waitingLabel ? `${waitingLabel} ${(waitingTicks / BASE_ATTACK_COOLDOWN).toFixed(1)}초` : isCasting ? `${isChanneling ? "채널링 중" : "시전 중"} ${castRemainingText}` : "시전 대기";
    const exhaustedText = unit.exhausted ? " · 지침" : "";
    const formText=getLifeCycleFormLabel(unit);
    const dpsText = `DPS ${getUnitDps(unit).toFixed(1)}`;
    const reviveProtectionText = unit.reviveInvulnerableTicks > 0 ? ` · 부활 무적 ${(unit.reviveInvulnerableTicks / BASE_ATTACK_COOLDOWN).toFixed(1)}초` : "";

    return `
      <div class="unit-status${summonRows ? ' main-summon-status' : ''}">
        <div>${summonRows ? `<span class="main-summon-label">↳ 주소환수 · ${escapeHtml((unit.owner ?? unit.summoner)?.name ?? '')}</span> ` : ''}${escapeHtml(unit.name)} (${getRoleLabel(unit.role)})${!unit.alive ? ' · 전투 불능' : unit.suspendedTicks>0 ? ' · 일시 비활성' : ''}${reviveProtectionText}${formText ? ` · ${escapeHtml(formText)}` : ""}</div>
        <div class="hp-track">
          <div class="hp-fill" style="width:${hpRatio}%; background:${colorResolver(unit)};"></div>
          <div class="hp-label">HP ${hpText} · ${dpsText}</div>
        </div>
        <div class="mp-track">
          <div class="mp-fill" style="width:${mpRatio}%;"></div>
          <div class="hp-label">MP ${mpText}</div>
        </div>
        <div class="st-track">
          <div class="st-fill" style="width:${stRatio}%;"></div>
          <div class="hp-label">ST ${stText}${exhaustedText}</div>
        </div>
        <div class="bp-track">
          <div class="bp-fill" style="width:${bpRatio}%;"></div>
          <div class="hp-label">BP ${bpText}</div>
        </div>
        <div class="cast-track${isCasting ? " casting" : ""}">
          <div class="cast-fill" style="width:${castRatio}%;"></div>
          <div class="hp-label">${castText}</div>
        </div>
        ${renderBattleSkillRow(unit)}
        ${companions.length ? `<div class="main-summon-group" aria-label="${escapeHtml(unit.name)}의 주소환수">${renderStatus(companions,colorResolver,true)}</div>` : ''}
      </div>
    `;
  }).join("");
}

function updateStatusUI() {
  playerStatusEl.innerHTML = renderStatus(playerSquad, unit => getRoleColor(unit.role));
  enemyStatusEl.innerHTML = renderStatus(enemySquad, () => "red");
}


// Battle action log DOM rendering.
function renderBattleActionLogRow(event) {
  const healing = event.type === 'heal';
  const label = healing ? (event.resource && event.resource !== 'HP' ? `${event.resource} 회복` : '치유') : '피해';
  return `<div class="battle-event-log-row ${event.source?.side === 'enemy' ? 'enemy' : 'player'}">
    <span class="battle-event-log-time">${(event.tick / 60).toFixed(2)}s</span>
    <span>${escapeHtml(event.source?.name || '환경')} → ${escapeHtml(event.target?.name || '-')}</span>
    <span>${escapeHtml(event.skillName || (healing ? '회복' : '기본 공격'))}</span>
    <span class="battle-event-log-amount">${escapeHtml(label)} ${formatBattleEventValue(event.amount)}</span></div>`;
}

function renderBattleEventLogs() {
  if (!battleEventLogListEl) return;
  const list = battleEventLogListEl;
  const rendered = Number(list.dataset.renderedCount) || 0;
  if (!battleEventLogs.length || rendered > battleEventLogs.length) {
    list.innerHTML = '';
    list.dataset.renderedCount = '0';
    list.scrollTop = 0;
  }
  const count = Number(list.dataset.renderedCount) || 0;
  const pending = battleEventLogs.slice(count).reverse();
  if (!pending.length) return;
  const previousTop = list.scrollTop, previousHeight = list.scrollHeight;
  list.insertAdjacentHTML('afterbegin', pending.map(renderBattleActionLogRow).join(''));
  list.dataset.renderedCount = String(battleEventLogs.length);
  if (previousTop > 0) list.scrollTop = previousTop + list.scrollHeight - previousHeight;
}


// Battle screen tabs, canvas sizing and modal controls.
function showBattleScreenTab(tabName) {
  selectedBattleScreenTab = tabName === "log" ? "log" : "status";
  battleStatusTabBtnEl?.classList.toggle("active", selectedBattleScreenTab === "status");
  battleLogTabBtnEl?.classList.toggle("active", selectedBattleScreenTab === "log");
  battleStatusPanelEl?.classList.toggle("hidden", selectedBattleScreenTab !== "status");
  battleLogPanelEl?.classList.toggle("hidden", selectedBattleScreenTab !== "log");

  if (selectedBattleScreenTab === "status") {
    resizeCanvas();
  } else {
    renderBattleEventLogs();
  }
}

window.showBattleScreenTab = showBattleScreenTab;

function resizeCanvas() {
  if (!canvas?.parentElement) {
    return;
  }

  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
  scale = canvas.width / 400;
}

function openBattleScreenModal() {
  battleScreenModalEl.classList.remove("hidden");
  showBattleScreenTab(selectedBattleScreenTab);
  resizeCanvas();
  updateStatusUI();
  renderBattleEventLogs();
}

function closeBattleScreenModal() {
  battleScreenModalEl.classList.add("hidden");
}
