const test = require('node:test');
const assert = require('node:assert/strict');
require('../js/portrait/hair-colors.js');
require('../js/portrait/catalog.js');
const catalog = globalThis.PortraitCatalog;

test('requested unique part counts and valid defaults',()=>{
  assert.equal(catalog.hair.filter(x=>x.group==='male').length,10);
  assert.equal(catalog.hair.filter(x=>x.group==='female').length,10);
  for(const [key,count] of Object.entries({hair:20,hairColors:8,eyes:10,eyebrows:5,noses:5,mouths:10,skins:5})){
    assert.equal(catalog[key].length,count);
    assert.equal(new Set(catalog[key].map(x=>x.id)).size,count);
  }
  assert.deepEqual(catalog.normalize(catalog.defaults),catalog.defaults);
});

test('invalid recipes are rejected and unknown fields are not retained',()=>{
  for(const value of [null,{}, {...catalog.defaults,version:2}, {...catalog.defaults,hair:'missing'}])assert.equal(catalog.normalize(value),null);
  assert.deepEqual(catalog.normalize({...catalog.defaults,extra:'ignored'}),catalog.defaults);
  const old={...catalog.defaults};delete old.hairColor;delete old.eyebrows;
  assert.equal(catalog.normalize(old).hairColor,catalog.defaults.hairColor);assert.equal(catalog.normalize(old).eyebrows,catalog.defaults.eyebrows);
});

test('random stays in group, respects locks, changes unlocked parts without mutation',()=>{
  const before={...catalog.defaults};
  for(const group of ['male','female'])for(let seed=0;seed<100;seed++){
    const result=catalog.randomize(before,{group,locks:{eyes:true,skin:true},random:()=>seed/100});
    assert.ok(catalog.normalize(result));
    assert.equal(catalog.hair.find(x=>x.id===result.hair).group,group);
    assert.equal(result.eyes,before.eyes);assert.equal(result.skin,before.skin);
    assert.notEqual(result.nose,before.nose);assert.notEqual(result.mouth,before.mouth);
  }
  assert.deepEqual(before,catalog.defaults);
  assert.deepEqual(catalog.randomize(before,{locks:{hair:true,hairColor:true,eyes:true,eyebrows:true,nose:true,mouth:true,skin:true}}),before);
});
