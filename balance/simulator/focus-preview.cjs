'use strict';
const {createEngine}=require('./engine.cjs');
const {createFocusPlan}=require('./focus.cjs');
let input='';process.stdin.setEncoding('utf8');
process.stdin.on('data',chunk=>input+=chunk);
process.stdin.on('end',()=>{
  try {const {inputSnapshot,settings}=JSON.parse(input);
    const engine=createEngine(inputSnapshot,settings),plan=createFocusPlan(engine,settings);
    process.stdout.write(JSON.stringify(plan));
  }catch(error){process.stderr.write(String(error.message));process.exitCode=1;}
});
