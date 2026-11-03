'use strict';
// Fixed snapshot benchmark, independent of game saves and the latest CLI report.
const fs=require('node:fs'),path=require('node:path'),inspector=require('node:inspector');
const {loadData,ROOT,fingerprint}=require('./engine.cjs');
const {runSimulation}=require('./service.cjs');
async function main() {
  const [label='current',countText='100',teamText='1',workerText='1']=process.argv.slice(2);
  if(!/^[a-z0-9_-]+$/i.test(label))throw new Error('Invalid label');
  const count=Number(countText),teamSize=Number(teamText),workers=Number(workerText);
  if(!Number.isSafeInteger(count)||count<1||count>10000||![1,2,3].includes(teamSize)||!Number.isInteger(workers)||workers<0||workers>8)throw new Error('Invalid benchmark settings');
  const dir=path.join(ROOT,'balance/benchmarks/20261103');fs.mkdirSync(dir,{recursive:true});
  const snapshotFile=path.join(dir,'input.json');
  if(!fs.existsSync(snapshotFile))fs.writeFileSync(snapshotFile,JSON.stringify(loadData()));
  const inputSnapshot=JSON.parse(fs.readFileSync(snapshotFile,'utf8'));
  const targetMarkdown=fs.readFileSync(path.join(ROOT,'docs/balance/BALANCE_TARGETS.md'),'utf8');
  const session=new inspector.Session();session.connect();
  const post=method=>new Promise((resolve,reject)=>session.post(method,(error,result)=>error?reject(error):resolve(result)));
  if(workers===1){await post('Profiler.enable');await post('Profiler.start');}
  const started=performance.now();
  const run=await runSimulation({inputSnapshot,targetMarkdown,
    settings:{count,teamSize,workers,seed:12345,maxSeconds:600,width:400,height:300,minSamples:30},
    onProgress:p=>{if(p.completed && p.completed%Math.max(1,Math.floor(count/10))===0)console.log(`${p.completed}/${count} ${p.elapsedSeconds.toFixed(2)}s`);}});
  const wallSeconds=(performance.now()-started)/1000;
  let profileSummary=[];
  if(workers===1) {
    const {profile}=await post('Profiler.stop');
    fs.writeFileSync(path.join(dir,label+'.cpuprofile'),JSON.stringify(profile));
    const nodes=new Map(profile.nodes.map(n=>[n.id,n])),times=new Map();
    (profile.samples||[]).forEach((id,i)=>{const f=nodes.get(id).callFrame,key=f.functionName+' '+f.url+':'+(f.lineNumber+1);times.set(key,(times.get(key)||0)+(profile.timeDeltas[i]||0));});
    profileSummary=[...times].sort((a,b)=>b[1]-a[1]).slice(0,15).map(([name,us])=>({name,ms:us/1000}));
  }
  session.disconnect();
  fs.writeFileSync(path.join(dir,label+'.result.json'),JSON.stringify(run));
  const summary={settings:run.settings,wallSeconds,status:run.status,completed:run.completed,dataHash:run.dataHash,engineHash:run.engineHash,
    resultsHash:fingerprint(run.results),estimated10000Seconds:wallSeconds/run.completed*10000,profileSummary};
  fs.writeFileSync(path.join(dir,label+'.json'),JSON.stringify(summary,null,2));
  console.log(JSON.stringify(summary,null,2));
  if(run.status!=='COMPLETED')process.exitCode=1;
}
main().catch(error=>{console.error(error);process.exitCode=1;});
