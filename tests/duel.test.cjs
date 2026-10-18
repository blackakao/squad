const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const {SOURCES, ROOT, loadData} = require('../balance/simulator/engine.cjs');

function fixture() {
  const context = vm.createContext({structuredClone,Math,Date,performance,document:{getElementById:id=>id==='battleCanvas'?{width:400,height:300,getContext:()=>null}:null},log(){},logWarn(){},logError(){},alert(){}});
  context.window=context;
  for(const name of SOURCES) vm.runInContext(fs.readFileSync(path.join(ROOT,'js',name+'.js'),'utf8'),context);
  context.data=loadData();
  const run=code=>vm.runInContext(code,context);
  run(`categoriesJson=normalizeCategoryJson(data.categories);itemsJson=normalizeItemJson(data.items);factionsJson=normalizeFactionJson(data.factions);skillsJson=normalizeSkillJson(data.skills);entitiesJson=data.entities;characterJson=normalizeCombatJson(data.characters,[],'name');
    updateBattleButton=()=>{};clearBattleEventLogs=()=>{};addBattleEventLog=()=>{};
    teamsJson=[{name:'stale',memberIds:[0,1],activeMemberCount:2,battleRules:{damagePercent:300},synergyRules:[]}];
    selectedBattleTeamIds.add(0);selectedBattleCharacterIds.add(1);battleMode='duel';`);
  return run;
}

test('duel enforces both selections and ignores previous team participants/rules',()=>{
  const run=fixture();
  assert.equal(run(`prepareBattleSession({openScreen:false})`),false);
  run(`duelCharacterIds={player:0,enemy:1}`);
  assert.equal(run(`prepareBattleSession({openScreen:false})`),true);
  assert.equal(run(`playerSquad.length`),1);
  assert.equal(run(`enemySquad.length`),1);
  assert.equal(run(`activeBattleSideRules.player.damagePercent`),100);
  assert.equal(run(`activeBattleSideRules.enemy.damagePercent`),100);
  assert.equal(run(`playerSquad[0].startsInReserve || enemySquad[0].startsInReserve`),false);
});

test('mirror duel uses independent units and rebuilds both sides on repeat',()=>{
  const run=fixture();
  run(`duelCharacterIds={player:0,enemy:0};prepareBattleSession({openScreen:false})`);
  assert.equal(run(`playerSquad[0]===enemySquad[0]`),false);
  assert.equal(run(`playerSquad[0].side`),'player');
  assert.equal(run(`enemySquad[0].side`),'enemy');
  run(`globalThis.saved=JSON.stringify(characterJson);playerSquad[0].hp=0;enemySquad[0].hp=0;prepareBattleSession({openScreen:false})`);
  assert.equal(run(`playerSquad[0].hp>0 && enemySquad[0].hp>0`),true);
  assert.equal(run(`JSON.stringify(characterJson)===saved`),true);
  run(`duelCharacterIds.enemy=999999`);
  assert.equal(run(`prepareBattleSession({openScreen:false})`),false);
});

test('normal mode still selects stored team members and team rules',()=>{
  const run=fixture();
  run(`battleMode='team';selectedBattleCharacterIds.clear();rebuildPlayerSquadFromSelection();snapshotActiveBattleSideRules()`);
  assert.equal(run(`playerSquad.length`),2);
  assert.equal(run(`activeBattleSideRules.player.damagePercent`),300);
});
