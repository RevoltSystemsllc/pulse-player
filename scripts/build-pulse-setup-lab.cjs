const {spawnSync} = require('node:child_process');
const path = require('node:path');
if (process.env.PULSE_STORE_BUILD === '1') {
  throw new Error('Setup preview is lab-only. Do not combine with Store packaging.');
}
const root = path.resolve(__dirname, '..');
const result = spawnSync(process.execPath, [path.join(root, 'node_modules/electron-vite/bin/electron-vite.js'),
  'build', '--mode', 'production', '--outDir', 'dist-setup-lab'], {
  cwd: root, stdio: 'inherit', env: {...process.env, PULSE_SETUP_BETA: '1'},
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
