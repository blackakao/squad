// Stat-based comparison only. Calibration and exclusions: docs/balance/COMBAT_POWER.md.
const COMBAT_POWER_CONFIG = Object.freeze({
  version: 'stat-v1', scale: 1000,
  weights: Object.freeze({durability: 0.45, offense: 0.45, mobility: 0.05, range: 0.05}),
  reference: Object.freeze({hp: 3000, mitigation: 15, power: 100, interval: 2, speed: 1.5, range: 3}),
  physicalShare: 0.5, secondaryPower: 0.25, mitigationCap: 95,
  minInterval: 0.1, maxInput: 1e9
});

function calculateCombatPower(finalStats = {}) {
  const config = COMBAT_POWER_CONFIG;
  const stats = finalStats && typeof finalStats === 'object' ? finalStats : {};
  const number = (key, fallback = 0) => {
    const raw = stats[key];
    const value = typeof raw === 'number' || typeof raw === 'string' ? Number(raw) : NaN;
    return Number.isFinite(value) ? Math.max(0, Math.min(config.maxInput, value)) : fallback;
  };
  const hp = number('hp');
  const defense = Math.min(config.mitigationCap, number('defense')) / 100;
  const resistance = Math.min(config.mitigationCap, number('resistance')) / 100;
  // Equal incoming physical/magic mix; cap prevents infinite EHP at immunity.
  const received = config.physicalShare * (1 - defense) + (1 - config.physicalShare) * (1 - resistance);
  const effectiveHp = hp / received;
  const atk = number('atk'), magic = number('magic');
  // Potential, not skill DPS: discount the weaker channel instead of counting both equally.
  const power = Math.max(atk, magic) + config.secondaryPower * Math.min(atk, magic);
  const interval = Math.max(config.minInterval, number('attackSpeed', config.reference.interval), number('castSpeed'));
  const normalized = {
    durability: Math.sqrt(effectiveHp / (config.reference.hp / (1 - config.reference.mitigation / 100))),
    offense: Math.sqrt((power / config.reference.power) * (config.reference.interval / interval)),
    mobility: Math.log1p(number('speed')) / Math.log1p(config.reference.speed),
    range: Math.log1p(number('attackRange')) / Math.log1p(config.reference.range)
  };
  const contributions = Object.fromEntries(Object.entries(normalized).map(([key, value]) =>
    [key, config.scale * config.weights[key] * value]));
  const rawTotal = Object.values(contributions).reduce((sum, value) => sum + value, 0);
  return {version: config.version, total: Math.round(rawTotal), rawTotal, contributions,
    metrics: {effectiveHp, power, interval}, normalized};
}

// Reuse the game's build calculator. Never feed combat HP/effects or team modifiers here.
function getCharacterCombatPower(character = {}) {
  const finalStats = applyCharacterStatAbilities({...character, runtimeSynergyModifiers: {}});
  return {...calculateCombatPower(finalStats), finalStats};
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {calculateCombatPower, COMBAT_POWER_CONFIG};
}
