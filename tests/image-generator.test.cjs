const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function setup(provider = 'puter', model = '') {
  const fields = new Map(Object.entries({ imageProvider: provider, imageModel: model,
    imagePrompt: 'test portrait', imageStylePrompt: '' }).map(([id, value]) => [id, { value }]));
  for (const id of ['imageGeneratorStatus', 'imageGenerateButton', 'imageSaveButton', 'generatedImagePath']) fields.set(id, {});
  const requests = [];
  const context = vm.createContext({
    document: { getElementById: id => fields.get(id) },
    window: { puter: { ai: { txt2img: async (prompt, options) => {
      requests.push({ prompt, options });
      return { src: 'data:image/png;base64,dGVzdA==' };
    } } } },
    fetch: async () => ({ ok: true }), logError() {}
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/image-generator.js'), 'utf8'), context);
  return { context, requests, fields };
}

function librarySetup() {
  const state = setup();
  for (const id of ['savedImageStyle', 'imageStyleName', 'imageStylePreset', 'imageStyleLibraryStatus', 'imageStyleCreate', 'imageStyleLoad', 'imageStyleUpdate', 'imageStyleDelete', 'imageStyleRefresh']) {
    state.fields.set(id, { value: '', replaceChildren() {}, add() {} });
  }
  state.context.Option = function(text, value) { this.text = text; this.value = value; };
  state.context.crypto = require('node:crypto').webcrypto;
  state.context.window.confirm = () => true;
  let stored = [];
  state.context.fetch = async (url, options) => {
    if (options?.method === 'PUT') stored = JSON.parse(options.body);
    return { ok: true, json: async () => structuredClone(stored), text: async () => '{"ok":true}' };
  };
  state.stored = () => stored;
  return state;
}

test('style library creates multiple entries, reloads, renames, loads and deletes', async () => {
  const { context: c, fields: f, stored } = librarySetup();
  await c.loadImageStyleLibrary();
  for (const name of ['수채화', '아이콘']) {
    f.get('imageStyleName').value = name;
    f.get('imageStylePrompt').value = `${name} style`;
    await c.saveNamedImageStyle();
  }
  assert.equal(stored().length, 2);
  f.get('savedImageStyle').value = stored()[0].id;
  c.loadNamedImageStyle();
  assert.equal(f.get('imageStylePrompt').value, '수채화 style');
  assert.equal(f.get('imageStylePreset').value, 'custom');
  f.get('imageStyleName').value = '수정 이름';
  f.get('imageStylePrompt').value = '수정 내용';
  await c.saveNamedImageStyle(true);
  await c.loadImageStyleLibrary();
  c.loadNamedImageStyle();
  assert.equal(f.get('imageStyleName').value, '수정 이름');
  assert.equal(stored()[0].stylePrompt, '수정 내용');
  await c.deleteNamedImageStyle();
  assert.equal(stored().length, 1);
  assert.equal(stored()[0].name, '아이콘');
  assert.equal(f.get('imageStylePrompt').value, '수정 내용');
});

test('style validation, cancelled delete and failed writes preserve saved entries', async () => {
  const { context: c, fields: f, stored } = librarySetup();
  await c.loadImageStyleLibrary();
  await c.saveNamedImageStyle();
  assert.equal(stored().length, 0);
  f.get('imageStyleName').value = 'test';
  f.get('imageStylePrompt').value = 'original';
  await c.saveNamedImageStyle();
  await c.saveNamedImageStyle();
  assert.equal(stored().length, 1);
  c.window.confirm = () => false;
  await c.deleteNamedImageStyle();
  assert.equal(stored().length, 1);
  c.fetch = async () => { throw new Error('offline'); };
  f.get('imageStylePrompt').value = 'edited';
  await c.saveNamedImageStyle(true);
  assert.equal(f.get('imageStylePrompt').value, 'edited');
  assert.equal(stored()[0].stylePrompt, 'original');
  c.loadNamedImageStyle();
  assert.equal(f.get('imageStylePrompt').value, 'original');
  await c.loadImageStyleLibrary();
  assert.equal(f.get('imageStyleCreate').disabled, true);
  await c.saveNamedImageStyle();
  assert.equal(stored().length, 1);
});

test('empty Puter model uses supported default without forcing a provider', async () => {
  const { context, requests, fields } = setup();
  await context.generateImageFromPrompt({ preventDefault() {} });
  assert.equal(requests[0].options.model, 'gpt-image-2');
  assert.equal(requests[0].options.provider, undefined);
  assert.equal(fields.get('imageSaveButton').disabled, false);
});

test('blank prompt shows validation without generating; failed retry preserves preview', async () => {
  const { context: c, fields, requests } = setup();
  fields.get('imagePrompt').value = '   ';
  await c.generateImageFromPrompt({ preventDefault() {} });
  assert.equal(requests.length, 0);
  assert.equal(fields.get('imageGeneratorStatus').textContent, '제시어를 입력하세요.');
  c.setGeneratedImage('data:image/png;base64,dGVzdA==', '');
  fields.get('imagePrompt').value = 'retry';
  c.window.puter.ai.txt2img = async () => { throw new Error('offline'); };
  await c.generateImageFromPrompt({ preventDefault() {} });
  assert.equal(fields.get('imageSaveButton').disabled, false);
});

test('save uses entered Unicode name on the first call and blocks repeated clicks', async () => {
  const { context: c, fields } = setup();
  fields.set('imageAssetName', {value:'숲의 기사'});
  c.setGeneratedImage('data:image/png;base64,dGVzdA==', '');
  let calls = 0;
  let finish;
  c.uploadImageAsset = (kind, data, name) => {
    calls++;
    assert.equal(name, '숲의 기사');
    return new Promise(resolve => { finish = resolve; });
  };
  const pending = c.saveGeneratedImage();
  await c.saveGeneratedImage();
  assert.equal(calls, 1);
  finish('assets/images/generated/숲의 기사.png');
  await pending;
  assert.equal(fields.get('generatedImagePath').textContent, 'assets/images/generated/숲의 기사.png');
});

test('explicit models remain unchanged and nested provider errors are displayed', async () => {
  const { context, requests, fields } = setup('puter', 'gemini-3.1-flash-image');
  await context.generateImageFromPrompt({ preventDefault() {} });
  assert.equal(requests[0].options.model, 'gemini-3.1-flash-image');
  context.window.puter.ai.txt2img = async () => { throw { error: { message: 'Model not found' } }; };
  await context.generateImageFromPrompt({ preventDefault() {} });
  assert.equal(fields.get('imageGeneratorStatus').textContent, '생성 실패: Model not found');
  assert.equal(fields.get('imageGenerateButton').disabled, false);
});

test('non-Puter generation does not call Puter usage or authentication', async () => {
  const { context } = setup('pollinations');
  context.fetch = async () => ({ ok: true, text: async () => JSON.stringify({ dataUrl: 'data:image/png;base64,dGVzdA==' }) });
  context.refreshPuterUsage = () => { assert.fail('unrelated Puter API called'); };
  await context.generateImageFromPrompt({ preventDefault() {} });
});

test('HTML server errors show recovery instructions and release the generate button', async () => {
  const { context, fields } = setup('huggingface');
  context.fetch = async () => ({ ok: false, text: async () => '<html>error</html>', headers: { get: () => 'text/html' } });
  await context.generateImageFromPrompt({ preventDefault() {} });
  assert.match(fields.get('imageGeneratorStatus').textContent, /서버를 최신 코드로 재시작/);
  assert.equal(fields.get('imageGenerateButton').disabled, false);
});
