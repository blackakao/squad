// Browser-only skill editor presentation helpers.
// Loaded after skill.js; not needed by headless battle simulation.
function renderSkillClassIdentity(skill) {
  const className = inferSkillClassName(skill) || "미지정";
  const character = Array.isArray(characterJson) ? characterJson.find(item => String(item?.name ?? "").trim() === className) : null;
  const icon = character?.portrait ? renderPortraitCell(character.portrait, className) : `<span class="skill-class-placeholder">${escapeHtml(className === "공용" ? "공" : className.slice(0, 1) || "?")}</span>`;
  return `<span class="skill-class-identity">${icon}<span>${escapeHtml(className)}</span></span>`;
}

function formatSkillValueSummary(skill) {
  if (isChoiceSkill(skill)) {
    const choice = normalizeSkillChoice(skill.choice);
    const selected = getChoiceSkillOption(skill);
    return `<span class="skill-value-summary"><span><strong>선택지</strong> ${choice.options.length}개</span><span><strong>기본</strong> ${escapeHtml(selected?.label ?? "미설정")}</span></span>`;
  }
  const costs = formatResourceCostsSummary(skill.resourceCosts ?? normalizeSkillResourceCosts(skill)) || "소모 없음";
  const coefficients = (skill.actions ?? []).flatMap(action => action.coefficients ?? []).map(formatCoefficientSummary);
  const coefficientText = coefficients.length ? [...new Set(coefficients)].slice(0, 3).join(" + ") + (coefficients.length > 3 ? ` 외 ${coefficients.length - 3}개` : "") : "계수 없음";
  const castTime = skill.castTime == null ? "유닛 기준" : Number(skill.castTime) === 0 ? "즉시" : `${skill.castTime}초`;
  const combo=normalizeSkillCombo(skill.combo);
  const cooldownText=combo ? `연계 ${combo.stepCooldown}초 · 전체 ${skill.cooldown ?? 0}초` : `${skill.cooldown ?? 0}초`;
  return `<span class="skill-value-summary"><span><strong>소모</strong> ${escapeHtml(costs)}</span><span><strong>계수</strong> ${escapeHtml(coefficientText)}</span><span><strong>대기</strong> ${escapeHtml(cooldownText)} · <strong>시전</strong> ${escapeHtml(castTime)}</span></span>`;
}

