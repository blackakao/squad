const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

test('knight mount is invisible and untargetable but still shares damage and appears under its owner',()=>{
 const e=engine();e.skillsJson=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','skills.json'),'utf8')));
 e.horseDefinition=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','entities','knight_magic_horse.json'),'utf8'));vm.runInContext('entitiesJson.push(horseDefinition)',e);
 const knight=unit(e),enemy=unit(e,'enemy',110);knight.hp=knight.maxHp=1000;knight.speed=2;
 const passive=e.getSkillById('skill_class_knight_magic_horse');knight.skillIds=[passive.id];e.applySkill(knight,knight,passive);const horse=e.getLivingOwnedSummons(knight,'knight_magic_horse')[0];assert.ok(horse);
 assert.equal(horse.commandOnly,true);assert.equal(horse.targetable,false);assert.equal(horse.collidable,false);assert.equal(e.isMountedCompanion(horse),true);e.drawUnit(horse,false);
 assert.equal(e.getActiveBattleEntities(e.playerSquad).includes(horse),false);
 const area=e.normalizeSkillAction({type:'deal_damage',target:'enemy',area:20,areaCenter:'self',damageType:'fixed',coefficients:[{type:'fixed',value:100}]});e.applySkill(enemy,knight,skill(e,area));assert.equal(knight.hp,920);assert.equal(horse.hp,980);
 const x=horse.x;e.moveUnit(horse,[enemy]);e.takeAction(horse,[knight,horse],[enemy]);assert.equal(horse.x,x);assert.equal(horse.pendingAction,null);
 e.document={addEventListener(){}};e.getRoleLabel=String;e.getUnitDps=()=>0;e.recordImagePath=()=>'';
 vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js','ui-battle-view.js'),'utf8'),e);
 const html=e.renderStatus(e.playerSquad,()=> 'blue');assert.ok(html.includes('main-summon-group'));assert.ok(html.includes(horse.name));assert.ok(html.includes('980 / 1000'));
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
 e.applySkill(s,t,e.fire('lizard'));const pool=t.activeEffects.find(x=>x.mode==='damage_pool');assert.equal(pool.poolRemaining,16);assert.equal(pool.stacks,1);
 s.magic=1000;for(let i=0;i<480;i++)e.updateBattleEffects();assert.ok(Math.abs(10000-t.hp-176)<1e-7);assert.equal(t.activeEffects.length,0);
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

test('fire meditation restores ten percent of current missing mana on each of three pulses and interrupts on damage',()=>{
 const e=fireEngine(),s=unit(e),enemy=unit(e,'enemy',110);s.mp=0;
 const meditation=e.fire('meditation');e.startBattleChannel(s,{type:'skill',target:s,skill:meditation},meditation);
 for(let i=0;i<180;i++)e.updateBattleChannel(s);
 assert.ok(Math.abs(s.mp-27.1)<1e-9);assert.equal(s.channelAction,null);assert.equal(s.skillCooldowns[meditation.id],1200);
 s.mp=0;e.startBattleChannel(s,{type:'skill',target:s,skill:meditation},meditation);for(let i=0;i<60;i++)e.updateBattleChannel(s);assert.equal(s.mp,10);
 e.applyActionDamage(enemy,s,e.normalizeSkillAction({type:'deal_damage',damageType:'fixed',coefficients:[{type:'fixed',value:1}]}));assert.equal(s.channelAction,null);assert.equal(s.mp,10);
});

test('fire revised data normalizes and equips all five skills with burst and zero cooldown attack ahead of fallback',()=>{
 const e=fireEngine();for(const id of ['flame','ignite','lizard','meditation','drunken'])assert.equal(e.isSkillExecutable(e.fire(id)),true,id);
 assert.deepEqual([e.fire('ignite').castTime,e.fire('ignite').cooldown,e.fire('ignite').actions[0].coefficients[0].value],[1.5,0,120]);
 assert.deepEqual([e.fire('drunken').castTime,e.fire('drunken').cooldown,e.fire('drunken').actions[0].coefficients[0].value],[3,12,250]);
 const chars=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','characters.json'),'utf8'));const ids=chars.find(c=>c.skillIds?.includes('skill_class_fire_ignite')).skillIds;assert.equal(ids.length,5);assert.equal(ids.at(-1),e.fire('ignite').id);
 const source=unit(e),target=unit(e,'enemy',110);source.skillIds=ids;source.mp=source.maxMp;
 assert.equal(e.tryUseReadySkill(source,[source],[target]),true);assert.equal(source.pendingAction.skill.id,e.fire('lizard').id);
 e.interruptBattleCast(source,'test');source.mp=source.maxMp;source.skillCooldowns[e.fire('lizard').id]=180;
 assert.equal(e.tryUseReadySkill(source,[source],[target]),true);assert.equal(source.pendingAction.skill.id,e.fire('drunken').id);
 e.interruptBattleCast(source,'test');source.mp=source.maxMp;source.skillCooldowns[e.fire('drunken').id]=720;
 assert.equal(e.tryUseReadySkill(source,[source],[target]),true);assert.equal(source.pendingAction.skill.id,e.fire('ignite').id);
});

function sniperEngine() {
 const e=engine();e.skillsJson=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','skills.json'),'utf8')));
 e.sniper=name=>e.getSkillById('skill_class_sniper_'+name);return e;
}

test('sniper solitude checks both sides at five metres including summons and ignores waiting or dead units',()=>{
 const e=sniperEngine(),s=unit(e),other=unit(e,'enemy',151);s.atk=100;s.skillIds=[e.sniper('solitude').id];
 e.updateBattleEffects();assert.equal(s.atk,120);
 other.x=150;e.updateBattleEffects();assert.equal(s.atk,100);assert.equal(e.getUnitIncomingRulePercent(s,'receivedDamagePercent'),130);
 assert.equal(s.runtimeRuleOverrides[0].remainingTicks,120);
 other.side='player';other.isSummon=true;e.updateBattleEffects();assert.equal(s.atk,100);
 other.isWaiting=true;e.updateBattleEffects();assert.equal(s.atk,120);
 other.isWaiting=false;other.alive=false;e.updateBattleEffects();assert.equal(s.atk,120);
 for(let i=0;i<120;i++)e.updateRuntimeRuleOverrides();assert.equal(e.getUnitIncomingRulePercent(s,'receivedDamagePercent'),100);
 e.applyTimedEffectAction(other,s,e.normalizeSkillAction({type:'delete_buff',effect:{id:'sniper_solitude',dispelMode:'id'}}));
 e.updateBattleEffects();assert.equal(e.getUnitIncomingRulePercent(s,'receivedDamagePercent'),130);assert.equal(s.atk,120);
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

test('sniper focus exits on actual barrier or periodic damage and interrupts casting with two seconds stun',()=>{
 for(const periodic of [false,true]) {
  const e=sniperEngine(),s=unit(e),enemy=unit(e,'enemy',110);s.atk=100;s.bp=50;
  e.applySkill(s,s,e.sniper('mode'));assert.equal(s.atk,130);assert.equal(s.attackRange,6.5);
  s.castTimer=100;s.pendingAction={type:'skill',skill:e.sniper('shot'),target:enemy};
  const hit=e.normalizeSkillAction({type:'deal_damage',damageType:'fixed',coefficients:[{type:'fixed',value:10}]});
  e.applyActionDamage(enemy,s,{...hit,coefficients:[{type:'fixed',value:0}]});assert.equal(s.atk,130);
  e.applyActionDamage(enemy,s,{...hit,periodic});assert.equal(s.bp,37);assert.equal(s.atk,100);assert.equal(s.attackRange,5);
  assert.equal(e.hasBattleState(s,'stun'),true);assert.equal(s.castTimer,0);assert.equal(s.activeEffects.find(x=>x.state==='stun').remainingTicks,120);
 }
});

test('sniper revised skills remain executable after normalization',()=>{
 const e=sniperEngine();for(const name of ['solitude','shadow','shot','mode'])assert.equal(e.isSkillExecutable(e.sniper(name)),true,name);
 assert.equal(e.sniper('shot').cooldown,5);assert.equal(e.sniper('mode').actions[0].transform.damageExitStun,2);
 const shadow=e.sniper('shadow');assert.equal(shadow.actions[0].effect.breakOnAttack,true);
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
  off.y=110;source.magic=50;
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
  e.applySkill(source,source,e.star('companion'));source.summons[0].x=120;source.summons[0].y=100;
  e.applySkill(source,source,e.star('weak_gravity'));
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

test('star skills and new character roundtrip and no ultimate is implemented', () => {
  const e=starEngine(),all=e.skillsJson.filter(s=>s.id.startsWith('skill_class_star_'));
  assert.equal(all.length,6);all.forEach(s=>assert.ok(e.isSkillExecutable(s),s.name));
  const character=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','characters.json'),'utf8')).find(c=>c.name==='별소환사');
  assert.ok(character);assert.equal(character.skillIds.length,6);assert.ok(!all.some(s=>s.name.includes('또다른')));
  const copy=e.normalizeSkillJson(JSON.parse(JSON.stringify(all)));
  assert.equal(copy.find(s=>s.id===e.star('radiance').id).actions[0].distanceFalloff.step,2);
  assert.equal(copy.find(s=>s.id===e.star('relocate').id).actions[0].summonCommand,'relocate');
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
  for (const file of ['js/battle-events.js', 'js/skill-channel.js', 'js/skill-passives.js', 'js/skill-effects.js', 'js/skill.js', 'js/rune.js', 'js/entity.js', 'js/battle.js', 'js/record.js', 'js/monster.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context);
  }
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
 assert.deepEqual([guard.castTime,guard.cooldown,guard.actions[0].effect.uses,guard.actions[0].effect.consumePeriodic],[0,10,2,false]);
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
  const ids=['skill_class_knight_magic_horse','skill_class_knight_haste_horse','skill_class_demon_brute'];
  const actual=allSkills.filter(candidate=>ids.includes(candidate.id));
  assert.equal(actual.length,3);
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
  assert.equal(horse.entityId,'knight_magic_horse');assert.equal(horse.maxHp,1000);
  assert.ok(Math.abs(knight.speed-1.95)<1e-9);
  e.applyActionDamage(enemy,knight,{damageType:'fixed',coefficients:[{type:'fixed',value:100}]});
  assert.equal(knight.hp,20);assert.equal(horse.hp,980);

  const summonCount=knight.summons.length;
  e.applySkill(knight,knight,haste);
  assert.equal(knight.summons.length,summonCount);
  assert.equal(knight.atk,112.5);assert.equal(knight.attackSpeed,1.5);
  horse.hp=0;e.syncAliveState(horse);e.updateBattleEffects(knight);
  assert.equal(knight.speed,1.3);
  e.applySkill(knight,knight,haste);
  assert.equal(knight.summons.filter(summon=>summon.alive).length,1);
  assert.equal(knight.atk,90);assert.equal(knight.attackSpeed,2);

  const demon=unit(e);demon.name='악마';demon.magic=60;demon.hp=demon.maxHp=500;
  const bruteSkill=e.skillsJson.find(candidate=>candidate.id==='skill_class_demon_brute');
  e.dispatchSkillActions(demon,demon,bruteSkill,false);
  const brute=demon.summons.find(summon=>summon.alive);
  assert.equal(brute.entityId,'demon_brute');assert.equal(brute.attackType,'magic');assert.equal(brute.magic,60);
  e.applyActionDamage(enemy,demon,{damageType:'fixed',coefficients:[{type:'fixed',value:100}]});
  assert.equal(demon.hp,460);assert.equal(brute.hp,940);
  e.dispatchSkillActions(demon,demon,bruteSkill,false);
  assert.equal(demon.summons.filter(summon=>summon.alive).length,1);
  assert.equal(brute.magic,75);
});

test('demon minions intercept one hit each and demon general uses an area basic attack',()=>{
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
 assert.equal(general.attackSkillId,'skill_entity_demon_general_attack');assert.equal(general.attackSpeed,2);
 assert.equal(primary.hp,480);assert.equal(near.hp,480);assert.equal(far.hp,500);
 assert.equal(e.hasBattleState(primary,'stun'),true);assert.equal(e.hasBattleState(near,'stun'),true);assert.equal(e.hasBattleState(far,'stun'),false);
 primary.hp=near.hp=far.hp=500;near.x=general.x+10;near.y=general.y;far.x=general.x+100;far.y=general.y;
 const attack=e.getUnitSkill(general);e.applySkill(general,primary,attack);
 assert.equal(primary.hp,400);assert.equal(near.hp,400);assert.equal(far.hp,500);
});

test('demon summon data and entity attack references match class rules',()=>{
 const skills=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','skills.json'),'utf8'));
 const characters=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','characters.json'),'utf8'));
 const find=id=>skills.find(skill=>skill.id===id),minions=find('skill_class_demon_summon_minions'),general=find('skill_class_demon_summon_general'),attack=find('skill_entity_demon_general_attack');
 assert.deepEqual([minions.castTime,minions.cooldown,minions.actions[0].count,minions.actions[0].duration,minions.actions[0].protectOwnerPercent],[1.5,10,3,5,100]);
 assert.deepEqual([general.castTime,general.cooldown,general.actions[0].duration,general.actions[1].area,general.actions[1].coefficients[0].value,general.actions[2].duration],[2,15,4,3,20,1]);
 assert.deepEqual([attack.slot,attack.actions[0].area,attack.actions[0].areaCenter,attack.actions[0].coefficients[0].value],['basic',3,'self',100]);
 const generalEntity=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','entities','demon_general.json'),'utf8'));
 assert.equal(generalEntity.attackSkillId,attack.id);assert.equal(generalEntity.stats.attackSpeed,2);
 assert.deepEqual(characters.find(character=>character.skillIds?.includes('skill_class_demon_brute')).skillIds,['skill_class_demon_brute',minions.id,general.id]);
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
 assert.deepEqual(firstAid.channel,{duration:3,interval:1,interruptOnDamage:false,lockTarget:true,receivedDamagePercent:70});
 assert.equal(firstAid.actions[0].coefficients[0].field,'targetMaxHp');assert.equal(firstAid.actions[0].target,'ally');
 assert.equal(drain.name,'혈청형 · 흡혈');assert.equal(drain.actions[1].coefficients[0].field,'previousActualDamage');assert.equal(drain.actions[1].coefficients[0].value,60);
 assert.equal(donation.name,'혈청형 · 헌혈');assert.equal(donation.channel.duration,5);assert.equal(donation.channel.lockTarget,true);
 assert.equal(donation.actions[1].drainResource,'HP');assert.equal(donation.actions[1].coefficients[0].field,'previousActualHealing');assert.equal(donation.actions[1].coefficients[0].value,30);
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

test('guardian effort skills and custom resource match their class rules',()=>{
 const skills=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','skills.json'),'utf8'));
 const characters=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','characters.json'),'utf8'));
 const find=id=>skills.find(item=>item.id===id);
 const strike=find('skill_class_guardian_effort_strike'),endurance=find('skill_class_guardian_endurance');
 assert.equal(strike.castTime,0);assert.equal(strike.cooldown,10);assert.equal(strike.actions[0].rangeMode,'mainWeapon');
 assert.deepEqual(Array.from(strike.actions[0].coefficients,c=>[c.field,c.value]),[['atk',100],['customResourceCurrent',100]]);
 assert.equal(strike.actions[0].coefficients[1].resourceId,'effort_magic');
 assert.deepEqual(endurance.passiveTrigger,{event:'damaged',chance:100,includePeriodic:true,allowMultiplePerTick:true,recentAttackerMitigation:{enabled:true,window:3,threshold:2,initialReductionPercent:10,additionalReductionPercent:3,maxReductionPercent:25}});
 assert.equal(endurance.actions[0].healResource,'custom:effort_magic');assert.equal(endurance.actions[0].coefficients[0].field,'triggerActualDamage');
 const guardian=characters.find(character=>character.skillIds?.includes(strike.id));
 assert.deepEqual(guardian.skillIds,['skill_class_guardian_whirl',strike.id,endurance.id]);
 assert.deepEqual(guardian.customResources.find(resource=>resource.id==='effort_magic'),{id:'effort_magic',name:'노력[마법]',initial:0,max:999999});
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
 const skills=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','skills.json'),'utf8'));
 const characters=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','characters.json'),'utf8'));
 const find=id=>skills.find(item=>item.id===id),multi=find('skill_class_archer_multishot'),power=find('skill_class_archer_power_shot'),shot=find('skill_class_sniper_shot'),mode=find('skill_class_sniper_mode');
 assert.deepEqual([multi.castTime,multi.cooldown,multi.actions[0].chainCount,multi.actions[0].chainRange,multi.actions[0].chainOrigin,multi.actions[0].maxTargets],[0,5,2,5,'primary',3]);
 assert.equal(multi.actions[0].coefficients[0].value,125);assert.equal(power.actions[0].coefficients[0].value,200);
 assert.deepEqual([shot.castTime,shot.castReceivedDamagePercent,shot.actions[0].rangeMultiplier,shot.actions[0].coefficients[0].value],[4,130,200,300]);
 assert.deepEqual([mode.actions[0].transform.receivedDamagePercent,mode.actions[0].transform.immobile,mode.actions[0].transform.exitHpBelow,mode.actions[0].transform.retreatHpBelow],[100,false,0,0]);
 assert.deepEqual(characters.find(c=>c.name==='궁사').skillIds,[multi.id,power.id]);assert.deepEqual(characters.find(c=>c.name==='저격수').skillIds,['skill_class_sniper_solitude','skill_class_sniper_shadow',shot.id,mode.id]);
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
 assert.deepEqual([monk.name,monk.castTime,monk.cooldown,monk.combo.stepCooldown,values(monk)],['승려 · 4연격',0,12,.5,[120,130,140,150]]);
 assert.deepEqual([fire.castTime,fire.cooldown,fire.combo.stepCooldown,values(fire)],[0,10,.5,[125,135,145]]);
 assert.deepEqual(fire.combo.stages.map(stage=>stage.actions.length),[2,2,2]);
 assert.deepEqual([fire.combo.completionActions[0].effect.stat,fire.combo.completionActions[0].effect.value,fire.combo.completionActions[0].duration],['attackSpeed',-20,3]);
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
 assert.deepEqual([cycle.actions[0].target,cycle.actions[0].rangeValue,cycle.actions[0].maxTargets,cycle.actions[0].coefficients[0].field,cycle.actions[0].coefficients[0].value],['ally',10,1,'triggerActualDamage',30]);
 assert.deepEqual([spring.castTime,spring.cooldown,spring.actions[0].duration,spring.actions[0].effect.stat,spring.actions[0].effect.value,spring.actions[1].effect.stat,spring.actions[1].effect.value],[.5,12,8,'defense',10,'attackSpeed',-20]);
 const monk=characters.find(character=>character.skillIds?.includes('skill_class_monk_combo'));
 assert.deepEqual(monk.skillIds.slice(0,4),[cycle.id,spring.id,'skill_class_monk_combo','skill_class_monk_area_heal']);
 const source=unit(e),ally=unit(e,'player',120);ally.defense=100;ally.attackSpeed=1;
 e.applySkill(source,ally,spring);assert.equal(ally.defense,110);assert.equal(ally.attackSpeed,.8);assert.equal(ally.activeEffects.length,2);
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
 assert.deepEqual(priest.skillIds.slice(0,4),[resonance.id,blessing.id,'skill_class_priest_smite','skill_class_priest_barrier']);
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
 const assassin=characters.find(character=>character.name==='암살자');assert.deepEqual(assassin.skillIds,[ambush.id,sentence.id]);
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
 let arrow=e.getEquippedSkills(mage).find(item=>item.id==='skill_class_mage_arrow');assert.equal(arrow.castTime,.35);assert.equal(arrow.actions[0].coefficients[0].value,100);
 mage.skillSelections.skill_class_mage_element_choice='earth';
 arrow=e.getEquippedSkills(mage).find(item=>item.id==='skill_class_mage_arrow');assert.equal(arrow.castTime,.5);assert.equal(arrow.resourceCosts[0].value,12);assert.equal(arrow.actions[0].coefficients[0].value,115);
 mage.skillSelections.skill_class_mage_element_choice='lightning';
 const area=e.getEquippedSkills(mage).find(item=>item.id==='skill_class_mage_area');assert.equal(area.actions[0].area,2.6);assert.equal(area.actions[0].splashPercent,30);assert.equal(area.actions[0].splashRadius,2);
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
 assert.equal(choice.slot,'choice_prebattle');assert.equal(choice.choice.defaultOptionId,'lightning');assert.deepEqual(Array.from(choice.choice.options,option=>option.id),['lightning','wind','earth']);
 assert.deepEqual(mage.skillIds,['skill_class_mage_element_choice','skill_class_mage_arrow','skill_class_mage_barrier','skill_class_mage_quick','skill_class_mage_area']);
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
 assert.equal(source.hp,65);assert.equal(source.bp,3);
});

test('executioner skill data matches excitement execute and bind rules',()=>{
 const e=engine(),skills=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','skills.json'),'utf8')));
 const characters=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','characters.json'),'utf8'));
 const passive=skills.find(item=>item.id==='skill_class_executioner_excitement');
 const execute=skills.find(item=>item.id==='skill_class_executioner_execute');
 const bind=skills.find(item=>item.id==='skill_class_executioner_bind');
 assert.deepEqual([passive.passiveTrigger.basicAttackOnly,passive.actions[0].coefficients[0].value,passive.actions[0].fullResourceAlternative],[true,15,'BP']);
 assert.deepEqual([execute.castTime,execute.cooldown,execute.resourceCosts[0].value,execute.actions[0].coefficients[0].value,execute.actions[1].coefficients[0].value],[0,7,10,150,50]);
 assert.deepEqual([bind.castTime,bind.cooldown,bind.resourceCosts[0].value,bind.actions[0].rangeValue,bind.actions[0].duration,bind.actions[0].effect.state],[.5,10,10,5,4,'root']);
 const executioner=characters.find(character=>character.name==='집행가');assert.deepEqual(executioner.skillIds,[passive.id,execute.id,bind.id]);
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
 assert.deepEqual([wave.castTime,wave.cooldown,wave.actions[0].coefficients[0].value,wave.actions[1].moveType,wave.actions[1].distance],[3,5,180,'Knockback',5]);
 assert.deepEqual([vortex.castTime,vortex.cooldown,vortex.actions[0].fieldRadius,vortex.actions[0].duration,vortex.actions[0].fieldMovementStCostCenter],[3,20,6,10,6]);
 assert.deepEqual([road.castTime,road.cooldown,road.actions[0].fieldShape,road.actions[0].fieldWidth,road.actions[0].duration,road.actions[0].fieldEffect],[.5,10,'line',2,5,'none']);
 assert.deepEqual(Array.from(road.actions[0].fieldAuras,aura=>[aura.target,aura.stat,aura.value]),[['ally','castSpeed',-20],['enemy','speed',-20],['enemy','attackSpeed',20],['enemy','castSpeed',20]]);
 assert.deepEqual(characters.find(character=>character.name==='제독').skillIds,[wave.id,vortex.id,road.id]);
});

test('admiral sea road executes through AI cast resource cooldown and field aura runtime',()=>{
 const e=engine();e.skillsJson=e.normalizeSkillJson(JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','skills.json'),'utf8')));
 const source=unit(e),enemy=unit(e,'enemy',200);source.x=100;source.skillIds=['skill_class_admiral_sea_road'];
 assert.equal(e.tryUseReadySkill(source,e.playerSquad,e.enemySquad),true);
 assert.equal(source.mp,90);assert.equal(source.pendingAction.skill.id,'skill_class_admiral_sea_road');assert.equal(source.castTimer,30);
 for(let tick=0;tick<30;tick++)e.updateCast(source);
 assert.equal(vm.runInContext('battleFields.length',e),1);assert.equal(source.skillCooldowns.skill_class_admiral_sea_road,600);
 e.updateBattleFields();assert.deepEqual([source.castSpeed,enemy.speed,enemy.attackSpeed,enemy.castSpeed],[.8,.8,1.2,1.2]);
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
 assert.deepEqual(entities.map(entity=>[entity.stats.atk,entity.stats.attackSpeed,entity.stats.attackRange]),[[100,3,2],[50,1,5],[200,5,10]]);
 assert.deepEqual([attack.slot,attack.actions[0].damageType,attack.actions[0].area,attack.actions[0].areaCenter],['basic','physical',2,'target']);
 assert.deepEqual(characters.find(character=>character.name==='갑사').skillIds,[ballista.id,talisman.id,recoilless.id]);
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
