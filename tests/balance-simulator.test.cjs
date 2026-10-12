'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {createEngine,loadData,ROOT} = require('../balance/simulator/engine.cjs');
const {createSampler,parseArgs} = require('../balance/simulator/runner.cjs');
const {aggregate,parseTargets,evaluate,makeReport} = require('../balance/simulator/report.cjs');
const {runSimulation} = require('../balance/simulator/service.cjs');

test('shared service cancels at battle boundaries and preserves a zero-battle report', async () => {
  const inputSnapshot=loadData(),targetMarkdown=fs.readFileSync(path.join(ROOT,'docs/balance/BALANCE_TARGETS.md'),'utf8');
  const settings={count:5,teamSize:1,seed:17,maxSeconds:1,minSamples:30,width:400,height:300};
  let completed=0;
  const partial=await runSimulation({settings,inputSnapshot,targetMarkdown,
    onBattle:()=>completed++,shouldCancel:()=>completed===2});
  assert.equal(partial.status,'CANCELLED');assert.equal(partial.completed,2);
  assert.equal(partial.summary.battles,2);assert.equal(partial.results.length,2);
  const empty=await runSimulation({settings,inputSnapshot,targetMarkdown,shouldCancel:()=>true});
  assert.equal(empty.status,'CANCELLED');assert.equal(empty.completed,0);
  assert.match(makeReport(empty,parseTargets(targetMarkdown),'result.json'),/완료 전투 0/);
});

test('real engine replays identical events after unrelated battles, without mutating input', () => {
  const data=loadData(), before=JSON.stringify(data), e=createEngine(data);
  const config={teamA:[0,3,4],teamB:[1,7,8],seed:42,trace:true,maxSeconds:120};
  const first=e.runBattle(config);
  e.runBattle({teamA:[2,5],teamB:[6,8],seed:91,maxSeconds:60});
  assert.deepEqual(e.runBattle(config),first);
  assert.deepEqual(createEngine(data).runBattle(config),first);
  assert.equal(JSON.stringify(data),before);
  assert(first.events.some(event=>event.type==='cast_complete'));
  assert(first.events.some(event=>event.type==='heal' && event.resource==='HP'));
  assert(first.events.some(event=>event.type==='death'));
  assert(first.characters.some(c=>c.damageDealt>0));
});

test('UI gameLoop schedule and direct ticks use the same damage, healing, skills and victory', () => {
  const config={teamA:[0,3,4],teamB:[1,7,8],seed:345,trace:true,maxSeconds:120};
  const e=createEngine();
  assert.deepEqual(e.runBattle({...config,drive:'loop'}),e.runBattle(config));
});

test('event accumulation includes the whole fight and isolates HP healing', () => {
  const result=createEngine().runBattle({teamA:[0,2,3],teamB:[1,6,7],seed:567,trace:true,maxSeconds:300});
  assert(result.events.length>1000,'exercise beyond the UI history limit');
  const damage=result.events.filter(e=>e.type==='hit').reduce((n,e)=>n+e.amount,0);
  const hpHeal=result.events.filter(e=>e.type==='heal' && e.resource==='HP').reduce((n,e)=>n+e.amount,0);
  assert(Math.abs(result.characters.reduce((n,c)=>n+c.damageDealt,0)-damage)<1e-7);
  assert(Math.abs(result.characters.reduce((n,c)=>n+c.healingDone,0)-hpHeal)<1e-7);
  for (const c of result.characters) assert.equal(c.dps,c.damageDealt/result.duration);
});

test('time limit never invents a winner and invalid teams do not silently shrink', () => {
  const e=createEngine();
  const result=e.runBattle({teamA:[0],teamB:[1],maxSeconds:0.1});
  assert.equal(result.termination,'timeout');assert.equal(result.winner,null);
  assert(result.characters.every(c=>c.outcome==='timeout'));
  for (const teamA of [[],[0,0],[100]]) assert.throws(()=>e.runBattle({teamA,teamB:[1]}));
});

test('real summon battles credit each owner and team exactly once, retaining direct and summon analysis', () => {
  const data=loadData();
  for(const c of data.characters) { c.skillIds=[];c.equipment={};c.equipmentSets=[];c.hp=100000;c.speed=0;c.attackRange=30; }
  const template=structuredClone(data.entities[0]);
  template.ai='stationary';template.name='same summon';
  Object.assign(template.stats,{hp:10000,atk:30,attackRange:50,attackSpeed:2,castTime:0});
  data.entities.push({...template,entityId:'credit_temp',summonType:'temporary'},
    {...structuredClone(template),entityId:'credit_pet',summonType:'persistent'});
  data.skills.push({id:'credit_summon',name:'credit summon',slot:'active',castTime:0,cooldown:1,
    actions:[{type:'summon_entity',target:'self',entityId:'credit_temp',count:1,limit:2,duration:0.8},
      {type:'summon_entity',target:'self',entityId:'credit_pet',count:1,limit:3,duration:0}]});
  data.characters[0].skillIds=data.characters[1].skillIds=['credit_summon'];
  data.characters[0].name=data.characters[1].name='same owner';
  const engine=createEngine(data), result=engine.runBattle({teamA:[0,1,2],teamB:[3,4,5],seed:234,maxSeconds:8,trace:true});
  assert.equal(result.characters.length,6);
  for(const id of [0,1]) {
    const c=result.characters.find(c=>c.characterId===id);
    const damage=result.events.filter(e=>e.type==='hit' && e.source?.isSummon && e.source.ownerId===id).reduce((n,e)=>n+e.amount,0);
    assert(damage>0);assert(Math.abs(c.contribution.summon.damageDealt-damage)<1e-7);
    assert(c.contribution.groups.find(g=>g.summonType==='temporary').count>1);
    assert(c.contribution.groups.find(g=>g.summonType==='persistent').damageDealt>0);
    assert.equal(c.damageDealt,c.contribution.direct.damageDealt+c.contribution.summon.damageDealt);
    assert.equal(c.dps,c.damageDealt/result.duration);
  }
  const summary=aggregate([result],engine.roster);
  const team=summary.combinations.find(c=>c.ids.join(',')==='0,1,2');
  const raw=result.events.filter(e=>e.type==='hit' && e.source.side==='player').reduce((n,e)=>n+e.amount,0);
  assert(Math.abs(team.totalDamage-raw)<1e-7);
  assert.equal(summary.characters[0].summonDamage,result.characters[0].contribution.summon.damageDealt);
});

test('3v3 headless battles retain six character rows with both summon lifecycles and repeatable removal', () => {
  const data=loadData();
  const template=data.entities[0];
  assert(template);
  data.entities.push({...structuredClone(template),entityId:'test_persistent',summonType:'persistent'},
    {...structuredClone(template),entityId:'test_temporary',summonType:'temporary'});
  data.skills.push({id:'test_summons',name:'lifecycle test',slot:'active',castTime:0,cooldown:0.5,
    actions:[{type:'summon_entity',target:'self',entityId:'test_persistent',count:1,limit:3,duration:0.2},
      {type:'summon_entity',target:'self',entityId:'test_temporary',count:2,limit:3,duration:0.2}]});
  data.characters[0].skillIds=['test_summons'];
  const e=createEngine(data), config={teamA:[0,1,2],teamB:[3,4,5],seed:9,maxSeconds:20,trace:true};
  const result=e.runBattle(config);
  assert.equal(result.characters.length,6);
  assert(result.characters.every(row=>Number.isInteger(row.characterId)));
  const deaths=result.events.filter(event=>event.type==='death' && event.target?.isSummon);
  assert.equal(deaths.filter(event=>event.target.summonType==='persistent').length,1);
  assert(deaths.filter(event=>event.target.summonType==='temporary').length>2);
  assert(deaths.every(event=>event.target.ownerId===0 && event.target.ownerEventId>0));
  assert.deepEqual(e.runBattle(config),result);
  const report=aggregate([result],e.roster,3);
  assert.equal(report.characters.filter(row=>row.battles>0).length,6);
  // Ten simulated minutes with healers and repeated expiry, without a victory.
  for(const c of data.characters) {
    c.role='healer';c.equipment={};c.equipmentSets=[];
    c.skillIds=[];
  }
  data.entities.forEach(entity=>{entity.ai='healer';});
  data.characters[0].skillIds=['test_summons'];
  const long=createEngine(data).runBattle({...config,maxSeconds:600});
  assert.equal(long.ticks,36000);
  assert.equal(long.characters.length,6);
  assert(long.events.filter(event=>event.type==='death' && event.target?.summonType==='temporary').length>=100);
});

test('balanced sampler has disjoint teams, reproducible order and at most one appearance spread', () => {
  for (const size of [1,2,3,4]) {
    const a=createSampler(9,size,123), b=createSampler(9,size,123), counts=Array(9).fill(0);
    for (let i=0;i<1000;i++) {
      const sample=a();assert.deepEqual(sample,b());
      const ids=[...sample.teamA,...sample.teamB];assert.equal(new Set(ids).size,2*size);
      ids.forEach(id=>counts[id]++);
      assert(Math.max(...counts)-Math.min(...counts)<=1);
    }
  }
  assert.throws(()=>createSampler(9,5,1));
});

test('aggregate has correct win denominators, unweighted DPS, medians and canonical combinations', () => {
  const roster=[{id:0,name:'a',role:'tank'},{id:1,name:'b',role:'healer'}];
  const results=[{teamA:[0],teamB:[1],winner:'A',termination:'victory',duration:10,
    characters:[{characterId:0,team:'A',outcome:'win',damageDealt:100,healingDone:0},{characterId:1,team:'B',outcome:'loss',damageDealt:50,healingDone:20}]},
  {teamA:[1],teamB:[0],winner:null,termination:'timeout',duration:30,
    characters:[{characterId:0,team:'B',outcome:'timeout',damageDealt:60,healingDone:0},{characterId:1,team:'A',outcome:'timeout',damageDealt:30,healingDone:60}]}];
  const s=aggregate(results,roster,3);
  assert.equal(s.characters[0].winRate,50);assert.equal(s.characters[0].dps,6);
  assert.equal(s.characters[0].pooledDps,4);assert.equal(s.characters[1].hps,2);
  assert.equal(s.duration.median,20);assert.equal(s.combinations.length,2);
  assert(s.combinations.every(c=>c.battles===2 && c.lowSample));
  assert.equal(s.combinations.find(c=>c.ids[0]===0).totalDamage,160);
  assert.equal(s.combinations.find(c=>c.ids[0]===1).totalHealing,80);
});

test('reports retain unselected registered characters as unmeasured', () => {
  const engine=createEngine();
  const result=engine.runBattle({teamA:[0],teamB:[1],maxSeconds:0.1});
  const targets=parseTargets(fs.readFileSync(path.join(ROOT,'docs/balance/BALANCE_TARGETS.md'),'utf8'));
  const report=makeReport({summary:aggregate([result],engine.roster),settings:{teamSize:1,seed:12345,minSamples:30,width:400,height:300},elapsedSeconds:1},targets,'raw.json');
  for (const character of engine.roster) assert(report.includes(character.name));
  assert(report.includes('미측정'));
});

test('undefined targets never evaluate; editing only the markdown changes evaluation', () => {
  const markdown=fs.readFileSync(path.join(ROOT,'docs/balance/BALANCE_TARGETS.md'),'utf8');
  const s={duration:{average:60},characters:[{name:'a',role:'tank',winRate:80,dps:10,hps:0,lowSample:false}]};
  assert.deepEqual(evaluate(s,parseTargets(markdown)),[]);
  const changed=markdown.replace('| winRate | 미정 | 미정 |','| winRate | 47 | 53 |');
  assert.match(evaluate(s,parseTargets(changed))[0],/목표 상한 초과/);
  assert.throws(()=>parseTargets(changed.replace('47 | 53','70 | 53')));
  assert.throws(()=>parseTargets(changed.replace('47 | 53','oops | 53')));
  assert.throws(()=>parseArgs(['--count','NaN']));assert.throws(()=>parseArgs(['--seed','-1']));
});
