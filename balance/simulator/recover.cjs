'use strict';
const fs=require('node:fs');
const path=require('node:path');
const readline=require('node:readline');
const {aggregate}=require('./report.cjs');
const {fingerprint}=require('./engine.cjs');
const {saveRun,atomicParts,jsonParts}=require('./storage.cjs');

async function recover(directory) {
  const dir=path.resolve(directory),read=name=>JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));
  const job=read('job.json'),input=read('request.json');
  if(!['FAILED','CANCELLED'].includes(job.status))throw Error('Only stopped failed/cancelled jobs can be recovered');
  if(fs.existsSync(path.join(dir,'result.json')))throw Error('Result already exists; refusing to overwrite');
  const journal=path.join(dir,'battles.ndjson'),entries=[],compact=[],ids=new Set();
  let offset=0;
  const lines=readline.createInterface({input:fs.createReadStream(journal),crlfDelay:Infinity});
  for await(const line of lines) {
    const battle=JSON.parse(line),id=Number(battle.battleId?.replace(/^battle-/,''));
    if(!Number.isInteger(id)||id<1||id>input.settings.count||ids.has(id))throw Error('Invalid/duplicate battle ID');
    ids.add(id);
    const length=Buffer.byteLength(line);
    entries.push({id,offset,length});offset+=length+1; // journal writer uses LF
    compact.push({battleId:battle.battleId,teamA:battle.teamA,teamB:battle.teamB,winner:battle.winner,
      termination:battle.termination,duration:battle.duration,characters:battle.characters.map(c=>({
        characterId:c.characterId,team:c.team,outcome:c.outcome,damageDealt:c.damageDealt,
        healingDone:c.healingDone,contribution:c.contribution}))});
  }
  entries.sort((a,b)=>a.id-b.id);compact.sort((a,b)=>Number(a.battleId.slice(7))-Number(b.battleId.slice(7)));
  const roster=input.inputSnapshot.characters.map((c,id)=>({id,name:c.name,role:c.role}));
  const complete=entries.length===input.settings.count;
  const run={...input,schemaVersion:1,startedAt:job.startedAt,finishedAt:job.finishedAt,
    status:complete?'COMPLETED':job.status,error:complete?null:job.error,completed:entries.length,
    elapsedSeconds:job.elapsedSeconds,engineHash:'unknown (journal recovery)',gitRevision:'unknown (journal recovery)',
    nodeVersion:'unknown (journal recovery)',dataHash:fingerprint(input.inputSnapshot),
    recovery:{recoveredAt:new Date().toISOString(),source:'battles.ndjson',originalError:job.error,partial:!complete},
    summary:aggregate(compact,roster,input.settings.minSamples)};
  if(job.workers)run.settings={...run.settings,workers:job.workers};
  function* originalBattles() {
    const fd=fs.openSync(journal,'r');
    try {for(const entry of entries){const buffer=Buffer.alloc(entry.length);
      let used=0;while(used<buffer.length){const n=fs.readSync(fd,buffer,used,buffer.length-used,entry.offset+used);if(!n)throw Error('Incomplete journal');used+=n;}
      const battle=JSON.parse(buffer.toString('utf8'));
      if(battle.battleId!=='battle-'+entry.id)throw Error('Journal offset mismatch');
      yield battle;
    }} finally {fs.closeSync(fd);}
  }
  saveRun(dir,run,originalBattles());
  fs.copyFileSync(path.join(dir,'job.json'),path.join(dir,'job.before-recovery.json'),fs.constants.COPYFILE_EXCL);
  atomicParts(path.join(dir,'job.json'),jsonParts({...job,status:run.status,error:run.error,completed:run.completed,
    recovery:run.recovery,dataHash:run.dataHash,engineHash:run.engineHash,gitRevision:run.gitRevision,
    averageDuration:run.summary.duration.average}));
  return {completed:run.completed,status:run.status,combinations:run.summary.combinations.length};
}
module.exports={recover};
if(require.main===module)recover(process.argv[2]).then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(error);process.exitCode=1;});
