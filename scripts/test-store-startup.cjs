const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../src/main/common/watchdog.ts'), 'utf8');
const start = source.indexOf('function ensureWindowsAutostartEntry(): void {');
const end = source.indexOf('\n/**', start);
assert(start > 0 && end > start, 'Find the real startup implementation');
const compiled = ts.transpileModule(source.slice(start, end), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 }, reportDiagnostics: true,
});
assert.equal(compiled.diagnostics.length, 0);
let checks = 2;
for (const store of [true, false, undefined]) {
  for (const fail of [false, true]) {
    const calls = [], logs = [], errors = [];
    const context = {
      process: { windowsStore: store },
      app: { setLoginItemSettings(settings) {
        calls.push(JSON.parse(JSON.stringify(settings)));
        if (fail) throw new Error('fixture startup denied');
      } },
      console: { log: value => logs.push(value), error: value => errors.push(value) },
    };
    vm.runInNewContext(compiled.outputText + '\nensureWindowsAutostartEntry();', context);
    assert.deepEqual(calls, store === true ? [] : [{ openAtLogin: true }]);
    assert.equal(errors.length, store !== true && fail ? 1 : 0);
    assert.equal(logs.some(value => value.includes('PulsePlayerStartup')), store === true);
    checks += 3;
  }
}
console.log(JSON.stringify({ passed: true, checks, windowsDeviceTested: false }));
