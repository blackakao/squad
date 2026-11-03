'use strict';
const {execFileSync} = require('node:child_process');
const {createEngine,fingerprint,ROOT} = require('./engine.cjs');
const {createSampler} = require('./runner.cjs');
const {aggregate,parseTargets} = require('./report.cjs');
const {runPool,workerCount}=require('./pool.cjs');

// Shared by the CLI and server worker. A yield between complete battles permits
// cancellation/parent-disconnect handling without changing any combat ticks.
async function runSimulation({settings,inputSnapshot,targetMarkdown,onProgress=()=>{},onBattle=()=>{},shouldCancel=()=>false}) {
  const startedAt=new Date().toISOString(),start=performance.now();
  const engine=createEngine(inputSnapshot,settings);
  settings={...settings,teamSize:settings.teamSize ?? Math.min(3,Math.floor(engine.roster.length/2))};
  settings.workers=workerCount(settings);
  parseTargets(targetMarkdown);
  const next=createSampler(engine.roster.length,settings.teamSize,settings.seed);
  const results=[];
  let status='COMPLETED',error=null;
  onProgress({completed:0,total:settings.count,elapsedSeconds:0,workers:settings.workers});
  try {
    if(shouldCancel())status='CANCELLED';
    else if(settings.workers>1) {
      const outcome=await runPool({settings,inputSnapshot,engineHash:engine.engineHash,next,shouldCancel,
        onResult:result=>{
          results.push(result);onBattle(result);
          onProgress({completed:results.length,total:settings.count,elapsedSeconds:(performance.now()-start)/1000,workers:settings.workers});
        }});
      if(outcome.failure)throw outcome.failure;
      if(outcome.cancelled && results.length<settings.count)status='CANCELLED';
    } else for(let i=0;i<settings.count;i++) {
      if(shouldCancel()){status='CANCELLED';break;}
      const result=engine.runBattle({...next(),maxSeconds:settings.maxSeconds,battleId:'battle-'+(i+1)});
      results.push(result);onBattle(result);
      onProgress({completed:results.length,total:settings.count,elapsedSeconds:(performance.now()-start)/1000,workers:settings.workers});
      await new Promise(resolve=>setImmediate(resolve));
    }
  } catch(cause) {status='FAILED';error=String(cause.message || cause);console.error(cause.stack || cause);}
  // Restore original battle order before aggregation, serialization and replay.
  results.sort((a,b)=>Number(a.battleId.slice(7))-Number(b.battleId.slice(7)));
  let gitRevision='unknown';
  try {gitRevision=execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8',windowsHide:true}).trim();} catch {}
  return {schemaVersion:1,startedAt,finishedAt:new Date().toISOString(),status,error,
    completed:results.length,elapsedSeconds:(performance.now()-start)/1000,nodeVersion:process.version,gitRevision,
    engineHash:engine.engineHash,dataHash:fingerprint(inputSnapshot),settings,inputSnapshot,targetMarkdown,
    summary:aggregate(results,engine.roster,settings.minSamples),results};
}
module.exports={runSimulation};
