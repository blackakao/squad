'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {build,summarize}=require('../js/simulation-analysis.js');
const {recommendCombinations}=require('../js/simulation-analysis.js');
test('recommendations separate lucky small samples, count all appearances and preserve history',()=>{
  const summary={battles:101,combinations:[
    {ids:[1,2],name:'검증팀',battles:100,wins:60,losses:20,draws:10,timeouts:10},
    {ids:[3,4],name:'한번승리',battles:1,wins:1,losses:0,draws:0,timeouts:0}]};
  const before=JSON.stringify(summary),r=recommendCombinations(summary,30);
  assert.equal(r.top[0].name,'검증팀');assert.equal(r.top[0].winRate,60);
  assert.equal(r.provisional[0].winRate,100);assert.equal(JSON.stringify(summary),before);
});
test('sparse ten-member teams report tied provisional candidates rather than a confirmed best',()=>{
  const combinations=Array.from({length:7},(_,i)=>({ids:Array.from({length:10},(_,j)=>i*10+j),
    name:'팀'+i,battles:i+1,wins:i+1}));
  const r=recommendCombinations({battles:28,combinations},30);
  assert.equal(r.top.length,0);assert.equal(r.provisional.length,5);
  assert.equal(r.provisional[0].name,'팀6');
  assert.match(r.lines.join(' '),/같은 승률의 조합이 7개/);
  assert.match(r.lines.join(' '),/최상 조합으로 확정하지/);
});
test('empty and historical missing combination data do not invent recommendations',()=>{
  assert.deepEqual(recommendCombinations({battles:0,combinations:[]}).top,[]);
  assert.deepEqual(recommendCombinations({battles:12}).provisional,[]);
});
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
