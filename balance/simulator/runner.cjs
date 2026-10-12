'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {createEngine,loadData,seededRandom,fingerprint,ROOT} = require('./engine.cjs');
const {parseTargets,makeReport} = require('./report.cjs');

function createSampler(poolSize, teamSize, seed) {
  if (!Number.isInteger(teamSize) || teamSize < 1 || teamSize > 10 || poolSize < teamSize*2) {
    throw new Error('team-size requires 1–10 members and at least twice that many registered characters');
  }
  const counts = Array(poolSize).fill(0), random = seededRandom(seed);
  return () => {
    const selected = counts.map((count,id)=>({id,count,tie:random()}))
      .sort((a,b)=>a.count-b.count || a.tie-b.tie).slice(0,2*teamSize).map(x=>x.id);
    for (const id of selected) counts[id]++;
    for (let i=selected.length-1;i>0;i--) {
      const j = Math.floor(random()*(i+1));
      [selected[i],selected[j]]=[selected[j],selected[i]];
    }
    return {teamA:selected.slice(0,teamSize),teamB:selected.slice(teamSize),seed:Math.floor(random()*4294967296)};
  };
}

function parseArgs(args) {
  const options = {preset:'quick',seed:12345,maxSeconds:600,width:400,height:300,minSamples:30};
  const keys = {'--count':'count','--preset':'preset','--team-size':'teamSize','--seed':'seed','--max-seconds':'maxSeconds',
    '--width':'width','--height':'height','--min-samples':'minSamples','--replay':'replay','--battle':'battle'};
  for (let i=0;i<args.length;i++) {
    if (args[i]==='--help') {options.help=true;continue;}
    const key=keys[args[i]];
    if (!key || args[i+1] === undefined || args[i+1].startsWith('--')) throw new Error('Unknown/missing option: '+args[i]);
    options[key]=['preset','replay'].includes(key) ? args[++i] : Number(args[++i]);
  }
  const presets={quick:100,standard:1000,deep:10000};
  if (!presets[options.preset]) throw new Error('preset must be quick, standard or deep');
  options.count ??= presets[options.preset];
  for (const key of ['count','teamSize','width','height','minSamples','battle']) {
    if (options[key] !== undefined && (!Number.isSafeInteger(options[key]) || options[key]<1)) throw new Error(key+' must be a positive integer');
  }
  if (!Number.isInteger(options.seed) || options.seed<0 || options.seed>0xFFFFFFFF) throw new Error('seed must be uint32');
  if (!Number.isFinite(options.maxSeconds) || options.maxSeconds<=0) throw new Error('max-seconds must be positive');
  if (options.width<20 || options.height<20) throw new Error('field dimensions must be at least 20');
  return options;
}

async function main(args = process.argv.slice(2)) {
  const options=parseArgs(args);
  if (options.help) {
    console.log('node balance/simulator/runner.cjs [--preset quick|standard|deep] [--count 1000] [--team-size 3] [--seed 12345] [--max-seconds 600] [--width 400 --height 300] [--min-samples 30]\nReplay: --replay balance/results/<run>.json --battle 1');
    return;
  }
  if (options.replay) {
    const saved=JSON.parse(fs.readFileSync(options.replay,'utf8'));
    const battle=saved.results[(options.battle ?? 1)-1];
    if (!battle) throw new Error('Battle index out of range (1-based)');
    const engine=createEngine(saved.inputSnapshot,saved.settings);
    if (engine.engineHash!==saved.engineHash) throw new Error('Engine changed: use the original source revision to reproduce');
    if (fingerprint(saved.inputSnapshot)!==saved.dataHash) throw new Error('Input snapshot hash mismatch');
    const result=engine.runBattle({...battle,maxSeconds:saved.settings.maxSeconds});
    if (JSON.stringify(result)!==JSON.stringify(battle)) throw new Error('Replay differs from saved result');
    console.log(JSON.stringify(result,null,2));
    return;
  }
  const inputSnapshot=loadData();
  const targetMarkdown=fs.readFileSync(path.join(ROOT,'docs/balance/BALANCE_TARGETS.md'),'utf8');
  const targets=parseTargets(targetMarkdown);
  let cancelled=false;const cancel=()=>{cancelled=true;};process.once('SIGINT',cancel);
  const {runSimulation}=require('./service.cjs');
  let run;
  try {run=await runSimulation({settings:options,inputSnapshot,targetMarkdown,shouldCancel:()=>cancelled,onProgress:p=>{
    if(p.completed && (p.completed%Math.max(1,Math.floor(p.total/20))===0 || p.completed===p.total))
      console.log(`${p.completed}/${p.total} (${(p.completed/p.total*100).toFixed(1)}%) · ${p.elapsedSeconds.toFixed(1)}s`);
  }});} finally {process.removeListener('SIGINT',cancel);}
  const filename=run.startedAt.replace(/[:.]/g,'-')+'_'+options.count+'.json';
  const resultDir=path.join(ROOT,'balance/results');
  fs.mkdirSync(resultDir,{recursive:true});
  fs.writeFileSync(path.join(resultDir,filename),JSON.stringify(run,null,2)+'\n',{flag:'wx'});
  const report=makeReport(run,targets,'../../balance/results/'+filename);
  fs.writeFileSync(path.join(ROOT,'docs/balance/BALANCE_REPORT.md'),report);
  fs.writeFileSync(path.join(resultDir,filename.replace('.json','.md')),makeReport(run,targets,'./'+filename)
    .replace('(BALANCE_TARGETS.md)','(../../docs/balance/BALANCE_TARGETS.md)').replace('(SIMULATION_GUIDE.md)','(../../docs/balance/SIMULATION_GUIDE.md)'),{flag:'wx'});
  console.log(`Raw: balance/results/${filename}\nReport: docs/balance/BALANCE_REPORT.md`);
  console.table(run.summary.characters.map(c=>({character:c.name,battles:c.battles,winRate:c.winRate.toFixed(2),DPS:c.dps.toFixed(2),HPS:c.hps.toFixed(2)})));
  if(run.status==='FAILED')process.exitCode=1;
  return run;
}
module.exports={createSampler,parseArgs,main};
if (require.main===module) {
  main().catch(error=>{console.error(error.stack);process.exitCode=1;});
}
