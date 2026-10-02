const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

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
    addBattleEventLog() {}, formatBattleEventValue: String,
    log() {}, escapeHtml: String,
  };
  vm.createContext(context);
  for (const file of ['js/battle-events.js', 'js/skill-channel.js', 'js/skill-passives.js', 'js/skill-effects.js', 'js/skill.js', 'js/entity.js', 'js/battle.js', 'js/record.js', 'js/monster.js']) {
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
  const records=e.createRecordMembers(e.playerSquad,1); assert.equal(records.length,3);
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

function damageProxyAction(e,percent=20,priority=100,scope='all') {
 const action=e.createDefaultAction('add_buff');action.target='ally';action.effect.id=`proxy_${priority}_${scope}`;action.effect.name='피해 대리';
 Object.assign(action.effect,{mode:'damage_proxy',proxyPercent:percent,proxyPriority:priority,proxyScope:scope});return action;
}

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
