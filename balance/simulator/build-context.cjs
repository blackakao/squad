const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {SOURCES, loadData, ROOT} = require('./engine.cjs');

// Read-only build diagnostics: load the same normalizers as the headless engine.
module.exports = function combatPowerContext(data = loadData()) {
  const context = vm.createContext({performance, document: {getElementById: () => ({getContext: () => null})}});
  context.window = context;
  for (const name of SOURCES) vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', name + '.js'), 'utf8'), context);
  const calculator = path.join(ROOT, 'js/combat-power.js');
  vm.runInContext(fs.readFileSync(calculator, 'utf8'), context);
  context.data = structuredClone(data);
  vm.runInContext(`
    categoriesJson = normalizeCategoryJson(data.categories);
    itemsJson = normalizeItemJson(data.items);
    factionsJson = normalizeFactionJson(data.factions);
    characterJson = normalizeCombatJson(data.characters, [], 'name');
    globalThis.characters = characterJson;
    globalThis.items = itemsJson;
    globalThis.abilityKeys = ABILITY_ROWS.map(([,key]) => key);
  `, context);
  return context;
};
