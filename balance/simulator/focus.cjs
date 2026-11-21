'use strict';
const {seededRandom,fingerprint}=require('./engine.cjs');

function combinations(values,max=3) {
  const out=[[]];
  function add(start,selected) {
    if(selected.length===max)return;
    for(let i=start;i<values.length;i++) {
      const item=values[i];
      if(selected.some(other=>(item.exclusiveSkillIds || []).includes(other.id)||(other.exclusiveSkillIds || []).includes(item.id)))continue;
      const next=[...selected,item];out.push(next.map(v=>v.id));add(i+1,next);
    }
  }
  add(0,[]);return out;
}
function createFocusPlan(engine,settings) {
  const options=settings.focus,catalog=engine.focusCatalog(options.characterId);
  const {character}=catalog;
  if(catalog.statMax!==50 || catalog.statTotal!==150 || catalog.stats.length!==6)throw Error('스탯 규칙이 변경되어 50/50/50 분석을 사용할 수 없습니다.');
  const attributes=[];
  for(let a=0;a<6;a++)for(let b=a+1;b<6;b++)for(let c=b+1;c<6;c++)
    attributes.push(Object.fromEntries(catalog.stats.map((stat,i)=>[stat.key,[a,b,c].includes(i)?50:0])));
  const skillSets=options.varySkills ? combinations(catalog.optionalSkills) :
    [character.skillIds.filter(id=>catalog.optionalSkills.some(s=>s.id===id))];
  const dimensions=[attributes,skillSets,...catalog.slots.map(slot=>options.varyEquipment ?
    ['',...slot.items.map(item=>item.id)] : [character.equipment[slot.key] || ''])];
  const space=dimensions.reduce((total,values)=>total*BigInt(values.length),1n);
  const random=seededRandom(settings.seed),randBig=()=>BigInt(Math.floor(random()*4294967296));
  const gcd=(a,b)=>b?gcd(b,a%b):a;
  let cursor=(randBig()*4294967296n+randBig())%space,stride=(randBig()*4294967296n+randBig())%space || 1n;
  while(gcd(stride,space)!==1n)stride++;
  const variants=[],seen=new Set();let examined=0n;
  const attemptLimit=BigInt(Math.max(1000,options.candidateLimit*100));
  while(examined<space && examined<attemptLimit && variants.length<options.candidateLimit) {
    let index=cursor;cursor=(cursor+stride)%space;examined++;
    const picked=dimensions.map(values=>{const value=values[Number(index%BigInt(values.length))];index/=BigInt(values.length);return value;});
    const normalized=engine.normalizeFocus(options.characterId,{attributes:picked[0],
      skillIds:[...catalog.fixedSkillIds,...picked[1]],equipment:Object.fromEntries(catalog.slots.map((slot,i)=>[slot.key,picked[i+2]]))});
    const signature=fingerprint(normalized);
    if(seen.has(signature))continue;
    seen.add(signature);variants.push({id:'setting-'+(variants.length+1),...normalized});
  }
  if(!variants.length)throw Error('유효한 세팅 후보가 없습니다.');
  const sizes=[1,3,10].filter(size=>engine.roster.length>=size*2);
  const block=variants.length*options.repeats;
  let remaining=settings.count;
  const stages=sizes.map((teamSize,i)=>{
    const count=i===sizes.length-1?remaining:Math.min(remaining,block);remaining-=count;
    return {teamSize,planned:count};
  });
  return {version:1,characterId:options.characterId,name:catalog.name,
    statAllocation:'50/50/50',rawSpace:space.toString(),examined:examined.toString(),
    exhaustiveRaw:examined===space,variants,stages,repeats:options.repeats,
    skippedSizes:[1,3,10].filter(size=>!sizes.includes(size)),
    catalog:{stats:catalog.stats,skills:catalog.skills,slots:catalog.slots},
    notes:['장비 후보에는 미착용과 현재 등록된 착용 가능 아이템을 포함합니다. 양손 무기 규칙 적용 후 동일 세팅은 합칩니다.',
      '선택 스킬 0~3개를 비교하며 상호 배타 규칙을 지킵니다. 고정 스킬의 선택 분기·룬은 현재 설정을 유지합니다.',
      '분석 캐릭터의 장비 세트는 해당 세팅 1개로 고정합니다. 다른 캐릭터는 현재 저장된 세팅을 사용합니다.',
      '세팅 후보를 모두 측정했다고 전체 가능한 세팅을 탐색한 것은 아닙니다. 무작위로 선정한 후보 범위 안에서 비교합니다.']};
}
function createFocusSampler(plan,settings,rosterLength) {
  let index=0;
  return ()=>{
    let local=index++,stage;
    for(const entry of plan.stages){stage=entry;if(local<entry.planned)break;local-=entry.planned;}
    const variant=plan.variants[local%plan.variants.length],round=Math.floor(local/plan.variants.length);
    // Same line-up, side and combat seed for every setting in a round.
    const random=seededRandom((settings.seed+Math.imul(stage.teamSize,104729)+Math.imul(round,1009))>>>0);
    const ids=Array.from({length:rosterLength},(_,i)=>i).filter(id=>id!==plan.characterId);
    for(let i=ids.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}
    let teamA=[plan.characterId,...ids.slice(0,stage.teamSize-1)],teamB=ids.slice(stage.teamSize-1,2*stage.teamSize-1);
    if(round%2)[teamA,teamB]=[teamB,teamA];
    return {teamA,teamB,seed:Math.floor(random()*4294967296),
      focus:{characterId:plan.characterId,variantId:variant.id,variant,round,teamSize:stage.teamSize}};
  };
}
function summarizeFocus(results,plan,minSamples=30) {
  const stages=plan.stages.map(stage=>{
    const rows=new Map(plan.variants.map(variant=>[variant.id,{variantId:variant.id,battles:0,wins:0,losses:0,draws:0,timeouts:0,
      dpsSum:0,hpsSum:0,survivalSum:0,durationSum:0}]));
    for(const battle of results) {
      if(battle.focus?.teamSize!==stage.teamSize)continue;
      const row=rows.get(battle.focus.variantId),unit=battle.characters.find(c=>c.characterId===plan.characterId);
      if(!row || !unit)throw Error('집중 분석 전투 메타데이터가 일치하지 않습니다.');
      row.battles++;row[{win:'wins',loss:'losses',draw:'draws',timeout:'timeouts'}[unit.outcome]]++;
      row.dpsSum+=battle.duration?unit.damageDealt/battle.duration:0;
      row.hpsSum+=battle.duration?unit.healingDone/battle.duration:0;
      row.survivalSum+=unit.survivalTime || 0;row.durationSum+=battle.duration;
    }
    const ranking=[...rows.values()].map(row=>({...row,winRate:row.battles?100*row.wins/row.battles:null,
      dps:row.battles?row.dpsSum/row.battles:0,hps:row.battles?row.hpsSum/row.battles:0,
      survival:row.battles?row.survivalSum/row.battles:0,averageDuration:row.battles?row.durationSum/row.battles:0,
      lowSample:row.battles<minSamples})).sort((a,b)=>(b.winRate??-1)-(a.winRate??-1)||b.battles-a.battles||a.variantId.localeCompare(b.variantId));
    const measured=ranking.filter(row=>row.battles),eligible=measured.filter(row=>!row.lowSample);
    const best=(eligible.length?eligible:measured)[0];
    return {...stage,completed:measured.reduce((sum,row)=>sum+row.battles,0),ranking,
      best:best?.variantId || null,provisional:!eligible.length,
      tiedBest:best?(eligible.length?eligible:measured).filter(row=>row.wins*best.battles===best.wins*row.battles).length:0};
  });
  return {stages,minSamples};
}
function focusMarkdown(run) {
  const plan=run.focusPlan,summary=run.focusSummary;
  const esc=value=>String(value).replace(/\|/g,'\\|').replace(/[\r\n]/g,' ');
  const describe=v=>{
    const stats=plan.catalog.stats.map(s=>`${s.label} ${v.attributes[s.key]}`).join(', ');
    const skills=v.skillIds.map(id=>plan.catalog.skills.find(s=>s.id===id)?.name||id).join(', ');
    const equipment=plan.catalog.slots.map(s=>`${s.label}: ${s.items.find(i=>i.id===v.equipment[s.key])?.name||'미착용'}`).join(', ');
    return `${stats}\n\n스킬: ${skills}\n\n장비: ${equipment}`;
  };
  return `# 캐릭터 집중 분석 보고서 · ${esc(plan.name)}\n\n상태: ${run.status} · ${run.completed}/${run.settings.count}회 · Seed ${run.settings.seed}\n\n원시 조합 공간 ${plan.rawSpace}개, 중복 제거 후 선정 후보 ${plan.variants.length}개. 스탯 50/50/50.\n\n${plan.notes.map(n=>'- '+n).join('\n')}\n\n규모별로 승률을 비교합니다. 무승부·시간 초과를 분모에 포함하며 최소 ${summary.minSamples}회 미만은 임시 후보입니다. 순위는 관측값이며 통계적 우월성을 확정하지 않습니다.\n\n`+
    summary.stages.map(stage=>`## ${stage.teamSize} vs ${stage.teamSize}: ${stage.completed}/${stage.planned}회\n\n${stage.best?`최고 관측 후보 ${stage.best}${stage.provisional?' (표본 부족)':''} · 최고 승률 동률 ${stage.tiedBest}개`:'미측정'}\n\n| 세팅 | 출전 | 승 | 패 | 무승부 | 시간 초과 | 승률 | DPS | HPS | 표본 |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n`+
      stage.ranking.filter(r=>r.battles).map(r=>`| ${r.variantId} | ${r.battles} | ${r.wins} | ${r.losses} | ${r.draws} | ${r.timeouts} | ${r.winRate.toFixed(2)}% | ${r.dps.toFixed(2)} | ${r.hps.toFixed(2)} | ${r.lowSample?'부족':'충족'} |`).join('\n')).join('\n\n')+
    '\n\n## 세팅 명세\n\n'+plan.variants.map(v=>`### ${v.id}\n\n${describe(v)}`).join('\n\n')+'\n';
}
module.exports={createFocusPlan,createFocusSampler,summarizeFocus,focusMarkdown};
