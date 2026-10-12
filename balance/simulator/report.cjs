'use strict';

function aggregate(results, roster, minSamples = 30) {
  const blank = info => ({...info,battles:0,wins:0,losses:0,draws:0,timeouts:0,totalDamage:0,totalHealing:0,
    totalDuration:0,dpsSum:0,hpsSum:0,directDamage:0,summonDamage:0,directHealing:0,summonHealing:0});
  const characters = new Map(roster.map(c => [c.id,blank({characterId:c.id,name:c.name,role:c.role})]));
  const combinations = new Map();
  const sides = {A:{battles:0,wins:0},B:{battles:0,wins:0}};
  function add(row, outcome, duration, damage = 0, healing = 0) {
    row.battles++; row.totalDuration += duration;
    row[{win:'wins',loss:'losses',draw:'draws',timeout:'timeouts'}[outcome]]++;
    row.totalDamage += damage; row.totalHealing += healing;
    row.dpsSum += duration ? damage / duration : 0;
    row.hpsSum += duration ? healing / duration : 0;
  }
  for (const result of results) {
    for (const c of result.characters) {
      const row = characters.get(c.characterId);
      add(row,c.outcome,result.duration,c.damageDealt,c.healingDone);
      row.directDamage += c.contribution?.direct.damageDealt ?? c.damageDealt;
      row.summonDamage += c.contribution?.summon.damageDealt ?? 0;
      row.directHealing += c.contribution?.direct.healingDone ?? c.healingDone;
      row.summonHealing += c.contribution?.summon.healingDone ?? 0;
    }
    for (const side of ['A','B']) {
      const ids = [...result['team'+side]].sort((a,b) => a-b);
      const key = ids.join(',');
      if (!combinations.has(key)) combinations.set(key,blank({ids,name:ids.map(id => characters.get(id).name).join(' + ')}));
      const outcome = result.termination === 'timeout' ? 'timeout' : !result.winner ? 'draw' : result.winner === side ? 'win' : 'loss';
      const members = result.characters.filter(c=>c.team===side);
      add(combinations.get(key),outcome,result.duration,
        members.reduce((sum,c)=>sum+c.damageDealt,0),members.reduce((sum,c)=>sum+c.healingDone,0));
      sides[side].battles++;
      if (result.winner === side) sides[side].wins++;
    }
  }
  function finish(row) {
    const n = row.battles, p = n ? row.wins / n : 0, z = 1.96;
    const centre = (p + z*z/(2*n)) / (1+z*z/n);
    const radius = z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/(1+z*z/n);
    return {...row,winRate:100*p,winRate95:n ? [100*(centre-radius),100*(centre+radius)] : null,
      averageDamage:n ? row.totalDamage/n : 0,averageHealing:n ? row.totalHealing/n : 0,
      dps:n ? row.dpsSum/n : 0,hps:n ? row.hpsSum/n : 0,
      pooledDps:row.totalDuration ? row.totalDamage/row.totalDuration : 0,
      pooledHps:row.totalDuration ? row.totalHealing/row.totalDuration : 0,lowSample:n<minSamples};
  }
  const durations = results.map(r => r.duration).sort((a,b) => a-b);
  const n = durations.length;
  return {battles:n,timeouts:results.filter(r=>r.termination==='timeout').length,
    draws:results.filter(r=>r.termination==='draw').length,
    duration:{average:n ? durations.reduce((a,b)=>a+b,0)/n : 0,
      median:n ? (durations[Math.floor((n-1)/2)]+durations[Math.floor(n/2)])/2 : 0,
      shortest:durations[0] ?? 0,longest:durations[n-1] ?? 0},sides,
    characters:[...characters.values()].map(finish),
    combinations:[...combinations.values()].map(finish).sort((a,b)=>b.winRate-a.winRate || b.battles-a.battles)};
}

const METRICS = ['winRate','duration',...['tank','melee','ranged','healer','special'].flatMap(role=>['dps.'+role,'hps.'+role])];
function parseTargets(markdown) {
  const targets = {};
  for (const line of markdown.split(/\r?\n/)) {
    if (!line.trim().startsWith('|')) continue;
    const cells = line.split('|').slice(1,-1).map(s=>s.trim());
    if (cells[0] === '지표' || /^-+$/.test(cells[0])) continue;
    if (!METRICS.includes(cells[0]) || cells.length !== 3) throw new Error('Invalid target row: ' + line);
    if (Object.hasOwn(targets,cells[0])) throw new Error('Duplicate target: ' + cells[0]);
    const range = cells.slice(1).map(value => {
      if (value === '미정') return null;
      if (!/^\d+(\.\d+)?$/.test(value)) throw new Error('Target must be a non-negative number or 미정: ' + value);
      return Number(value);
    });
    if (range[0] !== null && range[1] !== null && range[0] > range[1]) throw new Error('Target minimum exceeds maximum');
    if (cells[0] === 'winRate' && range.some(v=>v>100)) throw new Error('Win rate target exceeds 100');
    targets[cells[0]] = range;
  }
  for (const metric of METRICS) if (!Object.hasOwn(targets,metric)) throw new Error('Missing target: '+metric);
  return targets;
}

function evaluate(summary, targets) {
  const evaluations = [];
  function compare(label,metric,value,lowSample=false) {
    const [min,max] = targets[metric];
    if (min === null && max === null) return;
    if (lowSample) {evaluations.push(`${label}: 표본 부족으로 평가 보류`);return;}
    evaluations.push(`${label}: ${value.toFixed(2)} — ${min !== null && value < min ? '목표 하한 미달' : max !== null && value > max ? '목표 상한 초과' : '설정 범위 내'}`);
  }
  compare('평균 전투시간','duration',summary.duration.average);
  for (const c of summary.characters) {
    compare(c.name+' 승률','winRate',c.winRate,c.lowSample);
    compare(c.name+' DPS','dps.'+c.role,c.dps,c.lowSample);
    compare(c.name+' HPS','hps.'+c.role,c.hps,c.lowSample);
  }
  return evaluations;
}

const escape = value => String(value).replace(/\|/g,'\\|').replace(/[\r\n]/g,' ').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const f = value => value.toFixed(2);
function makeReport(run, targets, rawLink) {
  const s = run.summary, measured = s.characters.filter(c=>c.battles);
  const rank = field => [...measured].sort((a,b)=>b[field]-a[field]);
  const highest = rank('winRate')[0], lowest = rank('winRate').at(-1);
  const combo = s.combinations.find(c=>!c.lowSample);
  const assessment = evaluate(s,targets);
  if(!measured.length) return `# Balance Simulation Report\n\n상태: ${run.status || 'COMPLETED'} · 완료 전투 0 / ${run.settings.count}\n\n완료된 전투가 없습니다. ${escape(run.error || '')}\n\n[Raw Result](${rawLink})\n`;
  return `# Balance Simulation Report

상태: ${run.status || 'COMPLETED'} · 완료 ${s.battles} / ${run.settings.count}회${run.error ? ' · 오류: '+escape(run.error) : ''}

실제 전투 ${s.battles}회 · ${run.settings.teamSize} vs ${run.settings.teamSize} · seed ${run.settings.seed}
평균 전투 **${f(s.duration.average)}초** · 실행 **${f(run.elapsedSeconds)}초** · 10,000회 선형 예상 **${f(run.elapsedSeconds / s.battles * 10000)}초**

측정 입력은 ${run.startedAt} (UTC)의 저장된 스냅샷입니다. 이후 게임 데이터 변경은 이 결과에 반영되지 않습니다.

## 측정 결과 요약

- 최고 승률: ${escape(highest.name)} ${f(highest.winRate)}%${highest.lowSample ? ' (표본 부족)' : ''}
- 최저 승률: ${escape(lowest.name)} ${f(lowest.winRate)}%${lowest.lowSample ? ' (표본 부족)' : ''}
- 최고 DPS: ${escape(rank('dps')[0].name)} ${f(rank('dps')[0].dps)}
- 최고 HPS: ${escape(rank('hps')[0].name)} ${f(rank('hps')[0].hps)}
- 최고 승률 조합 (최소 ${run.settings.minSamples}표본): ${combo ? escape(combo.name)+' '+f(combo.winRate)+'%' : '충분한 표본 없음'}
- 무승부 ${s.draws}회 · 시간 제한 ${s.timeouts}회 (별도 분류, 승률 분모에는 포함)
- A진영 승리 ${s.sides.A.wins}회 · B진영 승리 ${s.sides.B.wins}회
- 캐릭터별 표본 ${Math.min(...measured.map(c=>c.battles))}–${Math.max(...measured.map(c=>c.battles))}회

## 캐릭터별 실제 결과

| 캐릭터 | Battles | Wins | Losses | Draws | Timeout | Win Rate | 95% 구간 | DPS | HPS | 평균 Damage | 평균 Healing | 표본 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${[...s.characters].sort((a,b)=>b.winRate-a.winRate).map(c=>`| ${escape(c.name)} | ${c.battles} | ${c.wins} | ${c.losses} | ${c.draws} | ${c.timeouts} | ${c.battles ? f(c.winRate)+'%' : '미측정'} | ${c.winRate95 ? c.winRate95.map(f).join('–')+'%' : '-'} | ${f(c.dps)} | ${f(c.hps)} | ${f(c.averageDamage)} | ${f(c.averageHealing)} | ${c.lowSample?'부족':'충족'} |`).join('\n')}

## DPS 순위

피해·치유와 DPS/HPS는 소환수 기여를 포함합니다. 아래 분해는 전체 관측시간을 분모로 사용합니다.

| 캐릭터 | 직접 피해 | 소환 피해 | 직접 DPS | 소환 DPS | 직접 치유 | 소환 치유 |
| --- | --- | --- | --- | --- | --- | --- |
${measured.map(c=>`| ${escape(c.name)} | ${f(c.directDamage)} | ${f(c.summonDamage)} | ${f(c.totalDuration ? c.directDamage/c.totalDuration : 0)} | ${f(c.totalDuration ? c.summonDamage/c.totalDuration : 0)} | ${f(c.directHealing)} | ${f(c.summonHealing)} |`).join('\n')}

${rank('dps').map((c,i)=>`${i+1}. ${escape(c.name)}: ${f(c.dps)}`).join('\n')}

## HPS 순위

${rank('hps').map((c,i)=>`${i+1}. ${escape(c.name)}: ${f(c.hps)}`).join('\n')}

## 전투시간

평균 ${f(s.duration.average)}초 · 중앙값 ${f(s.duration.median)}초 · 최단 ${f(s.duration.shortest)}초 · 최장 ${f(s.duration.longest)}초.
시간 제한 전투도 관측된 제한시간으로 포함합니다.

## 조합별 승률

조합은 멤버 ID를 정렬해 집계하며, 각 전투의 두 진영을 각각 한 표본으로 셉니다.

| 조합 | Battles | Wins | Losses | Draws | Timeout | Win Rate | 표본 |
| --- | --- | --- | --- | --- | --- | --- | --- |
${s.combinations.map(c=>`| ${escape(c.name)} | ${c.battles} | ${c.wins} | ${c.losses} | ${c.draws} | ${c.timeouts} | ${f(c.winRate)}% | ${c.lowSample?'부족':'충족'} |`).join('\n')}

## 밸런스 평가

${assessment.length ? assessment.map(line=>'- '+escape(line)).join('\n') : '목표값이 모두 미정이므로 강함/약함이나 적정 밸런스를 판정하지 않습니다.'}

## 해석과 한계

- DPS/HPS는 캐릭터별 각 전투의 누적량 ÷ 전체 전투시간을 계산한 뒤 산술평균합니다. 사망 이후 시간도 분모에 포함합니다. JSON에는 총량/총시간 지표도 별도 보존합니다.
- 피해는 HP + BP의 실제 차감량이며 과잉 피해를 제외합니다. HPS는 HP의 유효 회복만 포함하고 MP/ST/BP 회복, 자동 자원 재생, 과잉 치유는 포함하지 않습니다.
- 새 결과의 소환 피해·HP 회복은 소유자 DPS/HPS에 포함됩니다. 직접/소환 기여도를 분리 보존하며 진단용 summonTotals를 팀 합계에 다시 더하지 않습니다. 이전 실행 결과는 당시 집계 기준을 유지합니다.
- 균형 표본의 무작위 임시 팀이며 저장된 팀 배율·시너지·예비대 설정은 적용하지 않습니다. 캐릭터의 현재 장비·스킬·부활 규칙은 적용합니다.
- 전장 ${run.settings.width}×${run.settings.height}, 60틱/초, 배속 1의 가상 시계입니다. 화면 크기, 브라우저 지연, 배속 또는 기존 ‘결과 바로 보기’의 실제 시계 진행량이 다르면 결과도 달라질 수 있습니다.
- 승률 95% 구간은 Wilson 근사이며 공유 팀 표본·상대 조합 의존성을 고려한 인과 추정이 아닙니다. 조합별 표본 부족과 진영 편향을 함께 확인하세요.
- 기본/패시브 스킬은 cast_complete를 발행하지 않을 수 있으므로 skillUsage는 시전 완료 이벤트 횟수입니다.

## 실행 정보

- 실행 UTC: ${run.startedAt}
- Git: ${run.gitRevision}
- 엔진 SHA-256: ${run.engineHash}
- 데이터 SHA-256: ${run.dataHash}
- Node: ${run.nodeVersion}
- [Raw Result 및 입력 스냅샷](${rawLink})
- [목표 편집](BALANCE_TARGETS.md) · [사용법 및 엔진 조사](SIMULATION_GUIDE.md)
`;
}
module.exports = {aggregate,parseTargets,evaluate,makeReport};
