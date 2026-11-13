const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/main/common/windowPresentation.ts'), 'utf8');
const exportsObject = {};
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  reportDiagnostics: true,
});
assert.equal(compiled.diagnostics.length, 0);
vm.runInNewContext(compiled.outputText, { exports: exportsObject });
let checks = 1;
for (const platform of ['win32', 'darwin', 'linux']) {
  for (const mode of ['span-all', 'single', undefined]) {
    for (const count of [0, 1, 2, 10]) {
      const result = exportsObject.wallPresentation(platform, mode, count);
      assert.equal(result.alwaysOnTop, platform === 'win32' && mode === 'span-all' && count > 1);
      assert.equal(result.thickFrame, platform === 'win32' ? false : undefined);
      assert.equal(result.roundedCorners, platform === 'win32' ? false : undefined);
      checks += 3;
    }
  }
}
for (const value of ['', '{', 'null', '[]', 'true', '{}', '{"softwareRendering":"true"}', '{"softwareRendering":false}']) {
  assert.equal(exportsObject.softwareRenderingRequested('win32', value), false);
  checks++;
}
for (const platform of ['win32', 'darwin', 'linux']) {
  assert.equal(exportsObject.softwareRenderingRequested(platform, '{"softwareRendering":true}'), platform === 'win32');
  checks++;
}
const main = fs.readFileSync(path.join(root, 'src/main/index.ts'), 'utf8');
assert(main.indexOf('app.disableHardwareAcceleration()') < main.indexOf('app.requestSingleInstanceLock()'));
assert(main.includes("readFileSync(join(app.getPath('userData'), 'rendering-preferences.json'), 'utf8')"));
assert(main.includes('win.setAlwaysOnTop(wallPresentation('));
assert(main.includes('...wallPresentation(process.platform, config.videoWallMode, screen.getAllDisplays().length)'));
checks += 4;
const diagnostics = ts.transpileModule(main, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  reportDiagnostics: true,
}).diagnostics;
assert.equal(diagnostics.length, 0);
checks++;
const geometrySource = main.slice(main.indexOf('type WindowGeometry ='), main.indexOf('let hasSavedGeometry ='));
assert(geometrySource.includes('const applyWindowGeometry'));
let displays = [];
const config = { videoWallMode: 'span-all', settings: { sizeX: 1440, sizeY: 1280 } };
const state = {};
const context = {
  config, state, process: { platform: 'win32' },
  screen: { getAllDisplays: () => displays, getDisplayMatching: () => ({size: {width: 1080, height: 1920}}) },
  wallPresentation: exportsObject.wallPresentation,
  console: {info() {}, warn() {}, debug() {}},
};
vm.runInNewContext(ts.transpileModule(geometrySource + '\nglobalThis.apply = applyWindowGeometry;', {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText, context);
function windowMock(fullscreen = false, maximized = false) {
  return {
    calls: [], handlers: {},
    setAlwaysOnTop(value) { this.calls.push(['top', value]); },
    setBounds(bounds) { this.calls.push(['bounds', JSON.parse(JSON.stringify(bounds))]); },
    isFullScreen: () => fullscreen, isMaximized: () => maximized,
    once(event, handler) { this.handlers[event] = handler; },
    setFullScreen(value) { this.calls.push(['fullscreen', value]); },
    unmaximize() { this.calls.push(['unmaximize']); },
    getBounds() { return {}; },
  };
}
for (const count of [2, 3, 5, 10]) {
  displays = Array.from({length: count}, (_, index) => ({bounds: {x: index * 720, y: 0, width: 720, height: 1280}}));
  const win = windowMock();
  context.apply(win);
  assert.deepEqual(win.calls, [['top', true], ['bounds', {x: 0, y: 0, width: count * 720, height: 1280}]]);
  assert.equal(state.width, count * 720);
  assert.equal(state.height, 1280);
  checks += 3;
}
displays = [{bounds: {x: -720, y: 0, width: 720, height: 1280}}, {bounds: {x: 0, y: 0, width: 720, height: 1280}}];
for (const [fullscreen, maximized, event] of [[true, false, 'leave-full-screen'], [false, true, 'unmaximize']]) {
  const win = windowMock(fullscreen, maximized);
  context.apply(win);
  assert.equal(win.calls.some(call => call[0] === 'bounds'), false);
  win.handlers[event]();
  assert.deepEqual(win.calls.at(-1), ['bounds', {x: -720, y: 0, width: 1440, height: 1280}]);
  checks += 2;
}
displays = [{bounds: {x: 0, y: 0, width: 720, height: 1280}}];
const one = windowMock(); context.apply(one);
assert.deepEqual(one.calls, [['top', false], ['bounds', {x: 0, y: 0, width: 1440, height: 1280}]]);
checks++;
config.settings = {sizeX: 0, sizeY: 0};
const fullscreen = windowMock(); context.apply(fullscreen);
assert.deepEqual(fullscreen.calls, [['top', false], ['fullscreen', true]]);
assert.equal(state.width, 1080); assert.equal(state.height, 1920);
checks += 3;
console.log(JSON.stringify({ passed: true, checks, fullBuild: false, installed: false }));
