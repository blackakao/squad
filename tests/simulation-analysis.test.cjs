'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {build,summarize}=require('../js/simulation-analysis.js');
const roster=[{id:0,name:'A',role:'tank'},{id:1,name:'B',role:'melee'},{id:2,name:'C',role:'melee'},{id:3,name:'D',role:'healer'}];
const duel=(a,b,winner,termination='victory')=>({teamA:[a],teamB:[b],winner,termination});
test('duels count both perspectives, draws/timeouts, weighted roles and unmeasured classes',()=>{
  const data=build([duel(0,1,'A'),duel(1,0,'B'),duel(0,2,'B'),duel(0,1,null,'timeout'),duel(2,0,null,'draw')],roster,3);
  const a=data.classes[0],b=data.classes[1],d=data.classes[3];
  assert.equal(a.battles,5);assert.equal(a.wins,2);assert.equal(a.losses,1);assert.equal(a.timeouts,1);assert.equal(a.draws,1);
  assert.equal(a.roles[0].winRate,40);assert.equal(a.roles[0].lowSample,false);
  assert.equal(a.opponents.find(c=>c.opponentId===1).wins,2);
  assert.equal(b.losses,2);assert.equal(b.winRate,0);assert.equal(d.winRate,null);
  assert.equal(data.possiblePairs,6);assert.equal(data.measuredPairs,2);assert.equal(data.sufficientPairs,1);
});
test('team battles and mirrors never become duel matchups; cancelled empty results remain empty',()=>{
  const data=build([{teamA:[0,1],teamB:[2,3],winner:'A'},duel(0,0,'A')],roster);
  assert.equal(data.battles,0);assert.equal(data.excludedBattles,2);
  assert.equal(data.measuredPairs,0);assert.equal(build([],roster).classes[0].winRate,null);
});
test('class identity uses saved IDs, not duplicate names; inputs are immutable',()=>{
  const duplicate=roster.map(c=>({...c,name:'동명'})),input=[duel(0,1,'A')],before=JSON.stringify({duplicate,input});
  const data=build(input,duplicate,1);
  assert.equal(data.classes[0].winRate,100);assert.equal(data.classes[1].winRate,0);
  assert.equal(JSON.stringify({duplicate,input}),before);
});
test('local opinions withhold low-sample ranking and give measured evidence without balance verdicts',()=>{
  const summary={battles:2,timeouts:1,draws:0,duration:{average:20},characters:[
    {characterId:0,name:'A',battles:2,wins:1,winRate:50,lowSample:true},
    {characterId:1,name:'B',battles:0,wins:0,winRate:0,lowSample:true}],matchups:build([duel(0,1,'A'),duel(0,1,null,'timeout')],roster)};
  const text=summarize(summary).join('\n');
  assert.match(text,/시간 초과 1회 \(50.00%\)/);assert.match(text,/미측정 1개/);assert.match(text,/2개 미만/);
  assert.doesNotMatch(text,/관측 승률 차이/);assert.match(text,/최소 30회/);
  assert.deepEqual(summarize({...summary,battles:0}),['완료된 전투가 없어 분석할 수 없습니다.']);
});
test('report aggregate persists matchups for both CLI and server jobs',()=>{
  const {aggregate}=require('../balance/simulator/report.cjs');
  const battle={...duel(0,1,'A'),duration:10,characters:[
    {characterId:0,team:'A',outcome:'win',damageDealt:20,healingDone:0},
    {characterId:1,team:'B',outcome:'loss',damageDealt:0,healingDone:0}]};
  const result=aggregate([battle],roster,1);
  assert.equal(result.matchups.classes[0].opponents[0].winRate,100);
  assert.equal(result.characters[0].dps,2);
});
