const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { manifest, png, prepare, inspectPayload } = require('../installer/windows/store/prepare.cjs');
const identity = { name: '12345.PulsePlayer', publisher: 'CN=12345678-1234-1234-1234-123456789abc', publisherDisplayName: 'Pulse & Digital' };
const result = manifest(identity, 4021);
assert.match(result, /Version="4.0.4021.0"/);
assert.match(result, /Pulse &amp; Digital/);
assert.match(result, /windows.startupTask/);
assert.match(result, /runFullTrust/);
assert.doesNotMatch(result, /allowElevation|unvirtualizedResources|broadFileSystemAccess/);
const storeIdentity = require('../installer/windows/store/identity.json');
assert.equal(storeIdentity.name, 'PulseDigitalCMS.PulseDigitalCMSPlayer');
assert.equal(storeIdentity.publisher, 'CN=C6CDFF9D-6C25-4511-89A6-AE4CBAEBFECB');
assert.equal(storeIdentity.publisherDisplayName, 'Pulse Digital CMS');
assert.equal(storeIdentity.packageFamilyName, 'PulseDigitalCMS.PulseDigitalCMSPlayer_hw23mpdy865yp');
assert.equal(storeIdentity.storeId, '9N3B4R0PJ9XF');
const storeManifest = manifest(storeIdentity, 4021);
assert(storeManifest.includes(`Name="${storeIdentity.name}" Publisher="${storeIdentity.publisher}"`));
assert(storeManifest.includes('<PublisherDisplayName>Pulse Digital CMS</PublisherDisplayName>'));
assert(storeManifest.includes('<DisplayName>Pulse Digital CMS Player</DisplayName>'));
assert.equal((storeManifest.match(/DisplayName="Pulse Digital CMS Player"/g) || []).length, 2);
assert(storeManifest.includes('Executable="app\\Pulse Player.exe"'));
assert(manifest({ ...identity, displayName: 'Pulse & "Screens"' }, 4021).includes('DisplayName="Pulse &amp; &quot;Screens&quot;"'));
for (const displayName of ['', ' ', 42, 'x'.repeat(257)]) {
  assert.throws(() => manifest({ ...identity, displayName }, 4021), /Display name/);
}
for (const value of [undefined, {}, { ...identity, name: '../bad' }, { ...identity, publisher: 'placeholder' }]) {
  assert.throws(() => manifest(value, 4021));
}
for (const value of [-1, 0, 65536, 4.2, '4021']) assert.throws(() => manifest(identity, value));
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pulse-store-test-'));
try {
  const app = path.join(root, 'input');
  const assets = path.join(root, 'assets');
  fs.mkdirSync(path.join(app, 'resources'), { recursive: true });
  fs.mkdirSync(assets);
  fs.writeFileSync(path.join(app, 'Pulse Player.exe'), 'fixture-not-a-binary');
  fs.writeFileSync(path.join(app, 'resources/app.asar'), 'fixture');
  const id = path.join(root, 'identity.json');
  fs.writeFileSync(id, JSON.stringify(identity));
  // Header-only fixtures exercise dimension checks, not Windows image validation.
  for (const [name, size] of [['StoreLogo.png', 50], ['Square150x150Logo.png', 150], ['Square44x44Logo.png', 44]]) {
    const data = Buffer.alloc(24);
    Buffer.from('89504e470d0a1a0a', 'hex').copy(data);
    data.write('IHDR', 12); data.writeUInt32BE(size, 16); data.writeUInt32BE(size, 20);
    fs.writeFileSync(path.join(assets, name), data);
  }
  assert.throws(() => png(path.join(assets, 'StoreLogo.png'), 150));
  const output = path.join(root, 'output');
  prepare(app, id, assets, output);
  assert.equal(fs.readFileSync(path.join(output, 'AppxManifest.xml'), 'utf8'), manifest(identity, require('../package.json').versionCode));
  assert.throws(() => prepare(app, id, assets, output));
  assert.throws(() => prepare(app, id, assets, path.join(app, 'nested')));
  assert.equal(fs.readFileSync(path.join(app, 'resources/app.asar'), 'utf8'), 'fixture');
  for (const name of ['config.json', 'cms_config.json', 'location-privacy.json', 'location-privacy.json.tmp', 'playerDb.db-wal', '.env', 'release.pfx', 'lab.secret']) {
    const file = path.join(app, name);
    fs.writeFileSync(file, 'never-package-device-state');
    assert.throws(() => inspectPayload(app), /must not be packaged/);
    fs.unlinkSync(file);
  }
  fs.symlinkSync(id, path.join(app, 'linked-file'));
  assert.throws(() => inspectPayload(app), /Unsupported payload entry/);
  fs.unlinkSync(path.join(app, 'linked-file'));
  fs.unlinkSync(path.join(app, 'resources/app.asar'));
  assert.throws(() => prepare(app, id, assets, path.join(root, 'missing-app')), /Missing Electron payload/);
  fs.mkdirSync(path.join(app, 'resources/app/dist/main'), { recursive: true });
  const pkg = require('../package.json');
  const appManifest = path.join(app, 'resources/app/package.json');
  fs.writeFileSync(appManifest, JSON.stringify({ name: pkg.name, version: pkg.version, main: './dist/main/index.js' }));
  fs.writeFileSync(path.join(app, 'resources/app/dist/main/index.js'), '// fixture');
  prepare(app, id, assets, path.join(root, 'unpacked-output'));
  fs.writeFileSync(appManifest, JSON.stringify({ name: pkg.name, version: '0.0.0', main: './dist/main/index.js' }));
  assert.throws(() => prepare(app, id, assets, path.join(root, 'wrong-version')), /does not match/);
  fs.writeFileSync(appManifest, JSON.stringify({ name: pkg.name, version: pkg.version, main: '../../outside.js' }));
  assert.throws(() => prepare(app, id, assets, path.join(root, 'wrong-main')), /inside resources\/app/);
  fs.mkdirSync(path.join(app, 'xibo_library'));
  assert.throws(() => inspectPayload(app), /must not be packaged/);
} finally { fs.rmSync(root, { recursive: true, force: true }); }
console.log('Store staging checks passed (fixtures only; not Windows/MSIX certification).');
