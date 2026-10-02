const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function teamEngine() {
  const context={
    characterJson:[{role:'tank',faction:'A'},{role:'tank',faction:'A'},{role:'healer',faction:'B'}],MAX_PLAYER_SQUAD:10,
    normalizeRole:value=>value,
    selectedBattleTeamIds:new Set(),selectedBattleCharacterIds:new Set(),selectedEnemyTeamIndex:'',battleMode:'monster',
    teamsJson:[],structuredClone
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js/team.js'),'utf8'),context);
  return context;
}

test('team battle rule values normalize and survive team normalization',()=>{
  const e=teamEngine();
  const teams=e.normalizeTeamJson([{name:'A',memberIds:[0],activeMemberCount:1,battleRules:{damagePercent:125,healingPercent:80,resourceCostPercent:0,cooldownPercent:75}}]);
  assert.deepEqual(JSON.parse(JSON.stringify(teams[0].battleRules)),{damagePercent:125,healingPercent:80,resourceCostPercent:0,cooldownPercent:75});
  assert.equal(teams[0].activeMemberCount,1);
  assert.equal(e.normalizeTeamBattleRules({damagePercent:'bad'}).damagePercent,100);
});

test('battle snapshots apply one pure team per side and default mixed selections',()=>{
  const e=teamEngine();
  e.teamsJson=[
    {battleRules:{damagePercent:140,healingPercent:100,resourceCostPercent:100,cooldownPercent:100}},
    {battleRules:{damagePercent:90,healingPercent:120,resourceCostPercent:100,cooldownPercent:80}}
  ];
  e.selectedBattleTeamIds.add(0);e.selectedEnemyTeamIndex=1;e.battleMode='team';
  let rules=e.snapshotActiveBattleSideRules();
  assert.equal(rules.player.damagePercent,140);assert.equal(rules.enemy.healingPercent,120);
  e.selectedBattleCharacterIds.add(0);rules=e.snapshotActiveBattleSideRules();
  assert.equal(rules.player.damagePercent,100);assert.equal(rules.enemy.cooldownPercent,80);
});

test('team synergies activate by faction or role count and multiply base rules',()=>{
  const e=teamEngine();
  const team={memberIds:[0,1,2],battleRules:{damagePercent:120,healingPercent:100,resourceCostPercent:100,cooldownPercent:100},synergyRules:[
    {type:'faction',value:'A',requiredCount:2,damagePercent:110,healingPercent:100,resourceCostPercent:90,cooldownPercent:100},
    {type:'role',value:'healer',requiredCount:2,damagePercent:500,healingPercent:500,resourceCostPercent:500,cooldownPercent:500}
  ]};
  assert.equal(e.getActiveTeamSynergies(team).length,1);
  const rules=e.getTeamRulesWithSynergies(team);
  assert.equal(rules.damagePercent,132);assert.equal(rules.resourceCostPercent,90);assert.equal(rules.healingPercent,100);
  e.teamsJson=[team];e.selectedBattleTeamIds.add(0);e.snapshotActiveBattleSideRules();
  assert.equal(e.getUnitTeamBattleRules({side:'player'}).damagePercent,132);
  assert.equal(e.getUnitTeamBattleRules({side:'player',runtimeRuleOverrides:[{disableTeamSynergies:true,damagePercent:100,healingPercent:100,resourceCostPercent:100,cooldownPercent:100}]}).damagePercent,120);
});
