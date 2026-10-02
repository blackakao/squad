const test=require('node:test');
const assert=require('node:assert/strict');
require('../js/portrait/imported-catalog.js');
require('../js/portrait/catalog.js');
const c=ImportedPortraitCatalog;
test('imported catalog has ten variants for each feature and each hair group',()=>{
  for(const group of ['male','female'])assert.equal(c.hair.filter(h=>h.group===group).length,10);
  for(const field of ['eyes','noses','ears','mouths','skins']){assert.equal(c[field].length,10);assert.equal(new Set(c[field].map(x=>x.id)).size,10);}
  assert.deepEqual(PortraitCatalog.normalize(c.defaults),c.defaults);
  assert.equal(c.normalize({...c.defaults,ears:'ear11'}),null);
  assert.equal(c.normalize({...c.defaults,base:'male'}),null);
});
test('hair entries represent independent silhouettes',()=>{
  assert.deepEqual(c.hair.filter(h=>h.group==='female').map(h=>h.name),['단발','긴 생머리','포니테일','트윈테일','높은 올림머리','양갈래 땋은 머리','웨이브 단발','옆으로 땋은 머리','양쪽 둥근 올림머리','공주 반묶음']);
  assert.ok(c.hair.every(h=>!h.name.includes('원본')));
});
test('random variants retain the model and locked features; legacy recipes survive',()=>{
  for(const base of ['male','female'])for(let n=0;n<100;n++){
    const original={...c.defaults,base,hair:base==='male'?'m1':'f1'};
    const r=c.randomize(original,{locks:{ears:true,skin:true},random:()=>n/100});
    assert.ok(c.normalize(r));assert.equal(r.base,base);assert.equal(r.ears,original.ears);assert.equal(r.skin,original.skin);assert.notEqual(r.hair,original.hair);
  }
  assert.deepEqual(PortraitCatalog.normalize(PortraitCatalog.defaults),PortraitCatalog.defaults);
});
