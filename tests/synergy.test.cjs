const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {SOURCES, ROOT, createEngine, loadData} = require('../balance/simulator/engine.cjs');
const path = require('node:path');

function fixture() {
  const data=loadData();
  const context=vm.createContext({structuredClone,Math,Date,performance,document:{getElementById:id=>id==='battleCanvas'?{width:400,height:300,getContext:()=>null}:null},log(){},logWarn(){},logError(){},alert(m){throw Error(m)}});
  context.window=context;
  for(const name of SOURCES) vm.runInContext(fs.readFileSync(path.join(ROOT,'js',name+'.js'),'utf8'),context);
  context.data=data;
  vm.runInContext(`categoriesJson=normalizeCategoryJson(data.categories);itemsJson=normalizeItemJson(data.items);factionsJson=normalizeFactionJson(data.factions);skillsJson=normalizeSkillJson(data.skills);entitiesJson=data.entities;characterJson=normalizeCombatJson(data.characters,[],'name');teamsJson=[];
    updateBattleButton=()=>{};clearBattleEventLogs=()=>{};addBattleEventLog=()=>{};
    globalThis.members=characterJson.slice(0,3);members[1].faction=members[0].faction;
    globalThis.def=(id,stat,value,target='team')=>({id,name:id,condition:{type:'faction',value:members[0].faction},stacking:'highest',thresholds:[{count:2,effects:[{type:'stat',stat,value,target}]}]});`,context);
  return {context, run:code=>vm.runInContext(code,context)};
}

test('threshold, multiple effects, highest/cumulative, targets, summons and dead members',()=>{
  const {run}=fixture();
  assert.equal(run(`evaluateSynergies([members[0]],[def('a','speed',10)]).states[0].active.length`),0);
  assert.equal(run(`evaluateSynergies([members[0],{...members[1],alive:false}],[def('a','speed',10)]).modifiers[0].speed`),10);
  for(const summonType of ['persistent','temporary']) assert.equal(run(`evaluateSynergies([members[0],{...members[1],isSummon:true,summonType:'${summonType}'}],[def('a','speed',10)]).states[0].count`),1);
  assert.equal(run(`const d=def('a','vit',5);d.thresholds.push({count:3,effects:[{type:'stat',stat:'vit',value:9,target:'team'}]});evaluateSynergies([members[0],members[1],members[0]],[d]).modifiers[0].vit`),9);
  assert.equal(run(`d.stacking='cumulative';evaluateSynergies([members[0],members[1],members[0]],[d]).modifiers[0].vit`),14);
  assert.equal(run(`evaluateSynergies([members[0],members[1],{...members[2],faction:'other'}],[def('a','speed',10,'matching'),def('b','vit',5)]).modifiers[2].speed`),undefined);
  assert.equal(run(`evaluateSynergies(members,[def('a','speed',10),def('b','vit',5)]).modifiers[0].vit`),5);
});

test('validation rejects invalid references, values, empty effects and duplicate IDs',()=>{
  const {run}=fixture();
  for(const change of [`x.condition=null`,`x.condition.value='missing'`,`x.condition.type='class'`,`x.thresholds[0].count=0`,`x.thresholds[0].count=1.5`,`x.thresholds[0].effects=[]`,`x.thresholds[0].effects[0].stat='missing'`,`x.thresholds[0].effects[0].value=NaN`,`x.thresholds[0].effects[0].value=Infinity`]) {
    assert.throws(()=>run(`{const x=def('a','vit',5);${change};validateSynergies([x]);}`));
  }
  assert.throws(()=>run(`validateSynergies([def('a','vit',5),def('a','vit',5)])`));
});

test('preview and runtime agree without base mutation, repeat accumulation or loadout loss',()=>{
  const {run}=fixture();
  run(`synergiesJson=[def('a','speed',10),def('b','vit',5)];globalThis.before=JSON.stringify(characterJson);globalThis.base=createCharacter(characterJson[0],0);globalThis.units=createSquadFromCharacterIds([0,1]);`);
  assert.equal(run(`units[0].speed-base.speed`),10);
  assert.equal(run(`units[0].maxHp-base.maxHp`),250);
  assert.equal(run(`units[0].attributes.vit-base.attributes.vit`),5);
  for(let i=0;i<3;i++) assert.equal(run(`createSquadFromCharacterIds([0,1])[0].speed-base.speed`),10);
  assert.equal(run(`JSON.stringify(characterJson)===before`),true);
  run(`globalThis.u=units[0];resetUnitForBattle(u);applyBattleEquipmentLoadout(u,u.equipmentLoadouts[0],0)`);
  assert.equal(run(`u.speed-base.speed`),10);
  run(`u.runtimeRuleOverrides=[{disableTeamSynergies:true}];refreshBattleEquipmentRuleState(u)`);
  assert.equal(run(`u.speed-base.speed`),0);
  run(`u.runtimeRuleOverrides=[];refreshBattleEquipmentRuleState(u)`);
  assert.equal(run(`u.speed-base.speed`),10);
  assert.equal(run(`createSquadFromCharacterIds([0])[0].speed-base.speed`),0);
});

test('headless battles apply the common evaluator and preserve result snapshots',()=>{
  const data=loadData();
  const faction=data.characters[0].faction;
  data.characters[1].faction=faction;
  data.synergies=[{id:'headless',name:'Headless fixture',condition:{type:'faction',value:faction},stacking:'highest',thresholds:[{count:2,effects:[{type:'stat',stat:'vit',value:5,target:'team'}]}]}];
  const before=JSON.stringify(data), engine=createEngine(data);
  const input={teamA:[0,1],teamB:[2,3],seed:23,maxSeconds:3};
  const first=engine.runBattle(input),second=engine.runBattle(input);
  assert.deepEqual(first,second);
  assert.equal(first.activeSynergies.player[0].id,'headless');
  assert.equal(JSON.stringify(data),before);
});

test('death, revival, both summon types, reserves and expiring independent suppression keep composition fixed',()=>{
  const {run}=fixture();
  run(`synergiesJson=[def('a','speed',10),def('b','vit',5)];
    playerSquad=createSquadFromCharacterIds([0,1],'player',1);enemySquad=[];
    playerSquad.forEach(resetUnitForBattle);snapshotBattleSynergies();
    globalThis.u=playerSquad[0];globalThis.speed=u.speed;globalThis.maxHp=u.maxHp;
    globalThis.saved=JSON.stringify(activeBattleSynergies);`);
  assert.equal(run(`playerSquad[1].isReserve`),true);
  assert.equal(run(`activeBattleSynergies.player.length`),2);
  run(`u.runtimeRuleOverrides=[{disableTeamSynergies:true,remainingTicks:1}];refreshBattleEquipmentRuleState(u)`);
  assert.ok(Math.abs(run(`u.speed`)-run(`speed-10`)) < 1e-9);
  run(`updateRuntimeRuleOverrides()`);
  assert.equal(run(`u.speed`),run(`speed`));
  run(`u.runtimeRuleOverrides=[{disableEquipmentEffects:true,disableTeamSynergies:true,remainingTicks:null}];refreshBattleEquipmentRuleState(u)`);
  assert.equal(run(`u.speed`),run(`createCharacter({...members[0],equipment:{}},0).speed`));
  run(`u.hp=0;syncAliveState(u);updateRuntimeRuleOverrides();activateWaitingUnit(u,'revive')`);
  assert.equal(run(`u.speed`),run(`speed`));
  assert.equal(run(`u.maxHp`),run(`maxHp`));
  run(`for(const summonType of ['persistent','temporary']) {
    const s=createSummonedBattleUnit(u,{name:'fixture',summonType,hp:100,mp:10,st:10,speed:1,attackSpeed:1,castTime:0,attackRange:1,atk:1,magic:1,defense:0,resistance:0});playerSquad.push(s);
  }`);
  assert.equal(run(`evaluateSynergies(playerSquad).states[0].count`),2);
  assert.equal(run(`JSON.stringify(activeBattleSynergies)===saved`),true);
});

test('battle record reload retains the starting synergy snapshot after definitions change',()=>{
  const {context,run}=fixture();
  vm.runInContext(fs.readFileSync(path.join(ROOT,'js/record.js'),'utf8'),context);
  run(`synergiesJson=[def('record','vit',5)];playerSquad=createSquadFromCharacterIds([0,1]);enemySquad=[];
    resetBattleEvents();playerSquad.forEach(resetUnitForBattle);snapshotBattleSynergies();
    globalThis.record=createBattleRecord('fixture');synergiesJson=[];
    globalThis.loaded=normalizeRecordJson(JSON.parse(JSON.stringify([record])));`);
  assert.equal(run(`loaded[0].activeSynergies.player[0].id`),'record');
  assert.equal(run(`loaded[0].activeSynergies.player[0].count`),2);
});
