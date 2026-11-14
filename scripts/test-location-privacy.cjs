const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
let checks = 0;
const equal = (a, b) => { assert.deepEqual(a, b); checks++; };
function load(file, deps = {}, globals = {}) {
  const exports = {};
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, reportDiagnostics: true });
  equal(compiled.diagnostics.length, 0);
  vm.runInNewContext(compiled.outputText, {
    exports, require: name => name in deps ? deps[name] : require(name),
    console: { debug() {}, warn() {}, log() {} }, AbortController, Buffer,
    setInterval, clearInterval, process, ...globals,
  });
  return exports;
}
(async () => {
 const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pulse-location-'));
 try {
  const {LocationPrivacy} = load('src/main/common/locationPrivacy.ts');
  const file = path.join(directory, 'nested', 'location-privacy.json');
  let preference = new LocationPrivacy(file);
  equal(preference.getEnabled(), false);
  preference.setEnabled(true);
  equal(preference.getEnabled(), true);
  equal(new LocationPrivacy(file).getEnabled(), true);
  for (const bad of [null, 1, 'true', {}, undefined]) { assert.throws(() => preference.setEnabled(bad)); checks++; }
  preference.setEnabled(false);
  equal(new LocationPrivacy(file).getEnabled(), false);
  for (const bad of ['broken', 'null', '{"deviceLocationEnabled":"true"}', '{}']) {
   fs.writeFileSync(file, bad);
   equal(new LocationPrivacy(file).getEnabled(), false);
  }
  const denied = new LocationPrivacy(directory);
  assert.throws(() => denied.setEnabled(true)); checks++;
  equal(denied.getEnabled(), false);
  const {GeoLocationManager} = load('src/main/common/geoLocationManager.ts', {
   nanoevents: {createNanoEvents: () => {
    const callbacks = {};
    return {on: (name, callback) => {callbacks[name] = callback;}, emit: name => callbacks[name]?.()};
   }},
  });
  const manager = new GeoLocationManager();
  const requests = [];
  manager.fetchLocation = signal => new Promise(resolve => requests.push({signal, resolve}));
  const tick = () => new Promise(resolve => setImmediate(resolve));
  equal(requests.length, 0);
  manager.start(); manager.start();
  equal(requests.length, 1);
  manager.stop();
  equal(requests[0].signal.aborted, true);
  requests[0].resolve({latitude: 42, longitude: -75});
  await tick();
  equal(manager.getCurrentLocation().latitude, null);
  manager.start();
  equal(requests.length, 2);
  requests[1].resolve({latitude: 40, longitude: -74});
  await tick();
  equal(manager.getCurrentLocation().latitude, 40);
  equal(manager.isCurrentLocationInsidePolygon([[-80,30],[-70,30],[-70,50],[-80,50]]), true);
  manager.stop();
  equal(manager.getCurrentLocation().latitude, null);
  equal(manager.isCurrentLocationInsidePolygon([[-80,30],[-70,30],[-70,50],[-80,50]]), false);
  manager.start(); manager.stop(); manager.start();
  requests[2].resolve({latitude: 30, longitude: 30});
  await tick();
  equal(manager.getCurrentLocation().latitude, null);
  requests[3].resolve(null); await tick();
  equal(manager.getCurrentLocation().latitude, null);
  for (const invalid of ['91,0', '0,-181', 'x,y', '1,2,3']) equal(manager.parseCoordinates(invalid), null);
  manager.stop();

  const sent = [];
  let currentLocation = {latitude: null, longitude: null};
  const {default: Ssp} = load('src/main/common/ssp.ts', {
   axios: {default: {get: url => {sent.push(url); return Promise.resolve();}}},
   nanoevents: {}, luxon: {}, '../xmds/response/schedule/sspAd': {},
   './geoLocationManager': {geoLocationManager: {getCurrentLocation: () => currentLocation}},
  });
  const impressionTime = {toUnixInteger: () => 1};
  await Ssp.prototype.reportImpression.call({}, ['https://fixture.invalid/?lat=[LAT]&lng=[LNG]'], 5, impressionTime, 42, -75);
  equal(sent[0], 'https://fixture.invalid/?lat=null&lng=null');
  currentLocation = {latitude: 40, longitude: -74};
  await Ssp.prototype.reportImpression.call({}, ['https://fixture.invalid/?lat=[LAT]&lng=[LNG]'], 5, impressionTime, 42, -75);
  equal(sent[1], 'https://fixture.invalid/?lat=40&lng=-74');

  const main = fs.readFileSync(path.join(root, 'src/main/index.ts'), 'utf8');
  const start = main.indexOf('const configureIpc = (win) => {');
  const end = main.indexOf("  ipcMain.on('open-child-window'", start);
  const ipc = main.slice(start, end) + '\n}; configureIpc(win);';
  const handlers = {}, frame = {url: 'file:///fixtures/renderer/index.html'}, webContents = {mainFrame: frame};
  let running = false;
  preference = new LocationPrivacy(file);
  vm.runInNewContext(ts.transpileModule(ipc, {compilerOptions: {target: ts.ScriptTarget.ES2022}}).outputText, {
   ipcMain: {handle: (name, handler) => {handlers[name] = handler;}},
   __dirname: '/fixtures/main', join: path.join, pathToFileURL: require('node:url').pathToFileURL,
   is: {dev: false}, process: {env: {}},
   win: {webContents}, locationPrivacy: preference,
   geoLocationManager: {start: () => {running = true;}, stop: () => {running = false;}},
  });
  const local = {sender: webContents, senderFrame: frame};
  equal(handlers['get-device-location-enabled'](local), false);
  equal(handlers['set-device-location-enabled'](local, true), true);
  equal(running, true);
  for (const outsider of [{sender: {}, senderFrame: frame}, {sender: webContents, senderFrame: {}}]) {
   assert.throws(() => handlers['set-device-location-enabled'](outsider, true)); checks++;
   assert.throws(() => handlers['get-device-location-enabled'](outsider)); checks++;
  }
  assert.throws(() => handlers['set-device-location-enabled'](local, 'true')); checks++;
  frame.url = 'https://untrusted.example/';
  assert.throws(() => handlers['set-device-location-enabled'](local, true)); checks++;
  frame.url = 'file:///fixtures/renderer/index.html';
  equal(handlers['set-device-location-enabled'](local, false), false);
  equal(running, false);
  assert(main.includes('setPermissionCheckHandler(() => false)')); checks++;
  assert(main.includes('state.latitude = latitude ?? 0;')); checks++;

  const input = {checked: false, disabled: true, addEventListener(name, handler) { this.handler = handler; this.listenerCount = (this.listenerCount || 0) + 1; }};
  const status = {textContent: ''};
  let saved = false, failRead = false, failWrite = false;
  const {ConfigHandler} = load('src/renderer/src/ConfigHandler.ts', {luxon: {}, axios: {}}, {
   document: {getElementById: id => id === 'device-location-enabled' ? input : status},
   window: {playerAPI: {
    getDeviceLocationEnabled: async () => {if (failRead) throw Error('fixture'); return saved;},
    setDeviceLocationEnabled: async value => {if (failWrite) throw Error('fixture'); saved = value; return value;},
   }},
  });
  const view = new ConfigHandler({}, async () => {});
  await view.initLocationPreference();
  equal(input.checked, false); equal(input.disabled, false);
  input.checked = true; await input.handler(); equal(saved, true); equal(input.checked, true);
  failWrite = true; input.checked = false; await input.handler();
  equal(input.checked, true); equal(input.disabled, false);
  failWrite = false; input.checked = false; await input.handler(); equal(saved, false);
  await view.initLocationPreference(); equal(input.listenerCount, 1);
  failRead = true; input.disabled = true; await view.initLocationPreference();
  equal(input.disabled, true);
  failRead = false; await view.initLocationPreference(); equal(input.disabled, false);
  equal(input.listenerCount, 1);
  const html = fs.readFileSync(path.join(root, 'src/renderer/index.html'), 'utf8');
  assert(/id="device-location-enabled" disabled/.test(html)); checks++;
  assert(html.includes('Off by default.')); checks++;
  console.log(JSON.stringify({passed: true, checks, scope: 'Local consent persistence, provider cancellation/stale-response guard, IPC frame restriction, opt-in/out UI; no device changes'}));
 } finally { fs.rmSync(directory, {recursive: true, force: true}); }
})().catch(error => { console.error(error); process.exitCode = 1; });
