const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {SOURCES,ROOT,loadData}=require('../balance/simulator/engine.cjs');
function fixture() {
  const ctx=vm.createContext({structuredClone,performance,document:{addEventListener(){},getElementById:()=>({getContext:()=>null})}});
  ctx.window=ctx;ctx.addEventListener=()=>{};
  for (const name of SOURCES) vm.runInContext(fs.readFileSync(path.join(ROOT,'js',name+'.js'),'utf8'),ctx);
  ctx.data=structuredClone(loadData());
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/expected-dps.js'),'utf8'),ctx);
  const run=code=>vm.runInContext(code,ctx);
  run(`categoriesJson=normalizeCategoryJson(data.categories);itemsJson=normalizeItemJson(data.items);factionsJson=normalizeFactionJson(data.factions);
    skillsJson=normalizeSkillJson(data.skills);characterJson=normalizeCombatJson(data.characters,[],'name');globalThis.c=characterJson[0];
    globalThis.skill=normalizeSkillJson([{id:'test_dps',name:'test',slot:'active',cooldown:2,castTime:1,actions:[{type:'deal_damage',coefficients:[{type:'fixed',value:120}]}]}]).find(s=>s.id==='test_dps');`);
  return run;
}
test('direct damage uses cast plus cooldown and neutral team rules',()=>{
  const run=fixture();
  run(`activeBattleSideRules.player.damagePercent=900; activeBattleSideRules.player.cooldownPercent=900`);
  assert.equal(run(`estimateSkillDps(c,skill).dps`),40);
  assert.equal(run(`estimateSkillDps(c,{...skill,castTime:0,cooldown:0}).seconds`),1/60);
});
test('current equipment stats and item skill modifiers affect estimate without mutation',()=>{
  const run=fixture();
  run(`globalThis.before=JSON.stringify({characterJson,itemsJson,skillsJson});
    skill.actions[0].coefficients=[{type:'calculated',field:'atk',calc:'percent',value:200}];`);
  assert.equal(run(`estimateSkillDps(c,skill).dps`),run(`createDpsPreviewUnit(c).atk*2/3`));
  run(`globalThis.item=structuredClone(itemsJson[0]);item.id='dps_modifier';item.slot='top';item.weaponCategory='';item.handType='';
    item.skillModifiers=[{skillId:skill.id,target:'cooldown',signature:'skill',value:2}];itemsJson.push(item);
    globalThis.draft={...c,equipment:{...c.equipment,top:item.id}};`);
  assert.equal(run(`estimateSkillDps(draft,skill).seconds`),5);
  run(`itemsJson.pop()`);
  assert.equal(run(`JSON.stringify({characterJson,itemsJson,skillsJson})===before`),true);
});
test('healing omitted, conditional and passive damage do not invent rates',()=>{
  const run=fixture();
  assert.equal(run(`estimateSkillDps(c,{...skill,actions:[{...skill.actions[0],type:'heal'}]})`),null);
  assert.equal(run(`estimateSkillDps(c,{...skill,slot:'passive'}).dps`),null);
  run(`skill.actions[0].coefficients=[{type:'calculated',field:'targetMaxHp',calc:'percent',value:10}]`);
  assert.equal(run(`estimateSkillDps(c,skill).dps`),null);
});
test('channel pulses and independent weapon timing use engine tick units',()=>{
  const run=fixture();
  assert.equal(run(`estimateSkillDps(c,{...skill,channel:{duration:3,interval:1}}).dps`),60);
  assert.equal(run(`estimateSkillDps(c,skill,{attackSpeed:2,castSpeed:3,independent:true}).dps`),40);
});
test('weapon preview does not equip or change stored loadouts',()=>{
  const run=fixture();
  run(`globalThis.before=JSON.stringify({characterJson,itemsJson});globalThis.weapon=itemsJson.find(isWeaponItem);
    globalThis.rows=getWeaponDpsPreviews(c,weapon);`);
  assert.ok(run(`rows.length`)>0);
  assert.equal(run(`JSON.stringify({characterJson,itemsJson})===before`),true);
  assert.ok(run(`rows.some(row=>row.result && (Number.isFinite(row.result.dps) || row.result.reason))`));
});
