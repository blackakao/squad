/* Shared, pure statistics for the Node runner and historical browser results. */
(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SimulationAnalysis = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const roleLabels = {tank:'1종 전투계열',melee:'2종 전투계열',ranged:'마법사계열',healer:'지원가계열',special:'특수계열'};
  const empty = () => ({battles:0,wins:0,losses:0,draws:0,timeouts:0});
  function finish(row, minSamples) {
    return {...row,winRate:row.battles ? row.wins / row.battles * 100 : null,lowSample:row.battles < minSamples};
  }
  function build(results, roster, minSamples=30) {
    const rows = new Map(roster.map(c=>[c.id,{characterId:c.id,name:c.name,role:c.role,
      ...empty(),opponents:new Map(),roles:new Map()}]));
    let battles=0,excludedBattles=0;
    for (const battle of results) {
      const a=battle.teamA, b=battle.teamB;
      // Never infer a duel matchup from a team battle or from summoned units.
      if(a?.length!==1 || b?.length!==1 || a[0]===b[0] || !rows.has(a[0]) || !rows.has(b[0])) {excludedBattles++;continue;}
      battles++;
      for(const [id,opponentId,side] of [[a[0],b[0],'A'],[b[0],a[0],'B']]) {
        const row=rows.get(id),opponent=rows.get(opponentId);
        const outcome=battle.termination==='timeout'?'timeouts':!battle.winner?'draws':battle.winner===side?'wins':'losses';
        if(!row.opponents.has(opponentId)) row.opponents.set(opponentId,{opponentId,name:opponent.name,role:opponent.role,...empty()});
        if(!row.roles.has(opponent.role)) row.roles.set(opponent.role,{role:opponent.role,...empty()});
        for(const target of [row,row.opponents.get(opponentId),row.roles.get(opponent.role)]) {target.battles++;target[outcome]++;}
      }
    }
    const classes=[...rows.values()].map(({opponents,roles,...row})=>({...finish(row,minSamples),
      opponents:[...opponents.values()].map(value=>finish(value,minSamples)),
      roles:[...roles.values()].map(value=>finish(value,minSamples))}));
    const directed=classes.flatMap(c=>c.opponents);
    return {version:1,battles,excludedBattles,minSamples,classes,
      possiblePairs:roster.length*(roster.length-1)/2,measuredPairs:directed.length/2,
      sufficientPairs:directed.filter(c=>!c.lowSample).length/2};
  }
  function summarize(summary) {
    const lines=[], fmt=value=>Number(value).toFixed(2), rows=summary.characters.filter(c=>c.battles);
    if(!summary.battles) return ['완료된 전투가 없어 분석할 수 없습니다.'];
    lines.push(`완료 ${summary.battles}회, 평균 전투시간 ${fmt(summary.duration.average)}초입니다. 시간 초과 ${summary.timeouts}회 (${fmt(summary.timeouts/summary.battles*100)}%), 무승부 ${summary.draws}회입니다. 승률은 두 결과를 포함한 전체 출전 수를 분모로 계산합니다.`);
    const eligible=rows.filter(c=>!c.lowSample).sort((a,b)=>b.winRate-a.winRate || a.characterId-b.characterId);
    if(eligible.length>=2) {
      const high=eligible[0],low=eligible.at(-1);
      lines.push(`표본 기준을 충족한 클래스 중 ${high.name} ${fmt(high.winRate)}% (${high.wins}/${high.battles}승), ${low.name} ${fmt(low.winRate)}% (${low.wins}/${low.battles}승)로 관측 승률 차이는 ${fmt(high.winRate-low.winRate)}%p입니다. 상대 구성·장비·스킬 영향이 포함되므로 이 차이만으로 밸런스 이상을 단정하지 않습니다.`);
    } else lines.push('승률을 비교할 만큼 최소 표본을 충족한 클래스가 2개 미만입니다. 전투 횟수를 늘려 확인하세요.');
    const missing=summary.characters.length-rows.length,lowCount=rows.filter(c=>c.lowSample).length;
    lines.push(`전체 ${summary.characters.length}개 클래스 중 미측정 ${missing}개, 측정됐지만 표본 부족 ${lowCount}개입니다.`);
    const duel=summary.matchups;
    if(duel?.battles) {
      lines.push(`1:1 상대 조합 ${duel.possiblePairs}개 중 ${duel.measuredPairs}개를 측정했고 ${duel.sufficientPairs}개가 조합별 최소 ${duel.minSamples}회 기준을 충족했습니다. 계열 승률은 실제 출전 횟수로 가중되므로 상대 클래스 구성이 다르면 직접 비교에 주의하세요.`);
      let largest=null;
      for(const c of duel.classes) {
        const roles=c.roles.filter(r=>!r.lowSample).sort((a,b)=>b.winRate-a.winRate);
        if(roles.length<2) continue;
        const high=roles[0],low=roles.at(-1),gap=high.winRate-low.winRate;
        if(!largest || gap>largest.gap) largest={c,high,low,gap};
      }
      if(largest) {
        const {c,high,low,gap}=largest;
        lines.push(`${c.name}의 상대 계열별 관측 차이: ${roleLabels[high.role] || high.role} ${fmt(high.winRate)}% (${high.wins}/${high.battles}승), ${roleLabels[low.role] || low.role} ${fmt(low.winRate)}% (${low.wins}/${low.battles}승), 차이 ${fmt(gap)}%p입니다. 충분한 표본의 계열 간 가장 큰 차이이며 원인은 별도 확인이 필요합니다.`);
      } else lines.push('계열 간 차이를 비교할 충분한 1:1 표본이 아직 없습니다.');
    } else lines.push(duel ? '1:1 완료 전투가 없어 클래스 간 직접 상성은 평가하지 않습니다. 팀전 승률은 아군 조합의 영향도 포함합니다.' : '상대별 통계를 불러오지 못해 직접 상성 분석은 보류합니다.');
    return lines;
  }
  function recommendCombinations(summary, minSamples=30) {
    const minimum=Number.isInteger(minSamples) && minSamples>0 ? minSamples : 30;
    const measured=(summary.combinations || []).filter(c=>c.battles>0).map(c=>({...c,
      winRate:100*c.wins/c.battles,lowSample:c.battles<minimum}));
    const compare=(a,b)=>b.winRate-a.winRate || b.battles-a.battles ||
      JSON.stringify(a.ids).localeCompare(JSON.stringify(b.ids));
    const eligible=measured.filter(c=>!c.lowSample).sort(compare);
    const provisional=measured.filter(c=>c.lowSample).sort(compare);
    const candidates=eligible.length ? eligible : provisional;
    const lines=[];
    if(!summary.battles || !measured.length)return {lines:['완료된 조합 데이터가 없어 추천할 수 없습니다.'],top:[],provisional:[],minimum};
    lines.push(`선택한 기록에서 측정한 ${measured.length}개 조합 중 최소 ${minimum}회 출전 기준을 충족한 조합은 ${eligible.length}개입니다.`);
    const best=candidates[0],ties=candidates.filter(c=>c.wins*best.battles===best.wins*c.battles).length;
    lines.push(`${eligible.length?'표본 기준 충족 조합 중 최고 관측 승률':'표본 부족 조합 중 임시 최고 관측 승률'}은 ${best.name}: ${best.winRate.toFixed(2)}% (${best.wins}승 / ${best.battles}회)입니다.${ties>1?` 같은 승률의 조합이 ${ties}개이며 출전 수가 많은 조합을 먼저 표시합니다.`:''}`);
    if(!eligible.length)lines.push('모든 조합이 표본 부족입니다. 아래 조합은 재검증 후보이며 최상 조합으로 확정하지 않습니다.');
    lines.push('정확히 같은 구성원의 팀끼리 집계합니다. 무승부·시간 초과를 승률 분모에 포함하며, 상대 구성과 진영 차이는 보정하지 않습니다. 테스트하지 않은 조합의 성능이나 구성원 간 시너지 원인은 추정하지 않습니다.');
    return {lines,top:eligible.slice(0,5),provisional:provisional.slice(0,5),minimum};
  }
  return {build,summarize,roleLabels,recommendCombinations};
});
