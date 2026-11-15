const fs = require('node:fs');
const { DOMParser } = require('@xmldom/xmldom');

function audit(xml, expectedPackage) {
  if (!/^[A-Za-z0-9._-]+$/.test(expectedPackage || '')) throw new Error('Exact expected package full name required');
  if (xml.length > 20 * 1024 * 1024 || /<!DOCTYPE/i.test(xml)) throw new Error('Unsupported report input');
  xml = xml.replace(/^\uFEFF/, '');
  const doc = new DOMParser({ onError: (level, message) => { throw new Error(message); } }).parseFromString(xml, 'text/xml');
  if (doc.documentElement.tagName !== 'REPORT') throw new Error('Expected a WACK REPORT');
  const subjects = [...doc.getElementsByTagName('PackageManifest')].map(n => n.getAttribute('PackageFullName'));
  if (subjects.length !== 1 || subjects[0].toLowerCase() !== expectedPackage.toLowerCase()) {
    throw new Error('Report subject does not match the expected installed package');
  }
  const tests = [...doc.getElementsByTagName('TEST')].map(n => ({
    id: n.getAttribute('INDEX'), name: n.getAttribute('NAME'),
    optional: n.getAttribute('OPTIONAL') === 'TRUE',
    result: n.getElementsByTagName('RESULT')[0]?.textContent?.trim() || 'MISSING',
  }));
  const references = new Set();
  for (const n of doc.getElementsByTagName('MESSAGE')) {
    for (const match of n.getAttribute('TEXT').matchAll(/[\\/]WindowsApps[\\/]+([^\\/]+)[\\/]/gi)) {
      references.add(match[1]);
    }
  }
  const identityPrefix = expectedPackage.split('_')[0].toLowerCase() + '_';
  const stalePackageReferences = [...references].filter(n => n.toLowerCase().startsWith(identityPrefix) && n.toLowerCase() !== expectedPackage.toLowerCase());
  const otherPackageReferences = [...references].filter(n => !n.toLowerCase().startsWith(identityPrefix));
  const requiredFindings = tests.filter(t => !t.optional && t.result !== 'PASS');
  return {
    expectedPackage, overall: doc.documentElement.getAttribute('OVERALL_RESULT'),
    partialRun: doc.documentElement.getAttribute('PARTIAL_RUN') === 'TRUE',
    tests, stalePackageReferences, otherPackageReferences, requiredFindings,
    optionalFindings: tests.filter(t => t.optional && t.result !== 'PASS'),
    requiredChecksPassed: tests.some(t => !t.optional) && requiredFindings.length === 0 && stalePackageReferences.length === 0,
    scope: 'Local report subject/cache consistency and reported results only; not Microsoft Store certification.',
  };
}

if (require.main === module) {
  try {
    const result = audit(fs.readFileSync(process.argv[2], 'utf8'), process.argv[3]);
    console.log(JSON.stringify(result, null, 2));
    if (!result.requiredChecksPassed) process.exitCode = 1;
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
module.exports = { audit };
