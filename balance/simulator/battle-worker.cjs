'use strict';
const {parentPort,workerData}=require('node:worker_threads');
const {createEngine}=require('./engine.cjs');
const engine=createEngine(workerData.inputSnapshot,workerData.settings);
parentPort.on('message',task=>{
  if(task===null){parentPort.close();return;}
  try {parentPort.postMessage({type:'result',index:task.index,result:engine.runBattle(task.config)});}
  catch(error){parentPort.postMessage({type:'failure',error:error.stack || String(error)});}
});
parentPort.postMessage({type:'ready',engineHash:engine.engineHash});
