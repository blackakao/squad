'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {runSimulation}=require('../balance/simulator/service.cjs');
const {runPool,workerCount}=require('../balance/simulator/pool.cjs');
const {loadData,ROOT}=require('../balance/simulator/engine.cjs');
const {createSampler,parseArgs}=require('../balance/simulator/runner.cjs');
const inputSnapshot=loadData(),targetMarkdown=fs.readFileSync(path.join(ROOT,'docs/balance/BALANCE_TARGETS.md'),'utf8');
const settings={count:12,teamSize:1,seed:12345,maxSeconds:2,width:400,height:300,minSamples:3};
test('parallel completion preserves exact sequential seed, battle order and summary',async()=>{
  const sequential=await runSimulation({settings:{...settings,workers:1},inputSnapshot,targetMarkdown});
  const progress=[];
  const parallel=await runSimulation({settings:{...settings,workers:2},inputSnapshot,targetMarkdown,onProgress:p=>progress.push(p.completed)});
  assert.equal(parallel.status,'COMPLETED');assert.deepEqual(parallel.results,sequential.results);
  assert.deepEqual(parallel.summary,sequential.summary);assert.deepEqual(progress,Array.from({length:13},(_,i)=>i));
});
test('parallel cancellation drains in-flight battles and keeps unique ordered results',async()=>{
  let completed=0;
  const run=await runSimulation({settings:{...settings,count:100,workers:2},inputSnapshot,targetMarkdown,
    shouldCancel:()=>completed>=2,onBattle:()=>completed++});
  assert.equal(run.status,'CANCELLED');assert(run.completed>=2&&run.completed<=3);
  assert.equal(run.summary.battles,run.completed);
  assert.equal(new Set(run.results.map(r=>r.battleId)).size,run.completed);
  assert.deepEqual(run.results.map(r=>Number(r.battleId.slice(7))),run.results.map(r=>Number(r.battleId.slice(7))).sort((a,b)=>a-b));
});
test('worker initialization/source mismatch exits all workers with a failure',async()=>{
  const outcome=await runPool({settings:{...settings,workers:2},inputSnapshot,engineHash:'different-source',
    next:createSampler(inputSnapshot.characters.length,1,12345),shouldCancel:()=>false,onResult:()=>assert.fail('must not run')});
  assert.match(outcome.failure.message,/Engine source changed/);
});
test('pre-cancelled parallel jobs preserve empty results and worker settings reject invalid values',async()=>{
  const run=await runSimulation({settings:{...settings,workers:2},inputSnapshot,targetMarkdown,shouldCancel:()=>true});
  assert.equal(run.status,'CANCELLED');assert.equal(run.completed,0);
  for(const workers of [-1,9,1.5])assert.throws(()=>workerCount({...settings,workers}));
  assert.equal(workerCount({...settings,workers:0}),1);
  assert.equal(parseArgs(['--workers','4']).workers,4);assert.throws(()=>parseArgs(['--workers','9']));
});
