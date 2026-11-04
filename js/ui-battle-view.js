// Browser battle presentation. Loaded after ui.js.
function renderBattleSkillRow(unit) {
  if (typeof getSkillById !== "function") return "";
  const transform = (unit?.activeEffects ?? []).find(effect => effect.kind === "transform");
  const ids = transform?.skillIds?.length ? transform.skillIds : unit?.skillIds;
  const skills = [
    ...(Array.isArray(ids) ? ids.map(getSkillById).filter(Boolean) : []),
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

function renderStatus(units, colorResolver) {
  return units.filter(unit => !unit.isSummon).map(unit => {
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
    const bp = Math.max(0, Number(unit.bp) || 0);
    const maxBp = Math.max(bp, Number(unit.maxBp) || 0);
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
    const dpsText = `DPS ${getUnitDps(unit).toFixed(1)}`;
    const reviveProtectionText = unit.reviveInvulnerableTicks > 0 ? ` · 부활 무적 ${(unit.reviveInvulnerableTicks / BASE_ATTACK_COOLDOWN).toFixed(1)}초` : "";

    return `
      <div class="unit-status">
        <div>${unit.name} (${getRoleLabel(unit.role)})${reviveProtectionText}</div>
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
      </div>
    `;
  }).join("");
}

function updateStatusUI() {
  playerStatusEl.innerHTML = renderStatus(playerSquad, unit => getRoleColor(unit.role));
  enemyStatusEl.innerHTML = renderStatus(enemySquad, () => "red");
}

