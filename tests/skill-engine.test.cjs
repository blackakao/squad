const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function monkEngine(options=[]) {
 const e=engine();e.skillsJson=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'../data/skills.json'),'utf8')));
 e.monk=id=>e.getSkillById('skill_class_monk_'+id);const s=e.owner=unit(e),t=e.target=unit(e,'enemy',130);
 s.skillIds=['cycle','spring_energy','area_heal','combo','down_strike','vajra_talisman_ultimate',...options].map(id=>e.monk(id).id);
 t.x=105;t.hp=t.maxHp=10000;s.atk=100;s.st=s.maxSt=1000;
 e.runtime=id=>e.getRuntimeSelectionSkill(s,e.monk(id));
 e.cast=(id,target=t)=>{const skill=e.runtime(id),resourceSpent=e.spendSkillResourceCosts(s,skill);e.startCast(s,{type:'skill',skill,target,resourceSpent});for(let i=0;s.pendingAction && i<1000;i++)e.updateCast(s);return skill;};
 return e;
}

test('monk spring sharing copies both buffs only for another ally in both dispatch paths',()=>{
 for(const direct of [false,true]) {
  const e=monkEngine(['spring_sharing']),s=e.owner,a=unit(e,'player',120);s.defense=a.defense=100;s.attackSpeed=a.attackSpeed=1;
  const spring=e.runtime('spring_energy');
  if(direct)e.applySkill(s,a,spring);else e.cast('spring_energy',a);
  for(const target of [s,a]){assert.equal(target.defense,110);assert.equal(target.attackSpeed,1/1.2);assert.equal(target.activeEffects.length,2);}
  e.clearBattleEffects(s);e.applySkill(s,s,spring);assert.equal(s.activeEffects.length,2);assert.equal(s.defense,110);
 }
 const e=monkEngine(),a=unit(e,'player',120);e.cast('spring_energy',a);assert.equal(e.owner.activeEffects.length,0);
});

test('monk forehead strike alternates completed casts and resets with the battle',()=>{
 const e=monkEngine(['forehead_strike']),s=e.owner,values=[];
 for(let i=0;i<4;i++){values.push(e.cast('down_strike').actions[0].coefficients[0].value);if(i===0)e.cast('spring_energy',s);}
 assert.deepEqual(values,[180,234,180,234]);assert.equal(s.st,960);assert.equal(e.target.hp,10000-828);
 assert.equal(e.target.activeEffects.find(x=>x.id==='monk_down_strike_defense').remainingTicks,300);
 e.resetUnitForBattle(s);assert.equal(e.runtime('down_strike').actions[0].coefficients[0].value,180);
 s.skillUseCounts[e.monk('down_strike').id]=1;s.skillIds=s.skillIds.filter(id=>id!==e.monk('forehead_strike').id);assert.equal(e.runtime('down_strike').actions[0].coefficients[0].value,180);
});

test('monk talisman merchant grants two ultimate uses after unlock with ten seconds between them',()=>{
 const e=monkEngine(['talisman_merchant']),s=e.owner,id=e.monk('vajra_talisman_ultimate').id;
 vm.runInContext('combatEventTick=1799',e);assert.equal(e.canActivateSkill(s,e.runtime('vajra_talisman_ultimate')),false);
 vm.runInContext('combatEventTick=1800',e);assert.equal(e.canActivateSkill(s,e.runtime('vajra_talisman_ultimate')),true);
 e.cast('vajra_talisman_ultimate',s);assert.equal(s.skillCooldowns[id],600);assert.equal(e.canActivateSkill(s,e.runtime('vajra_talisman_ultimate')),false);
 for(let i=0;i<599;i++)e.tickSkillCooldowns(s);assert.equal(e.canActivateSkill(s,e.runtime('vajra_talisman_ultimate')),false);
 e.tickSkillCooldowns(s);assert.equal(e.canActivateSkill(s,e.runtime('vajra_talisman_ultimate')),true);
 e.cast('vajra_talisman_ultimate',s);s.skillCooldowns[id]=0;assert.equal(e.canActivateSkill(s,e.runtime('vajra_talisman_ultimate')),false);
 e.resetUnitForBattle(s);assert.equal(e.getUltimateUseLimit(s,e.monk('vajra_talisman_ultimate')),2);assert.equal(s.skillUseCounts[id],undefined);
 s.skillIds=s.skillIds.filter(x=>x!==e.monk('talisman_merchant').id);s.skillUseCounts[id]=1;assert.equal(e.canActivateSkill(s,{...e.monk('vajra_talisman_ultimate'),maxUses:2}),false);
});

test('monk warm season restores resources only to allies in the embrace area and respects optional limit',()=>{
 const e=monkEngine(['warm_season']),s=e.owner,a=unit(e,'player',140),far=unit(e,'player',200);
 for(const u of [s,a,far]){u.hp=10;u.mp=10;u.st=10;}e.cast('area_heal',s);
 assert.equal(a.hp,100);assert.equal(a.mp,15);assert.equal(a.st,20);assert.equal(far.hp,10);assert.equal(far.mp,10);assert.equal(far.st,10);
 s.skillIds.push(...['sincere_heart','swift_victory','forehead_strike'].map(x=>e.monk(x).id));s.skillUseCounts[e.monk('down_strike').id]=1;
 assert.equal(e.runtime('down_strike').actions[0].coefficients[0].value,180);
});

test('monk cycle heals from physical actual damage within five meters with selected conversion',()=>{
 for(const [options,amount] of [[[],6],[['sincere_heart'],10]]) {
  const e=monkEngine(options),s=e.owner,a=unit(e,'player',140),far=unit(e,'player',160);s.hp=90;a.hp=20;far.hp=1;
  const attack=type=>skill(e,{type:'deal_damage',target:'enemy',damageType:type,coefficients:[{type:'fixed',value:20}]});
  e.applySkill(s,e.target,attack('magic'));assert.equal(a.hp,20);
  e.applySkill(s,e.target,attack('physical'));assert.equal(a.hp,20+amount);assert.equal(far.hp,1);assert.equal(s.hp,90);
 }
});

test('monk combo spends three stamina per stage and starts full cooldown after the fourth stage',()=>{
 const e=monkEngine(),s=e.owner,values=[],cooldowns=[];
 for(let i=0;i<4;i++) {
  const skill=e.getRuntimeComboSkill(s,e.runtime('combo'));values.push(skill.actions[0].coefficients[0].value);
  const resourceSpent=e.spendSkillResourceCosts(s,skill);e.startCast(s,{type:'skill',skill,target:e.target,resourceSpent});cooldowns.push(s.skillCooldowns[skill.id]);
 }
 assert.deepEqual(values,[120,120,120,150]);assert.deepEqual(cooldowns,[30,30,30,720]);assert.equal(s.st,988);
});

function admiralEngine(options=[]) {
 const e=engine();e.skillsJson=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'../data/skills.json'),'utf8')));
 e.admiral=id=>e.getSkillById('skill_class_admiral_'+id);const s=e.owner=unit(e),t=e.target=unit(e,'enemy',130);
 s.magic=100;s.speed=s.attackSpeed=1;s.hp=s.maxHp=2000;s.mp=s.maxMp=1000;t.speed=t.attackSpeed=1;t.hp=t.maxHp=10000;
 s.skillIds=['reload','tidal_wave','vortex','sea_road','wave','despair_ultimate',...options].map(id=>e.admiral(id).id);e.runtime=id=>e.getRuntimeSelectionSkill(s,e.admiral(id));
 e.cast=(id,target=t)=>{const skill=e.runtime(id),reloadInfo=e.getReloadCastInfo(s,skill,e.getNextSkillModifier(s)),resourceSpent=e.spendSkillResourceCosts(s,skill);target.x=target===s ? 100 : 130;
  e.startCast(s,{type:'skill',skill,target,reloadInfo,resourceSpent});const ticks=s.castDuration;for(let i=0;s.pendingAction && i<1000;i++)e.updateCast(s);return {ticks,resourceSpent};};
 return e;
}

test('admiral reload accumulates separately and fifth tidal wave is free instantaneous with cooldown preserved',()=>{
 const e=admiralEngine(),s=e.owner,times=[],costs=[];
 for(let i=0;i<5;i++){const cast=e.cast('tidal_wave');times.push(cast.ticks);costs.push(cast.resourceSpent.MP);}
 assert.deepEqual(times,[120,90,60,30,0]);assert.deepEqual(costs,[15,15,15,15,0]);assert.equal(s.reloadCharges[e.admiral('tidal_wave').id],0);assert.equal(s.skillCooldowns[e.admiral('tidal_wave').id],300);
 assert.equal(e.getReloadCastInfo(s,e.runtime('vortex')).seconds,3);assert.equal(e.getReloadCastInfo(s,e.runtime('despair_ultimate')),null);
 e.startCast(s,{type:'skill',skill:e.runtime('tidal_wave'),target:e.target});e.interruptBattleCast(s);assert.equal(s.reloadCharges[e.admiral('tidal_wave').id],0);
 e.resetUnitForBattle(s);assert.equal(Object.keys(s.reloadCharges).length,0);
});

test('admiral reload again gives one additional instantaneous cast with normal MP cost and then resets',()=>{
 const e=admiralEngine(['reload_again']),times=[],costs=[];
 for(let i=0;i<7;i++){const cast=e.cast('tidal_wave');times.push(cast.ticks);costs.push(cast.resourceSpent.MP);}
 assert.deepEqual(times,[120,90,60,30,0,0,120]);assert.deepEqual(costs,[15,15,15,15,0,15,15]);
 const plain=admiralEngine();plain.owner.reloadCharges[plain.admiral('tidal_wave').id]=2;plain.owner.mp=0;assert(plain.canPaySkillResourceCosts(plain.owner,plain.runtime('tidal_wave')));
});

test('admiral reload threshold follows current cast buffs and never applies to ultimate',()=>{
 const e=admiralEngine(),s=e.owner;e.applyTimedEffectAction(s,s,e.normalizeSkillAction({type:'add_buff',duration:10,effect:{id:'quick',stat:'castSpeed',mode:'cast_time_percent',value:-50}}));
 assert.equal(e.cast('tidal_wave').ticks,60);assert.equal(e.cast('tidal_wave').ticks,30);const free=e.cast('tidal_wave');assert.equal(free.ticks,0);assert.equal(free.resourceSpent.MP,0);
 s.reloadCharges[e.admiral('despair_ultimate').id]=100;assert.equal(e.cast('despair_ultimate').ticks,15);
});

test('admiral sea road applies real cast multipliers and black sea replaces ally aura and slows enemy casting',()=>{
 for(const black of [false,true]) {
  const e=admiralEngine(black ? ['black_sea'] : []),s=e.owner,t=e.target;e.applySkill(s,t,e.runtime('sea_road'));e.updateBattleFields();
  assert.equal(s.effectCastTimeMultiplier,black ? 1 : .8);assert.equal(t.effectCastTimeMultiplier,black ? 1.25 : 1.15);assert.equal(t.speed,black ? .7 : .8);assert.equal(t.attackSpeed,black ? 1.25 : 1/.85);
  e.startCast(t,{type:'skill',target:s,skill:e.admiral('tidal_wave')});assert.equal(t.castDuration,black ? 150 : 138);
  t.y=300;e.refreshTrackedBattleFields();assert.equal(t.effectCastTimeMultiplier,1);assert.equal(t.speed,1);assert.equal(t.attackSpeed,1);
 }
});

test('admiral deadly vortex increases received damage only while inside its field',()=>{
 const e=admiralEngine(['deadly_vortex']),s=e.owner,t=e.target;e.applySkill(s,t,e.runtime('vortex'));assert(Math.abs(e.getUnitIncomingRulePercent(t,'receivedDamagePercent')-115)<1e-7);
 const before=t.hp;e.applyActionDamage(s,t,{damageType:'magic',coefficients:[{type:'fixed',value:100}]});assert(Math.abs(t.hp-(before-115))<1e-7);
 t.x=300;e.refreshTrackedBattleFields();assert.equal(e.getUnitIncomingRulePercent(t,'receivedDamagePercent'),100);assert.equal(e.getUnitIncomingRulePercent(s,'receivedDamagePercent'),100);
});

test('admiral wave consumes once on melee and transfers only remaining duration to slow with optional buff dispel',()=>{
 const e=admiralEngine(['salt_water']),s=e.owner,t=e.target;t.x=110;e.applySkill(s,s,e.runtime('wave'));for(let i=0;i<180;i++)e.updateBattleEffects();
 e.applyTimedEffectAction(t,t,e.normalizeSkillAction({type:'add_buff',duration:10,effect:{id:'enemy_buff',stat:'atk',mode:'flat',value:10}}));
 const ranged={type:'deal_damage',rangeMode:'custom',rangeValue:5,damageType:'physical',coefficients:[{type:'fixed',value:10}]};e.applyActionDamage(t,s,ranged);assert(s.activeEffects.some(effect=>effect.id==='admiral_wave'));
 const before=t.hp;e.applyActionDamage(t,s,{...ranged,rangeValue:1});assert.equal(t.hp,before-50);assert.equal(s.activeEffects.some(effect=>effect.id==='admiral_wave'),false);assert.equal(t.activeEffects.some(effect=>effect.id==='enemy_buff'),false);
 const slow=t.activeEffects.find(effect=>effect.id==='admiral_wave_slow');assert.equal(slow.remainingTicks,120);assert.equal(t.speed,.6);
 e.applyActionDamage(t,s,{...ranged,rangeValue:1});assert.equal(t.hp,before-50);
});

test('admiral despair wave knocks enemies radially from damage center and obeys ultimate limit',()=>{
 const e=admiralEngine(),s=e.owner,t=e.target,second=unit(e,'enemy',130),outside=unit(e,'enemy',250);second.y=130;second.hp=second.maxHp=10000;outside.hp=outside.maxHp=10000;
 e.cast('despair_ultimate');e.updateProjectiles();assert.equal(t.hp,9750);assert.equal(second.hp,9750);assert.equal(outside.hp,10000);assert(t.x>130);assert.equal(second.x,130);assert(second.y>130);assert.equal(e.canActivateSkill(s,e.runtime('despair_ultimate')),false);
});

test('admiral tidal bowling damages collisions on actual knockback path once and excludes distant enemies',()=>{
 const e=admiralEngine(['tidal_bowling']),s=e.owner,t=e.target,hit=unit(e,'enemy',160),far=unit(e,'enemy',250);hit.hp=hit.maxHp=far.hp=far.maxHp=10000;
 e.applySkill(s,t,e.runtime('tidal_wave'));assert.equal(t.hp,9820);assert.equal(hit.hp,9910);assert.equal(far.hp,10000);assert(t.x>130);assert(t.x<160);
});

test('admiral rotten wine only modifies natural regeneration and charges HP proportionally to actual recovery',()=>{
 const e=admiralEngine(['rotten_wine']),s=e.owner;e.MP_REGEN_PER_SECOND=2;s.mp=0;s.hp=1000;e.applyNaturalMpRegeneration(s,1);assert.equal(s.mp,6);assert.equal(s.hp,920);
 s.mp=s.maxMp;e.applyNaturalMpRegeneration(s,1);assert.equal(s.hp,920);
 s.mp=s.maxMp-3;e.applyNaturalMpRegeneration(s,1);assert.equal(s.mp,s.maxMp);assert.equal(s.hp,880);
 e.applyActionHeal(s,s,{healResource:'MP',coefficients:[{type:'fixed',value:10}]});assert.equal(s.hp,880);
 const plain=admiralEngine();plain.MP_REGEN_PER_SECOND=2;plain.owner.mp=0;plain.applyNaturalMpRegeneration(plain.owner,1);assert.equal(plain.owner.mp,2);assert.equal(plain.owner.hp,2000);
});

test('engineer cannon basic skill cannot be spammed as an active but remains a summon weapon',()=>{
 const e=engineerEngine(),s=e.owner,t=e.target;
 const uiSource=fs.readFileSync(path.join(__dirname,'../js/ui.js'),'utf8');
 const cooldownStart=uiSource.indexOf('function getAttackCooldown(unit) {');
 vm.runInContext(uiSource.slice(cooldownStart,uiSource.indexOf('\n}',cooldownStart)+2),e);
 const attack=e.getSkillById('skill_entity_engineer_recoilless_attack');
 s.skillIds=[attack.id];
 assert.equal(e.getEquippedSkills(s).length,0);
 const before=t.hp;
 for(let i=0;i<60;i++)assert.equal(e.tryUseReadySkill(s,e.playerSquad,e.enemySquad),false);
 assert.equal(t.hp,before);
 s.runtimeCopiedSkills=[attack];assert.equal(e.getEquippedSkills(s).length,0);
 const cannon=e.spawn('recoilless_cannon');cannon.x=100;cannon.y=100;
 assert.equal(e.getUnitSkill(cannon).id,attack.id);
 e.startCast(cannon,{type:'attack',target:t,skill:e.getUnitSkill(cannon)});
 for(let i=0;i<600 && cannon.pendingAction;i++)e.updateCast(cannon);
 e.updateProjectiles();
 assert(t.hp<before);assert(cannon.attackCooldown>0);
 const characters=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/characters.json'),'utf8'));
 assert(!characters.find(c=>c.name==='갑사').skillIds.includes(attack.id));
});

function engineerEngine(options=[]) {
 const e=engine();e.skillsJson=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'../data/skills.json'),'utf8')));
 e.engineer=id=>e.getSkillById('skill_class_engineer_'+id);
 e.definitions=['ballista','talisman_cannon','recoilless_cannon','haetae'].map(id=>JSON.parse(fs.readFileSync(path.join(__dirname,'../data/entities/engineer_'+id+'.json'),'utf8')));
 vm.runInContext('entitiesJson.push(...definitions)',e);
 const s=e.owner=unit(e),t=e.target=unit(e,'enemy',105);s.atk=100;s.defense=10;s.resistance=5;s.st=1000;t.hp=t.maxHp=100000;
 s.skillIds=['engineering','ballista','talisman_cannon','recoilless_cannon','haetae','emergency_reinstall_ultimate',...options].map(id=>e.engineer(id).id);
 e.runtime=id=>e.getRuntimeSelectionSkill(s,e.engineer(id));e.spawn=id=>{e.applySkill(s,s,e.runtime(id));return s.summons.at(-1);};
 return e;
}

test('engineer aura counts only own living summons within five meters and updates after movement and death',()=>{
 const e=engineerEngine(),s=e.owner,a=e.spawn('ballista'),b=e.spawn('talisman_cannon');
 assert.equal(s.atk,110);assert.equal(s.defense,12);assert.equal(s.resistance,7);
 a.x=s.x+51;a.y=s.y;e.updateBattleEffects();assert.equal(s.atk,105);assert.equal(s.defense,11);
 a.x=s.x+50;e.updateBattleEffects();assert.equal(s.atk,110);
 const other=unit(e);other.skillIds=s.skillIds;e.applySkill(other,other,e.engineer('haetae'));assert.equal(s.atk,110);
 b.hp=0;e.syncAliveState(b);assert.equal(s.atk,105);a.hp=0;e.syncAliveState(a);assert.equal(s.atk,100);assert.equal(s.defense,10);assert.equal(s.resistance,5);
});

test('engineer emergency reinstall fills shared entity caps without replacing or healing existing summons',()=>{
 const e=engineerEngine(['artillery_king','durable']),s=e.owner,b=e.spawn('ballista');b.hp=10;
 const skill=e.runtime('emergency_reinstall_ultimate');e.resolveSkillCast(s,{skill,target:s});
 assert.equal(s.summons.length,6);assert.equal(s.summons[0],b);assert.equal(b.hp,10);assert.equal(e.canActivateSkill(s,skill),false);
 assert.deepEqual(Array.from(e.definitions,definition=>s.summons.filter(unit=>unit.entityId===definition.entityId).length),[2,1,2,1]);
 const cannon=s.summons.find(unit=>unit.entityId==='engineer_recoilless_cannon');assert.equal(cannon.maxHp,300);
 e.applySkill(s,s,e.runtime('recoilless_cannon'));assert.equal(s.summons.length,6);
 cannon.hp=0;e.syncAliveState(cannon);e.finalizeSummonDeaths();e.spawn('recoilless_cannon');assert.equal(s.summons.filter(unit=>unit.entityId===cannon.entityId && unit.alive).length,2);
});

test('engineer selected summon enhancements are independent and fourth optional never applies',()=>{
 const plain=engineerEngine(),p=plain.spawn('talisman_cannon');assert.equal(p.maxHp,200);assert.equal(p.atk,50);assert.equal(p.attackSpeed,1);assert.equal(p.speed,0);
 const e=engineerEngine(['rapid_fire','durable','do_it_all','turtle_story']),s=e.owner;e.recalculateBattleBuffs(s);assert.equal(s.atk,70);
 const cannon=e.spawn('talisman_cannon');assert.equal(cannon.maxHp,400);assert.equal(cannon.hp,400);assert.equal(cannon.atk,100);assert.equal(cannon.attackSpeed,.5);assert.equal(cannon.ai,'stationary');assert.equal(cannon.speed,0);
 const robot=e.spawn('haetae');assert.equal(robot.maxHp,700);assert.equal(robot.atk,100);assert.equal(robot.speed,1);assert.equal(robot.attackSpeed,2);
});

test('engineer turtle story moves only artillery and caps buffs while allowing movement slows',()=>{
 const e=engineerEngine(['turtle_story']);
 for (const id of ['ballista','talisman_cannon','recoilless_cannon']) {
  const unit=e.spawn(id);assert.equal(unit.ai,'ranged');assert.equal(unit.speed,.1);
  unit.x=200;unit.y=100;e.target.x=500;const before=unit.x;e.moveUnit(unit,[e.target]);assert(unit.x>before);
  e.applyTimedEffectAction(e.owner,unit,e.normalizeSkillAction({type:'add_buff',duration:5,effect:{id:'speed_up',stat:'speed',mode:'percent',value:100}}));assert.equal(unit.speed,.1);
  e.clearBattleEffects(unit);e.applyTimedEffectAction(e.target,unit,e.normalizeSkillAction({type:'add_buff',duration:5,effect:{id:'slow',stat:'speed',mode:'percent',value:-50}}));assert.equal(unit.speed,.05);
  e.clearBattleEffects(unit);assert.equal(unit.speed,.1);
 }
 const robot=e.spawn('haetae');assert.equal(robot.ai,'melee');assert.equal(robot.speed,1);assert.equal(robot.lockedMovementSpeed,null);
});

test('engineer focused fire tracks actual attack targets across changes stun deaths and other owners',()=>{
 const e=engineerEngine(['focus_fire']),s=e.owner,t=e.target,a=e.spawn('ballista'),b=e.spawn('talisman_cannon'),c=e.spawn('recoilless_cannon');
 for(const unit of [a,b,c]){unit.x=100;unit.y=100;}
 const fire=(unit,target)=>e.startCast(unit,{type:'attack',target,skill:e.getBasicBattleSkill(unit)});
 fire(a,t);assert.equal(a.atk,100);fire(b,t);assert.equal(a.atk,110);assert.equal(b.atk,55);fire(c,t);assert.equal(a.atk,115);assert.equal(b.atk,57.5);assert.equal(c.atk,230);
 const other=unit(e,'enemy',105);other.hp=other.maxHp=100000;fire(c,other);assert.equal(a.atk,110);assert.equal(c.atk,200);
 e.applyTimedEffectAction(t,b,e.normalizeSkillAction({type:'add_state',duration:1,effect:{id:'stun',state:'stun'}}));e.updateBattleEffects();assert.equal(a.atk,100);
 e.clearBattleEffects(b);e.updateBattleEffects();assert.equal(a.atk,110);
 const foreignOwner=unit(e);foreignOwner.skillIds=s.skillIds;e.applySkill(foreignOwner,foreignOwner,e.engineer('ballista'));const foreign=foreignOwner.summons[0];foreign.x=100;foreign.y=100;fire(foreign,t);assert.equal(a.atk,110);assert.equal(foreign.atk,100);
 t.hp=0;e.syncAliveState(t);e.updateBattleEffects();assert.equal(a.atk,100);assert.equal(b.atk,50);
});

test('engineer ultimate obeys the opening lock and skills use their new stamina costs',()=>{
 const e=engineerEngine(),s=e.owner,ultimate=e.runtime('emergency_reinstall_ultimate');
 vm.runInContext('combatEventTick=1799',e);assert.equal(e.canActivateSkill(s,ultimate),false);vm.runInContext('combatEventTick=1800',e);assert.equal(e.canActivateSkill(s,ultimate),true);
 for(const [id,cost] of [['ballista',5],['talisman_cannon',10],['recoilless_cannon',20],['haetae',20]]) {const before=s.st;e.spendSkillResourceCosts(s,e.runtime(id));assert.equal(before-s.st,cost);}
});

function tamerEngine(options=[],choice='wolf') {
 const e=engine();e.skillsJson=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'../data/skills.json'),'utf8')));
 e.tamer=id=>e.getSkillById('skill_class_tamer_'+id);
 e.beasts=['legacy_4ac380c5973655c4','tamer_elephant','tamer_raptor'].map(id=>JSON.parse(fs.readFileSync(path.join(__dirname,'../data/entities',id+'.json'),'utf8')));
 vm.runInContext('entitiesJson.push(...beasts)',e);
 const s=e.owner=unit(e),t=e.target=unit(e,'enemy',105);s.hp=s.maxHp=2000;s.atk=100;s.defense=10;s.resistance=5;s.speed=2;s.attackSpeed=2;s.mp=s.maxMp=200;t.hp=t.maxHp=10000;
 s.skillIds=['beast','choice','kill_command','fusion','heal','reset','unleash_ultimate',...options].map(id=>e.tamer(id).id);
 s.skillSelections={[e.tamer('choice').id]:choice};e.runtime=id=>e.getRuntimeSelectionSkill(s,e.getFormSkill(s,e.tamer(id)));
 e.applySkill(s,s,e.runtime('beast'));
 for(const beast of s.summons ?? []) {beast.x=100;beast.y=100;}
 return e;
}

test('tamer choices spawn exactly one persistent beast with two executable abilities',()=>{
 for(const [choice,atk,hp] of [['wolf',80,800],['elephant',200,1500],['raptor',120,500]]) {
  const e=tamerEngine([],choice),s=e.owner,beast=s.summons[0];assert.equal(s.summons.length,1);assert.equal(beast.atk,atk);assert.equal(beast.hp,hp);assert.equal(beast.speed,1.2);
  assert.equal(beast.summonType,'persistent');assert.equal(e.getEquippedSkills(beast).length,2);e.applySkill(s,s,e.runtime('beast'));assert.equal(s.summons.length,1);
 }
});

test('tamer real entry event summons the selected beast and selected enhancements respect three slots and exclusivity',()=>{
 const e=tamerEngine(),s=unit(e);s.skillIds=e.owner.skillIds;s.skillSelections={[e.tamer('choice').id]:'raptor'};
 e.publishBattleEvents([{type:'battle_entry',source:s,target:s}]);assert.equal(s.summons.length,1);assert.equal(s.summons[0].entityId,'tamer_raptor');
 const ids=['legion','one_body','raptor_power','aggression','free_revive'].map(id=>e.tamer(id).id);
 assert.deepEqual(Array.from(e.limitOptionalSkillIds(ids)),['legion','raptor_power','aggression'].map(id=>e.tamer(id).id));
 const l=tamerEngine(['legion','raptor_power','aggression'],'raptor');assert.equal(l.owner.summons.length,3);assert.equal(l.owner.summons[0].atk,22.5);
 assert.deepEqual(Array.from(l.owner.summons,beast=>beast.atk),[22.5,11,23]);
 const wolf=l.owner.summons[1];l.applyTimedEffectAction(l.owner,wolf,l.normalizeSkillAction({type:'add_buff',duration:5,effect:{id:'external_atk',stat:'atk',mode:'flat',value:100}}));assert.equal(wolf.atk,21);l.recalculateBattleBuffs(wolf);assert.equal(wolf.atk,21);
});

test('tamer fusion pools current HP without free healing and separation preserves the remaining ratio',()=>{
 const e=tamerEngine(),s=e.owner,b=s.summons[0];s.hp=1000;b.hp=400;b.skillCooldowns[b.skillIds[0]]=120;
 e.applySkill(s,s,e.runtime('fusion'));assert.equal(s.maxHp,2800);assert.equal(s.hp,1400);assert.equal(s.atk,180);assert.equal(s.defense,20);assert.equal(s.resistance,5);assert.equal(s.speed,1.2);assert.equal(s.attackSpeed,1);
 assert.equal(e.getActiveBattleEntities(e.playerSquad).length,1);assert.equal(e.canDirectlyTarget(e.target,b),false);assert.equal(e.getEquippedSkills(s).filter(skill=>b.skillIds.includes(skill.id)).length,2);
 e.applyActionDamage(e.target,s,{damageType:'fixed',coefficients:[{type:'fixed',value:700}]});
 e.tickSkillCooldowns(s);assert.equal(b.skillCooldowns[b.skillIds[0]],119);
 for(let i=0;i<600;i++)e.updateBattleEffects();assert.equal(s.companionFusion,null);assert.equal(s.maxHp,2000);assert.equal(s.hp,500);assert.equal(b.hp,200);assert.equal(s.atk,100);assert.equal(s.speed,2);assert.equal(b.skillCooldowns[b.skillIds[0]],119);
 assert.equal(e.getActiveBattleEntities(e.playerSquad).length,2);
});

test('tamer fusion receives area damage and healing only once and death kills both persistent actors',()=>{
 const e=tamerEngine(),s=e.owner,b=s.summons[0];e.applySkill(s,s,e.runtime('fusion'));b.x=s.x;b.y=s.y;
 const area=e.normalizeSkillJson([{id:'tamer_area_test',name:'area',actions:[{type:'deal_damage',target:'enemy',area:10,coefficients:[{type:'fixed',value:100}]}]}]).find(skill=>skill.id==='tamer_area_test');
 e.applySkill(e.target,s,area);assert.equal(s.hp,2700);
 e.applyActionDamage(e.target,b,{damageType:'fixed',coefficients:[{type:'fixed',value:2800}]});assert.equal(s.alive,false);assert.equal(b.alive,false);assert.equal(s.hp,0);assert.equal(b.hp,0);assert.equal(e.resolveSkillTarget(s,e.runtime('kill_command'),e.playerSquad,e.enemySquad),null);
});

test('tamer legion fuses only the selected beast and revives one dead beast at a time preserving identity',()=>{
 const e=tamerEngine(['legion'],'elephant'),s=e.owner,selected=s.summons[0];
 e.applySkill(s,s,e.runtime('fusion'));assert.equal(s.companionFusion.beast,selected);assert.equal(e.getActiveBattleEntities(e.playerSquad).length,3);e.endCompanionFusion(s);
 const other=s.summons[1];selected.hp=0;e.syncAliveState(selected);other.hp=0;e.syncAliveState(other);e.finalizeSummonDeaths();
 const revive=e.runtime('kill_command');assert.equal(revive.id,e.tamer('revive').id);assert.equal(revive.castTime,3);assert.equal(revive.resourceCosts[0].value,40);
 e.spendSkillResourceCosts(s,revive);e.applySkill(s,s,revive);assert(selected.alive);assert.equal(selected.hp,1500);assert.equal(other.alive,false);assert.equal(s.mp,160);assert.equal(s.summons.length,3);
 e.applySkill(s,s,e.runtime('kill_command'));assert(other.alive);assert.equal(e.runtime('kill_command').id,e.tamer('kill_command').id);
});

test('tamer kill command uses beast ATK and heal reset ultimate also operate during fusion',()=>{
 const e=tamerEngine(['strong_heal','free_revive']),s=e.owner,b=s.summons[0],t=e.target;
 e.applySkill(s,t,e.runtime('kill_command'));assert.equal(t.hp,9840);
 e.applySkill(s,s,e.runtime('fusion'));e.applySkill(s,t,e.runtime('kill_command'));assert.equal(t.hp,9680);
 s.hp=1000;e.applySkill(s,s,e.runtime('heal'));assert.equal(s.hp,1144);
 s.skillCooldowns[b.skillIds[0]]=200;s.skillCooldowns[e.tamer('fusion').id]=900;e.applySkill(s,s,e.runtime('reset'));assert.equal(s.skillCooldowns[b.skillIds[0]],0);assert.equal(s.skillCooldowns[e.tamer('fusion').id],900);
 e.applySkill(s,s,e.runtime('unleash_ultimate'));assert.equal(b.atk,160);assert.equal(s.atk,260);assert.equal(s.attackSpeed,1/1.3);
 for(let i=0;i<600;i++)e.updateBattleEffects();assert.equal(s.companionFusion,null);assert.equal(b.atk,80);assert.equal(b.attackSpeed,1);
 const free=tamerEngine(['free_revive']);free.owner.summons[0].hp=0;free.syncAliveState(free.owner.summons[0]);assert.equal(free.runtime('kill_command').resourceCosts[0].value,0);
});

test('tamer permanent fusion persists while wolf skills retain their shared cooldown on separation',()=>{
 const e=tamerEngine(['one_body']),s=e.owner,b=s.summons[0];assert(s.companionFusion);assert.equal(s.companionFusion.effect.remainingTicks,null);
 for(let i=0;i<610;i++)e.updateBattleEffects();assert(s.companionFusion);
 const rend=e.getEquippedSkills(s).find(skill=>skill.id===b.skillIds[0]);e.resolveSkillCast(s,{skill:rend,target:e.target});assert.equal(s.skillCooldowns[rend.id],300);assert.equal(b.skillCooldowns[rend.id],300);
 e.endCompanionFusion(s);assert.equal(b.skillCooldowns[rend.id],300);assert.equal(s.skillCooldowns[rend.id],undefined);
});

test('tamer wolf coefficients elephant mitigation taunt and raptor controls match the design',()=>{
 const e=tamerEngine(),wolf=e.owner.summons[0],t=e.target;e.applySkill(wolf,t,e.tamer('wolf_rend'));assert.equal(t.hp,9840);e.applySkill(wolf,t,e.tamer('wolf_bite'));assert.equal(t.hp,9600);
 const el=tamerEngine([],'elephant'),b=el.owner.summons[0];el.applySkill(b,b,el.tamer('elephant_inflate'));assert.equal(el.getUnitIncomingRulePercent(b,'receivedDamagePercent'),80);
 el.applySkill(b,el.target,el.tamer('elephant_shout'));assert.equal(el.getTauntTarget(el.target),b);assert.equal(el.canDirectlyTarget(el.target,el.owner),false);assert.equal(el.findTarget(el.target,[el.owner,b]),b);
 for(let i=0;i<120;i++)el.updateBattleEffects();assert.equal(el.getTauntTarget(el.target),null);
 const r=tamerEngine([],'raptor'),bird=r.owner.summons[0];r.startCast(r.target,{type:'skill',target:r.owner,skill:r.tamer('wolf_bite')});assert(r.target.pendingAction);r.applySkill(bird,r.target,r.tamer('raptor_peck'));r.updateBattleEffects();assert.equal(r.target.pendingAction,null);
 r.applySkill(bird,r.target,r.tamer('raptor_ram'));assert(r.hasBattleState(r.target,'stun'));
});

test('tamer fusion uses one beast-paced basic attack even when the owner equips two independent weapons',()=>{
 const e=tamerEngine([],'elephant'),s=e.owner,b=s.summons[0];e.applySkill(s,s,e.runtime('fusion'));
 s.skillIds=[e.tamer('beast').id,e.tamer('choice').id];s.castSpeed=0;s.weaponAttacks=[{attackSpeed:.2},{attackSpeed:.2}];s.weaponAttackStates=s.weaponAttacks.map(weapon=>({weapon,cooldown:0,castTimer:0}));
 for(const id of b.skillIds)s.skillCooldowns[id]=500;
 e.getAttackCooldown=actor=>Math.round(actor.attackSpeed*60);
 e.isMagicAttackUnit=()=>false;
 e.isPhysicalAttackUnit=()=>true;
 const before=s.st;e.takeAction(s,e.playerSquad,e.enemySquad);assert.equal(before-s.st,10);assert.equal(s.attackCooldown,180);assert(s.weaponAttackStates.every(state=>state.cooldown===0));
});

test('tamer healing excludes injured owner outside fusion and respects the owner weapon range',()=>{
 const e=tamerEngine(['legion']),s=e.owner,b=s.summons[0];s.hp=100;
 assert.equal(e.resolveSkillTarget(s,e.runtime('heal'),e.playerSquad,e.enemySquad),null);
 b.hp=100;b.x=900;assert.equal(e.resolveSkillTarget(s,e.runtime('heal'),e.playerSquad,e.enemySquad),null);
 b.x=100;e.applySkill(s,s,e.runtime('heal'));assert.equal(b.hp,140);assert.equal(s.hp,100);assert.equal(s.summons[1].hp,s.summons[1].maxHp);
});

test('ultimate opening lock uses battle ticks, permits other skills, and resets each battle',()=>{
 const e=warlockEngine(),s=e.owner,t=e.target,skill=e.runtime('collapse_ultimate');
 e.resetBattleEvents();
 assert.equal(e.canActivateSkill(s,skill),false);
 assert.equal(e.canActivateSkill(s,{id:'ordinary',slot:'active'}),true);
 const mp=s.mp;
 e.startCast(s,{type:'skill',target:t,skill});
 assert.equal(s.mp,mp);assert.equal(s.pendingAction == null,true);
 vm.runInContext('combatEventTick=1799;',e);
 assert.equal(e.canActivateSkill(s,skill),false);
 const bySlot=e.normalizeSkillJson([{id:'test_barrage',name:'포격',slot:'ultimate',actions:[]}]).find(x=>x.id==='test_barrage');
 assert.equal(bySlot.slot,'ultimate');assert.equal(e.canActivateSkill(s,bySlot),false);
 vm.runInContext('combatEventTick=1800;',e);
 assert.equal(e.canActivateSkill(s,skill),true);assert.equal(e.canActivateSkill(s,bySlot),true);
 s.skillUseCounts={[bySlot.id]:1};assert.equal(e.canActivateSkill(s,bySlot),false);
 e.resetBattleEvents();s.skillUseCounts={};assert.equal(e.canActivateSkill(s,skill),false);
});

function paladinEngine(options=[]) {
 const e=engine();e.skillsJson=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','skills.json'),'utf8')));
 e.paladin=id=>e.getSkillById('skill_class_paladin_'+id);const s=e.owner=unit(e),t=e.target=unit(e,'enemy',110);s.atk=100;s.magic=20;s.maxHp=2000;s.hp=1000;s.mp=100;s.resistance=20;s.defense=20;t.hp=t.maxHp=10000;
 s.skillIds=['punishment','divine_protection_ultimate','stigmata','magic_guardian','judgement_sword','flash',...options].map(id=>e.paladin(id).id);e.runtime=id=>e.getRuntimeSelectionSkill(s,e.paladin(id));
 e.basic=e.normalizeSkillJson([{id:'paladin_test_basic',name:'basic',slot:'basic',castTime:0,actions:[{type:'deal_damage',target:'enemy',rangeMode:'mainWeapon',damageType:'physical',coefficients:[{type:'calculated',field:'atk',calc:'percent',value:100}]}]}]).find(x=>x.id==='paladin_test_basic');return e;
}

test('paladin marks only one enemy per caster and adds thirty percent actual damage without recursive procs',()=>{
 const e=paladinEngine(),s=e.owner,t=e.target,other=unit(e,'enemy',120);other.hp=other.maxHp=10000;
 e.doAttack(s,t,e.basic);assert.equal(t.hp,9870);assert.equal(e.getSingleMarkedTarget(s),t);
 e.doAttack(s,other,e.basic);assert.equal(other.hp,9870);assert.equal(t.activeEffects.filter(x=>x.id==='paladin_punishment').length,0);assert.equal(e.getSingleMarkedTarget(s),other);
 const second=unit(e,'player',105);second.atk=100;second.skillIds=[e.paladin('punishment').id];e.doAttack(second,t,e.basic);assert.equal(e.getSingleMarkedTarget(second),t);assert.equal(e.getSingleMarkedTarget(s),other);
});

test('paladin judgement stun requires the prior mark and area auxiliary targets cannot steal the primary mark',()=>{
 const e=paladinEngine(),s=e.owner,t=e.target,other=unit(e,'enemy',120);other.hp=other.maxHp=10000;
 e.applySkill(s,t,e.runtime('judgement_sword'));assert.equal(e.hasBattleState(t,'stun'),false);e.applySkill(s,t,e.runtime('judgement_sword'));assert(e.hasBattleState(t,'stun'));
 e.applySkill(s,other,e.runtime('judgement_sword'));assert.equal(e.hasBattleState(other,'stun'),false);
 const before=t.hp;e.applySkill(s,other,e.runtime('flash'));assert.equal(e.getSingleMarkedTarget(s),other);assert.equal(t.hp,before-40);
});

test('paladin punishment uses total actual damage including damage redirected to a protector',()=>{
 const e=paladinEngine(),s=e.owner,t=e.target,protector=unit(e,'enemy',120);protector.hp=protector.maxHp=10000;
 e.applyTimedEffectAction(protector,t,e.normalizeSkillAction({type:'add_buff',duration:10,effect:{id:'proxy',mode:'damage_proxy',proxyPercent:100,proxyScope:'all',proxyPriority:1}}));
 e.doAttack(s,t,e.basic);assert.equal(t.hp,10000);assert.equal(protector.hp,9870);assert.equal(s.stats.damage,130);assert.equal(e.getSingleMarkedTarget(s),t);
});

test('paladin stigmata forwards actual received damage and selected actual HP healing to the current mark',()=>{
 const e=paladinEngine(['alone']),s=e.owner,t=e.target,other=unit(e,'enemy',120);other.hp=other.maxHp=10000;
 e.doAttack(s,t,e.basic);e.applySkill(s,s,e.runtime('stigmata'));const hp=t.hp;e.applyActionDamage(other,s,{damageType:'fixed',coefficients:[{type:'fixed',value:100}]});assert.equal(s.hp,900);assert.equal(t.hp,hp-20);
 e.applyActionHeal(other,s,{healResource:'HP',coefficients:[{type:'fixed',value:50}]});assert.equal(s.hp,950);assert.equal(t.hp,hp-30);
 e.doAttack(s,other,e.basic);const old=t.hp,next=other.hp;e.applyActionDamage(t,s,{damageType:'fixed',coefficients:[{type:'fixed',value:100}]});assert.equal(t.hp,old);assert.equal(other.hp,next-20);
 for(let i=0;i<300;i++)e.updateBattleEffects();const final=other.hp;e.applyActionHeal(s,s,{healResource:'HP',coefficients:[{type:'fixed',value:100}]});assert.equal(other.hp,final);
});

test('paladin magic guardian costs only ten MP blocks magic once and preserves its two-second resistance buff',()=>{
 const e=paladinEngine(),s=e.owner,t=e.target;const skill=e.runtime('magic_guardian');const spent=e.spendSkillResourceCosts(s,skill);assert.equal(spent.MP,10);e.startCast(s,{type:'skill',target:s,skill,resourceSpent:spent});assert.equal(s.mp,90);assert.equal(s.resistance,22);
 const hit=type=>e.applyActionDamage(t,s,{damageType:type,coefficients:[{type:'fixed',value:100}]});hit('physical');assert.equal(s.hp,900);e.applyActionDamage(t,s,{damageType:'magic',coefficients:[{type:'fixed',value:0}]});assert(s.activeEffects.some(x=>x.mode==='damage_immunity'));hit('magic');assert.equal(s.hp,900);assert.equal(s.mp,90);hit('magic');assert.equal(s.hp,800);assert.equal(s.resistance,22);
 for(let i=0;i<120;i++)e.updateBattleEffects();assert.equal(s.resistance,20);
});

test('paladin reflected light returns the blocked raw magic attack with the attacker resistance and never reflects twice',()=>{
 const e=paladinEngine(['reflected_light']),s=e.owner,t=e.target;t.resistance=20;
 e.getReducedDamage=(source,target,type,raw)=>type==='magic' ? raw*(1-(target.resistance||0)/100) : raw;
 e.applySkill(s,s,e.runtime('magic_guardian'));e.applyActionDamage(t,s,{damageType:'magic',coefficients:[{type:'fixed',value:100}]});assert.equal(s.hp,1000);assert.equal(t.hp,9920);assert.equal(e.getSingleMarkedTarget(s),null);
 e.applySkill(s,s,e.runtime('magic_guardian'));e.applySkill(t,t,e.runtime('magic_guardian'));e.applyActionDamage(t,s,{damageType:'magic',coefficients:[{type:'fixed',value:100}]});assert.equal(s.hp,1000);assert.equal(t.hp,9920);
});

test('paladin flash blinds the next attack once including whole attack skills but leaves healing and old projectiles alone',()=>{
 const e=paladinEngine(),s=e.owner,t=e.target;t.skillIds=[];t.atk=100;
 e.spawnProjectile(t,s,'attack',e.basic);e.applySkill(s,t,e.runtime('flash'));e.updateProjectiles();assert.equal(s.hp,900);assert(t.activeEffects.some(x=>x.mode==='next_attack_miss'));
 t.hp=100;e.applySkill(t,t,e.normalizeSkillJson([{id:'testheal',name:'heal',actions:[{type:'heal',target:'self',coefficients:[{type:'fixed',value:10}]}]}]).find(x=>x.id==='testheal'));assert.equal(t.hp,110);assert(t.activeEffects.some(x=>x.mode==='next_attack_miss'));
 e.doAttack(t,s,e.basic);assert.equal(s.hp,900);assert.equal(t.activeEffects.some(x=>x.mode==='next_attack_miss'),false);e.doAttack(t,s,e.basic);assert.equal(s.hp,800);
 e.applySkill(s,t,e.runtime('flash'));const multi=e.normalizeSkillJson([{id:'blind_multi_test',name:'multi',slot:'active',actions:[{type:'deal_damage',target:'enemy',coefficients:[{type:'fixed',value:100}]},{type:'deal_damage',target:'enemy',coefficients:[{type:'fixed',value:100}]}]}]).find(x=>x.id==='blind_multi_test');e.applySkill(t,s,multi);assert.equal(s.hp,800);assert.equal(t.activeEffects.some(x=>x.mode==='next_attack_miss'),false);
});

test('paladin selected faith scripture dim light and holy judgement are gated by the three-choice limit',()=>{
 const e=paladinEngine(['faith','scripture','dim_light','holy_judgement']),s=e.owner,t=e.target;e.recalculateBattleBuffs(s);assert.equal(s.defense,19);assert.equal(s.resistance,23);
 const flash=e.runtime('flash');assert.equal(flash.actions[0].area,7);assert.equal(flash.actions[0].coefficients[0].value,20);s.mp=0;e.doAttack(s,t,e.basic);assert.equal(s.mp,1);assert.equal(t.hp,9870);
 s.skillIds=s.skillIds.filter(id=>id!==e.paladin('faith').id);e.doAttack(s,t,e.basic);assert.equal(t.hp,9734);
});

test('paladin divine protection uses eight-meter radius one-second cast and one use per battle',()=>{
 const e=paladinEngine(),s=e.owner,a=unit(e,'player',179),far=unit(e,'player',181);a.defense=a.resistance=10;far.defense=far.resistance=10;const skill=e.runtime('divine_protection_ultimate');
 e.startCast(s,{type:'skill',target:s,skill});assert.equal(s.castDuration,60);for(let i=0;i<60;i++)e.updateCast(s);assert.equal(s.defense,50);assert.equal(s.resistance,50);assert.equal(a.defense,40);assert.equal(far.defense,10);assert.equal(e.canActivateSkill(s,skill),false);
 for(let i=0;i<600;i++)e.updateBattleEffects();assert.equal(s.defense,20);assert.equal(a.resistance,10);
});

function medicEngine(options=[]) {
 const e=engine();e.skillsJson=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','skills.json'),'utf8')));
 e.medic=id=>e.getSkillById('skill_class_medic_'+id);const s=e.owner=unit(e),t=e.target=unit(e,'enemy',130);s.hp=s.maxHp=2000;s.mp=s.maxMp=200;s.speed=1;s.defense=10;s.resistance=10;s.atk=100;t.hp=t.maxHp=10000;
 s.skillIds=['veteran','evacuation_ultimate','stimulant','inargansin','first_aid','endurance',...options].map(id=>e.medic(id).id);e.runtime=id=>e.getRuntimeSelectionSkill(s,e.medic(id));return e;
}

test('medic veteran branches on damage type and shares one fifteen-second cooldown across both buffs',()=>{
 const e=medicEngine(['veteran_counter']),s=e.owner,t=e.target;
 const hit=type=>e.applyActionDamage(t,s,{damageType:type,coefficients:[{type:'fixed',value:10}]});
 hit('physical');assert.equal(s.defense,30);assert.equal(s.resistance,10);assert.equal(s.atk,120);assert.equal(s.skillCooldowns[e.medic('veteran').id],900);
 hit('magic');assert.equal(s.resistance,10);for(let i=0;i<300;i++)e.updateBattleEffects();assert.equal(s.defense,10);assert.equal(s.atk,100);
 for(let i=0;i<900;i++)e.tickSkillCooldowns(s);vm.runInContext('combatEventTick+=900',e);hit('magic');assert.equal(s.resistance,25);assert.equal(s.defense,10);hit('physical');assert.equal(s.defense,10);
});

test('medic first aid heals five percent per pulse at contact excludes self and selected agreement alone reduces damage',()=>{
 const e=medicEngine(['medical_agreement','additional_healing']),s=e.owner,a=unit(e,'player',120);a.hp=10;a.maxHp=1000;
 const skill=e.runtime('first_aid');assert.equal(skill.cooldown,10);assert.equal(e.getActionRangePixels(s,skill.actions[0]),20);assert.equal(skill.actions[0].allowSelfTarget,false);
 for(const tag of ['disease','poison','bleed'])e.applyTimedEffectAction(s,a,e.normalizeSkillAction({type:'add_state',duration:10,effect:{id:tag,state:'periodic',polarity:'harmful',tags:[tag],periodic:{type:'damage',interval:10,value:1,sourceField:'fixed'}}}));
 e.startCast(s,{type:'skill',target:a,skill});assert.equal(e.getUnitIncomingRulePercent(s,'receivedDamagePercent'),85);
 for(let pulse=0;pulse<3;pulse++){for(let i=0;i<60;i++)e.updateBattleChannel(s);assert.equal(a.hp,10+50*(pulse+1));assert.equal(a.activeEffects.length,2-pulse);}
 assert.equal(e.getUnitIncomingRulePercent(s,'receivedDamagePercent'),100);
 assert.equal(e.medic('first_aid').channel.receivedDamagePercent,100);
});

test('medic approaches injured allies for contact aid and does not start it outside contact range',()=>{
 const e=medicEngine(),s=e.owner,a=unit(e,'player',150);a.hp=10;s.skillIds=[e.medic('first_aid').id];assert.equal(e.resolveSkillTarget(s,e.runtime('first_aid'),[s,a],[e.target]),null);
 for(let i=0;i<40;i++)e.moveUnit(s,[e.target]);assert(s.x>=130);assert(e.resolveSkillTarget(s,e.runtime('first_aid'),[s,a],[e.target])===a);
});

test('medic endurance is self-only pays ten stamina and restores thirty while reducing damage for four seconds',()=>{
 const e=medicEngine(),s=e.owner,a=unit(e,'player',110);s.st=20;s.maxSt=100;const skill=e.runtime('endurance');
 const spent=e.spendSkillResourceCosts(s,skill);assert.equal(spent.ST,10);e.startCast(s,{type:'skill',target:a,skill,resourceSpent:spent});assert.equal(s.st,40);assert.equal(a.st,100);assert.equal(e.getUnitIncomingRulePercent(s,'receivedDamagePercent'),90);assert.equal(e.getUnitIncomingRulePercent(a,'receivedDamagePercent'),100);
 for(let i=0;i<240;i++)e.updateRuntimeRuleOverrides();assert.equal(e.getUnitIncomingRulePercent(s,'receivedDamagePercent'),100);
});

test('medic overprescription shortens global overdose exclusion for every medic to twelve seconds',()=>{
 const e=medicEngine(['overprescription']),s=e.owner,a=unit(e,'player',110);a.maxHp=5000;a.hp=1;const skill=e.runtime('inargansin');e.applySkill(s,a,skill);
 assert.equal(a.hp,2001);assert.equal(a.activeEffects.find(x=>x.id==='medic_inargansin_overdose_lock').remainingTicks,720);
 const other=unit(e,'player',120);assert.equal(e.resolveSkillActionTarget(other,e.medic('inargansin').actions[0],a,e.medic('inargansin')),null);
 for(let i=0;i<720;i++)e.updateBattleEffects();assert.equal(e.resolveSkillActionTarget(other,e.medic('inargansin').actions[0],a,e.medic('inargansin')),a);
});

test('medic stimulant reanimates a non-summon once per battle and expires despite healing and invulnerability',()=>{
 const e=medicEngine(['zombie']),s=e.owner,a=unit(e,'player',120);a.maxHp=1000;a.hp=0;e.syncAliveState(a);const skill=e.runtime('stimulant');e.startCast(s,{type:'skill',target:a,skill});assert(a.alive);assert.equal(a.hp,500);assert.equal(a.effectAttackRateMultiplier,1.2);assert.equal(a.effectCastTimeMultiplier,.8);
 a.hp=1000;a.reviveInvulnerableTicks=1000;for(let i=0;i<359;i++)e.updateTemporaryRevivals();assert(a.alive);e.updateTemporaryRevivals();assert.equal(a.alive,false);assert.equal(a.temporaryReviveUsed,true);assert.equal(e.resolveSkillTarget(s,skill,[s,a],[e.target]),null);
 e.resetUnitForBattle(a);assert.equal(a.temporaryReviveUsed,false);
});

test('medic stimulant permits early death and never selects summons or repeatedly revives the same corpse',()=>{
 const e=medicEngine(),s=e.owner,a=unit(e,'player',120);a.hp=0;e.syncAliveState(a);e.startCast(s,{type:'skill',target:a,skill:e.runtime('stimulant')});a.hp=0;e.syncAliveState(a);assert.equal(a.temporaryRevival,null);assert.equal(e.resolveSkillTarget(s,e.runtime('stimulant'),[s,a],[]),null);
 const summon=unit(e,'player',115);summon.isSummon=true;summon.hp=0;summon.alive=false;assert.equal(e.resolveSkillTarget(s,e.runtime('stimulant'),[s,a,summon],[]),null);
});

test('medic evacuation is a castable infinite-range ultimate with a strict ten-percent condition and rear teleport',()=>{
 const e=medicEngine(),s=e.owner,a=unit(e,'player',400);a.maxHp=1000;a.hp=100;const skill=e.runtime('evacuation_ultimate');assert.equal(e.resolveSkillTarget(s,skill,[s,a],[]),null);
 a.hp=99;const oldX=s.x;e.startCast(s,{type:'skill',target:a,skill});assert.equal(a.hp,599);assert(a.x<20);assert.equal(s.x,oldX);assert.equal(e.projectiles.length,0);assert.equal(e.canActivateSkill(s,skill),false);
});

function priestEngine(options=[]) {
 const e=engine();e.skillsJson=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','skills.json'),'utf8')));
 e.priest=id=>e.getSkillById('skill_class_priest_'+id);const s=e.owner=unit(e),t=e.target=unit(e,'enemy',110);s.magic=100;s.hp=s.maxHp=1000;s.mp=s.maxMp=200;t.hp=t.maxHp=10000;
 s.skillIds=['resonance','revival_ultimate','barrier','blessing','explosion','smite',...options].map(id=>e.priest(id).id);e.runtime=id=>e.getRuntimeSelectionSkill(s,e.priest(id));return e;
}

test('priest smite scales with living allies bearing this caster blessing and ignores other casters',()=>{
 const e=priestEngine(),s=e.owner,t=e.target,a=unit(e,'player',120),b=unit(e,'player',130),other=unit(e,'player',140);
 e.applySkill(s,a,e.runtime('blessing'));e.applySkill(other,b,e.priest('blessing'));e.applySkill(s,t,e.runtime('smite'));assert.equal(t.hp,9890);
 e.applyTimedEffectAction(s,b,e.runtime('blessing').actions[0],e.runtime('blessing'));e.applySkill(s,t,e.runtime('smite'));assert.equal(t.hp,9770);
 a.hp=0;e.syncAliveState(a);e.applySkill(s,t,e.runtime('smite'));assert.equal(t.hp,9660);
});

test('priest explosion resonance equals combined actual damage and HP healing and never recursively responds to itself',()=>{
 for(const options of [[],['gentleness']]) {
  const e=priestEngine(options),s=e.owner,t=e.target,a=unit(e,'player',120),b=unit(e,'player',130),enemy=unit(e,'enemy',140);a.maxHp=b.maxHp=1000;a.hp=b.hp=10;enemy.hp=enemy.maxHp=1000;
  e.applySkill(s,a,e.runtime('blessing'));e.applySkill(s,t,e.runtime('explosion'));
  assert.equal(t.hp,9980);assert.equal(enemy.hp,980);assert.equal(b.hp,30);assert.equal(a.hp,options.length ? 38 : 34);
 }
});

test('priest holy barrier mitigation is linked to shield life and inner barrier regenerates the original amount once',()=>{
 const e=priestEngine(['inner_barrier']),s=e.owner,t=e.target,a=unit(e,'player',120);a.hp=a.maxHp=1000;
 e.applySkill(s,a,e.runtime('barrier'));assert.equal(e.getUnitBarrierValue(a),80);assert.equal(e.getUnitIncomingRulePercent(a,'receivedDamagePercent'),85);
 for(let i=0;i<60;i++)e.updateBattleEffects();s.magic=500;e.applyActionDamage(t,a,{damageType:'fixed',coefficients:[{type:'fixed',value:100}]});
 assert.equal(a.hp,1000);assert.equal(e.getUnitBarrierValue(a),40);assert.equal(e.getTimedBarriers(a)[0].remainingTicks,420);assert.equal(e.getUnitIncomingRulePercent(a,'receivedDamagePercent'),85);
 e.applyActionDamage(t,a,{damageType:'fixed',coefficients:[{type:'fixed',value:100}]});assert.equal(e.getUnitBarrierValue(a),0);assert.equal(e.getUnitIncomingRulePercent(a,'receivedDamagePercent'),100);
});

test('priest inner barrier never regenerates from expiration dispel or replacement',()=>{
 for(const mode of ['expire','dispel','replace']) {
  const e=priestEngine(['inner_barrier']),s=e.owner,a=unit(e,'player',120);e.applySkill(s,a,e.runtime('barrier'));
  if(mode==='expire')for(let i=0;i<480;i++)e.updateBattleEffects();
  if(mode==='dispel')e.applyTimedEffectAction(s,a,e.normalizeSkillAction({type:'delete_buff',effect:{dispelMode:'all',dispelPolarity:'beneficial'}}));
  if(mode==='replace'){s.magic=200;e.applySkill(s,a,e.runtime('barrier'));assert.equal(e.getUnitBarrierValue(a),160);}
  else {assert.equal(e.getUnitBarrierValue(a),0);assert.equal(e.getUnitIncomingRulePercent(a,'receivedDamagePercent'),100);}
  assert.equal(e.getBattleEvents('barrier_break').length,0);
 }
});

test('priest blessing returns exactly the MP paid after resource modifiers only on natural expiration',()=>{
 const e=priestEngine(['quick_blessing','return']),s=e.owner,a=unit(e,'player',120);const skill=e.runtime('blessing');assert.equal(skill.castTime,0);assert.equal(skill.resourceCosts[0].value,10);
 const spent=e.spendSkillResourceCosts(s,skill,50);assert.equal(spent.MP,5);e.startCast(s,{type:'skill',target:a,skill,resourceSpent:spent});s.mp=0;
 for(let i=0;i<1799;i++)e.updateBattleEffects();assert.equal(s.mp,0);e.updateBattleEffects();assert.equal(s.mp,5);assert.equal(e.getBattleEvents('resource_refund').length,1);
});

test('priest blessing refund excludes dispel death and the replaced application',()=>{
 for(const mode of ['dispel','death','replace']) {
  const e=priestEngine(['return']),s=e.owner,a=unit(e,'player',120),skill=e.runtime('blessing');
  e.applySkill(s,a,skill,e.createSkillExecutionContext({total:5,MP:5}));s.mp=0;
  if(mode==='dispel')e.applyTimedEffectAction(s,a,e.normalizeSkillAction({type:'delete_buff',effect:{dispelMode:'all',dispelPolarity:'beneficial'}}));
  if(mode==='death'){a.hp=0;e.syncAliveState(a);}
  if(mode==='replace')e.applyTimedEffectAction(s,a,skill.actions[0],skill,e.createSkillExecutionContext({total:3,MP:3}));
  for(let i=0;i<1800;i++)e.updateBattleEffects();assert.equal(s.mp,mode==='replace' ? 3 : 0);
 }
});

test('priest resurrection restores one dead ally with selected invulnerability and respects range and once per battle',()=>{
 const e=priestEngine(['descent','quick_smite']),s=e.owner,t=e.target,a=unit(e,'player',120);a.maxHp=1000;a.hp=0;e.syncAliveState(a);const skill=e.runtime('revival_ultimate');
 assert.equal(e.runtime('smite').castTime,2);e.startCast(s,{type:'skill',target:a,skill});for(let i=0;i<180;i++)e.updateCast(s);assert(a.alive);assert.equal(a.hp,500);assert.equal(a.x,120);assert.equal(a.reviveInvulnerableTicks,360);assert.equal(e.canActivateSkill(s,skill),false);
 e.applyActionDamage(t,a,{damageType:'fixed',coefficients:[{type:'fixed',value:100}]});assert.equal(a.hp,500);
});

function archerEngine(options=[]) {
 const e=engine();e.skillsJson=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','skills.json'),'utf8')));
 e.archer=id=>e.getSkillById('skill_class_archer_'+id);const s=e.owner=unit(e),t=e.target=unit(e,'enemy',110);s.atk=100;s.hp=s.maxHp=1000;t.hp=t.maxHp=10000;
 s.skillIds=['critical','archery_ultimate','guard','push','multishot','power_shot',...options].map(id=>e.archer(id).id);
 e.runtime=id=>e.getRuntimeSelectionSkill(s,e.archer(id));
 e.basic=e.normalizeSkillJson([{id:'archer_test_basic',name:'basic',slot:'basic',castTime:0,cooldown:0,actions:[{type:'deal_damage',target:'enemy',rangeMode:'mainWeapon',damageType:'physical',coefficients:[{type:'calculated',field:'atk',calc:'percent',value:100}]}]}]).find(x=>x.id==='archer_test_basic');return e;
}

test('archer critical strengthens the fifth basic attack and active skills never advance its counter',()=>{
 const e=archerEngine(),s=e.owner,t=e.target;for(let i=0;i<4;i++)e.doAttack(s,t,e.basic);assert.equal(t.hp,9600);
 e.applySkill(s,t,e.runtime('power_shot'));assert.equal(t.hp,9400);e.doAttack(s,t,e.basic);assert.equal(t.hp,9200);
 e.doAttack(s,t,e.basic);assert.equal(t.hp,9100);assert.equal(s.basicAttackCounts[e.archer('critical').id],1);e.resetUnitForBattle(s);assert.equal(Object.keys(s.basicAttackCounts).length,0);
});

test('archer selected fourth-hit critical doubles only the empowered hit during archery and does not retarget a kill',()=>{
 const e=archerEngine(['deadly_man']),s=e.owner,t=e.target;e.applySkill(s,s,e.runtime('archery_ultimate'));
 for(let i=0;i<4;i++)e.doAttack(s,t,e.basic);assert.equal(t.hp,9300);assert.equal(s.effectAttackRateMultiplier,1.3);
 for(let i=0;i<600;i++)e.updateBattleEffects();assert.equal(s.effectAttackRateMultiplier,1);
 const other=unit(e,'enemy',111);other.hp=other.maxHp=1000;t.hp=100;e.applySkill(s,s,e.runtime('archery_ultimate'));s.basicAttackCounts[e.archer('critical').id]=3;e.doAttack(s,t,e.basic);assert.equal(t.hp,0);assert.equal(other.hp,1000);
});

test('archer counted projectile is prepared once and keeps the empowered hit until impact',()=>{
 const e=archerEngine(),s=e.owner,t=e.target;s.basicAttackCounts={[e.archer('critical').id]:4};e.spawnProjectile(s,t,'attack',e.basic);assert.equal(s.basicAttackCounts[e.archer('critical').id],0);e.updateProjectiles();assert.equal(t.hp,9800);assert.equal(s.basicAttackCounts[e.archer('critical').id],0);
});

test('archer attached guard absorbs direct attacks with its own HP and is neither a summon nor ordinary BP',()=>{
 const e=archerEngine(),s=e.owner,t=e.target;e.applySkill(s,s,e.runtime('guard'));assert.equal(e.getLivingOwnedSummons(s).length,0);assert.equal(e.getUnitBarrierValue(s),0);
 const hit={damageType:'fixed',coefficients:[{type:'fixed',value:300}]};e.applyActionDamage(t,s,hit);assert.equal(s.hp,1000);assert.equal(e.getAttachedGuardEffect(s).guardRemaining,400);assert.equal(e.getAttachedGuardEffect(s).guardRemainingHits,2);
 e.applyActionDamage(t,s,hit);e.applyActionDamage(t,s,hit);assert.equal(s.hp,1000);assert.equal(e.getAttachedGuardEffect(s),undefined);assert.equal(t.stats.damage,700);
 e.applyActionDamage(t,s,hit);assert.equal(s.hp,700);
});

test('archer guard consumes three actual attacks not discarded remaining HP and ignores area periodic and reflected damage',()=>{
 const e=archerEngine(),s=e.owner,t=e.target;e.applySkill(s,s,e.runtime('guard'));const damage={damageType:'fixed',coefficients:[{type:'fixed',value:10}]};
 for(const extra of [{area:1},{periodic:true},{reflected:true}])e.applyActionDamage(t,s,{...damage,...extra});assert.equal(s.hp,970);assert.equal(e.getAttachedGuardEffect(s).guardRemaining,700);assert.equal(e.getAttachedGuardEffect(s).guardRemainingHits,3);
 for(let i=0;i<3;i++)e.applyActionDamage(t,s,damage);assert.equal(s.hp,970);assert.equal(t.stats.damage,60);assert.equal(e.getAttachedGuardEffect(s),undefined);
 e.applySkill(s,s,e.runtime('guard'));for(let i=0;i<480;i++)e.updateBattleEffects();assert.equal(e.getAttachedGuardEffect(s),undefined);
});

test('archer endurance extends guard HP and character HP and rune blade still has damage priority',()=>{
 const e=archerEngine(['endurance']),s=e.owner,t=e.target;e.recalculateBattleBuffs(s);assert.equal(s.maxHp,1300);e.applySkill(s,s,e.runtime('guard'));assert.equal(e.getAttachedGuardEffect(s).guardRemaining,1000);
 t.atk=100;t.activeEffects=[{mode:'priority_attack_damage',remainingTicks:100}];e.applyActionDamage(t,s,{damageType:'fixed',coefficients:[{type:'fixed',value:1000}]});assert.equal(s.hp,1200);assert.equal(e.getAttachedGuardEffect(s).guardRemaining,1000);
});

test('archer multishot has three targets or four with selected quadruple and bow mastery checks weapon type',()=>{
 const e=archerEngine(['quadruple_shot','bow_mastery']),s=e.owner,t=e.target;const others=[120,130,140].map(x=>unit(e,'enemy',x));for(const x of others)x.hp=x.maxHp=1000;
 s.weaponAttacks=[{weaponCategory:'bow'}];e.recalculateBattleBuffs(s);assert.equal(s.atk,160);assert.equal(e.runtime('multishot').actions[0].maxTargets,4);e.applySkill(s,t,e.runtime('multishot'));for(const x of others)assert.equal(x.hp,800);
 s.weaponAttacks=[{weaponCategory:'gun'}];e.recalculateBattleBuffs(s);assert.equal(s.atk,110);s.skillIds=s.skillIds.filter(id=>id!==e.archer('quadruple_shot').id);assert.equal(e.runtime('multishot').actions[0].maxTargets,3);
});

test('archer sharp and concentrated shot affect only power shot and preserve target defense',()=>{
 const e=archerEngine(['sharp_shot','concentration']),s=e.owner,t=e.target;t.defense=20;
 e.getReducedDamage=(source,target,type,amount)=>type==='physical' ? amount*(1-Math.max(0,target.defense||0)/100) : amount;
 const power=e.runtime('power_shot');assert.equal(power.castTime,1);assert.equal(power.actions[0].coefficients[0].value,260);e.applySkill(s,t,power);assert.equal(t.hp,9753);assert.equal(t.defense,20);assert.equal(e.runtime('multishot').actions[0].defenseIgnoreFlat,0);
});

test('archer push applies three-second slow and six-meter knockback only within two meters',()=>{
 const e=archerEngine(),s=e.owner,t=e.target;t.speed=2;e.applySkill(s,t,e.runtime('push'));assert.equal(t.hp,9950);assert.equal(t.speed,1.4);assert(t.x>=170);
 for(let i=0;i<180;i++)e.updateBattleEffects();assert.equal(t.speed,2);
});

function warlockEngine(options=[]) {
 const e=engine();e.skillsJson=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','skills.json'),'utf8')));
 e.warlock=id=>e.getSkillById('skill_class_warlock_'+id);const s=e.owner=unit(e),t=e.target=unit(e,'enemy',110);
 s.magic=100;s.hp=s.maxHp=2000;s.mp=s.maxMp=200;s.attributes={focus:0};t.hp=t.maxHp=5000;
 s.skillIds=['instant_cast','collapse_ultimate','zone','dragon','lightning','bite',...options].map(id=>e.warlock(id).id);
 e.runtime=id=>e.getRuntimeSelectionSkill(s,e.warlock(id));return e;
}

test('warlock instant casting charges only the final reduced time including focus flat and percent buffs',()=>{
 const e=warlockEngine(),s=e.owner,t=e.target,bite=e.runtime('bite');assert.equal(e.getInstantCastHpCost(s,bite),100);
 s.attributes.focus=20;assert.equal(e.getInstantCastHpCost(s,bite),80);
 e.applyTimedEffectAction(s,s,e.normalizeSkillAction({type:'add_buff',duration:10,effect:{id:'flat',stat:'castSpeed',mode:'cast_time_flat',value:-.2}}));
 e.applyTimedEffectAction(s,s,e.normalizeSkillAction({type:'add_buff',duration:10,effect:{id:'percent',stat:'castSpeed',mode:'cast_time_percent',value:-50}}));
 assert.equal(e.getInstantCastHpCost(s,bite),30);assert.equal(e.getInstantCastHpCost(s,bite,{castTimePercent:50}),15);
 e.startCast(s,{type:'skill',target:t,skill:bite,skillModifier:{castTimePercent:50},resourceSpent:{total:10,MP:10,HP:0}});assert.equal(s.castTimer,0);assert.equal(s.hp,2015-15);assert.equal(t.hp,4900);
 s.attributes.focus=100;assert.equal(e.getInstantCastHpCost(s,bite),0);
});

test('warlock thrift changes the unit cost and insufficient HP skips skills before spending mana',()=>{
 const e=warlockEngine(['thrift']),s=e.owner,t=e.target;assert.equal(e.getInstantCastHpCost(s,e.runtime('bite')),80);
 s.skillIds=[e.warlock('instant_cast').id,e.warlock('bite').id,e.warlock('thrift').id];s.hp=79;
 assert.equal(e.tryUseReadySkill(s,[s],[t]),false);assert.equal(s.mp,200);assert.equal(s.hp,79);
 s.hp=80;e.startCast(s,{type:'skill',target:t,skill:e.runtime('bite')});assert.equal(s.alive,false);assert.equal(t.hp,5000);
});

test('warlock basic and independent attacks use reduced casting HP and preserve attack intervals',()=>{
 const e=warlockEngine(),s=e.owner,t=e.target;const skill=e.normalizeSkillJson([{id:'basic-warlock',name:'basic',slot:'basic',castTime:null,actions:[{type:'deal_damage',target:'enemy',coefficients:[{type:'fixed',value:10}]}]}]).find(x=>x.id==='basic-warlock');
 s.castSpeed=.5;s.attackSpeed=2;e.startCast(s,{type:'attack',target:t,skill});assert.equal(s.castTimer,0);assert.equal(s.hp,1950);assert.equal(s.attackCooldown,e.getAttackCooldown(s));
 const w={attackType:'magic',castSpeed:.6,attackSpeed:2,attackRange:1};s.weaponAttacks=[w];s.weaponAttackStates=[{weapon:w,castTimer:0,cooldown:0,target:null}];e.updateIndependentWeaponAttacks(s,[t]);assert.equal(s.hp,1890);assert.equal(s.weaponAttackStates[0].cooldown,120);assert.equal(s.weaponAttackStates[0].castTimer,0);
});

test('warlock demonic bite changes healing only and lightning chains to three unique targets',()=>{
 const e=warlockEngine(['demonic_bite','lightning_mage']),s=e.owner,t=e.target;s.hp=500;
 e.applySkill(s,t,e.runtime('bite'));assert.equal(t.hp,4900);assert.equal(s.hp,580);
 const next=unit(e,'enemy',139),third=unit(e,'enemy',168),fourth=unit(e,'enemy',197);for(const x of [next,third,fourth])x.hp=x.maxHp=1000;
 const lightning=e.runtime('lightning');assert.equal(lightning.cooldown,4);e.applySkill(s,t,lightning);assert.equal(t.hp,4780);assert.equal(next.hp,880);assert.equal(third.hp,880);assert.equal(fourth.hp,1000);
});

test('warlock dragon channels four pulses and removes its slow and selected mitigation on interruption',()=>{
 const e=warlockEngine(['overwhelming']),s=e.owner,t=e.target;t.speed=2;const dragon=e.runtime('dragon');
 e.startCast(s,{type:'skill',target:t,skill:dragon});assert.equal(s.hp,2000);assert.equal(t.speed,1.4);assert.equal(e.getUnitIncomingRulePercent(s,'receivedDamagePercent'),85);
 for(let i=0;i<240;i++){e.updateBattleChannel(s);e.updateProjectiles();}assert.equal(t.hp,4800);assert.equal(t.speed,2);assert.equal(s.channelAction,null);assert.equal(e.getUnitIncomingRulePercent(s,'receivedDamagePercent'),100);
 e.startCast(s,{type:'skill',target:t,skill:dragon});assert.equal(t.speed,1.4);e.finishBattleChannel(s,'test');assert.equal(t.speed,2);assert.equal(e.getUnitIncomingRulePercent(s,'receivedDamagePercent'),100);
});

test('warlock dark zone clamps resistance and selected armor debuff to zero and expires',()=>{
 const e=warlockEngine(['beneficial_zone']),s=e.owner,t=e.target;t.resistance=10;t.defense=5;const far=unit(e,'enemy',171);far.resistance=30;far.defense=20;
 e.applySkill(s,t,e.runtime('zone'));assert.equal(t.resistance,0);assert.equal(t.defense,0);assert.equal(far.resistance,30);assert.equal(far.defense,20);
 for(let i=0;i<300;i++)e.updateBattleEffects();assert.equal(t.resistance,10);assert.equal(t.defense,5);
});

test('warlock collapse heals the actual area damage and ultimate cannot be reused',()=>{
 const e=warlockEngine(),s=e.owner,t=e.target;s.hp=500;const near=unit(e,'enemy',149),far=unit(e,'enemy',151);near.hp=near.maxHp=1000;far.hp=far.maxHp=1000;
 e.startCast(s,{type:'skill',target:t,skill:e.runtime('collapse_ultimate')});assert.equal(t.hp,4800);assert.equal(near.hp,800);assert.equal(far.hp,1000);assert.equal(s.hp,600);assert.equal(e.canActivateSkill(s,e.runtime('collapse_ultimate')),false);
});

test('warlock fallen genius stats apply only when selected without accumulating bonus HP',()=>{
 const e=warlockEngine(['fallen_genius']),s=e.owner;s.defense=10;s.resistance=10;e.recalculateBattleBuffs(s);assert.equal(s.maxHp,2500);assert.equal(s.hp,2500);assert.equal(s.defense,15);assert.equal(s.resistance,15);assert.equal(s.magic,95);
 s.hp=1000;for(let i=0;i<5;i++)e.recalculateBattleBuffs(s);assert.equal(s.hp,1000);assert.equal(s.maxHp,2500);
 s.skillIds=s.skillIds.filter(id=>id!==e.warlock('fallen_genius').id);e.recalculateBattleBuffs(s);assert.equal(s.maxHp,2000);assert.equal(s.magic,100);assert.equal(s.hp,1000);
});

function spiritEngine(kind='heal') {
 const e=engine();e.skillsJson=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','skills.json'),'utf8')));
 e.spiritEntities=['enhance','heal','destroy'].map(kind=>JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','entities',`spirit_${kind}.json`),'utf8')));
 vm.runInContext('entitiesJson.push(...spiritEntities)',e);
 e.spirit=id=>e.getSkillById('skill_class_spirit_'+id);e.owner=unit(e);e.owner.magic=100;
 e.owner.skillIds=[e.spirit('choice').id,...['purify','sacrifice','burst','birth'].map(id=>e.spirit(id).id)];
 e.owner.skillSelections={[e.spirit('choice').id]:kind};return e;
}

test('spirits choose one type, enter with one and generate every seven seconds up to a shared cap of five',()=>{
 const e=spiritEngine('destroy'),s=e.owner;e.publishBattleEvents([{type:'battle_entry',source:s,target:s}]);
 assert.equal(s.summons.length,1);assert.equal(s.summons[0].entityId,'spirit_destroy');assert.equal(s.summons[0].hp,100);assert.equal(s.summons[0].summonTicks,null);
 for(let i=0;i<419;i++)e.updateBattleEffects();assert.equal(e.getLivingOwnedSummons(s).length,1);e.updateBattleEffects();assert.equal(e.getLivingOwnedSummons(s).length,2);
 const enemy=unit(e,'enemy',110);enemy.hp=enemy.maxHp=10000;
 for(let i=0;i<10;i++)e.applySkill(s,enemy,e.spirit('birth'));assert.equal(e.getLivingOwnedSummons(s).length,5);
 for(let i=0;i<840;i++)e.updateBattleEffects();assert.equal(e.getLivingOwnedSummons(s).length,5);
 e.removeSummonedBattleUnit(e.getLivingOwnedSummons(s)[0]);for(let i=0;i<420;i++)e.updateBattleEffects();assert.equal(e.getLivingOwnedSummons(s).length,5);
 s.hp=0;e.syncAliveState(s);const total=s.summons.length;for(let i=0;i<420;i++)e.updateBattleEffects();assert.equal(s.summons.length,total);
});

test('spirit selected cap and production changes apply to all three types and birth shares the cap',()=>{
 for(const kind of ['enhance','heal','destroy']) {
  const e=spiritEngine(kind),s=e.owner;s.skillIds.push(e.spirit('more_the_better').id,e.spirit('spirit_cycle').id);
  const runtime=id=>e.getRuntimeSelectionSkill(s,e.spirit(id));
  e.publishBattleEvents([{type:'battle_entry',source:s,target:s}]);
  for(let i=0;i<299;i++)e.updateBattleEffects();assert.equal(e.getLivingOwnedSummons(s).length,1);
  e.updateBattleEffects();assert.equal(e.getLivingOwnedSummons(s).length,2);
  for(let i=0;i<10;i++)e.applySkill(s,s,runtime('passive_'+kind));assert.equal(e.getLivingOwnedSummons(s).length,7);
  const enemy=unit(e,'enemy',110);e.applySkill(s,enemy,runtime('birth'));assert.equal(e.getLivingOwnedSummons(s).length,7);
  assert.equal(runtime('birth').actions[0].rangeMode,'mainWeapon');assert.equal(runtime('burst').actions[0].rangeMode,'mainWeapon');
 }
});

test('spirit king follows only selected spirits on spawn sacrifice and death without accumulation',()=>{
 const e=spiritEngine(),s=e.owner;s.skillIds.push(e.spirit('spirit_king').id);e.recalculateBattleBuffs(s);assert.equal(s.magic,100);
 const badge=()=>e.getBattleEffectIconEntries(s).find(x=>x.skillId===e.spirit('choice').id).summonCount;
 assert.equal(badge(),0);e.applySkill(s,s,e.spirit('passive_heal'));assert.equal(s.magic,103);assert.equal(badge(),1);
 e.applySkill(s,s,e.spirit('passive_destroy'));assert.equal(s.magic,103);assert.equal(badge(),1);
 e.applySkill(s,s,e.spirit('passive_heal'));assert.equal(s.magic,106);assert.equal(badge(),2);
 for(let i=0;i<5;i++)e.recalculateBattleBuffs(s);assert.equal(s.magic,106);
 const pet=e.getLivingOwnedSummons(s,'spirit_heal')[0];pet.hp=0;e.syncAliveState(pet);assert.equal(s.magic,103);assert.equal(badge(),1);
 e.paySkillSummonCost(s,e.spirit('sacrifice'));assert.equal(s.magic,100);assert.equal(badge(),0);
});

test('spirit holy sacrifice needs two spirits and improves coefficient and radius only when selected',()=>{
 const e=spiritEngine(),s=e.owner;s.skillIds.push(e.spirit('holy_sacrifice').id);s.mp=100;
 const skill=e.getRuntimeSelectionSkill(s,e.spirit('sacrifice'));assert.equal(skill.summonCost.count,2);assert.equal(skill.actions[0].area,7);assert.equal(skill.actions[0].coefficients[0].value,200);
 e.applySkill(s,s,e.spirit('passive_heal'));assert.equal(e.canPaySkillResourceCosts(s,skill),false);
 e.applySkill(s,s,e.spirit('passive_heal'));assert.equal(e.canPaySkillResourceCosts(s,skill),true);
 const ally=unit(e,'player',169);ally.hp=1;ally.maxHp=1000;e.startCast(s,{type:'skill',target:ally,skill});for(let i=0;i<120;i++)e.updateCast(s);
 assert.equal(ally.hp,201);assert.equal(e.getLivingOwnedSummons(s).length,0);
 s.skillIds=s.skillIds.filter(id=>id!==e.spirit('holy_sacrifice').id);assert.equal(e.getRuntimeSelectionSkill(s,e.spirit('sacrifice')).summonCost.count,1);
});

test('spirit quick command reduces all cast durations and unfair purification silences the circle',()=>{
 const e=spiritEngine(),s=e.owner;s.skillIds.push(e.spirit('quick_command').id,e.spirit('unfair_purify').id);e.recalculateBattleBuffs(s);
 const enemy=unit(e,'enemy',120),far=unit(e,'enemy',181);s.mp=100;
 e.applySkill(s,s,e.spirit('passive_heal'));const skill=e.getRuntimeSelectionSkill(s,e.spirit('purify'));e.startCast(s,{type:'skill',target:s,skill});assert.equal(s.castDuration,132);
 for(let i=0;i<132;i++)e.updateCast(s);assert(e.hasBattleState(enemy,'silence'));assert.equal(e.hasBattleState(far,'silence'),false);
 for(let i=0;i<120;i++)e.updateBattleEffects();assert.equal(e.hasBattleState(enemy,'silence'),false);
 e.startCast(s,{type:'skill',target:enemy,skill:e.spirit('birth')});assert.equal(s.castDuration,102);
});

test('spirit chaos consumes three on completion heals only its circle and is once per battle',()=>{
 const e=spiritEngine(),s=e.owner;const skill=e.spirit('chaos_ultimate');s.skillIds.push(skill.id);const ally=unit(e,'player',149),far=unit(e,'player',151);ally.hp=far.hp=1;ally.maxHp=far.maxHp=1000;
 for(let i=0;i<2;i++)e.applySkill(s,s,e.spirit('passive_heal'));assert.equal(e.canPaySkillResourceCosts(s,skill),false);
 e.applySkill(s,s,e.spirit('passive_heal'));e.startCast(s,{type:'skill',target:ally,skill});e.interruptBattleCast(s,'test');assert.equal(e.getLivingOwnedSummons(s).length,3);
 e.startCast(s,{type:'skill',target:ally,skill});for(let i=0;i<90;i++)e.updateCast(s);assert.equal(ally.hp,201);assert.equal(far.hp,1);assert.equal(e.getLivingOwnedSummons(s).length,0);assert.equal(e.canActivateSkill(s,skill),false);
});

test('spirit sacrifice requires a living selected spirit and consumes exactly one only after a successful cast',()=>{
 const e=spiritEngine(),s=e.owner,ally=unit(e,'player',110);ally.hp=10;
 const heal=e.spirit('sacrifice');assert.equal(e.canPaySkillResourceCosts(s,heal),false);
 e.applySkill(s,s,e.spirit('passive_heal'));e.applySkill(s,s,e.spirit('passive_heal'));assert.equal(e.getLivingOwnedSummons(s).length,2);
 e.startCast(s,{type:'skill',target:ally,skill:heal});e.interruptBattleCast(s,'test');assert.equal(e.getLivingOwnedSummons(s).length,2);
 e.startCast(s,{type:'skill',target:ally,skill:heal});for(let i=0;i<120;i++)e.updateCast(s);
 assert.equal(e.getLivingOwnedSummons(s).length,1);assert.equal(ally.hp,100);
 e.startCast(s,{type:'skill',target:ally,skill:heal});e.removeSummonedBattleUnit(e.getLivingOwnedSummons(s)[0]);ally.hp=10;for(let i=0;i<120;i++)e.updateCast(s);assert.equal(ally.hp,10);
});

test('spirit explosion and purification consume one and affect only the configured circles',()=>{
 const e=spiritEngine(),s=e.owner,ally=unit(e,'player',110),enemy=unit(e,'enemy',120),far=unit(e,'enemy',181),near=unit(e,'enemy',150);for(const t of [enemy,far,near])t.hp=t.maxHp=1000;
 e.applySkill(s,s,e.spirit('passive_heal'));e.startCast(s,{type:'skill',target:enemy,skill:e.spirit('burst')});for(let i=0;i<150;i++)e.updateCast(s);e.updateProjectiles();assert.equal(enemy.hp,850);assert.equal(near.hp,850);assert.equal(far.hp,1000);assert.equal(e.getLivingOwnedSummons(s).length,0);
 const buff=(id,polarity)=>e.normalizeSkillAction({type:'add_buff',duration:20,effect:{id,stat:'atk',mode:'flat',value:1,polarity}});
 for(const id of ['a','b']){e.applyTimedEffectAction(enemy,ally,buff(id,'harmful'));e.applyTimedEffectAction(enemy,enemy,buff(id,'beneficial'));}
 e.applySkill(s,s,e.spirit('passive_heal'));e.startCast(s,{type:'skill',target:ally,skill:e.spirit('purify')});for(let i=0;i<180;i++)e.updateCast(s);
 assert.equal(ally.activeEffects.length,1);assert.equal(enemy.activeEffects.length,1);assert.equal(e.getLivingOwnedSummons(s).length,0);
});

test('spirit actions reference the current owner magic and use no basic attacks or mana costs',()=>{
 for(const kind of ['heal','destroy']){
  const e=spiritEngine(kind),s=e.owner,ally=unit(e,'player',110),enemy=unit(e,'enemy',115);ally.hp=10;enemy.hp=enemy.maxHp=1000;
  e.applySkill(s,s,e.spirit('passive_'+kind));const spirit=e.getLivingOwnedSummons(s)[0];assert.equal(spirit.basicAttackDisabled,true);assert.deepEqual(Array.from(spirit.skillIds),[e.spirit('entity_'+kind).id]);
  s.magic=200;e.applySkill(spirit,kind==='heal'?ally:enemy,e.spirit('entity_'+kind));assert.equal(kind==='heal'?ally.hp:enemy.hp,kind==='heal'?12:996);
  const mp=spirit.mp;e.spendSkillResourceCosts(spirit,e.spirit('entity_'+kind));assert.equal(spirit.mp,mp);
 }
});

test('enhancement spirit buffs real strength and intelligence without drift and restores derived stats on dispel',()=>{
 const e=spiritEngine('enhance'),s=e.owner,ally=unit(e,'player',110);ally.attributes={str:9,int:9};ally.atk=20;ally.magic=30;
 e.applySkill(s,s,e.spirit('passive_enhance'));const spirit=e.getLivingOwnedSummons(s)[0];e.applySkill(spirit,ally,e.spirit('entity_enhance'));
 assert.equal(e.resolveSkillActionTarget(spirit,e.spirit('entity_enhance').actions[0],spirit,e.spirit('entity_enhance'))===spirit,false);
 assert.equal(ally.attributes.str,10);assert.equal(ally.attributes.int,10);assert.equal(ally.atk,21);assert.equal(ally.magic,31);assert.equal(ally.defense,1);assert.equal(ally.resistance,1);
 ally.mp=ally.maxMp;const fullMp=ally.mp;for(let i=0;i<5;i++)e.recalculateBattleBuffs(ally);assert.equal(ally.atk,21);assert.equal(ally.magic,31);assert.equal(ally.mp,fullMp);
 e.applyTimedEffectAction(s,ally,e.normalizeSkillAction({type:'delete_buff',effect:{id:'spirit_basic_enhance',dispelMode:'id'}}));assert.equal(ally.attributes.str,9);assert.equal(ally.atk,20);assert.equal(ally.magic,30);assert.equal(ally.defense,0);
});

test('knight mount is invisible and untargetable but still shares damage and appears under its owner',()=>{
 const e=engine();e.skillsJson=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','skills.json'),'utf8')));
 e.horseDefinition=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','entities','knight_magic_horse.json'),'utf8'));vm.runInContext('entitiesJson.push(horseDefinition)',e);
 const knight=unit(e),enemy=unit(e,'enemy',110);knight.hp=knight.maxHp=1000;knight.speed=2;
 const passive=e.getSkillById('skill_class_knight_magic_horse');knight.skillIds=[passive.id];e.applySkill(knight,knight,passive);const horse=e.getLivingOwnedSummons(knight,'knight_magic_horse')[0];assert.ok(horse);
 assert.equal(horse.commandOnly,true);assert.equal(horse.targetable,false);assert.equal(horse.collidable,false);assert.equal(e.isMountedCompanion(horse),true);e.drawUnit(horse,false);
 assert.equal(e.getActiveBattleEntities(e.playerSquad).includes(horse),false);
 const area=e.normalizeSkillAction({type:'deal_damage',target:'enemy',area:20,areaCenter:'self',damageType:'fixed',coefficients:[{type:'fixed',value:100}]});e.applySkill(enemy,knight,skill(e,area));assert.equal(knight.hp,920);assert.equal(horse.hp,480);
 const x=horse.x;e.moveUnit(horse,[enemy]);e.takeAction(horse,[knight,horse],[enemy]);assert.equal(horse.x,x);assert.equal(horse.pendingAction,null);
 e.document={addEventListener(){}};e.getRoleLabel=String;e.getUnitDps=()=>0;e.recordImagePath=()=>'';
 vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js','ui-battle-view.js'),'utf8'),e);
 const html=e.renderStatus(e.playerSquad,()=> 'blue');assert.ok(html.includes('main-summon-group'));assert.ok(html.includes(horse.name));assert.ok(html.includes('480 / 500'));
});

function cheerEngine() {
 const e=engine();e.skillsJson=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','skills.json'),'utf8')));
 e.cheer=id=>e.getSkillById('skill_class_cheer_'+id);return e;
}

test('cheer encourage restores attack based HP and twenty ST independently within six metres',()=>{
 const e=cheerEngine(),s=unit(e),ally=unit(e,'player',160),far=unit(e,'player',161);s.atk=100;s.mp=40;s.skillIds=[e.cheer('encourage').id];
 for(const u of [s,ally,far]){u.hp=50;u.st=50;}
 assert.equal(e.tryUseReadySkill(s,[s,ally,far],[]),true);assert.equal(s.mp,40);assert.equal(s.st,60);assert.equal(s.hp,55);assert.equal(ally.hp,55);assert.equal(ally.st,70);assert.equal(far.hp,50);assert.equal(far.st,50);
 assert.equal(s.skillCooldowns[e.cheer('encourage').id],600);
 ally.hp=100;ally.st=10;e.applySkill(s,ally,e.cheer('encourage'));assert.equal(ally.hp,100);assert.equal(ally.st,30);
});

test('cheer passion bundles attack rate movement and all cast time, restoring every modifier on dispel or expiry',()=>{
 const e=cheerEngine(),s=unit(e),ally=unit(e,'player',110);ally.attackSpeed=2;ally.castSpeed=2;ally.speed=2;
 e.applySkill(s,s,e.cheer('passion'));assert.ok(Math.abs(ally.attackSpeed-2/1.3)<1e-12);assert.equal(ally.speed,2.4);assert.equal(ally.castSpeed,2);assert.equal(ally.effectCastTimeMultiplier,.7);assert.equal(ally.activeEffects.length,1);
 e.applyTimedEffectAction(s,ally,e.normalizeSkillAction({type:'delete_buff',effect:{id:'cheer_passion',dispelMode:'id'}}));assert.equal(ally.attackSpeed,2);assert.equal(ally.speed,2);assert.equal(ally.effectCastTimeMultiplier,1);
 e.applySkill(s,s,e.cheer('passion'));for(let i=0;i<240;i++)e.updateBattleEffects();assert.equal(ally.attackSpeed,2);assert.equal(ally.speed,2);assert.equal(ally.effectCastTimeMultiplier,1);
});

test('cheer cast modifier affects explicit skill fallback basic and independent weapon once, without changing an ongoing cast',()=>{
 const e=cheerEngine(),s=unit(e),target=unit(e,'enemy',105);s.castSpeed=.5;s.attackSpeed=2;
 e.applySkill(s,s,e.cheer('passion'));const basic=e.getUnitSkill(s);e.startCast(s,{type:'attack',target,skill:basic});assert.equal(s.castTimer,21);
 for(let i=0;i<21;i++)e.updateCast(s);assert.equal(s.attackCooldown,39);
 const action=e.normalizeSkillAction({type:'deal_damage',damageType:'fixed',coefficients:[{type:'fixed',value:1}]});const explicit=skill(e,action,2);
 e.startCast(s,{type:'skill',target,skill:explicit});assert.equal(s.castTimer,84);
 e.applyTimedEffectAction(s,s,e.normalizeSkillAction({type:'delete_buff',effect:{id:'cheer_passion',dispelMode:'id'}}));assert.equal(s.castTimer,84);e.interruptBattleCast(s,'test');
 e.startCast(s,{type:'skill',target,skill:explicit});assert.equal(s.castTimer,120);e.interruptBattleCast(s,'test');
 e.applySkill(s,s,e.cheer('passion'));s.weaponAttackStates=[{weapon:{attackType:'physical',attackRange:1,castSpeed:1,attackSpeed:2,attackSkillId:''},cooldown:0,castTimer:0}];
 e.updateIndependentWeaponAttacks(s,[target]);assert.equal(s.weaponAttackStates[0].castTimer,42);assert.equal(s.weaponAttackStates[0].cooldown,92);
});

test('cheer freedom cleanses dispellable physical and magic states then blocks new states for five seconds',()=>{
 const e=cheerEngine(),s=unit(e),ally=unit(e,'player',110),enemy=unit(e,'enemy',115);
 const state=(id,category,dispellable=true)=>e.normalizeSkillAction({type:'add_state',duration:10,effect:{id,state:'silence',category,polarity:'harmful',dispellable}});
 e.applyTimedEffectAction(enemy,ally,state('physical','physical'));e.applyTimedEffectAction(enemy,ally,state('magic','magic'));e.applyTimedEffectAction(enemy,ally,state('locked','general',false));
 e.applySkill(s,ally,e.cheer('freedom'));assert.deepEqual(Array.from(ally.activeEffects.filter(x=>x.kind==='state'),x=>x.id),['locked']);
 e.applyTimedEffectAction(enemy,ally,state('new','magic'));assert.equal(ally.activeEffects.some(x=>x.id==='new'),false);
 e.applyTimedEffectAction(enemy,ally,e.normalizeSkillAction({type:'add_buff',duration:3,effect:{id:'ordinary_slow',stat:'speed',mode:'percent',value:-20,polarity:'harmful'}}));assert.equal(ally.activeEffects.some(x=>x.id==='ordinary_slow'),true);
 for(let i=0;i<300;i++)e.updateBattleEffects();e.applyTimedEffectAction(enemy,ally,state('new','magic'));assert.equal(ally.activeEffects.some(x=>x.id==='new'),true);
});

test('cheer all cast time mode validates and round trips while legacy cast stat keeps explicit casts unchanged',()=>{
 const e=cheerEngine(),s=unit(e),target=unit(e,'enemy',105);
 const legacy=e.normalizeSkillAction({type:'add_buff',target:'self',duration:4,effect:{id:'old',stat:'castSpeed',mode:'percent',value:-30}});s.castSpeed=2;e.applyTimedEffectAction(s,s,legacy);
 const explicit=skill(e,e.normalizeSkillAction({type:'deal_damage',coefficients:[{type:'fixed',value:1}]}),2);e.startCast(s,{type:'skill',target,skill:explicit});assert.equal(s.castTimer,120);e.interruptBattleCast(s,'test');
 const modifier=e.normalizeSkillAction({type:'add_buff',target:'self',duration:4,effect:{id:'time',stat:'castSpeed',mode:'cast_time_percent',value:-30}});assert.equal(e.isSkillActionSupported(modifier),true);e.applyTimedEffectAction(s,s,modifier);assert.equal(s.effectCastTimeMultiplier,.7);
 assert.equal(e.isSkillActionSupported({...modifier,effect:{...modifier.effect,stat:'atk'}}),false);assert.equal(e.isSkillActionSupported({...modifier,effect:{...modifier.effect,value:-101}}),false);
 for(const id of ['encourage','passion','freedom'])assert.equal(e.isSkillExecutable(e.cheer(id)),true,id);
 const chars=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','characters.json'),'utf8'));const ids=chars.find(c=>c.skillIds?.includes(e.cheer('passion').id)).skillIds;assert.equal(ids.includes('skill_class_cheer_medkit'),false);assert.equal(ids.length,3);assert.ok(e.cheer('medkit'));
});

function runeEngine() {
 const e=engine();e.skillsJson=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','skills.json'),'utf8')));
 e.runeDefinitions=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','runes.json'),'utf8'));
 vm.runInContext('runesJson=runeDefinitions.map(normalizeRune);',e);e.runeSkill=id=>e.getSkillById('skill_class_rune_'+id);
 e.installed=()=>vm.runInContext('battleRunes',e);return e;
}

test('runes choose exactly three distinct registry definitions and snapshot permanent independent installations',()=>{
 const e=runeEngine(),s=unit(e),enemy=unit(e,'enemy',400);s.skillIds=[e.runeSkill('master').id];s.magic=100;
 s.skillSelections={[e.runeSkill('master').id]:['rune_flame','rune_flame','missing','rune_moon']};
 const ids=e.getRuneLoadout(s,e.runeSkill('master'));assert.equal(ids.length,3);assert.equal(new Set(ids).size,3);assert.equal(ids[0],'rune_flame');
 e.publishBattleEvents([{type:'battle_entry',source:s,target:s}]);assert.equal(e.installed().length,3);
 const flame=e.installed().find(r=>r.definition.id==='rune_flame');assert.equal(flame.x,400);assert.equal(flame.nextTick,600);
 s.x=250;enemy.x=600;e.updateBattleRunes();assert.equal(flame.x,400);assert.equal(flame.y,100);
 e.publishBattleEvents([{type:'battle_entry',source:s,target:s}]);assert.equal(e.installed().length,3);
 e.runeDefinitions[0].radius=999;assert.equal(e.installed().find(r=>r.definition.id==='rune_moon').definition.radius,20);
});

test('moon crescent and bullet runes pulse only on their intervals and buffs last one second',()=>{
 const e=runeEngine(),s=unit(e),ally=unit(e,'player',110),far=unit(e,'player',350);s.magic=100;s.skillIds=[e.runeSkill('master').id];
 ally.hp=50;ally.mp=0;ally.speed=2;far.hp=50;far.mp=0;
 e.applySkill(s,s,e.runeSkill('master'));
 for(let i=0;i<479;i++)e.updateBattleRunes();assert.equal(ally.hp,50);assert.equal(ally.mp,0);
 e.updateBattleRunes();assert.equal(ally.hp,52);assert.equal(far.hp,50);
 for(let i=0;i<120;i++)e.updateBattleRunes();assert.equal(ally.mp,20);assert.equal(far.mp,0);assert.equal(ally.speed,4);
 assert.equal(vm.runInContext("combatEventHistory.filter(event=>event.type==='rune_install').length",e),3);
 assert.equal(vm.runInContext("combatEventHistory.filter(event=>event.type==='rune_tick').length",e),3);
 for(let i=0;i<60;i++)e.updateBattleEffects();assert.equal(ally.speed,2);
 assert.equal(e.installed().length,3);
});

test('flame rune remains fixed and continues after the owner dies until battle cleanup',()=>{
 const e=runeEngine(),s=unit(e),enemy=unit(e,'enemy',200);s.magic=100;s.skillIds=[e.runeSkill('master').id];s.skillSelections={[s.skillIds[0]]:['rune_flame','rune_moon','rune_crescent']};enemy.hp=enemy.maxHp=1000;
 e.applySkill(s,s,e.runeSkill('master'));s.hp=0;e.syncAliveState(s);for(let i=0;i<600;i++)e.updateBattleRunes();assert.equal(enemy.hp,970);
 assert.equal(e.installed().length,3);e.clearBattleSummons();assert.equal(e.installed().length,0);
});

test('rune strike advances only its owners runes on actual hits without changing repeat periods',()=>{
 const e=runeEngine(),s=unit(e),other=unit(e),enemy=unit(e,'enemy',105);s.magic=100;enemy.hp=enemy.maxHp=10000;
 for(const owner of [s,other]){owner.skillIds=[e.runeSkill('master').id];e.applySkill(owner,owner,e.runeSkill('master'));}
 const mine=e.installed().filter(r=>r.owner===s),theirs=e.installed().filter(r=>r.owner===other);
 e.applySkill(s,enemy,e.runeSkill('strike'));assert.equal(enemy.hp,9870);assert.equal(mine[0].nextTick,420);assert.equal(theirs[0].nextTick,480);
 mine[0].nextTick=30;e.applySkill(s,enemy,e.runeSkill('strike'));assert.equal(mine[0].nextTick,0);e.updateBattleRunes();assert.equal(mine[0].nextTick,480);
 e.applyTimedEffectAction(enemy,enemy,e.normalizeSkillAction({type:'add_buff',effect:{id:'immune',mode:'damage_immunity'}}));const before=mine[0].nextTick;
 e.applySkill(s,enemy,e.runeSkill('strike'));assert.equal(mine[0].nextTick,before);
});

test('new rune definitions join the registry without class code and pending enemy placement waits for entry',()=>{
 const e=runeEngine(),s=unit(e);s.magic=100;s.skillIds=[e.runeSkill('master').id];
 e.extraRune={id:'new_rune',name:'New',radius:3,interval:2,installationSide:'enemy',color:'#abcdef',effectSkillId:'skill_rune_effect_flame'};
 vm.runInContext('runesJson.push(normalizeRune(extraRune));',e);s.skillSelections={[s.skillIds[0]]:['new_rune','rune_moon','rune_crescent']};
 e.resetBattleRunes();e.applySkill(s,s,e.runeSkill('master'));const rune=e.installed().find(r=>r.definition.id==='new_rune');assert.equal(rune.x,null);
 for(let i=0;i<120;i++)e.updateBattleRunes();assert.equal(rune.nextTick,120);
 const enemy=unit(e,'enemy',300);enemy.hp=enemy.maxHp=1000;e.updateBattleRunes();assert.equal(rune.x,300);
 for(let i=0;i<119;i++)e.updateBattleRunes();assert.equal(enemy.hp,970);
});

function puppetEngine() {
 const e=engine();e.skillsJson=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','skills.json'),'utf8')));
 e.dollEntity=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','entities','puppet_doll.json'),'utf8'));vm.runInContext('entitiesJson.push(dollEntity)',e);
 e.puppet=id=>e.getSkillById('skill_class_puppet_'+id);return e;
}

test('puppet master summons one permanent half-stat melee doll and links actual death to its owner',()=>{
 const e=puppetEngine(),owner=unit(e),enemy=unit(e,'enemy',110);owner.atk=100;owner.magic=80;owner.skillIds=[e.puppet('master').id];
 e.publishBattleEvents([{type:'battle_entry',source:owner,target:owner}]);const doll=e.getLivingOwnedSummons(owner,'puppet_doll')[0];assert.ok(doll);
 assert.equal(doll.atk,50);assert.equal(doll.magic,40);assert.equal(doll.maxHp,50);assert.equal(doll.attackType,'physical');assert.equal(doll.attackRange,1);assert.equal(doll.summonTicks,null);
 e.publishBattleEvents([{type:'battle_entry',source:owner,target:owner}]);assert.equal(e.getLivingOwnedSummons(owner).length,1);
 e.applyActionDamage(enemy,doll,e.normalizeSkillAction({type:'deal_damage',damageType:'fixed',coefficients:[{type:'fixed',value:100}]}));assert.equal(doll.hp,40);assert.equal(owner.alive,true);
 e.applyActionDamage(enemy,doll,e.normalizeSkillAction({type:'deal_damage',damageType:'fixed',coefficients:[{type:'fixed',value:400}]}));assert.equal(doll.alive,false);assert.equal(owner.alive,false);assert.equal(owner.hp,0);
});

test('puppet healing curse tracks actual HP gains and absorbs only other casters healing with thirty second refresh',()=>{
 const e=puppetEngine(),owner=unit(e),other=unit(e),target=unit(e);owner.skillIds=[e.puppet('master').id];target.hp=10;
 const heal={healResource:'HP',coefficients:[{type:'fixed',value:30}]};e.applyActionHeal(owner,target,heal);let curse=target.activeEffects.find(x=>x.mode==='heal_absorb');assert.equal(curse.absorbRemaining,30);assert.equal(target.hp,40);
 e.applyActionHeal(other,target,{...heal,coefficients:[{type:'fixed',value:20}]});assert.equal(target.hp,40);assert.equal(curse.absorbRemaining,10);
 e.applyActionHeal(owner,target,heal);curse=target.activeEffects.find(x=>x.mode==='heal_absorb');assert.equal(target.hp,70);assert.equal(curse.absorbRemaining,40);assert.equal(curse.remainingTicks,1800);
 e.applyActionHeal(other,target,{...heal,coefficients:[{type:'fixed',value:50}]});assert.equal(target.hp,80);assert.equal(target.activeEffects.length,0);
 e.applyActionHeal(owner,target,heal);assert.equal(target.hp,100);assert.equal(target.activeEffects[0].absorbRemaining,20);
 e.applyActionHeal(owner,target,heal);assert.equal(target.activeEffects[0].absorbRemaining,20);
 for(let i=0;i<1800;i++)e.updateBattleEffects();assert.equal(target.activeEffects.length,0);
});

test('puppet command uses doll position and attack power, healing and cursing only allies within five metres',()=>{
 const e=puppetEngine(),owner=unit(e),ally=unit(e,'player',305),far=unit(e,'player',360),enemy=unit(e,'enemy',310);owner.atk=100;owner.skillIds=[e.puppet('master').id];
 e.applySkill(owner,owner,e.puppet('master'));const doll=e.getLivingOwnedSummons(owner)[0];doll.x=300;doll.y=100;ally.hp=10;far.hp=10;enemy.hp=enemy.maxHp=1000;
 assert.equal(e.resolveSkillActionTarget(owner,e.puppet('attack').actions[0],enemy,e.puppet('attack')),enemy);
 e.applySkill(owner,enemy,e.puppet('attack'));assert.equal(enemy.hp,950);assert.equal(ally.hp,60);assert.equal(far.hp,10);assert.equal(ally.activeEffects[0].absorbRemaining,50);
 enemy.x=400;assert.equal(e.resolveSkillActionTarget(owner,e.puppet('attack').actions[0],enemy,e.puppet('attack')),null);
});

test('puppet cursed power heals with attack and selects the higher offensive stat for thirty percent buff',()=>{
 const e=puppetEngine(),owner=unit(e),ally=unit(e,'player',110);owner.atk=40;owner.skillIds=[e.puppet('master').id];ally.hp=10;ally.atk=10;ally.magic=100;
 e.applySkill(owner,ally,e.puppet('heal'));assert.equal(ally.hp,50);assert.equal(ally.atk,10);assert.equal(ally.magic,130);assert.equal(ally.activeEffects.find(x=>x.mode==='heal_absorb').absorbRemaining,40);
 for(let i=0;i<600;i++)e.updateBattleEffects();assert.equal(ally.magic,100);
});

test('puppet cult echoes basic attacks exactly once and heals total actual damage with puppeteer curse',()=>{
 const e=puppetEngine(),owner=unit(e),ally=unit(e,'player',110),enemy=unit(e,'enemy',115);owner.skillIds=[e.puppet('master').id];ally.hp=10;enemy.hp=enemy.maxHp=1000;
 e.applySkill(owner,owner,e.puppet('cult'));const hit=e.normalizeSkillAction({type:'deal_damage',damageType:'fixed',coefficients:[{type:'fixed',value:20}]});
 e.applyActionDamage(ally,enemy,hit,{id:'basic',slot:'basic'});assert.equal(enemy.hp,960);assert.equal(ally.hp,50);assert.equal(ally.activeEffects.find(x=>x.mode==='heal_absorb').absorbRemaining,40);
 e.applyActionDamage(ally,enemy,hit,{id:'active',slot:'active'});assert.equal(enemy.hp,940);assert.equal(ally.hp,70);
 for(let i=0;i<180;i++)e.updateBattleEffects();e.applyActionDamage(ally,enemy,hit,{id:'basic',slot:'basic'});assert.equal(enemy.hp,920);assert.equal(ally.hp,70);
});

test('puppet dance strikes both four metre circles with owners attack power and keeps new data executable',()=>{
 const e=puppetEngine(),owner=unit(e),a=unit(e,'enemy',110),b=unit(e,'enemy',305);owner.atk=100;owner.skillIds=[e.puppet('master').id];
 e.applySkill(owner,owner,e.puppet('master'));const doll=e.getLivingOwnedSummons(owner)[0];doll.x=300;doll.y=100;
 for(const t of [a,b])t.hp=t.maxHp=1000;e.applySkill(owner,a,e.puppet('dance'));assert.equal(a.hp,920);assert.equal(b.hp,920);
 doll.x=110;a.hp=1000;e.applySkill(owner,a,e.puppet('dance'));assert.equal(a.hp,840);
 for(const id of ['master','attack','heal','cult','dance'])assert.equal(e.isSkillExecutable(e.puppet(id)),true,id);
 const chars=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','characters.json'),'utf8'));assert.equal(chars.find(c=>c.skillIds?.includes(e.puppet('master').id)).skillIds.length,5);
});

test('puppet curse dispels independently and never absorbs MP or a full HP alternative barrier',()=>{
 const e=puppetEngine(),owner=unit(e),other=unit(e),target=unit(e);owner.skillIds=[e.puppet('master').id];target.hp=10;
 e.applyActionHeal(owner,target,{healResource:'HP',coefficients:[{type:'fixed',value:20}]});const curse=target.activeEffects[0];
 target.mp=0;e.applyActionHeal(other,target,{healResource:'MP',coefficients:[{type:'fixed',value:10}]});assert.equal(target.mp,10);assert.equal(curse.absorbRemaining,20);
 target.hp=target.maxHp;e.applyActionHeal(other,target,{healResource:'HP',fullResourceAlternative:'BP',coefficients:[{type:'fixed',value:10}]});assert.equal(target.bp,10);assert.equal(curse.absorbRemaining,20);
 e.applyTimedEffectAction(other,target,e.normalizeSkillAction({type:'delete_buff',effect:{id:curse.id,dispelMode:'id'}}));assert.equal(target.activeEffects.length,0);
 e.applySkill(owner,owner,e.puppet('master'));e.clearBattleSummons();assert.equal(owner.alive,true);
});

function assassinEngine(options=[]) {
 const e=engine();e.skillsJson=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'../data/skills.json'),'utf8')));
 const s=unit(e),t=unit(e,'enemy',140);s.atk=100;s.speed=2;s.attackRange=1;s.hp=s.maxHp=1000;s.st=s.maxSt=200;t.hp=t.maxHp=5000;
 const skill=id=>e.getSkillById('skill_class_assassin_'+id);
 s.skillIds=['quick_finish','stealth','rune_blade_ultimate','wound_poison','death_sentence','ambush',...options].map(id=>skill(id).id);
 const runtime=id=>e.getEquippedSkills(s).find(row=>row.id===skill(id).id);
 return {e,s,t,skill,runtime};
}

test('assassin first attack receives quick finish and pays triple ST, then never rearms from expiry alone',()=>{
 const {e,s,t,skill}=assassinEngine(['quicker_finish']);s.skillIds=[skill('quick_finish').id,skill('ambush').id,skill('quicker_finish').id];
 assert.equal(e.getCombatCyclePhase(s),'ready');assert(e.tryUseReadySkill(s,e.playerSquad,e.enemySquad));assert.equal(s.st,170);assert.equal(s.atk,150);assert.equal(s.effectAttackRateMultiplier,1.3);
 for(let i=0;i<18;i++)e.updateCast(s);assert.equal(t.hp,4700);
 for(let i=0;i<600;i++)e.updateBattleEffects();assert.equal(e.getCombatCyclePhase(s),'spent');assert.equal(s.atk,100);
 e.beginCombatCycle(s);assert.equal(s.atk,100);assert.equal(e.getResourceCostAmount(s,{resource:'ST',value:10,mode:'fixed'},100,skill('ambush')),10);
});

test('assassin cannot begin an attack without enough stamina for the first triple cost and incoming hits also engage',()=>{
 const {e,s,t,skill}=assassinEngine();s.skillIds=[skill('quick_finish').id,skill('ambush').id];s.st=20;
 assert.equal(e.tryUseReadySkill(s,e.playerSquad,e.enemySquad),false);assert.equal(e.getCombatCyclePhase(s),'ready');assert.equal(s.atk,100);
 e.applyActionDamage(t,s,{damageType:'fixed',coefficients:[{type:'fixed',value:1}]});assert.equal(e.getCombatCyclePhase(s),'active');assert.equal(s.atk,150);
});

test('assassin stealth resets the cycle, recovers ST while retreating, and reengages after the five-second pause',()=>{
 const {e,s,t,skill}=assassinEngine();e.beginCombatCycle(s);for(let i=0;i<600;i++)e.updateBattleEffects();s.st=40;s.skillIds=[skill('quick_finish').id,skill('stealth').id];
 assert(e.tryUseReadySkill(s,e.playerSquad,e.enemySquad));assert.equal(e.getCombatCyclePhase(s),'ready');assert.equal(s.atk,100);assert.equal(s.speed,1.6);assert(e.hasEvasiveConcealment(s));
 const before=s.x;e.moveUnit(s,[t]);assert(s.x<before);assert.equal(e.tryUseReadySkill(s,e.playerSquad,e.enemySquad),false);
 for(let i=0;i<300;i++)e.updateBattleEffects();assert.equal(s.st,65);assert.equal(s.speed,2);assert.equal(e.hasEvasiveConcealment(s),false);
 s.skillIds=[skill('quick_finish').id,skill('ambush').id];assert(e.tryUseReadySkill(s,e.playerSquad,e.enemySquad));assert.equal(s.atk,150);assert.equal(s.st,35);
});

test('assassin evades already aimed direct casts and flying attacks but still takes area and periodic damage',()=>{
 const {e,s,t,skill}=assassinEngine();s.skillIds=[skill('stealth').id,skill('quick_finish').id];s.combatCycle={phase:'spent',skillId:skill('quick_finish').id};
 const enemyShot=e.normalizeSkillJson([{id:'enemy_shot',name:'enemy',slot:'active',castTime:.5,cooldown:3,actions:[{type:'deal_damage',target:'enemy',rangeMode:'custom',rangeValue:10,damageType:'fixed',coefficients:[{type:'fixed',value:100}]}]}]).find(x=>x.id==='enemy_shot');
 e.startCast(t,{type:'skill',target:s,skill:enemyShot});e.spawnProjectile(t,s,'attack',enemyShot);assert(e.tryUseReadySkill(s,e.playerSquad,e.enemySquad));
 for(let i=0;i<30;i++)e.updateCast(t);e.updateProjectiles();assert.equal(s.hp,1000);assert.equal(t.skillCooldowns.enemy_shot,180);
 e.applyActionDamage(t,s,{area:3,damageType:'fixed',coefficients:[{type:'fixed',value:50}]});assert.equal(s.hp,950);
 e.applyActionDamage(t,s,{periodic:true,damageType:'fixed',coefficients:[{type:'fixed',value:20}]});assert.equal(s.hp,930);
});

test('assassin wound poison and selected sentence effects apply only while equipped and expire',()=>{
 const {e,s,t,runtime}=assassinEngine(['torn_poison','fear_of_execution','quick_steps']);e.recalculateBattleBuffs(s);assert.equal(s.speed,2.4);t.magic=100;t.speed=2;t.attackSpeed=2;
 t.x=110;e.applySkill(s,t,runtime('wound_poison'));assert.equal(t.magic,80);t.hp=1000;e.applyActionHeal(t,t,{healResource:'HP',coefficients:[{type:'fixed',value:100}]});assert.equal(t.hp,1050);
 t.x=110;e.applySkill(s,t,runtime('death_sentence'));assert.equal(t.speed,1.4);assert.equal(t.attackSpeed,2/.8);assert(e.hasBattleState(t,'silence'));
 for(let i=0;i<300;i++){e.updateBattleEffects();e.updateRuntimeRuleOverrides();}assert.equal(t.magic,100);assert.equal(t.speed,2);assert.equal(t.attackSpeed,2);assert.equal(e.getUnitIncomingRulePercent(t,'receivedHealingPercent'),100);
});

test('assassin wound poison is a dispellable harmful poison effect',()=>{
 const {e,s,t,runtime}=assassinEngine(['torn_poison']);t.x=110;t.magic=100;
 e.applySkill(s,t,runtime('wound_poison'));assert.equal(e.getUnitIncomingRulePercent(t,'receivedHealingPercent'),50);
 const cleanse=e.normalizeSkillAction({type:'delete_buff',target:'ally',effect:{dispelMode:'tags',dispelTags:['poison'],dispelPolarity:'harmful'}});
 assert.equal(e.applyTimedEffectAction(t,t,cleanse,{id:'cleanse',name:'cleanse'}),2);
 assert.equal(e.getUnitIncomingRulePercent(t,'receivedHealingPercent'),100);assert.equal(t.magic,100);
});

test('assassin an old outgoing projectile does not break a newly activated stealth or rearm the cycle',()=>{
 const {e,s,t,skill}=assassinEngine();e.spawnProjectile(s,t,'attack',skill('death_sentence'));s.skillIds=[skill('quick_finish').id,skill('stealth').id];s.combatCycle={phase:'spent',skillId:skill('quick_finish').id};
 assert(e.tryUseReadySkill(s,e.playerSquad,e.enemySquad));e.updateProjectiles();assert(e.hasEvasiveConcealment(s));assert.equal(e.getCombatCyclePhase(s),'ready');
});

test('assassin far sight increases ambush range and stuns the struck target',()=>{
 const {e,s,t,skill,runtime}=assassinEngine(['far_sighted']);s.skillIds=[skill('ambush').id,skill('far_sighted').id];t.x=170;
 const ambush=runtime('ambush');assert.equal(ambush.actions[0].rangeValue,8);assert(e.tryUseReadySkill(s,e.playerSquad,e.enemySquad));for(let i=0;i<18;i++)e.updateCast(s);assert.equal(t.hp,4800);assert(e.hasBattleState(t,'stun'));
});

test('assassin rune blade uses final current attack regardless of coefficients armor immunity or damage proxies',()=>{
 const {e,s,t,skill}=assassinEngine();s.skillIds=[skill('rune_blade_ultimate').id];e.applySkill(s,s,skill('rune_blade_ultimate'));t.reviveInvulnerableTicks=100;t.defense=9999;t.runtimeRuleOverrides=[{receivedDamagePercent:0}];
 e.applyTimedEffectAction(t,t,e.normalizeSkillAction({type:'add_buff',duration:10,effect:{id:'immune',mode:'damage_immunity',uses:5}}));
 const protector=unit(e,'enemy',150);protector.hp=protector.maxHp=1000;e.applyTimedEffectAction(protector,t,e.normalizeSkillAction({type:'add_buff',duration:10,effect:{id:'proxy',mode:'damage_proxy',proxyPercent:100,proxyScope:'all'}}));
 e.getReducedDamage=()=>0;t.bp=20;t.maxBp=20;e.applyActionDamage(s,t,{damageType:'physical',coefficients:[{type:'fixed',value:9999}]},{slot:'active'});assert.equal(t.hp,4920);assert.equal(t.bp,0);assert.equal(protector.hp,1000);
});

test('assassin rune blade follows quick-finish attack, lasts ten seconds only with moon, and is once per battle',()=>{
 const {e,s,t,skill,runtime}=assassinEngine(['moon_incarnation']);e.beginCombatCycle(s);const rune=runtime('rune_blade_ultimate');assert.equal(rune.actions[0].duration,10);
 s.skillIds=[skill('quick_finish').id,skill('rune_blade_ultimate').id,skill('moon_incarnation').id];assert(e.tryUseReadySkill(s,e.playerSquad,e.enemySquad));assert.equal(e.canActivateSkill(s,rune),false);
 e.applyActionDamage(s,t,{damageType:'physical',coefficients:[{type:'fixed',value:9999}]},{slot:'active'});assert.equal(t.hp,4850);
 for(let i=0;i<600;i++)e.updateBattleEffects();assert.equal(s.activeEffects.some(x=>x.mode==='priority_attack_damage'),false);
 e.resetUnitForBattle(s);assert.equal(s.skillUseCounts[rune.id],undefined);
});

function fireEngine() {
 const e=engine();e.skillsJson=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','skills.json'),'utf8')));
 e.fire=id=>e.getSkillById('skill_class_fire_'+id);return e;
}

test('fire flame distributes ten percent over five seconds and bursts only the remaining budget on third stack',()=>{
 const e=fireEngine(),s=unit(e),t=unit(e,'enemy',110);s.magic=100;s.skillIds=[e.fire('flame').id];t.hp=t.maxHp=10000;
 e.applySkill(s,t,e.fire('ignite'));let pool=t.activeEffects.find(x=>x.mode==='damage_pool');assert.equal(pool.poolRemaining,12);assert.equal(pool.stacks,1);
 for(let i=0;i<60;i++)e.updateBattleEffects();assert.ok(Math.abs(pool.poolRemaining-9.6)<1e-10);
 e.applySkill(s,t,e.fire('ignite'));pool=t.activeEffects.find(x=>x.mode==='damage_pool');assert.equal(pool.stacks,2);assert.equal(pool.poolRemaining,21.6);
 const before=t.hp;e.applySkill(s,t,e.fire('ignite'));assert.ok(Math.abs(before-t.hp-153.6)<1e-8);
 assert.equal(t.activeEffects.filter(x=>x.mode==='damage_pool').length,0);
 e.applySkill(s,t,e.fire('ignite'));const after=t.hp;for(let i=0;i<300;i++)e.updateBattleEffects();assert.ok(Math.abs(after-t.hp-12)<1e-8);
 assert.equal(t.activeEffects.length,0);
});

test('fire lizard registers its eight second total once and snapshots the caster magic',()=>{
 const e=fireEngine(),s=unit(e),t=unit(e,'enemy',110);s.magic=100;s.skillIds=[e.fire('flame').id];t.hp=t.maxHp=10000;
 e.applySkill(s,t,e.fire('lizard'));const pool=t.activeEffects.find(x=>x.mode==='damage_pool');assert.equal(pool.poolRemaining,20);assert.equal(pool.stacks,1);
 s.magic=1000;for(let i=0;i<480;i++)e.updateBattleEffects();assert.ok(Math.abs(10000-t.hp-220)<1e-7);assert.equal(t.activeEffects.length,0);
});

test('fire flame keeps caster and target pools separate and dispels without bursting',()=>{
 const e=fireEngine(),a=unit(e),b=unit(e),t=unit(e,'enemy',110),other=unit(e,'enemy',120);
 for(const u of [a,b]){u.magic=100;u.skillIds=[e.fire('flame').id];}for(const u of [t,other])u.hp=u.maxHp=10000;
 e.applySkill(a,t,e.fire('ignite'));e.applySkill(b,t,e.fire('ignite'));e.applySkill(a,other,e.fire('ignite'));
 assert.equal(t.activeEffects.length,2);assert.equal(other.activeEffects.length,1);
 const hp=t.hp;e.applyTimedEffectAction(t,t,e.normalizeSkillAction({type:'delete_buff',effect:{id:'fire_flame',dispelMode:'id'}}));assert.equal(t.hp,hp);assert.equal(t.activeEffects.length,0);assert.equal(other.activeEffects.length,1);
});

test('fire flame excludes basic proc periodic reflected and zero damage and counts damage modifiers once',()=>{
 const e=fireEngine(),s=unit(e),t=unit(e,'enemy',110);s.skillIds=[e.fire('flame').id];t.hp=t.maxHp=10000;
 const action=e.normalizeSkillAction({type:'deal_damage',damageType:'fixed',coefficients:[{type:'fixed',value:100}]});
 e.applyActionDamage(s,t,action,{id:'basic',slot:'basic'});
 e.applyActionDamage(s,t,{...action,periodic:true},e.fire('ignite'));
 e.applyActionDamage(s,t,{...action,reflected:true},e.fire('ignite'));
 e.applyActionDamage(s,t,action,{...e.fire('ignite'),triggered:true});
 e.applyActionDamage(s,t,{...action,coefficients:[{type:'fixed',value:0}]},e.fire('ignite'));assert.equal(t.activeEffects.length,0);
 t.runtimeRuleOverrides=[{id:'vulnerable',receivedDamagePercent:200}];e.applyActionDamage(s,t,action,e.fire('ignite'));
 assert.equal(t.activeEffects[0].poolRemaining,20);const hp=t.hp;for(let i=0;i<300;i++)e.updateBattleEffects();assert.ok(Math.abs(hp-t.hp-20)<1e-8);
});

test('fire meditation restores ten percent of current missing mana on each of four pulses and interrupts on damage',()=>{
 const e=fireEngine(),s=unit(e),enemy=unit(e,'enemy',110);s.mp=0;
 const meditation=e.fire('meditation');e.startBattleChannel(s,{type:'skill',target:s,skill:meditation},meditation);
 for(let i=0;i<240;i++)e.updateBattleChannel(s);
 assert.ok(Math.abs(s.mp-34.39)<1e-9);assert.equal(s.channelAction,null);assert.equal(s.skillCooldowns[meditation.id],1200);
 s.mp=0;e.startBattleChannel(s,{type:'skill',target:s,skill:meditation},meditation);for(let i=0;i<60;i++)e.updateBattleChannel(s);assert.equal(s.mp,10);
 e.applyActionDamage(enemy,s,e.normalizeSkillAction({type:'deal_damage',damageType:'fixed',coefficients:[{type:'fixed',value:1}]}));assert.equal(s.channelAction,null);assert.equal(s.mp,10);
});

test('fire revised data normalizes and equips all five skills with burst and zero cooldown attack ahead of fallback',()=>{
 const e=fireEngine();for(const id of ['flame','ignite','lizard','meditation','drunken'])assert.equal(e.isSkillExecutable(e.fire(id)),true,id);
 assert.deepEqual([e.fire('ignite').castTime,e.fire('ignite').cooldown,e.fire('ignite').actions[0].coefficients[0].value],[1.5,0,120]);
 assert.deepEqual([e.fire('drunken').castTime,e.fire('drunken').cooldown,e.fire('drunken').actions[0].coefficients[0].value],[3,12,250]);
 const chars=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','characters.json'),'utf8'));const ids=chars.find(c=>c.skillIds?.includes('skill_class_fire_ignite')).skillIds.filter(id=>e.getSkillById(id)?.slot!=='optional');assert.equal(ids.length,5);assert.equal(ids.at(-1),e.fire('ignite').id);
 const source=unit(e),target=unit(e,'enemy',110);source.skillIds=ids;source.mp=source.maxMp;
 assert.equal(e.tryUseReadySkill(source,[source],[target]),true);assert.equal(source.pendingAction.skill.id,e.fire('lizard').id);
 e.interruptBattleCast(source,'test');source.mp=source.maxMp;source.skillCooldowns[e.fire('lizard').id]=180;
 assert.equal(e.tryUseReadySkill(source,[source],[target]),true);assert.equal(source.pendingAction.skill.id,e.fire('drunken').id);
 e.interruptBattleCast(source,'test');source.mp=source.maxMp;source.skillCooldowns[e.fire('drunken').id]=720;
 assert.equal(e.tryUseReadySkill(source,[source],[target]),true);assert.equal(source.pendingAction.skill.id,e.fire('ignite').id);
});

function selectedFire(options=[]) {
 const e=fireEngine(),s=unit(e),t=unit(e,'enemy',110);s.magic=100;t.hp=t.maxHp=10000;
 s.skillIds=['flame','meditation','lizard','drunken','ignite',...options].map(id=>e.fire(id).id);
 const runtime=id=>e.getEquippedSkills(s).find(row=>row.id===e.fire(id).id);
 return {e,s,t,runtime};
}

test('fire undying embers extends only the flame budget duration without adding any resource cost',()=>{
 const {e,s,t,runtime}=selectedFire(['undying_embers']);assert.equal(runtime('ignite').resourceCosts[0].value,10);assert.equal(runtime('lizard').resourceCosts[0].value,5);
 e.applySkill(s,t,runtime('ignite'));const pool=t.activeEffects.find(x=>x.mode==='damage_pool');assert.equal(pool.remainingTicks,420);assert.equal(pool.poolRemaining,12);
 const hp=t.hp;for(let i=0;i<420;i++)e.updateBattleEffects();assert.ok(Math.abs(hp-t.hp-12)<1e-8);assert.equal(t.activeEffects.length,0);
 s.skillIds=s.skillIds.filter(id=>id!==e.fire('undying_embers').id);e.applySkill(s,t,runtime('ignite'));assert.equal(t.activeEffects[0].remainingTicks,300);
});

test('fire parent lizards cost fifteen MP and create two snapshot effects but only one summed flame stack',()=>{
 const {e,s,t,runtime}=selectedFire(['parent_lizards']);const lizard=runtime('lizard');assert.equal(lizard.resourceCosts[0].value,15);assert.equal(lizard.actions[0].periodicCopies,2);
 s.skillIds=[e.fire('flame').id,e.fire('lizard').id,e.fire('parent_lizards').id];assert(e.tryUseReadySkill(s,e.playerSquad,e.enemySquad));assert.equal(s.mp,85);for(let i=0;i<120;i++)e.updateCast(s);
 const dots=t.activeEffects.filter(x=>x.periodic?.type==='damage'),pool=t.activeEffects.find(x=>x.mode==='damage_pool');assert.equal(dots.length,2);assert.equal(pool.stacks,1);assert.equal(pool.poolRemaining,40);assert(dots.every(x=>x.periodic.interval===2));
 s.magic=1000;for(let i=0;i<480;i++)e.updateBattleEffects();assert.ok(Math.abs(10000-t.hp-440)<1e-7);assert.equal(t.activeEffects.length,0);
});

test('fire parent lizard reapplication refreshes the pair and bursts once on the third cast',()=>{
 const {e,s,t,runtime}=selectedFire(['parent_lizards']);const lizard=runtime('lizard');
 e.applySkill(s,t,lizard);e.applySkill(s,t,lizard);assert.equal(t.activeEffects.filter(x=>x.periodic?.type==='damage').length,2);assert.equal(t.activeEffects.find(x=>x.mode==='damage_pool').stacks,2);
 const before=t.hp;e.applySkill(s,t,lizard);assert.equal(before-t.hp,120);assert.equal(t.activeEffects.some(x=>x.mode==='damage_pool'),false);assert.equal(t.activeEffects.filter(x=>x.periodic?.type==='damage').length,2);
 e.applyTimedEffectAction(s,t,e.normalizeSkillAction({type:'delete_state',effect:{id:'fire_lizard__copy_2',dispelMode:'id'}}));assert.equal(t.activeEffects.filter(x=>x.periodic?.type==='damage').length,1);
});

test('fire explosive ignite copies thirty percent within three metres and adds independent flame budgets',()=>{
 const {e,s,t,runtime}=selectedFire(['explosive_ignite']);const near=unit(e,'enemy',139),far=unit(e,'enemy',141);near.hp=far.hp=near.maxHp=far.maxHp=10000;
 e.applySkill(s,t,runtime('ignite'));assert.equal(t.hp,9880);assert.equal(near.hp,9964);assert.equal(far.hp,10000);assert.equal(t.activeEffects[0].poolRemaining,12);assert.ok(Math.abs(near.activeEffects[0].poolRemaining-3.6)<1e-9);
});

test('fire clarity grants five intelligence and silence immunity only while selected and never accumulates',()=>{
 const {e,s,t}=selectedFire(['clarity']);s.attributes={str:5,int:5};const baseMagic=s.magic,baseMp=s.maxMp;e.recalculateBattleBuffs(s);assert.equal(s.attributes.int,10);assert(s.magic>baseMagic);assert(s.maxMp>baseMp);
 const magic=s.magic,mp=s.maxMp;for(let i=0;i<5;i++)e.recalculateBattleBuffs(s);assert.equal(s.attributes.int,10);assert.equal(s.magic,magic);assert.equal(s.maxMp,mp);
 const silence=e.normalizeSkillAction({type:'add_state',duration:2,effect:{id:'test_silence',name:'silence',state:'silence',category:'magic'}});e.applyTimedEffectAction(t,s,silence);assert.equal(e.hasBattleState(s,'silence'),false);
 e.applyTimedEffectAction(t,s,e.normalizeSkillAction({type:'add_state',duration:2,effect:{id:'test_root',state:'root'}}));assert(e.hasBattleState(s,'root'));
 s.skillIds=s.skillIds.filter(id=>id!==e.fire('clarity').id);e.recalculateBattleBuffs(s);assert.equal(s.attributes.int,5);assert.equal(s.magic,baseMagic);assert.equal(s.maxMp,baseMp);e.applyTimedEffectAction(t,s,silence);assert(e.hasBattleState(s,'silence'));
});

test('fire quick meditation channels three free thirteen-percent pulses and preserves damage interruption',()=>{
 const {e,s,t,runtime}=selectedFire(['quick_meditation']);const meditation=runtime('meditation');assert.equal(meditation.channel.duration,3);assert.equal(meditation.actions[0].coefficients[0].value,13);assert.equal(meditation.resourceCosts[0].value,0);
 s.mp=0;s.skillIds=[meditation.id,e.fire('quick_meditation').id];const st=s.st;assert(e.tryUseReadySkill(s,e.playerSquad,e.enemySquad));assert.equal(s.st,st);
 for(let i=0;i<180;i++)e.updateBattleChannel(s);assert.ok(Math.abs(s.mp-34.1497)<1e-8);assert.equal(s.channelAction,null);assert.equal(s.skillCooldowns[meditation.id],1200);
});

test('fire explosion maniac permits one additional normal cast before the twelve-second cooldown',()=>{
 const {e,s,t,runtime}=selectedFire(['explosion_maniac']);s.skillIds=[e.fire('drunken').id,e.fire('explosion_maniac').id];
 for(let cast=0;cast<2;cast++) {assert(e.tryUseReadySkill(s,e.playerSquad,e.enemySquad));assert.equal(s.castTimer,180);for(let i=0;i<180;i++)e.updateCast(s);assert.equal(s.skillCooldowns[e.fire('drunken').id],cast===0?0:720);}
 assert.equal(s.mp,80);assert.equal(e.tryUseReadySkill(s,e.playerSquad,e.enemySquad),false);assert.equal(t.hp,9500);
});

function sniperEngine() {
 const e=engine();e.skillsJson=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','skills.json'),'utf8')));
 e.sniper=name=>e.getSkillById('skill_class_sniper_'+name);return e;
}

test('sniper solitude checks both sides at five metres including summons and ignores waiting or dead units',()=>{
 const e=sniperEngine(),s=unit(e),other=unit(e,'enemy',151);s.atk=100;s.skillIds=[e.sniper('solitude').id];
 e.updateBattleEffects();assert.equal(s.atk,120);
 other.x=150;e.updateBattleEffects();assert.equal(s.atk,100);assert.equal(e.getUnitIncomingRulePercent(s,'receivedDamagePercent'),100);
 assert.equal(s.runtimeRuleOverrides.length,0);
 other.side='player';other.isSummon=true;e.updateBattleEffects();assert.equal(s.atk,100);
 other.isWaiting=true;e.updateBattleEffects();assert.equal(s.atk,120);
 other.isWaiting=false;other.alive=false;e.updateBattleEffects();assert.equal(s.atk,120);
 for(let i=0;i<120;i++)e.updateRuntimeRuleOverrides();assert.equal(e.getUnitIncomingRulePercent(s,'receivedDamagePercent'),100);
 e.applyTimedEffectAction(other,s,e.normalizeSkillAction({type:'delete_buff',effect:{id:'sniper_solitude',dispelMode:'id'}}));
 e.updateBattleEffects();assert.equal(e.getUnitIncomingRulePercent(s,'receivedDamagePercent'),100);assert.equal(s.atk,120);
});

test('sniper shadow triggers at thirty percent and ends concealment and speed when attacking',()=>{
 const e=sniperEngine(),s=unit(e),enemy=unit(e,'enemy',110);s.speed=2;s.skillIds=[e.sniper('shadow').id];
 s.hp=31;assert.equal(e.tryUseReadySkill(s,[s],[enemy]),false);
 s.hp=30;assert.equal(e.tryUseReadySkill(s,[s],[enemy]),true);
 assert.equal(e.canDirectlyTarget(enemy,s),false);assert.equal(s.speed,2.6);
 assert.equal(s.skillCooldowns[e.sniper('shadow').id],1800);
 e.breakAttackConcealment(s,e.sniper('mode'));assert.equal(e.canDirectlyTarget(enemy,s),false);
 e.breakAttackConcealment(s,e.sniper('shot'));assert.equal(e.canDirectlyTarget(enemy,s),true);assert.equal(s.speed,2);
});

test('sniper camouflage expires after five seconds without changing portraits',()=>{
 const e=sniperEngine(),s=unit(e),enemy=unit(e,'enemy',110);s.hp=30;s.portrait='original';s.speed=2;
 e.applySkill(s,s,e.sniper('shadow'));assert.equal(s.portrait,'original');
 for(let i=0;i<300;i++)e.updateBattleEffects();assert.equal(e.canDirectlyTarget(enemy,s),true);assert.equal(s.speed,2);
});

test('sniper focus grants flat range and cast reduction and survives actual or periodic damage',()=>{
 for(const periodic of [false,true]) {
  const e=sniperEngine(),s=unit(e),enemy=unit(e,'enemy',110);s.atk=100;s.bp=50;
  e.applySkill(s,s,e.sniper('mode'));assert.equal(s.atk,100);assert.equal(s.attackRange,8);assert.equal(s.effectCastTimeAdd,-.5);
  s.castTimer=100;s.pendingAction={type:'skill',skill:e.sniper('shot'),target:enemy};
  e.applyActionDamage(enemy,s,{damageType:'fixed',coefficients:[{type:'fixed',value:10}],periodic});
  assert.equal(s.bp,40);assert.equal(s.attackRange,8);assert.equal(e.hasBattleState(s,'stun'),false);assert.equal(s.castTimer,100);
  assert.equal(e.resolveSkillTarget(s,e.sniper('mode'),[s],[enemy]),null);
 }
});

test('sniper revised skills remain executable after normalization',()=>{
 const e=sniperEngine();for(const name of ['solitude','shadow','shot','mode','falcon'])assert.equal(e.isSkillExecutable(e.sniper(name)),true,name);
 assert.equal(e.sniper('shot').cooldown,5);assert.equal(e.sniper('mode').actions[0].transform.damageExitStun,0);
 const shadow=e.sniper('shadow');assert.equal(shadow.actions[0].effect.breakOnAttack,true);
});

test('sniper shot compares start and completion target positions and freezes the bonus before projectile impact',()=>{
 for(const [movement,expected] of [['none',240],['move',200],['return',240]]) {
  const e=sniperEngine(),s=unit(e),target=unit(e,'enemy',130);s.atk=100;s.skillIds=[e.sniper('shot').id];target.hp=target.maxHp=2000;
  assert(e.tryUseReadySkill(s,e.playerSquad,e.enemySquad));assert.equal(s.st,90);assert.equal(s.castTimer,90);
  target.x=140;if(movement!=='move')target.x=130;
  for(let i=0;i<90;i++)e.updateCast(s);
  target.x=150;for(let i=0;i<30;i++)e.updateProjectiles();
  assert.equal(2000-target.hp,expected,movement);assert.equal(s.skillCooldowns[e.sniper('shot').id],300);
 }
 const e=sniperEngine(),s=unit(e),target=unit(e,'enemy',130);s.atk=100;s.skillIds=[e.sniper('shot').id,e.sniper('headshot').id];target.hp=target.maxHp=2000;
 assert(e.tryUseReadySkill(s,e.playerSquad,e.enemySquad));for(let i=0;i<90;i++)e.updateCast(s);for(let i=0;i<30;i++)e.updateProjectiles();assert.equal(target.hp,1740);
});

test('sniper stationary bonus is never transferred to a replacement target',()=>{
 const e=sniperEngine(),s=unit(e),target=unit(e,'enemy',110),replacement=unit(e,'enemy',120);s.atk=100;s.skillIds=[e.sniper('shot').id];replacement.hp=replacement.maxHp=2000;
 assert(e.tryUseReadySkill(s,e.playerSquad,e.enemySquad));target.alive=false;target.hp=0;
 for(let i=0;i<90;i++)e.updateCast(s);for(let i=0;i<30;i++)e.updateProjectiles();assert.equal(replacement.hp,1800);
});

test('sniper falcon interrupts casts every three seconds with six pulses and expires at twenty seconds',()=>{
 const e=sniperEngine(),s=unit(e),target=unit(e,'enemy',110);e.applySkill(s,target,e.sniper('falcon'));
 for(let pulse=0;pulse<6;pulse++) {
  target.castTimer=1000;target.castDuration=1000;target.pendingAction={type:'skill',skill:e.sniper('shot'),target:s};
  target.weaponAttackStates=[{weapon:{},castTimer:100,target:s}];
  for(let i=0;i<179;i++)e.updateBattleEffects();assert.equal(target.castTimer,1000);
  e.updateBattleEffects();assert.equal(target.castTimer,0);assert.equal(target.weaponAttackStates[0].castTimer,0);assert.equal(e.hasBattleState(target,'stun'),false);
 }
 target.castTimer=1000;target.pendingAction={type:'skill',skill:e.sniper('shot'),target:s};
 for(let i=0;i<120;i++)e.updateBattleEffects();assert.equal(target.activeEffects.some(x=>x.id==='sniper_falcon'),false);assert.equal(target.castTimer,1000);assert.equal(target.hp,100);
});

test('sniper falcon friend permits exactly two casts before cooldown and interruption resets the pair',()=>{
 const e=sniperEngine(),s=unit(e),target=unit(e,'enemy',110);s.skillIds=[e.sniper('falcon').id,e.sniper('falcon_friend').id];
 for(let cast=0;cast<2;cast++) {
  assert(e.tryUseReadySkill(s,e.playerSquad,e.enemySquad));assert.equal(s.castTimer,30);
  for(let i=0;i<30;i++)e.updateCast(s);assert.equal(s.skillCooldowns[e.sniper('falcon').id],cast===0?0:1200);
 }
 assert.equal(target.activeEffects.filter(x=>x.id==='sniper_falcon').length,1);assert.equal(e.tryUseReadySkill(s,e.playerSquad,e.enemySquad),false);
 s.skillCooldowns[e.sniper('falcon').id]=0;assert(e.tryUseReadySkill(s,e.playerSquad,e.enemySquad));for(let i=0;i<30;i++)e.updateCast(s);
 assert(e.tryUseReadySkill(s,e.playerSquad,e.enemySquad));e.interruptBattleCast(s);assert.equal(s.skillConsecutiveUses[e.sniper('falcon').id],0);assert.equal(s.skillCooldowns[e.sniper('falcon').id],1200);
});

test('sniper focus reduces all casts and selected comfort heals current maximum HP each second',()=>{
 const e=sniperEngine(),s=unit(e),target=unit(e,'enemy',110);s.skillIds=['mode','comfort','durability','shot'].map(id=>e.sniper(id).id);e.recalculateBattleBuffs(s);assert.equal(s.maxHp,600);assert.equal(s.resistance,5);
 s.hp=300;const mode=e.getEquippedSkills(s).find(x=>x.id===e.sniper('mode').id);e.applySkill(s,s,mode);
 for(let i=0;i<59;i++)e.updateBattleEffects();assert.equal(s.hp,300);e.updateBattleEffects();assert.equal(s.hp,312);
 e.startCast(s,{type:'skill',skill:e.sniper('shot'),target});assert.equal(s.castTimer,60);e.interruptBattleCast(s);
 e.startCast(s,{type:'attack',skill:{...e.sniper('shot'),castTime:.2},target});assert.equal(s.castTimer,0);
 e.clearBattleEffects(s);const hp=s.hp;for(let i=0;i<60;i++)e.updateBattleEffects();assert.equal(s.hp,hp);
});

test('sniper siege bonus requires focus and includes exactly five metres',()=>{
 const e=sniperEngine(),s=unit(e),target=unit(e,'enemy',150);s.atk=100;target.hp=target.maxHp=2000;s.skillIds=['mode','siege_expert'].map(id=>e.sniper(id).id);
 const hit=e.sniper('shot').actions[0];e.applyActionDamage(s,target,hit);assert.equal(target.hp,1800);
 e.applySkill(s,s,e.getEquippedSkills(s).find(x=>x.id===e.sniper('mode').id));e.applyActionDamage(s,target,hit);assert.equal(target.hp,1560);
 target.x=149.99;e.applyActionDamage(s,target,hit);assert.equal(target.hp,1360);
 target.x=150;e.applyActionDamage(s,target,{...hit,periodic:true});assert.equal(target.hp,1160);
});

test('sniper focus extends each independent weapon range and shortens their casts',()=>{
 const e=sniperEngine(),s=unit(e),target=unit(e,'enemy',180);
 s.weaponAttacks=[{weaponCategory:'crossbow',attackRange:5,castSpeed:.8,attackSpeed:2,attackType:'physical'},
  {weaponCategory:'crossbow',attackRange:5,castSpeed:.8,attackSpeed:2,attackType:'physical'}];e.resetUnitForBattle(s);
 e.applySkill(s,s,e.sniper('mode'));e.updateIndependentWeaponAttacks(s,[target]);
 for(const state of s.weaponAttackStates){assert.equal(state.castTimer,18);assert.equal(e.getIndependentWeaponRange(s,state.weapon),8);assert.equal(e.getIndependentWeaponSkill(s,state.weapon,target).actions[0].rangeValue,8);}
});

test('sniper optional stats require selected slots and crossbow equipment without stacking across weapons',()=>{
 const e=sniperEngine(),s=unit(e);s.atk=100;s.skillIds=['crossbow_expert','durability'].map(id=>e.sniper(id).id);
 s.weaponAttacks=[{weaponCategory:'crossbow'},{weaponCategory:'crossbow'}];e.recalculateBattleBuffs(s);assert.equal(s.atk,140);assert.equal(s.maxHp,600);
 for(let i=0;i<3;i++)e.recalculateBattleBuffs(s);assert.equal(s.atk,140);assert.equal(s.maxHp,600);
 s.hp=300;const loadout={maxHp:200,maxMp:100,maxSt:100,baseBp:0,atk:20,magic:20,speed:1,attackSpeed:1,castSpeed:1,defense:0,resistance:0,attackRange:5,weaponAttacks:[{weaponCategory:'bow'}],attributes:{}};
 e.applyBattleEquipmentLoadout(s,loadout,0);assert.equal(s.atk,20);assert.equal(s.maxHp,700);assert.equal(s.hp,300);assert.equal(s.resistance,5);
 s.skillIds=['headshot','siege_expert','comfort','crossbow_expert'].map(id=>e.sniper(id).id);s.weaponAttacks=[{weaponCategory:'crossbow'}];e.recalculateBattleBuffs(s);assert.equal(s.atk,20);assert.equal(s.maxHp,200);assert.equal(s.resistance,0);
});

function asceticEngine() {
  const e=engine();e.skillsJson=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','skills.json'),'utf8')));
  e.ascetic=id=>e.getSkillById('skill_class_ascetic_'+id);
  return e;
}

test('ascetic chain stacks attack power and exact attack rate, granting movement only at ten', () => {
  const e=asceticEngine(),source=unit(e),target=unit(e,'enemy',105);
  source.atk=100;source.attackSpeed=2;source.speed=1.2;source.skillIds=[e.ascetic('chain').id];target.hp=target.maxHp=10000;
  const hit=e.normalizeSkillAction({type:'deal_damage',damageType:'fixed',coefficients:[{type:'fixed',value:1}]});
  for(let i=1;i<=9;i++) {
    e.applyActionDamage(source,target,hit);
    assert.equal(source.activeEffects.length,1);assert.equal(source.activeEffects[0].stacks,i);
    assert.equal(source.atk,100+i);assert.ok(Math.abs(source.attackSpeed-2/(1+i*.02))<1e-12);assert.equal(source.speed,1.2);
  }
  e.applyActionDamage(source,target,hit);
  assert.equal(source.atk,110);assert.ok(Math.abs(source.attackSpeed-2/1.2)<1e-12);
  assert.ok(Math.abs(source.speed-1.44)<1e-12);assert.equal(source.effectAttackRateMultiplier,1.2);
  for(let i=0;i<5;i++)e.applyActionDamage(source,target,hit);
  assert.equal(source.activeEffects[0].stacks,10);assert.equal(source.atk,110);
});

test('ascetic chain refreshes at the cap and restores every stat on five second timeout or dispel', () => {
  const e=asceticEngine(),source=unit(e),target=unit(e,'enemy',105);
  source.atk=100;source.speed=2;source.attackSpeed=2;source.skillIds=[e.ascetic('chain').id];target.hp=target.maxHp=10000;
  const hit=e.normalizeSkillAction({type:'deal_damage',damageType:'fixed',coefficients:[{type:'fixed',value:1}]});
  for(let i=0;i<10;i++)e.applyActionDamage(source,target,hit);
  for(let i=0;i<299;i++)e.updateBattleEffects();assert.equal(source.activeEffects[0].remainingTicks,1);
  e.applyActionDamage(source,target,hit);assert.equal(source.activeEffects[0].remainingTicks,300);
  for(let i=0;i<299;i++)e.updateBattleEffects();assert.equal(source.activeEffects.length,1);
  e.updateBattleEffects();assert.equal(source.activeEffects.length,0);assert.equal(source.atk,100);assert.equal(source.speed,2);assert.equal(source.attackSpeed,2);assert.equal(source.effectAttackRateMultiplier,1);
  for(let i=0;i<10;i++)e.applyActionDamage(source,target,hit);
  e.applyTimedEffectAction(target,source,e.normalizeSkillAction({type:'delete_buff',effect:{id:'ascetic_chain',dispelMode:'id'}}));
  assert.equal(source.activeEffects.length,0);assert.equal(source.atk,100);assert.equal(source.speed,2);assert.equal(source.attackSpeed,2);
  e.applyActionDamage(source,target,hit);assert.equal(source.activeEffects[0].stacks,1);assert.equal(source.speed,2);
});

test('ascetic chain excludes periodic reflected triggered and zero damage hits but accepts basic and active hits', () => {
  const e=asceticEngine(),source=unit(e),target=unit(e,'enemy',105);
  source.skillIds=[e.ascetic('chain').id];target.hp=target.maxHp=10000;
  const hit=e.normalizeSkillAction({type:'deal_damage',damageType:'fixed',coefficients:[{type:'fixed',value:1}]});
  e.applyActionDamage(source,target,{...hit,periodic:true});
  e.applyActionDamage(source,target,{...hit,reflected:true},{id:'reflection',triggered:true});
  e.applyActionDamage(source,target,hit,{id:'proc',slot:'passive',triggered:true});
  e.applyActionDamage(source,target,{...hit,coefficients:[{type:'fixed',value:0}]});
  assert.equal(source.activeEffects.length,0);
  e.applyActionDamage(source,target,hit,{id:'basic',slot:'basic'});
  e.applyActionDamage(source,target,hit,{id:'active',slot:'active'});
  assert.equal(source.activeEffects[0].stacks,2);
  source.hp=0;e.syncAliveState(source);e.updateBattleEffects();assert.equal(source.activeEffects.length,0);assert.equal(source.effectAttackRateMultiplier,1);
});

test('ascetic attack rate applies to independent weapons without double counting the unit interval', () => {
  const e=asceticEngine(),source=unit(e),target=unit(e,'enemy',105);
  source.attackSpeed=2;source.speed=1;target.hp=target.maxHp=10000;
  const passive=e.ascetic('chain');for(let i=0;i<10;i++)e.applySkill(source,source,passive);
  const weapon={attackType:'physical',attackRange:1,castSpeed:0,attackSkillId:''};
  source.weaponAttackStates=[{weapon:{...weapon,attackSpeed:1.2},cooldown:0,castTimer:0},{weapon:{...weapon,attackSpeed:2.4},cooldown:0,castTimer:0}];
  e.updateIndependentWeaponAttacks(source,[target]);
  assert.equal(source.weaponAttackStates[0].cooldown,60);assert.equal(source.weaponAttackStates[1].cooldown,120);
  assert.ok(Math.abs(source.attackSpeed-2/1.2)<1e-12);
});

test('ascetic exorcism executes physical magic physical with per-stage resources and chain growth', () => {
  const e=asceticEngine(),source=unit(e),target=unit(e,'enemy',105);
  source.atk=100;source.magic=80;source.attackSpeed=2;source.castSpeed=0;source.skillIds=[e.ascetic('chain').id,e.ascetic('exorcism').id];
  target.hp=target.maxHp=5000;
  const combo=e.ascetic('exorcism');
  assert.ok(e.tryUseReadySkill(source,[source],[target]));assert.equal(target.hp,4880);
  assert.equal(source.skillCooldowns[combo.id],30);assert.equal(source.skillComboStages[combo.id],1);
  for(let i=0;i<30;i++)e.tickSkillCooldowns(source);
  assert.ok(e.tryUseReadySkill(source,[source],[target]));assert.equal(target.hp,4760);assert.equal(source.skillComboStages[combo.id],2);
  for(let i=0;i<30;i++)e.tickSkillCooldowns(source);
  assert.ok(e.tryUseReadySkill(source,[source],[target]));assert.ok(Math.abs(target.hp-(4760-102*1.7))<1e-9);
  assert.equal(source.skillCooldowns[combo.id],480);assert.equal(source.skillComboStages[combo.id],0);
  assert.equal(source.st,70);assert.equal(source.mp,70);assert.equal(source.activeEffects[0].stacks,3);
  assert.deepEqual(Array.from(e.getBattleEvents('hit'),event=>event.damageType),['physical','magic','physical']);
  assert.equal(e.tryUseReadySkill(source,[source],[target]),false);
  e.isMagicAttackUnit=()=>false;
  e.isPhysicalAttackUnit=()=>true;
  const hp=target.hp;e.takeAction(source,[source],[target]);
  for(let i=0;i<120 && source.pendingAction;i++)e.updateCast(source);
  e.updateProjectiles();
  assert.ok(target.hp<hp);
});

test('ascetic resource failure preserves combo stage and malformed stack bonuses stay unsupported', () => {
  const e=asceticEngine(),source=unit(e),target=unit(e,'enemy',105);source.skillIds=[e.ascetic('exorcism').id];source.st=9;
  assert.equal(e.tryUseReadySkill(source,[source],[target]),false);assert.equal(source.mp,100);assert.equal(source.st,9);assert.equal(source.skillComboStages[e.ascetic('exorcism').id],undefined);
  const original=e.ascetic('chain').actions[0];
  for(const bonus of [{stat:'speed',mode:'attack_rate_percent',value:2,minStacks:1},{stat:'speed',mode:'percent',value:20,minStacks:0},{stat:'speed',mode:'percent',value:20,minStacks:2.5}]) {
    const action={...original,effect:{...original.effect,stackBonuses:[bonus]}};
    assert.equal(e.isSkillActionSupported(action),false);
  }
  const standalone=e.normalizeSkillAction({type:'add_buff',target:'self',effect:{id:'rate',name:'rate',stat:'attackSpeed',mode:'attack_rate_percent',value:20}});
  source.attackSpeed=2;e.applyTimedEffectAction(source,source,standalone);assert.ok(Math.abs(source.attackSpeed-2/1.2)<1e-12);
  const copy=e.normalizeSkillJson(JSON.parse(JSON.stringify([e.ascetic('chain'),e.ascetic('exorcism')])));
  assert.equal(copy.find(s=>s.id===e.ascetic('chain').id).actions[0].effect.stackBonuses[1].minStacks,10);
  const character=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','characters.json'),'utf8')).find(c=>c.name==='수도승');
  assert.ok(character.skillIds.includes(e.ascetic('chain').id));assert.ok(character.skillIds.includes(e.ascetic('exorcism').id));
});

function starEngine() {
  const e=engine();e.skillsJson=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','skills.json'),'utf8')));
  e.starEntity=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','entities/star_companion.json'),'utf8'));
  vm.runInContext('entitiesJson.push(starEntity)',e);
  e.star=id=>e.getSkillById('skill_class_star_'+id);
  return e;
}

function starBuild(options=[]) {
 const e=starEngine(),s=e.owner=unit(e),t=e.target=unit(e,'enemy',130);s.magic=100;s.hp=s.maxHp=2000;t.hp=t.maxHp=10000;t.resistance=40;
 s.skillIds=['companion','relocate','interstellar','radiance','absorb','another_star_ultimate',...options].map(id=>e.star(id).id);
 e.runtime=id=>e.getRuntimeSelectionSkill(s,e.star(id));
 e.publishBattleEvents([{type:'battle_entry',source:s,target:s}]);s.summons[0].x=100;s.summons[0].y=100;
 e.cast=(id,target=t)=>{const skill=e.runtime(id),resourceSpent=e.spendSkillResourceCosts(s,skill);e.startCast(s,{type:'skill',skill,target,resourceSpent});return skill;};
 e.tick=()=>{e.updateBattleFields();e.updateBattleEffects();e.updateSummonLifetimes();e.tickSkillCooldowns(s);};
 return e;
}

test('star gamma ray raises only radiance floor and light distance doubles weapon range without area expansion',()=>{
 const e=starBuild(['gamma_ray','light_distance']),s=e.owner,t=e.target;t.x=900;
 e.applySkill(s,t,e.runtime('radiance'));assert.equal(t.hp,9950);
 for(const id of ['relocate','interstellar','radiance','absorb','another_star_ultimate'])for(const action of e.runtime(id).actions) assert.equal(e.getActionRangePixels(s,action),100);
 assert.equal(e.runtime('radiance').actions[0].battlefieldArea,true);assert.equal(e.runtime('companion').actions[1].fieldRadius,3);
 s.skillIds=s.skillIds.filter(id=>id!==e.star('gamma_ray').id);e.applySkill(s,t,e.runtime('radiance'));assert.equal(t.hp,9940);
});

test('star light speed compresses five tether ticks into one second and stops tracking hidden stars',()=>{
 const e=starBuild(['light_speed']),s=e.owner,t=e.target;s.summons[0].x=160;t.x=130;
 e.cast('interstellar');for(let i=0;i<11;i++)e.tick();assert.equal(t.hp,10000);e.tick();assert.equal(t.hp,9950);
 for(let i=0;i<48;i++)e.tick();assert.equal(t.hp,9750);
 assert.equal(vm.runInContext('battleFields.filter(f=>f.action.fieldShape==="line").length',e),0);
});

test('star neutron collapse follows summoner deals five pulses and pays actual damage despite starforce',()=>{
 const e=starBuild(['neutron_star']),s=e.owner,t=e.target,a=unit(e,'enemy',140);a.hp=a.maxHp=1000;
 e.cast('absorb',s);assert.equal(s.mp,70);assert.equal(e.getLivingOwnedSummons(s).length,0);
 for(let i=0;i<60;i++)e.tick();assert.equal(t.hp,9950);assert.equal(a.hp,950);assert.equal(s.hp,1975);
 s.x=t.x=a.x=500;for(let i=0;i<240;i++)e.tick();assert.equal(t.hp,9750);assert.equal(a.hp,750);assert.equal(s.hp,1875);assert.equal(e.getLivingOwnedSummons(s).length,1);
});

test('star neutron collapse stops on dispel has no cost on immune targets and can kill its caster',()=>{
 const e=starBuild(['neutron_star']),s=e.owner,t=e.target;e.cast('absorb',s);
 e.applyTimedEffectAction(t,t,e.normalizeSkillAction({type:'add_buff',duration:10,effect:{id:'immune',mode:'damage_immunity',uses:0,consumePeriodic:true}}));
 for(let i=0;i<60;i++)e.tick();assert.equal(s.hp,2000);assert.equal(t.hp,10000);
 e.clearBattleEffects(t);s.hp=1;for(let i=0;i<60;i++)e.tick();assert.equal(s.alive,false);assert.equal(e.getLivingOwnedSummons(s).length,0);
 const f=starBuild(['neutron_star']);f.cast('absorb',f.owner);f.applyTimedEffectAction(f.target,f.owner,f.normalizeSkillAction({type:'delete_buff',effect:{id:'star_force',dispelMode:'id'}}));
 for(let i=0;i<60;i++)f.tick();assert.equal(f.target.hp,10000);assert.equal(f.owner.hp,2000);
});

test('star ultimate resets skills creates one temporary star and waives only MP for six seconds',()=>{
 const e=starBuild(['weak_gravity']),s=e.owner,t=e.target,id=e.star('another_star_ultimate').id;
 vm.runInContext('combatEventTick=1799',e);assert.equal(e.canActivateSkill(s,e.runtime('another_star_ultimate')),false);vm.runInContext('combatEventTick=1800',e);
 s.skillCooldowns[e.star('relocate').id]=180;s.skillComboStages.example=2;e.cast('another_star_ultimate',s);
 assert.equal(e.getLivingOwnedSummons(s).length,2);assert.equal(s.skillCooldowns[e.star('relocate').id] ?? 0,0);assert.equal(Object.keys(s.skillComboStages).length,0);
 assert.equal(e.canActivateSkill(s,e.runtime('another_star_ultimate')),false);
 for(const star of s.summons){star.x=120;star.y=100;}e.refreshTrackedBattleFields();assert.equal(t.resistance,20);
 s.mp=0;assert.equal(e.canPaySkillResourceCosts(s,e.runtime('absorb')),true);assert.equal(e.runtime('absorb').resourceCosts[0].value,0);
 const mixed=e.getRuntimeSelectionSkill(s,e.normalizeSkillJson([{id:'mixed',name:'mixed',actions:[{type:'deal_damage',coefficients:[{type:'fixed',value:1}]}],resourceCosts:[{resource:'MP',value:10},{resource:'ST',value:3}]}]).find(x=>x.id==='mixed'));
 assert.deepEqual(Array.from(mixed.resourceCosts,c=>[c.resource,c.value]),[['MP',0],['ST',3]]);
 for(let i=0;i<360;i++)e.tick();assert.equal(e.getLivingOwnedSummons(s).length,1);assert.equal(e.runtime('absorb').resourceCosts[0].value,30);
});

test('star dust cloud completes thirty seconds after ultimate with one permanent aura and gravity per star',()=>{
 const e=starBuild(['weak_gravity','dust_cloud']),s=e.owner,t=e.target;e.cast('another_star_ultimate',s);
 for(let i=0;i<1799;i++)e.tick();assert.equal(e.getLivingOwnedSummons(s).length,1);e.tick();assert.equal(e.getLivingOwnedSummons(s).length,2);
 assert.equal(s.summons.filter(x=>x.alive && !x.removed && x.summonTicks===null).length,2);
 for(const star of e.getLivingOwnedSummons(s)){star.x=120;star.y=100;}e.refreshTrackedBattleFields();assert.equal(t.resistance,20);
 const fields=vm.runInContext('battleFields.filter(f=>f.anchor?.alive && !f.anchor.removed)',e);assert.equal(fields.filter(f=>f.action.fieldEffect==='none').length,2);assert.equal(fields.filter(f=>f.action.fieldEffect==='drain_resource').length,2);
 for(let i=0;i<360;i++)e.tick();assert.equal(e.getLivingOwnedSummons(s).length,2);
});

test('star dust schedule is cancelled by death or battle reset and fourth optional remains inactive',()=>{
 for(const reset of [false,true]){const e=starBuild(['dust_cloud']);e.cast('another_star_ultimate',e.owner);if(reset)e.resetUnitForBattle(e.owner);else e.owner.alive=false;e.tick();assert.equal(e.owner.delayedSkillActions.length,0);}
 const e=starBuild(['weak_gravity','gamma_ray','light_distance','dust_cloud']);e.cast('another_star_ultimate',e.owner);assert.equal(e.owner.delayedSkillActions.length,0);
});

test('star ultimate repeats damage per star and absorption hides both including newly created stars',()=>{
 const e=starBuild(),s=e.owner,t=e.target;e.cast('another_star_ultimate',s);
 for(const star of e.getLivingOwnedSummons(s)){star.x=100;star.y=100;}t.x=110;
 e.applySkill(s,t,e.runtime('radiance'));assert.equal(t.hp,9800);
 e.cast('absorb',s);assert.equal(e.getLivingOwnedSummons(s).length,0);
 const periodic=e.normalizeSkillAction({type:'deal_damage',damageType:'magic',periodic:true,coefficients:[{type:'fixed',value:100}]});e.applyActionDamage(t,s,periodic);assert.equal(s.hp,2000);
 const f=starBuild();f.cast('absorb',f.owner);f.cast('another_star_ultimate',f.owner);assert.equal(f.getLivingOwnedSummons(f.owner).length,0);
 for(let i=0;i<300;i++)f.tick();assert.equal(f.getLivingOwnedSummons(f.owner).length,2);
});

test('star companion enters once, never moves or attacks, and follows its own aura position', () => {
  const e=starEngine(),source=unit(e),enemy=unit(e,'enemy',130);enemy.resistance=40;
  source.skillIds=[e.star('companion').id];e.publishBattleEvents([{type:'battle_entry',source,target:source}]);
  const stars=e.getLivingOwnedSummons(source,'star_companion');assert.equal(stars.length,1);
  const star=stars[0];star.x=120;star.y=100;e.refreshTrackedBattleFields();
  assert.equal(enemy.resistance,30);assert.equal(star.targetable,false);assert.equal(star.collidable,false);
  e.moveUnit(star,[enemy]);e.takeAction(star,[source,star],[enemy]);assert.equal(star.x,120);assert.equal(enemy.hp,100);
  star.x=500;e.refreshTrackedBattleFields();assert.equal(enemy.resistance,40);
  assert.equal(e.resolveSkillActionTarget(enemy,e.getUnitSkill(enemy).actions[0],star),source);
  source.alive=false;assert.equal(e.canSquadContinueBattle(e.playerSquad),false);
  e.updateSummonLifetimes();assert.equal(e.getLivingOwnedSummons(source).length,0);
});

test('star resistance reductions stack per star and suspension removes only that star aura', () => {
  const e=starEngine(),source=unit(e),enemy=unit(e,'enemy',130);enemy.resistance=40;
  const passive=structuredClone(e.star('companion'));passive.actions[0].count=2;passive.actions[0].limit=2;
  e.applySkill(source,source,passive);
  const stars=e.getLivingOwnedSummons(source);assert.equal(stars.length,2);
  stars.forEach((star,i)=>{star.x=120+i;star.y=100;});e.refreshTrackedBattleFields();assert.equal(enemy.resistance,20);
  stars[0].suspendedTicks=10;e.refreshTrackedBattleFields();assert.equal(enemy.resistance,30);
  for(let i=0;i<10;i++)e.updateSummonLifetimes();assert.equal(enemy.resistance,20);
});

test('star relocation damages every enemy on the path once and updates aura without moving the summoner', () => {
  const e=starEngine(),source=unit(e),end=unit(e,'enemy',200),mid=unit(e,'enemy',150),off=unit(e,'enemy',150),ally=unit(e,'player',160);
  off.y=110;source.magic=50;source.attackRange=20;
  e.applySkill(source,source,e.star('companion'));const star=source.summons[0];star.x=120;star.y=100;
  e.applySkill(source,end,e.star('relocate'));
  assert.equal(star.x,200);assert.equal(star.y,100);assert.equal(source.x,100);
  assert.equal(end.hp,60);assert.equal(mid.hp,60);assert.equal(off.hp,100);assert.equal(ally.hp,100);
  assert.equal(star.moveDistanceTotal,8);
});

test('star tether tracks both endpoints, ticks once per second for five seconds, and stops after owner death', () => {
  const e=starEngine(),source=unit(e),target=unit(e,'enemy',150);target.maxHp=target.hp=1000;
  e.applySkill(source,source,e.star('companion'));const star=source.summons[0];star.x=200;star.y=100;
  e.applySkill(source,target,e.star('interstellar'));
  for(let i=0;i<59;i++)e.updateBattleFields();assert.equal(target.hp,1000);
  e.updateBattleFields();assert.equal(target.hp,990);
  source.y=star.y=target.y=200;star.x=250;target.x=200;
  for(let i=0;i<240;i++)e.updateBattleFields();assert.equal(target.hp,950);
  assert.equal(vm.runInContext('battleFields.filter(f=>f.action.fieldShape === "line").length',e),0);
  e.applySkill(source,target,e.star('interstellar'));source.alive=false;
  for(let i=0;i<60;i++)e.updateBattleFields();assert.equal(target.hp,950);
});

test('star radiance uses distance from each star with two meter steps and ten percent floor', () => {
  const e=starEngine(),source=unit(e),near=unit(e,'enemy',119.9),edge=unit(e,'enemy',120),far=unit(e,'enemy',900),ally=unit(e,'player',120);
  source.magic=100;[near,edge,far].forEach(t=>{t.hp=t.maxHp=1000;});
  e.applySkill(source,source,e.star('companion'));const star=source.summons[0];star.x=100;star.y=100;
  source.x=500;e.applySkill(source,near,e.star('radiance'));
  assert.equal(near.hp,900);assert.equal(edge.hp,910);assert.equal(far.hp,990);assert.equal(ally.hp,100);
});

test('star absorption suspends commands aura and gravity, grants damage immunity, then restores same star', () => {
  const e=starEngine(),source=unit(e),enemy=unit(e,'enemy',130);enemy.resistance=40;
  source.skillIds=[e.star('companion').id,e.star('weak_gravity').id];
  e.publishBattleEvents([{type:'battle_entry',source,target:source}]);const star=source.summons[0];star.x=120;star.y=100;e.refreshTrackedBattleFields();
  assert.equal(enemy.resistance,30);e.applySkill(source,source,e.star('absorb'));
  assert.equal(e.getLivingOwnedSummons(source).length,0);assert.equal(enemy.resistance,40);
  assert.equal(e.resolveSkillActionTarget(source,e.star('relocate').actions[0],enemy,e.star('relocate')),null);
  e.applyActionDamage(enemy,source,e.normalizeSkillAction({type:'deal_damage',damageType:'fixed',coefficients:[{type:'fixed',value:50}]}));assert.equal(source.hp,100);
  for(let i=0;i<60;i++){e.updateBattleEffects();e.updateBattleFields();e.updateSummonLifetimes();}assert.equal(enemy.mp,100);
  for(let i=0;i<240;i++){e.updateBattleEffects();e.updateBattleFields();e.updateSummonLifetimes();}
  assert.equal(e.getLivingOwnedSummons(source)[0],star);assert.equal(star.x,120);assert.equal(enemy.resistance,30);
  e.applyActionDamage(enemy,source,e.normalizeSkillAction({type:'deal_damage',damageType:'fixed',coefficients:[{type:'fixed',value:50}]}));assert.equal(source.hp,50);
});

test('star weak gravity drains actual MP and transfers the same amount capped by owner maximum', () => {
  const e=starEngine(),source=unit(e),enemy=unit(e,'enemy',130);source.mp=0;enemy.mp=2;
  source.skillIds=[e.star('companion').id,e.star('weak_gravity').id];
  e.publishBattleEvents([{type:'battle_entry',source,target:source}]);source.summons[0].x=120;source.summons[0].y=100;
  for(let i=0;i<60;i++)e.updateBattleFields();assert.equal(enemy.mp,0);assert.equal(source.mp,2);
  enemy.mp=10;source.mp=99;for(let i=0;i<60;i++)e.updateBattleFields();assert.equal(enemy.mp,7);assert.equal(source.mp,100);
  enemy.x=500;for(let i=0;i<60;i++)e.updateBattleFields();assert.equal(enemy.mp,7);
});

test('star suspension follows the linked immunity buff duration and ends on dispel', () => {
  const e=starEngine(),source=unit(e),enemy=unit(e,'enemy',130);
  e.applySkill(source,source,e.star('companion'));const star=source.summons[0];
  e.applySkill(source,source,e.star('absorb'));
  source.activeEffects.find(effect=>effect.id==='star_force').remainingTicks=600;
  for(let i=0;i<300;i++){e.updateBattleEffects();e.updateSummonLifetimes();}
  assert.ok(star.suspendedTicks>0);
  e.applyTimedEffectAction(enemy,source,e.normalizeSkillAction({type:'delete_buff',effect:{id:'star_force',dispelMode:'id'}}));
  e.updateSummonLifetimes();assert.equal(star.suspendedTicks,0);assert.equal(e.getLivingOwnedSummons(source)[0],star);
});

test('star redesign base costs weapon ranges optional gravity and ultimate roundtrip', () => {
  const e=starEngine(),all=e.skillsJson.filter(s=>s.id.startsWith('skill_class_star_'));
  assert.equal(all.length,12);all.forEach(s=>assert.ok(e.isSkillExecutable(s),s.name));
  const character=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','characters.json'),'utf8')).find(c=>c.name==='별소환사');
  assert.ok(character);assert.equal(character.skillIds.length,7);assert.ok(all.some(s=>s.slot==='ultimate' && s.name.includes('또다른')));
  const copy=e.normalizeSkillJson(JSON.parse(JSON.stringify(all)));
  assert.equal(copy.find(s=>s.id===e.star('radiance').id).actions[0].distanceFalloff.step,2);
  assert.equal(copy.find(s=>s.id===e.star('relocate').id).actions[0].summonCommand,'relocate');
  const source=unit(e);source.attackRange=7;
  for(const name of ['relocate','interstellar','radiance','absorb']) for(const action of e.star(name).actions) {
    assert.equal(action.rangeMode,'mainWeapon');assert.equal(e.getActionRangePixels(source,action),70);
  }
  assert.deepEqual(Array.from(e.star('absorb').resourceCosts,c=>[c.resource,c.value]),[['MP',30]]);
  assert.equal(e.star('interstellar').resourceCosts.reduce((sum,c)=>sum+c.value,0),0);assert.equal(e.star('radiance').resourceCosts.reduce((sum,c)=>sum+c.value,0),0);
  assert.equal(e.star('weak_gravity').slot,'optional');
  source.skillIds=[e.star('companion').id];assert.equal(e.getRuntimeSelectionSkill(source,e.star('companion')).actions.length,2);
  source.skillIds.push(e.star('weak_gravity').id);assert.equal(e.getRuntimeSelectionSkill(source,e.star('companion')).actions.length,3);
});

function succubusEngine() {
  const e=engine();
  e.skillsJson=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','skills.json'),'utf8')));
  e.succubus=id=>e.getSkillById('skill_class_succubus_'+id);
  return e;
}

test('succubus direct attacks extend finite harmful states and increase damage only against states', () => {
  const e=succubusEngine(),source=unit(e),target=unit(e,'enemy',105);
  source.skillIds=[e.succubus('endless_dream').id];target.hp=target.maxHp=1000;
  const attack=e.normalizeSkillAction({type:'deal_damage',rangeMode:'custom',rangeValue:1,damageType:'fixed',coefficients:[{type:'fixed',value:10}]});
  const add=(id,kind,duration,polarity='harmful')=>e.applyTimedEffectAction(source,target,e.normalizeSkillAction({type:'add_state',duration,effect:{id,name:id,state:kind,polarity}}));
  assert.equal(e.applyActionDamage(source,target,attack),10);
  add('root','root',5);add('forever','root',0);add('friendly','root',5,'beneficial');
  assert.equal(e.applyActionDamage(source,target,attack),12);
  assert.equal(target.activeEffects.find(x=>x.id==='root').remainingTicks,360);
  assert.equal(target.activeEffects.find(x=>x.id==='forever').remainingTicks,null);
  assert.equal(target.activeEffects.find(x=>x.id==='friendly').remainingTicks,300);
  assert.equal(e.applyActionDamage(source,target,{...attack,periodic:true}),10);
  assert.equal(target.activeEffects.find(x=>x.id==='root').remainingTicks,360);
  e.clearBattleEffects(target);
  e.applyTimedEffectAction(source,target,e.normalizeSkillAction({type:'add_buff',duration:5,effect:{id:'slow',name:'slow',mode:'percent',stat:'speed',value:-10,polarity:'harmful'}}));
  assert.equal(e.applyActionDamage(source,target,attack),10);
});

test('succubus sleep preserves its damage budget for the passive owner but wakes to other accumulated damage', () => {
  const e=succubusEngine(),source=unit(e),other=unit(e),target=unit(e,'enemy',130);
  source.skillIds=[e.succubus('endless_dream').id];target.maxHp=target.hp=1000;
  e.applySkill(source,target,e.succubus('dream'));
  const attack=e.normalizeSkillAction({type:'deal_damage',rangeMode:'custom',rangeValue:5,damageType:'fixed',coefficients:[{type:'fixed',value:60}]});
  e.applyActionDamage(source,target,attack);
  assert.ok(e.hasBattleState(target,'sleep'));assert.equal(target.activeEffects[0].damageTaken,0);assert.equal(target.activeEffects[0].remainingTicks,360);
  e.applyActionDamage(other,target,attack);assert.ok(e.hasBattleState(target,'sleep'));
  e.applyActionDamage(other,target,attack);assert.equal(e.hasBattleState(target,'sleep'),false);
  assert.equal(e.hasBattleState(target,'stun'),false);
});

test('succubus sleep interrupts casting and charm approaches its own caster without attacking', () => {
  const e=succubusEngine(),source=unit(e),target=unit(e,'enemy',130);
  target.speed=1;target.role='ranged';target.skillIds=[e.succubus('precious_target').id];
  e.startCast(target,{type:'attack',target:source,skill:e.getUnitSkill(target)});
  e.applySkill(source,target,e.succubus('dream'));
  assert.equal(target.pendingAction,null);e.moveUnit(target,[source]);assert.equal(target.x,130);
  assert.equal(e.tryUseReadySkill(target,[target],[source]),false);
  e.clearBattleEffects(target);e.applySkill(source,target,e.succubus('fascination'));
  const x=target.x;e.moveUnit(target,[source]);assert.ok(target.x<x);
  assert.equal(e.tryUseReadySkill(target,[target],[source]),false);
  e.applyTimedEffectAction(source,target,e.normalizeSkillAction({type:'add_state',duration:1,effect:{id:'root',name:'root',state:'root'}}));
  const rooted=target.x;e.moveUnit(target,[source]);assert.equal(target.x,rooted);
  e.clearBattleEffects(target);assert.ok(e.tryUseReadySkill(target,[target],[source]));
});

test('succubus charming strike counts actual hits per caster and target, refreshes at three and resets for battle', () => {
  const e=succubusEngine(),a=unit(e),b=unit(e),target=unit(e,'enemy',105),second=unit(e,'enemy',106);
  target.hp=target.maxHp=second.hp=second.maxHp=1000;
  const strike=e.succubus('charming_strike');
  e.applySkill(a,target,strike);e.applySkill(a,target,strike);assert.equal(e.hasBattleState(target,'charm'),false);
  e.applySkill(b,target,strike);e.applySkill(a,second,strike);assert.equal(e.hasBattleState(second,'charm'),false);
  e.applySkill(a,target,strike);assert.ok(e.hasBattleState(target,'charm'));
  assert.equal(target.activeEffects.find(x=>x.state==='charm').remainingTicks,300);
  e.updateBattleEffects();e.applySkill(a,target,strike);
  assert.equal(target.activeEffects.find(x=>x.state==='charm').remainingTicks,300);
  e.resetUnitForBattle(target);e.applySkill(a,target,strike);assert.equal(e.hasBattleState(target,'charm'),false);
  assert.equal(target.hp,988);
});

test('succubus hit threshold ignores immune damage and never transfers a lethal strike to another target', () => {
  const e=succubusEngine(),source=unit(e),target=unit(e,'enemy',105),second=unit(e,'enemy',106);
  const strike=e.succubus('charming_strike');
  e.applyTimedEffectAction(target,target,e.normalizeSkillAction({type:'add_buff',effect:{id:'immune',name:'immune',mode:'damage_immunity'}}));
  for(let i=0;i<3;i++)e.applySkill(source,target,strike);
  assert.equal(Object.keys(target.effectHitCounts).length,0);
  e.clearBattleEffects(target);target.hp=1;e.applySkill(source,target,strike);
  assert.equal(target.alive,false);assert.equal(Object.keys(second.effectHitCounts).length,0);
});

test('succubus dream selection defaults to sleep and respects numeric grade eligibility without consuming on failure', () => {
  const e=succubusEngine(),source=unit(e),target=unit(e,'enemy',130);
  const choice=e.succubus('dream_choice');source.skillIds=[choice.id];
  assert.equal(e.getEquippedSkills(source)[0].id,e.succubus('dream').id);
  target.entityGrade=3;assert.equal(e.tryUseReadySkill(source,[source],[target]),false);assert.equal(source.mp,100);
  target.entityGrade=2;assert.ok(e.tryUseReadySkill(source,[source],[target]));
  for(let i=0;i<60;i++)e.updateCast(source);
  assert.ok(e.hasBattleState(target,'sleep'));assert.equal(source.mp,90);
  source.skillSelections={[choice.id]:'charm'};
  assert.equal(e.getEquippedSkills(source)[0].id,e.succubus('fascination').id);
});

test('succubus disguise blocks new direct targets while existing projectiles and self-centered area still hit', () => {
  const e=succubusEngine(),source=unit(e),attacker=unit(e,'enemy',130);
  attacker.portrait='assets/images/enemy.png';source.portrait='assets/images/owner.png';
  const attack=skill(e,{type:'deal_damage',target:'enemy',rangeMode:'custom',rangeValue:5,damageType:'fixed',coefficients:[{type:'fixed',value:10}]});
  e.dispatchSkillActions(attacker,source,attack,true,true);assert.equal(e.projectiles.length,1);
  e.applySkill(source,source,e.succubus('precious_target'));
  assert.equal(source.activeEffects[0].disguisePortrait,attacker.portrait);
  assert.equal(source.side,'player');assert.equal(source.portrait,'assets/images/owner.png');
  assert.equal(e.resolveSkillActionTarget(attacker,attack.actions[0],source,attack),null);
  assert.equal(e.findTarget(attacker,[source]),undefined);
  const summon=skill(e,{type:'summon_entity',summon:{count:1,target:'enemy',summonCenter:'target'}});
  assert.equal(e.resolveSkillActionTarget(attacker,summon.actions[0],source,summon),null);
  e.updateProjectiles();assert.equal(source.hp,90);
  const area=skill(e,{...attack.actions[0],area:5,areaCenter:'self'});
  e.applySkill(attacker,source,area);assert.equal(source.hp,80);
  for(let i=0;i<300;i++)e.updateBattleEffects();
  assert.equal(e.resolveSkillActionTarget(attacker,attack.actions[0],source,attack),source);
});

test('succubus data roundtrips passive controls, grade limits, threshold and choice without inventing a second skill', () => {
  const e=succubusEngine(),all=e.skillsJson.filter(s=>s.id.startsWith('skill_class_succubus_'));
  assert.equal(all.length,6);for(const s of all)assert.ok(e.isSkillExecutable(s),s.name);
  const normalized=e.normalizeSkillJson(JSON.parse(JSON.stringify(all)));
  const passive=normalized.find(s=>s.id===e.succubus('endless_dream').id);
  assert.equal(passive.passiveTrigger.stateDurationExtension,1);assert.ok(passive.passiveTrigger.preserveSleep);
  assert.equal(e.succubus('dream').actions[0].targetMaxGrade,2);
  assert.equal(e.succubus('charming_strike').actions[1].effect.hitThreshold,3);
  const character=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','characters.json'),'utf8')).find(c=>c.name==='몽마');
  assert.equal(character.skillIds.length,4);assert.ok(character.skillIds.includes(e.succubus('dream_choice').id));
});

function jesterEngine() {
  const e=engine();
  e.skillsJson=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','skills.json'),'utf8')));
  e.cloneEntity=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','entities','jester_clone.json'),'utf8'));
  vm.runInContext('entitiesJson.push(cloneEntity)',e);
  e.jester=id=>e.getSkillById('skill_class_jester_'+id);
  return e;
}

test('jester mana refund uses actual completed active cast cost and excludes interrupts and basic attacks', () => {
  const e=jesterEngine(),source=unit(e),target=unit(e,'enemy',130);
  source.skillIds=[e.jester('light_prank').id,e.jester('no_attack').id];
  source.maxMp=source.mp=200;
  assert.ok(e.tryUseReadySkill(source,[source],[target]));
  assert.equal(source.mp,190);
  for(let i=0;i<60;i++) e.updateCast(source);
  assert.equal(source.mp,193);
  assert.equal(e.getBattleEvents('cast_complete')[0].resourceSpent.MP,10);
  source.skillCooldowns[e.jester('no_attack').id]=0;
  assert.ok(e.tryUseReadySkill(source,[source],[target]));
  e.interruptBattleCast(source,'test');assert.equal(source.mp,183);
  e.publishBattleEvents([{type:'cast_complete',source,target,skill:e.jester('spring_reaction'),resourceSpent:{MP:100}}]);
  assert.equal(source.mp,183);
  // A modified cost must refund its actual expenditure rather than the stored base cost.
  e.publishBattleEvents([{type:'cast_complete',source,target,skill:e.jester('no_attack'),resourceSpent:{MP:20}}]);
  assert.equal(source.mp,189);
});

test('jester disarm cancels basic casts and independent weapons while allowing active skills', () => {
  const e=jesterEngine(),source=unit(e),target=unit(e,'enemy',130);
  e.startCast(target,{type:'attack',target:source,skill:e.getUnitSkill(target)});
  target.weaponAttackStates=[{castTimer:30,target:source,cooldown:0}];
  e.applySkill(source,target,e.jester('no_attack'));
  assert.equal(target.pendingAction,null);assert.equal(target.weaponAttackStates[0].castTimer,0);
  assert.ok(e.hasBattleState(target,'disarm'));assert.equal(e.hasBattleState(target,'silence'),false);
  target.skillIds=[e.jester('surprise_spring').id];
  assert.ok(e.tryUseReadySkill(target,[target],[source]));
  assert.ok(target.activeEffects.some(effect=>effect.id==='jester_spring'));
  e.startCast(target,{type:'attack',target:source,skill:e.getUnitSkill(target)});
  assert.equal(target.pendingAction,null);
  for(let i=0;i<300;i++) e.updateBattleEffects();
  assert.equal(e.hasBattleState(target,'disarm'),false);
});

test('jester clones inherit exactly five percent, copy portrait, expire, and leave caster behind', () => {
  const e=jesterEngine(),source=unit(e),target=unit(e,'enemy',400);
  source.portrait='assets/images/test.png';source.speed=2;source.defense=40;source.resistance=60;
  const before=JSON.stringify(e.cloneEntity);
  e.applySkill(source,source,e.jester('guess_who'));
  assert.equal(source.summons.length,3);
  for(const clone of source.summons) {
    assert.equal(clone.maxHp,5);assert.equal(clone.maxMp,5);assert.equal(clone.magic,1);
    assert.equal(clone.speed,.1);assert.equal(clone.defense,2);assert.equal(clone.resistance,3);
    assert.equal(clone.portrait,source.portrait);assert.ok(source.x<clone.x);
    assert.equal(clone.summonTicks,600);
  }
  e.applySkill(source,source,e.jester('guess_who'));assert.equal(source.summons.length,3);
  assert.equal(JSON.stringify(e.cloneEntity),before);
  for(let i=0;i<600;i++) e.updateSummonLifetimes();
  assert.equal(e.getLivingOwnedSummons(source).length,0);
});

test('jester spring reacts to direct melee only, scales by actual knockback and armor, and cannot loop', () => {
  for(const [armor,factor] of Object.entries({plate:.25,chain:5,leather:1,cloth:1.5,none:1})) {
    const e=jesterEngine(),source=unit(e),attacker=unit(e,'enemy',125);
    source.hp=source.maxHp=10000;attacker.hp=attacker.maxHp=10000;attacker.speed=2;attacker.armorCategory=armor;
    e.applySkill(source,source,e.jester('surprise_spring'));
    e.applySkill(attacker,attacker,e.jester('surprise_spring'));
    const attack=e.normalizeSkillAction({type:'deal_damage',target:'enemy',rangeMode:'custom',rangeValue:1,damageType:'fixed',coefficients:[{type:'fixed',value:10}]});
    e.applyActionDamage(attacker,source,{...attack,periodic:true});assert.equal(attacker.hp,10000);
    e.applyActionDamage(attacker,source,{...attack,rangeValue:5});assert.equal(attacker.hp,10000);
    e.applyActionDamage(attacker,source,attack);
    assert.equal(attacker.x,225);assert.equal(attacker.hp,10000-source.magic*10*factor);
    assert.equal(attacker.speed,1.4);assert.ok(attacker.activeEffects.some(effect=>effect.name==='헥헥' && effect.category==='physical'));
    assert.equal(source.hp,9970);assert.equal(source.x,100);
  }
});

test('jester spring measures collision-limited travel and has no reaction after expiry', () => {
  const e=jesterEngine(),source=unit(e,'player',900),attacker=unit(e,'enemy',925);
  attacker.hp=attacker.maxHp=10000;attacker.armorCategory='cloth';
  e.applySkill(source,source,e.jester('surprise_spring'));
  const attack=e.normalizeSkillAction({type:'deal_damage',rangeMode:'custom',rangeValue:1,damageType:'fixed',coefficients:[{type:'fixed',value:1}]});
  e.applyActionDamage(attacker,source,attack);
  const meters=(attacker.x-925)/10;
  assert.ok(meters>0 && meters<10);assert.equal(attacker.hp,10000-source.magic*meters*1.5);
  for(let i=0;i<300;i++) e.updateBattleEffects();
  const hp=attacker.hp;e.applyActionDamage(attacker,source,attack);assert.equal(attacker.hp,hp);
});

test('jester sheep affects enemies in radius, interrupts casts, flees slowly and restores after expiry or dispel', () => {
  const e=jesterEngine(),source=unit(e),near=unit(e,'enemy',130),far=unit(e,'enemy',160),ally=unit(e,'player',125);
  near.speed=2;near.role='melee';near.skillIds=[e.jester('surprise_spring').id];
  e.startCast(near,{type:'attack',target:source,skill:e.getUnitSkill(near)});
  e.applySkill(source,near,e.jester('shepherd_boy'));
  assert.equal(near.hp,90);assert.equal(far.hp,100);assert.equal(ally.hp,100);
  assert.equal(near.pendingAction,null);assert.equal(near.speed,1);
  for(const state of ['polymorph','silence','disarm','flee']) assert.ok(e.hasBattleState(near,state));
  assert.equal(e.tryUseReadySkill(near,[near],[source]),false);
  const x=near.x;e.moveUnit(near,[source]);assert.ok(near.x>x);
  for(let i=0;i<180;i++) e.updateBattleEffects();
  assert.equal(e.hasBattleState(near,'polymorph'),false);assert.equal(near.speed,2);
  assert.ok(e.tryUseReadySkill(near,[near],[source]));
  e.applySkill(source,near,e.jester('shepherd_boy'));
  e.applyTimedEffectAction(source,near,e.normalizeSkillAction({type:'delete_state',effect:{id:'jester_sheep',dispelMode:'id'}}));
  assert.equal(e.hasBattleState(near,'flee'),false);assert.equal(near.speed,2);
});

test('jester registered skills are executable and assigned without equipping reaction helper', () => {
  const e=jesterEngine();
  const skills=e.skillsJson.filter(s=>s.id.startsWith('skill_class_jester_'));
  assert.equal(skills.length,6);for(const s of skills) assert.ok(e.isSkillExecutable(s),s.name);
  const character=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','characters.json'),'utf8')).find(c=>c.name==='광대');
  assert.equal(character.skillIds.length,5);assert.ok(!character.skillIds.includes(e.jester('spring_reaction').id));
  const normalized=e.normalizeSkillJson(JSON.parse(JSON.stringify(skills)));
  assert.ok(normalized.find(s=>s.id===e.jester('guess_who').id).actions[0].copyAppearance);
  assert.equal(normalized.find(s=>s.id===e.jester('spring_reaction').id).actions[1].armorMultipliers.chain,5);
});

test('owner contribution survives repeated removal, groups templates and separates identical owners', () => {
  const e=engine(), a=unit(e), b=unit(e), enemy=unit(e,'enemy');
  a.name=b.name='same';a.id=b.id=0;
  enemy.maxHp=enemy.hp=10000;
  const summon=skill(e,{type:'summon_entity',summon:{count:1,lifetime:0,atk:7}});
  const damage={type:'deal_damage',damageType:'fixed',coefficients:[{type:'fixed',value:7}]};
  e.applyActionDamage(a,enemy,{...damage,coefficients:[{type:'fixed',value:10}]});
  for(let i=0;i<12;i++) {
    e.applySkill(a,a,summon);const s=a.summons[0];
    e.applyActionDamage(s,enemy,damage);
    s.hp=0;e.syncAliveState(s);
  }
  e.applySkill(b,b,summon);e.applyActionDamage(b.summons[0],enemy,damage);
  const rows=e.createRecordMembers(e.playerSquad,10);
  assert.equal(rows.length,2);
  assert.equal(rows[0].damageDealt,94);assert.equal(rows[0].dps,9.4);
  assert.equal(rows[0].contribution.direct.damageDealt,10);
  assert.equal(rows[0].contribution.summon.damageDealt,84);
  assert.equal(rows[0].contribution.groups.length,1);assert.equal(rows[0].contribution.groups[0].count,12);
  assert.equal(rows[1].damageDealt,7);assert.notEqual(rows[0].eventId,rows[1].eventId);
  assert.equal(e.getBattleEvents('hit').filter(v=>v.source.isSummon).length,13);
  const saved=e.normalizeRecordJson([{battleAt:'2026-10-12',result:'test',playerMembers:rows,contributionVersion:1}]);
  assert.equal(saved[0].playerMembers[0].contribution.summon.damageDealt,84);
  e.resetBattleEvents();assert.equal(e.getBattleContribution(a,10).total.damageDealt,0);
});

test('persistent contribution includes healing resources kills after death but not owner HP or death', () => {
  const e=engine(), owner=unit(e), target=unit(e,'enemy');
  lifecycleSummon(e,owner,'persistent');const s=owner.summons[0];
  owner.hp=40;owner.mp=50;
  e.applyActionHeal(s,owner,{healResource:'HP',coefficients:[{type:'fixed',value:20}]});
  e.applyActionHeal(s,owner,{healResource:'MP',coefficients:[{type:'fixed',value:10}]});
  e.applyActionDamage(s,target,{damageType:'fixed',coefficients:[{type:'fixed',value:100}]});
  s.hp=0;e.syncAliveState(s);
  const row=e.createRecordMembers(e.playerSquad,5)[0];
  assert.equal(row.healingDone,20);assert.equal(row.hps,4);assert.equal(row.kills,1);
  assert.equal(row.hp,60);assert.equal(row.contribution.summon.resourceRecovery.MP,10);
  assert.equal(row.contribution.groups[0].summonType,'persistent');
  assert.equal(e.reactivatePersistentSummon(s,30),true);
  e.registerBattleContribution(s);assert.equal(e.getBattleContribution(owner,5).groups[0].count,1);
});

test('contribution is independent of the capped event history', () => {
  const e=engine(), owner=unit(e), target=unit(e,'enemy');
  target.hp=target.maxHp=5000;
  for(let i=0;i<1100;i++) e.applyActionDamage(owner,target,{damageType:'fixed',coefficients:[{type:'fixed',value:1}]});
  assert.equal(e.getBattleEvents().length,1000);
  assert.equal(e.createRecordMembers(e.playerSquad,100)[0].damageDealt,1100);
});

test('equipment loadout and suppression replace item modifiers and effective attributes', () => {
  const e=engine(),source=unit(e);
  const loadout={...source,baseBp:0,attributes:{str:15},itemSkillModifiers:[{skillId:'s',target:'cooldown',signature:'skill',value:-1}],weaponAttacks:[]};
  loadout.withoutEquipment={...loadout,attributes:{str:10},itemSkillModifiers:[]};
  e.applyBattleEquipmentLoadout(source,loadout,1);
  assert.equal(source.attributes.str,15);assert.equal(source.itemSkillModifiers.length,1);
  source.runtimeRuleOverrides=[{disableEquipmentEffects:true}];
  e.applyBattleEquipmentLoadout(source,loadout,1);
  assert.equal(source.attributes.str,10);assert.equal(source.itemSkillModifiers.length,0);
  source.runtimeRuleOverrides=[];
  e.applyBattleEquipmentLoadout(source,loadout,1);
  assert.equal(source.attributes.str,15);assert.equal(source.itemSkillModifiers.length,1);
});

test('item skill modifiers target individual coefficients, stack once and protect source skills', () => {
  const e=engine(),source=unit(e),target=unit(e,'enemy',105);
  const s=skill(e,{type:'deal_damage',target:'enemy',damageType:'fixed',rangeMode:'custom',rangeValue:10,coefficients:[{type:'fixed',value:10},{type:'fixed',value:20}]});
  e.skillsJson=[s];source.skillIds=[s.id];
  const choice=e.getItemSkillTargets(s).find(t=>t.target==='actions.0.coefficients.1.value');
  source.itemSkillModifiers=[{skillId:s.id,target:choice.target,signature:choice.signature,value:7},{skillId:s.id,target:choice.target,signature:choice.signature,value:3}];
  const before=JSON.stringify(s);
  for(let i=0;i<3;i++) assert.equal(e.getEquippedSkills(source)[0].actions[0].coefficients[1].value,30);
  assert.equal(e.tryUseReadySkill(source,[source],[target]),true);
  assert.equal(target.hp,60);
  assert.equal(JSON.stringify(s),before);
  source.itemSkillModifiers=[];
  assert.equal(e.getEquippedSkills(source)[0].actions[0].coefficients[1].value,20);
});

test('item cooldown resource duration and range changes reach real engine execution', () => {
  const e=engine(),source=unit(e),target=unit(e,'enemy',150);
  const action=e.createDefaultAction('add_state');action.target='enemy';action.duration=2;action.rangeMode='custom';action.rangeValue=2;
  const s=skill(e,action);s.cooldown=4;s.resourceCosts=[{resource:'MP',mode:'fixed',value:20},{resource:'ST',mode:'fixed',value:5}];
  const values={'cooldown':-1,'resourceCosts.0.value':-10,'actions.0.duration':3,'actions.0.rangeValue':8};
  source.itemSkillModifiers=e.getItemSkillTargets(s).filter(t=>t.target in values).map(t=>({skillId:s.id,target:t.target,signature:t.signature,value:values[t.target]}));
  e.skillsJson=[s];source.skillIds=[s.id];
  const runtime=e.getEquippedSkills(source)[0];
  assert.equal(runtime.cooldown,3);assert.equal(runtime.resourceCosts[1].value,5);
  assert.equal(e.tryUseReadySkill(source,[source],[target]),true);
  assert.equal(source.mp,90);assert.equal(source.st,95);assert.equal(source.skillCooldowns[s.id],180);
  assert.equal(target.activeEffects[0].remainingTicks,300);
  source.runtimeRuleOverrides=[{disableEquipmentEffects:true}];
  assert.equal(e.getEquippedSkills(source)[0].cooldown,4);
});

test('changed skill action or cost invalidates stale item targets without redirecting them', () => {
  const e=engine(),source=unit(e);
  const s=skill(e,{type:'deal_damage',target:'enemy',coefficients:[{type:'fixed',value:10}]});
  s.resourceCosts=[{resource:'MP',mode:'fixed',value:20}];
  source.itemSkillModifiers=e.getItemSkillTargets(s).filter(t=>['actions.0.coefficients.0.value','resourceCosts.0.value'].includes(t.target)).map(t=>({skillId:s.id,target:t.target,signature:t.signature,value:-9}));
  s.actions[0].coefficients[0].value=30;s.resourceCosts[0].resource='ST';
  const runtime=e.getRuntimeItemSkill(source,s);
  assert.equal(runtime.actions[0].coefficients[0].value,30);assert.equal(runtime.resourceCosts[0].value,20);
});

test('unsupported actions preserve their original payload and are locked', () => {
  const e=engine();
  for(const type of ['add_buff','cast_skill','custom_action']) {
    const original={type,target:'ally',custom:{power:17},duration:8};
    assert.equal(JSON.stringify(e.normalizeSkillAction(original)),JSON.stringify(original));
    if(type !== 'add_buff') assert.match(e.renderActionTypeOptions(type),new RegExp(`value="${type}"[^>]*disabled`));
  }
  const move={type:'move',moveType:'Walk',distance:12,custom:5};
  assert.equal(JSON.stringify(e.normalizeSkillAction(move)),JSON.stringify(move));
  assert.equal(e.isSkillExecutable({actions:[move]}),false);
  assert.equal(e.isSkillExecutable({actions:[]}),false);
});

test('unsupported mixed skills do not partially execute or consume resources', () => {
  const e=engine(), source=unit(e), target=unit(e,'enemy',110);
  const mixed=skill(e,{type:'deal_damage',target:'enemy',coefficients:[{type:'fixed',value:30}]});
  mixed.actions.push({type:'add_buff',custom:42});
  e.skillsJson=[mixed];source.skillIds=[mixed.id];
  const mp=source.mp,st=source.st;
  assert.equal(e.tryUseReadySkill(source,[source],[target]),false);
  e.applySkill(source,target,mixed);
  assert.equal(target.hp,100);assert.equal(source.mp,mp);assert.equal(source.st,st);
  assert.equal(e.getEquippedSkills(source).length,0);
  const valid=skill(e,{type:'deal_damage',target:'enemy',coefficients:[{type:'fixed',value:10}]});
  valid.id='valid';e.skillsJson.push(valid);source.skillIds.push(valid.id);
  assert.equal(e.tryUseReadySkill(source,[source],[target]),true);
  assert.equal(target.hp,90);
});

test('unsupported weapon assignment falls back to an executable unit attack', () => {
  const e=engine(),source=unit(e);source.attackType='magic';source.attackSkillId='blocked';
  e.skillsJson=[{id:'blocked',actions:[{type:'create_field'}]}];
  const fallback=e.getUnitSkill(source);
  assert.equal(e.isSkillExecutable(fallback),true);
  assert.equal(fallback.actions[0].damageType,'magic');
});

function dukeEngine(options=[]) {
 const e=engine();e.skillsJson=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','skills.json'),'utf8')));
 e.duke=id=>e.getSkillById('skill_class_duke_'+id);e.owner=unit(e);e.ally=unit(e,'player',105);e.enemy=unit(e,'enemy',110);e.enemyAlly=unit(e,'enemy',115);
 for(const u of [e.owner,e.ally,e.enemy,e.enemyAlly]){u.hp=u.maxHp=1000;u.atk=100;u.attackRange=1;u.speed=1;}
 e.owner.battleStartX=100;e.owner.battleStartY=100;
 e.owner.skillIds=['immortality','bomb_necklace','unfair_damage','cursed_nail','rapid_revival',...options].map(id=>e.duke(id).id);
 e.runtime=id=>e.getRuntimeSelectionSkill(e.owner,e.duke(id));
 e.kill=()=>{e.owner.hp=0;e.syncAliveState(e.owner,{source:e.enemy});};
 e.hit=(value=100,target=e.owner)=>e.applyActionDamage(e.enemy,target,e.normalizeSkillAction({type:'deal_damage',target:'enemy',damageType:'physical',coefficients:[{type:'fixed',value}]}),{id:'duke_test_hit',slot:'active'});
 e.wait=()=>{e.owner.skillCooldowns[e.duke('rapid_revival').id]=99999;e.kill();};return e;
}

test('duke revives repeatedly after ten seconds at the start position with full resources and preserved cooldowns',()=>{
 const e=dukeEngine(),s=e.owner;s.baseBp=25;s.maxBp=100;s.bp=7;s.mp=1;s.st=2;s.skillCooldowns[e.duke('cursed_nail').id]=1200;s.x=180;s.y=190;e.wait();
 assert.equal(s.reviveTicks,600);assert.equal(s.alive,false);assert.equal(s.battleDeathX,180);assert.equal(e.isBattleDefeatState(s),true);assert.equal(e.canSquadContinueBattle(e.playerSquad),true);
 for(let i=0;i<599;i++)e.updateBattleReentries();assert.equal(s.alive,false);e.updateBattleReentries();
 assert.equal(s.alive,true);assert.equal(s.hp,1000);assert.equal(s.mp,100);assert.equal(s.st,100);assert.equal(s.bp,25);assert.equal(s.maxBp,25);assert.equal(s.x,100);assert.equal(s.y,100);
 assert.equal(s.skillCooldowns[e.duke('cursed_nail').id],600);assert.equal(e.isBattleDefeatState(s),false);
 for(let cycle=0;cycle<2;cycle++){e.kill();for(let i=0;i<600;i++)e.updateBattleReentries();assert.equal(s.alive,true);}
 assert.equal(e.getBattleEvents('death').filter(v=>v.target.id===e.getBattleEvents('death')[0].target.id).length,3);
});

test('duke selected grave and waiting modifiers use the recorded death position and eight-second delay',()=>{
 const e=dukeEngine(['near_grave','anxious_wait']),s=e.owner;s.x=170;s.y=180;e.wait();assert.equal(s.reviveTicks,480);
 s.x=250;s.y=250;for(let i=0;i<480;i++)e.updateBattleReentries();assert.equal(s.x,170);assert.equal(s.y,180);assert.equal(s.alive,true);
 const other=dukeEngine();other.owner.x=170;other.wait();for(let i=0;i<600;i++)other.updateBattleReentries();assert.equal(other.owner.x,100);
});

test('duke rapid revival triggers only on death, consumes sixty-second cooldown, and cannot keep a defeated side alive',()=>{
 const e=dukeEngine(),s=e.owner;assert.equal(e.getEquippedSkills(s).some(sk=>sk.revivalOnly),false);
 s.baseBp=25;s.bp=7;let recoveredBp;e.subscribeBattleEvent('cast_complete',(event,refs)=>{if(event.skillId===e.duke('rapid_revival').id)recoveredBp=refs.source.bp;});
 e.kill();assert.equal(s.alive,false);assert.equal(s.reviveTicks,1);assert.equal(s.skillCooldowns[e.duke('rapid_revival').id],3600);
 e.updateBattleReentries();assert.equal(s.alive,true);assert.equal(s.skillCooldowns[e.duke('rapid_revival').id],3599);assert.equal(recoveredBp,25);
 e.kill();assert.equal(s.reviveTicks,600);
 const solo=dukeEngine();solo.ally.alive=false;solo.ally.hp=0;assert.equal(solo.canSquadContinueBattle(solo.playerSquad),true);
 solo.kill();assert.equal(solo.canSquadContinueBattle(solo.playerSquad),false);assert.equal(solo.owner.reviveTicks,600);
 solo.owner.reviveTicks=1;solo.updateBattleReentries();assert.equal(solo.owner.alive,false);assert.equal(solo.owner.reviveTicks,1);
});

test('mixed soul reaper soul and duke revival are defeat states together while a living duke still counts',()=>{
 const e=dukeEngine(),s=e.owner,reaper=e.ally;
 reaper.skillIds=['skill_class_soul_reaper_soul_and_body','skill_class_soul_reaper_black_assault'];reaper.hp=0;e.syncAliveState(reaper,{source:e.enemy});
 assert.equal(e.isBattleDefeatState(reaper),true);assert.equal(e.canSquadContinueBattle(e.playerSquad),true);
 e.kill();assert.equal(e.isBattleDefeatState(s),true);assert.equal(e.canSquadContinueBattle(e.playerSquad),false);
 s.reviveTicks=1;e.getLifeCycleForm(reaper).remainingTicks=2;e.updateBattleReentries();assert.equal(s.alive,false);
 let outcome;e.finishBattle=result=>{outcome=result;};e.updateCombat();assert.equal(outcome,'패배');
 // The scheduler must settle defeat before a one-tick soul return or revival can rescue the side.
 e.getLifeCycleForm(reaper).remainingTicks=1;e.isBattleRunning=true;e.gameSpeed=1;e.updateResources=()=>{};
 e.finishBattle=result=>{outcome=result;e.isBattleRunning=false;};e.runBattleTick();
 assert.equal(outcome,'패배');assert.equal(s.alive,false);assert.equal(e.getLifeCycleForm(reaper).remainingTicks,1);
 // Ordinary finite revival retains its pre-existing keep-alive behavior.
 const normal=dukeEngine();normal.owner.alive=false;normal.owner.hp=0;normal.ally.revivesRemaining=1;normal.ally.hp=0;normal.syncAliveState(normal.ally);
 assert.equal(normal.isBattleDefeatState(normal.ally),false);assert.equal(normal.canSquadContinueBattle(normal.playerSquad),true);
});

test('duke bomb checks HP and ST, explodes before forced suicide and bypasses BP and revival immunity',()=>{
 const e=dukeEngine(),s=e.owner,bomb=e.runtime('bomb_necklace');s.hp=101;assert.equal(e.canPaySkillResourceCosts(s,bomb),false);
 s.hp=100;s.st=29;assert.equal(e.canPaySkillResourceCosts(s,bomb),false);s.st=100;s.bp=1000;s.reviveInvulnerableTicks=999;e.enemyAlly.x=141;
 assert.equal(e.tryUseReadySkill(s,e.playerSquad,e.enemySquad),true);assert.equal(s.pendingAction.skill.id,bomb.id);assert.equal(s.st,70);
 for(let i=0;i<60;i++)e.updateCast(s);assert.equal(e.enemy.hp,700);assert.equal(e.enemyAlly.hp,1000);assert.equal(s.hp,0);assert.equal(s.alive,false);assert.equal(s.isWaiting,true);
 assert.equal(e.getBattleEvents('death').at(-1).reason,'자폭');
});

test('duke bomb rechecks HP and nearby enemies after cast, supports early-death selection, and has no empty-area suicide',()=>{
 const e=dukeEngine(),s=e.owner;s.hp=100;e.tryUseReadySkill(s,e.playerSquad,e.enemySquad);s.hp=101;for(let i=0;i<60;i++)e.updateCast(s);
 assert.equal(s.alive,true);assert.equal(e.enemy.hp,1000);assert.equal(s.st,70);
 const early=dukeEngine(['early_death']);early.owner.hp=200;assert.equal(early.canPaySkillResourceCosts(early.owner,early.runtime('bomb_necklace')),true);
 early.owner.hp=201;assert.equal(early.canPaySkillResourceCosts(early.owner,early.runtime('bomb_necklace')),false);
 early.owner.hp=200;early.enemy.x=200;early.enemyAlly.x=220;assert.equal(early.canActivateSkill(early.owner,early.runtime('bomb_necklace')),false);
});

test('duke unfair damage selected cost damage and rapid cooldown reductions apply only while equipped',()=>{
 for(const selected of [false,true]){
  const e=dukeEngine(selected?['more_unfair','installment_revival']:[]),s=e.owner,sk=e.runtime('unfair_damage');s.skillIds=s.skillIds.filter(id=>id!==e.duke('bomb_necklace').id);s.skillCooldowns[e.duke('rapid_revival').id]=600;
  e.tryUseReadySkill(s,e.playerSquad,e.enemySquad);e.updateProjectiles();
  assert.equal(s.hp,selected?850:900);assert.equal(e.enemy.hp,selected?780:800);assert.equal(s.skillCooldowns[e.duke('rapid_revival').id],selected?540:600);
 }
});

test('duke nail transfers actual HP and BP damage including lethal hits but excludes costs and avoids cycles',()=>{
 const e=dukeEngine(),s=e.owner;e.applySkill(s,e.enemy,e.runtime('cursed_nail'));e.hit(100);assert.equal(e.enemy.hp,970);
 s.bp=50;e.hit(80);assert.equal(e.enemy.hp,955);s.bp=0;s.hp=10;e.hit(100);assert.equal(e.enemy.hp,952);assert.equal(s.alive,false);
 const costs=dukeEngine();costs.applySkill(costs.owner,costs.enemy,costs.runtime('cursed_nail'));costs.spendSkillResourceCosts(costs.owner,costs.runtime('unfair_damage'));assert.equal(costs.enemy.hp,1000);
 costs.enemy.skillIds=[costs.duke('cursed_nail').id];costs.applySkill(costs.enemy,costs.owner,costs.runtime('cursed_nail'));costs.hit(100);
 assert.equal(costs.enemy.hp,970);assert.equal(costs.owner.hp,800);
});

test('duke rusty nail is conditional and ticks only on the selected marked enemy',()=>{
 for(const selected of [false,true]){
  const e=dukeEngine(selected?['rusty_nail']:[]);e.applySkill(e.owner,e.enemy,e.runtime('cursed_nail'));
  for(let i=0;i<60;i++)e.updateBattleEffects();assert.equal(e.enemy.hp,selected?995:1000);assert.equal(e.enemyAlly.hp,1000);
 }
});

test('duke data normalization preserves revival-only and conditional execution and optional choices remain limited to three',()=>{
 const e=dukeEngine(['near_grave','anxious_wait','early_death','more_unfair']),before=JSON.stringify(e.skillsJson);
 assert.equal(JSON.stringify(e.normalizeSkillJson(e.skillsJson)),before);assert.equal(e.getSkillsForClass('공작').length,11);assert.equal(e.getEquippedSkills(e.owner).length,3);
 assert.equal(e.runtime('unfair_damage').resourceCosts[0].value,10);assert.equal(e.runtime('bomb_necklace').activation.selfHpAtMost,20);
});

// The reaper's normal checks always start in a two-versus-two formation.
function soulEngine() {
 const e=engine();e.skillsJson=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','skills.json'),'utf8')));
 e.soul=id=>e.getSkillById('skill_class_soul_reaper_'+id);e.owner=unit(e);e.ally=unit(e,'player',105);e.enemy=unit(e,'enemy',110);e.enemyAlly=unit(e,'enemy',115);
 for(const u of [e.owner,e.ally,e.enemy,e.enemyAlly]){u.hp=u.maxHp=1000;u.attackRange=1;u.atk=100;}
 e.owner.skillIds=[e.soul('soul_and_body').id,e.soul('black_assault').id];
 e.hit=(value,target=e.owner)=>e.applyActionDamage(e.enemy,target,e.normalizeSkillAction({type:'deal_damage',target:'enemy',rangeMode:'custom',rangeValue:1,damageType:'physical',coefficients:[{type:'fixed',value}]}),{id:'soul_test_hit',slot:'active'});
 e.enter=()=>e.hit(1000);return e;
}

test('soul reaper takes double body damage and lethal damage changes form without death or revive use',()=>{
 const e=soulEngine(),s=e.owner;s.revivesRemaining=2;e.hit(10);assert.equal(s.hp,980);
 e.enter();assert.equal(s.hp,0);assert.equal(s.alive,true);assert.equal(s.revivesRemaining,2);assert.equal(e.getBattleEvents('death').length,0);
 assert.equal(e.getLifeCycleForm(s).remainingTicks,600);assert.equal(e.getActiveBattleEntities(e.playerSquad).includes(s),false);
 assert.equal(e.canDirectlyTarget(e.enemy,s),false);assert.equal(e.canSquadContinueBattle(e.playerSquad),true);
 assert.equal(e.getEquippedSkills(s)[0].name,'영혼수확자 · 영혼입김');
 assert.ok(e.getLifeCycleFormLabel(s).includes('10.0초'));
});

test('soul reaper form blocks all incoming recovery damage and basic casts including periodic and proxy portions',()=>{
 const e=soulEngine(),s=e.owner;e.enter();s.mp=s.st=s.bp=0;
 for(const resource of ['HP','MP','ST','BP'])assert.equal(e.applyResourceGain(s,resource,100).gained,0);
 const heal=e.normalizeSkillAction({type:'heal',target:'ally',healResource:'HP',coefficients:[{type:'fixed',value:100}]});
 assert.equal(e.applyActionHeal(e.ally,s,heal),0);e.ally.hp=500;assert.equal(e.resolveSkillActionTarget(e.ally,heal,s),e.ally);
 e.hit(50);assert.equal(s.hp,0);assert.equal(s.alive,true);
 const periodic={damageType:'fixed',periodic:true,coefficients:[{type:'fixed',value:50}]};assert.equal(e.applyActionDamage(e.enemy,s,periodic),0);
 assert.equal(e.applyDamagePortion(e.enemy,s,periodic,null,100).actual,0);
 e.startCast(s,{type:'attack',target:e.enemy,skill:e.getUnitSkill(s)});assert.equal(s.pendingAction,null);
 assert.equal(e.applyActionResourceDrain(e.enemy,s,{drainResource:'HP',coefficients:[{type:'fixed',value:50}]}),0);
});

test('soul reaper returns after exactly ten seconds with full HP and body damage rules reset, then cycles again',()=>{
 const e=soulEngine(),s=e.owner;e.enter();
 for(let i=0;i<599;i++)e.updateBattleEffects();assert.equal(s.hp,0);assert.equal(e.getLifeCycleForm(s).remainingTicks,1);
 e.updateBattleEffects();assert.equal(s.hp,1000);assert.equal(e.getLifeCycleForm(s),undefined);assert.equal(e.isUnitBattleTargetable(s),true);
 assert.equal(e.getEquippedSkills(s)[0].name,'영혼수확자 · 검은습격');e.hit(10);assert.equal(s.hp,980);
 e.enter();assert.equal(e.getLifeCycleForm(s).remainingTicks,600);assert.equal(e.getBattleEvents('death').length,0);
 e.resetUnitForBattle(s);assert.equal(e.getLifeCycleForm(s),undefined);assert.equal(s.hp,1000);
});

test('soul reaper uses attack and stun in body and heals through the real combat actor loop in soul',()=>{
 const e=soulEngine(),s=e.owner,base=e.getEquippedSkills(s)[0];
 e.startCast(s,{type:'skill',target:e.enemy,skill:base});for(let i=0;i<30;i++)e.updateCast(s);
 assert.equal(e.enemy.hp,870);assert.equal(e.enemy.activeEffects.find(f=>f.state==='stun').remainingTicks,180);
 assert.equal(s.skillCooldowns[base.id],300);e.enter();assert.equal(s.skillCooldowns[base.id],300);
 const soulSkill=e.getEquippedSkills(s)[0];assert.equal(soulSkill.id,base.id);assert.equal(soulSkill.castTime,1);assert.equal(soulSkill.cooldown,3);
 e.ally.hp=100;s.skillCooldowns[base.id]=0;for(const u of [e.ally,e.enemy,e.enemyAlly])u.commandOnly=true;
 e.updateCombat();assert.equal(s.castTimer,60);for(let i=0;i<60;i++)e.updateCombat();
 assert.equal(e.ally.hp,200);assert.equal(s.hp,0);assert.equal(s.skillCooldowns[base.id],180);assert.equal(e.enemy.hp,870);
});

test('soul reaper remaining cooldown survives both form transitions and interrupted casts never leak prior form effects',()=>{
 const e=soulEngine(),s=e.owner,base=e.getEquippedSkills(s)[0];e.startCast(s,{type:'skill',target:e.enemy,skill:base});
 e.enter();assert.equal(s.pendingAction,null);assert.equal(e.enemy.hp,1000);
 const cd=s.skillCooldowns[base.id];assert.equal(cd,300);
 for(let i=0;i<600;i++)e.updateBattleEffects();assert.equal(s.skillCooldowns[base.id],cd);
 e.enter();s.skillCooldowns[base.id]=0;e.ally.hp=100;e.startCast(s,{type:'skill',target:e.ally,skill:e.getEquippedSkills(s)[0]});
 e.getLifeCycleForm(s).remainingTicks=1;e.updateBattleEffects();assert.equal(s.pendingAction,null);assert.equal(e.ally.hp,100);assert.equal(s.hp,1000);
});

test('soul reaper allies keep combat alive but only soul forms cannot continue battle',()=>{
 const e=soulEngine();e.enter();assert.equal(e.canSquadContinueBattle(e.playerSquad),true);
 e.ally.hp=0;e.syncAliveState(e.ally);assert.equal(e.canSquadContinueBattle(e.playerSquad),false);
 // Two soul forms also cannot win or stall a battle without a combat-capable ally.
 e.ally.alive=true;e.ally.hp=1000;e.ally.skillIds=[e.soul('soul_and_body').id,e.soul('black_assault').id];e.hit(1000,e.ally);
 assert.equal(e.getLifeCycleForm(e.ally).remainingTicks,600);assert.equal(e.canSquadContinueBattle(e.playerSquad),false);
});

test('soul reaper definitions and state-specific skill UI preserve shared slot and countdown',()=>{
 const e=soulEngine(),s=e.owner;const before=JSON.stringify(e.skillsJson);assert.equal(JSON.stringify(e.normalizeSkillJson(e.skillsJson)),before);
 s.role='healer';s.attackType='physical';assert.equal(e.getBasicBattleSkill(s).id,'skill_basic_weapon_attack');
 assert.equal(e.getSkillsForClass('영혼수확자').length,2);assert.equal(e.soul('black_assault').actions[0].rangeMode,'mainWeapon');assert.equal(e.soul('soul_breath').actions[0].rangeMode,'mainWeapon');
 e.document={addEventListener(){}};e.recordImagePath=()=>'';e.getRoleLabel=String;e.getUnitDps=()=>0;
 vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js','ui-battle-view.js'),'utf8'),e);
 assert.ok(e.renderBattleSkillRow(s).includes('검은습격'));e.renderBattleEngineEvents=()=>{};e.enter();s.skillCooldowns[e.soul('black_assault').id]=120;s.skillCooldownTotals[e.soul('black_assault').id]=300;
 assert.ok(e.renderBattleSkillRow(s).includes('영혼입김'));assert.ok(!e.renderBattleSkillRow(s).includes('검은습격'));
 const html=e.renderStatus(e.playerSquad,()=> 'blue');assert.ok(html.includes('육신 복귀 10.0초'));assert.ok(html.includes('2초'));
});

function keratinEngine() {
 const e=engine();e.skillsJson=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','skills.json'),'utf8')));
 e.keratin=id=>e.getSkillById('skill_class_keratin_'+id);e.owner=unit(e);e.owner.hp=e.owner.maxHp=1000;e.owner.attackRange=1;
 e.owner.skillIds=['shell','molt','repulsive_shield','pity'].map(id=>e.keratin(id).id);
 e.attack=(source,target,value=1,extra={})=>{
  const hit=e.normalizeSkillAction({type:'deal_damage',target:'enemy',rangeMode:'custom',rangeValue:1,damageType:'physical',coefficients:[{type:'fixed',value}],...extra});
  return e.applyActionDamage(source,target,{...hit,...extra},{id:'keratin_test_hit',slot:'active',actions:[hit]});
 };return e;
}

test('keratin passive adds each melee hit before reflecting, steps every ten, caps at one hundred and resets',()=>{
 const e=keratinEngine(),s=e.owner,enemy=unit(e,'enemy',105);enemy.hp=enemy.maxHp=100000;
 for(let i=0;i<9;i++)e.attack(enemy,s);assert.equal(s.activeEffects[0].stacks,9);assert.equal(s.defense,0);assert.equal(enemy.hp,100000-45);
 e.attack(enemy,s);assert.equal(s.defense,1);assert.ok(Math.abs(s.effectAttackRateMultiplier-.97)<1e-10);
 assert.equal(enemy.hp,100000-55);
 for(let i=10;i<101;i++)e.attack(enemy,s);
 assert.equal(s.activeEffects.find(f=>f.id==='keratin_stacks').stacks,100);assert.equal(s.defense,10);assert.ok(Math.abs(s.effectAttackRateMultiplier-.7)<1e-10);
 e.resetUnitForBattle(s);assert.equal(s.activeEffects.length,0);assert.equal(s.defense,undefined);
});

test('keratin passive ignores ranged periodic ally zero and reflected damage and cannot chain between owners',()=>{
 const e=keratinEngine(),s=e.owner,enemy=unit(e,'enemy',105),ally=unit(e,'player',105);enemy.hp=enemy.maxHp=1000;
 e.attack(enemy,s,1,{rangeValue:5});e.attack(enemy,s,1,{periodic:true});e.attack(ally,s);e.attack(enemy,s,0);e.attack(enemy,s,1,{reflected:true});
 assert.equal(s.activeEffects.length,0);
 enemy.skillIds=[e.keratin('shell').id];e.attack(enemy,s,1);assert.equal(s.activeEffects[0].stacks,1);assert.equal(enemy.activeEffects.length,0);
});

test('repulsive shield bursts once only when its own remaining amount is exhausted by enemy damage',()=>{
 const e=keratinEngine(),s=e.owner,enemy=unit(e,'enemy',110),near=unit(e,'enemy',140),far=unit(e,'enemy',141),ally=unit(e,'player',120);
 for(const u of [enemy,near,far]){u.hp=u.maxHp=1000;u.attackSpeed=1;u.speed=10;}
 s.skillIds=[e.keratin('repulsive_shield').id];s.bp=s.maxBp=30;e.applySkill(s,s,e.keratin('repulsive_shield'));assert.equal(e.getUnitBarrierValue(s),130);
 assert.equal(e.attack(enemy,s,60),60);assert.equal(e.getUnitBarrierValue(s),70);assert.equal(enemy.hp,1000);
 assert.equal(e.attack(enemy,s,40),40);assert.equal(s.hp,1000);assert.equal(s.bp,30);assert.equal(enemy.hp,950);assert.equal(near.hp,950);assert.equal(far.hp,1000);assert.equal(ally.hp,100);
 assert.equal(enemy.speed,8);assert.ok(Math.abs(enemy.effectAttackRateMultiplier-.7)<1e-10);
 e.attack(enemy,s,30);assert.equal(enemy.hp,950);assert.equal(e.getUnitBarrierValue(s),0);
 assert.equal(e.getBattleEvents('barrier_break').length,1);
});

test('repulsive shield expiry dispel refresh and friendly damage never explode',()=>{
 for(const reason of ['expiry','dispel','refresh','friendly']){
  const e=keratinEngine(),s=e.owner,enemy=unit(e,'enemy',110),ally=unit(e,'player',105);s.skillIds=[e.keratin('repulsive_shield').id];s.bp=s.maxBp=20;
  e.applySkill(s,s,e.keratin('repulsive_shield'));
  if(reason==='expiry')for(let i=0;i<180;i++)e.updateBattleEffects();
  if(reason==='dispel')e.applyTimedEffectAction(enemy,s,e.normalizeSkillAction({type:'delete_buff',effect:{id:'keratin_repulsive_shield',dispelMode:'id'}}));
  if(reason==='refresh'){e.attack(enemy,s,50);e.applySkill(s,s,e.keratin('repulsive_shield'));assert.equal(e.getUnitBarrierValue(s),120);}
  if(reason==='friendly')e.attack(ally,s,100);
  assert.equal(enemy.hp,100);assert.equal(e.getBattleEvents('barrier_break').length,0);assert.equal(s.bp,20);
 }
});

test('keratin molt uses three meter self area and independent defenses; pity chooses the higher offensive stat',()=>{
 const e=keratinEngine(),s=e.owner,near=unit(e,'enemy',130),far=unit(e,'enemy',131);s.atk=100;
 e.applySkill(s,near,e.keratin('molt'));assert.equal(near.hp,20);assert.equal(far.hp,100);assert.equal(s.defense,5);assert.equal(s.resistance,5);
 near.atk=150;near.magic=200;e.applySkill(s,near,e.keratin('pity'));assert.equal(near.atk,150);assert.equal(near.magic,100);
 far.atk=200;far.magic=150;e.applySkill(s,far,e.keratin('pity'));assert.equal(far.atk,100);assert.equal(far.magic,150);
 for(let i=0;i<300;i++)e.updateBattleEffects();assert.equal(s.defense,undefined);assert.equal(near.magic,200);assert.equal(far.atk,200);
});

test('keratin skill metadata preserves main weapon range, explicit exception, internal reaction and repeated normalization',()=>{
 const e=keratinEngine();assert.equal(e.getSkillsForClass('각질형').length,4);assert.equal(e.getEquippedSkills(e.owner).length,3);
 for(const id of ['shell','molt','repulsive_shield'])assert.ok(e.keratin(id).actions.every(a=>a.rangeMode==='mainWeapon'));
 assert.equal(e.keratin('pity').actions[0].rangeMode,'custom');assert.equal(e.keratin('pity').actions[0].rangeValue,5);
 const before=JSON.stringify(e.skillsJson);assert.equal(JSON.stringify(e.normalizeSkillJson(e.skillsJson)),before);
 assert.equal(e.isSkillExecutable(e.keratin('shell')),true);assert.equal(e.keratin('shell').actions[0].effect.maxStacks,100);
});

function serumEngine(options=[]) {
 const e=engine();e.skillsJson=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','skills.json'),'utf8')));
 e.serum=id=>e.getSkillById('skill_class_serum_'+id);e.owner=unit(e);e.owner.magic=100;
 e.owner.skillIds=['regeneration','drain','transfusion','barrier','conversion',...options].map(id=>e.serum(id).id);
 e.runtime=id=>e.getRuntimeSelectionSkill(e.owner,e.serum(id));return e;
}

test('serum optional enhancements are limited to three, conditional, and never cast as actions',()=>{
 const e=serumEngine(['component','endless_barrier','efficiency','fast_drain','drain_mania','mental_recovery']);
 assert.equal(e.limitOptionalSkillIds(e.owner.skillIds).length,8);
 assert.equal(e.runtime('transfusion').actions[0].coefficients[0].value,100);
 assert.equal(e.runtime('barrier').actions[0].fieldRadius,8);
 assert.equal(e.runtime('conversion').resourceCosts[0].value,5);
 assert.equal(e.runtime('drain').castTime,1.5);assert.equal(e.runtime('drain').cooldown,5);
 assert.equal(e.getEquippedSkills(e.owner).length,4);
 e.owner.skillIds=e.owner.skillIds.slice(0,5);assert.equal(e.runtime('transfusion').actions[0].coefficients[0].value,50);
 e.owner.skillIds.push(e.serum('fast_drain').id,e.serum('drain_mania').id);
 assert.equal(e.runtime('drain').castTime,.8);assert.equal(e.runtime('drain').cooldown,3);
 assert.equal(e.serum('drain').castTime,1.5);assert.equal(e.serum('drain').cooldown,5);
});

test('serum regeneration switches at ten seconds and damage resets it; optional mana only when selected',()=>{
 const e=serumEngine(),s=e.owner;s.hp=10;s.mp=0;
 for(let i=0;i<60;i++)e.updateBattleEffects();assert.equal(s.hp,12);assert.equal(s.mp,0);
 s.undamagedTicks=599;s.passiveRepeatTimers[e.serum('regeneration').id]=1;e.updateBattleEffects();assert.equal(s.hp,15);
 const enemy=unit(e,'enemy',110),hit=e.normalizeSkillAction({type:'deal_damage',target:'enemy',damageType:'fixed',coefficients:[{type:'fixed',value:1}]});
 e.applySkill(enemy,s,skill(e,hit));assert.equal(s.undamagedTicks,0);
 s.skillIds.push(e.serum('mental_recovery').id);s.passiveRepeatTimers[e.serum('regeneration').id]=1;e.updateBattleEffects();assert.equal(s.mp,5);
 s.undamagedTicks=599;s.passiveRepeatTimers[e.serum('regeneration').id]=1;e.updateBattleEffects();assert.equal(s.mp,11);
});

test('serum transfusion spends five percent per pulse and heals actual HP spent at selected rate',()=>{
 for(const selected of [false,true]){
  const e=serumEngine(selected?['component']:[]),s=e.owner,ally=unit(e,'player',105);ally.hp=10;
  const sk=e.runtime('transfusion');e.startCast(s,{type:'skill',target:ally,skill:sk});
  for(let i=0;i<180;i++){e.updateBattleChannel(s);e.updateProjectiles();}
  assert.equal(s.hp,85);assert.equal(ally.hp,selected?25:17.5);assert.equal(s.channelAction,null);
  assert.equal(s.skillCooldowns[sk.id],420);
 }
});

test('serum blood field counts enemies without damage and heals only at natural expiry',()=>{
 const e=serumEngine(),s=e.owner,a=unit(e,'enemy',120),b=unit(e,'enemy',150),far=unit(e,'enemy',190);s.hp=10;
 e.applySkill(s,s,e.runtime('barrier'));for(let i=0;i<239;i++)e.updateBattleFields();assert.equal(s.hp,10);
 e.updateBattleFields();assert.equal(s.hp,18);assert.equal(a.hp,100);assert.equal(b.hp,100);assert.equal(far.hp,100);
 s.skillIds.push(e.serum('endless_barrier').id);e.applySkill(s,s,e.runtime('barrier'));s.x=110;
 for(let i=0;i<240;i++)e.updateBattleFields();assert.equal(s.hp,30);
});

test('serum efficiency reduces only blood conversion payment and keeps mana recovery',()=>{
 for(const selected of [false,true]){
  const e=serumEngine(selected?['efficiency']:[]),s=e.owner;s.mp=0;const sk=e.runtime('conversion');
  const spent=e.spendSkillResourceCosts(s,sk);e.applySkill(s,s,sk,e.createSkillExecutionContext(spent));
  assert.equal(s.hp,selected?95:90);assert.equal(s.mp,2);
 }
});

test('serum channel stops on insufficient HP and interruption; dead field owner never receives stored healing',()=>{
 const e=serumEngine(),s=e.owner,ally=unit(e,'player',105);ally.hp=10;s.hp=4;
 e.startCast(s,{type:'skill',target:ally,skill:e.runtime('transfusion')});for(let i=0;i<60;i++)e.updateBattleChannel(s);
 assert.equal(s.channelAction,null);assert.equal(s.hp,4);assert.equal(ally.hp,10);
 s.hp=100;e.startCast(s,{type:'skill',target:ally,skill:e.runtime('transfusion')});e.finishBattleChannel(s,'test');
 for(let i=0;i<180;i++)e.updateBattleChannel(s);assert.equal(s.hp,100);assert.equal(ally.hp,10);
 unit(e,'enemy',110);s.hp=10;e.applySkill(s,s,e.runtime('barrier'));for(let i=0;i<60;i++)e.updateBattleFields();
 s.hp=0;s.alive=false;for(let i=0;i<240;i++)e.updateBattleFields();assert.equal(s.hp,0);
});

test('serum definitions normalize repeatedly without losing optional, pulse, and field settings',()=>{
 const e=serumEngine(),once=JSON.stringify(e.skillsJson);e.skillsJson=e.normalizeSkillJson(e.skillsJson);assert.equal(JSON.stringify(e.skillsJson),once);
 assert.equal(e.getSkillsForClass('혈청형').length,11);
 assert.equal(e.runtime('transfusion').channel.pulseResourceCosts[0].value,5);
 assert.equal(e.runtime('barrier').actions[0].fieldFollowSource,true);
});

function mageEngine(element='lightning',options=[]) {
 const e=engine();e.skillsJson=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'../data/skills.json'),'utf8')));
 const source=unit(e),target=unit(e,'enemy',110);source.magic=100;source.attackRange=5;source.hp=source.maxHp=1000;source.mp=source.maxMp=200;target.hp=target.maxHp=2000;
 source.skillIds=['element_choice','arrow','barrier','area','quick',...options].map(id=>'skill_class_mage_'+id);source.skillSelections={skill_class_mage_element_choice:element};
 e.publishBattleEvents([{type:'battle_entry',source,target:source}]);
 return {e,source,target,skill:name=>e.getEquippedSkills(source).find(s=>s.id==='skill_class_mage_'+name)};
}

test('mage ice choice requires equipped unlock and respects the three optional limit',()=>{
 const {e,source}=mageEngine('ice');const choice=e.getSkillById('skill_class_mage_element_choice');
 assert.equal(e.getChoiceSkillOption(choice,'ice',source.skillIds).id,'lightning');
 source.skillIds.push('skill_class_mage_forbidden_ice');assert.equal(e.getChoiceSkillOption(choice,'ice',source.skillIds).id,'ice');
 source.skillIds=['skill_class_mage_element_choice','skill_class_mage_efficient_arrow','skill_class_mage_explosive','skill_class_mage_numbing_strike','skill_class_mage_forbidden_ice'];
 assert.equal(e.getChoiceSkillOption(choice,'ice',source.skillIds).id,'lightning');assert.equal(e.resolveSelectedSkillIds(source.skillIds,source.skillSelections).includes('skill_class_mage_element_ice'),false);
});

test('mage wind earth and ice entry bonuses stay exclusive and do not grow on recalculation',()=>{
 const wind=mageEngine('wind');assert.equal(wind.source.maxMp,250);assert.equal(wind.source.mp,250);assert.ok(Math.abs(wind.skill('arrow').castTime-2.1)<1e-9);
 const earth=mageEngine('earth');assert.equal(earth.source.magic,105);assert.equal(earth.source.maxMp,200);assert.equal(earth.skill('arrow').resourceCosts[0].value,12);assert.equal(earth.skill('arrow').actions[0].coefficients[0].value,115);
 for(let i=0;i<3;i++){wind.e.recalculateBattleBuffs(wind.source);earth.e.recalculateBattleBuffs(earth.source);}assert.equal(wind.source.mp,250);assert.equal(earth.source.magic,105);
 const ice=mageEngine('ice',['forbidden_ice']);assert.equal(ice.source.defense,10);assert.equal(ice.target.activeEffects.length,0);
 ice.target.speed=2;ice.target.attackSpeed=2;ice.e.applySkill(ice.source,ice.target,ice.skill('quick'));assert.equal(ice.target.speed,1.6);assert.ok(Math.abs(ice.target.attackSpeed-2/.9)<1e-9);
 for(let i=0;i<120;i++)ice.e.updateBattleEffects();assert.equal(ice.target.speed,2);assert.equal(ice.target.attackSpeed,2);assert.equal(ice.source.defense,10);
});

test('mage lightning magnetic copies damage conditionally and never duplicates explosion',()=>{
 const {e,source,target,skill}=mageEngine('lightning',['magnetic_field','explosive']);const near=unit(e,'enemy',135);near.hp=near.maxHp=2000;
 e.applySkill(source,target,skill('arrow'));assert.equal(target.hp,1900);assert.equal(near.hp,1950);assert.equal(skill('arrow').castTime,2.8);
 const area=skill('area');assert.equal(area.actions[0].area,7);assert.equal(area.actions[0].coefficients[0].value,156);assert.equal(area.resourceCosts[0].value,24);assert.equal(area.actions[0].splashPercent ?? 0,0);
 e.applySkill(source,target,area);assert.equal(target.hp,1744);assert.equal(near.hp,1794);
 const wind=mageEngine('wind',['magnetic_field']);assert.equal(wind.skill('arrow').actions[0].splashPercent ?? 0,0);
});

test('mage timed barrier scales from magic copies thirty percent and leaves ordinary BP on expiry',()=>{
 const {e,source,skill}=mageEngine();const ally=unit(e,'player',115),far=unit(e,'player',140);source.bp=source.maxBp=40;
 e.applySkill(source,source,skill('barrier'));assert.equal(e.getUnitBarrierValue(source),140);assert.equal(e.getUnitBarrierValue(ally),30);assert.equal(e.getUnitBarrierValue(far),0);
 for(let i=0;i<300;i++)e.updateBattleEffects();assert.equal(e.getUnitBarrierValue(source),40);assert.equal(e.getUnitBarrierValue(ally),0);
});

test('mage regenerative barrier heals half generated amount and removes exactly one harmful effect',()=>{
 const {e,source,skill}=mageEngine('earth',['regenerative_barrier']);source.hp=500;
 for(const id of ['one','two'])e.applyTimedEffectAction(source,source,e.normalizeSkillAction({type:'add_state',duration:20,effect:{id,name:id,state:'root',polarity:'harmful'}}));
 const barrier=skill('barrier');e.dispatchSkillActions(source,source,barrier,false);
 assert.ok(Math.abs(e.getUnitBarrierValue(source)-120.75)<1e-9);assert.ok(Math.abs(source.hp-560.375)<1e-9);assert.equal(source.activeEffects.filter(x=>x.polarity==='harmful').length,1);
});

test('mage selected efficient arrow and numbing strike affect only selected skills and damage recipients',()=>{
 const {e,source,target,skill}=mageEngine('wind',['efficient_arrow','numbing_strike']);assert.equal(skill('arrow').resourceCosts[0].value,5);assert.equal(skill('quick').cooldown,6);assert.equal(skill('quick').resourceCosts[0].value,10);
 e.applySkill(source,target,skill('quick'));assert(e.hasBattleState(target,'stun'));assert.equal(target.hp,1850);
 const bare=mageEngine('wind');assert.equal(bare.skill('arrow').resourceCosts[0].value,10);assert.equal(bare.skill('quick').actions.length,1);
 const lightning=mageEngine('lightning',['numbing_strike']);const nearby=unit(lightning.e,'enemy',125);nearby.hp=nearby.maxHp=2000;
 lightning.e.applySkill(lightning.source,lightning.target,lightning.skill('quick'));assert(lightning.e.hasBattleState(nearby,'stun'));assert.equal(nearby.hp,1955);
});

function knightEngine(options=[]) {
 const e=engine();e.skillsJson=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'../data/skills.json'),'utf8')));
 e.horseDefinition=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/entities/knight_magic_horse.json'),'utf8'));vm.runInContext('entitiesJson.push(horseDefinition)',e);
 const owner=unit(e),enemy=unit(e,'enemy',150);owner.atk=100;owner.speed=2;owner.attackRange=1;owner.hp=owner.maxHp=1000;enemy.hp=enemy.maxHp=2000;
 const id=s=>'skill_class_knight_'+s;
 owner.skillIds=['magic_horse','haste_horse','charge','pierce','spinning_slash',...options].map(id);
 e.publishBattleEvents([{type:'battle_entry',source:owner,target:owner}]);
 return {e,owner,enemy,skill:s=>e.getEquippedSkills(owner).find(row=>row.id===id(s)),horse:()=>e.getLivingOwnedSummons(owner,'knight_magic_horse')[0]};
}

test('knight variants keep independent costs cooldowns and recheck mount at completion',()=>{
 const {e,owner,skill,horse}=knightEngine(['stable']);
 const haste=skill('haste_horse');assert.equal(haste.castTime,0);assert.equal(haste.cooldown,5);assert.equal(e.getSkillResourceCosts(haste)[0].value,0);
 e.resolveSkillCast(owner,{skill:haste,target:owner});assert.equal(owner.skillCooldowns[haste.id],300);
 horse().hp=0;e.syncAliveState(horse());
 const summon=skill('summon_horse');assert.equal(summon.cooldown,25);assert.equal(summon.castTime,3);assert.equal(summon.resourceCosts[0].value,50);
 assert.equal(e.canActivateSkill(owner,haste),false);assert.equal(e.canActivateSkill(owner,summon),true);
 const mp=owner.mp;assert(e.tryUseReadySkill(owner,e.playerSquad,e.enemySquad));assert.equal(owner.mp,mp-50);assert.equal(owner.castTimer,180);
 for(let i=0;i<180;i++)e.updateCast(owner);
 assert(horse());assert.equal(horse().hp,500);assert.equal(owner.skillCooldowns[summon.id],1500);assert.equal(owner.skillCooldowns[haste.id],300);
 assert.equal(e.canActivateSkill(owner,summon),false);assert.equal(skill('haste_horse').id,haste.id);
});

test('knight charge uses actual collision-limited distance for damage and knockback',()=>{
 const {e,owner,enemy,skill}=knightEngine(['battlefield_ruler']);const charge=skill('charge');assert.equal(charge.cooldown,5);
 const start=owner.x,enemyStart=enemy.x;e.dispatchSkillActions(owner,enemy,charge,false);
 const moved=(owner.x-start)/10;assert(moved>0 && moved<5);assert.equal(2000-enemy.hp,150+moved*50);
 assert.ok(Math.abs((enemy.x-enemyStart)/10-(moved+2))<1e-9);
});

test('knight optional defense toggles with mount and march buffs only one nearby ally',()=>{
 const {e,owner,skill,horse}=knightEngine(['vulnerable','march']);owner.defense=0;e.recalculateBattleBuffs(owner);assert.equal(owner.defense,0);
 const ally=unit(e,'player',110),other=unit(e,'player',120),far=unit(e,'player',200);ally.atk=other.atk=far.atk=100;
 e.applySkill(owner,owner,skill('haste_horse'));assert.equal(ally.atk,120);assert.equal(other.atk,100);assert.equal(far.atk,100);
 horse().hp=0;e.syncAliveState(horse());e.updateBattleEffects();assert.equal(owner.defense,10);assert.equal(owner.speed,2);
 e.applySkill(owner,owner,skill('summon_horse'));e.updateBattleEffects();assert.equal(owner.defense,0);assert.equal(owner.speed,2.6);
});

test('knight pierce and spin honor weapon range selected debuff and both combo stages',()=>{
 const {e,owner,enemy,skill}=knightEngine(['prey','spinning_wind']);enemy.x=110;enemy.defense=30;enemy.speed=2;
 const pierce=skill('pierce');assert.equal(pierce.actions[0].rangeMode,'mainWeapon');e.applySkill(owner,enemy,pierce);assert.equal(enemy.hp,1900);assert.equal(enemy.defense,10);assert.equal(enemy.speed,1);
 const spin=skill('spinning_slash');const stage=e.getRuntimeComboSkill(owner,spin);assert.equal(stage.actions[0].area,6);assert.equal(stage.resourceCosts[0].value,5);
 e.resolveSkillCast(owner,{skill:stage,target:enemy});assert.equal(enemy.hp,1820);assert.equal(owner.skillCooldowns[spin.id],30);
 const second=e.getRuntimeComboSkill(owner,spin);assert.equal(second.actions[0].area,6);e.resolveSkillCast(owner,{skill:second,target:enemy});assert.equal(enemy.hp,1700);assert.equal(owner.skillCooldowns[spin.id],600);
 const bare=knightEngine();assert.equal(bare.skill('spinning_slash').combo.stages[0].actions[0].area,3);assert.equal(bare.skill('pierce').actions.length,2);
});

function engine() {
  const context = {
    window: {}, performance, structuredClone, playerSquad: [], enemySquad: [], projectiles: [],
    BASE_ATTACK_COOLDOWN: 60, ATTACK_RANGE_UNIT: 10, COLLISION_DISTANCE: 20, UNIT_RADIUS: 5, PROJECTILE_SPEED: 1000,
    ROLE_STATS:{melee:{speedMultiplier:1},ranged:{speedMultiplier:1},healer:{speedMultiplier:1},tank:{speedMultiplier:1}},EXHAUSTED_MOVE_MULTIPLIER:.5,
    canvas: {width: 1000, height: 1000}, DEFAULT_RESOURCE_VALUE: 100, MP_ACTION_COST:5, ST_PHYSICAL_ATTACK_COST:10,
    EFFECT_DURATION: 5, skillsJson: [],
    createStats: () => ({damage: 0, taken: 0, heal: 0}),
    getCastDuration: unit => unit.castSpeed * 60,
    getAttackCooldown: () => 60,
    getUnitRange: unit => unit.attackRange * 10,
    getUnitAttackType: unit => unit.attackType || 'physical',
    getReducedDamage: (source, target, type, amount) => amount,
    getUnitTeamBattleRules: () => ({damagePercent:100,healingPercent:100,resourceCostPercent:100,cooldownPercent:100}),
    snapshotActiveBattleSideRules: () => ({player:{damagePercent:100,healingPercent:100,resourceCostPercent:100,cooldownPercent:100},enemy:{damagePercent:100,healingPercent:100,resourceCostPercent:100,cooldownPercent:100}}),
    normalizeBattleRules: rules => ({entryDelay:Math.max(0,Number(rules?.entryDelay)||0),reviveCount:Math.max(0,Math.min(10,Math.floor(Number(rules?.reviveCount)||0))),reviveDelay:Math.max(0,Number(rules?.reviveDelay)||0),reviveHpPercent:Math.max(1,Math.min(100,Number(rules?.reviveHpPercent)||50)),reviveMpPercent:Math.max(0,Math.min(100,Number(rules?.reviveMpPercent??100))),reviveStPercent:Math.max(0,Math.min(100,Number(rules?.reviveStPercent??100))),reviveInvulnerable:Math.max(0,Number(rules?.reviveInvulnerable)||0),revivePosition:rules?.revivePosition==='start'?'start':'death'}),
    formatBattleEventValue: String,
    log() {}, escapeHtml: String,
  };
  vm.createContext(context);
  // Records also use the shared portrait normalizer; load its real implementation without DOM bindings.
  const uiSource=fs.readFileSync(path.join(__dirname,'..','js/ui.js'),'utf8');
  const portraitStart=uiSource.indexOf('function normalizePortrait(value) {');
  vm.runInContext(uiSource.slice(portraitStart,uiSource.indexOf('\n}',portraitStart)+2),context);
  const abilityStart=uiSource.indexOf('function getStatAbilityBonus(');
  vm.runInContext(uiSource.slice(abilityStart,uiSource.indexOf('\n}',abilityStart)+2),context);
  for (const file of ['js/battle-events.js', 'js/skill-channel.js', 'js/skill-passives.js', 'js/skill-effects.js', 'js/skill.js', 'js/rune.js', 'js/entity.js', 'js/battle.js', 'js/record.js', 'js/monster.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context);
  }
  // Most effect tests exercise combat after the opening ultimate lockout.
  vm.runInContext('combatEventTick = 1800;', context);
  return context;
}
function unit(e, side = 'player', x = 100) {
  const u = {name: side, side, maxHp: 100, maxMp: 100, maxSt: 100,
    atk: 10, magic: 20, x, y: 100, castSpeed: 1, attackRange: 5};
  e.resetUnitForBattle(u);
  (side === 'player' ? e.playerSquad : e.enemySquad).push(u);
  return u;
}
test('zero cooldown blessings skip active recipients and return after expiry',()=>{
 const e=engine(),caster=unit(e),ally=unit(e,'player',105);
 const action=e.createDefaultAction('add_buff');action.effect.id='blessing';action.duration=30;
 const buff=skill(e,action);buff.cooldown=0;e.skillsJson=[buff];caster.skillIds=[buff.id];
 assert(e.tryUseReadySkill(caster,e.playerSquad,[]));
 assert.equal(caster.activeEffects.length,1);
 assert(e.tryUseReadySkill(caster,e.playerSquad,[]));
 assert.equal(ally.activeEffects.length,1);
 assert.equal(e.tryUseReadySkill(caster,e.playerSquad,[]),false);
 caster.activeEffects[0].remainingTicks=null;
 assert.equal(e.tryUseReadySkill(caster,e.playerSquad,[]),false);
 caster.activeEffects=[];
 assert(e.tryUseReadySkill(caster,e.playerSquad,[]));
 buff.cooldown=2;caster.skillCooldowns[buff.id]=0;
 assert(e.tryUseReadySkill(caster,e.playerSquad,[]));
});

test('spring energy keeps two stat effects but displays one icon',()=>{
 const e=engine(),caster=unit(e);
 const data=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/skills.json'),'utf8'));
 const spring=e.normalizeSkillJson(data).find(s=>s.id==='skill_class_monk_spring_energy');
 e.applySkill(caster,caster,spring);
 assert.equal(caster.activeEffects.length,2);
 assert.equal(e.getBattleEffectIconEntries(caster).length,1);
 caster.activeEffects[1].remainingTicks--;
 assert.equal(e.getBattleEffectIconEntries(caster).length,2);
});

function skill(e, action, castTime = 0) {
  if (action.type === 'summon_entity') {
    const config = action.summon || {};
    const entity = e.createDefaultEntity();
    entity.entityId = 'test_entity_' + (e.entitySequence = (e.entitySequence || 0) + 1);
    entity.role = config.role || 'melee'; entity.ai = entity.role;
    for (const key of Object.keys(entity.stats)) if(config[key] != null) entity.stats[key] = config[key];
    e.newEntity = entity; vm.runInContext('entitiesJson.push(newEntity)', e);
    action = {type:'summon_entity',target:config.target,entityId:entity.entityId,summonCenter:config.summonCenter,inheritStats:config.inheritStats,count:config.count,limit:config.limit,duration:config.lifetime,
      protectOwnerPercent:config.protectOwnerPercent,protectOwnerScope:config.protectOwnerScope,protectOwnerPriority:config.protectOwnerPriority,
      transferStateScope:config.transferStateScope,transferStatePriority:config.transferStatePriority};
  }
  return e.normalizeSkillJson([{id:'test',name:'test',castTime,cooldown:2,actions:[action]}]).find(s => s.id === 'test');
}

function immunitySkill(e, immunity, duration=1) {
  const action=e.createDefaultAction('add_buff');action.target='self';action.duration=duration;
  action.effect.id='ward';action.effect.mode='immunity';action.effect.immunity=immunity;
  return skill(e,action);
}

test('category dispel respects polarity, kind and undispellable effects from multiple casters', () => {
  const e=engine(),source=unit(e),other=unit(e),target=unit(e,'enemy',105);
  for(const [id,category,polarity,dispellable] of [['magic_bad','magic','harmful',true],['magic_good','magic','beneficial',true],['physical','physical','harmful',true],['locked','magic','harmful',false]]) {
    const action=e.createDefaultAction('add_state');Object.assign(action.effect,{id,category,polarity,dispellable});
    e.applySkill(source,target,skill(e,action));
    if(id==='magic_bad')e.applySkill(other,target,skill(e,action));
  }
  const buff=e.createDefaultAction('add_buff');buff.target='enemy';Object.assign(buff.effect,{id:'buff',category:'magic',polarity:'harmful'});
  e.applySkill(source,target,skill(e,buff));
  const remove=e.createDefaultAction('delete_state');remove.target='enemy';Object.assign(remove.effect,{id:'',dispelMode:'category',dispelCategory:'magic',dispelPolarity:'harmful'});
  const s=skill(e,remove);assert.equal(e.isSkillExecutable(s),true);e.applySkill(source,target,s);
  assert.deepEqual(Array.from(target.activeEffects,x=>x.id),['magic_good','physical','locked','buff']);
  assert.equal(e.resolveSkillActionTarget(source,s.actions[0]),null);
  s.actions[0].effect.dispelMode='all';s.actions[0].effect.dispelPolarity='any';e.applySkill(source,target,s);
  assert.deepEqual(Array.from(target.activeEffects,x=>x.id),['locked','buff']);
  s.actions[0].effect.dispelMode='id';s.actions[0].effect.id='locked';assert.equal(e.resolveSkillActionTarget(source,s.actions[0]),null);
});

test('specific immunity blocks only matching new states and preserves existing effects and direct damage', () => {
  const e=engine(),source=unit(e),target=unit(e,'enemy',105);
  const old=e.createDefaultAction('add_state');old.effect.id='old';old.effect.category='magic';
  e.applySkill(source,target,skill(e,old));
  const ward=immunitySkill(e,{scope:'state',category:'magic',state:'stun'});e.applySkill(target,target,ward);
  assert.equal(target.atk,10);assert(e.hasBattleState(target,'stun'));
  old.effect.id='new';e.applySkill(source,target,skill(e,old));assert(!target.activeEffects.some(x=>x.id==='new'));
  old.effect.state='root';e.applySkill(source,target,skill(e,old));assert(e.hasBattleState(target,'root'));
  old.effect.id='physical';old.effect.state='stun';old.effect.category='physical';e.applySkill(source,target,skill(e,old));assert(target.activeEffects.some(x=>x.id==='physical'));
  e.applySkill(source,target,skill(e,{type:'deal_damage',coefficients:[{type:'fixed',value:10}]}));assert.equal(target.hp,90);
});

test('harmful immunity allows beneficial buffs, blocks periodic effects and ends at expiry', () => {
  const e=engine(),source=unit(e),target=unit(e,'enemy',105);
  e.applySkill(target,target,immunitySkill(e,{scope:'harmful',category:'all',state:'all'}));
  const debuff=e.createDefaultAction('add_buff');debuff.target='enemy';debuff.effect.polarity='harmful';debuff.effect.value=-5;
  e.applySkill(source,target,skill(e,debuff));assert.equal(target.atk,10);
  e.applySkill(source,target,periodicSkill(e));assert.equal(target.activeEffects.length,1);
  debuff.effect.polarity='beneficial';debuff.effect.value=5;e.applySkill(source,target,skill(e,debuff));assert.equal(target.atk,15);
  for(let i=0;i<60;i++)e.updateBattleEffects();
  e.applySkill(source,target,periodicSkill(e));assert(target.activeEffects.some(x=>x.id==='periodic'));
});

test('immunity can refresh itself and be dispelled; removing immunity from its definition does not leave protection', () => {
  const e=engine(),source=unit(e),target=unit(e,'enemy',105),ward=immunitySkill(e,{scope:'all',category:'all',state:'all'});
  e.applySkill(target,target,ward);e.updateBattleEffects();e.applySkill(target,target,ward);
  assert.equal(target.activeEffects.length,1);assert.equal(target.activeEffects[0].remainingTicks,60);
  const dispel=e.createDefaultAction('delete_buff');dispel.target='enemy';dispel.effect.id='ward';
  e.applySkill(source,target,skill(e,dispel));assert.equal(target.activeEffects.length,0);
  e.applySkill(target,target,ward);delete ward.actions[0].effect.immunity;ward.actions[0].effect.mode='flat';ward.actions[0].effect.value=0;
  e.applySkill(target,target,ward);assert.equal(target.activeEffects[0].immunity,undefined);
  e.applySkill(source,target,skill(e,e.createDefaultAction('add_state')));assert(e.hasBattleState(target,'stun'));
});

test('legacy effect defaults and immunity configurations roundtrip without activating unknown categories', () => {
  const e=engine();
  const old=e.normalizeSkillAction({type:'add_state',effect:{id:'old',state:'root'},duration:1});
  assert.equal(old.effect.category,'general');assert.equal(old.effect.polarity,'harmful');assert.equal(old.effect.dispellable,true);
  const ward=immunitySkill(e,{scope:'state',category:'magic',state:'all'});
  assert.equal(JSON.stringify(e.normalizeSkillJson([ward]).find(s=>s.id===ward.id)),JSON.stringify(ward));
  const invalid=structuredClone(ward.actions[0]);invalid.effect.immunity.category='unknown';assert.equal(e.isSkillActionSupported(invalid),false);
  assert.equal(JSON.stringify(e.normalizeSkillAction(invalid)),JSON.stringify(invalid));
});

function equipPassive(e,owner,event,action,extra={}) {
  const id='passive_'+e.skillsJson.length;
  const passive=e.normalizeSkillJson([{id,name:id,slot:'passive',cooldown:0,castTime:5,passiveTrigger:{event,chance:100,includePeriodic:false},actions:[action],...extra}]).find(s=>s.id===id);
  e.skillsJson.push(passive);owner.skillIds=[...(owner.skillIds??[]),id];return passive;
}

test('equipped passive triggers on hit, uses resources and cooldown, without interrupting casting', () => {
  const e=engine(),source=unit(e),target=unit(e,'enemy',105);source.hp=50;
  const passive=equipPassive(e,source,'hit',{type:'heal',target:'self',coefficients:[{type:'fixed',value:10}]},{cooldown:1,resourceCosts:[{resource:'MP',mode:'fixed',value:5}]});
  const attack=skill(e,{type:'deal_damage',coefficients:[{type:'fixed',value:1}]},1);
  e.startCast(source,{type:'skill',target,skill:attack});
  e.applySkill(source,target,attack);assert.equal(source.hp,60);assert.equal(source.mp,95);assert.equal(source.castTimer,60);
  assert.equal(source.skillCooldowns[passive.id],60);assert.equal(e.getEquippedSkills(source).length,0);
  e.applySkill(source,target,attack);assert.equal(source.hp,60);
  for(let i=0;i<60;i++){e.tickSkillCooldowns(source);vm.runInContext('combatEventTick++',e);}
  e.applySkill(source,target,attack);assert.equal(source.hp,70);assert.equal(source.mp,90);
});

test('passive damage type filter converts only matching actual damage and selects the most injured ally in range', () => {
  const e=engine(),source=unit(e),ally=unit(e,'player',120),far=unit(e,'player',300),enemy=unit(e,'enemy',105);
  source.hp=90;ally.hp=40;far.hp=10;
  const healing={type:'heal',target:'ally',rangeMode:'custom',rangeValue:10,maxTargets:1,healResource:'HP',coefficients:[{type:'calculated',field:'triggerActualDamage',calc:'percent',value:30}]};
  const passive=equipPassive(e,source,'hit',healing,{passiveTrigger:{event:'hit',chance:100,damageType:'physical',includePeriodic:false,allowMultiplePerTick:true}});
  const physical=skill(e,{type:'deal_damage',target:'enemy',damageType:'physical',coefficients:[{type:'fixed',value:20}]});
  const magic=skill(e,{type:'deal_damage',target:'enemy',damageType:'magic',coefficients:[{type:'fixed',value:20}]});
  e.applySkill(source,enemy,magic);assert.equal(ally.hp,40);
  e.applySkill(source,enemy,physical);assert.equal(ally.hp,46);assert.equal(source.hp,90);assert.equal(far.hp,10);
  assert.equal(passive.passiveTrigger.damageType,'physical');
  const legacy=e.normalizePassiveTrigger({event:'hit',chance:100,damageType:'unknown'});
  assert.equal(Object.hasOwn(legacy,'damageType'),false);
});

test('adaptive buffs choose the higher offense and multi-event passives require an effect from their caster', () => {
  const e=engine(),priest=unit(e),magicAlly=unit(e,'player',120),attackAlly=unit(e,'player',130),otherBlessed=unit(e,'player',140),enemy=unit(e,'enemy',105);
  const otherPriest=unit(e,'player',150);
  Object.assign(magicAlly,{atk:40,magic:160,hp:40});Object.assign(attackAlly,{atk:100,magic:50,hp:40});otherBlessed.hp=40;
  const blessing=e.normalizeSkillJson([{id:'blessing',name:'blessing',slot:'active',actions:[{type:'add_buff',target:'ally',rangeMode:'custom',rangeValue:100,duration:30,effect:{id:'priest_blessing',name:'blessing',stat:'adaptiveOffense',mode:'percent',value:5}}]}]).find(skill=>skill.id==='blessing');
  e.applySkill(priest,magicAlly,blessing);e.applySkill(priest,attackAlly,blessing);e.applySkill(otherPriest,otherBlessed,blessing);
  assert.deepEqual(Array.from(magicAlly.activeEffects,effect=>[effect.stat,effect.adaptiveStat,effect.value]),[['magic','adaptiveOffense',5]]);
  assert.equal(magicAlly.magic,168);assert.equal(magicAlly.atk,40);assert.equal(attackAlly.atk,105);assert.equal(attackAlly.magic,50);
  const resonance=e.normalizeSkillJson([{id:'resonance',name:'resonance',slot:'passive',cooldown:0,passiveTrigger:{events:['hit','heal'],chance:100,allowMultiplePerTick:true},actions:[{type:'heal',target:'ally',rangeMode:'custom',rangeValue:1000,requiredTargetEffectId:'priest_blessing',requiredTargetEffectCaster:'self',area:1000,areaCenter:'self',coefficients:[{type:'calculated',field:'triggerActualAmount',calc:'percent',value:5}]}]}]).find(skill=>skill.id==='resonance');
  e.skillsJson=[resonance];priest.skillIds=[resonance.id];
  e.applyActionDamage(priest,enemy,{type:'deal_damage',target:'enemy',damageType:'fixed',coefficients:[{type:'fixed',value:100}]});
  assert.equal(magicAlly.hp,45);assert.equal(attackAlly.hp,45);assert.equal(otherBlessed.hp,40);
  e.applyActionHeal(priest,otherBlessed,{type:'heal',target:'ally',healResource:'HP',coefficients:[{type:'fixed',value:20}]});
  assert.equal(magicAlly.hp,46);assert.equal(attackAlly.hp,46);assert.equal(otherBlessed.hp,60);
  assert.deepEqual(Array.from(resonance.passiveTrigger.events),['hit','heal']);
});

test('attacker and defender passives run on both sides without recursive retaliation', () => {
  for(const side of ['player','enemy']) {
    const e=engine(),source=unit(e,side),target=unit(e,side==='player'?'enemy':'player',105);
    const damage={type:'deal_damage',target:'enemy',coefficients:[{type:'fixed',value:3}]};
    equipPassive(e,source,'hit',damage);equipPassive(e,target,'damaged',damage);
    e.applySkill(source,target,skill(e,{type:'deal_damage',target:'enemy',coefficients:[{type:'fixed',value:10}]}));
    assert.equal(source.hp,97);assert.equal(target.hp,87);
    assert.equal(e.getBattleEvents('hit').filter(event=>event.triggered).length,2);
    const before=target.hp;e.applySkill(source,target,skill(e,{type:'deal_damage',target:'enemy',coefficients:[{type:'fixed',value:1}]}));
    assert.equal(target.hp,before-1);
  }
});

test('cast completion healing and kill conditions fire for their owner but never for a dead owner', () => {
  const e=engine(),source=unit(e),target=unit(e,'enemy',105);source.hp=30;
  const healing={type:'heal',target:'self',coefficients:[{type:'fixed',value:10}]};
  equipPassive(e,source,'cast_complete',healing);equipPassive(e,source,'heal',healing);equipPassive(e,source,'kill',healing);
  equipPassive(e,target,'damaged',healing);
  e.startCast(source,{type:'skill',target,skill:skill(e,{type:'deal_damage',coefficients:[{type:'fixed',value:200}]})});
  assert.equal(source.hp,50);assert.equal(target.alive,false);assert.equal(target.hp,0);
  e.applySkill(source,source,skill(e,{type:'heal',target:'self',coefficients:[{type:'fixed',value:1}]}));
  assert.equal(source.hp,61);
});

test('passives require valid configuration resources targets and successful probability', () => {
  const e=engine(),source=unit(e),target=unit(e,'enemy',105);source.hp=50;
  const passive=equipPassive(e,source,'hit',{type:'heal',target:'self',coefficients:[{type:'fixed',value:10}]},{passiveTrigger:{event:'hit',chance:0},resourceCosts:[{resource:'MP',value:5,mode:'fixed'}]});
  const attack=skill(e,{type:'deal_damage',coefficients:[{type:'fixed',value:1}]});
  e.applySkill(source,target,attack);assert.equal(source.hp,50);assert.equal(source.mp,100);
  passive.passiveTrigger.chance=100;source.mp=0;e.applySkill(source,target,attack);assert.equal(source.hp,50);
  source.mp=100;source.hp=100;e.applySkill(source,target,attack);assert.equal(source.mp,100);
  const old=e.normalizeSkillJson([{id:'old',name:'old',slot:'passive',actions:[{type:'heal'}]}]).find(s=>s.id==='old');
  assert.equal(e.isSkillExecutable(old),false);assert.equal(old.passiveTrigger,null);
  assert.equal(JSON.stringify(e.normalizeSkillJson([passive]).find(s=>s.id===passive.id)),JSON.stringify(passive));
});

test('periodic opt-in works but periodic effects created by passives cannot trigger another passive', () => {
  const e=engine(),source=unit(e),target=unit(e,'enemy',105);source.hp=30;
  const passive=equipPassive(e,source,'hit',{type:'heal',target:'self',coefficients:[{type:'fixed',value:10}]});
  const dot=periodicSkill(e,'damage',3);
  e.applySkill(source,target,dot);for(let i=0;i<60;i++)e.updateBattleEffects();assert.equal(source.hp,30);
  passive.passiveTrigger.includePeriodic=true;
  for(let i=0;i<60;i++)e.updateBattleEffects();assert.equal(source.hp,40);
  vm.runInContext('combatEventTick++',e);e.clearBattleEffects(target);
  e.applySkill(source,target,{...dot,triggered:true});
  for(let i=0;i<60;i++)e.updateBattleEffects();assert.equal(source.hp,40);
  assert.equal(e.getBattleEvents('hit').at(-1).triggered,true);
});

test('damage publishes ordered hit, damaged and single death events with actual HP loss', () => {
  const e=engine(),source=unit(e),target=unit(e,'enemy',105);
  target.hp=5;
  const s=skill(e,{type:'deal_damage',target:'enemy',coefficients:[{type:'fixed',value:20}]});
  e.applySkill(source,target,s);
  const events=e.getBattleEvents();
  assert.deepEqual(Array.from(events,x=>x.type),['hit','damaged','death']);
  assert.equal(events[0].amount,5);assert.equal(events[0].hpDamage,5);assert.equal(events[0].barrierDamage,0);
  e.syncAliveState(target);e.applyActionDamage(source,target,s.actions[0],s);
  assert.equal(e.getBattleEvents('death').length,1);
  source.name='changed';assert.equal(events[0].source.name,'player');
  assert.doesNotThrow(()=>JSON.stringify(events));
});

test('barrier hit and actual resource healing publish independent event amounts', () => {
  const e=engine(),source=unit(e),target=unit(e,'enemy',105);
  target.bp=3;
  e.applySkill(source,target,skill(e,{type:'deal_damage',coefficients:[{type:'fixed',value:20}]}));
  const hit=e.getBattleEvents('hit')[0];assert.equal(hit.amount,3);assert.equal(hit.barrierDamage,3);assert.equal(hit.hpDamage,0);
  source.mp=97;
  const heal=skill(e,{type:'heal',target:'self',healResource:'MP',coefficients:[{type:'fixed',value:10}]});
  e.applySkill(source,source,heal);e.applySkill(source,source,heal);
  assert.equal(e.getBattleEvents('heal').length,1);assert.equal(e.getBattleEvents('heal')[0].amount,3);assert.equal(e.getBattleEvents('heal')[0].resource,'MP');
});

test('instant delayed and interrupted casts publish phases once, with completion before impact', () => {
  const e=engine(),source=unit(e),target=unit(e,'enemy',105);
  const s=skill(e,{type:'deal_damage',coefficients:[{type:'fixed',value:10}]},0);
  e.startCast(source,{type:'skill',target,skill:s});
  assert.deepEqual(Array.from(e.getBattleEvents(),x=>x.type),['cast_start','cast_complete','hit','damaged']);
  e.resetBattleEvents();s.castTime=1;e.startCast(source,{type:'skill',target,skill:s});
  assert.equal(e.getBattleEvents('cast_complete').length,0);
  e.interruptBattleCast(source,'test');for(let i=0;i<60;i++)e.updateCast(source);
  assert.deepEqual(Array.from(e.getBattleEvents(),x=>x.type),['cast_start','cast_interrupt']);
  e.resetBattleEvents();e.startCast(source,{type:'skill',target,skill:s});
  e.applySkill(target,source,skill(e,{type:'deal_damage',coefficients:[{type:'fixed',value:200}]}));
  assert.equal(e.getBattleEvents('cast_interrupt').length,1);assert.equal(e.getBattleEvents('death').length,1);
});

test('periodic events preserve caster identity and previews are excluded', () => {
  const e=engine(),source=unit(e),target=unit(e,'enemy',105),s=periodicSkill(e,'damage',1);
  e.applySkill(source,target,s);source.alive=false;
  for(let i=0;i<60;i++)e.updateBattleEffects();
  const event=e.getBattleEvents('hit')[0];assert.equal(event.periodic,true);assert.equal(event.skillId,s.id);assert.equal(event.source.name,source.name);
  e.resetBattleEvents();source.alive=true;source.isEntityPreview=true;
  e.applySkill(source,target,skill(e,{type:'deal_damage',coefficients:[{type:'fixed',value:10}]}));
  assert.equal(e.getBattleEvents().length,0);
});

test('event listeners can unsubscribe and nested emissions are queued and bounded', () => {
  const e=engine(),source=unit(e),target=unit(e,'enemy');let received=0;
  const off=e.subscribeBattleEvent('hit',()=>received++);
  e.publishBattleEvents([{type:'hit',source,target}]);off();e.publishBattleEvents([{type:'hit',source,target}]);assert.equal(received,1);
  const stop=e.subscribeBattleEvent('hit',()=>e.publishBattleEvents([{type:'hit',source,target}]));
  e.resetBattleEvents();e.publishBattleEvents([{type:'hit',source,target}]);
  assert.equal(e.getBattleEvents().length,8);stop();
  for(let i=0;i<1100;i++)e.publishBattleEvents([{type:'heal',source,target,amount:1}]);
  assert.equal(e.getBattleEvents().length,1000);
  e.resetBattleEvents();assert.equal(e.getBattleEvents().length,0);
});

function periodicSkill(e,type='damage',duration=2) {
  const action=e.createDefaultAction(type==='damage'?'add_state':'add_buff');
  action.duration=duration;action.effect.id='periodic';action.effect.state='periodic';action.effect.mode='periodic';
  action.effect.periodic={type,interval:1,value:10,damageType:'fixed',resource:'HP'};
  return skill(e,action);
}

test('periodic damage waits one interval and includes the final tick at expiration', () => {
  const e=engine(),source=unit(e),target=unit(e,'enemy',105),s=periodicSkill(e);
  e.applySkill(source,target,s);assert.equal(target.hp,100);assert.equal(e.hasBattleState(target,'stun'),false);
  for(let i=0;i<59;i++)e.updateBattleEffects();assert.equal(target.hp,100);
  e.updateBattleEffects();assert.equal(target.hp,90);
  for(let i=0;i<60;i++)e.updateBattleEffects();assert.equal(target.hp,80);assert.equal(target.activeEffects.length,0);
  assert.equal(source.stats.damage,20);
  for(let i=0;i<60;i++)e.updateBattleEffects();assert.equal(target.hp,80);
});

test('refresh and stacking preserve the next periodic tick and cleanup cancels further ticks', () => {
  const e=engine(),source=unit(e),target=unit(e,'enemy',105),s=periodicSkill(e);
  s.actions[0].effect.stackMode='stack';s.actions[0].effect.maxStacks=2;
  e.applySkill(source,target,s);for(let i=0;i<59;i++)e.updateBattleEffects();
  e.applySkill(source,target,s);e.updateBattleEffects();assert.equal(target.hp,80);
  const dispel=e.createDefaultAction('delete_state');dispel.target='enemy';dispel.effect.id='periodic';
  e.applySkill(source,target,skill(e,dispel));
  for(let i=0;i<120;i++)e.updateBattleEffects();assert.equal(target.hp,80);
});

test('periodic healing caps HP MP ST and adds BP without changing base stats', () => {
  for(const resource of ['HP','MP','ST','BP']) {
    const e=engine(),source=unit(e),target=unit(e,'player',105),s=periodicSkill(e,'heal',1);
    s.actions[0].effect.periodic.resource=resource;target[resource.toLowerCase()]=resource==='BP'?0:95;
    e.applySkill(source,target,s);assert.equal(target.atk,10);
    for(let i=0;i<60;i++)e.updateBattleEffects();
    assert.equal(target[resource.toLowerCase()],resource==='BP'?10:100);
    assert.equal(source.stats.heal,resource==='BP'?10:5);
  }
});

test('periodic effects honor barrier and defense rules, keep caster attribution after caster death, and never revive', () => {
  const e=engine(),source=unit(e),target=unit(e,'enemy',105),s=periodicSkill(e,'damage',3);
  s.actions[0].effect.periodic.damageType='physical';target.bp=5;
  e.getReducedDamage=(_source,_target,type,value)=>type==='physical'?value/2:value;
  e.applySkill(source,target,s);source.alive=false;
  for(let i=0;i<60;i++)e.updateBattleEffects();assert.equal(target.bp,0);assert.equal(target.hp,100);
  for(let i=0;i<60;i++)e.updateBattleEffects();assert.equal(target.hp,95);assert.equal(source.stats.damage,10);
  target.hp=3;
  for(let i=0;i<60;i++)e.updateBattleEffects();assert.equal(target.alive,false);assert.equal(target.activeEffects.length,0);
});

test('periodic data roundtrips and invalid timing is locked instead of silently running', () => {
  const e=engine(),s=periodicSkill(e);
  assert.equal(JSON.stringify(e.normalizeSkillJson([s]).find(x=>x.id===s.id)),JSON.stringify(s));
  for(const interval of [0,-1,Infinity,'bad']) {
    const action=structuredClone(s.actions[0]);action.effect.periodic.interval=interval;
    assert.equal(e.isSkillActionSupported(action),false);
    assert.equal(JSON.stringify(e.normalizeSkillAction(action)),JSON.stringify(action));
  }
  const source=unit(e),target=unit(e,'enemy',105);
  e.applySkill(source,target,s);
  const action=e.createDefaultAction('add_state');action.effect.id='periodic';
  e.applySkill(source,target,skill(e,action));
  for(let i=0;i<60;i++)e.updateBattleEffects();assert.equal(target.hp,100);
});

test('buff stacks cap, refresh their shared duration and restore exact base stats on expiry', () => {
  const e=engine(),source=unit(e),target=unit(e,'player',105);
  const action=e.createDefaultAction('add_buff');action.duration=1;action.effect.stackMode='stack';action.effect.maxStacks=2;
  const s=skill(e,action);
  e.applySkill(source,target,s);assert.equal(target.atk,20);
  for(let i=0;i<30;i++)e.updateBattleEffects();
  e.applySkill(source,target,s);e.applySkill(source,target,s);
  assert.equal(target.atk,30);assert.equal(target.activeEffects.length,1);assert.equal(target.activeEffects[0].stacks,2);
  for(let i=0;i<59;i++)e.updateBattleEffects();assert.equal(target.atk,30);
  e.updateBattleEffects();assert.equal(target.atk,10);assert.equal(target.activeEffects.length,0);
});

test('independent casters and flat/percent buffs use the original base and selective dispel', () => {
  const e=engine(),a=unit(e),b=unit(e),target=unit(e,'player',105);
  const buff=e.createDefaultAction('add_buff');buff.duration=0;
  e.applySkill(a,target,skill(e,buff));e.applySkill(b,target,skill(e,buff));
  const percent=structuredClone(buff);percent.effect.id='percent';percent.effect.mode='percent';percent.effect.value=50;
  e.applySkill(a,target,skill(e,percent));assert.equal(target.atk,35);
  assert.doesNotThrow(()=>JSON.stringify(target));
  const dispel=e.createDefaultAction('delete_buff');dispel.target='ally';
  e.applySkill(a,target,skill(e,dispel));assert.equal(target.atk,15);assert.equal(target.activeEffects.length,1);
  assert.equal(e.resolveSkillActionTarget(a,e.normalizeSkillAction(dispel)),null);
  e.resetUnitForBattle(target);assert.equal(target.atk,10);assert.equal(target.activeEffects.length,0);
});

test('refresh never accumulates and death clears indefinite buffs including missing stat properties', () => {
  const e=engine(),source=unit(e),target=unit(e,'player',105);
  const action=e.createDefaultAction('add_buff');action.duration=0;action.effect.stat='speed';action.effect.value=2;
  const s=skill(e,action);
  e.applySkill(source,target,s);e.applySkill(source,target,s);assert.equal(target.speed,3);assert.equal(target.activeEffects[0].stacks,1);
  for(let i=0;i<100;i++)e.updateBattleEffects();assert.equal(target.speed,3);
  target.alive=false;e.updateBattleEffects();assert.equal('speed' in target,false);
});

test('stun interrupts casting, starts cooldown and blocks actions and movement until expiry', () => {
  const e=engine(),source=unit(e),target=unit(e,'enemy',105);
  const attack=skill(e,{type:'deal_damage',target:'enemy',coefficients:[{type:'fixed',value:10}]},1);
  e.startCast(target,{type:'skill',target:source,skill:attack});assert.equal(target.castTimer,60);
  const state=e.createDefaultAction('add_state');state.duration=0.1;
  e.applySkill(source,target,skill(e,state));
  assert.equal(target.castTimer,0);assert.equal(target.pendingAction,null);assert.equal(target.skillCooldowns[attack.id],120);
  e.startCast(target,{type:'skill',target:source,skill:attack});assert.equal(target.castTimer,0);
  const x=target.x;e.moveUnit(target,[source]);assert.equal(target.x,x);
  for(let i=0;i<6;i++)e.updateBattleEffects();assert.equal(e.hasBattleState(target,'stun'),false);
  e.startCast(target,{type:'skill',target:source,skill:attack});assert.equal(target.castTimer,60);
});

test('root blocks normal and skill movement while silence permits basic attacks and can be cleansed', () => {
  const e=engine(),source=unit(e),target=unit(e,'enemy',105);
  const state=e.createDefaultAction('add_state');state.effect.state='root';state.effect.id='root';
  e.applySkill(source,target,skill(e,state));
  const x=target.x;e.moveUnit(target,[source]);e.applyActionMove(target,source,{distance:10});assert.equal(target.x,x);
  const move=skill(e,{type:'move',target:'enemy'});assert.equal(e.resolveSkillTarget(target,move),null);
  const silence=structuredClone(state);silence.effect.state='silence';silence.effect.id='silence';
  e.applySkill(source,target,skill(e,silence));assert.equal(e.tryUseReadySkill(target,[target],[source]),false);
  target.castSpeed=0;e.startCast(target,{type:'attack',target:source});assert(source.hp<100);
  const cleanse=e.createDefaultAction('delete_state');cleanse.target='self';cleanse.effect.id='silence';
  e.applySkill(target,target,skill(e,cleanse));assert.equal(e.hasBattleState(target,'silence'),false);assert.equal(e.hasBattleState(target,'root'),true);
});

test('effect schemas preserve valid settings while unknown states remain locked', () => {
  const e=engine();
  for(const type of ['add_buff','delete_buff','add_state','delete_state']) {
    const action=e.normalizeSkillAction(e.createDefaultAction(type));
    assert.equal(e.isSkillActionSupported(action),true);
    assert.equal(JSON.stringify(e.normalizeSkillAction(action)),JSON.stringify(action));
  }
  const unknown={type:'add_state',effect:{id:'hidden',state:'stealth'},duration:8};
  assert.equal(e.isSkillActionSupported(unknown),false);
  assert.equal(JSON.stringify(e.normalizeSkillAction(unknown)),JSON.stringify(unknown));
});

test('chains select nearest unvisited targets from each hit on either side and respect caps', () => {
  for(const side of ['player','enemy']) {
    const e=engine(), source=unit(e,side), opposite=side==='player'?'enemy':'player';
    const first=unit(e,opposite,140), second=unit(e,opposite,165), third=unit(e,opposite,190), far=unit(e,opposite,230);
    const dead=unit(e,opposite,145);dead.alive=false;
    const s=skill(e,{type:'deal_damage',target:'enemy',chainCount:3,chainRange:3,coefficients:[{type:'fixed',value:10}]});
    assert.deepEqual(Array.from(e.getSkillActionTargets(source,first,s.actions[0])),[first,second,third]);
    e.applySkill(source,first,s);
    assert.deepEqual([first.hp,second.hp,third.hp,far.hp,dead.hp,source.hp],[90,90,90,100,100,100]);
    s.actions[0].maxTargets=2;assert.equal(e.getSkillActionTargets(source,first,s.actions[0]).length,2);
    s.actions[0].chainCount=1;s.actions[0].maxTargets=0;assert.equal(e.getSkillActionTargets(source,first,s.actions[0]).length,2);
  }
});

test('healing chains skip full resources and enemy units', () => {
  const e=engine(),source=unit(e),first=unit(e,'player',110),full=unit(e,'player',115),next=unit(e,'player',130),foe=unit(e,'enemy',120);
  first.mp=next.mp=foe.mp=20;
  const s=skill(e,{type:'heal',target:'ally',healResource:'MP',chainCount:5,chainRange:3,coefficients:[{type:'fixed',value:10}]});
  e.applySkill(source,first,s);
  assert.deepEqual([first.mp,next.mp,full.mp,foe.mp],[30,30,100,20]);
});

test('chain starts at projectile impact, overrides area and leaves a visual path', () => {
  const e=engine(),source=unit(e),first=unit(e,'enemy',140),next=unit(e,'enemy',160);
  const s=skill(e,{type:'deal_damage',target:'enemy',chainCount:1,chainRange:3,area:10,areaCenter:'self',coefficients:[{type:'fixed',value:10}]});
  e.isBattleRunning=true;e.startCast(source,{type:'skill',target:first,skill:s});
  assert.equal(first.hp,100);assert.equal(next.hp,100);assert.equal(e.projectiles.length,1);
  assert.equal(e.getSkillAreaIndicators().length,0);
  e.updateProjectiles();assert.equal(first.hp,90);assert.equal(next.hp,90);
  assert.equal(vm.runInContext('skillChainImpacts[0].points.length',e),2);
  next.x=300;e.startCast(source,{type:'skill',target:first,skill:s});e.updateProjectiles();
  assert.equal(first.hp,80);assert.equal(next.hp,90);
});

test('chain settings normalize safely and preserve disabled legacy area behavior', () => {
  const e=engine();
  const action=e.normalizeSkillAction({type:'heal',chainCount:2,chainRange:1.5});
  assert.equal(e.normalizeSkillAction(action).chainRange,1.5);
  assert.equal(e.normalizeSkillAction({type:'deal_damage',chainCount:999}).chainCount,20);
  for(const value of [-1,Infinity,'invalid']) assert.equal(e.normalizeSkillAction({type:'heal',chainCount:value}).chainCount,0);
  const old=e.normalizeSkillAction({type:'deal_damage',area:5});
  assert.equal(old.chainCount,0);assert.equal(old.chainRange,3);assert.equal(old.area,5);
});

test('minimum range defaults safely and survives normalization', () => {
  const e=engine();
  for(const value of [undefined,-2,Infinity,'invalid']) assert.equal(e.normalizeSkillAction({type:'deal_damage',minRange:value}).minRange,0);
  const action=e.normalizeSkillAction({type:'heal',minRange:2.5});
  assert.equal(e.normalizeSkillAction(action).minRange,2.5);
  assert.equal(e.createDefaultAction().minRange,0);
});

test('minimum and maximum boundaries are inclusive for damage healing and movement on either side', () => {
  for(const side of ['player','enemy']) for(const type of ['deal_damage','heal','move']) {
    const e=engine(),source=unit(e,side),target=unit(e,type==='heal'?side:side==='player'?'enemy':'player',120);
    target.hp=50;
    const action=e.normalizeSkillAction({type,target:type==='heal'?'ally':'enemy',minRange:2,rangeMode:'custom',rangeValue:5});
    assert.equal(e.resolveSkillActionTarget(source,action),target);
    target.x=150;assert.equal(e.resolveSkillActionTarget(source,action),target);
    target.x=119;assert.equal(e.resolveSkillActionTarget(source,action),null);
    target.x=151;assert.equal(e.resolveSkillActionTarget(source,action),null);
    action.minRange=6;target.x=150;assert.equal(e.resolveSkillActionTarget(source,action),null);
  }
});

test('too-close targets prevent resource spending and are rechecked at cast completion', () => {
  const e=engine(),source=unit(e),target=unit(e,'enemy',110);
  const s=skill(e,{type:'deal_damage',target:'enemy',minRange:2,coefficients:[{type:'fixed',value:20}]},0.5);
  s.resourceCosts=[{resource:'MP',mode:'fixed',value:10}];e.skillsJson=[s];source.skillIds=[s.id];
  const mp=source.mp;
  assert.equal(e.tryUseReadySkill(source,e.playerSquad,e.enemySquad),false);assert.equal(source.mp,mp);
  target.x=130;assert.equal(e.tryUseReadySkill(source,e.playerSquad,e.enemySquad),true);
  assert.equal(source.mp,mp-10);target.x=110;
  for(let i=0;i<30;i++)e.updateCast(source);
  assert.equal(target.hp,100);assert.equal(e.projectiles.length,0);
});

test('minimum distance limits the area anchor rather than splash hits and excludes self effects', () => {
  const e=engine(),source=unit(e),near=unit(e,'enemy',110),anchor=unit(e,'enemy',130);
  const s=skill(e,{type:'deal_damage',target:'enemy',minRange:2,area:3,coefficients:[{type:'fixed',value:10}]});
  assert.equal(e.resolveSkillActionTarget(source,s.actions[0],near),anchor);
  e.applySkill(source,near,s);assert.equal(near.hp,90);assert.equal(anchor.hp,90);
  s.actions[0].areaCenter='self';s.actions[0].minRange=10;
  assert.equal(e.resolveSkillActionTarget(source,s.actions[0]),near);
  assert.equal(e.getActionMinimumRangePixels({type:'heal',target:'self',minRange:10}),0);
  assert.equal(e.getActionMinimumRangePixels({type:'summon_entity',minRange:10}),0);
});

test('mixed damage and healing use separate projectiles and matching area indicators on either side', () => {
  for (const side of ['player','enemy']) {
    const e=engine(), source=unit(e,side), foe=unit(e,side==='player'?'enemy':'player',140), ally=unit(e,side,60);
    ally.hp=40;e.isBattleRunning=true;
    const s=skill(e,{type:'deal_damage',target:'enemy',area:1,coefficients:[{type:'fixed',value:15}]},0.5);
    s.actions.push(e.normalizeSkillAction({type:'heal',target:'ally',area:1,coefficients:[{type:'fixed',value:20}]}));
    e.startCast(source,{type:'skill',target:foe,skill:s});
    assert.deepEqual(Array.from(e.getSkillAreaIndicators(),a=>a.x),[140,60]);
    for(let i=0;i<30;i++)e.updateCast(source);
    assert.deepEqual(Array.from(e.projectiles,p=>p.target),[foe,ally]);
    assert.deepEqual(Array.from(e.getSkillAreaIndicators(),a=>a.x),[140,60]);
    e.updateProjectiles();
    assert.equal(foe.hp,85);assert.equal(ally.hp,60);assert.equal(source.hp,100);
    assert.equal(source.skillCooldowns[s.id],120);
  }
});

test('each action enforces its own range and one unavailable action does not block another', () => {
  const e=engine(), source=unit(e), foe=unit(e,'enemy',140), ally=unit(e,'player',110);ally.hp=30;
  const s=skill(e,{type:'deal_damage',target:'enemy',rangeMode:'custom',rangeValue:2,coefficients:[{type:'fixed',value:15}]});
  s.actions.push(e.normalizeSkillAction({type:'heal',target:'ally',rangeMode:'custom',rangeValue:1,coefficients:[{type:'fixed',value:20}]}));
  e.skillsJson=[s];source.skillIds=[s.id];
  assert.equal(e.resolveSkillTarget(source,s,e.playerSquad,e.enemySquad),ally);
  assert.equal(e.tryUseReadySkill(source,e.playerSquad,e.enemySquad),true);
  assert.equal(foe.hp,100);assert.equal(ally.hp,50);
  ally.hp=100;assert.equal(e.resolveSkillTarget(source,s,e.playerSquad,e.enemySquad),null);
});

test('cast completion reselects dead or out-of-range targets without cancelling other actions', () => {
  const e=engine(), source=unit(e), foe=unit(e,'enemy',110), replacement=unit(e,'enemy',105), ally=unit(e,'player',105);
  ally.hp=40;
  const s=skill(e,{type:'deal_damage',target:'enemy',coefficients:[{type:'fixed',value:15}]},0.5);
  s.actions.push(e.normalizeSkillAction({type:'heal',target:'ally',coefficients:[{type:'fixed',value:20}]}));
  e.startCast(source,{type:'skill',target:foe,skill:s});foe.alive=false;
  for(let i=0;i<30;i++)e.updateCast(source);
  assert.equal(replacement.hp,85);assert.equal(ally.hp,60);
  e.startCast(source,{type:'skill',target:replacement,skill:s});replacement.x=300;
  for(let i=0;i<30;i++)e.updateCast(source);
  assert.equal(replacement.hp,85);assert.equal(ally.hp,80);
});

test('healing selects deficient HP MP and ST independently and self-centered healing includes allies', () => {
  const e=engine(), source=unit(e), ally=unit(e,'player',105), other=unit(e,'player',108);
  ally.mp=20;other.st=30;other.hp=40;
  for(const [resource,expected] of [['MP',ally],['ST',other],['HP',other]]) {
    const action=e.normalizeSkillAction({type:'heal',target:'ally',healResource:resource});
    assert.equal(e.resolveSkillActionTarget(source,action),expected);
  }
  const area=skill(e,{type:'heal',target:'self',area:2,coefficients:[{type:'fixed',value:10}]});
  assert.equal(e.resolveSkillTarget(source,area,e.playerSquad,e.enemySquad),other);
  e.applySkill(source,source,area);assert.equal(other.hp,50);
});

test('a projectile stays assigned to its action and a dead enemy does not cancel the healing projectile', () => {
  const e=engine(),source=unit(e),foe=unit(e,'enemy',140),ally=unit(e,'player',60),spare=unit(e,'enemy',130);ally.hp=40;
  const s=skill(e,{type:'deal_damage',target:'enemy',coefficients:[{type:'fixed',value:15}]});
  s.actions.push(e.normalizeSkillAction({type:'heal',target:'ally',coefficients:[{type:'fixed',value:20}]}));
  e.startCast(source,{type:'skill',target:foe,skill:s});foe.alive=false;ally.x=300;
  e.updateProjectiles();assert.equal(ally.hp,60);assert.equal(spare.hp,100);assert.equal(e.projectiles.length,0);
});

test('explicit zero casts immediately, positive time waits, missing time inherits', () => {
  const e=engine(), source=unit(e), target=unit(e,'enemy',110);
  const s=skill(e, {type:'deal_damage', coefficients:[{type:'fixed',value:10}]});
  e.startCast(source,{type:'skill',target,skill:s});
  assert.equal(target.hp,90); assert.equal(source.castTimer,0);
  s.castTime=0.5;
  e.startCast(source,{type:'skill',target,skill:s});
  assert.equal(source.castTimer,30);
  for(let i=0;i<29;i++) e.updateCast(source);
  assert.equal(target.hp,90);
  e.updateCast(source); assert.equal(target.hp,80);
  s.castTime=null;
  e.startCast(source,{type:'skill',target,skill:s});
  assert.equal(source.castTimer,60);
});

test('area damage respects radius, team, alive state and target limit', () => {
  const e=engine(), source=unit(e), friend=unit(e), target=unit(e,'enemy',150);
  const near=unit(e,'enemy',160), edge=unit(e,'enemy',170), outside=unit(e,'enemy',171);
  const dead=unit(e,'enemy',150); dead.alive=false;
  const s=skill(e,{type:'deal_damage',target:'enemy',area:2,maxTargets:2,coefficients:[{type:'fixed',value:10}]});
  e.applySkill(source,target,s);
  assert.deepEqual([target.hp,near.hp,edge.hp,outside.hp,friend.hp,dead.hp],[90,90,100,100,100,100]);
  s.actions[0].maxTargets=0; e.applySkill(source,target,s); assert.equal(edge.hp,90);
});

test('self-centered allied area heals HP and grants BP without healing enemies', () => {
  const e=engine(), source=unit(e), friend=unit(e,'player',110), enemy=unit(e,'enemy',110);
  source.hp=friend.hp=enemy.hp=50;
  const s=skill(e,{type:'heal',target:'ally',area:2,areaCenter:'self',coefficients:[{type:'fixed',value:10}]});
  e.applySkill(source,friend,s);
  assert.deepEqual([source.hp,friend.hp,enemy.hp],[60,60,50]);
  s.actions[0].healResource='BP'; e.applySkill(source,friend,s);
  assert.deepEqual([source.bp,friend.bp,enemy.bp],[10,10,0]);
  s.actions[0].area=0; e.applySkill(source,enemy,s); assert.equal(enemy.bp,0);
});

test('summons have independent stats, owner limits, expiry, records and can attack', () => {
  const e=engine(), source=unit(e), enemy=unit(e,'enemy',110);
  const s=skill(e,{type:'summon_entity',summon:{count:3,limit:2,lifetime:0.1,hp:70,atk:7,speed:0}});
  e.applySkill(source,source,s);
  assert.equal(e.playerSquad.length,3);
  const summon=e.playerSquad[1]; assert.equal(summon.hp,70); assert.equal(summon.speed,0);
  assert.notEqual(summon.stats,source.stats);
  e.applySkill(source,source,s); assert.equal(e.playerSquad.length,3);
  assert.equal(e.resolveSkillTarget(source,s,e.playerSquad,e.enemySquad),null);
  summon.x=enemy.x;summon.y=enemy.y;
  e.doAttack(summon,enemy); assert.equal(enemy.hp,93);
  const records=e.createRecordMembers(e.playerSquad,1); assert.equal(records.length,1);
  assert.doesNotThrow(()=>JSON.stringify(records));
  for(let i=0;i<6;i++) e.updateSummonLifetimes();
  assert.equal(summon.alive,false);
  e.applySkill(source,source,s); assert.equal(e.playerSquad.filter(u=>u.alive).length,3);
});

test('enemy summons, unlimited lifetime and side cap work', () => {
  const e=engine(), source=unit(e,'enemy');
  for(let i=0;i<5;i++) {
    const s=skill(e,{type:'summon_entity',summon:{count:10,limit:20,lifetime:0}}); s.id='s'+i;
    e.applySkill(source,source,s);
  }
  assert.equal(e.enemySquad.length,41);
  e.updateSummonLifetimes(); assert.equal(e.enemySquad[1].alive,true);
});

test('new settings survive repeated normalization and invalid numbers are bounded', () => {
  const e=engine();
  const s=skill(e,{type:'summon_entity',summon:{count:100,limit:-1,lifetime:Infinity}},0);
  assert.equal(s.actions[0].count,10); assert.equal(s.actions[0].limit,1);
  assert.equal(s.actions[0].duration,0); assert.equal('summon' in s.actions[0],false);
  assert.equal(JSON.stringify(e.normalizeSkillJson([s]).find(x=>x.id===s.id)),JSON.stringify(s));
  const a=skill(e,{type:'heal',area:3,areaCenter:'self',maxTargets:4},1.5);
  assert.equal(JSON.stringify(e.normalizeSkillJson([a]).find(x=>x.id===a.id)),JSON.stringify(a));
  const protectedSummon=skill(e,{type:'summon_entity',summon:{protectOwnerPercent:150,protectOwnerScope:'basic',protectOwnerPriority:2000,transferStateScope:'magic',transferStatePriority:5}},0);
  assert.deepEqual([protectedSummon.actions[0].protectOwnerPercent,protectedSummon.actions[0].protectOwnerScope,protectedSummon.actions[0].protectOwnerPriority,protectedSummon.actions[0].transferStateScope,protectedSummon.actions[0].transferStatePriority],[100,'basic',999,'magic',5]);
  assert.equal(JSON.stringify(e.normalizeSkillJson([protectedSummon]).find(x=>x.id===protectedSummon.id)),JSON.stringify(protectedSummon));
});

test('summons can spawn around a selected ally or enemy using action range',()=>{
  const e=engine(),source=unit(e),enemy=unit(e,'enemy',300),ally=unit(e,'player',250);
  const enemySummon=skill(e,{type:'summon_entity',summon:{target:'enemy',summonCenter:'target',lifetime:0}});enemySummon.actions[0].rangeMode='custom';enemySummon.actions[0].rangeValue=30;
  assert.equal(e.resolveSkillActionTarget(source,enemySummon.actions[0]),enemy);e.applySkill(source,enemy,enemySummon);
  const first=e.playerSquad[2];assert(Math.hypot(first.x-enemy.x,first.y-enemy.y)<=21);assert(Math.hypot(first.x-source.x,first.y-source.y)>100);
  const allySummon=skill(e,{type:'summon_entity',summon:{target:'ally',summonCenter:'target',lifetime:0}});allySummon.actions[0].rangeMode='custom';allySummon.actions[0].rangeValue=30;
  assert.equal(e.resolveSkillActionTarget(source,allySummon.actions[0]),ally);e.applySkill(source,ally,allySummon);
  const second=e.playerSquad[3];assert(Math.hypot(second.x-ally.x,second.y-ally.y)<=21);
  enemy.alive=false;assert.equal(e.resolveSkillActionTarget(source,enemySummon.actions[0]),null);
});

test('summons snapshot configured percentages of the owner current combat stats',()=>{
  const e=engine(),source=unit(e);Object.assign(source,{maxHp:240,maxMp:180,maxSt:160,atk:50,magic:40,defense:30,resistance:20,speed:6});
  const inheritStats={hp:50,mp:25,st:10,atk:100,magic:50,defense:20,resistance:30,speed:50};
  const summonSkill=skill(e,{type:'summon_entity',summon:{hp:100,mp:100,st:100,atk:10,magic:10,defense:10,resistance:10,speed:1,inheritStats,lifetime:0}});
  e.applySkill(source,source,summonSkill);const summon=e.playerSquad[1];
  assert.deepEqual([summon.maxHp,summon.maxMp,summon.maxSt,summon.atk,summon.magic,summon.defense,summon.resistance,summon.speed],[220,145,116,60,30,16,16,4]);
  Object.assign(source,{atk:500,maxHp:1000});assert.deepEqual([summon.maxHp,summon.atk],[220,60]);
  const normalized=e.normalizeSkillAction({...summonSkill.actions[0],inheritStats:{...inheritStats,hp:5000,atk:-20}});
  assert.equal(normalized.inheritStats.hp,1000);assert.equal(normalized.inheritStats.atk,0);
  assert.equal(JSON.stringify(e.normalizeSkillAction(normalized)),JSON.stringify(normalized));
});

test('owned summon target group excludes allies and summons from other owners',()=>{
  const e=engine(),owner=unit(e),otherOwner=unit(e),enemy=unit(e,'enemy',200);
  const firstSkill=skill(e,{type:'summon_entity',summon:{count:2,lifetime:0}});firstSkill.id='owner_summons';e.applySkill(owner,owner,firstSkill);
  const otherSkill=skill(e,{type:'summon_entity',summon:{lifetime:0}});otherSkill.id='other_summon';e.applySkill(otherOwner,otherOwner,otherSkill);
  const owned=e.playerSquad.filter(unit=>unit.isSummon&&unit.summoner===owner),foreign=e.playerSquad.find(unit=>unit.isSummon&&unit.summoner===otherOwner);
  const buff=e.createDefaultAction('add_buff');buff.target='summon';buff.area=20;buff.effect.id='summon_power';buff.effect.stat='atk';buff.effect.value=5;
  e.applySkill(owner,owned[0],skill(e,buff));
  assert.equal(owned.every(unit=>unit.activeEffects.some(effect=>effect.id==='summon_power')),true);
  assert.equal(foreign.activeEffects.length,0);assert.equal(otherOwner.activeEffects.length,0);
  const sacrifice=e.createDefaultAction('deal_damage');sacrifice.target='summon';sacrifice.coefficients=[{type:'fixed',value:25}];sacrifice.rangeMode='custom';sacrifice.rangeValue=100;
  assert.equal(e.resolveSkillActionTarget(owner,e.normalizeSkillAction(sacrifice)),owned[0]);e.applySkill(owner,owned[0],skill(e,sacrifice));
  assert.equal(owned[0].hp,75);assert.equal(foreign.hp,100);assert.equal(enemy.hp,100);
});

test('summon commands hold release recall and dismiss only owned summons',()=>{
  const e=engine(),owner=unit(e),otherOwner=unit(e),enemy=unit(e,'enemy',500);
  const summonSkill=skill(e,{type:'summon_entity',summon:{speed:3,lifetime:0}});summonSkill.id='mine';e.applySkill(owner,owner,summonSkill);
  const foreignSkill=skill(e,{type:'summon_entity',summon:{speed:4,lifetime:0}});foreignSkill.id='foreign';e.applySkill(otherOwner,otherOwner,foreignSkill);
  const mine=e.playerSquad.find(unit=>unit.isSummon&&unit.summoner===owner),foreign=e.playerSquad.find(unit=>unit.isSummon&&unit.summoner===otherOwner);
  const command=mode=>{const action=e.createDefaultAction('command_summon');Object.assign(action,{summonCommand:mode,rangeMode:'custom',rangeValue:100});return skill(e,action)};
  e.applySkill(owner,mine,command('hold'));assert.deepEqual([mine.ai,mine.speed],['stationary',0]);assert.equal(foreign.speed,4);
  e.applySkill(owner,mine,command('release'));assert.deepEqual([mine.ai,mine.speed],['melee',3]);
  mine.x=400;mine.y=100;e.applySkill(owner,mine,command('recall'));assert(Math.hypot(mine.x-owner.x,mine.y-owner.y)<=21);
  e.applySkill(owner,mine,command('dismiss'));assert.equal(mine.alive,false);assert.equal(foreign.alive,true);
  assert.equal(e.getBattleEvents('summon_command').length,4);
});

test('timed effects support area targeting, target caps and independent instances',()=>{
  const e=engine(),source=unit(e),ally=unit(e,'player',110),other=unit(e,'player',120),enemy=unit(e,'enemy',110);
  const buff=e.createDefaultAction('add_buff');buff.target='ally';buff.area=2;buff.maxTargets=2;buff.effect.id='area_guard';buff.effect.stat='defense';buff.effect.value=7;
  e.applySkill(source,ally,skill(e,buff));
  assert.equal(ally.activeEffects.some(effect=>effect.id==='area_guard'),true);
  assert.equal(source.activeEffects.some(effect=>effect.id==='area_guard'),true);
  assert.equal(other.activeEffects.some(effect=>effect.id==='area_guard'),false);assert.equal(enemy.activeEffects.length,0);
  assert.notEqual(ally.activeEffects[0],source.activeEffects[0]);
  const state=e.createDefaultAction('add_state');state.target='enemy';state.area=3;state.effect.id='area_stun';state.effect.state='stun';
  const enemy2=unit(e,'enemy',120);e.applySkill(source,enemy,skill(e,state));
  assert.equal(enemy.activeEffects.some(effect=>effect.id==='area_stun'),true);assert.equal(enemy2.activeEffects.some(effect=>effect.id==='area_stun'),true);
});

test('area dispel counts only matching effect holders toward its target limit',()=>{
  const e=engine(),source=unit(e),near=unit(e,'player',110),matching=unit(e,'player',120);
  const buff=e.createDefaultAction('add_buff');buff.target='ally';buff.effect.id='cleanse_me';e.applySkill(source,matching,skill(e,buff));
  const remove=e.createDefaultAction('delete_buff');remove.target='ally';remove.area=3;remove.maxTargets=1;remove.effect.id='cleanse_me';remove.effect.dispelMode='id';
  e.applySkill(source,matching,skill(e,remove));
  assert.equal(matching.activeEffects.some(effect=>effect.id==='cleanse_me'),false);assert.equal(near.activeEffects.length,0);
});

test('self-centered area fires at caster on cast completion without a projectile', () => {
  const e=engine(), source=unit(e), target=unit(e,'enemy',120);
  const s=skill(e,{type:'deal_damage',target:'enemy',area:3,areaCenter:'self',coefficients:[{type:'fixed',value:10}]});
  e.startCast(source,{type:'skill',target,skill:s,ranged:true});
  assert.equal(target.hp,90); assert.equal(e.projectiles.length,0);
});

test('summoned healer uses own cast time and heals; surviving summons prevent defeat', () => {
  const e=engine(), source=unit(e), enemy=unit(e,'enemy',110);
  const s=skill(e,{type:'summon_entity',summon:{role:'healer',castTime:0,lifetime:0}});
  e.applySkill(source,source,s);
  const summon=e.playerSquad[1]; source.hp=50;summon.x=source.x+5;summon.y=source.y;
  e.startCast(summon,{type:'heal',target:source});
  assert.equal(summon.castTimer,0); assert.equal(e.projectiles.length,1);
  e.applyHeal(summon,source); assert.equal(source.hp,60);
  source.alive=false;
  let finished=false, acted=0;
  e.finishBattle=()=>{finished=true}; e.takeAction=()=>{acted++};
  e.updateCombat(); assert.equal(finished,false); assert.equal(acted,2);
  summon.alive=false; e.updateCombat(); assert.equal(finished,true);
});

test('next battle preparation removes old summons and projectiles', () => {
  const e=engine(), source=unit(e), enemy=unit(e,'enemy');
  const s=skill(e,{type:'summon_entity'});
  e.applySkill(source,source,s); e.applySkill(enemy,enemy,s);
  e.projectiles.push({});
  Object.assign(e,{battleMode:'monster',rebuildPlayerSquadFromSelection(){},clearBattleEventLogs(){},updateBattleButton(){},isBattleRunning:false});
  assert.equal(e.prepareBattleSession({openScreen:false}),true);
  assert.equal(e.playerSquad.length,1); assert.equal(e.enemySquad.length,1); assert.equal(e.projectiles.length,0);
});

test('entity edits affect references but battle definitions stay frozen', () => {
  const e=engine(), source=unit(e);
  const s=skill(e,{type:'summon_entity',summon:{atk:11}});
  const action=s.actions[0];
  assert.equal(e.getSummonConfiguration(source,action).atk,11);
  vm.runInContext('battleEntitySnapshot = structuredClone(entitiesJson); entitiesJson[0].stats.atk = 90;',e);
  e.isBattleRunning=true;
  assert.equal(e.getSummonConfiguration(source,action).atk,11);
  e.isBattleRunning=false;
  assert.equal(e.getSummonConfiguration(source,action).atk,90);
  assert.equal(e.canSummonBattleUnit(source,{...action,entityId:'missing'},s),false);
  const serialized=JSON.stringify(s);
  assert.equal(serialized.includes('"stats"'),false);
  assert.equal(serialized.includes('"summon"'),false);
});

test('healing summon moves toward an injured ally rather than the enemy', () => {
  const e=engine(), source=unit(e), friend=unit(e,'player',200), enemy=unit(e,'enemy',10);
  friend.hp=30;
  const s=skill(e,{type:'summon_entity',summon:{role:'healer',speed:1}});
  e.applySkill(source,source,s);
  const summon=e.playerSquad[2];summon.x=100;summon.y=100;
  e.moveUnit(summon,e.enemySquad);
  assert.equal(summon.x,101);
});

test('entity preview has independent bounds when battle canvas is hidden', () => {
  const e=engine(); e.canvas.width=0;e.canvas.height=0;
  const definition=e.createDefaultEntity();
  const source={side:'player',name:'preview',x:80,y:100,isEntityPreview:true,previewBounds:{width:400,height:300}};
  const summon=e.createSummonedBattleUnit(source,{...definition.stats,role:'melee',ai:'melee',name:'wolf'});
  summon.x=80;summon.y=100;
  e.playerSquad=[summon];const target=unit(e,'enemy',200);
  e.moveUnit(summon,[target]);
  assert.equal(summon.x,81);assert.equal(summon.y,100);
  assert.equal(e.canvas.width,0);
});

test('area telegraph follows its center and shares the hit-test radius', () => {
  const e=engine(), source=unit(e), target=unit(e,'enemy',160);
  e.isBattleRunning=true;
  const s=skill(e,{type:'deal_damage',target:'enemy',rangeMode:'custom',rangeValue:15,area:3,coefficients:[{type:'fixed',value:10}]},1);
  e.startCast(source,{type:'skill',target,skill:s});
  let indicator=e.getSkillAreaIndicators()[0];
  assert.equal(indicator.radius,30);assert.equal(indicator.x,160);assert.equal(indicator.phase,'cast');
  target.x=200;e.updateCast(source);
  indicator=e.getSkillAreaIndicators()[0];assert.equal(indicator.x,200);assert(indicator.progress>0);
  s.actions[0].areaCenter='self';target.x=120;indicator=e.getSkillAreaIndicators()[0];assert.equal(indicator.x,source.x);
  target.alive=false;assert.equal(e.getSkillAreaIndicators().length,0);
});

test('projectile area is visible until impact and instant casts have a fading ground mark', () => {
  const e=engine(), source=unit(e), target=unit(e,'enemy',160);e.isBattleRunning=true;
  const s=skill(e,{type:'deal_damage',target:'enemy',rangeMode:'custom',rangeValue:15,area:2,coefficients:[{type:'fixed',value:10}]},0);
  e.startCast(source,{type:'skill',target,skill:s,ranged:true});
  assert.equal(e.getSkillAreaIndicators()[0].phase,'flight');
  e.projectiles=[];e.applySkill(source,target,s);
  const mark=e.getSkillAreaIndicators()[0];assert.equal(mark.phase,'impact');
  target.x+=30;assert.equal(e.getSkillAreaIndicators()[0].x,160);
  assert.equal(e.getSkillAreaIndicators(performance.now()+500).length,0);
  target.x=source.x+5;e.startCast(source,{type:'skill',target,skill:s});
  assert.equal(e.getSkillAreaIndicators()[0].phase,'impact');
});

test('single target actions and Entity previews produce no ground marks', () => {
  const e=engine(), source=unit(e), target=unit(e,'enemy',160);e.isBattleRunning=true;
  const single=skill(e,{type:'deal_damage',target:'enemy',area:0},1);
  e.startCast(source,{type:'skill',target,skill:single});
  assert.equal(e.getSkillAreaIndicators().length,0);
  source.isEntityPreview=true;
  const area=skill(e,{type:'heal',target:'self',area:3},0);
  e.applySkill(source,source,area);
  assert.equal(e.getSkillAreaIndicators().length,0);
});

test('dash moves the caster and damages after movement without a projectile', () => {
  const e=engine(), source=unit(e), target=unit(e,'enemy',250);
  const s=e.normalizeSkillJson([{id:'dash',name:'dash',castTime:0.5,actions:[{type:'move',target:'enemy',distance:10,rangeMode:'custom',rangeValue:20},{type:'deal_damage',target:'enemy',coefficients:[{type:'fixed',value:15}]}]}]).find(s=>s.id==='dash');
  e.startCast(source,{type:'skill',target,skill:s,ranged:true});
  assert.equal(source.x,100);assert.equal(target.hp,100);
  for(let i=0;i<30;i++)e.updateCast(source);
  assert(Math.abs(source.x-230)<0.001);assert.equal(target.hp,85);assert.equal(e.projectiles.length,0);
  source.x=100;e.spawnProjectile(source,target,'attack',s);
  assert(Math.abs(source.x-230)<0.001);assert.equal(e.projectiles.length,0);
});

test('description survives normalization and list summary preserves full text', () => {
  const e=engine(), description='첫 줄\n'+ '긴 설명 '.repeat(40);
  const s=e.normalizeSkillJson([{id:'described',name:'설명',description,actions:[{type:'heal'}]}]).find(s=>s.id==='described');
  assert.equal(e.getSkillDescription(s),description);
  assert.equal(e.summarizeSkillDescription(s).length,121);
  assert.equal(e.normalizeSkillJson([s]).find(x=>x.id===s.id).description,description);
  s.description='';assert.match(e.getSkillDescription(s),/회복/);
});

test('monster carries equipped skill IDs into combat and uses them', () => {
  const e=engine(), target=unit(e);
  const s=skill(e,{type:'deal_damage',target:'enemy',rangeMode:'custom',rangeValue:50,coefficients:[{type:'fixed',value:12}]});
  e.skillsJson=[s];
  e.monsterJson=[{label:'caster',role:'melee',hp:100,mp:100,st:100,atk:10,magic:10,attackRange:5,attackSpeed:1,castSpeed:0,skillIds:[s.id]}];
  const monster=e.createEnemy(0);e.resetUnitForBattle(monster);monster.x=target.x+5;monster.y=target.y;e.enemySquad.push(monster);
  assert.notEqual(monster.skillIds,e.monsterJson[0].skillIds);
  assert.equal(e.tryUseReadySkill(monster,[monster],[target]),true);
  assert.equal(target.hp,88);
});

function channelFixture(castTime=0, interruptOnDamage=true) {
  const e=engine(),source=unit(e),target=unit(e,'enemy',105);
  const s=skill(e,{type:'deal_damage',target:'enemy',coefficients:[{type:'fixed',value:10}]},castTime);
  s.channel={duration:2,interval:0.5,interruptOnDamage};
  s.resourceCosts=[{resource:'MP',mode:'fixed',value:10}];
  e.skillsJson=[s];source.skillIds=[s.id];
  return {e,source,target,s};
}

test('channel waits for warmup, pulses four times, charges once and starts cooldown on completion',()=>{
  const {e,source,target,s}=channelFixture(0.5);
  assert.equal(e.tryUseReadySkill(source,[source],[target]),true);
  for(let i=0;i<30;i++)e.updateCast(source);
  assert.ok(source.channelAction);assert.equal(target.hp,100);assert.equal(source.mp,90);
  assert.equal(source.skillCooldowns[s.id]||0,0);
  for(let i=0;i<120;i++)e.updateBattleChannel(source);
  assert.equal(target.hp,60);assert.equal(source.mp,90);assert.equal(source.channelAction,null);
  assert.equal(source.skillCooldowns[s.id],120);
});

test('channel positive damage interrupts optionally, including barrier damage',()=>{
  for(const interrupt of [true,false]){
    const {e,source,target,s}=channelFixture(0,interrupt);
    e.startCast(source,{type:'skill',target,skill:s});source.bp=20;
    e.applyActionDamage(target,source,s.actions[0],s);
    assert.equal(Boolean(source.channelAction),!interrupt);
    assert.equal(source.hp,100);assert.equal(source.bp,10);
  }
});

test('channel stun interrupts regardless of damage option and cleanup cancels scheduled pulses',()=>{
  const {e,source,target,s}=channelFixture(0,false);
  e.startCast(source,{type:'skill',target,skill:s});
  const state=e.createDefaultAction('add_state');state.effect.state='stun';
  e.applySkill(target,source,skill(e,state));
  assert.equal(source.channelAction,null);assert.equal(source.skillCooldowns[s.id],120);
  e.clearBattleEffects(source);e.startCast(source,{type:'skill',target,skill:s});
  e.clearBattleEffects(source);
  assert.equal(e.updateBattleChannel(source),false);assert.equal(target.hp,100);
});

test('channel retargets after death and blocks a second cast',()=>{
  const {e,source,target,s}=channelFixture();const other=unit(e,'enemy',106);
  e.startCast(source,{type:'skill',target,skill:s});const current=source.channelAction;
  e.startCast(source,{type:'skill',target:other,skill:s});assert.equal(source.channelAction,current);
  target.alive=false;
  for(let i=0;i<30;i++)e.updateBattleChannel(source);
  assert.equal(other.hp,90);assert.equal(target.hp,100);
});

test('channel completes without a pulse when duration is shorter than interval',()=>{
  const {e,source,target,s}=channelFixture();s.channel.duration=0.1;
  e.startCast(source,{type:'skill',target,skill:s});
  for(let i=0;i<6;i++)e.updateBattleChannel(source);
  assert.equal(target.hp,100);assert.equal(source.channelAction,null);
  s.channel.interval=0;assert.equal(e.isSkillExecutable(s),false);
  s.channel.duration=0;assert.equal(e.isSkillExecutable(s),true);
});

test('target HP condition is inclusive, skips healthy targets and prevents resource spending without targets',()=>{
 const e=engine(),s=unit(e),t=unit(e,'enemy',105);
 const sk=skill(e,{type:'deal_damage',target:'enemy',targetHpBelow:50,coefficients:[{type:'fixed',value:10}]});
 e.skillsJson=[sk];s.skillIds=[sk.id];
 assert.equal(e.tryUseReadySkill(s,[s],[t]),false);
 t.hp=50;e.applySkill(s,t,sk);assert.equal(t.hp,40);
});
test('target cooldown separates targets, casters and actions and expires at its exact tick',()=>{
 const e=engine(),s=unit(e),other=unit(e),t=unit(e,'enemy',105),t2=unit(e,'enemy',106);
 vm.runInContext('combatEventTick=0',e);
 const sk=skill(e,{type:'deal_damage',target:'enemy',targetCooldown:1,coefficients:[{type:'fixed',value:10}]});
 e.applySkill(s,t,sk);e.applySkill(s,t,sk);assert.equal(t.hp,90);assert.equal(t2.hp,90);
 e.applySkill(s,t,sk);assert.equal(t.hp,90);
 e.applySkill(other,t,sk);assert.equal(t.hp,80);
 vm.runInContext('combatEventTick=59',e);assert.equal(e.resolveSkillActionTarget(s,sk.actions[0],t,sk),null);
 vm.runInContext('combatEventTick=60',e);e.applySkill(s,t,sk);assert.equal(t.hp,70);
 e.resetUnitForBattle(s);assert.equal(e.resolveSkillActionTarget(s,sk.actions[0],t,sk),t);
});
test('global target cooldown blocks every caster and exposes a named expiring effect',()=>{
 const e=engine(),medic=unit(e),otherMedic=unit(e),ally=unit(e);ally.hp=10;
 const sk=skill(e,{type:'heal',target:'ally',healResource:'HP',targetCooldown:15,targetCooldownScope:'global',
  targetCooldownEffectId:'medic_inargansin_overdose_lock',targetCooldownEffectName:'과다투약 금지',coefficients:[{type:'fixed',value:2000}]});
 e.applySkillAction(medic,ally,sk.actions[0],sk);assert.equal(ally.hp,100);assert.equal(ally.activeEffects[0].name,'과다투약 금지');
 ally.hp=10;e.applySkillAction(otherMedic,ally,sk.actions[0],sk);assert.equal(ally.hp,10);
 for(let i=0;i<900;i++)e.updateBattleEffects();assert.equal(ally.activeEffects.length,0);
 e.applySkillAction(otherMedic,ally,sk.actions[0],sk);assert.equal(ally.hp,100);
 const round=e.normalizeSkillJson([sk]).find(item=>item.id===sk.id).actions[0];
 assert.equal(round.targetCooldownScope,'global');assert.equal(round.targetCooldownEffectId,'medic_inargansin_overdose_lock');
});
test('area filters conditions before target cap and rechecks them at impact',()=>{
 const e=engine(),s=unit(e),t=unit(e,'enemy',105),t2=unit(e,'enemy',106);t2.hp=40;
 const sk=skill(e,{type:'deal_damage',target:'enemy',area:3,maxTargets:1,targetHpBelow:50,targetCooldown:1,coefficients:[{type:'fixed',value:10}]});
 e.applySkillAction(s,t,sk.actions[0],sk);assert.equal(t.hp,100);assert.equal(t2.hp,30);
 e.applySkillAction(s,t,sk.actions[0],sk);assert.equal(t2.hp,30);
 const round=e.normalizeSkillJson([sk]).find(x=>x.id===sk.id);assert.equal(round.actions[0].targetHpBelow,50);assert.equal(round.actions[0].targetCooldown,1);
});

test('battle damage coefficient excludes overkill, includes barriers and resets between battles',()=>{
 const e=engine(),s=unit(e),t=unit(e,'enemy',105);t.hp=10;t.bp=5;
 const hit=skill(e,{type:'deal_damage',target:'enemy',coefficients:[{type:'fixed',value:100}]});
 e.applySkill(s,t,hit);assert.equal(s.actualDamageTotal,5);
 e.applySkill(s,t,hit);assert.equal(s.actualDamageTotal,15);
 const c={type:'calculated',field:'actualDamageTotal',calc:'percent',value:50};
 assert.equal(e.getCoefficientValue(c,s,t),7.5);e.resetUnitForBattle(s);assert.equal(e.getCoefficientValue(c,s,t),0);
});
test('movement coefficient measures actual movement in range units and respects root',()=>{
 const e=engine(),s=unit(e),t=unit(e,'enemy',140);
 e.applyActionMove(s,t,{distance:5});assert(Math.abs(s.moveDistanceTotal-2)<0.001);
 const state=e.createDefaultAction('add_state');state.effect.state='root';e.applySkill(t,s,skill(e,state));
 e.applyActionMove(s,t,{distance:10});assert.equal(s.moveDistanceTotal,2);
 e.resetUnitForBattle(s);assert.equal(s.moveDistanceTotal,0);
});
test('target stack and owned summon coefficients evaluate per target and survive normalization',()=>{
 const e=engine(),s=unit(e),t=unit(e,'enemy',105),other=unit(e,'enemy',106);
 t.activeEffects=[{stacks:2},{stacks:3}];other.activeEffects=[{stacks:1}];
 const sk=skill(e,{type:'deal_damage',target:'enemy',area:3,coefficients:[{type:'calculated',field:'targetEffectStacks',calc:'percent',value:100}]});
 e.applySkill(s,t,sk);assert.equal(t.hp,95);assert.equal(other.hp,99);
 e.playerSquad.push({alive:true,isSummon:true,summoner:s},{alive:false,isSummon:true,summoner:s},{alive:true,isSummon:true,summoner:other});
 assert.equal(e.getCoefficientValue({type:'calculated',field:'ownedSummonCount',calc:'percent',value:100},s),1);
 for(const field of ['actualDamageTotal','moveDistanceTotal','targetEffectStacks','ownedSummonCount'])assert.equal(e.normalizeCoefficient({type:'calculated',field,calc:'percent',value:100}).field,field);
});

test('summons protect their owner from configured damage scopes until they die', () => {
  const e=engine(),owner=unit(e),enemy=unit(e,'enemy',110);
  const summonSkill=skill(e,{type:'summon_entity',summon:{lifetime:0,hp:100,protectOwnerPercent:50,protectOwnerScope:'basic',protectOwnerPriority:2}});
  e.applySkill(owner,owner,summonSkill);
  const summon=e.playerSquad[1];
  assert.deepEqual([summon.protectOwnerPercent,summon.protectOwnerScope,summon.protectOwnerPriority],[50,'basic',2]);
  const basic=skill(e,{type:'deal_damage',target:'enemy',coefficients:[{type:'fixed',value:20}]});basic.slot='basic';
  e.applySkill(enemy,owner,basic);
  assert.deepEqual([owner.hp,summon.hp],[90,90]);
  const active=skill(e,{type:'deal_damage',target:'enemy',coefficients:[{type:'fixed',value:20}]});
  e.applySkill(enemy,owner,active);
  assert.deepEqual([owner.hp,summon.hp],[70,90]);
  summon.hp=0;e.syncAliveState(summon);
  e.applySkill(enemy,owner,basic);
  assert.equal(owner.hp,50);
});

test('summons transfer matching harmful states from their owner by priority', () => {
  const e=engine(),owner=unit(e),enemy=unit(e,'enemy',110);
  const low=skill(e,{type:'summon_entity',summon:{transferStateScope:'magic',transferStatePriority:9,lifetime:0}});low.id='low';
  const high=skill(e,{type:'summon_entity',summon:{transferStateScope:'magic',transferStatePriority:1,lifetime:0}});high.id='high';
  e.applySkill(owner,owner,low);e.applySkill(owner,owner,high);
  const first=e.playerSquad[1],preferred=e.playerSquad[2];
  const magic=e.createDefaultAction('add_state');Object.assign(magic.effect,{id:'magic_stun',state:'stun',category:'magic',polarity:'harmful'});
  e.applySkill(enemy,owner,skill(e,magic));
  assert.equal(owner.activeEffects.length,0);assert.equal(first.activeEffects.length,0);assert.equal(preferred.activeEffects[0].id,'magic_stun');
  const physical=e.createDefaultAction('add_state');Object.assign(physical.effect,{id:'physical_stun',state:'stun',category:'physical',polarity:'harmful'});
  e.applySkill(enemy,owner,skill(e,physical));
  assert.equal(owner.activeEffects[0].id,'physical_stun');
  preferred.alive=false;first.alive=false;
  const magic2=e.createDefaultAction('add_state');Object.assign(magic2.effect,{id:'magic_silence',state:'silence',category:'magic',polarity:'harmful'});
  e.applySkill(enemy,owner,skill(e,magic2));
  assert.equal(owner.activeEffects.some(effect=>effect.id==='magic_silence'),true);
});

test('stat override deletes a stat and conversion snapshots an original stat without cycles', () => {
  const e=engine(),source=unit(e),target=unit(e,'player',105);target.defense=12;
  const convert=e.createDefaultAction('add_buff');convert.duration=1;Object.assign(convert.effect,{id:'magic_to_attack',name:'마력 전환',mode:'convert',sourceStat:'magic',stat:'atk',value:50});
  e.applySkill(source,target,skill(e,convert));assert.equal(target.atk,20);assert.equal(target.activeEffects[0].conversionBase,20);
  const magic=e.createDefaultAction('add_buff');Object.assign(magic.effect,{id:'magic_up',stat:'magic',mode:'flat',value:100});
  e.applySkill(source,target,skill(e,magic));assert.equal(target.magic,120);assert.equal(target.atk,20);
  const deleted=e.createDefaultAction('add_buff');deleted.duration=1;Object.assign(deleted.effect,{id:'delete_defense',name:'방어력 삭제',mode:'override',stat:'defense',value:0,polarity:'harmful'});
  e.applySkill(source,target,skill(e,deleted));assert.equal(target.defense,0);
  const defense=e.createDefaultAction('add_buff');Object.assign(defense.effect,{id:'defense_up',stat:'defense',mode:'flat',value:50});
  e.applySkill(source,target,skill(e,defense));assert.equal(target.defense,0);
  for(let i=0;i<60;i++)e.updateBattleEffects();assert.equal(target.defense,62);assert.equal(target.atk,10);
  const remove=e.createDefaultAction('delete_buff');remove.target='ally';remove.effect.id='defense_up';e.applySkill(source,target,skill(e,remove));assert.equal(target.defense,12);
});

test('next skill modifier changes one active cast cost and cooldown then consumes itself', () => {
  const e=engine(),source=unit(e),target=unit(e,'enemy',105);source.mp=5;
  const buff=e.createDefaultAction('add_buff');buff.target='self';buff.duration=5;Object.assign(buff.effect,{id:'next_spell',name:'다음 주문 보정',mode:'next_skill_modifier',nextCastTimePercent:0,nextResourceCostPercent:50,nextCooldownPercent:25});
  e.applySkill(source,source,skill(e,buff));assert.equal(source.activeEffects[0].usesRemaining,1);
  const active=skill(e,{type:'deal_damage',target:'enemy',coefficients:[{type:'fixed',value:10}]},2);active.id='costly';active.cooldown=4;active.resourceCosts=[{resource:'MP',mode:'fixed',value:10}];
  e.skillsJson=[active];source.skillIds=[active.id];
  assert.equal(e.tryUseReadySkill(source,[source],[target]),true);assert.equal(source.mp,0);assert.equal(target.hp,90);assert.equal(source.castTimer,0);assert.equal(source.skillCooldowns.costly,60);assert.equal(source.activeEffects.length,0);
  source.mp=10;source.skillCooldowns.costly=0;assert.equal(e.tryUseReadySkill(source,[source],[target]),true);assert.equal(source.mp,0);assert.equal(source.castTimer,120);assert.equal(target.hp,90);
});

test('next skill modifier cooldown survives interruption and ignores passive skills', () => {
  const e=engine(),source=unit(e),target=unit(e,'enemy',105);
  const buff=e.createDefaultAction('add_buff');buff.target='self';Object.assign(buff.effect,{id:'next_channel',mode:'next_skill_modifier',nextCastTimePercent:50,nextResourceCostPercent:100,nextCooldownPercent:25});e.applySkill(source,source,skill(e,buff));
  const passive=equipPassive(e,source,'hit',{type:'heal',target:'self',coefficients:[{type:'fixed',value:1}]});source.hp=50;e.applySkill(source,target,skill(e,{type:'deal_damage',coefficients:[{type:'fixed',value:1}]}));assert.equal(source.activeEffects.some(effect=>effect.id==='next_channel'),true);
  const channel=skill(e,{type:'deal_damage',target:'enemy',coefficients:[{type:'fixed',value:1}]},1);channel.id='channel';channel.cooldown=4;channel.channel={duration:2,interval:1,interruptOnDamage:true};e.skillsJson.push(channel);source.skillIds=[passive.id,channel.id];
  assert.equal(e.tryUseReadySkill(source,[source],[target]),true);assert.equal(source.castTimer,30);for(let i=0;i<30;i++)e.updateCast(source);assert.ok(source.channelAction);e.finishBattleChannel(source,'테스트');assert.equal(source.skillCooldowns.channel,60);assert.equal(source.activeEffects.some(effect=>effect.id==='next_channel'),false);
});

test('multiple weapons keep independent cast timers cooldowns ranges and resource costs', () => {
  const e=engine(),source=unit(e),target=unit(e,'enemy',130);
  source.st=100;source.weaponAttacks=[
    {slot:'mainWeapon',name:'fast',attackSkillId:'',attackType:'physical',attackRange:5,attackSpeed:1,castSpeed:0},
    {slot:'extraWeapon1',name:'slow',attackSkillId:'',attackType:'physical',attackRange:5,attackSpeed:2,castSpeed:2/60}
  ];
  e.resetUnitForBattle(source);source.st=100;
  e.takeAction(source,[source],[target]);
  assert.equal(target.hp,100);e.updateProjectiles();
  assert.equal(target.hp,90);assert.equal(source.st,80);assert.equal(source.weaponAttackStates[0].cooldown,60);assert.equal(source.weaponAttackStates[1].castTimer,2);
  e.takeAction(source,[source],[target]);assert.equal(target.hp,90);
  e.takeAction(source,[source],[target]);e.updateProjectiles();assert.equal(target.hp,80);
  assert.notEqual(source.weaponAttackStates[0].cooldown,source.weaponAttackStates[1].cooldown);
});

test('multiple weapons apply additive same-target concentration penalty to every weapon', () => {
  const e=engine(),source=unit(e),target=unit(e,'enemy',105);
  source.sameTargetWeaponPenaltyPercent=15;source.weaponAttacks=[
    {slot:'mainWeapon',name:'one',attackSkillId:'',attackType:'physical',attackRange:1,attackSpeed:1,castSpeed:0},
    {slot:'extraWeapon1',name:'two',attackSkillId:'',attackType:'physical',attackRange:1,attackSpeed:1,castSpeed:0}
  ];
  e.resetUnitForBattle(source);source.st=100;e.takeAction(source,[source],[target]);
  assert.equal(target.hp,83);assert.equal(source.st,80);
  assert.equal(source.weaponAttackStates.filter(state=>state.focusTarget===target).length,2);
});

test('custom resources normalize, initialize and pay skill costs without falling back to MP', () => {
  const e=engine();
  const definitions=e.normalizeCustomResourceDefinitions([
    {id:'Soul Points!',name:'영혼',initial:120,max:100},
    {id:'soulpoints',name:'중복',initial:1,max:5},
    {id:'rage',name:'분노',initial:10,max:50}
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(definitions)),[
    {id:'soulpoints',name:'영혼',initial:100,max:100},
    {id:'rage',name:'분노',initial:10,max:50}
  ]);
  const source=unit(e);source.customResources=e.createBattleCustomResources(definitions);
  const action={type:'deal_damage',target:'enemy',coefficients:[{type:'fixed',value:5}]};
  const s=e.normalizeSkillJson([{id:'custom_cost',name:'custom',castTime:0,resourceCosts:[{resource:'custom:soulpoints',mode:'fixed',value:30}],actions:[action]}]).find(item=>item.id==='custom_cost');
  assert.equal(s.resourceCosts[0].resource,'custom:soulpoints');
  assert.equal(e.canPaySkillResourceCosts(source,s),true);
  const spent=e.spendSkillResourceCosts(source,s);
  assert.equal(source.customResources.soulpoints.current,70);
  assert.equal(spent['custom:soulpoints'],30);
  source.customResources.soulpoints.current=20;
  assert.equal(e.canPaySkillResourceCosts(source,s),false);
});

test('custom resources support healing, draining and battle reset', () => {
  const e=engine(),source=unit(e),target=unit(e,'enemy',105);
  target.customResources=e.createBattleCustomResources([{id:'rage',name:'분노',initial:10,max:50}]);
  assert.equal(e.applyResourceGain(target,'custom:rage',30).gained,30);
  assert.equal(target.customResources.rage.current,40);
  const drain=e.createDefaultAction('drain_resource');drain.drainResource='custom:rage';drain.coefficients=[{type:'fixed',value:15}];
  assert.equal(e.applyActionResourceDrain(source,target,drain),15);
  assert.equal(target.customResources.rage.current,25);
  e.resetUnitForBattle(target);
  assert.equal(target.customResources.rage.current,10);
});

test('waiting entrants prevent defeat and join after their configured delay', () => {
  const e=engine(),source=unit(e),enemy=unit(e,'enemy',105);
  source.battleRules={entryDelay:2/60,reviveCount:0,reviveDelay:0,reviveHpPercent:50};
  e.resetUnitForBattle(source);
  assert.equal(source.alive,false);assert.equal(source.entryTicks,2);
  let result='';e.finishBattle=value=>{result=value};e.takeAction=()=>{};
  e.updateCombat();assert.equal(result,'');
  e.updateBattleReentries();assert.equal(source.alive,false);
  e.updateBattleReentries();assert.equal(source.alive,true);assert.equal(source.hp,source.maxHp);
  e.updateCombat();assert.equal(result,'');assert.equal(enemy.alive,true);
});

test('revival delay postpones defeat, restores configured HP and exhausts its count', () => {
  const e=engine(),source=unit(e),enemy=unit(e,'enemy',105);
  source.battleRules={entryDelay:0,reviveCount:1,reviveDelay:2/60,reviveHpPercent:35};
  e.resetUnitForBattle(source);
  source.hp=0;e.syncAliveState(source);
  assert.equal(source.alive,false);assert.equal(source.revivesRemaining,0);assert.equal(source.reviveTicks,2);
  let result='';e.finishBattle=value=>{result=value};e.takeAction=()=>{};
  e.updateCombat();assert.equal(result,'');
  e.updateBattleReentries();e.updateBattleReentries();
  assert.equal(source.alive,true);assert.equal(source.hp,35);
  source.hp=0;e.syncAliveState(source);e.updateCombat();assert.equal(result,'패배');
});

test('revival follow-up restores resources, returns home and blocks damage for exact duration', () => {
  const e=engine(),source=unit(e),enemy=unit(e,'enemy',105);
  source.battleRules={entryDelay:0,reviveCount:1,reviveDelay:1/60,reviveHpPercent:30,reviveMpPercent:25,reviveStPercent:40,reviveInvulnerable:2/60,revivePosition:'start'};
  source.battleStartX=50;source.battleStartY=60;source.x=200;source.y=180;source.mp=0;source.st=0;
  e.resetUnitForBattle(source);source.battleStartX=50;source.battleStartY=60;source.x=200;source.y=180;source.mp=0;source.st=0;
  source.hp=0;e.syncAliveState(source);e.updateBattleReentries();
  assert.equal(source.alive,true);assert.equal(source.hp,30);assert.equal(source.mp,25);assert.equal(source.st,40);
  assert.equal(source.x,50);assert.equal(source.y,60);assert.equal(source.reviveInvulnerableTicks,2);
  const action=e.createDefaultAction('deal_damage');action.coefficients=[{type:'fixed',value:10}];
  assert.equal(e.applyActionDamage(enemy,source,action),0);assert.equal(source.hp,30);
  e.updateBattleReentries();assert.equal(e.applyActionDamage(enemy,source,action),0);
  e.updateBattleReentries();assert.equal(e.applyActionDamage(enemy,source,action),10);assert.equal(source.hp,20);
});

test('reserve members wait off field and reinforce permanent frontline losses in order', () => {
  const e=engine(),front=unit(e),reserve1=unit(e),reserve2=unit(e),enemy=unit(e,'enemy',105);
  for(const [index,member] of [front,reserve1,reserve2].entries()) {
    member.squadActiveLimit=1;member.reserveOrder=index;member.startsInReserve=index>0;e.resetUnitForBattle(member);
  }
  assert.equal(front.alive,true);assert.equal(reserve1.alive,false);assert.equal(reserve1.isReserve,true);
  assert.equal(e.canSquadContinueBattle(e.playerSquad),true);
  front.hp=0;e.syncAliveState(front);e.updateBattleReentries();
  assert.equal(reserve1.alive,true);assert.equal(reserve1.isReserve,false);assert.equal(reserve2.alive,false);
  reserve1.hp=0;e.syncAliveState(reserve1);e.updateBattleReentries();
  assert.equal(reserve2.alive,true);assert.equal(enemy.alive,true);
});

test('reserve swap exchanges a living unit while preserving hp resources and cooldowns', () => {
  const e=engine(),source=unit(e),ally=unit(e),reserve=unit(e),enemy=unit(e,'enemy',105);
  source.squadActiveLimit=2;source.reserveOrder=0;ally.squadActiveLimit=2;ally.reserveOrder=1;
  reserve.squadActiveLimit=2;reserve.reserveOrder=2;reserve.startsInReserve=true;e.resetUnitForBattle(reserve);
  source.hp=40;source.mp=35;source.skillCooldowns.keep=12;source.x=140;source.y=160;reserve.hp=75;
  const action=e.createDefaultAction('swap_reserve');Object.assign(action,{target:'self',reserveIndex:1});
  assert.equal(e.resolveSkillActionTarget(source,action),source);
  const incoming=e.swapBattleUnitWithReserve(source,source,action);
  assert.equal(incoming,reserve);assert.equal(source.alive,false);assert.equal(source.isReserve,true);
  assert.equal(source.hp,40);assert.equal(source.mp,35);assert.equal(source.skillCooldowns.keep,12);
  assert.equal(reserve.alive,true);assert.equal(reserve.hp,75);assert.equal(reserve.x,140);assert.equal(reserve.y,160);
  assert.equal(e.resolveSkillActionTarget(reserve,{...action,reserveIndex:2}),null);
  assert.equal(enemy.alive,true);
});

test('revive ally action selects a permanent corpse and restores configured resources', () => {
  const e=engine(),source=unit(e),corpse=unit(e),waiting=unit(e),enemy=unit(e,'enemy',105);
  corpse.x=105;corpse.y=100;corpse.battleStartX=40;corpse.battleStartY=60;corpse.hp=0;e.syncAliveState(corpse);
  waiting.hp=0;waiting.alive=false;waiting.isWaiting=true;waiting.reviveTicks=10;
  const action=e.createDefaultAction('revive_ally');Object.assign(action,{target:'ally',reviveHpPercent:35,reviveMpPercent:25,reviveStPercent:40,reviveInvulnerable:2/60,revivePosition:'start'});
  const revive=skill(e,action);
  assert.equal(e.resolveSkillActionTarget(source,revive.actions[0]),corpse);
  e.applySkill(source,corpse,revive);
  assert.equal(corpse.alive,true);assert.deepEqual([corpse.hp,corpse.mp,corpse.st],[35,25,40]);
  assert.deepEqual([corpse.x,corpse.y,corpse.reviveInvulnerableTicks],[40,60,2]);
  assert.equal(waiting.alive,false);
  assert.equal(e.resolveSkillActionTarget(source,revive.actions[0]),null);
});

test('temporary reserve reinforcement returns after its exact duration', () => {
  const e=engine(),source=unit(e),reserve=unit(e),enemy=unit(e,'enemy',105);
  source.squadActiveLimit=1;source.reserveOrder=0;reserve.squadActiveLimit=1;reserve.reserveOrder=1;reserve.startsInReserve=true;e.resetUnitForBattle(reserve);
  const action=e.createDefaultAction('deploy_reserve');Object.assign(action,{reserveIndex:1,duration:2/60});
  const deploy=skill(e,action);e.applySkill(source,source,deploy);
  assert.equal(reserve.alive,true);assert.equal(reserve.isReserve,false);assert.equal(reserve.temporaryReserveTicks,2);
  e.updateBattleReentries();assert.equal(reserve.alive,true);
  e.updateBattleReentries();assert.equal(reserve.alive,false);assert.equal(reserve.isReserve,true);assert.equal(reserve.isWaiting,true);
});

test('temporary reserve swap restores the withdrawn unit on expiry or early death', () => {
  const e=engine(),source=unit(e),reserve=unit(e),enemy=unit(e,'enemy',105);
  source.squadActiveLimit=1;source.reserveOrder=0;reserve.squadActiveLimit=1;reserve.reserveOrder=1;reserve.startsInReserve=true;e.resetUnitForBattle(reserve);
  const action=e.createDefaultAction('swap_reserve');Object.assign(action,{target:'self',reserveIndex:1,duration:2/60});
  const swap=skill(e,action);e.applySkill(source,source,swap);
  assert.equal(source.reservedForTemporarySwap,true);assert.equal(reserve.alive,true);
  e.updateBattleReentries();assert.equal(source.alive,false);
  e.updateBattleReentries();assert.equal(source.alive,true);assert.equal(source.isReserve,false);assert.equal(reserve.isReserve,true);
  e.applySkill(source,source,swap);reserve.hp=0;e.syncAliveState(reserve);e.updateBattleReentries();
  assert.equal(source.alive,true);assert.equal(source.reservedForTemporarySwap,false);assert.equal(reserve.alive,false);
});

test('equipment set swap changes combat loadout while preserving current resources and cooldowns', () => {
  const e=engine(),source=unit(e),enemy=unit(e,'enemy',105);
  source.hp=70;source.mp=35;source.st=40;source.skillCooldowns.keep=12;
  source.equipmentLoadouts=[
    {name:'세트 1',maxHp:100,maxMp:100,maxSt:100,baseBp:0,atk:10,magic:20,speed:1,attackSpeed:1,castSpeed:1,defense:0,resistance:0,attackRange:5,attackType:'physical',attackSkillId:'',weaponAttacks:[],sameTargetWeaponPenaltyPercent:0},
    {name:'세트 2',maxHp:60,maxMp:80,maxSt:50,baseBp:10,atk:30,magic:5,speed:2,attackSpeed:2,castSpeed:.5,defense:20,resistance:10,attackRange:2,attackType:'magic',attackSkillId:'magic_attack',weaponAttacks:[{slotKey:'mainWeapon'}],sameTargetWeaponPenaltyPercent:15}
  ];
  const action=e.normalizeSkillAction({type:'swap_equipment_set',target:'self',equipmentSetIndex:2});
  assert.equal(e.resolveSkillActionTarget(source,action),source);
  assert.equal(e.swapBattleEquipmentSet(source,source,action),true);
  assert.equal(source.activeEquipmentSet,1);assert.equal(source.atk,30);assert.equal(source.attackType,'magic');
  assert.equal(source.hp,60);assert.equal(source.mp,35);assert.equal(source.st,40);assert.equal(source.skillCooldowns.keep,12);
  assert.equal(source.weaponAttackStates.length,1);assert.ok(source.weaponAttackStates[0].cooldown>0);
  assert.equal(e.resolveSkillActionTarget(source,{...action,equipmentSetIndex:3}),null);assert.equal(enemy.alive,true);
});

test('side battle rules scale damage healing resource costs and skill cooldowns', () => {
  const e=engine(),source=unit(e),target=unit(e,'enemy',105);
  e.getUnitTeamBattleRules=unit=>unit.side==='player'
    ? {damagePercent:150,healingPercent:50,resourceCostPercent:200,cooldownPercent:50}
    : {damagePercent:100,healingPercent:100,resourceCostPercent:100,cooldownPercent:100};
  const damage=e.createDefaultAction('deal_damage');damage.coefficients=[{type:'fixed',value:10}];
  e.applyActionDamage(source,target,damage);assert.equal(target.hp,85);
  source.hp=50;const heal=e.createDefaultAction('heal');heal.target='self';heal.coefficients=[{type:'fixed',value:20}];
  e.applyActionHeal(source,source,heal);assert.equal(source.hp,60);
  const s=skill(e,damage);s.resourceCosts=[{resource:'MP',mode:'fixed',value:10}];
  assert.equal(e.getResourceCostAmount(source,s.resourceCosts[0]),20);
  assert.equal(e.getSkillCooldownTicks(s,source),60);
});

test('rule override multiplies unit rules, refreshes by id and expires exactly', () => {
  const e=engine(),source=unit(e),target=unit(e),enemy=unit(e,'enemy',105);
  e.getUnitTeamBattleRules=unit=>(unit.runtimeRuleOverrides??[]).reduce((rules,override)=>({damagePercent:rules.damagePercent*override.damagePercent/100,healingPercent:rules.healingPercent*override.healingPercent/100,resourceCostPercent:rules.resourceCostPercent*override.resourceCostPercent/100,cooldownPercent:rules.cooldownPercent*override.cooldownPercent/100}),{damagePercent:120,healingPercent:100,resourceCostPercent:100,cooldownPercent:100});
  const action=e.createDefaultAction('override_rule');Object.assign(action,{target:'ally',duration:2/60,ruleOverride:{id:'command',damagePercent:150,healingPercent:80,resourceCostPercent:50,cooldownPercent:75}});
  e.applySkillAction(source,target,e.normalizeSkillAction(action));
  assert.equal(e.getUnitTeamBattleRules(target).damagePercent,180);assert.equal(target.runtimeRuleOverrides.length,1);
  action.ruleOverride.damagePercent=200;e.applySkillAction(source,target,e.normalizeSkillAction(action));
  assert.equal(target.runtimeRuleOverrides.length,1);assert.equal(e.getUnitTeamBattleRules(target).damagePercent,240);
  e.updateRuntimeRuleOverrides();assert.equal(target.runtimeRuleOverrides.length,1);
  e.updateRuntimeRuleOverrides();assert.equal(target.runtimeRuleOverrides.length,0);assert.equal(enemy.alive,true);
});

test('rule override disables active passive copied and basic skills until expiry', () => {
  const e=engine(),source=unit(e),target=unit(e),enemy=unit(e,'enemy',105);
  const active=skill(e,{type:'deal_damage',target:'enemy',coefficients:[{type:'fixed',value:10}]});active.id='blocked_active';
  const passive=skill(e,{type:'deal_damage',target:'enemy',coefficients:[{type:'fixed',value:10}]});passive.id='blocked_passive';passive.slot='passive';passive.passiveTrigger={event:'hit',chance:100,includePeriodic:false};
  const allowed=skill(e,{type:'deal_damage',target:'enemy',coefficients:[{type:'fixed',value:10}]});allowed.id='allowed';
  e.skillsJson=[active,passive,allowed];target.skillIds=[active.id,passive.id,allowed.id];
  target.runtimeCopiedSkills=[{...structuredClone(active),id:'runtime_copy_1_blocked_active',copiedFrom:active.id,copySlot:1}];
  const action=e.normalizeSkillAction({type:'override_rule',target:'ally',duration:2/60,ruleOverride:{id:'silence_selected',disabledSkillIds:[active.id,passive.id,'skill_basic_weapon_attack','skill_basic_heal'],damagePercent:100,healingPercent:100,resourceCostPercent:100,cooldownPercent:100}});
  e.applySkillAction(source,target,action);
  assert.deepEqual(Array.from(e.getEquippedSkills(target),item=>item.id),[allowed.id]);
  assert.equal(e.isUnitSkillDisabled(target,passive),true);assert.equal(e.getUnitSkill(target),null);assert.equal(e.getUnitSkill(target,'skill_basic_heal'),null);
  e.updateRuntimeRuleOverrides();assert.equal(e.isUnitSkillDisabled(target,active),true);
  e.updateRuntimeRuleOverrides();assert.equal(e.isUnitSkillDisabled(target,active),false);assert.equal(e.getEquippedSkills(target).length,3);assert.ok(e.getUnitSkill(target));assert.equal(enemy.alive,true);
});

test('rule override can disable every current and future skill until expiry', () => {
  const e=engine(),source=unit(e),target=unit(e),enemy=unit(e,'enemy',105);
  const active=skill(e,{type:'deal_damage',target:'enemy',coefficients:[{type:'fixed',value:10}]});active.id='existing_active';
  e.skillsJson=[active];target.skillIds=[active.id];
  const action=e.normalizeSkillAction({type:'override_rule',target:'ally',duration:2/60,ruleOverride:{id:'complete_skill_ban',disableAllSkills:true,damagePercent:100,healingPercent:100,resourceCostPercent:100,cooldownPercent:100}});
  e.applySkillAction(source,target,action);
  target.runtimeCopiedSkills=[{...structuredClone(active),id:'future_runtime_copy',copiedFrom:'unlisted_future_skill',copySlot:1}];
  assert.deepEqual(Array.from(e.getEquippedSkills(target)),[]);
  assert.equal(e.getUnitSkill(target),null);assert.equal(e.getUnitSkill(target,'skill_basic_heal'),null);
  assert.equal(e.isUnitSkillDisabled(target,target.runtimeCopiedSkills[0]),true);
  e.updateRuntimeRuleOverrides();e.updateRuntimeRuleOverrides();
  assert.equal(e.isUnitSkillDisabled(target,active),false);assert.equal(e.getEquippedSkills(target).length,2);assert.ok(e.getUnitSkill(target));assert.equal(enemy.alive,true);
});

test('rule override scales received damage and healing including a healing ban', () => {
  const e=engine(),source=unit(e),target=unit(e,'enemy',105),protector=unit(e,'enemy',110);
  const damage=e.createDefaultAction('deal_damage');damage.damageType='fixed';damage.coefficients=[{type:'fixed',value:20}];
  target.runtimeRuleOverrides=[{id:'vulnerable',receivedDamagePercent:150,receivedHealingPercent:50}];
  e.applyActionDamage(source,target,damage);assert.equal(target.hp,70);
  target.hp=50;const heal=e.createDefaultAction('heal');heal.coefficients=[{type:'fixed',value:20}];
  e.applyActionHeal(protector,target,heal);assert.equal(target.hp,60);
  target.runtimeRuleOverrides=[{id:'no_healing',receivedDamagePercent:100,receivedHealingPercent:0}];
  e.applyActionHeal(protector,target,heal);assert.equal(target.hp,60);
  protector.effectCasterId=77;target.activeEffects=[{kind:'buff',mode:'damage_proxy',proxyPercent:50,proxyScope:'all',proxyPriority:0,casterId:77,name:'guard'}];
  protector.runtimeRuleOverrides=[{id:'resist',receivedDamagePercent:50,receivedHealingPercent:100}];
  e.playerSquad=[source];e.enemySquad=[target,protector];target.hp=100;protector.hp=100;
  e.applyActionDamage(source,target,damage);assert.equal(target.hp,90);assert.equal(protector.hp,95);
});

test('rule override suppresses and restores equipment stats and weapon effects', () => {
  const e=engine(),source=unit(e),target=unit(e),enemy=unit(e,'enemy',105);
  Object.assign(target,{hp:90,maxHp:120,mp:40,maxMp:80,st:30,maxSt:70,bp:5,maxBp:10,baseBp:10,atk:30,magic:25,speed:4,attackSpeed:1,castSpeed:.5,defense:20,resistance:15,attackRange:6,attackType:'magic',attackSkillId:'weapon_spell',sameTargetWeaponPenaltyPercent:15});
  const naked={maxHp:100,maxMp:60,maxSt:60,baseBp:0,atk:10,magic:10,speed:3,attackSpeed:2,castSpeed:1,defense:5,resistance:5,attackRange:2,attackType:'physical',attackSkillId:'',weaponAttacks:[],sameTargetWeaponPenaltyPercent:0};
  target.equipmentLoadouts=[{name:'장비 세트',maxHp:120,maxMp:80,maxSt:70,baseBp:10,atk:30,magic:25,speed:4,attackSpeed:1,castSpeed:.5,defense:20,resistance:15,attackRange:6,attackType:'magic',attackSkillId:'weapon_spell',weaponAttacks:[{slotKey:'mainWeapon'}],sameTargetWeaponPenaltyPercent:15,withoutEquipment:naked}];target.activeEquipmentSet=0;
  const action=e.normalizeSkillAction({type:'override_rule',target:'ally',duration:2/60,ruleOverride:{id:'equipment_ban',disableEquipmentEffects:true,damagePercent:100,receivedDamagePercent:100,healingPercent:100,receivedHealingPercent:100,resourceCostPercent:100,cooldownPercent:100}});
  e.applySkillAction(source,target,action);assert.equal(target.atk,10);assert.equal(target.maxHp,100);assert.equal(target.hp,90);assert.equal(target.weaponAttacks.length,0);assert.equal(target.attackSkillId,'');
  e.updateRuntimeRuleOverrides();e.updateRuntimeRuleOverrides();
  assert.equal(target.atk,30);assert.equal(target.maxHp,120);assert.equal(target.hp,90);assert.equal(target.weaponAttacks.length,1);assert.equal(target.attackSkillId,'weapon_spell');assert.equal(enemy.alive,true);
});

test('copy skill targets waiting allies and creates an independent active snapshot', () => {
  const e=engine(),source=unit(e),ally=unit(e),enemy=unit(e,'enemy',105);
  const original=skill(e,{type:'deal_damage',target:'enemy',coefficients:[{type:'fixed',value:12}]});
  original.id='ally_strike';original.name='아군 강타';original.slot='active';
  const passive=skill(e,{type:'heal',target:'self',coefficients:[{type:'fixed',value:1}]});
  passive.id='ally_passive';passive.slot='passive';
  const copier=skill(e,{type:'copy_skill',target:'ally',copySourceIndex:1,copySlot:2});
  copier.id='copy_action';
  e.skillsJson=[original,passive,copier];source.skillIds=[copier.id];ally.skillIds=[passive.id,original.id];
  ally.alive=false;ally.isWaiting=true;ally.entryTicks=60;
  assert.equal(e.resolveSkillActionTarget(source,copier.actions[0]),ally);
  e.applySkill(source,ally,copier);
  assert.equal(source.runtimeCopiedSkills.length,1);
  const copied=source.runtimeCopiedSkills[0];
  assert.equal(copied.copiedFrom,original.id);assert.equal(copied.copySlot,2);assert.notEqual(copied.id,original.id);
  original.actions[0].coefficients[0].value=99;
  e.applySkill(source,enemy,copied);assert.equal(enemy.hp,88);
  source.skillCooldowns[copied.id]=30;assert.equal(ally.skillCooldowns[original.id],undefined);
  ally.isWaiting=false;assert.equal(e.resolveSkillActionTarget(source,copier.actions[0]),null);
});

test('copy slots replace their previous skill and battle reset removes all copies', () => {
  const e=engine(),source=unit(e),ally=unit(e);
  const first=skill(e,{type:'heal',target:'self',coefficients:[{type:'fixed',value:5}]});first.id='first';first.slot='active';
  const second=skill(e,{type:'deal_damage',target:'enemy',coefficients:[{type:'fixed',value:6}]});second.id='second';second.slot='active';
  e.skillsJson=[first,second];ally.skillIds=[first.id,second.id];
  e.copyUnitSkill(source,ally,{copySourceIndex:1,copySlot:1});
  e.copyUnitSkill(source,ally,{copySourceIndex:2,copySlot:1});
  assert.equal(source.runtimeCopiedSkills.length,1);assert.equal(source.runtimeCopiedSkills[0].copiedFrom,'second');
  e.resetUnitForBattle(source);assert.equal(source.runtimeCopiedSkills.length,0);
});

test('knockback and push move the target away while pull moves it toward the caster',()=>{
 for(const moveType of ['Knockback','Push']) {
  const e=engine(),source=unit(e),target=unit(e,'enemy',200);
  const action=e.createDefaultAction('move');Object.assign(action,{target:'enemy',moveType,distance:3,rangeMode:'custom',rangeValue:20});
  e.applySkill(source,target,skill(e,action));assert.equal(target.x,230);assert.equal(source.x,100);
  assert.equal(e.getBattleEvents('forced_move').length,1);
 }
 const e=engine(),source=unit(e),target=unit(e,'enemy',200);
 const pull=e.createDefaultAction('move');Object.assign(pull,{target:'enemy',moveType:'Pull',distance:3,rangeMode:'custom',rangeValue:20});
 e.applySkill(source,target,skill(e,pull));assert.equal(target.x,170);
});

test('forced movement ignores root but stops at units and battlefield boundaries',()=>{
 const e=engine(),source=unit(e),target=unit(e,'enemy',200),blocker=unit(e,'enemy',240);
 const root=e.createDefaultAction('add_state');Object.assign(root,{target:'enemy',rangeMode:'custom',rangeValue:20});root.effect.id='root_force';root.effect.state='root';e.applySkill(source,target,skill(e,root));e.applySkill(target,source,skill(e,root));
 const push=e.createDefaultAction('move');Object.assign(push,{target:'enemy',moveType:'Knockback',distance:10,rangeMode:'custom',rangeValue:100});e.applySkill(source,target,skill(e,push));
 assert(Math.abs(target.x-220)<0.001);assert(e.hasBattleState(target,'root'));assert(e.hasBattleState(source,'root'));
 blocker.alive=false;target.x=970;e.applySkill(source,target,skill(e,push));assert.equal(target.x,995);
});

test('dash stops before occupied units and teleport rejects an occupied destination',()=>{
 const e=engine(),source=unit(e),blocker=unit(e,'player',150),target=unit(e,'enemy',200);
 const dash=e.createDefaultAction('move');Object.assign(dash,{target:'enemy',moveType:'Dash',distance:10,rangeMode:'custom',rangeValue:20});e.applySkill(source,target,skill(e,dash));
 assert(Math.abs(source.x-130)<0.001);
 source.x=100;blocker.x=200;target.x=200;const teleport={...dash,moveType:'Teleport'};e.applySkill(source,target,skill(e,teleport));assert.equal(source.x,100);
});

test('a following action can heal from the previous action actual damage',()=>{
 const e=engine(),source=unit(e),target=unit(e,'enemy',105);source.hp=40;
 const damage=e.createDefaultAction('deal_damage');damage.target='enemy';damage.coefficients=[{type:'fixed',value:30}];
 const heal=e.createDefaultAction('heal');heal.target='self';heal.coefficients=[{type:'calculated',field:'previousActualDamage',calc:'percent',value:50}];
 const s=e.normalizeSkillJson([{id:'result',name:'result',actions:[damage,heal]}]).find(x=>x.id==='result');
 e.applySkill(source,target,s);
 assert.equal(target.hp,70);assert.equal(source.hp,55);
});

test('execution damage sums area and preceding damage actions but previous damage resets after another action',()=>{
 const e=engine(),source=unit(e),target=unit(e,'enemy',105),other=unit(e,'enemy',106);source.hp=20;
 const area=e.createDefaultAction('deal_damage');area.target='enemy';area.area=3;area.coefficients=[{type:'fixed',value:10}];
 const second=e.createDefaultAction('deal_damage');second.target='enemy';second.coefficients=[{type:'fixed',value:5}];
 const heal=e.createDefaultAction('heal');heal.target='self';heal.coefficients=[{type:'calculated',field:'executionActualDamage',calc:'percent',value:100}];
 const s=e.normalizeSkillJson([{id:'sum',name:'sum',actions:[area,second,heal]}]).find(x=>x.id==='sum');
 e.applySkill(source,target,s);
 assert.equal(source.hp,45);assert.equal(target.hp,85);assert.equal(other.hp,90);
 const move=e.createDefaultAction('move');move.target='self';
 const after=e.createDefaultAction('heal');after.target='self';after.coefficients=[{type:'calculated',field:'previousActualDamage',calc:'percent',value:100}];
 const reset=e.normalizeSkillJson([{id:'reset',name:'reset',actions:[second,move,after]}]).find(x=>x.id==='reset');
 const before=source.hp;e.applySkill(source,target,reset);assert.equal(source.hp,before);
});

test('result-dependent projectile skills resume later actions after impact',()=>{
 const e=engine(),source=unit(e),target=unit(e,'enemy',120);source.hp=50;
 const damage=e.createDefaultAction('deal_damage');damage.target='enemy';damage.coefficients=[{type:'fixed',value:20}];
 const heal=e.createDefaultAction('heal');heal.target='self';heal.coefficients=[{type:'calculated',field:'previousActualDamage',calc:'percent',value:50}];
 const s=e.normalizeSkillJson([{id:'projectile_result',name:'projectile result',actions:[damage,heal]}]).find(x=>x.id==='projectile_result');
 e.dispatchSkillActions(source,target,s,true);
 assert.equal(source.hp,50);assert.equal(target.hp,100);assert.equal(e.projectiles.length,1);
 e.updateProjectiles();assert.equal(target.hp,80);assert.equal(source.hp,60);assert.equal(e.projectiles.length,0);
 source.hp=50;target.alive=true;target.hp=100;e.dispatchSkillActions(source,target,s,true);target.alive=false;
 e.updateProjectiles();assert.equal(source.hp,50);assert.equal(e.projectiles.length,0);
});

test('specific effect ID stack coefficient sums matching effects across casters only',()=>{
 const e=engine(),source=unit(e),target=unit(e,'enemy',105);
 target.activeEffects=[{id:'bleed',stacks:2,casterId:'a'},{id:'bleed',stacks:3,casterId:'b'},{id:'poison',stacks:7,casterId:'a'}];
 const coefficient={type:'calculated',field:'targetEffectIdStacks',effectId:'bleed',calc:'percent',value:200};
 assert.equal(e.getCoefficientValue(coefficient,source,target),10);
 assert.equal(e.getCoefficientValue({...coefficient,effectId:'missing'},source,target),0);
 const normalized=e.normalizeCoefficient({...coefficient,effectId:'  bleed  '});
 assert.equal(normalized.effectId,'bleed');assert.equal(normalized.field,'targetEffectIdStacks');
 const action=e.createDefaultAction('deal_damage');action.coefficients=[normalized];
 e.applySkill(source,target,skill(e,action));assert.equal(target.hp,90);
});

test('actual healing from one action can convert into following damage without overheal',()=>{
 const e=engine(),source=unit(e),target=unit(e,'enemy',105);source.hp=80;
 const heal=e.createDefaultAction('heal');heal.target='self';heal.coefficients=[{type:'fixed',value:50}];
 const damage=e.createDefaultAction('deal_damage');damage.target='enemy';damage.coefficients=[{type:'calculated',field:'previousActualHealing',calc:'percent',value:50}];
 const s=e.normalizeSkillJson([{id:'healing_conversion',name:'healing conversion',actions:[heal,damage]}]).find(x=>x.id==='healing_conversion');
 e.applySkill(source,target,s);
 assert.equal(source.hp,100);assert.equal(target.hp,90);
});

test('execution healing sums actual HP and resource recovery for later actions',()=>{
 const e=engine(),source=unit(e),target=unit(e,'enemy',105);source.hp=90;source.mp=70;
 const hp=e.createDefaultAction('heal');hp.target='self';hp.coefficients=[{type:'fixed',value:20}];
 const mp=e.createDefaultAction('heal');mp.target='self';mp.healResource='MP';mp.coefficients=[{type:'fixed',value:20}];
 const damage=e.createDefaultAction('deal_damage');damage.target='enemy';damage.coefficients=[{type:'calculated',field:'executionActualHealing',calc:'percent',value:100}];
 const s=e.normalizeSkillJson([{id:'healing_sum',name:'healing sum',actions:[hp,mp,damage]}]).find(x=>x.id==='healing_sum');
 e.applySkill(source,target,s);
 assert.equal(source.hp,100);assert.equal(source.mp,90);assert.equal(target.hp,70);
 for(const field of ['previousActualHealing','executionActualHealing'])assert.equal(e.normalizeCoefficient({type:'calculated',field,calc:'percent',value:100}).field,field);
});

test('an unavailable healing action contributes zero to result conversion',()=>{
 const e=engine(),source=unit(e),target=unit(e,'enemy',105);
 const heal=e.createDefaultAction('heal');heal.target='self';heal.coefficients=[{type:'fixed',value:20}];
 const damage=e.createDefaultAction('deal_damage');damage.target='enemy';damage.coefficients=[{type:'calculated',field:'previousActualHealing',calc:'percent',value:100}];
 const s=e.normalizeSkillJson([{id:'zero_healing',name:'zero healing',actions:[heal,damage]}]).find(x=>x.id==='zero_healing');
 e.applySkill(source,target,s);assert.equal(target.hp,100);
});

test('charged stat buff consumes once per matching event and restores the base stat',()=>{
 const e=engine(),source=unit(e),target=unit(e,'enemy',105);
 const buff=e.createDefaultAction('add_buff');buff.target='self';buff.effect.id='charged_atk';buff.effect.stat='atk';buff.effect.value=5;buff.effect.uses=2;buff.effect.consumeOn='hit';
 e.applySkill(source,source,skill(e,buff));assert.equal(source.atk,15);assert.equal(source.activeEffects[0].usesRemaining,2);
 const attack=skill(e,{type:'deal_damage',target:'enemy',coefficients:[{type:'calculated',field:'atk',calc:'percent',value:100}]});
 e.applySkill(source,target,attack);assert.equal(target.hp,85);assert.equal(source.activeEffects[0].usesRemaining,1);assert.equal(source.atk,15);
 e.applySkill(source,target,attack);assert.equal(target.hp,70);assert.equal(source.activeEffects.length,0);assert.equal(source.atk,10);
 e.applySkill(source,target,attack);assert.equal(target.hp,60);
});

test('damage immunity consumes configured hits before HP or barrier loss',()=>{
 const e=engine(),source=unit(e),target=unit(e,'enemy',105);target.bp=5;
 const ward=e.createDefaultAction('add_buff');ward.target='self';ward.effect.id='two_hits';ward.effect.mode='damage_immunity';ward.effect.uses=2;ward.effect.consumeOn='hit';
 e.applySkill(target,target,skill(e,ward));assert.equal(target.activeEffects[0].consumeOn,'damaged');
 const attack=skill(e,{type:'deal_damage',target:'enemy',coefficients:[{type:'fixed',value:10}]});
 e.applySkill(source,target,attack);e.applySkill(source,target,attack);
 assert.equal(target.hp,100);assert.equal(target.bp,5);assert.equal(target.activeEffects.length,0);
 e.applySkill(source,target,attack);assert.equal(target.bp,0);assert.equal(target.hp,100);
});

test('guard charges ignore direct hits but are not consumed by DOT or field ticks',()=>{
 const e=engine(),source=unit(e),target=unit(e,'enemy',105);
 const guard=e.createDefaultAction('add_buff');guard.target='self';guard.duration=0;
 Object.assign(guard.effect,{id:'marine_guard',name:'guard',mode:'damage_immunity',uses:2,consumePeriodic:false});
 e.applySkill(target,target,skill(e,guard));
 const dot=e.createDefaultAction('deal_damage');Object.assign(dot,{target:'enemy',periodic:true,damageType:'fixed',coefficients:[{type:'fixed',value:10}]});
 e.applyActionDamage(source,target,dot,{id:'dot',name:'dot'});
 assert.equal(target.hp,90);assert.equal(target.activeEffects[0].usesRemaining,2);
 const field=fieldAction(e,'deal_damage',1,1/60);field.coefficients=[{type:'fixed',value:10}];field.fieldRadius=1;
 e.applySkill(source,target,skill(e,field));e.updateBattleFields();
 assert.equal(target.hp,80);assert.equal(target.activeEffects[0].usesRemaining,2);
 const direct=e.createDefaultAction('deal_damage');direct.damageType='fixed';direct.coefficients=[{type:'fixed',value:10}];
 e.applyActionDamage(source,target,direct,{id:'direct',name:'direct'});e.applyActionDamage(source,target,direct,{id:'direct',name:'direct'});
 assert.equal(target.hp,80);assert.equal(target.activeEffects.length,0);
});

test('counter ignores one direct hit and retaliates only against melee without recursion',()=>{
 const e=engine(),attacker=unit(e),viking=unit(e,'enemy',105);
 const counter=e.createDefaultAction('add_buff');counter.target='self';counter.duration=0;
 Object.assign(counter.effect,{id:'viking_counter',name:'counter',mode:'damage_immunity',uses:1,consumePeriodic:false,counterOnMelee:true});
 const melee=e.createDefaultAction('deal_damage');Object.assign(melee,{target:'enemy',rangeMode:'custom',rangeValue:1,damageType:'fixed',coefficients:[{type:'fixed',value:20}]});
 e.applySkill(viking,viking,skill(e,counter));e.applyActionDamage(attacker,viking,melee,{id:'melee',name:'melee'});
 assert.equal(viking.hp,100);assert.equal(attacker.hp,90);assert.equal(viking.activeEffects.length,0);
 attacker.hp=100;viking.hp=100;e.applySkill(viking,viking,skill(e,counter));
 const ranged={...melee,rangeValue:2};e.applyActionDamage(attacker,viking,ranged,{id:'ranged',name:'ranged'});
 assert.equal(viking.hp,100);assert.equal(attacker.hp,100);assert.equal(viking.activeEffects.length,0);
 e.applySkill(attacker,attacker,skill(e,counter));e.applySkill(viking,viking,skill(e,counter));
 e.applyActionDamage(attacker,viking,melee,{id:'melee',name:'melee'});
 assert.equal(viking.hp,100);assert.equal(attacker.hp,100);assert.equal(viking.activeEffects.length,0);assert.equal(attacker.activeEffects.length,0);
});

test('marine guard and viking counter data match class rules and assignments',()=>{
 const skills=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','skills.json'),'utf8'));
 const characters=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','characters.json'),'utf8'));
 const guard=skills.find(item=>item.id==='skill_class_marine_guard'),counter=skills.find(item=>item.id==='skill_class_viking_counter');
 assert.deepEqual([guard.castTime,guard.cooldown,guard.actions[0].effect.uses,guard.actions[0].effect.consumePeriodic],[0,7,2,false]);
 assert.deepEqual([counter.castTime,counter.cooldown,counter.actions[0].effect.uses,counter.actions[0].effect.consumePeriodic,counter.actions[0].effect.counterOnMelee],[0,3,1,false,true]);
 assert.ok(characters.find(character=>character.name==='해병').skillIds.includes(guard.id));
 assert.deepEqual(characters.find(character=>character.name==='바이킹').skillIds,[counter.id]);
});

function damageProxyAction(e,percent=20,priority=100,scope='all') {
 const action=e.createDefaultAction('add_buff');action.target='ally';action.effect.id=`proxy_${priority}_${scope}`;action.effect.name='피해 대리';
 Object.assign(action.effect,{mode:'damage_proxy',proxyPercent:percent,proxyPriority:priority,proxyScope:scope});return action;
}

test('knight mount and demon brute branch on owned summon state and proxy owner damage', () => {
  const e=engine();
  const allSkills=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','skills.json'),'utf8'));
  const ids=['skill_class_knight_magic_horse','skill_class_knight_haste_horse','skill_class_knight_summon_horse','skill_class_demon_brute','skill_class_demon_brute_spawn'];
  const actual=allSkills.filter(candidate=>ids.includes(candidate.id));
  assert.equal(actual.length,5);
  e.skillsJson=e.normalizeSkillJson(actual);
  e.newEntities=['knight_magic_horse','demon_brute'].map(id=>JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','entities',`${id}.json`),'utf8')));
  vm.runInContext('entitiesJson.push(...newEntities)',e);

  const knight=unit(e);knight.name='기사';knight.speed=1.3;knight.atk=90;knight.attackSpeed=2;
  const enemy=unit(e,'enemy',120);enemy.atk=100;
  const passive=e.skillsJson.find(candidate=>candidate.id==='skill_class_knight_magic_horse');
  const haste=e.skillsJson.find(candidate=>candidate.id==='skill_class_knight_haste_horse');
  assert.equal(e.isSkillExecutable(passive),true,JSON.stringify(passive.actions));
  knight.skillIds=[passive.id];
  e.publishBattleEvents([{type:'battle_entry',source:knight,target:knight}]);
  assert.equal(knight.summons.filter(summon=>summon.alive).length,1);
  const horse=knight.summons[0];
  assert.equal(horse.entityId,'knight_magic_horse');assert.equal(horse.maxHp,500);
  assert.ok(Math.abs(knight.speed-1.69)<1e-9);
  e.applyActionDamage(enemy,knight,{damageType:'fixed',coefficients:[{type:'fixed',value:100}]});
  assert.equal(knight.hp,20);assert.equal(horse.hp,480);

  const summonCount=knight.summons.length;
  e.applySkill(knight,knight,haste);
  assert.equal(knight.summons.length,summonCount);
  assert.equal(knight.atk,108);assert.equal(knight.effectAttackRateMultiplier,1.2);
  horse.hp=0;e.syncAliveState(horse);e.updateBattleEffects(knight);
  assert.equal(knight.speed,1.3);
  e.applySkill(knight,knight,e.getFormSkill(knight,haste));
  assert.equal(knight.summons.filter(summon=>summon.alive).length,1);
  assert.equal(knight.atk,108);assert.equal(knight.attackSpeed,2/1.2);

  const demon=unit(e);demon.name='악마';demon.magic=60;demon.hp=demon.maxHp=500;
  const bruteSkill=e.skillsJson.find(candidate=>candidate.id==='skill_class_demon_brute');
  e.dispatchSkillActions(demon,demon,e.getFormSkill(demon,bruteSkill),false);
  const brute=demon.summons.find(summon=>summon.alive);
  assert.equal(brute.entityId,'demon_brute');assert.equal(brute.attackType,'magic');assert.equal(brute.magic,30);
  e.applyActionDamage(enemy,demon,{damageType:'fixed',coefficients:[{type:'fixed',value:100}]});
  assert.equal(demon.hp,460);assert.equal(brute.hp,940);
  enemy.x=brute.x+5;enemy.y=brute.y;enemy.hp=enemy.maxHp=500;
  e.dispatchSkillActions(demon,enemy,bruteSkill,false);
  assert.equal(demon.summons.filter(summon=>summon.alive).length,1);
  assert.equal(brute.magic,30);assert.equal(enemy.hp,440);
});

test('demon minions intercept lethal hits and demon general uses an area basic attack',()=>{
 const e=engine();
 const allSkills=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','skills.json'),'utf8'));
 const ids=['skill_class_demon_summon_minions','skill_class_demon_summon_general','skill_entity_demon_general_attack'];
 e.skillsJson=e.normalizeSkillJson(allSkills.filter(candidate=>ids.includes(candidate.id)));
 e.newEntities=['demon_minion','demon_general'].map(id=>JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','entities',`${id}.json`),'utf8')));
 vm.runInContext('entitiesJson.push(...newEntities)',e);
 const demon=unit(e);demon.magic=100;demon.hp=demon.maxHp=500;
 const primary=unit(e,'enemy',140),near=unit(e,'enemy',155),far=unit(e,'enemy',240);
 primary.y=near.y=far.y=100;primary.hp=primary.maxHp=near.hp=near.maxHp=far.hp=far.maxHp=500;
 const minionSkill=e.skillsJson.find(skill=>skill.id==='skill_class_demon_summon_minions');
 const generalSkill=e.skillsJson.find(skill=>skill.id==='skill_class_demon_summon_general');
 e.dispatchSkillActions(demon,demon,minionSkill,false);
 assert.equal(demon.summons.filter(summon=>summon.alive && summon.entityId==='demon_minion').length,3);
 e.applyActionDamage(primary,demon,{damageType:'fixed',coefficients:[{type:'fixed',value:25}]});
 assert.equal(demon.hp,500);assert.equal(demon.summons.filter(summon=>summon.alive && summon.entityId==='demon_minion').length,2);
 e.dispatchSkillActions(demon,primary,generalSkill,false);
 const general=demon.summons.find(summon=>summon.alive && summon.entityId==='demon_general');
 assert.equal(general.attackSkillId,'skill_entity_demon_general_attack');assert.equal(general.attackSpeed,1);
 assert.equal(primary.hp,450);assert.equal(near.hp,450);assert.equal(far.hp,500);
 assert.equal(e.hasBattleState(primary,'stun'),true);assert.equal(e.hasBattleState(near,'stun'),true);assert.equal(e.hasBattleState(far,'stun'),false);
 primary.hp=near.hp=far.hp=500;near.x=general.x+10;near.y=general.y;far.x=general.x+100;far.y=general.y;
 const attack=e.getUnitSkill(general);e.applySkill(general,primary,attack);
 assert.equal(primary.hp,480);assert.equal(near.hp,480);assert.equal(far.hp,500);
});

test('demon summon data and entity attack references match class rules',()=>{
 const skills=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','skills.json'),'utf8'));
 const characters=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','characters.json'),'utf8'));
 const find=id=>skills.find(skill=>skill.id===id),minions=find('skill_class_demon_summon_minions'),general=find('skill_class_demon_summon_general'),attack=find('skill_entity_demon_general_attack');
 assert.deepEqual([minions.castTime,minions.cooldown,minions.actions[0].count,minions.actions[0].duration,minions.actions[0].protectOwnerPercent],[2,10,3,5,100]);
 assert.deepEqual([general.castTime,general.cooldown,general.actions[0].duration,general.actions[1].area,general.actions[1].coefficients[0].value,general.actions[2].duration],[2,15,8,3,50,1]);
 assert.deepEqual([attack.slot,attack.actions[0].area,attack.actions[0].areaCenter,attack.actions[0].coefficients[0].value],['basic',3,'self',100]);
 const generalEntity=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','entities','demon_general.json'),'utf8'));
 assert.equal(generalEntity.attackSkillId,attack.id);assert.equal(generalEntity.stats.attackSpeed,1);
 assert.deepEqual(characters.find(character=>character.skillIds?.includes('skill_class_demon_brute')).skillIds,['skill_class_demon_duty','skill_class_demon_brute',minions.id,general.id,'skill_class_demon_legion','skill_class_demon_king_ultimate']);
});

test('demon legion buffs only owned summons and revised templates inherit owner magic',()=>{
 const e=engine();e.skillsJson=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'../data/skills.json'),'utf8')));
 e.newEntities=['demon_brute','demon_minion','demon_general'].map(id=>JSON.parse(fs.readFileSync(path.join(__dirname,'../data/entities',id+'.json'),'utf8')));vm.runInContext('entitiesJson.push(...newEntities)',e);
 const s=unit(e),ally=unit(e,'player',120),enemy=unit(e,'enemy',140);s.magic=200;ally.magic=50;const find=id=>e.getSkillById('skill_class_demon_'+id);
 e.applySkill(s,s,find('summon_minions'));e.applySkill(s,enemy,find('summon_general'));
 const minion=s.summons.find(x=>x.entityId==='demon_minion'),general=s.summons.find(x=>x.entityId==='demon_general');
 assert.equal(minion.magic,10);assert.equal(minion.maxHp,10);assert.equal(minion.castSpeed,1.5);assert.equal(general.magic,40);assert.equal(general.maxHp,300);assert.equal(general.summonTicks,480);
 e.applySkill(s,minion,find('legion'));assert.equal(minion.magic,12);assert.equal(general.magic,48);assert.equal(s.magic,200);assert.equal(ally.magic,50);
 for(let i=0;i<300;i++)e.updateBattleEffects();assert.equal(minion.magic,10);assert.equal(general.magic,40);
 s.skillIds=[find('basic_fitness').id];assert.equal(e.getSelectedOptionalStatEffects(s).find(x=>x.stat==='maxHp').value,500);
});

function demonEngine(options=[]) {
 const e=engine();e.skillsJson=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'../data/skills.json'),'utf8')));
 e.newEntities=['demon_brute','demon_minion','demon_general','demon_king'].map(id=>JSON.parse(fs.readFileSync(path.join(__dirname,'../data/entities',id+'.json'),'utf8')));vm.runInContext('entitiesJson.push(...newEntities)',e);
 e.demon=id=>e.getSkillById('skill_class_demon_'+id);const s=e.owner=unit(e),t=e.target=unit(e,'enemy',130);s.magic=100;s.hp=s.maxHp=1000;t.hp=t.maxHp=10000;
 s.skillIds=['duty','brute','summon_minions','summon_general','legion','king_ultimate',...options].map(id=>e.demon(id).id);
 e.runtime=id=>e.getRuntimeSelectionSkill(s,e.getFormSkill(s,e.demon(id)));
 e.cast=(id,target=t,override={})=>{const skill={...e.runtime(id),...override},resourceSpent=e.spendSkillResourceCosts(s,skill);e.startCast(s,{type:'skill',skill,target,resourceSpent});for(let i=0;s.pendingAction && i<500;i++)e.updateCast(s);return skill;};
 e.tick=()=>{e.updateBattleEffects();e.updateSummonLifetimes();e.tickSkillCooldowns(s);};
 e.publishBattleEvents([{type:'battle_entry',source:s,target:s}]);return e;
}

test('demon duty grants one percent magic and damage reduction per living owned summon without drift',()=>{
 const e=demonEngine(),s=e.owner;e.cast('summon_minions',s);assert.equal(s.magic,103);assert.equal(e.getUnitIncomingRulePercent(s,'receivedDamagePercent'),97);
 for(let i=0;i<10;i++)e.updateSummonSynergies();assert.equal(s.magic,103);
 const m=s.summons[0];m.hp=0;e.syncAliveState(m);assert.equal(s.magic,102);assert.equal(e.getUnitIncomingRulePercent(s,'receivedDamagePercent'),98);assert.equal(e.getUnitBarrierValue(s),0);
});

test('demon brute variants use corrected half magic no lifetime and direct double magic command',()=>{
 const e=demonEngine(),s=e.owner,t=e.target;let skill=e.runtime('brute');assert.equal(skill.castTime,3);assert.equal(skill.cooldown,0);assert.equal(skill.resourceCosts[0].value,30);
 e.cast('brute',s);const b=s.summons[0];assert.equal(b.magic,50);assert.equal(b.summonTicks,null);assert.equal(s.mp,70);
 t.x=b.x+5;t.y=b.y;skill=e.cast('brute',t);assert.equal(skill.castTime,1);assert.equal(s.mp,60);assert.equal(s.skillCooldowns[skill.id],600);assert.equal(t.hp,9900);
 b.hp=0;e.syncAliveState(b);assert.equal(e.runtime('brute').castTime,3);
 const f=demonEngine(['reliable_brute']);assert.equal(f.owner.summons.length,1);const brute=f.owner.summons[0];brute.hp=0;f.syncAliveState(brute);assert.equal(f.runtime('brute').castTime,2);
});

test('demon minions inherit weapon range and die on a single small direct or proxy hit',()=>{
 const e=demonEngine(),s=e.owner;s.attackRange=9;e.cast('summon_minions',s);const minions=s.summons.slice();assert.equal(minions[0].attackRange,9);assert.equal(minions[0].maxHp,10);
 const action=e.normalizeSkillAction({type:'deal_damage',damageType:'fixed',coefficients:[{type:'fixed',value:1}]});
 e.applyActionDamage(e.target,minions[0],action);assert.equal(minions[0].alive,false);
 const hp=s.hp;e.applyActionDamage(e.target,s,action);assert.equal(s.hp,hp);assert.equal(minions.filter(m=>m.alive).length,1);assert.equal(e.getUnitBarrierValue(s),0);
});

test('demon expiry rewards current summon magic and refunds only half of paid batch MP once',()=>{
 const e=demonEngine(['gift_to_master','minion_horde']),s=e.owner;
 e.cast('summon_minions',s,{resourceCosts:[{resource:'MP',mode:'fixed',value:20}]});assert.equal(s.mp,80);assert.equal(s.summons.length,4);
 e.cast('legion',s);const magic=s.summons.reduce((sum,m)=>sum+m.magic,0);assert.equal(magic,24);s.mp=80;
 // Expiry observes the minions' current (buffed) magic, before the legion buff ends.
 for(const m of s.summons)m.summonTicks=1;e.updateSummonLifetimes();assert.equal(e.getUnitBarrierValue(s),24);assert.equal(s.mp,90);assert.equal(s.magic,100);
 e.updateSummonLifetimes();assert.equal(e.getUnitBarrierValue(s),24);assert.equal(s.mp,90);
});

test('demon general choice blocks recast while alive halves magic and removes lifetime',()=>{
 const e=demonEngine(['great_general']),s=e.owner;e.cast('summon_general');const g=s.summons[0];assert.equal(g.magic,10);assert.equal(g.summonTicks,null);assert.equal(e.canActivateSkill(s,e.runtime('summon_general')),false);
 g.hp=0;e.syncAliveState(g);assert.equal(e.canActivateSkill(s,e.runtime('summon_general')),true);assert.equal(e.getUnitBarrierValue(s),0);
});

test('demon king is once after thirty seconds and reduces owner damage only while alive',()=>{
 const e=demonEngine(),s=e.owner;vm.runInContext('combatEventTick=1799',e);assert.equal(e.canActivateSkill(s,e.runtime('king_ultimate')),false);vm.runInContext('combatEventTick=1800',e);
 s.attackRange=8;e.cast('king_ultimate',s);const k=s.summons[0];assert.equal(k.maxHp,1500);assert.equal(k.magic,100);assert.equal(k.attackRange,8);assert.equal(k.summonTicks,900);assert.equal(e.getUnitIncomingRulePercent(s,'receivedDamagePercent'),79.2);assert.equal(e.canActivateSkill(s,e.runtime('king_ultimate')),false);
 k.hp=0;e.syncAliveState(k);assert.equal(e.getUnitIncomingRulePercent(s,'receivedDamagePercent'),100);assert.equal(e.getUnitBarrierValue(s),0);
});

test('demon kings arrival triggers legion without extra cost and extends existing buffs by five seconds',()=>{
 const e=demonEngine(['kings_arrival']),s=e.owner;e.cast('summon_minions',s);e.cast('legion',s);s.summons.forEach(m=>m.activeEffects.find(x=>x.id==='demon_legion').remainingTicks=120);
 const mp=s.mp,cd=s.skillCooldowns[e.demon('legion').id];e.cast('king_ultimate',s);assert.equal(s.mp,mp);assert.equal(s.skillCooldowns[e.demon('legion').id],cd);
 const minion=s.summons[0];assert.equal(minion.activeEffects.find(x=>x.id==='demon_legion').remainingTicks,420);const king=s.summons.find(x=>x.entityId==='demon_king');assert.equal(king.activeEffects.find(x=>x.id==='demon_legion').remainingTicks,300);
});

test('demon optional fourth selection is inactive and forced removal never pays expiry rewards',()=>{
 const e=demonEngine(['basic_fitness','reliable_brute','minion_horde','great_general']),s=e.owner;e.cast('summon_general');assert.equal(s.summons.find(x=>x.entityId==='demon_general').summonTicks,480);
 e.removeSummonedBattleUnit(s.summons[0]);assert.equal(e.getUnitBarrierValue(s),0);assert.equal(e.getSelectedOptionalStatEffects(s).find(x=>x.stat==='maxHp').value,500);
});

function guardianBaseEngine() {
 const e=engine();e.skillsJson=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'../data/skills.json'),'utf8')));
 e.guardian=id=>e.getSkillById('skill_class_guardian_'+id);e.owner=unit(e);e.owner.hp=e.owner.maxHp=1000;e.owner.speed=1;e.target=unit(e,'enemy',120);return e;
}

test('guardian revised whirl uses stamina three meter area and optional six second cooldown',()=>{
 const e=guardianBaseEngine(),s=e.owner,t=e.target,near=unit(e,'enemy',130),far=unit(e,'enemy',140);s.atk=100;for(const u of [t,near,far])u.hp=u.maxHp=500;
 const skill=e.guardian('whirl');assert.equal(skill.actions[0].rangeMode,'mainWeapon');e.spendSkillResourceCosts(s,skill);e.applySkill(s,t,skill);
 assert.equal(s.st,95);assert.equal(s.mp,100);assert.equal(t.hp,430);assert.equal(near.hp,430);assert.equal(far.hp,500);
 s.skillIds=[e.guardian('infinite_whirl').id];assert.equal(e.getRuntimeSelectionSkill(s,skill).cooldown,6);
});

test('guardian raised shield reduces incoming damage and speed and blocks attacks and skills for three seconds',()=>{
 const e=guardianBaseEngine(),s=e.owner;e.spendSkillResourceCosts(s,e.guardian('raise_shield'));e.applySkill(s,s,e.guardian('raise_shield'));
 assert.equal(s.st,90);assert.equal(s.speed,.7);assert.equal(e.hasBattleState(s,'disarm'),true);assert.equal(e.isUnitSkillDisabled(s,e.guardian('whirl')),true);
 e.applyActionDamage(e.target,s,e.normalizeSkillAction({type:'deal_damage',damageType:'fixed',coefficients:[{type:'fixed',value:100}]}));assert.equal(s.hp,930);
 for(let i=0;i<180;i++){e.updateBattleEffects();e.updateRuntimeRuleOverrides();}
 assert.equal(s.speed,1);assert.equal(e.hasBattleState(s,'disarm'),false);assert.equal(e.isUnitSkillDisabled(s,e.guardian('whirl')),false);
});

test('guardian devotion rejects self and transfers thirty percent of allied damage for five seconds',()=>{
 const e=guardianBaseEngine(),s=e.owner,a=unit(e,'player',110);a.hp=a.maxHp=1000;const skill=e.guardian('devotion');
 e.applySkill(s,s,skill);assert.equal(s.activeEffects.some(x=>x.id==='guardian_devotion'),false);
 e.applySkill(s,a,skill);e.applyActionDamage(e.target,a,e.normalizeSkillAction({type:'deal_damage',damageType:'fixed',coefficients:[{type:'fixed',value:100}]}));
 assert.equal(a.hp,930);assert.equal(s.hp,970);for(let i=0;i<300;i++)e.updateBattleEffects();assert.equal(a.activeEffects.some(x=>x.id==='guardian_devotion'),false);
});

test('guardian ultimate restores thirty percent maximum HP barrier and taunts enemies within six meters',()=>{
 const e=guardianBaseEngine(),s=e.owner,t=e.target,far=unit(e,'enemy',170),skill=e.guardian('endless_sacrifice_ultimate');
 vm.runInContext('combatEventTick=1799',e);assert.equal(e.canActivateSkill(s,skill),false);vm.runInContext('combatEventTick=1800',e);
 e.startCast(s,{type:'skill',skill,target:t});for(let i=0;s.pendingAction && i<100;i++)e.updateCast(s);
 assert.equal(e.getUnitBarrierValue(s),300);assert.equal(e.getTauntTarget(t),s);assert.equal(e.getTauntTarget(far),null);assert.equal(e.canActivateSkill(s,skill),false);
});

function guardianBuild(options=[]) {
 const e=guardianBaseEngine(),s=e.owner;e.isPhysicalAttackUnit=u=>u.attackType!=="magic";s.defense=40;s.resistance=20;s.atk=100;e.target.hp=e.target.maxHp=10000;
 s.skillIds=['endurance','whirl','effort_strike','raise_shield','devotion','endless_sacrifice_ultimate',...options].map(id=>e.guardian(id).id);
 e.runtime=id=>e.getRuntimeSelectionSkill(s,e.getFormSkill(s,e.guardian(id)));
 e.cast=(id,target=s)=>{const skill=e.runtime(id),resourceSpent=e.spendSkillResourceCosts(s,skill);e.startCast(s,{type:'skill',target,skill,resourceSpent});for(let i=0;s.pendingAction && i<100;i++)e.updateCast(s);return skill;};
 e.tick=()=>{vm.runInContext('combatEventTick++',e);e.updateBattleEffects();e.updateRuntimeRuleOverrides();};
 e.hit=(source=e.target,target=s,extra={})=>e.applyActionDamage(source,target,{...e.normalizeSkillAction({type:'deal_damage',damageType:'fixed',coefficients:[{type:'fixed',value:10}],...extra}),...extra});
 return e;
}

test('guardian direct attacker defense counts unique single target attackers refreshes and expires at three seconds',()=>{
 const e=guardianBuild(['magic_protection']),s=e.owner,b=unit(e,'enemy',130);e.hit();assert.equal(s.defense,40);e.hit();assert.equal(s.defense,40);
 e.hit(b);assert.equal(s.defense,50);assert.equal(s.resistance,24);
 for(let i=0;i<179;i++)e.tick();assert.equal(s.defense,50);e.tick();assert.equal(s.defense,40);assert.equal(s.resistance,20);
 e.hit();e.hit(b);for(let i=0;i<120;i++)e.tick();e.hit();for(let i=0;i<60;i++)e.tick();assert.equal(s.defense,40);assert.equal(s.directAttackers.get(e.guardian('endurance').id).size,1);
});

test('guardian raised shield blocks actives while preserving the direct attacker passive',()=>{
 const e=guardianBuild(['magic_protection']),s=e.owner;e.cast('raise_shield');e.hit();e.hit(unit(e,'enemy',130));
 assert.equal(s.defense,50);assert.equal(s.resistance,24);assert.equal(e.isUnitSkillDisabled(s,e.guardian('endurance')),false);assert.equal(e.isUnitSkillDisabled(s,e.guardian('whirl')),true);
});

test('guardian attacker defense excludes area chain periodic reflected and redirected hits',()=>{
 const e=guardianBuild(),s=e.owner;
 for(const extra of [{area:3},{chainCount:1},{periodic:true},{reflected:true},{battlefieldArea:true},{splashRadius:3,splashPercent:30}])e.hit(unit(e,'enemy',130),s,extra);
 assert.equal(s.directAttackers.size,0);const ally=unit(e,'player',110);e.cast('devotion',ally);e.hit(e.target,ally);assert.equal(s.directAttackers.size,0);
 e.hit();e.hit(unit(e,'enemy',130));assert.equal(s.defense,50);
});

test('guardian effort stores actual reduced damage including barriers and starts cooldown only after release',()=>{
 const e=guardianBuild(),s=e.owner,t=e.target;e.cast('effort_strike');assert.equal(s.mp,80);assert.equal(s.skillCooldowns[e.guardian('effort_strike').id],0);assert.equal(e.canActivateSkill(s,e.runtime('effort_strike')),false);
 e.hit();assert.equal(s.hp,991);assert.equal(s.damageStorage.amount,9);s.bp=20;e.hit();assert.equal(s.bp,11);assert.equal(s.damageStorage.amount,18);
 for(let i=0;i<300;i++)e.tick();assert.equal(s.damageStorage.phase,'ready');assert.equal(e.runtime('effort_strike').name,'수호자 · 노력의 일격');
 t.x=105;e.cast('effort_strike',t);assert.equal(t.hp,10000-103.6);assert.equal(s.mp,80);assert.equal(s.damageStorage,null);assert.equal(s.skillCooldowns[e.guardian('effort_strike').id],600);
});

test('guardian true effort changes only stored component and snapshots projectile damage before clearing storage',()=>{
 const e=guardianBuild(['true_effort']),s=e.owner,t=e.target;e.cast('effort_strike');e.hit();for(let i=0;i<300;i++)e.tick();
 t.x=140;e.cast('effort_strike',t);assert.equal(s.damageStorage,null);assert.equal(t.hp,10000);e.updateProjectiles();assert.equal(t.hp,9895.5);
});

test('guardian life affinity is conditional and tenacious life follows caster defenses and ends with devotion',()=>{
 const e=guardianBuild(['life_affinity','tenacious_life']),s=e.owner,a=unit(e,'player',110);a.defense=10;a.resistance=5;
 s.hp=500;e.applyActionHeal(a,s,{healResource:'HP',coefficients:[{type:'fixed',value:100}]});assert.equal(s.hp,620);
 e.cast('devotion',a);assert.equal(a.defense,30);assert.equal(a.resistance,15);
 e.hit();e.hit(unit(e,'enemy',130));e.tick();assert.equal(s.defense,50);assert.equal(a.defense,35);
 for(let i=0;i<300;i++)e.tick();assert.equal(a.defense,10);assert.equal(a.resistance,5);
 s.skillIds=s.skillIds.filter(id=>id!==e.guardian('life_affinity').id);s.hp=500;e.applyActionHeal(a,s,{healResource:'HP',coefficients:[{type:'fixed',value:100}]});assert.equal(s.hp,600);
});

test('guardian to the end keeps corpse taunt whiffs without damage or living membership and releases at expiry',()=>{
 const e=guardianBuild(['to_the_end']),s=e.owner,t=e.target,ally=unit(e,'player',105);ally.hp=ally.maxHp=1000;e.cast('endless_sacrifice_ultimate',t);
 assert.equal(t.activeEffects.find(x=>x.state==='taunt').remainingTicks,300);s.hp=0;e.syncAliveState(s);e.updateBattleEffects();assert.equal(e.getTauntTarget(t),s);assert.equal(e.getActiveBattleEntities(e.playerSquad).includes(s),false);
 t.attackRange=5;t.x=120;e.takeAction(t,[t],[ally]);for(let i=0;i<60;i++)e.takeAction(t,[t],[ally]);assert.equal(s.hp,0);assert.equal(ally.hp,1000);assert.equal(e.canDirectlyTarget(t,ally),false);
 for(let i=0;i<299;i++)e.tick();assert.equal(e.getTauntTarget(t),null);assert.equal(e.canDirectlyTarget(t,ally),true);
});

test('guardian ordinary taunt ends when caster dies and fourth optional does not enable corpse targeting',()=>{
 for(const options of [[],['infinite_whirl','magic_protection','life_affinity','to_the_end']]) {
  const e=guardianBuild(options);e.cast('endless_sacrifice_ultimate',e.target);e.owner.hp=0;e.syncAliveState(e.owner);assert.equal(e.getTauntTarget(e.target),null);
 }
});

test('guardian storage and attacker history reset on death or battle initialization',()=>{
 const e=guardianBuild(),s=e.owner;e.cast('effort_strike');e.hit();e.hit(unit(e,'enemy',130));s.hp=0;e.syncAliveState(s);e.updateBattleEffects();assert.equal(s.damageStorage,null);assert.equal(s.directAttackers.size,0);
 e.resetUnitForBattle(s);assert.equal(s.damageStorage,null);assert.equal(s.directAttackers.size,0);assert.equal(s.defense,40);
});

function basicActionEngine() {
  const e=engine();
  e.isMagicAttackUnit=u=>u.attackType==='magic';
  e.isPhysicalAttackUnit=u=>u.attackType!=='magic';
  return e;
}

test('common action priority selects ready skills before weapons for every role and weapon count', () => {
  for (const role of ['melee','ranged','healer','tank']) for (const count of [1,2]) {
    const e=basicActionEngine(), source=unit(e), enemy=unit(e,'enemy',110);
    Object.assign(source,{role,attackType:'physical',castSpeed:0,
      weaponAttacks:Array.from({length:count},()=>({attackType:'physical',attackRange:5,attackSpeed:1,castSpeed:0}))});
    e.resetUnitForBattle(source);
    const first=skill(e,{type:'deal_damage',target:'enemy',damageType:'fixed',coefficients:[{type:'fixed',value:3}]});
    const ready={...first,id:'ready'};
    e.skillsJson=[first,ready];source.skillIds=[first.id,ready.id];source.skillCooldowns[first.id]=100;
    e.takeAction(source,e.playerSquad,e.enemySquad);
    assert.equal(enemy.hp,97,`${role}/${count}: skill only`);
    assert.equal(source.st,100,`${role}/${count}: no weapon resource spent`);
    assert.equal(e.getBattleEvents('cast_start').at(-1).skillId,ready.id);
    e.takeAction(source,e.playerSquad,e.enemySquad);e.updateProjectiles();
    assert(enemy.hp<97,`${role}/${count}: weapon during cooldowns`);
    assert.equal(source.st,100-10*count);
  }
});

test('common action priority blocks weapons during skill casts and finishes committed weapon casts', () => {
  const e=basicActionEngine(), source=unit(e);unit(e,'enemy',110);
  source.weaponAttacks=Array.from({length:2},()=>({attackType:'physical',attackRange:5,attackSpeed:1,castSpeed:0.1}));
  e.resetUnitForBattle(source);
  const active=skill(e,{type:'deal_damage',target:'enemy',coefficients:[{type:'fixed',value:1}]},0.1);
  e.skillsJson=[active];source.skillIds=[active.id];
  e.takeAction(source,e.playerSquad,e.enemySquad);
  e.takeAction(source,e.playerSquad,e.enemySquad);
  assert.equal(source.st,100);assert(source.castTimer>0);
  while(source.castTimer>0) e.takeAction(source,e.playerSquad,e.enemySquad);
  e.takeAction(source,e.playerSquad,e.enemySquad);
  assert.equal(source.st,80);assert(source.weaponAttackStates.every(s=>s.castTimer>0));
  source.skillCooldowns[active.id]=0;
  const casts=e.getBattleEvents('cast_start').length;
  while(source.weaponAttackStates.some(s=>s.castTimer>0)) e.takeAction(source,e.playerSquad,e.enemySquad);
  assert.equal(e.getBattleEvents('cast_start').length,casts);
  e.takeAction(source,e.playerSquad,e.enemySquad);
  assert.equal(e.getBattleEvents('cast_start').length,casts+1);
  assert.equal(source.st,80);
});

test('armed support uses weapon damage while active skills cool down', () => {
  const e=basicActionEngine(), source=unit(e), enemy=unit(e,'enemy',110);
  Object.assign(source,{role:'healer',attackType:'magic',castSpeed:0,weaponAttacks:[{attackType:'magic'}]});
  const active=skill(e,{type:'deal_damage',target:'enemy',coefficients:[{type:'fixed',value:1}]});
  e.skillsJson=[active];source.skillIds=[active.id];source.skillCooldowns[active.id]=100;
  e.takeAction(source,e.playerSquad,e.enemySquad);e.updateProjectiles();
  assert.equal(enemy.hp,80);assert.equal(source.mp,95);
  assert(e.getBattleEvents('cast_start').some(event=>event.skillId==='skill_basic_weapon_attack'));
  source.attackCooldown=0;source.mp=0;
  e.takeAction(source,e.playerSquad,e.enemySquad);assert.equal(source.pendingAction,null);
});

test('healing weapon chooses injured allies regardless of wielder role and idles without a valid target', () => {
  const e=basicActionEngine(), source=unit(e), ally=unit(e,'player',105), enemy=unit(e,'enemy',110);
  const heal=skill(e,{type:'heal',target:'ally',healResource:'HP',coefficients:[{type:'fixed',value:20}]});
  heal.id='weapon_heal';e.skillsJson=[heal];ally.hp=40;
  Object.assign(source,{role:'melee',attackType:'magic',attackSkillId:heal.id,castSpeed:0,weaponAttacks:[{attackSkillId:heal.id}]});
  e.takeAction(source,e.playerSquad,e.enemySquad);e.updateProjectiles();
  assert.equal(ally.hp,60);assert.equal(enemy.hp,100);
  source.attackCooldown=0;ally.hp=100;const mp=source.mp;
  e.takeAction(source,e.playerSquad,e.enemySquad);assert.equal(source.mp,mp);assert.equal(source.pendingAction,null);
});

test('mixed independent weapons choose enemy and ally targets separately', () => {
  const e=basicActionEngine(), source=unit(e), ally=unit(e,'player',105), enemy=unit(e,'enemy',110);
  const heal=skill(e,{type:'heal',target:'ally',healResource:'HP',coefficients:[{type:'fixed',value:20}]});
  heal.id='weapon_heal';e.skillsJson=[heal];ally.hp=40;
  source.weaponAttacks=[{attackType:'physical',attackRange:5,attackSpeed:1,castSpeed:0},
    {attackType:'magic',attackSkillId:heal.id,attackRange:5,attackSpeed:1,castSpeed:0}];
  e.resetUnitForBattle(source);
  e.takeAction(source,e.playerSquad,e.enemySquad);e.updateProjectiles();
  assert.equal(enemy.hp,90);assert.equal(ally.hp,60);
  assert.equal(source.st,90);assert.equal(source.mp,95);
});

test('unarmed healer retains basic healing and active skill priority', () => {
  const e=basicActionEngine(), source=unit(e), ally=unit(e,'player',105);unit(e,'enemy',110);
  Object.assign(source,{role:'healer',attackType:'magic',castSpeed:0});ally.hp=30;
  e.takeAction(source,e.playerSquad,e.enemySquad);e.updateProjectiles();
  assert(ally.hp>30);assert.equal(e.getBasicBattleSkill(source).id,'skill_basic_heal');
  const active=skill(e,{type:'heal',target:'ally',coefficients:[{type:'fixed',value:1}]});
  e.skillsJson=[active];source.skillIds=[active.id];source.attackCooldown=0;
  e.takeAction(source,e.playerSquad,e.enemySquad);
  assert.equal(e.getBattleEvents('cast_start').at(-1).skillId,active.id);
});

test('saved serum staff produces basic attack casts between its class skills', () => {
  const {createEngine,loadData}=require('../balance/simulator/engine.cjs');
  const data=loadData(), serum=data.characters.findIndex(c=>c.name==='혈청형');
  assert(serum>=0);
  const result=createEngine(data).runBattle({teamA:[serum],teamB:[0],seed:42,maxSeconds:30,trace:true});
  assert(result.events.some(event=>event.type==='cast_start' && event.source?.side==='player' && event.skillId==='skill_basic_weapon_attack'));
});

function lifecycleSummon(e, owner, type, count=1) {
  const s=skill(e,{type:'summon_entity',summon:{count,limit:3,lifetime:0}});
  e.newEntity.summonType=type;
  e.applySkill(owner,owner,s);
  return s;
}

test('3v3 roster remains fixed while persistent and temporary entities have distinct lifecycles', () => {
  const e=engine(), owner=unit(e), enemy=unit(e,'enemy');
  unit(e);unit(e);unit(e,'enemy');unit(e,'enemy');
  lifecycleSummon(e,owner,'persistent');
  const wolf=owner.summons[0], id=wolf.id;
  assert.equal(e.getBattleCharacters(e.playerSquad).length,3);
  assert.equal(e.getActiveBattleEntities(e.playerSquad).length,4);
  lifecycleSummon(e,owner,'temporary',2);
  assert.equal(e.getBattleCharacters(e.playerSquad).length,3);
  assert.equal(e.getActiveBattleEntities(e.playerSquad).length,6);
  assert.equal(e.createRecordMembers(e.playerSquad,1).length,3);
  assert(owner.summons.every(s=>s.owner===owner && s.summoner===owner));
  wolf.x=enemy.x;wolf.y=enemy.y;
  assert.equal(e.findTarget(enemy,[wolf]),wolf);
  wolf.hp=0;e.syncAliveState(wolf);
  assert(owner.summons.includes(wolf));assert(e.playerSquad.includes(wolf));
  assert.equal(e.getActiveBattleEntities(e.playerSquad).length,5);
  assert.equal(e.findTarget(enemy,[wolf]),undefined);
  assert.equal(e.findHealTarget(owner,[wolf]),undefined);
  assert.equal(e.reviveBattleUnitWithSkill(owner,wolf,{},null),false);
  const revival=skill(e,{type:'revive_ally',target:'ally'});
  assert.equal(e.resolveSkillActionTarget(owner,revival.actions[0],wolf,revival),null);
  assert.equal(e.reactivatePersistentSummon(wolf,30),true);
  assert.equal(wolf.id,id);assert.equal(owner.summons[0],wolf);
  assert.equal(e.reactivatePersistentSummon(wolf,30),false);
  assert.equal(e.getActiveBattleEntities(e.playerSquad).length,6);
  const temporary=owner.summons[1];temporary.hp=0;e.syncAliveState(temporary);
  assert(!owner.summons.includes(temporary));assert(!e.playerSquad.includes(temporary));
  assert.equal(e.getActiveBattleEntities(e.playerSquad).length,5);
  assert.equal(e.reactivatePersistentSummon(temporary,30),false);
  assert.equal(e.normalizeRecordEvents(e.getBattleEvents()).find(x=>x.target?.id===e.snapshotEventUnit(wolf).id).target.ownerEventId,e.snapshotEventUnit(owner).id);
});

test('persistent repeated casts reuse stored slots including dead entities without imposing one pet per owner', () => {
  const e=engine(), owner=unit(e);
  const s=lifecycleSummon(e,owner,'persistent',2), first=owner.summons[0];
  first.hp=0;e.syncAliveState(first);
  for(let i=0;i<10;i++) e.applySkill(owner,owner,s);
  assert.equal(owner.summons.length,2);assert.equal(owner.summons[0],first);
  const alternate={...s,id:'alternate'};
  e.applySkill(owner,owner,alternate);assert.equal(owner.summons.length,2);
  lifecycleSummon(e,owner,'persistent');assert.equal(owner.summons.length,3);
  owner.hp=0;e.syncAliveState(owner);
  assert.equal(owner.summons.filter(s=>s.alive).length,2);
  assert.equal(e.canSquadContinueBattle(e.playerSquad),true);
});

test('temporary 100 deaths dispatch before removal and release all targeting references', () => {
  const e=engine(), owner=unit(e), enemy=unit(e,'enemy');
  const s=skill(e,{type:'summon_entity',summon:{lifetime:0}});
  let deaths=0;
  const off=e.subscribeBattleEvent('death',(event,refs)=>{
    if(!refs.target.isSummon)return;
    deaths++;assert(owner.summons.includes(refs.target));assert.equal(refs.target.owner,owner);
  });
  for(let i=0;i<100;i++) {
    e.applySkill(owner,owner,s);const summon=owner.summons[0];
    enemy.pendingAction={target:summon};enemy.channelAction={target:summon};
    enemy.weaponAttackStates=[{target:summon,castTimer:10}];
    e.projectiles.push({source:enemy,target:summon,preferredTarget:summon});
    e.markActionTargetCooldown(enemy,summon,{targetCooldown:1},null);
    summon.hp=0;const events=e.syncAliveState(summon,{deferEvents:true});
    assert(owner.summons.includes(summon));e.publishBattleEvents(events);
    assert.equal(owner.summons.length,0);assert.equal(e.playerSquad.length,1);
    assert.equal(enemy.pendingAction.target,null);assert.equal(enemy.channelAction.target,null);
    assert.equal(enemy.weaponAttackStates[0].target,null);
    assert.equal(e.projectiles[0].target,null);assert.equal(e.projectiles[0].preferredTarget,null);
    e.updateProjectiles();assert.equal(e.projectiles.length,0);
    assert.equal(summon.owner,null);assert.equal(summon.summoner,null);
  }
  off();assert.equal(deaths,100);
  assert.equal(vm.runInContext('pendingSummonDeaths.size',e),0);
});

test('expiry, dismiss, nested summoners and battle teardown preserve ownership without retaining runtime summons', () => {
  const e=engine(), owner=unit(e);owner.id=7;
  lifecycleSummon(e,owner,'persistent');const wolf=owner.summons[0];
  const temporary=skill(e,{type:'summon_entity',summon:{lifetime:0.1}});
  e.applySkill(wolf,wolf,temporary);
  const child=owner.summons[1];assert.equal(child.owner,owner);assert.equal(child.ownerId,7);
  for(let i=0;i<6;i++)e.updateSummonLifetimes();
  assert.equal(owner.summons.length,1);assert(!e.playerSquad.includes(child));
  e.applySkill(owner,owner,temporary);const dismissed=owner.summons[1];
  e.applySummonCommand(owner,dismissed,{summonCommand:'dismiss'});
  assert.equal(owner.summons.length,1);
  wolf.hp=0;e.syncAliveState(wolf);e.clearBattleSummons();
  assert.equal(owner.summons.length,0);assert.equal(e.playerSquad.length,1);
  assert.equal(wolf.owner,null);assert.equal(e.reactivatePersistentSummon(wolf,50),false);
});

test('ten minutes of repeated temporary expiry keep runtime collections bounded', () => {
  const e=engine(), owner=unit(e);
  const s=skill(e,{type:'summon_entity',summon:{count:2,limit:3,lifetime:0.5}});
  let created=0;
  for(let tick=0;tick<36000;tick++) {
    if(tick%60===0){e.applySkill(owner,owner,s);created+=2;}
    e.updateSummonLifetimes();
    assert.equal(e.getBattleCharacters(e.playerSquad).length,1);
    assert(e.playerSquad.length<=3);assert((owner.summons?.length ?? 0)<=2);
  }
  assert.equal(created,1200);assert.equal(owner.summons.length,0);
  assert.equal(e.playerSquad.length,1);assert.equal(e.projectiles.length,0);
  assert.equal(vm.runInContext('battleFields.length + pendingSummonDeaths.size + combatEventQueue.length',e),0);
});

test('field iteration cannot restore a removed temporary caster field', () => {
  const e=engine(), owner=unit(e), enemy=unit(e,'enemy');
  lifecycleSummon(e,owner,'temporary');const summon=owner.summons[0];
  const field={type:'create_field',target:'enemy',fieldRadius:100,fieldInterval:1/60,duration:10,
    fieldEffect:'deal_damage',coefficients:[{type:'fixed',value:1000}]};
  e.createBattleField(summon,enemy,{...field,fieldInterval:10},{id:'summon_field'});
  e.createBattleField(enemy,summon,field,{id:'enemy_field'});
  e.updateBattleFields();
  assert.equal(summon.removed,true);
  assert.equal(vm.runInContext('battleFields.length',e),1);
  assert.equal(vm.runInContext('battleFields.some(field=>field.source.removed)',e),false);
});

test('damage proxy splits actual damage between the protected unit and buff caster',()=>{
 const e=engine(),protector=unit(e),protectedUnit=unit(e),enemy=unit(e,'enemy',105);
 e.applySkill(protector,protectedUnit,skill(e,damageProxyAction(e,20)));
 const attack=skill(e,{type:'deal_damage',target:'enemy',coefficients:[{type:'fixed',value:100}]});e.applySkill(enemy,protectedUnit,attack);
 assert.equal(protector.hp,80);assert.equal(protectedUnit.hp,20);assert.equal(enemy.stats.damage,100);assert.equal(enemy.actualDamageTotal,100);
 assert.equal(protector.stats.taken,20);assert.equal(protectedUnit.stats.taken,80);assert.equal(e.getBattleEvents('damage_redirect')[0].amount,20);
});

test('damage proxy priority allocates the original damage until no remainder exists',()=>{
 const e=engine(),late=unit(e),protectedUnit=unit(e),early=unit(e),enemy=unit(e,'enemy',105);
 e.applySkill(late,protectedUnit,skill(e,damageProxyAction(e,60,20)));
 e.applySkill(early,protectedUnit,skill(e,damageProxyAction(e,60,10)));
 e.applySkill(enemy,protectedUnit,skill(e,{type:'deal_damage',target:'enemy',coefficients:[{type:'fixed',value:100}]}));
 assert.equal(early.hp,40);assert.equal(late.hp,60);assert.equal(protectedUnit.hp,100);
 assert.deepEqual(Array.from(e.getBattleEvents('damage_redirect'),event=>event.target.name),['player','player']);
});

test('damage proxy scope distinguishes basic and skill damage and never redirects recursively',()=>{
 const e=engine(),protector=unit(e),protectedUnit=unit(e),second=unit(e),enemy=unit(e,'enemy',105);
 e.applySkill(protector,protectedUnit,skill(e,damageProxyAction(e,50,100,'basic')));
 e.applySkill(second,protector,skill(e,damageProxyAction(e,100,1,'all')));
 const active=skill(e,{type:'deal_damage',target:'enemy',coefficients:[{type:'fixed',value:20}]});e.applySkill(enemy,protectedUnit,active);
 assert.equal(protectedUnit.hp,80);assert.equal(protector.hp,100);assert.equal(second.hp,100);
 const basic={...active,slot:'basic'};e.applySkill(enemy,protectedUnit,basic);
 assert.equal(protectedUnit.hp,70);assert.equal(protector.hp,90);assert.equal(second.hp,100);
});

test('damage reflect uses actual damage scopes and never reflects reflected damage', () => {
  const e=engine(),source=unit(e),target=unit(e,'enemy',105);
  const reflect=e.createDefaultAction('add_buff');reflect.target='self';Object.assign(reflect.effect,{id:'thorns',name:'가시',mode:'damage_reflect',reflectPercent:50,reflectScope:'skill',reflectDamageType:'fixed'});e.applySkill(target,target,skill(e,reflect));
  const sourceReflect=structuredClone(reflect);sourceReflect.effect.id='counter_thorns';sourceReflect.effect.reflectPercent=100;sourceReflect.effect.reflectScope='all';e.applySkill(source,source,skill(e,sourceReflect));
  const attack=e.createDefaultAction('deal_damage');attack.damageType='fixed';attack.coefficients=[{type:'fixed',value:20}];
  e.applyActionDamage(source,target,attack,{id:'active',slot:'active',name:'스킬 공격'});assert.equal(target.hp,80);assert.equal(source.hp,90);
  assert.equal(target.stats.damage,10);assert.equal(source.stats.damage,20);
  e.applyActionDamage(source,target,attack,{id:'skill_basic_weapon_attack',slot:'basic',name:'기본 공격'});assert.equal(target.hp,60);assert.equal(source.hp,90);
});

test('damage proxy recipients reflect only the damage each one actually receives', () => {
  const e=engine(),source=unit(e),target=unit(e,'enemy',105),protector=unit(e,'enemy',110);
  const reflect=e.createDefaultAction('add_buff');reflect.target='self';Object.assign(reflect.effect,{id:'reflect',mode:'damage_reflect',reflectPercent:100,reflectScope:'all',reflectDamageType:'fixed'});e.applySkill(target,target,skill(e,reflect));e.applySkill(protector,protector,skill(e,reflect));
  const proxy=e.createDefaultAction('add_buff');proxy.target='ally';Object.assign(proxy.effect,{id:'guard',mode:'damage_proxy',proxyPercent:50,proxyScope:'all'});e.applySkill(protector,target,skill(e,proxy));
  const attack=e.createDefaultAction('deal_damage');attack.damageType='fixed';attack.coefficients=[{type:'fixed',value:20}];e.applyActionDamage(source,target,attack,{id:'active',slot:'active'});
  assert.equal(target.hp,90);assert.equal(protector.hp,90);assert.equal(source.hp,80);assert.equal(target.stats.damage,10);assert.equal(protector.stats.damage,10);
});

test('transformation applies temporary flat modifiers and restores exact stats at expiry',()=>{
 const e=engine(),source=unit(e);const action=e.createDefaultAction('transform');action.duration=.1;
 Object.assign(action.transform,{id:'wolf_form',name:'wolf form',mode:'flat'});action.transform.modifiers.atk=15;action.transform.modifiers.attackSpeed=-5;
 e.applySkill(source,source,skill(e,action));assert.equal(source.atk,25);assert.equal(source.attackSpeed,.1);
 assert.equal(e.getBattleEvents('transform_start').length,1);
 for(let i=0;i<6;i++)e.updateBattleEffects();
 assert.equal(source.atk,10);assert.equal(source.attackSpeed,undefined);assert.equal(e.getBattleEvents('transform_end').length,1);
});

test('transformation percentage combines with buffs and a new form replaces the old form',()=>{
 const e=engine(),source=unit(e);
 const buff=e.createDefaultAction('add_buff');buff.target='self';buff.effect.id='atk_flat';buff.effect.stat='atk';buff.effect.value=5;e.applySkill(source,source,skill(e,buff));
 const first=e.createDefaultAction('transform');first.duration=0;first.transform.mode='percent';first.transform.modifiers.atk=100;e.applySkill(source,source,skill(e,first));assert.equal(source.atk,25);
 const second=e.createDefaultAction('transform');second.duration=0;second.transform.id='mage_form';second.transform.name='mage';second.transform.modifiers.atk=-2;second.transform.modifiers.magic=7;
 e.applySkill(source,source,skill(e,second));assert.equal(source.atk,13);assert.equal(source.magic,27);
 assert.equal(source.activeEffects.filter(effect=>effect.kind==='transform').length,1);assert.equal(e.getBattleEvents('transform_end').length,1);
 e.clearBattleEffects(source);assert.equal(source.atk,10);assert.equal(source.magic,20);
});

test('transformation replaces active and basic attack skills then restores the original set',()=>{
 const e=engine(),source=unit(e);
 const original=skill(e,{type:'heal',target:'self',coefficients:[{type:'fixed',value:1}]});original.id='original';original.slot='active';
 const form=skill(e,{type:'deal_damage',target:'enemy',coefficients:[{type:'fixed',value:2}]});form.id='form_active';form.slot='active';
 const attack=skill(e,{type:'deal_damage',target:'enemy',coefficients:[{type:'fixed',value:3}]});attack.id='form_attack';attack.slot='basic';
 e.skillsJson=[original,form,attack];source.skillIds=['original'];
 const action=e.createDefaultAction('transform');action.duration=2/60;action.transform.skillIds=['form_active'];action.transform.attackSkillId='form_attack';
 e.applyTransformation(source,source,e.normalizeSkillAction(action),{id:'shift'});
 assert.equal(e.getEquippedSkills(source)[0].id,'form_active');assert.equal(e.getUnitSkill(source).id,'form_attack');
 e.updateBattleEffects();e.updateBattleEffects();
 assert.equal(e.getEquippedSkills(source)[0].id,'original');assert.notEqual(e.getUnitSkill(source).id,'form_attack');
});

test('charged effects ignore periodic events by default and can opt in',()=>{
 for(const includePeriodic of [false,true]) {
  const e=engine(),source=unit(e),target=unit(e,'enemy',105);
  const buff=e.createDefaultAction('add_buff');buff.target='self';buff.effect.id='periodic_charge';buff.effect.uses=1;buff.effect.consumeOn='hit';buff.effect.consumePeriodic=includePeriodic;
  e.applySkill(source,source,skill(e,buff));
  const action={type:'deal_damage',target:'enemy',coefficients:[{type:'fixed',value:5}],damageType:'fixed',periodic:true};
  e.applyActionDamage(source,target,action,{id:'dot',name:'dot'});
  assert.equal(source.activeEffects.length,includePeriodic ? 0 : 1);
 }
});

test('actual skill resource spending is available by resource and total',()=>{
 const e=engine(),source=unit(e),target=unit(e,'enemy',105);source.mp=80;source.st=70;
 const action=e.createDefaultAction('deal_damage');action.target='enemy';action.coefficients=[
  {type:'calculated',field:'mpResourceSpent',calc:'percent',value:100},
  {type:'calculated',field:'stResourceSpent',calc:'percent',value:100},
  {type:'calculated',field:'resourceSpentTotal',calc:'percent',value:100}
 ];
 const s=e.normalizeSkillJson([{id:'resource_result',name:'resource result',castTime:0,resourceCosts:[{resource:'MP',mode:'currentPercent',value:50},{resource:'ST',mode:'fixed',value:10}],actions:[action]}]).find(x=>x.id==='resource_result');
 e.skillsJson=[s];source.skillIds=[s.id];assert.equal(e.tryUseReadySkill(source,[source],[target]),true);
 assert.equal(source.mp,40);assert.equal(source.st,60);assert.equal(target.hp,0);
});

test('resource result fields default to zero outside a paid skill execution',()=>{
 const e=engine(),source=unit(e),target=unit(e,'enemy',105);
 const action=e.createDefaultAction('deal_damage');action.coefficients=[{type:'calculated',field:'bpResourceSpent',calc:'percent',value:100}];
 e.applySkill(source,target,skill(e,action));assert.equal(target.hp,100);
 for(const field of ['resourceSpentTotal','hpResourceSpent','mpResourceSpent','stResourceSpent','bpResourceSpent'])assert.equal(e.normalizeCoefficient({type:'calculated',field,calc:'percent',value:100}).field,field);
});

test('channel pulses reuse the one initial resource payment without paying again',()=>{
 const e=engine(),source=unit(e),target=unit(e,'enemy',105);
 const action=e.createDefaultAction('deal_damage');action.coefficients=[{type:'calculated',field:'mpResourceSpent',calc:'percent',value:100}];
 const s=e.normalizeSkillJson([{id:'resource_channel',name:'resource channel',castTime:0,resourceCosts:[{resource:'MP',mode:'fixed',value:10}],channel:{duration:.2,interval:.1},actions:[action]}]).find(x=>x.id==='resource_channel');
 e.skillsJson=[s];source.skillIds=[s.id];e.tryUseReadySkill(source,[source],[target]);
 for(let i=0;i<12;i++)e.updateBattleChannel(source);
 assert.equal(source.mp,90);assert.equal(target.hp,80);
});

test('passive actions receive their own actual resource payment result',()=>{
 const e=engine(),source=unit(e),target=unit(e,'enemy',105);source.hp=50;
 const heal={type:'heal',target:'self',coefficients:[{type:'calculated',field:'mpResourceSpent',calc:'percent',value:100}]};
 e.equipPassive=equipPassive;e.equipPassive(e,source,'hit',heal,{resourceCosts:[{resource:'MP',mode:'fixed',value:7}]});
 const attack=skill(e,{type:'deal_damage',target:'enemy',coefficients:[{type:'fixed',value:10}]});
 e.applySkill(source,target,attack);
 assert.equal(source.mp,93);assert.equal(source.hp,57);
});

test('resource drain clamps to the target balance and passes actual success to the next action',()=>{
 const e=engine(),source=unit(e),target=unit(e,'enemy',105);source.hp=50;target.mp=15;
 const drain=e.createDefaultAction('drain_resource');drain.target='enemy';drain.drainResource='MP';drain.coefficients=[{type:'fixed',value:30}];
 const heal=e.createDefaultAction('heal');heal.target='self';heal.coefficients=[{type:'calculated',field:'previousResourceDrained',calc:'percent',value:100}];
 const s=e.normalizeSkillJson([{id:'drain_result',name:'drain result',actions:[drain,heal]}]).find(x=>x.id==='drain_result');
 e.applySkill(source,target,s);assert.equal(target.mp,0);assert.equal(source.hp,65);
});

test('area resource drain excludes empty targets before applying its target cap',()=>{
 const e=engine(),source=unit(e),empty=unit(e,'enemy',104),funded=unit(e,'enemy',106);empty.mp=0;funded.mp=20;
 const drain=e.createDefaultAction('drain_resource');drain.target='enemy';drain.drainResource='MP';drain.area=3;drain.maxTargets=1;drain.coefficients=[{type:'fixed',value:10}];
 e.applySkill(source,empty,skill(e,drain));assert.equal(funded.mp,10);assert.equal(empty.mp,0);
});

test('HP resource drain bypasses barrier and can cause death with a resource event',()=>{
 const e=engine(),source=unit(e),target=unit(e,'enemy',105);target.hp=20;target.bp=50;
 const drain=e.createDefaultAction('drain_resource');drain.target='enemy';drain.drainResource='HP';drain.coefficients=[{type:'fixed',value:50}];
 e.applySkill(source,target,skill(e,drain));
 assert.equal(target.hp,0);assert.equal(target.bp,50);assert.equal(target.alive,false);
 assert.equal(e.getBattleEvents().slice(-2).map(event=>event.type).join(','),'resource_drain,death');
});

test('resource drain projectiles resolve before result-dependent following actions',()=>{
 const e=engine(),source=unit(e),target=unit(e,'enemy',120);source.hp=50;target.st=12;
 const drain=e.createDefaultAction('drain_resource');drain.target='enemy';drain.drainResource='ST';drain.coefficients=[{type:'fixed',value:8}];
 const heal=e.createDefaultAction('heal');heal.target='self';heal.coefficients=[{type:'calculated',field:'executionResourceDrained',calc:'percent',value:100}];
 const s=e.normalizeSkillJson([{id:'drain_projectile',name:'drain projectile',actions:[drain,heal]}]).find(x=>x.id==='drain_projectile');
 e.dispatchSkillActions(source,target,s,true);assert.equal(source.hp,50);assert.equal(target.st,12);
 e.updateProjectiles();assert.equal(target.st,4);assert.equal(source.hp,58);
 for(const field of ['previousResourceDrained','executionResourceDrained'])assert.equal(e.normalizeCoefficient({type:'calculated',field,calc:'percent',value:100}).field,field);
});

function fieldAction(e,effect='deal_damage',duration=2,interval=.5) {
 const action=e.createDefaultAction('create_field');action.target='enemy';action.fieldEffect=effect;action.fieldRadius=3;action.duration=duration;action.fieldInterval=interval;action.coefficients=[{type:'fixed',value:10}];return action;
}

test('persistent damage field pulses at intervals including exact expiry and survives caster death',()=>{
 const e=engine(),source=unit(e),target=unit(e,'enemy',105);const s=skill(e,fieldAction(e));
 e.applySkill(source,target,s);assert.equal(target.hp,100);assert.equal(vm.runInContext('battleFields.length',e),1);
 source.alive=false;source.x=500;
 for(let i=0;i<120;i++)e.updateBattleFields();
 assert.equal(target.hp,60);assert.equal(vm.runInContext('battleFields.length',e),0);
 assert.equal(e.getBattleEvents('field_create').length,1);assert.equal(e.getBattleEvents('field_tick').length,4);assert.equal(e.getBattleEvents('field_expire').length,1);
});

test('field stays at its creation point and reselects units inside the radius each pulse',()=>{
 const e=engine(),source=unit(e),target=unit(e,'enemy',105),other=unit(e,'enemy',500);const s=skill(e,fieldAction(e,'deal_damage',1,.5));
 e.applySkill(source,target,s);target.x=500;other.x=105;
 for(let i=0;i<30;i++)e.updateBattleFields();assert.equal(target.hp,100);assert.equal(other.hp,90);
 other.x=500;target.x=105;for(let i=0;i<30;i++)e.updateBattleFields();assert.equal(target.hp,90);assert.equal(other.hp,90);
});

test('self-centered field snapshots the caster position instead of the selected target',()=>{
 const e=engine(),source=unit(e),selected=unit(e,'enemy',140),nearCaster=unit(e,'enemy',105);
 const action=fieldAction(e,'deal_damage',.5,.5);action.fieldCenter='self';action.fieldRadius=1;
 e.applySkill(source,selected,skill(e,action));source.x=500;
 for(let i=0;i<30;i++)e.updateBattleFields();
 assert.equal(selected.hp,100);assert.equal(nearCaster.hp,90);
});

test('healing field honors resource deficit and maximum targets',()=>{
 const e=engine(),source=unit(e),ally=unit(e,'player',105),other=unit(e,'player',106);ally.hp=50;other.hp=40;
 const action=fieldAction(e,'heal',.5,.5);action.target='ally';action.maxTargets=1;
 e.applySkill(source,ally,skill(e,action));for(let i=0;i<30;i++)e.updateBattleFields();
 assert.equal(ally.hp,50);assert.equal(other.hp,50);
});

test('resource drain field applies its selected resource and short fields may expire without a pulse',()=>{
 const e=engine(),source=unit(e),target=unit(e,'enemy',105);target.mp=25;
 const action=fieldAction(e,'drain_resource',1,.5);action.drainResource='MP';
 e.applySkill(source,target,skill(e,action));for(let i=0;i<60;i++)e.updateBattleFields();assert.equal(target.mp,5);
 target.mp=25;const short=fieldAction(e,'drain_resource',.1,.5);short.drainResource='MP';e.applySkill(source,target,skill(e,short));
 for(let i=0;i<6;i++)e.updateBattleFields();assert.equal(target.mp,25);
});

test('forced movement fields push and pull from their fixed center while respecting collisions',()=>{
 const e=engine(),source=unit(e),target=unit(e,'enemy',150);source.x=100;source.y=100;target.y=100;
 const push=fieldAction(e,'move',.5,.5);push.fieldCenter='self';push.fieldRadius=10;push.fieldMoveType='Push';push.fieldDistance=2;push.rangeMode='custom';push.rangeValue=20;
 e.applySkill(source,target,skill(e,push));source.x=400;
 for(let i=0;i<30;i++)e.updateBattleFields();assert.equal(target.x,170);
 source.x=100;target.x=170;const pull=fieldAction(e,'move',.5,.5);pull.fieldCenter='self';pull.fieldRadius=10;pull.fieldMoveType='Pull';pull.fieldDistance=2;pull.rangeMode='custom';pull.rangeValue=20;
 e.applySkill(source,target,skill(e,pull));target.activeEffects=[{kind:'state',state:'root'}];
 for(let i=0;i<30;i++)e.updateBattleFields();assert.equal(target.x,150);
 assert.equal(e.getBattleEvents('forced_move').length,2);
});

test('field movement settings normalize safely and reject unsupported movement modes',()=>{
 const e=engine();const action=fieldAction(e,'move');Object.assign(action,{fieldMoveType:'Pull',fieldDistance:99});
 const normalized=e.normalizeSkillAction(action);assert.equal(normalized.fieldMoveType,'Pull');assert.equal(normalized.fieldDistance,10);assert.equal(e.isSkillActionSupported(normalized),true);
 const invalid={...normalized,fieldMoveType:'Teleport'};assert.equal(e.isSkillActionSupported(invalid),false);
 assert.equal(JSON.stringify(e.normalizeSkillAction(normalized)),JSON.stringify(normalized));
});

test('fields apply independently timed buffs and states to current occupants',()=>{
 const e=engine(),source=unit(e),ally=unit(e,'player',105),enemy=unit(e,'enemy',105),farEnemy=unit(e,'enemy',500);
 const buff=fieldAction(e,'add_buff',.5,.5);buff.target='ally';buff.fieldEffectDuration=.25;
 buff.effect={...e.createDefaultSkillEffect('add_buff'),id:'field_power',name:'field power',stat:'atk',mode:'flat',value:7};
 const normalized=e.normalizeSkillAction(buff);assert.equal(normalized.fieldEffectDuration,.25);assert.equal(normalized.effect.id,'field_power');assert.equal(e.isSkillActionSupported(normalized),true);
 e.applySkill(source,ally,skill(e,normalized));source.x=500;
 for(let i=0;i<30;i++){e.updateBattleFields();e.updateBattleEffects();}
 assert.equal(ally.atk,17);assert.equal(source.atk,10);
 for(let i=0;i<15;i++)e.updateBattleEffects();assert.equal(ally.atk,10);
 source.x=100;const state=fieldAction(e,'add_state',.5,.5);state.fieldEffectDuration=1;state.maxTargets=1;
 state.effect={...e.createDefaultSkillEffect('add_state'),id:'field_root',name:'field root',state:'root'};
 e.applySkill(source,enemy,skill(e,state));farEnemy.x=106;
 for(let i=0;i<30;i++)e.updateBattleFields();
 assert.equal(e.hasBattleState(enemy,'root'),true);assert.equal(e.hasBattleState(farEnemy,'root'),false);
});

test('battle records preserve normalized event snapshots and cap legacy payloads',()=>{
 const e=engine(),source=unit(e),target=unit(e,'enemy',110);
 vm.runInContext('var battleStartedAt=null;var battleStartedAtText="";',e);
 e.publishBattleEvents([{type:'hit',source,target,skill:{id:'strike',name:'strike'},amount:12,hpDamage:12,reason:'test'}]);
 const record=e.createBattleRecord('player win');
 assert.equal(record.events.length,1);assert.equal(record.events[0].source.name,'player');assert.equal(record.events[0].amount,12);
 const raw={battleAt:'2026-01-01',result:'win',events:Array.from({length:1002},(_,index)=>({id:index,tick:index,type:index===1001?'heal':'hit',source:{name:'unit'},amount:'3'}))};
 const normalized=e.normalizeRecordJson([raw])[0];
 assert.equal(normalized.events.length,1000);assert.equal(normalized.events[0].id,2);assert.equal(normalized.events.at(-1).type,'heal');assert.equal(normalized.events.at(-1).amount,3);
 assert.match(e.renderRecordEvents(normalized.events.slice(-1)),/1건 보기/);
});

test('target maximum HP coefficients calculate healing from the selected target',()=>{
 const e=engine(),source=unit(e),target=unit(e);target.maxHp=120;target.hp=30;
 const action=e.createDefaultAction('heal');action.coefficients=[{type:'calculated',field:'targetMaxHp',calc:'percent',value:25}];
 assert.equal(e.applyActionHeal(source,target,action),30);assert.equal(target.hp,60);
});

test('channel damage scaling only applies while channeling and clears on finish',()=>{
 const e=engine(),source=unit(e),attacker=unit(e,'enemy',105);source.maxHp=source.hp=300;
 const s=skill(e,{type:'heal',target:'self',coefficients:[{type:'fixed',value:1}]});
 s.channel={duration:2,interval:1,interruptOnDamage:false,lockTarget:false,receivedDamagePercent:70};
 e.startBattleChannel(source,{type:'skill',target:source,skill:s},s);
 const damage={type:'deal_damage',damageType:'fixed',coefficients:[{type:'fixed',value:100}]};
 e.applyActionDamage(attacker,source,damage);assert.equal(source.hp,230);
 e.finishBattleChannel(source);e.applyActionDamage(attacker,source,damage);assert.equal(source.hp,130);
});

test('locked channels keep their first target instead of selecting another ally',()=>{
 const e=engine(),source=unit(e),first=unit(e,'player',105),other=unit(e,'player',106);
 first.hp=50;other.hp=10;const action=e.createDefaultAction('heal');action.target='ally';action.coefficients=[{type:'fixed',value:50}];
 const s=skill(e,action);s.channel={duration:2,interval:1,interruptOnDamage:false,lockTarget:true,receivedDamagePercent:100};
 const running={type:'skill',target:first,skill:s};e.startBattleChannel(source,running,s);
 for(let i=0;i<120;i++)e.updateBattleChannel(source);
 assert.equal(first.hp,100);assert.equal(other.hp,10);
});

test('medic and serum skill data use the approved channel and result-linked rules',()=>{
 const data=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','skills.json'),'utf8'));
 const find=id=>data.find(item=>item.id===id);
 const firstAid=find('skill_class_medic_first_aid'),drain=find('skill_class_serum_drain'),donation=find('skill_class_serum_transfusion');
 assert.deepEqual(firstAid.channel,{duration:3,interval:1,interruptOnDamage:false,lockTarget:true,receivedDamagePercent:100});
 assert.equal(firstAid.actions[0].coefficients[0].field,'targetMaxHp');assert.equal(firstAid.actions[0].target,'ally');
 assert.equal(drain.name,'혈청형 · 흡혈');assert.equal(drain.actions[1].coefficients[0].field,'previousActualDamage');assert.equal(drain.actions[1].coefficients[0].value,60);
 assert.equal(donation.name,'혈청형 · 헌혈');assert.equal(donation.channel.duration,3);assert.equal(donation.channel.lockTarget,true);
 assert.deepEqual(donation.channel.pulseResourceCosts,[{resource:'HP',mode:'maxPercent',value:5}]);
 assert.equal(donation.actions[0].coefficients[0].field,'hpResourceSpent');assert.equal(donation.actions[0].coefficients[0].value,50);
});

test('actions can exclude their caster from allied target selection',()=>{
 const e=engine(),source=unit(e),ally=unit(e);source.hp=20;ally.hp=100;
 const action=e.createDefaultAction('heal');action.target='ally';action.allowSelfTarget=false;action.coefficients=[{type:'fixed',value:20}];
 const normalized=e.normalizeSkillAction(action);assert.equal(normalized.allowSelfTarget,false);
 assert.equal(e.resolveSkillActionTarget(source,normalized,source),null);
 ally.hp=50;assert.equal(e.resolveSkillActionTarget(source,normalized,source),ally);
});

test('result-linked self actions cannot make an ally-only skill castable without an ally',()=>{
 const e=engine(),source=unit(e);source.hp=80;
 const heal=e.createDefaultAction('heal');heal.target='ally';heal.allowSelfTarget=false;heal.coefficients=[{type:'fixed',value:20}];
 const payment=e.createDefaultAction('drain_resource');payment.target='self';payment.drainResource='HP';
 payment.coefficients=[{type:'calculated',field:'previousActualHealing',calc:'percent',value:30}];
 const s=skill(e,heal);s.actions.push(e.normalizeSkillAction(payment));s.resourceCosts=[{resource:'MP',mode:'fixed',value:10}];
 e.skillsJson=[s];source.skillIds=[s.id];
 assert.equal(e.resolveSkillActionTarget(source,s.actions[1]),source);
 assert.equal(e.resolveSkillTarget(source,s,e.playerSquad,e.enemySquad),null);
 assert.equal(e.tryUseReadySkill(source,e.playerSquad,e.enemySquad),false);
 assert.equal(source.mp,100);assert.equal(source.hp,80);assert.equal(source.skillCooldowns[s.id],undefined);
 const ally=unit(e);ally.hp=50;
 assert.equal(e.resolveSkillTarget(source,s,e.playerSquad,e.enemySquad),ally);
 assert.equal(e.tryUseReadySkill(source,e.playerSquad,e.enemySquad),true);
 assert.equal(ally.hp,70);assert.equal(source.hp,74);assert.equal(source.mp,90);
});

test('periodic coefficients snapshot caster stats, grow by interval and reject reapplication',()=>{
 const e=engine(),source=unit(e),otherCaster=unit(e),target=unit(e,'enemy',105);target.maxHp=target.hp=1000;
 const action=e.createDefaultAction('add_state');action.target='enemy';action.duration=0;
 Object.assign(action.effect,{id:'growing_wound',name:'growing wound',state:'periodic',category:'physical',polarity:'harmful',stackMode:'reject',
   periodic:{type:'damage',interval:1,value:5,coefficient:{type:'calculated',field:'magic',calc:'percent',value:5},growthInterval:10,growthValue:1,damageType:'physical',resource:'HP'}});
 const s=e.normalizeSkillJson([{id:'growing_wound_skill',name:'growing wound',actions:[action]}]).find(item=>item.id==='growing_wound_skill');
 e.applySkill(source,target,s);source.magic=200;e.applySkill(otherCaster,target,s);assert.equal(target.activeEffects.length,1);
 for(let i=0;i<660;i++)e.updateBattleEffects();
 assert.ok(Math.abs(target.hp-988.6)<1e-9);assert.equal(target.activeEffects.length,1);
});

test('disease skill data and self exclusions match their class rules',()=>{
 const data=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','skills.json'),'utf8'));
 const find=id=>data.find(item=>item.id===id);
 assert.equal(find('skill_class_medic_first_aid').actions[0].allowSelfTarget,false);
 assert.equal(find('skill_class_serum_transfusion').actions[0].allowSelfTarget,false);
 const virus=find('skill_class_disease_virus'),wound=find('skill_class_disease_open_wound');
 assert.equal(virus.castTime,1.5);assert.equal(virus.actions[0].duration,10);assert.equal(virus.actions[0].effect.periodic.coefficient.value,40);
 assert.equal(wound.castTime,1.5);assert.equal(wound.actions[0].duration,0);assert.equal(wound.actions[0].effect.stackMode,'reject');
 assert.equal(wound.actions[0].effect.periodic.growthInterval,10);assert.equal(wound.actions[0].effect.periodic.growthValue,1);
 const characters=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','characters.json'),'utf8'));
 const weak=find('skill_class_disease_weakening_disease'),pain=find('skill_class_disease_pain_amplification');
 assert.deepEqual(virus.actions[0].effect.tags,['disease']);assert.deepEqual(wound.actions[0].effect.tags,['disease']);
 assert.deepEqual([weak.castTime,weak.cooldown,weak.actions[0].duration],[.5,8,5]);
 assert.deepEqual([weak.actions[0].effect.movementStCostPercent,weak.actions[0].effect.movementTriggerDistance,weak.actions[0].effect.movementTriggerState,weak.actions[0].effect.movementTriggerDuration],[200,10,'stun',2]);
 assert.deepEqual([pain.cooldown,pain.channel.duration,pain.channel.interval,pain.channel.lockTarget],[7,3,1,true]);
 assert.deepEqual(pain.actions[0].coefficients.map(coefficient=>[coefficient.field,coefficient.value,coefficient.effectTag ?? '']),[['magic',100,''],['targetEffectTagStacks',30,'disease']]);
 const e=engine();assert.equal(e.isSkillExecutable(e.normalizeSkillJson([weak])[0]),true);assert.equal(e.isSkillExecutable(e.normalizeSkillJson([pain])[0]),true);
 assert.deepEqual(characters.find(character=>character.skillIds?.includes(virus.id)).skillIds,[virus.id,wound.id,weak.id,pain.id]);
});

test('movement disease doubles movement ST cost and stuns once after ten metres',()=>{
 const e=engine(),source=unit(e),target=unit(e,'enemy',200);
 const action=e.createDefaultAction('add_buff');action.target='enemy';action.duration=5;
 Object.assign(action.effect,{id:'weakening_disease',name:'weakening disease',mode:'flat',stat:'atk',value:0,polarity:'harmful',tags:['disease'],movementStCostPercent:200,movementTriggerDistance:10,movementTriggerState:'stun',movementTriggerDuration:2});
 e.applyTimedEffectAction(source,target,action,skill(e,action));
 assert.equal(e.getMovementStCostPercent(target),200);assert.equal(e.hasBattleState(target,'stun'),false);
 target.moveDistanceTotal=9.9;e.processMovementEffectTriggers(target);assert.equal(e.hasBattleState(target,'stun'),false);
 target.moveDistanceTotal=10;e.processMovementEffectTriggers(target);assert.equal(e.hasBattleState(target,'stun'),true);
 const trigger=target.activeEffects.find(effect=>effect.id==='weakening_disease_movement_trigger');assert.equal(trigger.remainingTicks,120);
 const count=target.activeEffects.length;target.moveDistanceTotal=20;e.processMovementEffectTriggers(target);assert.equal(target.activeEffects.length,count);
});

test('pain amplification counts only harmful effects with the disease tag',()=>{
 const e=engine(),source=unit(e),target=unit(e,'enemy',105);source.magic=100;target.maxHp=target.hp=1000;target.resistance=0;
 target.activeEffects=[
  {id:'virus',polarity:'harmful',tags:['disease'],stacks:1},
  {id:'wound',polarity:'harmful',tags:['disease'],stacks:2},
  {id:'blessing',polarity:'beneficial',tags:['disease'],stacks:5},
  {id:'poison',polarity:'harmful',tags:['poison'],stacks:4}
 ];
 const action=e.createDefaultAction('deal_damage');action.damageType='magic';action.coefficients=[
  {type:'calculated',field:'magic',calc:'percent',value:100},
  {type:'calculated',field:'targetEffectTagStacks',effectTag:'disease',calc:'percent',value:30}
 ];
 assert.equal(e.getActionCoefficientValue(action,source,target),190);
});

test('damage-trigger and custom-resource coefficients preserve references and calculate from runtime values',()=>{
 const e=engine(),source=unit(e),attacker=unit(e,'enemy',105);
 source.customResources=e.createBattleCustomResources([{id:'effort_magic',name:'effort',initial:0,max:999}]);
 const enduranceAction=e.createDefaultAction('heal');enduranceAction.target='self';enduranceAction.healResource='custom:effort_magic';
 enduranceAction.coefficients=[{type:'calculated',field:'triggerActualDamage',calc:'percent',value:5}];
 equipPassive(e,source,'damaged',enduranceAction);
 const incoming=e.createDefaultAction('deal_damage');incoming.target='enemy';incoming.coefficients=[{type:'fixed',value:40}];
 e.applySkill(attacker,source,skill(e,incoming));
 assert.equal(source.hp,60);assert.equal(source.customResources.effort_magic.current,2);
 const strike=e.createDefaultAction('deal_damage');strike.target='enemy';strike.coefficients=[
   {type:'calculated',field:'atk',calc:'percent',value:100},
   {type:'calculated',field:'customResourceCurrent',resourceId:'effort_magic',calc:'percent',value:100}
 ];
 attacker.maxHp=attacker.hp=100;e.applySkill(source,attacker,skill(e,strike));
 assert.equal(attacker.hp,88);assert.equal(source.customResources.effort_magic.current,2);
 const normalized=e.normalizeCoefficient({type:'calculated',field:'customResourceCurrent',resourceId:' Effort Magic! ',calc:'percent',value:100});
 assert.equal(normalized.resourceId,'effortmagic');
});

test('guardian redesigned effort and passive data preserve IDs and replace obsolete effort resource',()=>{
 const e=guardianBaseEngine(),base=e.guardian('effort_strike'),passive=e.guardian('endurance');
 assert.equal(base.name,'수호자 · 노력');assert.equal(base.damageStorage.duration,5);assert.equal(base.damageStorage.receivedDamagePercent,90);
 assert.equal(base.resourceCosts[0].value,20);assert.equal(passive.directAttackerDefense.threshold,2);assert.equal(passive.directAttackerDefense.defense,5);assert.equal(passive.actions.length,0);
 const character=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/characters.json'),'utf8')).find(c=>c.name==='수호자');assert.equal(character.skillIds.length,6);assert.equal((character.customResources ?? []).some(r=>r.id==='effort_magic'),false);
 const all=e.skillsJson.filter(s=>s.className==='수호자');assert.equal(all.filter(s=>s.slot==='optional').length,6);assert(all.every(s=>e.isSkillExecutable(s)));
});

test('guardian endurance reduces damage by recent unique attackers and expires them after three seconds',()=>{
 const e=engine(),guardian=unit(e);guardian.maxHp=guardian.hp=1000;
 guardian.customResources=e.createBattleCustomResources([{id:'effort_magic',name:'노력[마법]',initial:0,max:999999}]);
 const enduranceAction=e.createDefaultAction('heal');enduranceAction.target='self';enduranceAction.healResource='custom:effort_magic';
 enduranceAction.coefficients=[{type:'calculated',field:'triggerActualDamage',calc:'percent',value:5}];
 equipPassive(e,guardian,'damaged',enduranceAction,{passiveTrigger:{event:'damaged',chance:100,includePeriodic:true,allowMultiplePerTick:true,recentAttackerMitigation:{enabled:true,window:3,threshold:2,initialReductionPercent:10,additionalReductionPercent:3,maxReductionPercent:25}}});
 const damage=e.createDefaultAction('deal_damage');damage.damageType='fixed';damage.coefficients=[{type:'fixed',value:100}];
 const attackers=Array.from({length:7},(_,index)=>unit(e,'enemy',150+index*10));
 const expectedDamage=[100,90,87,84,81,78,75];
 attackers.forEach((attacker,index)=>{
   const before=guardian.hp;e.applyActionDamage(attacker,guardian,damage);
   assert.equal(before-guardian.hp,expectedDamage[index]);
 });
 assert.equal(guardian.hp,405);assert.equal(guardian.customResources.effort_magic.current,29.75);
 vm.runInContext('combatEventTick+=181',e);
 e.applyActionDamage(attackers[0],guardian,damage);
 assert.equal(guardian.hp,305);assert.equal(guardian.customResources.effort_magic.current,34.75);
});

test('primary-anchored chains select only additional targets around the first target',()=>{
 const e=engine(),source=unit(e),primary=unit(e,'enemy',200),near=unit(e,'enemy',240),hopOnly=unit(e,'enemy',280),nearer=unit(e,'enemy',230);
 const action=e.createDefaultAction('deal_damage');Object.assign(action,{target:'enemy',rangeMode:'custom',rangeValue:20,chainCount:2,chainRange:5,chainOrigin:'primary',maxTargets:3});
 action.coefficients=[{type:'fixed',value:10}];const s=skill(e,action);e.applySkill(source,primary,s);
 assert.equal(primary.hp,90);assert.equal(near.hp,90);assert.equal(nearer.hp,90);assert.equal(hopOnly.hp,100);
 const legacy={...action,chainOrigin:'previous'};primary.hp=near.hp=nearer.hp=hopOnly.hp=100;e.applySkill(source,primary,skill(e,legacy));
 assert.equal(primary.hp,90);assert.equal(nearer.hp,90);
});

test('weapon range multiplier cast vulnerability and conditional sniper retreat execute at runtime',()=>{
 const e=engine(),sniper=unit(e),enemy=unit(e,'enemy',200);sniper.maxHp=sniper.hp=200;
 const shot=e.createDefaultAction('deal_damage');Object.assign(shot,{target:'enemy',rangeMode:'mainWeapon',rangeMultiplier:200});shot.coefficients=[{type:'fixed',value:10}];
 assert.equal(e.resolveSkillActionTarget(sniper,shot,enemy),enemy);
 sniper.pendingAction={skill:{castReceivedDamagePercent:130}};const hit=e.createDefaultAction('deal_damage');hit.coefficients=[{type:'fixed',value:10}];e.applyActionDamage(enemy,sniper,hit);assert.equal(sniper.hp,187);sniper.pendingAction=null;
 const mode=e.createDefaultAction('transform');mode.target='self';mode.duration=0;Object.assign(mode.transform,{id:'sniper_mode',name:'sniper mode',mode:'percent',receivedDamagePercent:130,immobile:true,exitHpBelow:30,retreatHpBelow:30});mode.transform.modifiers.atk=30;mode.transform.modifiers.attackRange=30;
 e.applySkill(sniper,sniper,skill(e,mode));assert.equal(sniper.atk,13);assert.equal(sniper.attackRange,6.5);
 const before=sniper.x;e.moveUnit(sniper,[enemy]);assert.equal(sniper.x,before);
 sniper.hp=60;e.updateBattleEffects();assert.equal(sniper.activeEffects.some(effect=>effect.kind==='transform'),false);assert.equal(sniper.retreatHpBelow,30);
 e.moveUnit(sniper,[enemy]);assert.ok(sniper.x<before);
});

test('archer and sniper skill data match their class rules',()=>{
 const e=engine(),skills=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','skills.json'),'utf8')));
 const characters=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','characters.json'),'utf8'));
 const find=id=>skills.find(item=>item.id===id),multi=find('skill_class_archer_multishot'),power=find('skill_class_archer_power_shot'),shot=find('skill_class_sniper_shot'),mode=find('skill_class_sniper_mode');
 assert.deepEqual([multi.castTime,multi.cooldown,multi.actions[0].chainCount,multi.actions[0].chainRange,multi.actions[0].chainOrigin,multi.actions[0].maxTargets],[0,5,2,5,'primary',3]);
 assert.equal(multi.actions[0].coefficients[0].value,125);assert.equal(power.actions[0].coefficients[0].value,200);
 assert.deepEqual([shot.castTime,shot.castReceivedDamagePercent,shot.actions[0].rangeMultiplier,shot.actions[0].coefficients[0].value],[1.5,100,100,200]);
 assert.deepEqual([mode.actions[0].transform.receivedDamagePercent,mode.actions[0].transform.immobile,mode.actions[0].transform.exitHpBelow,mode.actions[0].transform.retreatHpBelow],[100,false,0,0]);
 assert.deepEqual(characters.find(c=>c.name==='궁사').skillIds.filter(id=>find(id)?.slot!=='optional'),['skill_class_archer_critical','skill_class_archer_archery_ultimate','skill_class_archer_guard','skill_class_archer_push',multi.id,power.id]);assert.deepEqual(characters.find(c=>c.name==='저격수').skillIds.filter(id=>find(id)?.slot!=='optional'),['skill_class_sniper_solitude','skill_class_sniper_shadow',mode.id,'skill_class_sniper_falcon',shot.id]);
});

test('combo skills advance per unit, wrap after completion and reset for battle',()=>{
 const e=engine(),source=unit(e);
 const action=value=>{const item=e.createDefaultAction('deal_damage');item.coefficients=[{type:'fixed',value}];return item;};
 const combo=skill(e,action(10));combo.cooldown=10;combo.combo={stepCooldown:.5,stages:[{name:'one',actions:[action(10)]},{name:'two',actions:[action(20)]},{name:'three',actions:[action(30)]}],completionActions:[action(40)]};
 let runtime=e.getRuntimeComboSkill(source,combo);assert.deepEqual([runtime.runtimeCombo.stageIndex,runtime.actions[0].coefficients[0].value,runtime.actions.length],[0,10,1]);
 assert.equal(e.getResolvedSkillCooldownTicks(runtime,source),30);
 e.advanceSkillCombo(source,runtime);runtime=e.getRuntimeComboSkill(source,combo);assert.deepEqual([runtime.runtimeCombo.stageIndex,runtime.actions[0].coefficients[0].value,runtime.actions.length],[1,20,1]);
 e.advanceSkillCombo(source,runtime);runtime=e.getRuntimeComboSkill(source,combo);assert.deepEqual([runtime.runtimeCombo.stageIndex,runtime.actions[0].coefficients[0].value,runtime.actions.length],[2,30,2]);
 assert.equal(e.getResolvedSkillCooldownTicks(runtime,source),600);
 e.advanceSkillCombo(source,runtime);assert.equal(e.getRuntimeComboSkill(source,combo).runtimeCombo.stageIndex,0);
 source.skillComboStages[combo.id]=2;e.resetUnitForBattle(source);assert.equal(Object.keys(source.skillComboStages).length,0);
});

test('monk four strike and berserker fire strike data match their combo rules',()=>{
 const skills=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','skills.json'),'utf8'));
 const characters=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','characters.json'),'utf8'));
 const monk=skills.find(item=>item.id==='skill_class_monk_combo');
 const fire=skills.find(item=>item.id==='skill_class_berserker_fire_strike');
 const values=skill=>skill.combo.stages.map(stage=>stage.actions[0].coefficients[0].value);
 assert.deepEqual([monk.name,monk.castTime,monk.cooldown,monk.combo.stepCooldown,values(monk)],['승려 · 4연격',0,12,.5,[120,120,120,150]]);
 assert.deepEqual([fire.castTime,fire.cooldown,fire.combo.stepCooldown,values(fire)],[0,10,.5,[125,150,175]]);
 assert.deepEqual(fire.combo.stages.map(stage=>stage.actions.length),[2,2,2]);
 assert.deepEqual([fire.combo.completionActions[0].effect.stat,fire.combo.completionActions[0].effect.mode,fire.combo.completionActions[0].effect.value,fire.combo.completionActions[0].duration],['attackSpeed','attack_rate_percent',20,3]);
 assert.ok(characters.find(character=>character.name==='광전사').skillIds.includes(fire.id));
});

test('weapon cooldown fallback approaches independent weapon range for melee supports and fighters',()=>{
 for(const role of ['healer','tank']) {
  const e=engine(),source=unit(e),target=unit(e,'enemy',180);
  Object.assign(source,{role,attackRange:3,speed:2,weaponAttackStates:[{weapon:{attackRange:1}},{weapon:{attackRange:1}}]});
  const before=source.x;e.moveUnit(source,[target]);assert(source.x>before);
 }
});

test('saved monk and berserker resume weapon hits during full combo cooldowns',()=>{
 const {createEngine,loadData}=require('../balance/simulator/engine.cjs');
 const data=loadData(),names=['승려','광전사'],ids=names.map(name=>data.characters.findIndex(c=>c.name===name));
 const result=createEngine(data).runBattle({teamA:[ids[0]],teamB:[ids[1]],seed:42,maxSeconds:30,trace:true});
 for(const [index,id,count,seconds] of [[0,'skill_class_monk_combo',4,12],[1,'skill_class_berserker_fire_strike',3,10]]) {
  const casts=result.events.filter(e=>e.type==='cast_complete' && e.source.name===names[index] && e.skillId===id);
  assert(casts.length>=count,`${names[index]} completes combo`);
  const end=casts[count-1].tick;
  assert(result.events.some(e=>e.type==='hit' && e.source.name===names[index] && e.skillId==='skill_basic_weapon_attack' && e.tick>end && e.tick<end+seconds*60),`${names[index]} basic hit during full cooldown`);
 }
});

test('combo users approach the ready stage action range instead of stalling at unit range',()=>{
 const e=engine(),source=unit(e),target=unit(e,'enemy',180);
 source.x=100;source.attackRange=3;source.speed=2;target.x=180;
 const action=e.createDefaultAction('deal_damage');Object.assign(action,{target:'enemy',rangeMode:'custom',rangeValue:1});
 const combo=skill(e,action);combo.combo={stepCooldown:.5,stages:[{name:'one',actions:[action]},{name:'two',actions:[action]}],completionActions:[]};
 e.skillsJson=[combo];source.skillIds=[combo.id];source.skillCooldowns={};
 const before=source.x;e.moveUnit(source,[target]);assert.ok(source.x>before);
});

test('monk cycle and spring energy data match their class rules',()=>{
 const e=engine();
 const skills=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','skills.json'),'utf8')));
 const characters=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','characters.json'),'utf8'));
 const cycle=skills.find(item=>item.id==='skill_class_monk_cycle'),spring=skills.find(item=>item.id==='skill_class_monk_spring_energy');
 assert.deepEqual(JSON.parse(JSON.stringify(cycle.passiveTrigger)),{event:'hit',chance:100,includePeriodic:false,damageType:'physical',allowMultiplePerTick:true});
 assert.deepEqual([cycle.actions[0].target,cycle.actions[0].rangeValue,cycle.actions[0].maxTargets,cycle.actions[0].coefficients[0].field,cycle.actions[0].coefficients[0].value],['ally',5,1,'triggerActualDamage',30]);
 assert.deepEqual([spring.castTime,spring.cooldown,spring.actions[0].duration,spring.actions[0].effect.stat,spring.actions[0].effect.value,spring.actions[1].effect.stat,spring.actions[1].effect.value],[.5,12,8,'defense',10,'attackSpeed',20]);
 const monk=characters.find(character=>character.skillIds?.includes('skill_class_monk_combo'));
 assert.deepEqual(monk.skillIds.slice(0,4),[cycle.id,spring.id,'skill_class_monk_area_heal','skill_class_monk_combo']);
 const source=unit(e),ally=unit(e,'player',120);ally.defense=100;ally.attackSpeed=1;
 e.applySkill(source,ally,spring);assert.equal(ally.defense,110);assert.equal(ally.attackSpeed,1/1.2);assert.equal(ally.activeEffects.length,2);
 for(let tick=0;tick<480;tick++)e.updateBattleEffects();
 assert.equal(ally.defense,100);assert.equal(ally.attackSpeed,1);
});

test('priest resonance and blessing data match their class rules',()=>{
 const e=engine();
 const skills=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','skills.json'),'utf8')));
 const characters=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','characters.json'),'utf8'));
 const resonance=skills.find(item=>item.id==='skill_class_priest_resonance'),blessing=skills.find(item=>item.id==='skill_class_priest_blessing');
 assert.deepEqual(Array.from(resonance.passiveTrigger.events),['hit','heal']);
 assert.deepEqual([resonance.actions[0].requiredTargetEffectId,resonance.actions[0].requiredTargetEffectCaster,resonance.actions[0].coefficients[0].field,resonance.actions[0].coefficients[0].value],['priest_blessing','self','triggerActualAmount',5]);
 assert.deepEqual([blessing.castTime,blessing.cooldown,blessing.actions[0].duration,blessing.actions[0].rangeMode,blessing.actions[0].effect.stat,blessing.actions[0].effect.value],[.5,0,30,'mainWeapon','adaptiveOffense',5]);
 const priest=characters.find(character=>character.skillIds?.includes('skill_class_priest_smite'));
 assert.deepEqual(priest.skillIds.filter(id=>skills.find(s=>s.id===id)?.slot!=='optional'),[resonance.id,'skill_class_priest_revival_ultimate','skill_class_priest_barrier',blessing.id,'skill_class_priest_explosion','skill_class_priest_smite']);
});

test('teleport can place the caster behind the selected target without changing the default placement',()=>{
 const e=engine(),source=unit(e),target=unit(e,'enemy',200);
 const move=e.createDefaultAction('move');Object.assign(move,{target:'enemy',moveType:'Teleport',movePlacement:'behind',distance:10,rangeMode:'custom',rangeValue:10});
 const normalized=e.normalizeSkillAction(move);assert.equal(normalized.movePlacement,'behind');
 e.applySkill(source,target,skill(e,normalized));
 assert.equal(source.x,220);assert.equal(source.y,target.y);
 source.x=100;const ordinary={...normalized,movePlacement:'target'};e.applySkill(source,target,skill(e,ordinary));assert.equal(source.x,100);
});

test('assassin ambush and death sentence match their class rules',()=>{
 const e=engine();
 const skills=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','skills.json'),'utf8')));
 const characters=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','characters.json'),'utf8'));
 const ambush=skills.find(item=>item.id==='skill_class_assassin_ambush'),sentence=skills.find(item=>item.id==='skill_class_assassin_death_sentence');
 assert.deepEqual([ambush.castTime,ambush.cooldown,ambush.actions[0].moveType,ambush.actions[0].movePlacement,ambush.actions[1].coefficients[0].value],[.3,10,'Teleport','behind',200]);
 assert.deepEqual([sentence.castTime,sentence.cooldown,sentence.actions[0].coefficients[0].value,sentence.actions[1].effect.state,sentence.actions[1].duration,sentence.actions[2].ruleOverride.receivedDamagePercent,sentence.actions[2].duration],[0,10,150,'silence',3,120,3]);
 const assassin=characters.find(character=>character.name==='암살자');assert(assassin.skillIds.includes(ambush.id));assert(assassin.skillIds.includes(sentence.id));assert(assassin.skillIds.includes('skill_class_assassin_quick_finish'));
 const source=unit(e),target=unit(e,'enemy',105);source.atk=20;target.defense=0;target.hp=target.maxHp=200;
 e.applySkill(source,target,sentence);assert.equal(target.hp,170);assert.equal(e.hasBattleState(target,'silence'),true);assert.equal(e.getUnitIncomingRulePercent(target,'receivedDamagePercent'),120);
 for(let tick=0;tick<180;tick++){e.updateBattleEffects();e.updateRuntimeRuleOverrides();}
 assert.equal(e.hasBattleState(target,'silence'),false);assert.equal(e.getUnitIncomingRulePercent(target,'receivedDamagePercent'),100);
});

test('prebattle selection modifiers change only their configured skills',()=>{
 const e=engine();
 e.skillsJson=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','skills.json'),'utf8')));
 const mage=unit(e);mage.skillIds=['skill_class_mage_element_choice','skill_class_mage_arrow','skill_class_mage_area'];
 mage.skillSelections={skill_class_mage_element_choice:'wind'};
 let arrow=e.getEquippedSkills(mage).find(item=>item.id==='skill_class_mage_arrow');assert.ok(Math.abs(arrow.castTime-2.1)<1e-9);assert.equal(arrow.actions[0].coefficients[0].value,100);
 mage.skillSelections.skill_class_mage_element_choice='earth';
 arrow=e.getEquippedSkills(mage).find(item=>item.id==='skill_class_mage_arrow');assert.equal(arrow.castTime,3);assert.equal(arrow.resourceCosts[0].value,12);assert.equal(arrow.actions[0].coefficients[0].value,115);
 mage.skillSelections.skill_class_mage_element_choice='lightning';
 const area=e.getEquippedSkills(mage).find(item=>item.id==='skill_class_mage_area');assert.equal(area.actions[0].area,5);assert.equal(area.actions[0].coefficients[0].value,130);assert.equal(area.actions[0].splashPercent ?? 0,0);
});

test('lightning selection copies thirty percent to nearby secondary targets without rehitting the primary',()=>{
 const e=engine();
 e.skillsJson=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','skills.json'),'utf8')));
 const source=unit(e),primary=unit(e,'enemy',110),nearby=unit(e,'enemy',125),far=unit(e,'enemy',140);
 source.magic=100;source.skillIds=['skill_class_mage_element_choice','skill_class_mage_arrow'];source.skillSelections={skill_class_mage_element_choice:'lightning'};
 for(const target of [primary,nearby,far]) target.hp=target.maxHp=200;
 const arrow=e.getEquippedSkills(source).find(item=>item.id==='skill_class_mage_arrow');e.applySkill(source,primary,arrow);
 assert.equal(primary.hp,100);assert.equal(nearby.hp,170);assert.equal(far.hp,200);
});

test('mage element choice data uses lightning by default and is assigned before its affected skills',()=>{
 const e=engine(),skills=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','skills.json'),'utf8')));
 const characters=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','characters.json'),'utf8'));
 const choice=skills.find(item=>item.id==='skill_class_mage_element_choice'),mage=characters.find(item=>item.name==='마법사');
 assert.equal(choice.slot,'choice_prebattle');assert.equal(choice.choice.defaultOptionId,'lightning');assert.deepEqual(Array.from(e.getAvailableSkillChoice(choice,mage.skillIds.filter(id=>skills.find(s=>s.id===id)?.slot!=='optional')).options,option=>option.id),['lightning','wind','earth']);
 assert.deepEqual(mage.skillIds.filter(id=>skills.find(s=>s.id===id)?.slot!=='optional'),['skill_class_mage_element_choice','skill_class_mage_barrier','skill_class_mage_area','skill_class_mage_quick','skill_class_mage_arrow']);
});

test('scholar brain muscle continuously converts magic and resources without double counting',()=>{
 const e=engine();
 e.skillsJson=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','skills.json'),'utf8')));
 const scholar=unit(e);scholar.skillIds=['skill_class_scholar_brain_muscle'];e.resetUnitForBattle(scholar);
 assert.deepEqual([scholar.atk,scholar.magic,scholar.maxMp,scholar.mp,scholar.maxSt,scholar.st],[30,0,0,0,200,200]);
 e.resetUnitForBattle(scholar);assert.deepEqual([scholar.atk,scholar.magic,scholar.maxSt],[30,0,200]);
 const buff=e.createDefaultAction('add_buff');buff.target='self';buff.duration=1;Object.assign(buff.effect,{id:'scholar_magic_test',stat:'magic',mode:'flat',value:10});
 e.applySkill(scholar,scholar,skill(e,buff));assert.deepEqual([scholar.atk,scholar.magic],[40,0]);
});

test('scholar fake barrier raises current and maximum HP then clips excess HP on expiry',()=>{
 const e=engine();e.skillsJson=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','skills.json'),'utf8')));
 const scholar=unit(e);scholar.resistance=0;scholar.skillIds=['skill_class_scholar_brain_muscle','skill_class_scholar_fake_barrier'];e.resetUnitForBattle(scholar);
 const barrier=e.getSkillById('skill_class_scholar_fake_barrier');scholar.hp=80;e.applySkill(scholar,scholar,barrier);
 assert.deepEqual([scholar.maxHp,scholar.hp,scholar.resistance],[124,104,20]);
 scholar.hp=124;for(let tick=0;tick<300;tick++)e.updateBattleEffects();
 assert.deepEqual([scholar.maxHp,scholar.hp,scholar.resistance],[100,100,0]);
});

test('scholar skill data remains physical and assigned as passive plus four active skills',()=>{
 const e=engine(),skills=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','skills.json'),'utf8')));
 const characters=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','characters.json'),'utf8'));
 const ids=['skill_class_scholar_brain_muscle','skill_class_scholar_fake_arrow','skill_class_scholar_fake_barrier','skill_class_scholar_fake_explosion','skill_class_scholar_fake_smite'];
 assert.deepEqual(characters[24].skillIds,ids);assert.equal(skills.find(item=>item.id===ids[0]).slot,'passive');
 for(const id of ids.slice(1)) assert.ok(skills.find(item=>item.id===id).actions.some(action=>action.type !== 'deal_damage' || action.damageType === 'physical'));
});

test('executioner excitement triggers only on basic attacks and routes full HP recovery to BP',()=>{
 const e=engine();e.skillsJson=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','skills.json'),'utf8')));
 const source=unit(e),target=unit(e,'enemy',105);source.skillIds=['skill_class_executioner_excitement'];source.atk=20;target.defense=0;
 const basic=e.getSkillById('skill_basic_weapon_attack');e.applySkill(source,target,basic);
 assert.equal(source.hp,100);assert.equal(source.bp,3);
 source.hp=50;e.applySkill(source,target,basic);assert.equal(source.hp,53);assert.equal(source.bp,3);
 const active=e.getSkillById('skill_class_executioner_execute');source.hp=50;e.applySkill(source,target,active);
 assert.equal(source.hp,56);assert.equal(source.bp,3);
});

test('executioner skill data matches excitement execute and bind rules',()=>{
 const e=engine(),skills=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','skills.json'),'utf8')));
 const characters=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','characters.json'),'utf8'));
 const passive=skills.find(item=>item.id==='skill_class_executioner_excitement');
 const execute=skills.find(item=>item.id==='skill_class_executioner_execute');
 const bind=skills.find(item=>item.id==='skill_class_executioner_bind');
 assert.deepEqual([passive.passiveTrigger.basicAttackOnly,passive.actions[0].coefficients[0].value,passive.actions[0].fullResourceAlternative],[true,15,'BP']);
 assert.deepEqual([execute.castTime,execute.cooldown,execute.resourceCosts[0].value,execute.actions[0].coefficients[0].value,execute.actions[1].coefficients[0].value],[0,7,0,100,30]);
 assert.deepEqual([bind.castTime,bind.cooldown,bind.resourceCosts[0].value,bind.actions[0].rangeValue,bind.actions[0].duration,bind.actions[0].effect.state],[.5,10,0,5,4,'root']);
 const executioner=characters.find(character=>character.name==='집행가');assert.deepEqual(executioner.skillIds,[passive.id,execute.id,bind.id,'skill_class_executioner_blood_barrier','skill_class_executioner_smile','skill_class_executioner_execution_ultimate']);
});

test('executioner blood barrier spends five percent maximum HP lasts five seconds and uses weapon default range',()=>{
 const e=engine();e.skillsJson=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'../data/skills.json'),'utf8')));const s=unit(e);s.hp=s.maxHp=1000;
 const barrier=e.getSkillById('skill_class_executioner_blood_barrier');e.spendSkillResourceCosts(s,barrier);e.applySkill(s,s,barrier);
 assert.equal(s.hp,950);assert.equal(e.getUnitBarrierValue(s),150);assert.equal(barrier.actions[0].rangeMode,'mainWeapon');assert.equal(barrier.castTime,1);assert.equal(barrier.cooldown,15);
 for(let i=0;i<300;i++)e.updateBattleEffects();assert.equal(e.getUnitBarrierValue(s),0);
});

test('executioner optional axe bonus follows equipped category and crime city only reduces execute cooldown',()=>{
 const e=engine();e.skillsJson=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'../data/skills.json'),'utf8')));const s=unit(e);s.skillIds=['skill_class_executioner_executioners_axe','skill_class_executioner_crime_city'];
 for(const [category,expected] of [['oneHandAxe',35],['twoHandAxe',60],['oneHandSword',10]]){s.weaponAttacks=[{weaponCategory:category}];e.recalculateBattleBuffs(s);assert.equal(s.atk,expected);}
 assert.equal(e.getRuntimeSelectionSkill(s,e.getSkillById('skill_class_executioner_execute')).cooldown,5);assert.equal(e.getRuntimeSelectionSkill(s,e.getSkillById('skill_class_executioner_bind')).cooldown,10);
});

function executionerBuild(options=[]) {
 const e=engine();e.skillsJson=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'../data/skills.json'),'utf8')));e.exec=id=>e.getSkillById('skill_class_executioner_'+id);
 const s=e.owner=unit(e),t=e.target=unit(e,'enemy',105);s.atk=50;s.resistance=20;s.hp=s.maxHp=1000;t.hp=190;t.maxHp=1000;
 s.skillIds=['excitement','execute','bind','blood_barrier','smile','execution_ultimate',...options].map(id=>e.exec(id).id);e.runtime=id=>e.getRuntimeSelectionSkill(s,e.exec(id));
 e.cast=(id,target=t)=>{const skill=e.runtime(id),resourceSpent=e.spendSkillResourceCosts(s,skill);e.startCast(s,{type:'skill',skill,target,resourceSpent});for(let i=0;s.pendingAction && i<500;i++){vm.runInContext('combatEventTick++',e);e.updateCast(s);}return skill;};
 e.tick=(count=1)=>{for(let i=0;i<count;i++){vm.runInContext('combatEventTick++',e);e.updateBattleEffects();}};
 return e;
}

test('executioner smile heals current missing HP each second and resistance exists only during channel',()=>{
 const e=executionerBuild(['executioners_resistance']),s=e.owner;s.hp=500;e.cast('smile',s);assert.equal(s.st,85);assert.equal(s.resistance,30);
 for(let i=0;i<180;i++)e.updateBattleChannel(s);assert(Math.abs(s.hp-635.5)<1e-8);assert.equal(s.resistance,20);assert.equal(s.channelAction,null);assert.equal(s.skillCooldowns[e.exec('smile').id],900);
 s.hp=500;e.cast('smile',s);assert.equal(s.resistance,30);e.applyActionDamage(e.target,s,e.normalizeSkillAction({type:'deal_damage',damageType:'fixed',coefficients:[{type:'fixed',value:10}]}));assert.equal(s.channelAction,null);assert.equal(s.resistance,20);
});

test('executioner chewiness checks strict half HP before healing and affects only excitement',()=>{
 const e=executionerBuild(['chewiness']),s=e.owner,t=e.target;const basic=e.getSkillById('skill_basic_weapon_attack');t.hp=t.maxHp=10000;
 s.hp=499;e.applySkill(s,t,basic);assert.equal(s.hp,514);
 s.hp=500;e.applySkill(s,t,basic);assert.equal(s.hp,507.5);
 s.hp=1000;e.applySkill(s,t,basic);assert.equal(s.bp,7.5);
 s.hp=400;e.applySkill(s,t,e.runtime('execute'));assert.equal(s.hp,415);
});

test('executioner vulnerable prisoner follows same caster root through dispel refresh and expiry',()=>{
 const e=executionerBuild(['vulnerable_prisoner']),s=e.owner,t=e.target;e.cast('bind');assert(Math.abs(e.getUnitIncomingRulePercent(t,'receivedDamagePercent')-115)<1e-9);
 e.applyTimedEffectAction(s,t,e.normalizeSkillAction({type:'delete_state',effect:{id:'executioner_bind',dispelMode:'id'}}));assert.equal(e.getUnitIncomingRulePercent(t,'receivedDamagePercent'),100);
 e.cast('bind');e.tick(200);e.cast('bind');e.tick(239);assert(Math.abs(e.getUnitIncomingRulePercent(t,'receivedDamagePercent')-115)<1e-9);e.tick();assert.equal(e.getUnitIncomingRulePercent(t,'receivedDamagePercent'),100);
});

test('executioner ultimate unlocks at thirty seconds requires strict twenty percent and fixed bonus equals actual physical damage',()=>{
 const e=executionerBuild(),s=e.owner,t=e.target;vm.runInContext('combatEventTick=1799',e);assert.equal(e.canActivateSkill(s,e.runtime('execution_ultimate')),false);vm.runInContext('combatEventTick=1800',e);
 t.hp=200;assert.equal(e.resolveSkillTarget(s,e.runtime('execution_ultimate'),[s],[t]),null);t.hp=190;
 t.runtimeRuleOverrides=[{id:'mitigation',receivedDamagePercent:50}];s.atk=100;e.cast('execution_ultimate');assert.equal(t.alive,false);assert.equal(e.isKillChainOpen(s,e.exec('execution_ultimate')),true);
 const hits=vm.runInContext('combatEventHistory.filter(e=>e.type==="hit" && e.skillId==="skill_class_executioner_execution_ultimate")',e);assert.deepEqual(Array.from(hits,h=>[h.damageType,h.amount]),[['physical',150],['fixed',40]]);
});

test('executioner kill chain permits unrestricted HP kills repeatedly but expires after five seconds',()=>{
 const e=executionerBuild(),s=e.owner;e.cast('execution_ultimate');assert.equal(e.target.alive,false);assert.equal(e.isKillChainOpen(s,e.exec('execution_ultimate')),true);
 const second=unit(e,'enemy',105);second.hp=second.maxHp=150;e.cast('execution_ultimate',second);assert.equal(second.alive,false);assert.equal(s.skillUseCounts[e.exec('execution_ultimate').id],2);
 e.tick(300);assert.equal(e.canActivateSkill(s,e.runtime('execution_ultimate')),false);
 const ordinary={...e.exec('blood_barrier'),id:'ordinary_ultimate',slot:'ultimate',maxUses:99};s.skillUseCounts[ordinary.id]=1;assert.equal(e.canActivateSkill(s,ordinary),false);
});

test('executioner chain permission is consumed by a nonlethal reuse and an admitted cast may finish after deadline',()=>{
 const e=executionerBuild(),s=e.owner;e.cast('execution_ultimate');const second=unit(e,'enemy',105);second.hp=second.maxHp=1000;
 e.tick(299);assert.equal(e.canActivateSkill(s,e.runtime('execution_ultimate')),true);e.cast('execution_ultimate',second);assert.equal(second.hp,805);assert.equal(e.canActivateSkill(s,e.runtime('execution_ultimate')),false);
});

test('executioner physical lethal hit never spills its fixed bonus into another target',()=>{
 const e=executionerBuild(),s=e.owner,other=unit(e,'enemy',105);s.atk=100;other.hp=190;other.maxHp=1000;e.cast('execution_ultimate');assert.equal(other.hp,190);assert.equal(e.isKillChainOpen(s,e.exec('execution_ultimate')),true);
});

test('executioner reprieve accepts allied or other death only within five seconds after real ultimate damage',()=>{
 for(const [options,delay,allowed] of [[[],1,false],[['reprieve'],299,true],[['reprieve'],300,false]]) {
  const e=executionerBuild(options),s=e.owner,t=e.target;s.atk=10;e.cast('execution_ultimate');assert.equal(t.hp,151);assert.equal(e.isKillChainOpen(s,e.exec('execution_ultimate')),false);
  e.tick(delay);const ally=unit(e,'player',110);e.applyActionDamage(ally,t,e.normalizeSkillAction({type:'deal_damage',damageType:'fixed',coefficients:[{type:'fixed',value:200}]}),{id:'ally_hit',slot:'basic'});
  assert.equal(e.isKillChainOpen(s,e.exec('execution_ultimate')),allowed);
 }
});

test('executioner selections remain limited to three and death or battle reset clears chain eligibility',()=>{
 const e=executionerBuild(['executioners_axe','crime_city','chewiness','reprieve']),s=e.owner;s.atk=10;e.cast('execution_ultimate');e.applyActionDamage(unit(e,'player'),e.target,e.normalizeSkillAction({type:'deal_damage',damageType:'fixed',coefficients:[{type:'fixed',value:500}]}));assert.equal(e.isKillChainOpen(s,e.exec('execution_ultimate')),false);
 const f=executionerBuild();f.cast('execution_ultimate');f.owner.hp=0;f.syncAliveState(f.owner);assert.equal(f.owner.killChainWindows.size,0);assert.equal(f.owner.killChainMarks.size,0);f.resetUnitForBattle(f.owner);assert.equal(f.owner.killChainWindows.size,0);assert.equal(f.owner.skillUseCounts[f.exec('execution_ultimate').id],undefined);
});

test('fairy hunter blood and poison multiplies damage only when both dot tags are present',()=>{
 const e=engine();e.skillsJson=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','skills.json'),'utf8')));
 const hunter=unit(e),target=unit(e,'enemy');hunter.skillIds=['skill_class_fairy_hunter_blood_and_poison'];hunter.atk=100;target.hp=target.maxHp=1000;target.defense=0;
 const hit=e.createDefaultAction('deal_damage');hit.coefficients=[{type:'fixed',value:100}];hit.damageType='fixed';
 e.applyActionDamage(hunter,target,hit,{id:'test_hit',name:'test'});assert.equal(target.hp,900);
 target.activeEffects=[{polarity:'harmful',tags:['bleed'],stacks:1}];e.applyActionDamage(hunter,target,hit,{id:'test_hit',name:'test'});assert.equal(target.hp,800);
 target.activeEffects.push({polarity:'harmful',tags:['poison'],stacks:1});e.applyActionDamage(hunter,target,hit,{id:'test_hit',name:'test'});assert.equal(target.hp,670);
});

test('fairy hunter butterfly poison stacks hp mp and st periodic drains',()=>{
 const e=engine();e.skillsJson=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','skills.json'),'utf8')));
 const hunter=unit(e),target=unit(e,'enemy');hunter.skillIds=['skill_class_fairy_hunter_butterfly_poison'];target.hp=target.maxHp=1000;target.mp=target.maxMp=100;target.st=target.maxSt=100;
 e.playerSquad=[hunter];e.enemySquad=[target];const poison=e.getSkillById('skill_class_fairy_hunter_butterfly_poison');
 e.applySkill(hunter,target,poison);e.applySkill(hunter,target,poison);e.applySkill(hunter,target,poison);
 assert.equal(target.activeEffects.find(effect=>effect.id==='fairy_hunter_butterfly_poison').stacks,3);
 for(let tick=0;tick<180;tick++) e.updateBattleEffects();
 assert.deepEqual([target.hp,target.mp,target.st],[970,97,97]);
});

test('fairy hunter skill data keeps bleed poison and character assignment',()=>{
 const e=engine();const skills=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','skills.json'),'utf8')));const characters=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','characters.json'),'utf8'));
 const passive=skills.find(skill=>skill.id==='skill_class_fairy_hunter_blood_and_poison');const wound=skills.find(skill=>skill.id==='skill_class_fairy_hunter_sharp_arrow');const poison=skills.find(skill=>skill.id==='skill_class_fairy_hunter_butterfly_poison');
 assert.deepEqual(Array.from(passive.passiveTrigger.requiredTargetEffectTags),['bleed','poison']);assert.equal(passive.passiveTrigger.damageMultiplierPercent,130);
 assert.deepEqual([Array.from(wound.actions[0].effect.tags),wound.actions[0].effect.maxStacks,wound.actions[0].effect.periodic.interval],[['bleed'],1,1]);
 assert.deepEqual([Array.from(poison.actions[0].effect.tags),poison.actions[0].effect.maxStacks,Array.from(poison.actions[0].effect.periodic.resourceDrains,drain=>({resource:drain.resource,value:drain.value}))],[['poison'],3,[{resource:'MP',value:1},{resource:'ST',value:1}]]);
 assert.deepEqual(characters.find(character=>character.name==='요정 사냥꾼').skillIds,[passive.id,wound.id,poison.id]);
});

test('line battle fields use corridor geometry and apply side-specific auras on entry and exit',()=>{
 const e=engine(),source=unit(e),ally=unit(e),target=unit(e,'enemy',200),outside=unit(e,'enemy',200);
 source.x=100;source.y=100;ally.x=150;ally.y=105;target.y=100;outside.y=130;
 const action=e.createDefaultAction('create_field');Object.assign(action,{target:'enemy',rangeMode:'custom',rangeValue:20,fieldShape:'line',fieldWidth:2,fieldRadius:0,fieldEffect:'none',duration:5,fieldInterval:1,fieldAuras:[
  {target:'ally',stat:'castSpeed',mode:'percent',value:-20},{target:'enemy',stat:'speed',mode:'percent',value:-20}
 ]});
 const s=skill(e,action);e.applySkill(source,target,s);e.updateBattleFields();
 assert.equal(e.isUnitInsideBattleField(ally,vm.runInContext('battleFields[0]',e)),true);
 assert.equal(e.isUnitInsideBattleField(outside,vm.runInContext('battleFields[0]',e)),false);
 assert.equal(ally.castSpeed,.8);assert.equal(target.speed,.8);assert.equal(outside.speed,undefined);
 ally.y=130;target.y=130;e.updateBattleFields();assert.equal(ally.castSpeed,1);assert.equal(target.speed,undefined);
});

test('vortex field movement ST surcharge falls off by distance and ignores allies',()=>{
 const e=engine(),source=unit(e),target=unit(e,'enemy',100),edge=unit(e,'enemy',150),ally=unit(e);
 source.x=0;target.x=100;edge.y=100;ally.x=100;
 const action=e.createDefaultAction('create_field');Object.assign(action,{target:'enemy',fieldRadius:6,fieldEffect:'none',fieldMovementStCostCenter:6,fieldMovementStCostFalloff:1,fieldMovementStCostMinimum:1});
 const s=skill(e,action);e.createBattleField(source,target,s.actions[0],s);
 assert.equal(e.getBattleFieldMovementStCostFlat(target),6);assert.equal(e.getBattleFieldMovementStCostFlat(edge),1);assert.equal(e.getBattleFieldMovementStCostFlat(ally),0);
});

test('admiral skills keep approved damage fields auras and character assignment',()=>{
 const e=engine(),skills=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','skills.json'),'utf8')));
 const characters=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','characters.json'),'utf8'));
 const wave=skills.find(skill=>skill.id==='skill_class_admiral_tidal_wave');
 const vortex=skills.find(skill=>skill.id==='skill_class_admiral_vortex');
 const road=skills.find(skill=>skill.id==='skill_class_admiral_sea_road');
 assert.deepEqual([wave.castTime,wave.cooldown,wave.actions[0].coefficients[0].value,wave.actions[1].moveType,wave.actions[1].distance],[2,5,180,'Knockback',5]);
 assert.deepEqual([vortex.castTime,vortex.cooldown,vortex.actions[0].fieldRadius,vortex.actions[0].duration,vortex.actions[0].fieldMovementStCostCenter],[3,20,4,10,6]);
 assert.deepEqual([road.castTime,road.cooldown,road.actions[0].fieldShape,road.actions[0].fieldWidth,road.actions[0].duration,road.actions[0].fieldEffect],[1.5,12,'line',2,5,'none']);
 assert.deepEqual(Array.from(road.actions[0].fieldAuras,aura=>[aura.target,aura.stat,aura.value]),[['ally','castSpeed',-20],['enemy','speed',-20],['enemy','attackSpeed',-15],['enemy','castSpeed',15]]);
 assert.deepEqual(characters.find(character=>character.name==='제독').skillIds,['skill_class_admiral_reload',wave.id,vortex.id,road.id,'skill_class_admiral_wave','skill_class_admiral_despair_ultimate']);
});

test('admiral sea road executes through AI cast resource cooldown and field aura runtime',()=>{
 const e=engine();e.skillsJson=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','skills.json'),'utf8')));
 const source=unit(e),enemy=unit(e,'enemy',140);source.x=100;source.skillIds=['skill_class_admiral_sea_road'];
 assert.equal(e.tryUseReadySkill(source,e.playerSquad,e.enemySquad),true);
 assert.equal(source.mp,95);assert.equal(source.pendingAction.skill.id,'skill_class_admiral_sea_road');assert.equal(source.castTimer,90);
 for(let tick=0;tick<90;tick++)e.updateCast(source);
 assert.equal(vm.runInContext('battleFields.length',e),1);assert.equal(source.skillCooldowns.skill_class_admiral_sea_road,720);
 e.updateBattleFields();assert.deepEqual([source.effectCastTimeMultiplier,enemy.speed,enemy.attackSpeed,enemy.effectCastTimeMultiplier],[.8,.8,1/.85,1.15]);
});

test('engineer artillery summons enforce independent limits and recoilless cannon splash',()=>{
 const e=engine(),allSkills=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','skills.json'),'utf8'));
 const ids=['skill_class_engineer_ballista','skill_class_engineer_talisman_cannon','skill_class_engineer_recoilless_cannon','skill_entity_engineer_recoilless_attack'];
 e.skillsJson=e.normalizeSkillJson(allSkills.filter(skill=>ids.includes(skill.id)));
 e.newEntities=['engineer_ballista','engineer_talisman_cannon','engineer_recoilless_cannon'].map(id=>JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','entities',`${id}.json`),'utf8')));
 vm.runInContext('entitiesJson.push(...newEntities)',e);
 const engineer=unit(e),target=unit(e,'enemy',200),near=unit(e,'enemy',200),far=unit(e,'enemy',200);
 const find=id=>e.skillsJson.find(skill=>skill.id===id);
 for(let i=0;i<3;i++)e.dispatchSkillActions(engineer,engineer,find('skill_class_engineer_ballista'),false);
 for(let i=0;i<2;i++)e.dispatchSkillActions(engineer,engineer,find('skill_class_engineer_talisman_cannon'),false);
 for(let i=0;i<2;i++)e.dispatchSkillActions(engineer,engineer,find('skill_class_engineer_recoilless_cannon'),false);
 assert.deepEqual(Array.from(engineer.summons.filter(summon=>summon.alive).reduce((counts,summon)=>counts.set(summon.entityId,(counts.get(summon.entityId)||0)+1),new Map())),[['engineer_ballista',2],['engineer_talisman_cannon',1],['engineer_recoilless_cannon',1]]);
 const cannon=engineer.summons.find(summon=>summon.entityId==='engineer_recoilless_cannon');
 target.x=cannon.x+50;target.y=cannon.y;near.x=target.x+10;near.y=target.y;far.x=target.x+150;far.y=target.y;
 target.hp=near.hp=far.hp=500;target.maxHp=near.maxHp=far.maxHp=500;
 e.applySkill(cannon,target,e.getUnitSkill(cannon));assert.deepEqual([target.hp,near.hp,far.hp],[300,300,500]);
});

test('engineer artillery data matches class cast cooldown entity stats and assignment',()=>{
 const skills=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','skills.json'),'utf8'));
 const characters=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','characters.json'),'utf8'));
 const find=id=>skills.find(skill=>skill.id===id);
 const ballista=find('skill_class_engineer_ballista'),talisman=find('skill_class_engineer_talisman_cannon'),recoilless=find('skill_class_engineer_recoilless_cannon'),attack=find('skill_entity_engineer_recoilless_attack');
 assert.deepEqual([ballista.castTime,ballista.cooldown,ballista.actions[0].limit,ballista.actions[0].duration],[2,10,2,0]);
 assert.deepEqual([talisman.castTime,talisman.cooldown,talisman.actions[0].limit],[3,30,1]);
 assert.deepEqual([recoilless.castTime,recoilless.cooldown,recoilless.actions[0].limit],[3,30,1]);
 const entities=['engineer_ballista','engineer_talisman_cannon','engineer_recoilless_cannon'].map(id=>JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','entities',`${id}.json`),'utf8')));
 assert.deepEqual(entities.map(entity=>[entity.stats.atk,entity.stats.attackSpeed,entity.stats.attackRange]),[[100,3,3],[50,1,5],[200,5,10]]);
 assert.deepEqual([attack.slot,attack.actions[0].damageType,attack.actions[0].area,attack.actions[0].areaCenter],['basic','physical',2,'target']);
 assert.deepEqual(characters.find(character=>character.name==='갑사').skillIds.filter(id=>find(id)?.slot!=='optional'),['skill_class_engineer_engineering',ballista.id,talisman.id,recoilless.id,'skill_class_engineer_haetae','skill_class_engineer_emergency_reinstall_ultimate']);
});

test('tag dispel removes only matching harmful dispellable effects and publishes one event per effect',()=>{
 const e=engine(),source=unit(e),target=unit(e);const received=[];
 target.activeEffects=[
  {id:'poison',name:'poison',kind:'state',polarity:'harmful',tags:['poison'],dispellable:true},
  {id:'bleed',name:'bleed',kind:'state',polarity:'harmful',tags:['bleed'],dispellable:true},
  {id:'blessing',name:'blessing',kind:'state',polarity:'beneficial',tags:['poison'],dispellable:true},
  {id:'locked',name:'locked',kind:'state',polarity:'harmful',tags:['disease'],dispellable:false},
  {id:'curse-buff',name:'curse-buff',kind:'buff',polarity:'harmful',tags:['curse'],dispellable:true}
 ];
 e.subscribeBattleEvent('dispel',event=>received.push(event));
 const action=e.normalizeSkillAction({type:'delete_state',target:'ally',effect:{dispelMode:'tags',dispelTags:['poison','bleed','pain','disease'],dispelPolarity:'harmful'}});
 assert.equal(e.applyTimedEffectAction(source,target,action,{id:'cleanse',name:'cleanse'}),2);
 assert.deepEqual(Array.from(target.activeEffects,effect=>effect.id),['blessing','locked','curse-buff']);
 assert.deepEqual(received.map(event=>[event.type,event.amount,event.target.name]),[['dispel',1,target.name],['dispel',1,target.name]]);
});

test('druid cleanse skills remove typed debuffs and natural cleanse heals for every removal',()=>{
 const e=engine();e.skillsJson=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','skills.json'),'utf8')));
 const druid=unit(e),ally=unit(e);druid.name='드루이드';druid.magic=100;druid.skillIds=['skill_class_druid_natural_cleanse','skill_class_druid_wound_heal','skill_class_druid_curse_break'];
 ally.hp=100;ally.maxHp=1000;e.playerSquad=[druid,ally];e.enemySquad=[];
 ally.activeEffects=[
  {id:'poison',name:'중독',kind:'state',polarity:'harmful',category:'physical',tags:['poison'],dispellable:true},
  {id:'pain',name:'통증',kind:'buff',polarity:'harmful',category:'physical',tags:['pain'],dispellable:true},
  {id:'hex',name:'저주',kind:'state',polarity:'harmful',category:'magic',tags:['curse'],dispellable:true}
 ];
 e.applySkill(druid,ally,e.getSkillById('skill_class_druid_wound_heal'));
 assert.deepEqual(Array.from(ally.activeEffects,effect=>effect.id),['hex']);assert.equal(ally.hp,160);
 e.applySkill(druid,ally,e.getSkillById('skill_class_druid_curse_break'));
 assert.equal(ally.activeEffects.length,0);assert.equal(ally.hp,190);
 assert.equal(e.getBattleEvents('dispel').length,3);
});

test('druid skill data keeps cleanse contracts and character assignment',()=>{
 const e=engine(),skills=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','skills.json'),'utf8')));
 const characters=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','characters.json'),'utf8'));
 const natural=skills.find(skill=>skill.id==='skill_class_druid_natural_cleanse');
 const wound=skills.find(skill=>skill.id==='skill_class_druid_wound_heal');
 const curse=skills.find(skill=>skill.id==='skill_class_druid_curse_break');
 assert.deepEqual(JSON.parse(JSON.stringify(natural.passiveTrigger)),{event:'dispel',chance:100,includePeriodic:false,allowMultiplePerTick:true});
 assert.equal(natural.actions[0].coefficients[0].value,30);
 assert.deepEqual(Array.from(wound.actions[0].effect.dispelTags),['poison','bleed','pain','disease']);
 assert.deepEqual(Array.from(curse.actions,action=>[action.type,action.effect.dispelMode,action.effect.dispelCategory,Array.from(action.effect.dispelTags)]),[
  ['delete_state','category','magic',[]],['delete_buff','category','magic',[]],['delete_state','tags','general',['curse']],['delete_buff','tags','general',['curse']]
 ]);
 assert.deepEqual(characters.find(character=>character.name==='드루이드').skillIds,[natural.id,wound.id,curse.id]);
});


function marineEngine(options=[]) {
 const e=engine();e.skillsJson=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','skills.json'),'utf8')));
 const s=e.owner=unit(e),t=e.target=unit(e,'enemy',145);s.atk=100;s.defense=50;s.shieldDefense=20;s.attackRange=6;s.hp=s.maxHp=2000;t.hp=t.maxHp=10000;
 e.marine=id=>e.getSkillById('skill_class_marine_'+id);s.skillIds=['cannon_passive','barrage','expansion','guard','bash','boomerang',...options].map(id=>e.marine(id).id);e.runtime=id=>e.getRuntimeSelectionSkill(s,e.marine(id));return e;
}
test('marine replaces basic attacks with a free fixed interval cannon and only selected reload changes it',()=>{
 const e=marineEngine(['reload']),s=e.owner,t=e.target,c=e.getBasicAttackReplacement(s);assert.equal(c.fixedAttackInterval,2.5);assert.equal(c.castTime,1);assert.equal(c.actions[0].area,3);assert.equal(e.getUnitSkill(s).id,c.id);
 const ui=fs.readFileSync(path.join(__dirname,'..','js/ui.js'),'utf8');for(const name of ['getUnitRange','getAttackCooldown']){const start=ui.indexOf('function '+name+'(');vm.runInContext(ui.slice(start,ui.indexOf('\n}',start)+2),e);}assert.equal(e.getAttackCooldown(s),150);assert.equal(e.getUnitRange(s),50);assert.equal(e.getActionRangePixels(s,e.runtime('bash').actions[0]),60);
 const st=s.st,mp=s.mp;s.skillIds=[e.marine('cannon_passive').id,e.marine('reload').id];e.takeAction(s,[s],[t]);assert.equal(s.st,st);assert.equal(s.mp,mp);assert.equal(s.castTimer,60);
 s.skillIds=[e.marine('cannon_passive').id];assert.equal(e.getBasicAttackReplacement(s).fixedAttackInterval,3);s.skillIds=[];assert.equal(e.getBasicAttackReplacement(s),null);
});
test('marine expansion raises shield-only defense bash damage and future guard uses until expiry',()=>{
 const e=marineEngine(),s=e.owner,t=e.target;assert.equal(e.getActionCoefficientValue(e.runtime('bash').actions[0],s,t),170);
 e.applySkill(s,s,e.runtime('expansion'));assert.equal(s.defense,55);assert.equal(s.shieldDefense,25);assert.equal(e.getActionCoefficientValue(e.runtime('bash').actions[0],s,t),210);assert.equal(e.runtime('guard').actions[0].effect.uses,3);
 e.applySkill(s,s,e.runtime('guard'));assert.equal(s.activeEffects.find(x=>x.id==='marine_guard').usesRemaining,3);
 for(let i=0;i<300;i++)e.updateBattleEffects();assert.equal(s.defense,50);assert.equal(s.shieldDefense,20);assert.equal(e.runtime('guard').actions[0].effect.uses,2);assert.equal(s.activeEffects.find(x=>x.id==='marine_guard').usesRemaining,3);
});
test('marine guard blocks only physical direct attacks and removes its linked shell after the last block',()=>{
 const e=marineEngine(['shell']),s=e.owner,t=e.target;e.applySkill(s,s,e.runtime('guard'));assert.equal(e.getTimedBarriers(s)[0].shieldRemaining,100);
 const hit=type=>e.applyActionDamage(t,s,{damageType:type,coefficients:[{type:'fixed',value:10}]});hit('magic');assert.equal(s.activeEffects.find(x=>x.id==='marine_guard').usesRemaining,2);hit('physical');assert.equal(s.activeEffects.find(x=>x.id==='marine_guard').usesRemaining,1);hit('physical');assert.equal(e.getTimedBarriers(s).length,0);assert.equal(s.activeEffects.some(x=>x.id==='marine_guard'),false);
 e.applySkill(s,s,e.runtime('guard'));s.activeEffects=s.activeEffects.filter(x=>x.id!=='marine_guard');e.recalculateBattleBuffs(s);assert.equal(e.getTimedBarriers(s).length,0);
});
test('marine boomerang respects the minimum range chains once per target and knocks every hit target back',()=>{
 const e=marineEngine(['haze']),s=e.owner,t=e.target;const others=[155,165,175,185].map(x=>{const u=unit(e,'enemy',x);u.hp=u.maxHp=10000;return u;});const b=e.runtime('boomerang');assert.equal(b.actions[0].chainCount,4);assert.equal(b.actions[0].maxTargets,5);
 t.x=130;assert.notEqual(e.resolveSkillTarget(s,b,[s],[t]),t);t.x=145;e.applySkill(s,t,b);for(const u of [t,...others]){assert.equal(u.hp,9900);assert(u.x>=(u===t?145:155));}
});
test('marine cannon roar stuns only damaged targets and enlarges the splash',()=>{
 const e=marineEngine(['roar']),s=e.owner,t=e.target;const near=unit(e,'enemy',180);near.hp=near.maxHp=10000;const far=unit(e,'enemy',200);far.hp=far.maxHp=10000;const c=e.getBasicAttackReplacement(s);assert.equal(c.actions[0].area,4);e.doAttack(s,t,c);assert.equal(t.hp,9700);assert.equal(near.hp,9700);assert(e.hasBattleState(t,'stun'));assert(e.hasBattleState(near,'stun'));assert.equal(far.hp,10000);assert.equal(e.hasBattleState(far,'stun'),false);
});
test('marine barrage fires one overlapping cannon per enemy and uses selected raid and roar modifiers',()=>{
 const e=marineEngine(['air_raid','roar']),s=e.owner,t=e.target;const near=unit(e,'enemy',150);near.hp=near.maxHp=10000;const far=unit(e,'enemy',1000);far.hp=far.maxHp=10000;
 e.applySkill(s,t,e.runtime('barrage'));assert.equal(t.hp,9220);assert.equal(near.hp,9220);assert.equal(far.hp,9610);assert(e.hasBattleState(far,'stun'));assert.equal(e.marine('barrage').castTime,.5);assert.equal(e.marine('barrage').maxUses,1);
 e.dispatchSkillActions(s,t,e.runtime('barrage'),true);assert.equal(e.projectiles.length,3);assert(e.projectiles.every(p=>p.skill.id===e.marine('barrage').id && p.skillAction.area===4));
});
test('marine optional skills apply only three equipped choices and preserve extension metadata',()=>{
 const e=marineEngine(['one_chance','haze','roar','reload']),s=e.owner;assert.equal(e.runtime('expansion').actions[0].duration,8);assert.equal(e.getBasicAttackReplacement(s).fixedAttackInterval,3);assert.equal(e.getBasicAttackReplacement(s).actions[0].area,4);
 assert.equal(e.runtime('expansion').actions[0].effect.skillModifiers.length,2);assert.equal(e.isSkillExecutable(e.marine('cannon_passive')),true);assert.equal(e.isSkillExecutable(e.marine('expansion')),true);
});


function dancerEngine(options=[]) {
 const e=engine();e.skillsJson=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','skills.json'),'utf8')));
 const s=e.owner=unit(e),t=e.target=unit(e,'enemy',105);s.atk=100;s.hp=500;s.maxHp=1000;s.mp=s.maxMp=100;s.st=100;t.hp=t.maxHp=100000;
 s.weaponAttacks=Array.from({length:6},(_,i)=>({slot:'sword'+i,weaponCategory:'oneHandSword',atk:0,attackType:'physical',attackSpeed:1,castSpeed:0,attackRange:1}));s.weaponAttackStates=s.weaponAttacks.map(weapon=>({weapon,castTimer:0,cooldown:0,target:null}));
 e.dancer=id=>e.getSkillById('skill_class_dancer_'+id);s.skillIds=['sovereign','flower','ward','body','focus','scatter',...options].map(id=>e.dancer(id).id);e.runtime=id=>e.getRuntimeComboSkill(s,e.getRuntimeSelectionSkill(s,e.dancer(id)));return e;
}
test('dancer each sword uses its own equipment attack plus shared character attack without adding all equipped swords again',()=>{
 const e=dancerEngine(),s=e.owner,t=e.target;s.weaponAttackStates.forEach((state,i)=>state.weapon.atk=10*(i+1));s.atk=310;
 assert.equal(JSON.stringify(e.getControlledWeaponStates(s).map(state=>e.getControlledWeaponAttackPower(s,state.weapon))),JSON.stringify([110,120,130,140,150,160]));e.applySkill(s,t,e.runtime('focus'));assert.equal(t.hp,99595);
});
test('dancer six independent swords use quarter damage and one MP per sword without spending ST',()=>{
 const e=dancerEngine(),s=e.owner,t=e.target;e.updateIndependentWeaponAttacks(s,[t]);assert.equal(t.hp,99850);assert.equal(s.mp,94);assert.equal(s.st,100);assert.equal(e.getAvailableControlledWeapons(s).length,6);
 s.mp=2;s.weaponAttackStates.forEach(state=>state.cooldown=0);e.updateIndependentWeaponAttacks(s,[t]);assert.equal(t.hp,99800);assert.equal(s.mp,0);
});
test('dancer focus uses only free swords and honors contact range and selected flying sword range',()=>{
 const e=dancerEngine(),s=e.owner,t=e.target;e.applySkill(s,s,e.runtime('ward'));assert.equal(e.getAvailableControlledWeapons(s).length,4);e.applySkill(s,t,e.runtime('focus'));assert.equal(t.hp,99800);
 t.x=140;e.applySkill(s,t,e.runtime('focus'));assert.equal(t.hp,99800);s.skillIds.push(e.dancer('flying_sword').id);assert.equal(e.runtime('focus').actions[0].contactRange,false);assert.equal(e.getActionRangePixels(s,e.runtime('focus').actions[0]),50);e.applySkill(s,t,e.runtime('focus'));assert.equal(t.hp,99600);
});
test('dancer ward reserves two swords until its physical blocks are consumed or its effect expires or is dispelled',()=>{
 const e=dancerEngine(),s=e.owner,t=e.target;e.applySkill(s,s,e.runtime('ward'));const hit=type=>e.applyActionDamage(t,s,{damageType:type,coefficients:[{type:'fixed',value:10}]});hit('magic');assert.equal(e.getAvailableControlledWeapons(s).length,4);hit('physical');hit('physical');assert.equal(e.getAvailableControlledWeapons(s).length,6);
 e.applySkill(s,s,e.runtime('ward'));for(let i=0;i<300;i++)e.updateBattleEffects();assert.equal(e.getAvailableControlledWeapons(s).length,6);
 e.applySkill(s,s,e.runtime('ward'));e.applyTimedEffectAction(s,s,e.normalizeSkillAction({type:'delete_buff',target:'self',effect:{id:'dancer_ward'}}));assert.equal(e.getAvailableControlledWeapons(s).length,6);
});
test('dancer body spends ST immediately reserves nothing while casting then reserves three swords and restores eight MP each second',()=>{
 const e=dancerEngine(),s=e.owner;const skill=e.runtime('body');const spent=e.spendSkillResourceCosts(s,skill);e.startCast(s,{type:'skill',target:s,skill,resourceSpent:spent});assert.equal(s.st,70);assert.equal(e.getAvailableControlledWeapons(s).length,6);for(let i=0;i<60;i++)e.updateCast(s);assert.equal(e.getAvailableControlledWeapons(s).length,3);s.mp=0;
 for(let i=0;i<59;i++)e.updateBattleEffects();assert.equal(s.mp,0);e.updateBattleEffects();assert.equal(s.mp,8);for(let i=0;i<240;i++)e.updateBattleEffects();assert.equal(s.mp,40);assert.equal(e.getAvailableControlledWeapons(s).length,6);
});
test('dancer scatter excludes ward and body swords and recall pays ten MP per stage with full cooldown only after recall',()=>{
 const e=dancerEngine(),s=e.owner,t=e.target;const other=unit(e,'enemy',110);other.hp=other.maxHp=100000;e.applySkill(s,s,e.runtime('ward'));e.applySkill(s,s,e.runtime('body'));assert.equal(e.getAvailableControlledWeapons(s).length,1);
 let skill=e.runtime('scatter');assert.equal(e.spendSkillResourceCosts(s,skill).MP,10);e.applySkill(s,t,skill);assert.equal(t.hp,99900);assert.equal(other.hp,100000);assert.equal(e.getAvailableControlledWeapons(s).length,0);assert.equal(e.getResolvedSkillCooldownTicks(skill,s),0);e.advanceSkillCombo(s,skill);
 skill=e.runtime('scatter');assert.equal(e.canActivateSkill(s,skill),true);assert.equal(e.spendSkillResourceCosts(s,skill).MP,10);e.applySkill(s,s,skill);assert.equal(t.hp,99800);assert.equal(e.getAvailableControlledWeapons(s).length,1);assert.equal(e.getResolvedSkillCooldownTicks(skill,s),900);e.advanceSkillCombo(s,skill);assert.equal(s.skillComboStages[skill.id],0);
});
test('dancer ghost sword uses the average power without an equipment slot and the optional limit gates the fourth choice',()=>{
 const e=dancerEngine(['ghost_sword','good_mind','flying_sword','healing_sword']),s=e.owner;s.weaponAttackStates.forEach((state,i)=>state.weapon.atk=10*(i+1));s.atk=310;
 const states=e.getControlledWeaponStates(s);assert.equal(states.length,7);assert.equal(states[6].weapon.atk,35);assert.equal(e.getControlledWeaponAttackPower(s,states[6].weapon),135);e.recalculateBattleBuffs(s);assert.equal(s.maxMp,130);const hp=s.hp;e.doAttack(s,e.target,e.createControlledWeaponAttack(s,states[0].weapon));assert.equal(s.hp,hp);
});
test('dancer selected sword healing and fixed damage apply per sword hit with no recursive bonus or mitigation',()=>{
 const e=dancerEngine(['healing_sword','sharp_sword']),s=e.owner,t=e.target;e.getReducedDamage=()=>1;t.runtimeRuleOverrides=[{receivedDamagePercent:50}];e.doAttack(s,t,e.createControlledWeaponAttack(s,s.weaponAttacks[0]));assert.equal(t.hp,99997);assert.equal(s.hp,505);
});
test('dancer flower reclaims reserved and scattered swords while preserving buffs and assigns excess swords to nearest enemies',()=>{
 const e=dancerEngine(['beautiful_flower','ghost_sword']),s=e.owner,t=e.target;const other=unit(e,'enemy',115);other.hp=other.maxHp=100000;e.applySkill(s,s,e.runtime('ward'));e.applySkill(s,s,e.runtime('body'));e.applySkill(s,t,e.runtime('scatter'));assert.equal(e.getAvailableControlledWeapons(s).length,0);
 const before=s.activeEffects.map(x=>[x.id,x.remainingTicks,x.usesRemaining]);const flower=e.runtime('flower');assert.equal(flower.weaponCommand.duration,15);e.applySkill(s,t,flower);assert.equal(s.weaponFlower.entries.length,7);assert.equal(s.weaponFlower.entries.filter(x=>x.target===t).length,4);assert.equal(s.weaponFlower.entries.filter(x=>x.target===other).length,3);assert.equal(s.weaponDeployment,null);assert.equal(JSON.stringify(s.activeEffects.map(x=>[x.id,x.remainingTicks,x.usesRemaining])),JSON.stringify(before));assert.equal(e.canActivateSkill(s,e.runtime('focus')),false);
 const mp=s.mp,st=s.st;e.takeAction(s,[s],[t,other]);assert.equal(s.mp,mp);assert.equal(s.st,st);assert.equal(t.hp,99500);assert.equal(other.hp,99600);assert.equal(e.getAvailableControlledWeapons(s).length,0);
 s.mp=0;for(let i=0;i<60;i++)e.updateBattleEffects();assert.equal(s.mp,8);const hp=s.hp;e.applyActionDamage(t,s,{damageType:'physical',coefficients:[{type:'fixed',value:10}]});assert.equal(s.hp,hp);assert.equal(s.activeEffects.find(x=>x.id==='dancer_ward').usesRemaining,1);assert.equal(e.getAvailableControlledWeapons(s).length,0);
 s.weaponFlower.remainingTicks=1;e.takeAction(s,[s],[t,other]);assert.equal(s.weaponFlower,null);assert.equal(e.getAvailableControlledWeapons(s).length,7);assert.equal(s.activeEffects.length,2);
});
test('dancer flower retargets dead enemies and clears reservations and deployment on death reset',()=>{
 const e=dancerEngine(),s=e.owner,t=e.target;const other=unit(e,'enemy',115);other.hp=other.maxHp=100000;e.applySkill(s,t,e.runtime('flower'));t.alive=false;t.hp=0;e.updateWeaponFlower(s);assert(s.weaponFlower.entries.every(x=>x.target===other));e.clearBattleEffects(s);assert.equal(s.weaponFlower,null);assert.equal(s.weaponDeployment,null);assert.equal(e.getAvailableControlledWeapons(s).length,6);
});


function berserkerEngine(options=[]) {
 const e=engine();e.skillsJson=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','skills.json'),'utf8')));
 const s=e.owner=unit(e),t=e.target=unit(e,'enemy',105);s.atk=100;s.attackSpeed=2;s.speed=1;s.hp=s.maxHp=1000;s.st=s.maxSt=100;s.weaponAttacks=[{weaponCategory:'oneHandSword'},{weaponCategory:'oneHandSword'}];t.hp=t.maxHp=100000;
 e.berserker=id=>e.getSkillById('skill_class_berserker_'+id);s.skillIds=['armor_tattoo','liberation','pain_recovery','blood_scent','fire_strike','flame_slash',...options].map(id=>e.berserker(id).id);e.runtime=id=>e.getRuntimeComboSkill(s,e.getRuntimeSelectionSkill(s,e.berserker(id)));e.hit=(amount,type='fixed')=>e.applyActionDamage(t,s,{damageType:type,coefficients:[{type:'fixed',value:amount}]});return e;
}
test('berserker fire strike dual attacks use the revised three coefficients and four ST per stage',()=>{
 const e=berserkerEngine(),s=e.owner,t=e.target;
 for(const value of [125,150,175]){const skill=e.runtime('fire_strike');assert.equal(skill.actions.filter(a=>a.type==='deal_damage').length,2);assert.equal(skill.actions[0].coefficients[0].value,value);assert.equal(e.spendSkillResourceCosts(s,skill).ST,4);e.applySkill(s,t,skill);e.advanceSkillCombo(s,skill);}
 assert.equal(t.hp,99100);assert.equal(s.st,88);assert.equal(s.effectAttackRateMultiplier,1.2);assert.equal(e.runtime('fire_strike').runtimeCombo.stageIndex,0);
});
test('berserker blood scent pays current HP and selected heat doubles only the HP cost and cleanses harmful effects',()=>{
 const e=berserkerEngine(['blood_heat']),s=e.owner;s.hp=500;e.applyTimedEffectAction(s,s,e.normalizeSkillAction({type:'add_state',duration:5,effect:{id:'root',state:'root'}}));e.applyTimedEffectAction(s,s,e.normalizeSkillAction({type:'add_buff',duration:5,effect:{id:'good',stat:'defense',mode:'flat',value:10}}));
 const skill=e.runtime('blood_scent');assert.equal(e.spendSkillResourceCosts(s,skill).HP,50);e.applySkill(s,s,skill);assert.equal(s.hp,450);assert.equal(s.effectAttackRateMultiplier,1.2);assert.equal(e.hasBattleState(s,'root'),false);assert(s.activeEffects.some(x=>x.id==='good'));for(let i=0;i<360;i++)e.updateBattleEffects();assert.equal(s.effectAttackRateMultiplier,1);
 const plain=berserkerEngine();plain.owner.hp=500;assert.equal(plain.spendSkillResourceCosts(plain.owner,plain.runtime('blood_scent')).HP,25);
});
test('berserker pain recovery receives full damage and heals the stored percentage only at its three-second natural expiry',()=>{
 const e=berserkerEngine(['pain_opportunity']),s=e.owner;e.applySkill(s,s,e.runtime('pain_recovery'));e.hit(100);e.hit(200);assert.equal(s.hp,700);assert.equal(s.activeEffects.find(x=>x.mode==='damage_recovery').storedDamage,300);for(let i=0;i<179;i++)e.updateBattleEffects();assert.equal(s.hp,700);e.updateBattleEffects();assert.equal(s.hp,790);
 const plain=berserkerEngine();plain.applySkill(plain.owner,plain.owner,plain.runtime('pain_recovery'));plain.hit(100);for(let i=0;i<180;i++)plain.updateBattleEffects();assert.equal(plain.owner.hp,920);
});
test('berserker pain recovery neither heals on dispel nor resurrects a dead character',()=>{
 const e=berserkerEngine(),s=e.owner;s.skillIds=s.skillIds.filter(id=>id!==e.berserker('liberation').id);e.applySkill(s,s,e.runtime('pain_recovery'));e.hit(100);e.applyTimedEffectAction(s,s,e.normalizeSkillAction({type:'delete_buff',effect:{id:'berserker_pain_recovery'}}));for(let i=0;i<180;i++)e.updateBattleEffects();assert.equal(s.hp,900);
 e.applySkill(s,s,e.runtime('pain_recovery'));e.hit(1000);for(let i=0;i<180;i++)e.updateBattleEffects();assert.equal(s.hp,0);assert.equal(s.alive,false);
});
test('berserker liberation only auto-casts on lethal damage after the thirty-second boundary and once per battle',()=>{
 const early=berserkerEngine();vm.runInContext('combatEventTick=1799',early);early.hit(2000);assert.equal(early.owner.alive,false);assert.equal(early.owner.skillUseCounts[early.berserker('liberation').id],undefined);
 const e=berserkerEngine(),s=e.owner;e.hit(100);assert.equal(s.hp,900);assert.equal(s.skillUseCounts[e.berserker('liberation').id],undefined);assert.equal(e.getEquippedSkills(s).some(x=>x.lethalActivation),false);e.hit(1000);assert.equal(s.hp,1);assert.equal(s.alive,true);assert.equal(s.skillUseCounts[e.berserker('liberation').id],1);assert.equal(s.atk,130);assert.equal(s.speed,1.2);assert.equal(s.effectAttackRateMultiplier,1.5);e.hit(99999);assert.equal(s.hp,1);
 e.applyActionHeal(s,s,{healResource:'HP',coefficients:[{type:'fixed',value:99}]});assert.equal(s.hp,100);for(let i=0;i<360;i++)e.updateBattleEffects();assert.equal(s.hp,100);assert.equal(s.atk,100);assert.equal(s.speed,1);e.hit(1000);assert.equal(s.alive,false);
 e.resetUnitForBattle(s);e.hit(2000);assert.equal(s.alive,true);assert.equal(s.skillUseCounts[e.berserker('liberation').id],1);
});
test('berserker liberation reacts to periodic lethal damage and does not interrupt an already running cast',()=>{
 const e=berserkerEngine(),s=e.owner;s.pendingAction={type:'skill',skill:e.runtime('flame_slash'),target:e.target};s.castTimer=30;s.castDuration=30;const pending=s.pendingAction;e.applyActionDamage(e.target,s,{damageType:'fixed',periodic:true,coefficients:[{type:'fixed',value:2000}]});assert.equal(s.hp,1);assert.equal(s.pendingAction,pending);assert.equal(s.castTimer,30);assert.equal(s.skillBubbleText,'광전사 해방');
 const resource=berserkerEngine();resource.owner.hp=0;resource.syncAliveState(resource.owner,{source:resource.owner,reason:'HP 자원 소진'});assert.equal(resource.owner.alive,false);assert.equal(resource.owner.skillUseCounts[resource.berserker('liberation').id],undefined);
});
test('berserker afterglow waits five full seconds then repeats protection and buffs for three seconds without consuming another ultimate use or looping',()=>{
 const e=berserkerEngine(['afterglow']),s=e.owner;e.hit(2000);for(let i=0;i<360;i++)e.updateBattleEffects();assert.equal(s.hp,1);assert.equal(s.activeEffects.some(x=>x.mode==='hp_floor'),false);assert.equal(s.delayedEffectRepeats.length,1);
 for(let i=0;i<299;i++)e.updateBattleEffects();assert.equal(s.activeEffects.length,0);e.updateBattleEffects();assert(s.activeEffects.some(x=>x.mode==='hp_floor'));assert.equal(s.atk,130);assert.equal(s.skillUseCounts[e.berserker('liberation').id],1);assert.equal(s.skillBubbleText,'홍염');e.hit(1000);assert.equal(s.hp,1);for(let i=0;i<180;i++)e.updateBattleEffects();assert.equal(s.atk,100);assert.equal(s.activeEffects.length,0);for(let i=0;i<600;i++)e.updateBattleEffects();assert.equal(s.activeEffects.length,0);assert.equal(s.delayedEffectRepeats.length,0);
});
test('berserker afterglow is cancelled by death during the unprotected delay',()=>{
 const e=berserkerEngine(['afterglow']),s=e.owner;e.hit(2000);for(let i=0;i<360;i++)e.updateBattleEffects();e.hit(10);for(let i=0;i<500;i++)e.updateBattleEffects();assert.equal(s.alive,false);assert.equal(s.activeEffects.length,0);assert.equal(s.delayedEffectRepeats.length,0);
});
test('berserker dual wield qualification is conditional and flame afterimage changes only the magic packet',()=>{
 const e=berserkerEngine(['qualification','flame_afterimage']),s=e.owner,t=e.target;e.recalculateBattleBuffs(s);assert.equal(s.effectAttackRateMultiplier,1.15);s.weaponAttacks=[s.weaponAttacks[0]];e.recalculateBattleBuffs(s);assert.equal(s.effectAttackRateMultiplier,1);const skill=e.runtime('flame_slash');assert.equal(skill.actions[0].coefficients[0].value,100);assert.equal(skill.actions[1].coefficients[0].value,40);e.applySkill(s,t,skill);assert.equal(t.hp,99860);
});
test('berserker interrupting strikes stop casts without adding a stun and options beyond the first three remain inactive',()=>{
 const e=berserkerEngine(['interrupting_strikes']),s=e.owner,t=e.target;t.pendingAction={type:'skill',skill:e.runtime('flame_slash'),target:s};t.castTimer=100;t.castDuration=100;e.applySkill(s,t,e.runtime('fire_strike'));assert.equal(t.pendingAction,null);assert.equal(t.castTimer,0);assert.equal(e.hasBattleState(t,'stun'),false);
 const limited=berserkerEngine(['blood_heat','pain_opportunity','qualification','flame_afterimage']);assert.equal(limited.runtime('flame_slash').actions[1].coefficients[0].value,20);
});
