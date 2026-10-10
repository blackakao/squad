const test=require('node:test');
const assert=require('node:assert/strict');
require('../js/portrait/hair-colors.js');
require('../js/portrait/imported-catalog.js');
require('../js/portrait/catalog.js');
const c=ImportedPortraitCatalog;
test('imported catalog has ten variants for each feature and each hair group',()=>{
  for(const group of ['male','female'])assert.equal(c.hair.filter(h=>h.group===group).length,10);
  assert.ok(c.hair.every(h=>h.transform.position.length===3&&h.transform.rotation.length===3&&h.transform.scale.length===3));
  assert.deepEqual(c.hair.find(h=>h.id==='m1').transform,{position:[0,.004,-.006],rotation:[0,0,0],scale:[1.02,1.01,1.03]});
  for(const field of ['eyes','noses','ears','mouths','skins']){assert.equal(c[field].length,10);assert.equal(new Set(c[field].map(x=>x.id)).size,10);}
  assert.equal(c.eyebrows.length,5);assert.equal(new Set(c.eyebrows.map(x=>x.id)).size,5);
  assert.equal(c.hairColors.length,8);
  assert.equal(c.eyeColors.length,8);assert.equal(new Set(c.eyeColors.map(x=>x.id)).size,8);
  assert.ok(c.hair.every(h=>h.crown&&h.crown.scale.length===3));
  assert.ok(c.hair.every(h=>h.surface&&h.surface.position.length===3&&h.surface.scale.length===3));
  assert.equal(new Set(c.hair.map(h=>JSON.stringify(h.surface))).size,20);
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
  const old={...c.defaults};delete old.hairColor;delete old.eyeColor;delete old.eyebrows;
  assert.equal(c.normalize(old).hairColor,c.defaults.hairColor);assert.equal(c.normalize(old).eyeColor,c.defaults.eyeColor);assert.equal(c.normalize(old).eyebrows,c.defaults.eyebrows);
});
