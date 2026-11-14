// Separate Windows 11 test identity; never replace the reserved Store identity.
const fs = require('node:fs');
const store = require('./identity.json');
const unsignedOid = 'OID.2.25.311729368913984317654407730594956997722=1';

function labIdentity() {
  return {
    name: `${store.name}.Lab`,
    publisher: `${store.publisher}, ${unsignedOid}`,
    publisherDisplayName: store.publisherDisplayName,
    displayName: 'Pulse Digital CMS Player - LAB ONLY',
  };
}

if (require.main === module) {
  if (process.argv.length !== 3) throw new Error('Usage: node lab-identity.cjs NEW_JSON_PATH');
  fs.writeFileSync(process.argv[2], JSON.stringify(labIdentity(), null, 2) + '\n', { flag: 'wx' });
}
module.exports = { labIdentity, unsignedOid };
