/* Server-owned jobs: this module only submits settings and renders saved statistics. */
const SimulationPage = (() => {
  const el = id => document.getElementById('simulation' + id);
  const html = value => escapeHtml(String(value ?? ''));
  const number = value => Number(value ?? 0).toLocaleString('ko-KR', {maximumFractionDigits:2});
  const time = value => value == null ? '—' : `${Math.floor(value / 60)}분 ${Math.floor(value % 60)}초`;
  const date = value => value ? new Date(value).toLocaleString('ko-KR') : '—';
  const labels = {RUNNING:'실행 중', CANCELLING:'중단 대기', COMPLETED:'완료', CANCELLED:'중단됨', FAILED:'실패'};
  const active = job => job && ['RUNNING','CANCELLING'].includes(job.status);
  let timer, loading = false, submitting = false, selected = null, running = null, result = null, jobs = [];
  let sortKey = 'winRate', descending = true, targetsLoaded = false, followRunning = false;
  let historySignature = '';
  let loadedId = null;
  async function api(path='', options={}) {
    const response = await fetch('/api/' + path, {cache:'no-store', ...options,
      headers:{'Content-Type':'application/json', ...options.headers}});
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || body.message || `요청 실패 (${response.status})`);
    return body;
  }
  function error(cause) {el('Error').textContent=cause ? cause.message || String(cause) : ''; if(cause) logError('simulation',cause.message || String(cause));}
  function controls() {el('Settings').disabled=submitting || Boolean(running);el('Cancel').disabled=!running || running.status==='CANCELLING';}
  function progress(job) {
    if (!job) {el('Progress').textContent='실행 대기 중';el('ProgressBar').value=0;el('Timing').textContent='경과 — · 예상 잔여 —';return;}
    const percent=job.total ? job.completed/job.total*100 : 0;
    el('Progress').textContent=`${labels[job.status] || job.status} · ${number(job.completed)} / ${number(job.total)}회 · ${number(percent)}%`;
    el('Progress').dataset.status=job.status;
    el('ProgressBar').value=percent;
    const eta=active(job) && job.completed ? job.elapsedSeconds/job.completed*(job.total-job.completed) : null;
    el('Timing').textContent=`경과 ${time(job.elapsedSeconds)} · 예상 잔여 ${time(eta)} · 동시 계산 ${job.workers || 1}개${job.status==='CANCELLING' ? ' · 계산 중인 전투들의 종료를 기다립니다.' : ''}`;
    if(job.persistenceWarning)el('Timing').textContent+=' · 상태 저장 지연: 계산 결과는 별도로 보존합니다. 개발 로그를 확인해 주세요.';
  }
  function history() {
    const signature=JSON.stringify([selected,jobs]);
    if(signature===historySignature)return;
    historySignature=signature;
    el('History').innerHTML=jobs.length ? `<table class="data-table"><thead><tr><th>실행 일시</th><th>설정</th><th>상태</th><th>완료</th><th>실행시간</th><th>평균 전투</th><th>결과</th></tr></thead><tbody>${jobs.map(j=>`<tr${selected===j.simulationId?' class="simulation-selected"':''}><td>${html(date(j.startedAt))}</td><td>${number(j.total)}회 · ${j.settings.teamSize}v${j.settings.teamSize} · seed ${j.settings.seed}</td><td>${html(labels[j.status] || j.status)}</td><td>${number(j.completed)}</td><td>${time(j.elapsedSeconds)}</td><td>${j.averageDuration == null ? '—' : number(j.averageDuration)+'초'}</td><td><button type="button" data-job="${html(j.simulationId)}">${active(j)?'진행 보기':'결과 보기'}</button></td></tr>`).join('')}</tbody></table>` : '아직 실행 기록이 없습니다.';
    el('History').querySelectorAll('[data-job]').forEach(button=>button.addEventListener('click',()=>select(button.dataset.job)));
  }
  function assessment(metric, value, lowSample) {
    const bounds=result.targets[metric];
    if (!bounds || bounds.every(v=>v===null)) return '미정';
    if (lowSample) return '표본 부족';
    return bounds[0]!==null && value<bounds[0] ? '하한 미달' : bounds[1]!==null && value>bounds[1] ? '상한 초과' : '범위 내';
  }
  function renderTable() {
    const body=document.getElementById('simulationCharacterRows');
    if(!body || !result) return;
    const rows=[...result.summary.characters].sort((a,b)=>(descending?-1:1)*(Number(a[sortKey])-Number(b[sortKey])) || a.name.localeCompare(b.name,'ko'));
    body.innerHTML=rows.map(c=>`<tr><th scope="row">${html(c.name)}</th><td>${c.battles}</td><td>${c.wins}</td><td>${c.losses}</td><td>${c.draws}</td><td>${c.timeouts}</td><td>${c.battles?number(c.winRate)+'%':'미측정'}</td><td>${number(c.dps)}</td><td>${number(c.hps)}</td><td>${number(c.averageDamage)}</td><td>${number(c.averageHealing)}</td><td>${c.lowSample?'표본 부족':'충족'}</td><td>승률 ${assessment('winRate',c.winRate,c.lowSample)} · DPS ${assessment('dps.'+c.role,c.dps,c.lowSample)} · HPS ${assessment('hps.'+c.role,c.hps,c.lowSample)}</td></tr>`).join('');
    el('Result').querySelectorAll('[data-sort]').forEach(button=>{
      button.parentElement.setAttribute('aria-sort',button.dataset.sort===sortKey ? descending?'descending':'ascending' : 'none');
      button.textContent=button.dataset.label+(button.dataset.sort===sortKey ? descending?' ↓':' ↑':' ↕');
    });
  }
  function sort(key) {if(sortKey===key) descending=!descending;else {sortKey=key;descending=true;}renderTable();}
  function matchupCell(row) {
    if(!row?.battles)return '미측정';
    return `${number(row.winRate)}% · ${row.wins}/${row.battles}승${row.lowSample?' · 표본 부족':''}`;
  }
  function renderMatchups() {
    const host=el('Matchups'), data=result.summary.matchups;
    if(!data) {host.textContent='이전 기록의 상대별 통계를 불러오지 못했습니다. 기록을 다시 선택해 주세요.';return;}
    if(!data.battles) {host.textContent='1:1 완료 전투가 없습니다. 1 vs 1로 실행하면 클래스별 직접 상성을 확인할 수 있습니다. 팀전은 위 전체 클래스 출전 승률을 참고하세요.';return;}
    const roles=[...new Set([...Object.keys(SimulationAnalysis.roleLabels),...data.classes.map(c=>c.role)])];
    const roleName=role=>SimulationAnalysis.roleLabels[role] || role || '미분류';
    host.innerHTML=`<p>1:1 ${number(data.battles)}회 · 상대 조합 ${data.measuredPairs}/${data.possiblePairs}개 측정 · 표본 충족 ${data.sufficientPairs}개</p>
      <p class="simulation-note">클래스는 실행 당시 캐릭터 항목 기준입니다. 승률 = 승 / 전체 출전 수이며 무승부·시간 초과를 포함합니다. 계열 승률은 상대별 승률의 단순 평균이 아닌 전투 수 기준 합산입니다. 미측정과 0%는 구분합니다.</p>
      <label>분석할 클래스 <select id="simulationMatchupClass">${data.classes.map(c=>`<option value="${c.characterId}">${html(c.name)} · ${html(roleName(c.role))}</option>`).join('')}</select></label>
      <div id="simulationMatchupDetail"></div>
      <details><summary>전체 클래스 × 상대 클래스 승률표</summary><div class="simulation-table-wrap"><table class="data-table"><caption>행 클래스가 열 클래스를 상대한 승률 · 승/전투 수</caption><thead><tr><th>클래스</th>${data.classes.map(c=>`<th>${html(c.name)}</th>`).join('')}</tr></thead><tbody>${data.classes.map(c=>`<tr><th scope="row">${html(c.name)}</th>${data.classes.map(other=>`<td>${c.characterId===other.characterId?'—':matchupCell(c.opponents.find(o=>o.opponentId===other.characterId))}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>`;
    function detail() {
      const c=data.classes.find(row=>String(row.characterId)===el('MatchupClass').value);
      el('MatchupDetail').innerHTML=`<h6>${html(c.name)} · 전체 상대 승률 ${matchupCell(c)}</h6><div class="simulation-table-wrap"><table class="data-table"><caption>상대 계열별 승률</caption><thead><tr>${roles.map(role=>`<th>${html(roleName(role))}</th>`).join('')}</tr></thead><tbody><tr>${roles.map(role=>`<td>${matchupCell(c.roles.find(row=>row.role===role))}</td>`).join('')}</tr></tbody></table></div>
        <div class="simulation-table-wrap"><table class="data-table"><caption>상대 클래스별 1:1 결과</caption><thead><tr><th>상대 클래스</th><th>계열</th><th>승률 · 승/전투 수</th><th>패</th><th>무승부</th><th>시간 초과</th></tr></thead><tbody>${data.classes.filter(other=>other.characterId!==c.characterId).map(other=>{const row=c.opponents.find(o=>o.opponentId===other.characterId);return `<tr><th>${html(other.name)}</th><td>${html(roleName(other.role))}</td><td>${matchupCell(row)}</td><td>${row?.losses??'—'}</td><td>${row?.draws??'—'}</td><td>${row?.timeouts??'—'}</td></tr>`;}).join('')}</tbody></table></div>`;
    }
    el('MatchupClass').addEventListener('change',detail);detail();
  }
  function renderResult() {
    const s=result.summary;
    const recommendations=SimulationAnalysis.recommendCombinations(s,result.settings.minSamples);
    const combinationTable=rows=>rows.length ? `<div class="simulation-table-wrap"><table class="data-table"><thead><tr><th>조합</th><th>출전</th><th>승</th><th>패</th><th>무승부</th><th>시간 초과</th><th>관측 승률</th></tr></thead><tbody>${rows.map(c=>`<tr><th>${html(c.name)}</th><td>${number(c.battles)}</td><td>${number(c.wins)}</td><td>${number(c.losses)}</td><td>${number(c.draws)}</td><td>${number(c.timeouts)}</td><td>${number(c.winRate)}%</td></tr>`).join('')}</tbody></table></div>` : '<p>해당 조합이 없습니다.</p>';
    const top=key=>[...s.characters].filter(c=>c.battles).sort((a,b)=>b[key]-a[key])[0];
    const cards=[['평균 전투시간',number(s.duration.average)+'초'],['시간 초과',s.timeouts+'회'],...['winRate','dps','hps'].map((key,i)=>{
      const c=top(key);return [['최고 승률','최고 DPS','최고 HPS'][i],c?`${c.name} · ${number(c[key])}${i===0?'%':''}${c.lowSample?' (표본 부족)':''}`:'미측정'];})];
    el('Result').innerHTML=`<h5>${html(labels[result.status || 'COMPLETED'])} · ${number(s.battles)} / ${number(result.settings.count)}회 · ${result.settings.teamSize} vs ${result.settings.teamSize} · Seed ${result.settings.seed}</h5>
      <p>${html(date(result.startedAt))} · 실행 ${number(result.elapsedSeconds)}초${result.finishedAt?' · 종료 '+html(date(result.finishedAt)):''}</p>
      ${result.error?`<p class="simulation-error">${html(result.error)}</p><a target="_blank" rel="noopener" href="/api/simulations/${encodeURIComponent(selected)}/log">개발 로그</a>`:''}
      <div class="simulation-cards">${cards.map(([name,value])=>`<div><span>${name}</span><strong>${html(value)}</strong></div>`).join('')}</div>
      <p class="simulation-note">DPS/HPS는 전투별 실제 피해/유효 HP 회복 ÷ 전체 전투시간의 평균입니다. 소환수는 별도 집계됩니다. 무승부 ${s.draws}회와 시간 초과도 승률 분모에 포함합니다. 최소 ${result.settings.minSamples}표본 미만은 평가를 보류합니다.</p>
      <section><h5>테스트 범위 내 추천 조합 · 로컬 요약</h5><p class="simulation-note">선택한 기록의 완료된 전투만 비교합니다. 과거 기록도 재실행 없이 분석하며 서로 다른 기록은 합치지 않습니다.</p><ul>${recommendations.lines.map(line=>`<li>${html(line)}</li>`).join('')}</ul><h5>표본 기준 충족 · 상위 5개</h5>${combinationTable(recommendations.top)}${recommendations.provisional.length?`<details${recommendations.top.length?'':' open'}><summary>표본 부족 · 재검증 후보 상위 5개</summary>${combinationTable(recommendations.provisional)}</details>`:''}</section>
      <h5>전체 클래스 승률·기여도</h5><p class="simulation-note">각 클래스의 출전 기준 승률입니다. 팀전에서는 해당 클래스가 속한 팀의 승패를 사용합니다.</p>
      <div class="simulation-fields simulation-rank"><button data-rank="winRate">승률 순위</button><button data-rank="dps">DPS 순위</button><button data-rank="hps">HPS 순위</button></div>
      <div class="simulation-table-wrap"><table class="data-table"><thead><tr><th>캐릭터</th>${[['battles','전투 수'],['wins','승'],['losses','패'],['draws','무승부'],['timeouts','시간 초과'],['winRate','승률'],['dps','DPS'],['hps','HPS'],['averageDamage','평균 피해'],['averageHealing','평균 치유']].map(([key,label])=>`<th><button data-sort="${key}" data-label="${label}">${label}</button></th>`).join('')}<th>표본</th><th>목표 비교</th></tr></thead><tbody id="simulationCharacterRows"></tbody></table></div>
      <p>전투시간 목표: ${assessment('duration',s.duration.average,!s.battles)} · 목표 기준: ${result.targetSource==='snapshot'?'실행 당시 설정':'현재 설정 (이전 CLI 기록)'}</p>
      <section><h5>1:1 클래스 상성</h5><div id="simulationMatchups"></div></section>
      <section><h5>밸런스 의견 · 로컬 자동 요약</h5><p class="simulation-note">선택한 기록의 통계를 설명하는 규칙 기반 요약입니다. 생성형 AI 호출·외부 전송·토큰 사용이 없습니다. ${html(labels[result.status || 'COMPLETED'])} 기록의 완료된 전투만 분석합니다. 목표 미정 항목은 적정성을 판정하지 않습니다.</p><ul>${SimulationAnalysis.summarize(s).map(line=>`<li>${html(line)}</li>`).join('')}</ul></section>
      <details><summary>조합별 결과 (${s.combinations.length}개)</summary><p class="simulation-note">같은 구성원으로 이루어진 팀을 하나의 조합으로 집계합니다. 승률은 해당 조합이 만난 모든 상대에 대한 결과입니다. 팀 인원이 많으면 같은 조합의 반복 표본이 적을 수 있으므로 표본 수를 함께 확인하세요.</p><div class="simulation-table-wrap"><table class="data-table"><thead><tr><th>조합</th><th>전투 수</th><th>승</th><th>패</th><th>승률</th><th>표본</th></tr></thead><tbody>${s.combinations.map(c=>`<tr><th>${html(c.name)}</th><td>${c.battles}</td><td>${c.wins}</td><td>${c.losses}</td><td>${number(c.winRate)}%</td><td>${c.lowSample?'표본 부족':'충족'}</td></tr>`).join('')}</tbody></table></div></details>
      <details class="simulation-metadata"><summary>실행 데이터·원본</summary><p>데이터 SHA-256: ${html(result.dataHash)}<br>엔진 SHA-256: ${html(result.engineHash)}<br>Git: ${html(result.gitRevision)} · Node: ${html(result.nodeVersion)}<br>전장: ${result.settings.width} × ${result.settings.height} · 제한 ${result.settings.maxSeconds}초</p><a target="_blank" rel="noopener" href="/api/simulations/${encodeURIComponent(selected)}/json">원본 JSON</a> · <a target="_blank" rel="noopener" href="/api/simulations/${encodeURIComponent(selected)}/markdown">Markdown 보고서</a></details>`;
    renderTable();
    renderMatchups();
    el('Result').querySelectorAll('[data-sort]').forEach(button=>button.addEventListener('click',()=>sort(button.dataset.sort)));
    el('Result').querySelectorAll('[data-rank]').forEach(button=>button.addEventListener('click',()=>{sortKey=button.dataset.rank;descending=true;renderTable();}));
  }
  async function select(id, follow=false) {
    if(!id)return;
    selected=id;followRunning=follow;result=null;loadedId=null;
    localStorage.setItem('simulationSelected',id);
    const job=jobs.find(j=>j.simulationId===id);
    history();
    if(!running) progress(job);
    if(active(job)) {followRunning=true;el('Result').textContent='실행 중입니다. 완료되면 결과를 표시합니다.';return;}
    el('Result').textContent='결과를 불러오는 중입니다.';
    try {
      const data=await api(`simulations/${encodeURIComponent(id)}/result`);
      if(selected!==id)return;
      if(!data.summary.matchups) {
        try {
          // Historical files are immutable; reconstruct from their saved battle results.
          const raw=data.settings.teamSize===1 ? await api(`simulations/${encodeURIComponent(id)}/json`) : {results:[]};
          if(selected!==id)return;
          data.summary.matchups=SimulationAnalysis.build(raw.results,data.summary.characters.map(c=>({id:c.characterId,name:c.name,role:c.role})),data.settings.minSamples??30);
        } catch(cause) {logWarn('simulation','이전 결과의 상성 통계를 읽지 못했습니다.',cause);}
      }
      if(selected!==id)return;result=data;loadedId=id;renderResult();
    }
    catch(cause) {if(selected!==id)return;loadedId=id;el('Result').innerHTML=`<p class="simulation-error">${html(job?.error || cause.message)}</p><p>종료: ${html(date(job?.finishedAt))} · 완료 ${number(job?.completed)}회</p>${id.startsWith('simulation_')?`<a target="_blank" rel="noopener" href="/api/simulations/${encodeURIComponent(id)}/log">개발 로그</a> · <a target="_blank" rel="noopener" href="/api/simulations/${encodeURIComponent(id)}/journal">완료 전투 원본</a>`:''}`;}
  }
  async function refresh() {
    if(loading)return;
    loading=true;
    try {
      const data=await api('simulations');jobs=data.jobs;
      const wasRunning=running?.simulationId;running=jobs.find(j=>j.simulationId===data.activeId) || null;
      controls();history();progress(running || jobs.find(j=>j.simulationId===selected));
      if(!selected){const remembered=localStorage.getItem('simulationSelected');await select(data.activeId || (jobs.some(j=>j.simulationId===remembered)?remembered:jobs[0]?.simulationId),Boolean(data.activeId));}
      else if(followRunning && wasRunning && !running) await select(wasRunning);
      else if(selected && loadedId!==selected && !active(jobs.find(j=>j.simulationId===selected))) await select(selected);
    } catch(cause){error(cause);} finally {loading=false;clearTimeout(timer);timer=setTimeout(()=>{if(!el('Page').classList.contains('hidden'))refresh();},1000);}
  }
  async function open() {
    error(null);
    if(!targetsLoaded) {
      try {
        const data=await api('simulation-targets');
        const metricLabel=key=>key==='winRate'?'승률 (%)':key==='duration'?'평균 전투시간 (초)':`${{tank:'탱커',melee:'근접',ranged:'원거리',healer:'치유',special:'특수'}[key.split('.')[1]]} ${key.split('.')[0].toUpperCase()}`;
        el('TargetRows').innerHTML=Object.entries(data.targets).map(([key,values])=>`<tr data-metric="${key}"><th>${metricLabel(key)}</th>${values.map((value,i)=>`<td><input aria-label="${metricLabel(key)} ${i?'최대':'최소'}" type="number" min="0" ${key==='winRate'?'max="100"':''} step="0.01" value="${value??''}" placeholder="미정"></td>`).join('')}</tr>`).join('');targetsLoaded=true;
      }catch(cause){error(cause);}
    }
    await refresh();
  }
  return {open,refresh,select,sort,
    preset(value){if(value!=='custom')el('Count').value=value;else el('Count').focus();},
    async start(event){
      event.preventDefault();if(submitting || running)return;
      submitting=true;controls();error(null);
      try {
        const settings={count:Number(el('Count').value),teamSize:Number(el('TeamSize').value),seed:Number(el('Seed').value),maxSeconds:Number(el('MaxSeconds').value),minSamples:Number(el('MinSamples').value),workers:Number(el('Workers').value)};
        const job=await api('simulations',{method:'POST',body:JSON.stringify(settings)});
        jobs.unshift(job);running=active(job)?job:null;await select(job.simulationId,true);progress(job);
      }catch(cause){error(cause);}finally{submitting=false;controls();await refresh();}
    },
    async cancel(){if(!running)return;el('Cancel').disabled=true;try{running=await api(`simulations/${running.simulationId}/cancel`,{method:'POST'});progress(running);}catch(cause){error(cause);}finally{controls();}},
    async saveTargets(event){event.preventDefault();error(null);try{const targets={};el('TargetRows').querySelectorAll('[data-metric]').forEach(row=>{targets[row.dataset.metric]=[...row.querySelectorAll('input')].map(input=>input.value===''?null:Number(input.value));});await api('simulation-targets',{method:'PUT',body:JSON.stringify({targets})});el('TargetStatus').textContent='저장했습니다. 다음 실행부터 적용됩니다.';}catch(cause){error(cause);}}
  };
})();
