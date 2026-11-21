/* Focus report uses the immutable plan stored with the selected job. */
const SimulationFocusReport = (() => {
  const html=value=>escapeHtml(String(value ?? ''));
  const number=value=>Number(value || 0).toLocaleString('ko-KR',{maximumFractionDigits:2});
  function setting(plan,variant) {
    return `<p><strong>스탯:</strong> ${plan.catalog.stats.map(s=>`${html(s.label)} ${number(variant.attributes[s.key])}`).join(' · ')}</p>
      <p><strong>스킬:</strong> ${variant.skillIds.map(id=>html(plan.catalog.skills.find(s=>s.id===id)?.name || id)).join(', ') || '없음'}</p>
      <p><strong>장비:</strong> ${plan.catalog.slots.map(s=>`${html(s.label)}: ${html(s.items.find(i=>i.id===variant.equipment[s.key])?.name || '미착용')}`).join(' · ')}</p>`;
  }
  function render(run) {
    const plan=run.focusPlan,summary=run.focusSummary;
    const labels={COMPLETED:'완료',CANCELLED:'중단',FAILED:'실패'};
    return `<h4>캐릭터 집중 분석 보고서 · ${html(plan.name)}</h4><p>${html(labels[run.status] || run.status)} · ${number(run.completed)} / ${number(run.settings.count)}회 · Seed ${run.settings.seed}</p>
      ${run.error?`<p class="simulation-error">${html(run.error)}</p>`:''}
      <p>조합 공간 상한 ${html(plan.rawSpace)}개 · 선정 세팅 ${plan.variants.length}개 · 스탯 50/50/50 · 추천 최소 ${summary.minSamples}회</p>
      <p class="simulation-note">장비 슬롯 간 제약 적용 전의 조합 공간입니다. 전체 공간을 모두 검증했다는 뜻이 아닙니다. 같은 회차에서는 세팅 간 동일 편성·Seed를 사용하고 회차마다 무작위 편성과 진영 교대를 적용합니다. 전투 규모는 합산하지 않습니다.</p>
      <ul>${plan.notes.map(note=>`<li>${html(note)}</li>`).join('')}</ul>
      ${plan.skippedSizes.length?`<p>등록 인원 부족으로 제외한 규모: ${plan.skippedSizes.map(n=>`${n}:${n}`).join(', ')}</p>`:''}
      ${summary.stages.map(stage=>{
        const best=stage.ranking.find(r=>r.variantId===stage.best),variant=plan.variants.find(v=>v.id===stage.best);
        const measured=stage.ranking.filter(r=>r.battles),min=measured.length?Math.min(...measured.map(r=>r.battles)):0,max=measured.length?Math.max(...measured.map(r=>r.battles)):0;
        return `<section><h4>${stage.teamSize} vs ${stage.teamSize} · ${number(stage.completed)} / ${number(stage.planned)}회</h4>
          <p>측정 세팅 ${measured.length}/${plan.variants.length}개 · 측정 세팅별 ${min}~${max}회 출전</p>
          ${best?`<p><strong>${stage.provisional?'표본 부족 · 임시 최고 관측 후보':'표본 기준 충족 · 최고 관측 후보'}: ${html(best.variantId)}</strong> · ${number(best.winRate)}% (${best.wins}승/${best.battles}회) · 같은 최고 승률 ${stage.tiedBest}개</p>${setting(plan,variant)}`:'<p>미측정: 앞 단계에서 예산이 소진되었거나 작업이 중단되었습니다.</p>'}
          <p class="simulation-note">무승부·시간 초과도 승률 분모에 포함합니다. ${stage.provisional?'표본이 부족하므로 최적 세팅으로 확정하지 않습니다.':'표본 기준 충족만으로 통계적 우월성을 확정하지 않습니다.'} 예산이 회차 중 끝나면 세팅별 표본 수가 다를 수 있습니다.</p>
          <div class="simulation-table-wrap"><table class="data-table"><thead><tr><th>세팅</th><th>출전</th><th>승/패</th><th>무승부/시간 초과</th><th>승률</th><th>DPS</th><th>HPS</th><th>평균 생존(초)</th><th>표본</th></tr></thead><tbody>${stage.ranking.map(r=>`<tr><th><a href="#focus-setting-${html(r.variantId)}">${html(r.variantId)}</a></th><td>${r.battles}</td><td>${r.wins}/${r.losses}</td><td>${r.draws}/${r.timeouts}</td><td>${r.winRate==null?'미측정':number(r.winRate)+'%'}</td><td>${number(r.dps)}</td><td>${number(r.hps)}</td><td>${number(r.survival)}</td><td>${r.lowSample?'부족':'충족'}</td></tr>`).join('')}</tbody></table></div></section>`;
      }).join('')}
      <h4>검증한 세팅 명세</h4>${plan.variants.map(v=>`<details id="focus-setting-${html(v.id)}"><summary>${html(v.id)}</summary>${setting(plan,v)}</details>`).join('')}
      <p class="simulation-note">보고서는 관측 결과를 로컬에서 집계합니다. 생성형 AI·토큰 비용은 없으며 원본 캐릭터에 추천을 자동 적용하지 않습니다.</p>`;
  }
  return {render};
})();
