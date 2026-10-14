function pickIndex(length, random) {
  const value = Number(random());
  const normalized = Number.isFinite(value) ? Math.min(0.999999999, Math.max(0, value)) : 0;
  return Math.floor(normalized * length);
}

function fileGender(file) {
  const name = String(file?.name || file?.displayName || file?.path?.split('/').pop() || '').toLowerCase();
  if (name.startsWith('female')) return 'female';
  if (name.startsWith('male')) return 'male';
  return null;
}

export function createRandomPartPlan(categories, currentSelections = {}, random = Math.random, gender = null) {
  const plan = {};
  for (const category of categories || []) {
    const files = Array.isArray(category.files)
      ? category.files.filter(file => file?.path && (!gender || !fileGender(file) || fileGender(file) === gender))
      : [];
    const candidates = (category.randomAllowNone ?? category.allowNone) ? [null, ...files] : files;
    if (!candidates.length) {
      plan[category.id] = null;
      continue;
    }
    const current = currentSelections[category.id] || null;
    const alternatives = candidates.filter(file => (file?.path || null) !== current);
    const pool = alternatives.length ? alternatives : candidates;
    plan[category.id] = pool[pickIndex(pool.length, random)] || null;
  }
  return plan;
}
