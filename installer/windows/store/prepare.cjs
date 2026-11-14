// Stage a Store submission candidate. No signing, installation or publication.
const fs = require('node:fs');
const path = require('node:path');
const pkg = require('../../../package.json');

function xml(value) {
  return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
}

function manifest(identity, versionCode) {
  if (!identity || !/^[A-Za-z0-9.-]{3,50}$/.test(identity.name || '') ||
      !/^CN=.+/.test(identity.publisher || '') || !identity.publisherDisplayName?.trim() ||
      /REPLACE|EXAMPLE|PLACEHOLDER/i.test(JSON.stringify(identity))) {
    throw new Error('Supply the exact reserved Partner Center identity, Publisher and publisher display name.');
  }
  if (!Number.isInteger(versionCode) || versionCode < 1 || versionCode > 65535) {
    throw new Error('versionCode must fit the MSIX build field (1..65535).');
  }
  const displayName = identity.displayName ?? 'Pulse Player';
  if (typeof displayName !== 'string' || !displayName.trim() || displayName.length > 256) {
    throw new Error('Display name must be a nonempty string of at most 256 characters.');
  }
  return `<?xml version="1.0" encoding="utf-8"?>
<Package xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10"
 xmlns:uap="http://schemas.microsoft.com/appx/manifest/uap/windows10"
 xmlns:desktop="http://schemas.microsoft.com/appx/manifest/desktop/windows10"
 xmlns:rescap="http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities"
 IgnorableNamespaces="uap desktop rescap">
 <Identity Name="${xml(identity.name)}" Publisher="${xml(identity.publisher)}" Version="4.0.${versionCode}.0" ProcessorArchitecture="x64" />
 <Properties><DisplayName>${xml(displayName)}</DisplayName><PublisherDisplayName>${xml(identity.publisherDisplayName)}</PublisherDisplayName><Logo>Assets\\StoreLogo.png</Logo></Properties>
 <Resources><Resource Language="en-us" /></Resources>
 <Dependencies><TargetDeviceFamily Name="Windows.Desktop" MinVersion="10.0.19041.0" MaxVersionTested="10.0.26100.0" /></Dependencies>
 <Applications><Application Id="PulsePlayer" Executable="app\\Pulse Player.exe" EntryPoint="Windows.FullTrustApplication">
  <uap:VisualElements DisplayName="${xml(displayName)}" Description="Pulse Digital signage player" BackgroundColor="transparent" Square150x150Logo="Assets\\Square150x150Logo.png" Square44x44Logo="Assets\\Square44x44Logo.png" />
  <Extensions><desktop:Extension Category="windows.startupTask" Executable="app\\Pulse Player.exe" EntryPoint="Windows.FullTrustApplication"><desktop:StartupTask TaskId="PulsePlayerStartup" Enabled="true" DisplayName="${xml(displayName)}" /></desktop:Extension></Extensions>
 </Application></Applications>
 <Capabilities><rescap:Capability Name="runFullTrust" /></Capabilities>
</Package>
`;
}

function png(file, size) {
  const data = fs.readFileSync(file);
  if (data.length < 24 || data.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
      data.toString('ascii', 12, 16) !== 'IHDR' || data.readUInt32BE(16) !== size || data.readUInt32BE(20) !== size) {
    throw new Error(`${file} must be a ${size}x${size} PNG.`);
  }
}

function inspectPayload(root, relative = '') {
  for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
    const name = path.join(relative, entry.name);
    // Never follow links outside the reviewed payload or ship device-local state.
    if (entry.isSymbolicLink() || (!entry.isDirectory() && !entry.isFile())) {
      throw new Error(`Unsupported payload entry: ${name}`);
    }
    if ((!relative && /^(config\.json|cms_config\.json|rendering-preferences\.json|location-privacy\.json(?:\.tmp)?|playerDb\.db(?:-wal|-shm)?)$/i.test(entry.name)) ||
        /^(xibo_library|\.env(?:\..*)?|.*\.(?:pfx|p12|pem|key|secret))$/i.test(entry.name)) {
      throw new Error(`Device state or credential material must not be packaged: ${name}`);
    }
    if (entry.isDirectory()) inspectPayload(root, name);
  }
}

function prepare(appDir, identityFile, assetsDir, output) {
  const document = manifest(JSON.parse(fs.readFileSync(identityFile, 'utf8')), pkg.versionCode);
  for (const [file, size] of [['StoreLogo.png', 50], ['Square150x150Logo.png', 150], ['Square44x44Logo.png', 44]]) {
    png(path.join(assetsDir, file), size);
  }
  for (const file of ['Pulse Player.exe']) {
    if (!fs.statSync(path.join(appDir, file)).isFile()) throw new Error(`Missing packaged application: ${file}`);
  }
  // Forge currently ships an unpacked app; accept ASAR if enabled in a future build.
  const asar = path.join(appDir, 'resources/app.asar');
  const unpacked = path.join(appDir, 'resources/app/package.json');
  if (!fs.existsSync(asar) && !fs.existsSync(unpacked)) {
    throw new Error('Missing Electron payload: resources/app.asar or resources/app/package.json');
  }
  if (fs.existsSync(asar) && !fs.statSync(asar).isFile()) throw new Error('ASAR must be a regular file.');
  if (fs.existsSync(unpacked)) {
    const appPackage = JSON.parse(fs.readFileSync(unpacked, 'utf8'));
    if (appPackage.name !== pkg.name || appPackage.version !== pkg.version) {
      throw new Error('Packaged application identity/version does not match this source candidate.');
    }
    const appRoot = path.dirname(unpacked);
    const main = path.resolve(appRoot, appPackage.main || '');
    if (!main.startsWith(appRoot + path.sep) || !fs.statSync(main).isFile()) {
      throw new Error('Packaged main entry must be a file inside resources/app.');
    }
  }
  if (fs.lstatSync(appDir).isSymbolicLink()) throw new Error('Application directory must not be a symlink.');
  inspectPayload(appDir);
  // Refuse nested outputs and pre-existing directories; never overwrite a build/profile.
  const sources = [appDir, assetsDir].map(p => path.resolve(p));
  output = path.resolve(output);
  if (sources.some(p => output === p || output.startsWith(p + path.sep) || p.startsWith(output + path.sep))) {
    throw new Error('Staging output must be separate from inputs.');
  }
  fs.mkdirSync(output);
  fs.cpSync(appDir, path.join(output, 'app'), { recursive: true, dereference: false });
  fs.mkdirSync(path.join(output, 'Assets'));
  for (const file of ['StoreLogo.png', 'Square150x150Logo.png', 'Square44x44Logo.png']) {
    fs.copyFileSync(path.join(assetsDir, file), path.join(output, 'Assets', file));
  }
  fs.writeFileSync(path.join(output, 'AppxManifest.xml'), document);
  console.log('Staged unsigned Store candidate. Windows SDK validation and Store certification remain required.');
}

if (require.main === module) {
  if (process.argv.length !== 6) throw new Error('Usage: node prepare.cjs APP_DIR IDENTITY_JSON ASSETS_DIR NEW_OUTPUT_DIR');
  prepare(...process.argv.slice(2));
}
module.exports = { manifest, png, prepare, inspectPayload };
