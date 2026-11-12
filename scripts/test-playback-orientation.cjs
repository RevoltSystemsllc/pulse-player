const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
let checks = 0;
const expect = (a, b) => { assert.deepEqual(a, b); checks++; };
function load(file, dependencies = {}) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, {compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  }}).outputText, {exports, require: name => {
    if (name in dependencies) return dependencies[name];
    throw Error(`Unexpected import ${name}`);
  }, console: {log() {}, debug() {}, error() {}}});
  return exports;
}
const policy = load('src/shared/playbackOrientation.ts');
for (const [mode, degrees] of Object.entries({landscape: 0, portrait: 90, reverse_landscape: 180, reverse_portrait: 270})) {
  expect(policy.playbackOrientation(mode), mode);
  for (const [width, height] of [[1920,1080], [1080,1920], [2160,1920]]) {
    const r = policy.playbackViewport(mode, width, height);
    expect(r.degrees, degrees);
    expect(r.width, degrees % 180 ? height : width);
    expect(r.height, degrees % 180 ? width : height);
  }
}
for (const bad of [undefined, null, 90, true, {}, [], 'Portrait', 'portrait ', 'rotate(90deg)', '__proto__']) {
  expect(policy.playbackOrientation(bad), 'landscape');
}
for (const bad of [0, -1, 1.5, NaN, Infinity, 32769, '1920']) {
  assert.throws(() => policy.playbackViewport('portrait', bad, 1080)); checks++;
}
const config = load('src/main/config/config.ts', {
  'fs/promises': {}, path: require('node:path'), os: {}, 'node-machine-id': {}, crypto: require('node:crypto'),
  '../common/paths': {}, '../../shared/playbackOrientation': policy,
});
(async () => {
  const response = load('src/main/xmds/response/registerDisplay.ts', {
    xml2js: require('xml2js'), '../../../shared/command/commandManager': {},
  });
  for (const mode of ['landscape', 'portrait', 'reverse_landscape', 'reverse_portrait']) {
    const inner = `<display status="0"><PulseOrientation type="string">${mode}</PulseOrientation></display>`;
    const encoded = inner.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const soap = `<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="urn:xmds" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><SOAP-ENV:Body><ns1:RegisterDisplayResponse><ActivationMessage xsi:type="xsd:string">${encoded}</ActivationMessage></ns1:RegisterDisplayResponse></SOAP-ENV:Body></SOAP-ENV:Envelope>`;
    const registered = new response.RegisterDisplay(soap);
    await registered.parse();
    expect(registered.getSetting('pulseOrientation', 'landscape'), mode);
    const mock = {settings: {}, state: {}, saveCms: async () => { mock.saved = true; }};
    await config.Config.prototype.setConfig.call(mock, registered);
    expect(mock.settings.pulseOrientation, mode);
  }
  for (const raw of ['portrait', 'reverse_landscape', 'reverse_portrait', 'landscape', undefined, 'bad']) {
    const mock = {settings: {}, state: {}, saveCms: async () => { mock.saved = true; }};
    await config.Config.prototype.setConfig.call(mock, {getSetting: (name, fallback) =>
      name === 'pulseOrientation' ? (raw ?? fallback) : fallback, getTags: () => ({})});
    expect(mock.settings.pulseOrientation, policy.playbackOrientation(raw));
    expect(mock.saved, true);
  }
  const main = fs.readFileSync(path.join(root, 'src/main/index.ts'), 'utf8');
  assert.ok(main.includes("win.webContents.send('update-playback-orientation'")); checks++;
  assert.ok(main.indexOf('appConfig = JSON.parse(config.toJson());', main.indexOf('const prevOrientation')) <
    main.indexOf("win.webContents.send('update-playback-orientation'")); checks++;
  console.log(JSON.stringify({passed: true, checks, scope: 'Orientation policy, persisted settings and IPC wiring; no device changes'}));
})().catch(error => { console.error(error); process.exitCode = 1; });
