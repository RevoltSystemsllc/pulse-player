const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const vm = require('node:vm');
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
   for (const required of ['>PerMonitor</dpiAwareness>', '>true/pm</dpiAware>', 'level="asInvoker" uiAccess="false"', 'Microsoft.Windows.Common-Controls', '>true</disableWindowFiltering>']) {
    assert(manifest.includes(required)); checks++;
   }
  }
 }
}
console.log(JSON.stringify({passed: true, checks, scope: 'Store-only PE manifest selection; embedded binary and real DPI behavior still require Windows validation'}));
