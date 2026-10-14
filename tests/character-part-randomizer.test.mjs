import test from 'node:test';
import assert from 'node:assert/strict';
import { createRandomPartPlan } from '../js/character-viewer/part-randomizer.js';

const file = name => ({ path: `${name}.glb`, displayName: name });

test('empty and single-file categories are safe', () => {
  const plan = createRandomPartPlan([
    { id: 'empty', files: [], allowNone: false },
    { id: 'single', files: [file('only')], allowNone: false },
  ], {}, () => 0.8);
  assert.equal(plan.empty, null);
  assert.equal(plan.single.path, 'only.glb');
});

test('catalog files are used and the current item changes when possible', () => {
  const categories = [{ id: 'hair', files: [file('a'), file('b'), file('c')], allowNone: false }];
  const plan = createRandomPartPlan(categories, { hair: 'a.glb' }, () => 0);
  assert.equal(plan.hair.path, 'b.glb');
  assert.ok(categories[0].files.includes(plan.hair));
});

test('allowNone is registry-driven', () => {
  const optional = createRandomPartPlan([{ id: 'accessory', files: [file('hat')], randomAllowNone: true }], { accessory: 'hat.glb' }, () => 0);
  const required = createRandomPartPlan([{ id: 'eyes', files: [file('eyes')], allowNone: false }], {}, () => 0);
  assert.equal(optional.accessory, null);
  assert.equal(required.eyes.path, 'eyes.glb');
});

test('male and female prefixes are restricted to the matching base gender', () => {
  const categories = [{ id: 'hair', files: [file('female_hair'), file('male_hair'), file('common_hair')] }];
  assert.equal(createRandomPartPlan(categories, {}, () => 0, 'male').hair.path, 'male_hair.glb');
  assert.equal(createRandomPartPlan(categories, {}, () => 0, 'female').hair.path, 'female_hair.glb');
  assert.equal(createRandomPartPlan(categories, {}, () => 0.999, 'male').hair.path, 'common_hair.glb');
  assert.equal(createRandomPartPlan(categories, {}, () => 0.999, 'female').hair.path, 'common_hair.glb');
});
