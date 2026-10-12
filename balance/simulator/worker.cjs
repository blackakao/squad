'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {runSimulation}=require('./service.cjs');
const {parseTargets,makeReport}=require('./report.cjs');
function atomic(file,text){const temp=file+'.tmp';fs.writeFileSync(temp,text);fs.renameSync(temp,file);}
async function main(){
  const dir=path.resolve(process.argv[2]);
  const input=JSON.parse(fs.readFileSync(path.join(dir,'request.json'),'utf8'));
  let parentGone=false,lastUpdate=0;
  process.stdin.resume();process.stdin.on('end',()=>{parentGone=true;});
  const journal=fs.openSync(path.join(dir,'battles.ndjson'),'a');
  let run;
  try {
    run=await runSimulation({...input,
      shouldCancel:()=>parentGone || fs.existsSync(path.join(dir,'cancel')),
      onBattle:result=>fs.writeSync(journal,JSON.stringify(result)+'\n'),
      onProgress:progress=>{
        if(!progress.completed || performance.now()-lastUpdate>=250 || progress.completed===progress.total){
          process.stdout.write(JSON.stringify({type:'progress',...progress})+'\n');lastUpdate=performance.now();
        }
      }});
  } finally {fs.closeSync(journal);}
  atomic(path.join(dir,'result.json'),JSON.stringify(run,null,2)+'\n');
  atomic(path.join(dir,'report.md'),makeReport(run,parseTargets(run.targetMarkdown),'./result.json'));
  process.stdout.write(JSON.stringify({type:'finished',status:run.status,error:run.error,completed:run.completed,
    total:run.settings.count,elapsedSeconds:run.elapsedSeconds,dataHash:run.dataHash,engineHash:run.engineHash,gitRevision:run.gitRevision,
    averageDuration:run.summary.duration.average})+'\n');
  process.stdin.pause();
}
main().catch(error=>{console.error(error.stack || error);process.exitCode=1;process.stdin.pause();});
