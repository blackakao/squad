'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {jsonParts,atomicParts}=require('../balance/simulator/storage.cjs');
test('serialization never stringifies a whole object/array and preserves JSON values',()=>{
  const input={name:'한글 "문자"',nested:[{wins:1,optional:undefined},null,true,'\n'],empty:[],number:Infinity};
  const original=JSON.stringify,expected=original(input);
  JSON.stringify=value=>{assert.ok(value===null || typeof value!=='object');return original(value);};
  try {assert.equal([...jsonParts(input)].join(''),expected);}finally{JSON.stringify=original;}
});
test('interrupted chunk write preserves existing destination and cleans temporary file',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'simulation-storage-')),file=path.join(dir,'result.json');
  try {
    fs.writeFileSync(file,'original');
    function* broken(){yield '{';throw Error('disk/input failure');}
    assert.throws(()=>atomicParts(file,broken()),/failure/);
    assert.equal(fs.readFileSync(file,'utf8'),'original');assert.deepEqual(fs.readdirSync(dir),['result.json']);
    atomicParts(file,jsonParts({rows:Array.from({length:2000},(_,i)=>({id:i,text:'한글'.repeat(40)}))}));
    assert.equal(JSON.parse(fs.readFileSync(file,'utf8')).rows.length,2000);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
