const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { DOMParser } = require('@xmldom/xmldom');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'forge.config.cjs'), 'utf8');
let checks = 0;
for (const flag of [undefined, '0', '1']) {
 for (const platform of ['win32', 'linux']) {
  const context = {module: {exports: {}}, __dirname: root, process: {argv: ['node', 'forge', '--platform', platform], platform: 'darwin', env: {PULSE_STORE_BUILD: flag}},
   require: name => name === 'node:path' ? path : class FixtureMaker {}};
  vm.runInNewContext(source, context);
  const config = context.module.exports.packagerConfig;
  assert.equal(Boolean(config.win32metadata), flag === '1' && platform === 'win32'); checks++;
  if (config.win32metadata) {
   const manifest = fs.readFileSync(config.win32metadata['application-manifest'], 'utf8');
   const document = new DOMParser().parseFromString(manifest, 'text/xml');
   const first = [...document.documentElement.childNodes].find(n => n.nodeType === 1);
   assert.equal(first?.localName, 'assemblyIdentity', 'Application identity must be the first manifest element'); checks++;
   assert.equal(first.namespaceURI, 'urn:schemas-microsoft-com:asm.v1'); checks++;
   for (const [name, value] of Object.entries({type: 'win32', name: 'PulseDigitalCMS.PulseDigitalCMSPlayer', version: '4.0.0.0', processorArchitecture: 'amd64'})) {
    assert.equal(first.getAttribute(name), value); checks++;
   }
   for (const required of ['>PerMonitorV2</dpiAwareness>', '>true/pm</dpiAware>', 'level="asInvoker" uiAccess="false"', 'Microsoft.Windows.Common-Controls', '>true</disableWindowFiltering>']) {
    assert(manifest.includes(required)); checks++;
   }
  }
 }
}
console.log(JSON.stringify({passed: true, checks, scope: 'Store-only PE manifest selection; embedded binary and real DPI behavior still require Windows validation'}));
