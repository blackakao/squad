'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '../..');
const SOURCES = ['portrait/hair-colors', 'portrait/imported-catalog', 'portrait/catalog',
  'ui', 'category', 'battle-events', 'skill-channel', 'skill-passives', 'skill-effects',
  'skill', 'entity', 'equipment', 'monster', 'faction', 'character', 'synergy', 'team', 'stats', 'battle'];

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let n = Math.imul(state ^ state >>> 15, 1 | state);
    n ^= n + Math.imul(n ^ n >>> 7, 61 | n);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
}

function loadData(root = ROOT) {
  const data = {};
  for (const name of ['characters', 'categories', 'items', 'skills', 'factions', 'teams']) {
    data[name] = JSON.parse(fs.readFileSync(path.join(root, 'data', name + '.json'), 'utf8'));
    if (!Array.isArray(data[name])) throw new Error(`${name}: expected an array`);
  }
  data.synergies = fs.existsSync(path.join(root, 'data/synergies.json')) ? JSON.parse(fs.readFileSync(path.join(root, 'data/synergies.json'), 'utf8')) : [];
  const entityDir = path.join(root, 'data/entities');
  data.entities = fs.readdirSync(entityDir).filter(name => name.endsWith('.json')).sort()
    .map(name => JSON.parse(fs.readFileSync(path.join(entityDir, name), 'utf8')));
  // Do not invoke the migrating API or silently invent replacements for legacy summons.
  if (data.skills.some(skill => skill.actions?.some(action => action.summon))) {
    throw new Error('Legacy summon data: migrate using the game before simulation. No user files were changed.');
  }
  return data;
}

function fingerprint(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
}

function createEngine(data = loadData(), {width = 400, height = 300} = {}) {
  if (!vm.constants?.DONT_CONTEXTIFY) throw new Error('전투 테스트에는 Node.js 22.8 이상이 필요합니다.');
  let time = 1700000000000;
  let random = seededRandom(0);
  const errors = [];
  class VirtualDate extends Date {
    constructor(...args) { super(...(args.length ? args : [time])); }
    static now() { return time; }
  }
  const math = Object.create(Math);
  math.random = () => random();
  // ui.js binds elements on load. Only this dimension object is supplied; there is
  // no DOM, canvas renderer, browser, timer, network or storage in the simulation.
  const field = {width, height, getContext: () => null};
  // A direct VM global avoids proxy lookups in hot shared-engine functions.
  // It retains a separate JS realm; no combat function or tick is replaced.
  const context = vm.createContext(vm.constants.DONT_CONTEXTIFY);
  Object.assign(context, {structuredClone, Date: VirtualDate, Math: math,
    performance: {now: () => time},
    document: {getElementById: id => id === 'battleCanvas' ? field : null},
    log() {}, logWarn() {}, logError: (...args) => errors.push(args.map(String).join(' ')),
    alert: message => { throw new Error(message); },
  });
  context.window = context;
  for (const name of SOURCES) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', name + '.js'), 'utf8'), context, {filename: 'js/' + name + '.js'});
  }
  delete context.document;
  context.inputData = structuredClone(data);
  vm.runInContext(`
    updateBattleButton = () => {};
    clearBattleEventLogs = () => {};
    addBattleEventLog = () => {};
    showSkillBubble = () => {};
    showSkillAreaImpact = () => {};
    showSkillChainImpact = () => {};
    categoriesJson = normalizeCategoryJson(inputData.categories);
    itemsJson = normalizeItemJson(inputData.items);
    factionsJson = normalizeFactionJson(inputData.factions);
    entitiesJson = structuredClone(inputData.entities);
    skillsJson = normalizeSkillJson(inputData.skills);
    characterJson = normalizeCombatJson(inputData.characters, [], 'name');
    teamsJson = normalizeTeamJson(inputData.teams);
    synergiesJson = validateSynergies(inputData.synergies || []);
    globalThis.getSimulationSynergies = () => structuredClone(activeBattleSynergies);
    globalThis.roster = characterJson.map((c,id) => ({id,name:c.name,role:c.role}));
    globalThis.simState = () => ({running:isBattleRunning,tick:combatEventTick,
      units:[...playerSquad,...enemySquad]});
    battleResultSink = result => { globalThis.simWinner = result; };
    globalThis.prepareSimulation = (teamA,teamB) => {
      nextSummonId = 1;
      nextEffectCasterId = 1;
      actionTargetCooldowns = new WeakMap();
      selectedBattleTeamIds.clear();
      selectedBattleCharacterIds = new Set(teamA);
      selectedEnemyTeamIndex = '';
      battleMode = 'team';
      enemySquad = createSquadFromCharacterIds(teamB,'enemy');
      return prepareBattleSession({openScreen:false});
    };
  `, context);
  if (context.roster.length !== data.characters.length) throw new Error('Invalid character data: normalization removed entries');
  if (!context.roster.length) throw new Error('No registered characters');
  delete context.inputData;

  function runBattle({teamA, teamB, seed = 12345, maxSeconds = 600, battleId = 'battle-1', trace = false, drive = 'tick'}) {
    for (const team of [teamA, teamB]) {
      if (!Array.isArray(team) || team.length < 1 || team.length > 10 || new Set(team).size !== team.length
        || team.some(id => !Number.isInteger(id) || !context.roster[id])) throw new Error('Each team needs 1–10 distinct valid character indexes');
    }
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xFFFFFFFF) throw new Error('seed must be uint32');
    if (!Number.isFinite(maxSeconds) || maxSeconds <= 0) throw new Error('maxSeconds must be positive');
    errors.length = 0;
    time = 1700000000000;
    random = seededRandom(seed);
    context.simWinner = null;
    context.prepareSimulation(teamA, teamB);
    const rows = new Map();
    for (const unit of context.simState().units.filter(unit => !unit.isSummon)) rows.set(unit, {characterId:unit.id,name:unit.name,role:unit.role,
      team:unit.side === 'player' ? 'A' : 'B',damageDealt:0,healingDone:0,damageTaken:0,
      kills:0,deaths:0,survivalTime:0,resourceRecovery:{},skillUsage:{},damageBySkill:{},healingBySkill:{}});
    const events = [];
    const summonTotals = {damageDealt:0,healingDone:0};
    const unsubscribe = context.subscribeBattleEvent('*', (event, refs) => {
      if (trace) events.push(structuredClone(event));
      const target = rows.get(refs.target);
      if (event.type === 'hit' && refs.source?.isSummon) summonTotals.damageDealt += event.amount;
      if (event.type === 'damaged' && target) target.damageTaken += event.amount;
      if (event.type === 'heal' && event.resource === 'HP' && refs.source?.isSummon) summonTotals.healingDone += event.amount;
      if (event.type === 'death' && target) target.deaths++;
    });
    let ticks = 0;
    const maxTicks = Math.ceil(maxSeconds * 60);
    try {
      // gameLoop is also available to compare the UI scheduler against direct ticks.
      if (drive === 'loop') vm.runInContext('lastGameLoopAt = performance.now(); draw=()=>{}; updateStatusUI=()=>{}; window.setTimeout=()=>{};', context);
      while (context.simState().running && ticks < maxTicks) {
        for (const [unit,row] of rows) if (unit.alive) row.survivalTime += 1 / 60;
        time = 1700000000000 + (++ticks * 1000 / 60);
        if (drive === 'loop') context.gameLoop(); else context.runBattleTick();
        if (errors.length) throw new Error(errors.join('\n'));
      }
      const timedOut = context.simState().running;
      const winner = timedOut ? null : ({'승리':'A','패배':'B','무승부':null})[context.simWinner];
      const duration = ticks / 60;
      const result = {battleId,seed,activeSynergies:context.getSimulationSynergies(),teamA:[...teamA],teamB:[...teamB],winner,
        termination:timedOut ? 'timeout' : winner ? 'victory' : 'draw',duration,ticks,
        contributionVersion:1,
        characters:[...rows.entries()].map(([unit,row]) => {
          const contribution = structuredClone(context.getBattleContribution(unit,duration));
          return {...row,...contribution.total,contribution,
            outcome:timedOut ? 'timeout' : !winner ? 'draw' : row.team === winner ? 'win' : 'loss'};
        }),summonTotals}; // Diagnostic subset already included in characters; never add twice.
      if (trace) result.events = events;
      return result;
    } finally {
      unsubscribe();
      context.clearBattleSummons();
      vm.runInContext('isBattleRunning=false;', context);
    }
  }
  return {runBattle,roster:structuredClone(context.roster),
    engineHash:fingerprint(SOURCES.map(name => fs.readFileSync(path.join(ROOT,'js',name+'.js'),'utf8')).join('\n'))};
}
module.exports = {createEngine,loadData,seededRandom,fingerprint,ROOT,SOURCES};
