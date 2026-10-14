const test = require('node:test');
const assert = require('node:assert/strict');
const {calculateCombatPower: cp, COMBAT_POWER_CONFIG: config} = require('../js/combat-power.js');
const buildContext = require('../balance/simulator/build-context.cjs');
const reference = {hp:3000, atk:100, magic:0, defense:15, resistance:15, attackSpeed:2, castSpeed:0.5, speed:1.5, attackRange:3};

test('reference scale, deterministic breakdown and no mutation', () => {
  const before = JSON.stringify(reference);
  assert.equal(cp(reference).total, 1000);
  assert.deepEqual(cp(reference), cp({...reference}));
  assert.equal(JSON.stringify(reference), before);
  assert.equal(Math.round(Object.values(cp(reference).contributions).reduce((a,b)=>a+b,0)), 1000);
  assert.equal(cp(reference).version, config.version);
});

test('stat increases and faster intervals are monotonic; limiting cast time matters', () => {
  for (const key of ['hp','atk','magic','defense','resistance','speed','attackRange']) {
    assert.ok(cp({...reference,[key]:reference[key]+10}).total > cp(reference).total, key);
  }
  assert.ok(cp({...reference,attackSpeed:1}).total > cp(reference).total);
  assert.ok(cp({...reference,castSpeed:3}).total < cp(reference).total);
  assert.equal(cp({...reference,castSpeed:0}).total, cp(reference).total);
});

test('malformed and extreme final stats produce finite nonnegative numbers', () => {
  for (const value of [undefined,NaN,Infinity,-Infinity,-100,null,{},[],Symbol('x'),1e308]) {
    const result = cp(Object.fromEntries(Object.keys(reference).map(key=>[key,value])));
    assert.ok(Number.isSafeInteger(result.total) && result.total>=0);
    assert.ok(Object.values(result.contributions).every(Number.isFinite));
  }
  for (const value of [null,undefined,{},false]) assert.ok(Number.isFinite(cp(value).total));
  assert.equal(cp({...reference,defense:100,resistance:100}).total, cp({...reference,defense:95,resistance:95}).total);
});

test('all six real attribute investments change CP and recovery restores it', () => {
  const c = buildContext();
  const base = {...c.characters[0], attributes:{}, equipment:{}};
  const original = c.getCharacterCombatPower(base);
  for (const key of ['str','vit','agi','focus','int','wis']) {
    const changed = c.getCharacterCombatPower({...base,attributes:{[key]:10}});
    assert.ok(changed.total > original.total,key);
    assert.equal(c.getCharacterCombatPower(base).total,original.total);
  }
});

test('actual sword/shield/armor equip, remove, repeated recalc and item attribute modifiers', () => {
  const c=buildContext();
  const base={...c.characters[0],attributes:{},equipment:{}};
  const before=JSON.stringify(base), total=c.getCharacterCombatPower(base).total;
  for (const name of ['한손검샘플','방패샘플']) {
    const item=c.items.find(i=>i.name===name);
    assert.ok(item,name);
    const build={...base,equipment:{}};
    c.equipItemToSlot(build.equipment,item,name==='방패샘플'?'subWeapon':'mainWeapon',build);
    const value=c.getCharacterCombatPower(build).total;
    assert.ok(value>total,name);
    for(let n=0;n<10;n++) assert.equal(c.getCharacterCombatPower(c.applyCharacterStatAbilities(build)).total,value);
    assert.equal(c.getCharacterCombatPower({...build,equipment:{}}).total,total);
  }
  const armor=c.items.find(i=>i.slot==='top' && i.defense>0);
  assert.ok(c.getCharacterCombatPower({...base,equipment:{top:armor.id}}).total>total);
  const sword=c.items.find(i=>i.name==='한손검샘플');
  const build={...base,equipment:{mainWeapon:sword.id}};
  const initial=c.getCharacterCombatPower(build);
  sword.statModifiers={str:5};
  const modified=c.getCharacterCombatPower(build);
  assert.equal(modified.finalStats.atk,initial.finalStats.atk+5);
  assert.equal(modified.total,cp(modified.finalStats).total);
  assert.equal(JSON.stringify(base),before);
});

test('runtime synergy, skill metadata, raw attributes and current HP are not separately scored', () => {
  const c=buildContext();
  const base=c.characters[0];
  const expected=c.getCharacterCombatPower(base);
  assert.equal(c.getCharacterCombatPower({...base,hp:1,runtimeSynergyModifiers:{hp:99999,str:50,atk:9999}}).total,expected.total);
  assert.equal(cp({...expected.finalStats,attributes:{str:999},skillIds:['x'],mp:9999,st:9999,bp:9999}).total,expected.total);
});

test('all stored builds match the battle unit final stats and selected loadouts', () => {
  const c=buildContext();
  for (const [index, character] of c.characters.entries()) {
    const before=JSON.stringify(character);
    const unit=c.createCharacter(character,index);
    const result=c.getCharacterCombatPower(character);
    assert.equal(result.total,cp(unit).total,character.name);
    for (const set of character.equipmentSets) {
      const build={...character,equipment:set.equipment};
      assert.equal(c.getCharacterCombatPower(build).total,cp(c.applyCharacterStatAbilities(build)).total);
    }
    assert.equal(JSON.stringify(character),before);
  }
});
