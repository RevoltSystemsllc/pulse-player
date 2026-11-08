const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const silent = {debug() {}, error() {}};
let checks = 0;
function expect(value, expected) {
  assert.deepEqual(value, expected);
  checks++;
}
function image(width, height, empty = false) {
  return {
    isEmpty: () => empty,
    getSize: () => ({width, height}),
    resize: (size) => size.width
      ? image(size.width, Math.round(height * size.width / width))
      : image(Math.round(width * size.height / height), size.height),
    toPNG: () => Buffer.from(`${width}x${height}`),
  };
}
function load(relative, requireMock) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
  }).outputText;
  const exports = {};
  vm.runInNewContext(js, {exports, require: requireMock, console: silent, Buffer});
  return exports;
}
const text = (value) => value === null ? null : Buffer.from(value, 'base64').toString();

async function main() {
  let desktopCalls = 0;
  let directoryCalls = 0;
  let session = 'windows';
  const capture = load('src/shared/utils/desktopCapture.ts', (name) => {
    if (name === 'electron') return {
      screen: {getPrimaryDisplay: () => ({size: {width: 1080, height: 1920}, scaleFactor: 1})},
      desktopCapturer: {getSources: async () => {
        desktopCalls++;
        return [{thumbnail: image(1080, 1920)}];
      }},
    };
    if (name === './displayEnvironment') return {
      getSessionType: () => session,
      describeDisplayEnvironment: () => ({}),
    };
    if (name === './screenshotDirectory') return {
      captureFromScreenshotDir: async () => {
        directoryCalls++;
        return 'wayland-file';
      },
    };
    throw new Error(`Unexpected import: ${name}`);
  });
  let pageCalls = 0;
  const window = {
    isDestroyed: () => false,
    webContents: {capturePage: async () => { pageCalls++; return image(2160, 1920); }},
  };
  const target = {kind: 'window', window};
  expect(text(await capture.captureDesktop(0, undefined, target)), '2160x1920');
  expect(pageCalls, 1);
  expect(desktopCalls, 0);
  expect(text(await capture.captureDesktop(200, undefined, target)), '200x178');
  expect(text(await capture.captureDesktop(4096, undefined, target)), '2160x1920');
  const portrait = {kind: 'window', window: {
    isDestroyed: () => false,
    webContents: {capturePage: async () => image(1080, 1920)},
  }};
  expect(text(await capture.captureDesktop(100, undefined, portrait)), '56x100');
  expect(await capture.captureDesktop(0, undefined, {kind: 'window', window: undefined}), null);
  expect(await capture.captureDesktop(0, undefined, {kind: 'window', window: {
    isDestroyed: () => true,
  }}), null);
  expect(await capture.captureDesktop(0, undefined, {kind: 'window', window: {
    isDestroyed: () => false,
    webContents: {capturePage: async () => image(0, 0, true)},
  }}), null);
  expect(desktopCalls, 0);
  expect(await capture.captureDesktop(0, undefined, {kind: 'window', window: {
    isDestroyed: () => false,
    webContents: {capturePage: async () => { throw new Error('capture failed'); }},
  }}), null);
  expect(text(await capture.captureDesktop(0, undefined, target)), '2160x1920');

  let finish;
  const pending = capture.captureDesktop(0, undefined, {kind: 'window', window: {
    isDestroyed: () => false,
    webContents: {capturePage: () => new Promise((resolve) => {finish = resolve;})},
  }});
  expect(await capture.captureDesktop(0, undefined, target), null);
  finish(image(2160, 1920));
  expect(text(await pending), '2160x1920');
  expect(text(await capture.captureDesktop(0)), '1080x1920');
  expect(text(await capture.captureDesktop(500)), '281x500');
  session = 'wayland';
  expect(await capture.captureDesktop(500), 'wayland-file');
  expect(directoryCalls, 1);

  let forwarded;
  let uploaded;
  const util = load('src/shared/utils/xmdsUtil.ts', (name) => {
    if (name === './desktopCapture') return {
      captureDesktop: async (...args) => {forwarded = args; return 'wall-image';},
    };
    throw new Error(`Unexpected import: ${name}`);
  });
  const faults = {};
  await util.xmdsMakeScreenshot({screenshot: async (bytes) => {uploaded = bytes;}}, 300, faults, target);
  expect(forwarded[0], 300);
  expect(forwarded[1], faults);
  expect(forwarded[2], target);
  expect(uploaded, 'wall-image');

  const config = require('../installer/windows/msi-config.cjs');
  const pkg = require('../package.json');
  expect(config.EXECUTABLE_NAME, `${pkg.productName}.exe`);
  const wxs = fs.readFileSync(path.join(root, 'installer/windows/xibo-player.wxs'), 'utf8');
  expect((wxs.match(/Target="\[INSTALLFOLDER\]\$\(var.ExecutableName\)"/g) || []).length, 2);
  const maker = fs.readFileSync(path.join(root, 'installer/windows/MakerMsi.cjs'), 'utf8');
  expect(maker.includes('ExecutableName=${EXECUTABLE_NAME}'), true);
  expect(maker.includes('fs.existsSync(path.join(dir, EXECUTABLE_NAME))'), true);
  const index = fs.readFileSync(path.join(root, 'src/main/index.ts'), 'utf8');
  expect(index.includes("config.videoWallMode === 'span-all' && process.platform === 'win32'"), true);
  expect((index.match(/await makePlayerScreenshot\(xmds\)/g) || []).length, 2);
  console.log(JSON.stringify({passed: true, checks}));
}
main().catch((error) => {console.error(error); process.exitCode = 1;});
