const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { labIdentity, unsignedOid } = require('../installer/windows/store/lab-identity.cjs');
const { manifest } = require('../installer/windows/store/prepare.cjs');
const store = require('../installer/windows/store/identity.json');
const original = JSON.stringify(store);
const lab = labIdentity();
assert.equal(lab.name, `${store.name}.Lab`);
assert.notEqual(lab.publisher, store.publisher);
assert.equal(lab.publisher, `${store.publisher}, ${unsignedOid}`);
assert.equal(lab.displayName, 'Pulse Digital CMS Player - LAB ONLY');
assert.equal(lab.packageFamilyName, undefined);
assert.equal(lab.storeId, undefined);
assert.equal(JSON.stringify(store), original);
assert.match(manifest(lab, 4021), /LAB ONLY/);
assert.match(manifest(lab, 4021), /OID\.2\.25\.311729368913984317654407730594956997722=1/);
assert.doesNotMatch(manifest(store, 4021), /OID\.2\.25|LAB ONLY/);
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'pulse-lab-identity-'));
try {
  const output = path.join(temporary, 'identity.json');
  const script = path.join(__dirname, '../installer/windows/store/lab-identity.cjs');
  assert.equal(spawnSync(process.execPath, [script, output]).status, 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(output, 'utf8')), lab);
  assert.notEqual(spawnSync(process.execPath, [script, output]).status, 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(output, 'utf8')), lab);
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
console.log(JSON.stringify({ passed: true, checks: 14, installed: false, storeIdentityUnchanged: true }));
