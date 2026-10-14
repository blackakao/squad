const COMBAT_POWER_TOOLTIP = '최종 능력치 기준 비교 지표입니다. 승률을 뜻하지 않으며 스킬·소환수·팀 시너지·일시 효과는 제외합니다.';

function formatCombatPower(value) {
  return value.toLocaleString('ko-KR');
}

function renderCombatPowerComparison(current, next, labels = ['현재', '예상']) {
  const delta = next.total - current.total;
  return `<div class="combat-power-summary" title="${COMBAT_POWER_TOOLTIP}" aria-live="polite">
    <strong>종합전투력</strong>
    <span>${labels[0]} <b data-cp="current">${formatCombatPower(current.total)}</b></span>
    <span>${labels[1]} <b data-cp="next">${formatCombatPower(next.total)}</b></span>
    <span>증감 <b data-cp="delta">${delta > 0 ? '+' : ''}${formatCombatPower(delta)}</b></span>
  </div>`;
}
