const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function context() {
  const ctx = vm.createContext({
    document: { addEventListener() {} },
    escapeHtml: value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
    logError() {}
  });
  for (const name of ['icon-background', 'icons']) vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, `../js/${name}.js`), 'utf8'), ctx);
  return ctx;
}
test('mapping matches group and key, escapes labels, and preserves unmapped text', () => {
  const c = context();
  vm.runInContext('iconMappings = [{group:"role", key:"special", label:"<custom>", icon:"assets/images/icons/test.png"}]', c);
  assert.match(c.renderCategoryIcon('role', 'special', 'Original'), /<img.*alt="&lt;custom&gt;"/);
  assert.doesNotMatch(c.renderCategoryIcon('slot', 'special', 'Other'), /<img/);
  assert.match(c.renderCategoryIcon('slot', 'special', '<Other>'), /&lt;Other&gt;/);
});

function fixture(width, height, color = [255, 255, 255, 255]) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) pixels.set(color, i * 4);
  return pixels;
}
test('white border is removed while enclosed white detail and dark outline survive', () => {
  const c = context(), pixels = fixture(9, 9);
  for (let y = 2; y < 7; y++) for (let x = 2; x < 7; x++) pixels.set([20, 40, 80, 255], (y * 9 + x) * 4);
  pixels.set([255, 255, 255, 255], (4 * 9 + 4) * 4);
  assert.equal(c.removeIconBackgroundPixels(pixels, 9, 9), true);
  assert.equal(pixels[3], 0);
  assert.equal(pixels[(4 * 9 + 4) * 4 + 3], 255);
  assert.equal(pixels[(2 * 9 + 2) * 4 + 3], 255);
});
test('colored background shadows are removed without deleting a blue subject', () => {
  const c = context(), pixels = fixture(9, 9, [180, 115, 10, 255]);
  for (let y = 2; y < 7; y++) for (let x = 2; x < 7; x++) pixels.set([20, 40, 80, 255], (y * 9 + x) * 4);
  pixels.set([108, 69, 6, 255], (4 * 9 + 1) * 4);
  c.removeIconBackgroundPixels(pixels, 9, 9);
  assert.equal(pixels[(4 * 9 + 1) * 4 + 3], 0);
  assert.equal(pixels[(4 * 9 + 4) * 4 + 3], 255);
});
test('existing transparency and featureless swatches remain unchanged', () => {
  const c = context(), transparent = fixture(5, 5);
  transparent[3] = 0; transparent[7] = 128;
  const original = transparent.slice();
  assert.equal(c.removeIconBackgroundPixels(transparent, 5, 5), false);
  assert.deepEqual(transparent, original);
  const flat = fixture(5, 5);
  assert.equal(c.removeIconBackgroundPixels(flat, 5, 5), false);
  assert.equal(flat[3], 255);
});
test('strength is bounded and opt-out is preserved in rendered markup', () => {
  const c = context();
  assert.equal(c.normalizeIconTolerance(undefined), 48);
  assert.equal(c.normalizeIconTolerance('invalid'), 48);
  assert.equal(c.normalizeIconTolerance(-5), 8);
  assert.equal(c.normalizeIconTolerance(1000), 100);
  vm.runInContext('iconMappings = [{group:"role", key:"tank", icon:"assets/images/icons/test.png", removeBackground:false}]', c);
  assert.doesNotMatch(c.renderCategoryIcon('role', 'tank', 'Tank'), /data-icon-background/);
  vm.runInContext('iconMappings[0].removeBackground = true', c);
  assert.match(c.renderCategoryIcon('role', 'tank', 'Tank'), /data-icon-background="48"/);
});
test('icon paths reject traversal, remote URLs, and executable schemes', () => {
  const c = context();
  for (const path of ['javascript:alert(1)', '//host/x.png', 'https://host/x.png', 'assets/images/icons/../x.png', 'assets/images/icons/a.svg', 'assets/images/icons/a.png?x', 'assets/images/icons/a\\b.png']) assert.equal(c.safeCategoryIcon(path), '');
  assert.equal(c.safeCategoryIcon('assets/images/icons/test.png'), 'assets/images/icons/test.png');
});
test('failed load keeps saving disabled; successful retry enables it', async () => {
  const c = context();
  c.fetch = async () => ({ok:false, status:500});
  await c.loadIconMappings();
  assert.equal(vm.runInContext('iconMappingsReady', c), false);
  c.fetch = async () => ({ok:true, json:async () => []});
  await c.loadIconMappings();
  assert.equal(vm.runInContext('iconMappingsReady', c), true);
});
