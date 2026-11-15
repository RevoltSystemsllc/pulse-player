const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const config = fs.readFileSync(path.join(root, 'src/main/config/config.ts'), 'utf8');
const {labIdentity} = require('../installer/windows/store/lab-identity.cjs');
assert.match(config, /setupLab \? join\(dataDir, 'setup-lab-library'\)/);
assert.match(config, /typeof __PULSE_SETUP_BETA__ !== 'undefined'/);
assert.match(labIdentity().name, /\.Lab$/);
const workflow = fs.readFileSync(path.join(root, '.github/workflows/pulse-setup-lab-windows.yml'), 'utf8');
assert.match(workflow, /PULSE_SETUP_BETA: '1'/);
assert.match(workflow, /PULSE_LAB_BUILD: '1'/);
assert.doesNotMatch(workflow, /PULSE_STORE_BUILD|gh release|publish:|signtool|Add-AppxPackage/);
assert.match(workflow, /build-lab-msix\.ps1/);
assert.match(workflow, /codex\/pulse-first-setup-lab/);
const transform = require('./pulse-setup-html.cjs');
const sourceHtml = fs.readFileSync(path.join(root, 'src/renderer/index.html'), 'utf8');
for (const html of [sourceHtml, sourceHtml.replaceAll('src="/assets/', 'src="./assets/')]) {
  assert.doesNotMatch(transform(html), /graphic-0[1-5]\.png/);
}
let checks = 10;
if (process.argv.includes('--compiled')) {
  assert.equal(process.env.PULSE_SETUP_BETA, '1');
  const html = fs.readFileSync(path.join(root, 'dist/renderer/index.html'), 'utf8');
  const main = fs.readFileSync(path.join(root, 'dist/main/index.js'), 'utf8');
  assert.match(html, /pulse-setup-beta/);
  assert.match(html, /pulse-portal-qr/);
  assert.doesNotMatch(html, /graphic-0[1-5]\.png/);
  assert.match(main, /this\.library = [\w$]+\.join\(dataDir, "setup-lab-library"\);/);
  checks += 5;
}
console.log(JSON.stringify({passed: true, checks, compiled: process.argv.includes('--compiled'), scope: 'Lab cache, identity, artwork and workflow boundaries; not installed runtime verification'}));
