const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const {SOURCES, ROOT, loadData} = require('../balance/simulator/engine.cjs');

test('spirit affinity exposes three alternatives and resolves one independent passive per side',()=>{
 const run=fixture();run(`globalThis.spiritId=characterJson.findIndex(c=>c.skillIds.includes('skill_class_spirit_choice'));duelCharacterIds={player:[spiritId],enemy:[spiritId]};duelSkillChoices.player[spiritId]={'skill_class_spirit_choice':'destroy'};`);
 const html=run('renderDuelSkillChoices()');assert.equal((html.match(/<select/g)||[]).length,2);assert.equal((html.match(/<option/g)||[]).length,6);
 assert.equal(run(`resolveSelectedSkillIds(characterJson[spiritId].skillIds,duelSkillChoices.player[spiritId]).includes('skill_class_spirit_passive_destroy')`),true);
 assert.equal(run(`resolveSelectedSkillIds(characterJson[spiritId].skillIds,duelSkillChoices.enemy[spiritId]).includes('skill_class_spirit_passive_heal')`),true);
});

test('rune choices appear in formation summaries for both sides and preserve independent selections',()=>{
 const run=fixture();run(`runesJson=data.runes.map(normalizeRune);globalThis.runeId=characterJson.findIndex(c=>c.skillIds.includes('skill_class_rune_master'));duelCharacterIds={player:[runeId],enemy:[runeId]};`);
 const html=run('renderDuelSkillChoices()');assert.equal((html.match(/rune-choice-panel/g)||[]).length,2);assert.equal((html.match(/<select/g)||[]).length,6);
 run(`duelSkillChoices.player[runeId]={'skill_class_rune_master':['rune_flame','rune_crescent','rune_bullet']};`);
 assert.equal(run(`getRuneLoadout({skillSelections:duelSkillChoices.player[runeId]},getSkillById('skill_class_rune_master'))[0]`),'rune_flame');
 assert.equal(run(`getRuneLoadout({skillSelections:duelSkillChoices.enemy[runeId]},getSkillById('skill_class_rune_master'))[0]`),'rune_moon');
});

test('mage ice unlock filters character prebattle and both duel sides using equipped optional skills',()=>{
 const run=fixture();run(`globalThis.mageId=characterJson.findIndex(c=>c.name==='마법사');duelCharacterIds={player:[mageId],enemy:[mageId]};duelSkillChoices.player[mageId]={'skill_class_mage_element_choice':'ice'};`);
 assert.equal((run('renderDuelSkillChoices()').match(/<option/g)||[]).length,6);
 assert.equal(run(`getChoiceSkillOption(getSkillById('skill_class_mage_element_choice'),'ice',characterJson[mageId].skillIds).id`),'lightning');
 run(`characterJson[mageId].skillIds.push('skill_class_mage_forbidden_ice')`);
 assert.equal((run('renderDuelSkillChoices()').match(/<option/g)||[]).length,8);
 assert.equal(run(`resolveSelectedSkillIds(characterJson[mageId].skillIds,duelSkillChoices.player[mageId]).includes('skill_class_mage_element_ice')`),true);
 assert.equal(run(`resolveSelectedSkillIds(characterJson[mageId].skillIds,duelSkillChoices.enemy[mageId]).includes('skill_class_mage_element_lightning')`),true);
 run(`characterJson[mageId].skillIds=characterJson[mageId].skillIds.filter(id=>id!=='skill_class_mage_forbidden_ice')`);
 assert.equal((run('renderDuelSkillChoices()').match(/<option/g)||[]).length,6);
 assert.equal(run(`resolveSelectedSkillIds(characterJson[mageId].skillIds,duelSkillChoices.player[mageId]).includes('skill_class_mage_element_ice')`),false);
});

function fixture() {
  const context = vm.createContext({structuredClone,Math,Date,performance,addEventListener(){},removeEventListener(){},document:{addEventListener(){},removeEventListener(){},getElementById:id=>id==='battleCanvas'?{width:400,height:300,getContext:()=>null}:null},log(){},logWarn(){},logError(){},alert(){}});
  context.window=context;
  for(const name of SOURCES) vm.runInContext(fs.readFileSync(path.join(ROOT,'js',name+'.js'),'utf8'),context);
  context.data=loadData();
  context.data.monsters=JSON.parse(fs.readFileSync(path.join(ROOT,'data/monsters.json'),'utf8'));
  const run=code=>vm.runInContext(code,context);
  run(`monsterJson=normalizeCombatJson(data.monsters,[],'label');categoriesJson=normalizeCategoryJson(data.categories);itemsJson=normalizeItemJson(data.items);factionsJson=normalizeFactionJson(data.factions);skillsJson=normalizeSkillJson(data.skills);entitiesJson=data.entities;characterJson=normalizeCombatJson(data.characters,[],'name');
    updateBattleButton=()=>{};clearBattleEventLogs=()=>{};addBattleEventLog=()=>{};
    teamsJson=[{name:'stale',memberIds:[0,1],activeMemberCount:2,battleRules:{damagePercent:300},synergyRules:[]}];
    selectedBattleTeamIds.add(0);selectedBattleCharacterIds.add(1);battleMode='duel';`);
  return run;
}

test('duel enforces both selections and ignores previous team participants/rules',()=>{
  const run=fixture();
  assert.equal(run(`prepareBattleSession({openScreen:false})`),false);
  run(`duelCharacterIds={player:[0],enemy:[1]}`);
  assert.equal(run(`prepareBattleSession({openScreen:false})`),true);
  assert.equal(run(`playerSquad.length`),1);
  assert.equal(run(`enemySquad.filter(unit=>!unit.isSummon).length`),1);
  assert.equal(run(`activeBattleSideRules.player.damagePercent`),100);
  assert.equal(run(`activeBattleSideRules.enemy.damagePercent`),100);
  assert.equal(run(`playerSquad[0].startsInReserve || enemySquad[0].startsInReserve`),false);
});

test('mirror duel uses independent units and rebuilds both sides on repeat',()=>{
  const run=fixture();
  run(`duelCharacterIds={player:[0],enemy:[0]};prepareBattleSession({openScreen:false})`);
  assert.equal(run(`playerSquad[0]===enemySquad[0]`),false);
  assert.equal(run(`playerSquad[0].side`),'player');
  assert.equal(run(`enemySquad[0].side`),'enemy');
  run(`globalThis.saved=JSON.stringify(characterJson);playerSquad[0].hp=0;enemySquad[0].hp=0;prepareBattleSession({openScreen:false})`);
  assert.equal(run(`playerSquad[0].hp>0 && enemySquad[0].hp>0`),true);
  assert.equal(run(`JSON.stringify(characterJson)===saved`),true);
  run(`duelCharacterIds.enemy=[999999]`);
  assert.equal(run(`prepareBattleSession({openScreen:false})`),false);
});

test('normal mode still selects stored team members and team rules',()=>{
  const run=fixture();
  run(`battleMode='team';selectedBattleCharacterIds.clear();rebuildPlayerSquadFromSelection();snapshotActiveBattleSideRules()`);
  assert.equal(run(`playerSquad.length`),2);
  assert.equal(run(`activeBattleSideRules.player.damagePercent`),300);
});

test('mixed formation admits monsters on both sides and rejects more than ten',()=>{
 const run=fixture();
 run(`duelCharacterIds={player:[0,2],enemy:[0]};duelMonsterIds={player:[0,0],enemy:[0,0,0]}`);
 assert.equal(run(`prepareBattleSession({openScreen:false})`),true);
 assert.equal(run(`playerSquad.filter(u=>!u.isSummon).length`),4);
 assert.equal(run(`enemySquad.filter(u=>!u.isSummon).length`),4);
 assert.equal(run(`playerSquad.every(u=>u.side==='player') && enemySquad.every(u=>u.side==='enemy')`),true);
 run(`duelMonsterIds.player=Array(9).fill(0)`);
 assert.equal(run(`prepareBattleSession({openScreen:false})`),false);
});
