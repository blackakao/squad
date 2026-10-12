'use strict';
// Reproducible CPU/stage measurement. Never modifies game input.
const fs = require('node:fs');
const path = require('node:path');
const inspector = require('node:inspector');
const {createEngine,loadData,fingerprint,ROOT} = require('./engine.cjs');
const {createSampler} = require('./runner.cjs');
const {aggregate} = require('./report.cjs');
async function main() {
  const dir=path.join(ROOT,'.tmp-balance-profile');fs.mkdirSync(dir,{recursive:true});
  const label=process.argv[2] || 'current', count=Number(process.argv[3] || 100);
  if(!/^[a-z0-9_-]+$/i.test(label) || !Number.isSafeInteger(count) || count<1 || count>10000) throw new Error('Use a simple label and count 1–10000');
  const inputFile=path.join(dir,'input.json');
  if (!fs.existsSync(inputFile)) fs.writeFileSync(inputFile,JSON.stringify(loadData()));
  const data=JSON.parse(fs.readFileSync(inputFile,'utf8'));
  const session=new inspector.Session();session.connect();
  const post=(method)=>new Promise((resolve,reject)=>session.post(method,(err,value)=>err?reject(err):resolve(value)));
  await post('Profiler.enable');await post('Profiler.start');
  const start=performance.now(), e=createEngine(data), ready=performance.now();
  const next=createSampler(data.characters.length,3,12345),results=[];
  for(let i=0;i<count;i++)results.push(e.runBattle({...next(),battleId:'battle-'+(i+1)}));
  const battlesAt=performance.now(),summary=aggregate(results,e.roster),aggregatedAt=performance.now();
  const serialized=JSON.stringify({summary,results}),serializedAt=performance.now();
  const {profile}=await post('Profiler.stop');session.disconnect();
  const nodes=new Map(profile.nodes.map(n=>[n.id,n])),times=new Map();
  (profile.samples || []).forEach((id,i)=>{const n=nodes.get(id),key=n.callFrame.functionName+' '+n.callFrame.url+':'+(n.callFrame.lineNumber+1);times.set(key,(times.get(key)||0)+(profile.timeDeltas[i]||0));});
  const report={label,count,dataHash:fingerprint(data),resultsHash:fingerprint(results),
    elapsedSeconds:(serializedAt-start)/1000,stagesMs:{initialize:ready-start,battles:battlesAt-ready,aggregate:aggregatedAt-battlesAt,serialize:serializedAt-aggregatedAt},
    serializedBytes:Buffer.byteLength(serialized),topSelfMs:[...times].sort((a,b)=>b[1]-a[1]).slice(0,30).map(([name,us])=>({name,ms:us/1000}))};
  fs.writeFileSync(path.join(dir,label+'.json'),JSON.stringify(report,null,2));
  fs.writeFileSync(path.join(dir,label+'.cpuprofile'),JSON.stringify(profile));
  console.log(JSON.stringify(report,null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
