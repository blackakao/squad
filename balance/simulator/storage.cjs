'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {makeReport,parseTargets}=require('./report.cjs');

// Arrays/objects are emitted incrementally; no whole-run JSON string exists.
function* jsonParts(value) {
  if(Array.isArray(value)) {
    yield '[';
    for(let i=0;i<value.length;i++){if(i)yield ',';yield* jsonParts(value[i] ?? null);}
    yield ']';
  } else if(value && typeof value==='object') {
    yield '{';let first=true;
    for(const [key,item] of Object.entries(value)) {
      if(item===undefined)continue;
      if(!first)yield ',';first=false;
      yield JSON.stringify(key)+':';yield* jsonParts(item);
    }
    yield '}';
  } else yield JSON.stringify(value);
}
function atomicParts(file,parts) {
  const temp=file+'.'+randomUUID()+'.tmp';
  let fd;
  try {
    fd=fs.openSync(temp,'wx');
    let buffer=[],size=0;
    const flush=()=>{if(size){fs.writeFileSync(fd,buffer.join(''));buffer=[];size=0;}};
    for(const part of parts){buffer.push(part);size+=part.length;if(size>=65536)flush();}
    flush();fs.fsyncSync(fd);fs.closeSync(fd);fd=undefined;
    for(let attempt=0;;attempt++) {
      try {fs.renameSync(temp,file);break;}
      catch(error) {
        if(!['EPERM','EACCES','EBUSY'].includes(error.code)||attempt===5)throw error;
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,20*2**attempt);
      }
    }
  } finally {
    if(fd!==undefined)fs.closeSync(fd);
    if(fs.existsSync(temp))fs.unlinkSync(temp);
  }
}
function saveRun(directory,run,results=run.results) {
  const {results:ignored,inputSnapshot,...summary}=run;
  function* raw() {
    yield '{';let first=true;
    for(const [key,value] of Object.entries(run)) {
      if(key==='results'||value===undefined)continue;
      if(!first)yield ',';first=false;yield JSON.stringify(key)+':';yield* jsonParts(value);
    }
    if(!first)yield ',';yield '"results":[';first=true;
    for(const battle of results){if(!first)yield ',';first=false;yield* jsonParts(battle);}
    yield ']}\n';
  }
  atomicParts(path.join(directory,'result.json'),raw());
  atomicParts(path.join(directory,'report.md'),[makeReport(run,parseTargets(run.targetMarkdown),'./result.json')]);
  // Commit small dashboard data last, after the raw result and report exist.
  atomicParts(path.join(directory,'summary.json'),jsonParts(summary));
}
module.exports={jsonParts,atomicParts,saveRun};
