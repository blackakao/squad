// Composition-only evaluation. No DOM, battle tick, or persisted character mutation.
let synergiesJson = [];
let activeBattleSynergies = {player: [], enemy: []};

function getSynergyStatDefs() {
  return [...CHARACTER_STAT_DEFS, ...ABILITY_ROWS.map(([label, key]) => ({key, label}))];
}

function getSynergyConditionOptions(type) {
  // Factions currently use canonical strings as keys, not icon display labels.
  return type === 'faction' ? factionsJson.map(key => ({key, label:key}))
    : type === 'role' ? ROLES.map(key => ({key, label:getRoleLabel(key)})) : [];
}

function validateSynergies(rows) {
  if (!Array.isArray(rows)) throw new Error('시너지 목록은 배열이어야 합니다.');
  const ids = new Set(), stats = new Set(getSynergyStatDefs().map(s => s.key));
  for (const row of rows) {
    if (!row || typeof row.id !== 'string' || !row.id.trim() || ids.has(row.id)) throw new Error('시너지 ID가 비어 있거나 중복됩니다.');
    ids.add(row.id);
    if (typeof row.name !== 'string' || !row.name.trim()) throw new Error('시너지 이름을 입력해주세요.');
    if (!getSynergyConditionOptions(row.condition?.type).some(o => o.key === row.condition.value)) throw new Error(`${row.name}: 조건 대상이 존재하지 않습니다.`);
    if (!['highest', 'cumulative'].includes(row.stacking)) throw new Error('단계 적용 방식을 선택해주세요.');
    if (!Array.isArray(row.thresholds) || !row.thresholds.length) throw new Error('단계를 추가해주세요.');
    const counts = new Set();
    for (const tier of row.thresholds) {
      if (!Number.isInteger(tier.count) || tier.count <= 0 || counts.has(tier.count)) throw new Error('필요 인원은 중복되지 않는 양의 정수여야 합니다.');
      counts.add(tier.count);
      if (!Array.isArray(tier.effects) || !tier.effects.length) throw new Error('효과를 추가해주세요.');
      for (const effect of tier.effects) {
        if (effect.type !== 'stat' || !stats.has(effect.stat) || !Number.isFinite(effect.value)
          || !['team', 'matching'].includes(effect.target)) throw new Error('스탯·효과 값·적용 대상을 확인해주세요.');
      }
    }
  }
  return rows;
}

function evaluateSynergies(members, definitions = synergiesJson) {
  const roster = members.filter(c => c && !c.isSummon);
  const modifiers = roster.map(() => ({})), sources = roster.map(() => []);
  const states = definitions.map(definition => {
    let error = '';
    try { validateSynergies([definition]); } catch (e) { error = e.message; }
    if (definitions.filter(row => row?.id === definition?.id).length > 1) error = '중복 시너지 ID';
    if (error) return {definition, count:0, active:[], error};
    const matching = roster.map(c => c[definition.condition.type] === definition.condition.value);
    const count = matching.filter(Boolean).length;
    const eligible = definition.thresholds.filter(t => count >= t.count).sort((a,b) => a.count-b.count);
    const active = definition.stacking === 'highest' ? eligible.slice(-1) : eligible;
    for (const tier of active) for (const effect of tier.effects) roster.forEach((_, i) => {
      if (effect.target === 'matching' && !matching[i]) return;
      modifiers[i][effect.stat] = (modifiers[i][effect.stat] || 0) + effect.value;
      sources[i].push({sourceType:'synergy', id:definition.id, name:definition.name, count:tier.count, ...effect});
    });
    return {definition, count, active, error};
  });
  return {roster, modifiers, sources, states};
}

async function loadSynergyJson() {
  // Fail closed on transport errors without replacing saved definitions on later save.
  const response = await fetch(API_URLS.synergies, {cache:'no-store'});
  if (!response.ok) throw new Error(`시너지 조회 실패: HTTP ${response.status}`);
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error('시너지 목록 형식 오류');
  synergiesJson = rows;
}

function snapshotBattleSynergies() {
  activeBattleSynergies = Object.fromEntries([['player', playerSquad], ['enemy', enemySquad]].map(([side, units]) => {
    const ids = new Set();
    const active = units.filter(u => !u.isSummon).flatMap(u => u.synergySources || []).filter(source => {
      const key = `${source.id}:${source.count}`;
      if (ids.has(key)) return false;
      ids.add(key); return true;
    }).map(({id, name, count}) => ({id, name, count}));
    return [side, active];
  }));
}
