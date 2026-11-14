// QA-only: launch the unpackaged Windows candidate on a disposable CI runner.
// Capture the real renderer via its local debugging socket; no CMS enrollment.
const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function capture(executable, output) {
  if (process.platform !== 'win32' || process.env.GITHUB_ACTIONS !== 'true') {
    throw new Error('Capture is restricted to an isolated Windows GitHub runner.');
  }
  assert(path.isAbsolute(output), 'Absolute new output directory required');
  fs.mkdirSync(output);
  const log = fs.openSync(path.join(output, 'launch.log'), 'wx');
  const child = spawn(executable, ['--remote-debugging-address=127.0.0.1', '--remote-debugging-port=19226'], {
    stdio: ['ignore', log, log], windowsHide: false,
  });
  let socket;
  try {
    let target;
    for (let i = 0; i < 90; i++) {
      if (child.exitCode !== null) throw new Error(`Player exited: ${child.exitCode}`);
      try {
        const list = await (await fetch('http://127.0.0.1:19226/json/list')).json();
        target = list.find(item => item.type === 'page' && item.url.startsWith('file:') && item.url.includes('index.html'));
        if (target) break;
      } catch {}
      await delay(1000);
    }
    if (!target) throw new Error('No real player renderer found');
    const endpoint = new URL(target.webSocketDebuggerUrl);
    if (!['localhost', '127.0.0.1'].includes(endpoint.hostname)) throw new Error('Non-local debugger refused');
    socket = new WebSocket(endpoint);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    let seq = 0;
    const pending = new Map();
    socket.onmessage = event => {
      const response = JSON.parse(event.data);
      const callback = pending.get(response.id);
      if (!callback) return;
      pending.delete(response.id);
      clearTimeout(callback.timer);
      if (response.error) callback.reject(new Error(JSON.stringify(response.error)));
      else callback.resolve(response.result);
    };
    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = ++seq;
        const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timed out: ${method}`)); }, 15000);
        pending.set(id, { resolve, reject, timer });
        socket.send(JSON.stringify({ id, method, params }));
      });
    }
    async function evaluate(expression) {
      const result = await send('Runtime.evaluate', { expression, returnByValue: true });
      if (result.exceptionDetails) throw new Error('Renderer evaluation failed');
      return result.result.value;
    }
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
    let ready = false;
    for (let i = 0; i < 60; i++) {
      ready = await evaluate(`Boolean(document.querySelector('.top-header') && document.querySelector('.top-header').getBoundingClientRect().height > 0 && document.querySelector('#hide-code') && document.querySelector('.toggle-config [data-target="configure-manually"]'))`);
      if (ready) break;
      await delay(1000);
    }
    assert(ready, 'Real first-launch configuration must be visible');
    // Use the application's own Hide control; never publish a pairing code.
    await evaluate(`(() => { const el = document.querySelector('#hide-code'); if (!el.checked) el.click(); return el.checked; })()`);
    await delay(1000);
    async function save(name) {
      const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      const data = Buffer.from(screenshot.data, 'base64');
      assert(data.length > 10000, 'Reject blank/tiny capture');
      assert.equal(data.readUInt32BE(16), 1920);
      assert.equal(data.readUInt32BE(20), 1080);
      fs.writeFileSync(path.join(output, name), data, { flag: 'wx' });
    }
    await save('01-player-activation-hidden.png');
    await evaluate(`document.querySelector('.toggle-config [data-target="configure-manually"]').click()`);
    await delay(1000);
    const safe = await evaluate(`(() => { const inputs = [...document.querySelectorAll('.config-container input')]; return inputs.every(el => !/key|password|secret/i.test(el.id + ' ' + el.name) || !el.value); })()`);
    assert(safe, 'Manual setup must not contain credentials');
    await save('02-player-manual-setup.png');
    fs.writeFileSync(path.join(output, 'capture-report.json'), JSON.stringify({
      sourceCommit: process.env.GITHUB_SHA, platform: process.platform,
      realPlayerRenderer: true, installedMsix: false, cmsEnrollmentPerformed: false,
      width: 1920, height: 1080, pairingCodeHidden: true,
      reviewRequiredBeforeListingUpload: true,
    }, null, 2));
    console.log('Captured actual Windows player setup screens; review PNGs before uploading.');
  } finally {
    socket?.close();
    if (child.pid) spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F']);
    fs.closeSync(log);
  }
}
capture(path.resolve(process.argv[2] || ''), process.argv[3] || '').catch(error => {
  console.error(`::error::${error.message}`);
  process.exitCode = 1;
});
