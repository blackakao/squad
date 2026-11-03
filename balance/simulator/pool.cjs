'use strict';
const {Worker}=require('node:worker_threads');
const path=require('node:path');
const os=require('node:os');
function workerCount(settings) {
  const requested=settings.workers??0;
  if(!Number.isInteger(requested)||requested<0||requested>8)throw new Error('workers must be an integer from 0 (auto) to 8');
  const available=os.availableParallelism();
  const automatic=settings.count<100 ? 1 : Math.min(4,Math.max(1,Math.floor(available/2)));
  return Math.min(settings.count,requested || automatic,available);
}
// Only the coordinator consumes sampler RNG. Completion order cannot alter seeds.
function runPool({settings,inputSnapshot,engineHash,next,shouldCancel,onResult}) {
  return new Promise(resolve=>{
    let assigned=0,exited=0,cancelled=false,failure=null;
    const count=settings.workers;
    const fail=error=>{failure ||= error instanceof Error ? error : new Error(String(error));};
    for(let i=0;i<count;i++) {
      let worker;
      try {worker=new Worker(path.join(__dirname,'battle-worker.cjs'),{workerData:{settings,inputSnapshot}});}
      catch(error) {fail(error);exited++;continue;}
      let closing=false,busy=null;
      function dispatch() {
        try {
          cancelled ||= shouldCancel();
          if(failure || cancelled || assigned>=settings.count) {closing=true;worker.postMessage(null);return;}
          const index=assigned++,config={...next(),maxSeconds:settings.maxSeconds,battleId:'battle-'+(index+1)};
          busy=index;worker.postMessage({index,config});
        } catch(error) {fail(error);closing=true;worker.postMessage(null);}
      }
      worker.on('message',message=>{
        try {
          if(message.type==='ready') {
            if(message.engineHash!==engineHash)throw new Error('Engine source changed while workers were starting; restart this simulation.');
          } else if(message.type==='result') {
            if(message.index!==busy)throw new Error('Unexpected worker result index');
            busy=null;onResult(message.result,message.index);
          } else throw new Error(message.error || 'Unknown worker message');
        } catch(error) {fail(error);}
        dispatch();
      });
      worker.on('error',fail);
      worker.on('exit',code=>{
        if(!closing || code!==0)fail(new Error('Battle worker exited unexpectedly: '+code));
        if(++exited===count)resolve({cancelled,failure});
      });
    }
    if(exited===count)resolve({cancelled,failure});
  });
}
module.exports={runPool,workerCount};
