'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {createEngine,loadData,ROOT}=require('../balance/simulator/engine.cjs');
const {createFocusPlan,createFocusSampler,summarizeFocus,focusMarkdown}=require('../balance/simulator/focus.cjs');
const {runSimulation}=require('../balance/simulator/service.cjs');
const inputSnapshot=loadData(),targetMarkdown=fs.readFileSync(path.join(ROOT,'docs/balance/BALANCE_TARGETS.md'),'utf8');
const characterId=Math.max(0,inputSnapshot.characters.findIndex(c=>c.name==='기사'));
const settings={count:12,teamSize:1,seed:321,maxSeconds:1,minSamples:2,workers:1,
  focus:{characterId,candidateLimit:2,repeats:2,varySkills:true,varyEquipment:true}};
test('independent sizes spend the entire budget and unchecked settings stay current',()=>{
  const engine=createEngine(inputSnapshot,settings),current=engine.focusCatalog(characterId).character;
  for(const teamSize of [1,3,10]) {
    const options={...settings,count:7,focus:{...settings.focus,teamSize,varyStats:false,varySkills:false,varyEquipment:false}};
    const plan=createFocusPlan(engine,options);
    assert.equal(plan.variants.length,1);
    assert.deepEqual(plan.stages,[{teamSize,planned:7}]);
    assert.deepEqual(plan.variants[0].attributes,current.attributes);
    assert.deepEqual(plan.variants[0].skillIds,current.skillIds);
    assert.deepEqual(plan.variants[0].equipment,current.equipment);
    assert.equal(plan.statAllocation,'현재 스탯 고정');
    const task=createFocusSampler(plan,options,engine.roster.length)();
    assert.equal(task.teamA.length,teamSize);
  }
  const small=createEngine({...inputSnapshot,characters:inputSnapshot.characters.slice(0,2)},settings);
  assert.throws(()=>createFocusPlan(small,{...settings,focus:{...settings.focus,characterId:0,teamSize:10}}),/20/);
});
test('focus candidates use 50/50/50, valid skills/equipment, deterministic unique sampling without mutating input',()=>{
  const before=JSON.stringify(inputSnapshot),engine=createEngine(inputSnapshot,settings);
  const plan=createFocusPlan(engine,settings),again=createFocusPlan(engine,settings);
  assert.deepEqual(plan,again);assert.equal(plan.variants.length,2);
  assert.notDeepEqual(plan.variants[0],plan.variants[1]);
  for(const variant of plan.variants){
    assert.deepEqual(Object.values(variant.attributes).sort((a,b)=>a-b),[0,0,0,50,50,50]);
    assert.ok(variant.skillIds.filter(id=>engine.focusCatalog(characterId).optionalSkills.some(s=>s.id===id)).length<=3);
    const normalized=engine.normalizeFocus(characterId,variant);
    assert.deepEqual(normalized.equipment,variant.equipment);
  }
  assert.equal(JSON.stringify(inputSnapshot),before);
  assert.deepEqual(plan.stages.map(s=>[s.teamSize,s.planned]),[[1,4],[3,4],[10,4]]);
});
test('each candidate shares round conditions, target participates once, teams are disjoint and stages respect total budget',()=>{
  const engine=createEngine(inputSnapshot,settings),plan=createFocusPlan(engine,settings);
  const next=createFocusSampler(plan,settings,engine.roster.length),tasks=Array.from({length:12},next);
  for(let i=0;i<tasks.length;i+=2){
    assert.deepEqual(tasks[i].teamA,tasks[i+1].teamA);assert.deepEqual(tasks[i].teamB,tasks[i+1].teamB);
    assert.equal(tasks[i].seed,tasks[i+1].seed);
  }
  for(const task of tasks){const ids=[...task.teamA,...task.teamB];
    assert.equal(ids.filter(id=>id===characterId).length,1);assert.equal(new Set(ids).size,ids.length);
    assert.equal(task.teamA.length,task.teamB.length);
  }
  assert.ok(tasks[0].teamA.includes(characterId));assert.ok(tasks[2].teamB.includes(characterId));
  const small=createFocusPlan(engine,{...settings,count:1});assert.deepEqual(small.stages.map(s=>s.planned),[1,0,0]);
});
test('sequential and parallel focus runs have identical battles/reports and restore original character',async()=>{
  const before=JSON.stringify(inputSnapshot);
  const a=await runSimulation({settings,inputSnapshot,targetMarkdown});
  const b=await runSimulation({settings:{...settings,workers:2},inputSnapshot,targetMarkdown});
  assert.equal(a.status,'COMPLETED');assert.equal(b.status,'COMPLETED');
  assert.deepEqual(a.results,b.results);assert.deepEqual(a.focusSummary,b.focusSummary);
  for(const stage of a.focusSummary.stages){assert.equal(stage.completed,4);assert.equal(stage.ranking.length,2);assert.ok(stage.ranking.every(r=>r.battles===2));}
  assert.match(focusMarkdown(a),/50\/50\/50/);
  assert.equal(JSON.stringify(inputSnapshot),before);
  const engine=createEngine(inputSnapshot,settings),sample=createFocusSampler(a.focusPlan,settings,engine.roster.length)();
  const plain={...sample,focus:undefined,maxSeconds:1};
  const initial=engine.runBattle(plain);
  engine.runBattle({...sample,maxSeconds:1});
  assert.deepEqual(engine.runBattle(plain),initial);
});
test('partial focus summaries never infer wins for untested settings or stages',()=>{
  const engine=createEngine(inputSnapshot,settings),plan=createFocusPlan(engine,settings);
  const result=engine.runBattle({...createFocusSampler(plan,settings,engine.roster.length)(),maxSeconds:1});
  const summary=summarizeFocus([result],plan,30);
  assert.equal(summary.stages[0].completed,1);assert.equal(summary.stages[0].provisional,true);
  assert.equal(summary.stages[1].best,null);assert.equal(summary.stages[2].completed,0);
});
test('fixed skills/equipment enumerate exactly twenty allocations and small rosters skip unsupported sizes',()=>{
  const data={...inputSnapshot,characters:inputSnapshot.characters.slice(0,2)};
  const options={...settings,count:50,focus:{...settings.focus,characterId:0,candidateLimit:200,repeats:1,varySkills:false,varyEquipment:false}};
  const engine=createEngine(data,options),plan=createFocusPlan(engine,options);
  assert.equal(plan.variants.length,20);assert.equal(plan.rawSpace,'20');assert.equal(plan.exhaustiveRaw,true);
  assert.deepEqual(plan.skippedSizes,[3,10]);assert.deepEqual(plan.stages,[{teamSize:1,planned:50}]);
  assert.equal(new Set(plan.variants.map(v=>JSON.stringify(v.equipment))).size,1);
  assert.equal(new Set(plan.variants.map(v=>JSON.stringify(v.skillIds))).size,1);
});
