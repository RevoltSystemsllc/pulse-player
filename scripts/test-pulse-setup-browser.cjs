const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {build} = require('esbuild');
const {chromium} = require('playwright');
const transform = require('./pulse-setup-html.cjs');
const root = path.resolve(__dirname, '..');
const dependencies = path.dirname(path.dirname(require.resolve('jquery/package.json')));
const qrDependencies = path.dirname(path.dirname(require.resolve('qrcode/package.json')));
const output = process.env.PULSE_SETUP_OUTPUT || '/tmp/pulse-setup-preview';
fs.mkdirSync(output, {recursive: true});

(async () => {
  const bundle = await build({stdin: {contents: `
    import {ConfigHandler} from './src/renderer/src/ConfigHandler';
    import * as setup from './src/renderer/src/PulseSetup';
    window.SetupHandler = ConfigHandler; window.SetupPolicy = setup;
  `, resolveDir: root}, nodePaths: [dependencies, qrDependencies], bundle: true,
  write: false, format: 'iife', platform: 'browser', define: {__PULSE_SETUP_BETA__: 'true'}});
  const original = fs.readFileSync(path.join(root, 'src/renderer/index.html'), 'utf8');
  assert.match(original, /graphic-01/); // Default published build is not rewritten.
  const html = transform(original).replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '')
    .replace(/%__APP_VERSION__%/g, 'LAB PREVIEW');
  assert.doesNotMatch(html, /graphic-0/);
  assert.match(html, /GNU AGPL/);
  const browser = await chromium.launch({headless: true,
    ...(process.env.PULSE_BROWSER_EXECUTABLE ? {executablePath: process.env.PULSE_BROWSER_EXECUTABLE} : {})});
  let checks = 3;
  try {
    for (const [width, height] of [[1920, 1080], [1080, 1920], [960, 540], [375, 812]]) {
      let claim = {message: 'Pending'};
      let generateError = false;
      let delayedPoll;
      let releasePoll;
      const page = await browser.newPage({viewport: {width, height}});
      const errors = [], requests = [], logs = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => logs.push(message.text()));
      await page.route('**/*', async route => {
        const url = route.request().url();
        requests.push(url);
        if (url.startsWith('http://pulse-fixture.invalid/')) {
          const relative = new URL(url).pathname;
          const filename = path.join(root, 'src/renderer', relative);
          if (fs.existsSync(filename) && fs.statSync(filename).isFile()) {
            return route.fulfill({body: fs.readFileSync(filename)});
          }
          return route.fulfill({body: ''});
        }
        if (url === 'https://auth.signlicence.co.uk/generateCode') {
          return route.fulfill({status: generateError ? 503 : 200, contentType: 'application/json',
            body: JSON.stringify({user_code: 'P6L8AB', device_code: 'fixture-private-token'})});
        }
        if (url.startsWith('https://auth.signlicence.co.uk/getDetails?')) {
          const payload = {...claim};
          if (delayedPoll) { delayedPoll(); await new Promise(resolve => { releasePoll = resolve; }); }
          return route.fulfill({contentType: 'application/json', body: JSON.stringify(payload)});
        }
        throw new Error(`Unexpected network request: ${url}`);
      });
      await page.goto('http://pulse-fixture.invalid');
      await page.setContent(html);
      for (const file of ['fonts.css', 'main.css', 'pulse-setup.css']) {
        await page.addStyleTag({content: fs.readFileSync(path.join(root, 'src/renderer/src/assets', file), 'utf8')
          .replaceAll('url(./fonts/', 'url(/src/assets/fonts/')});
      }
      await page.evaluate(() => {
        window.fixtureTimers = new Map();
        let timerId = 0;
        window.setInterval = callback => { window.fixtureTimers.set(++timerId, callback); return timerId; };
        window.clearInterval = id => window.fixtureTimers.delete(id);
        window.playerAPI = {getDeviceLocationEnabled: async () => false, setDeviceLocationEnabled: async () => {}};
        window.apiHandler = {};
        window.fixtureRegisters = 0;
      });
      await page.addScriptTag({content: bundle.outputFiles[0].text});
      await page.evaluate(async () => {
        window.h = new window.SetupHandler({isConfigured: false, platform: 'win32', version: 'LAB',
          hardwareKey: 'fixture', settings: {}}, async () => {});
        window.h.handleRegisterDisplayCallback = async () => { window.fixtureRegisters++; };
        window.h.init();
        await window.h.run();
      });
      await page.waitForFunction(() => document.querySelector('#pulse-portal-qr').width === 144);
      await page.waitForFunction(() => {
        const canvas = document.querySelector('#pulse-portal-qr');
        const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        let dark = 0;
        for (let i = 0; i < data.length; i += 4) if (data[i] < 20 && data[i + 3] === 255) dark++;
        return dark > 1000;
      }); checks++;
      assert.equal(await page.locator('.code-text').textContent(), 'P6L8AB'); checks++;
      assert.equal(await page.locator('.toggle-config').isVisible(), false); checks++;
      assert.equal(await page.locator('#device-location-enabled').isChecked(), false); checks++;
      assert.equal(await page.locator('#nav-config').isVisible(), false); checks++;
      assert.equal(requests.some(url => /graphic-0/.test(url)), false); checks++;
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true); checks++;
      if (width === 1920) {
        assert.equal(await page.locator('#config').evaluate(e => e.scrollHeight <= e.clientHeight), true); checks++;
      }
      assert.equal(await page.evaluate(() => window.SetupPolicy.pulsePortalUrl), 'https://ha-test.pulsedigitalcms.com/login'); checks++;
      assert.deepEqual(await page.evaluate(() => [
        'https://ha-test.pulsedigitalcms.com', 'https://ha-test.pulsedigitalcms.com/',
        'https://portal.pulsedigitalcms.com', 'https://ha-test.pulsedigitalcms.com.evil.test',
        'https://ha-test.pulsedigitalcms.com@evil.test', 'http://ha-test.pulsedigitalcms.com',
        'https://ha-test.pulsedigitalcms.com/path', 'https://ha-test.pulsedigitalcms.com/?key=secret',
        'https://user@ha-test.pulsedigitalcms.com', null,
      ].map(window.SetupPolicy.isPulseLabClaim)), [true, true, false, false, false, false, false, false, false, false]); checks += 10;
      await page.evaluate(() => document.fonts.ready);
      if (width >= 1080) await page.screenshot({path: path.join(output, `pulse-setup-${width}x${height}.png`), fullPage: true});
      await page.locator('#hide-code').check();
      assert.equal(await page.locator('.code-text').textContent(), '••••••'); checks++;
      await page.locator('#hide-code').uncheck();
      await page.locator('#hide-code').blur();
      await page.keyboard.press('Control+Shift+P');
      assert.equal(await page.locator('.config-container').isVisible(), true); checks++;
      assert.equal(await page.locator('[name="cms-key"]').getAttribute('type'), 'password'); checks++;
      assert.equal(await page.evaluate(() => window.fixtureTimers.size), 0); checks++;
      await page.locator('[name="cms-key"]').fill('fixture-private-key');
      await page.locator('[name="display-name"]').fill('Fixture');
      await page.locator('[name="cms-address"]').fill('https://portal.pulsedigitalcms.com');
      await page.locator('#manualSubmitButton').click();
      assert.equal(await page.evaluate(() => window.fixtureRegisters), 0); checks++;
      assert.match(await page.locator('.error').textContent(), /HA-test/); checks++;
      await page.locator('[name="display-name"]').focus();
      await page.keyboard.press('Control+Shift+P');
      assert.equal(await page.locator('.config-container').isVisible(), true); checks++;
      await page.locator('[name="display-name"]').blur();
      await page.keyboard.press('Control+Shift+P');
      await page.waitForFunction(() => window.fixtureTimers.size === 1);
      const poll = async () => {
        await page.evaluate(() => Array.from(window.fixtureTimers.values())[0]());
        await page.waitForTimeout(100);
      };
      claim = {cmsAddress: 'https://portal.pulsedigitalcms.com', cmsKey: 'fixture-private-key'};
      await poll();
      assert.equal(await page.evaluate(() => window.fixtureRegisters), 0); checks++;
      assert.equal(await page.locator('.code-text').textContent(), ''); checks++;
      assert.match(await page.locator('#pulse-setup-state').textContent(), /not approved/); checks++;
      generateError = true;
      await page.locator('#retry-use-code').click();
      await page.waitForFunction(() => document.querySelector('#pulse-setup-state').textContent.includes('Cannot reach'));
      assert.equal(await page.evaluate(() => window.fixtureTimers.size), 0); checks++;
      generateError = false;
      await page.locator('#retry-use-code').click();
      await page.waitForFunction(() => window.fixtureTimers.size === 1);
      claim = {cmsAddress: 'https://ha-test.pulsedigitalcms.com', cmsKey: 'fixture-private-key'};
      await poll();
      assert.equal(await page.evaluate(() => window.fixtureRegisters), 1); checks++;
      assert.equal(await page.evaluate(() => window.h.config.cmsUrl), 'https://ha-test.pulsedigitalcms.com'); checks++;
      // An in-flight claim must not apply after the user switches to technician setup.
      await page.evaluate(() => window.h.run());
      let pollStarted;
      const started = new Promise(resolve => { pollStarted = resolve; });
      delayedPoll = pollStarted;
      await page.evaluate(() => Array.from(window.fixtureTimers.values())[0]());
      await started;
      await page.keyboard.press('Control+Shift+P');
      releasePoll();
      await page.waitForTimeout(100);
      assert.equal(await page.evaluate(() => window.fixtureRegisters), 1); checks++;
      assert.equal(await page.evaluate(() => window.fixtureTimers.size), 0); checks++;
      delayedPoll = null;
      await page.locator('[name="display-name"]').blur();
      await page.keyboard.press('Control+Shift+P');
      await page.waitForFunction(() => window.fixtureTimers.size === 1);
      await page.evaluate(() => { const now = Date.now; Date.now = () => now() + 11 * 60 * 1000; });
      await poll();
      assert.match(await page.locator('#pulse-setup-state').textContent(), /expired/); checks++;
      assert.equal(await page.evaluate(() => window.fixtureTimers.size), 0); checks++;
      const generatedBeforeOpen = requests.filter(url => url.endsWith('/generateCode')).length;
      await page.evaluate(() => window.h.open());
      assert.equal(await page.locator('.config-container').isVisible(), true); checks++;
      assert.equal(requests.filter(url => url.endsWith('/generateCode')).length, generatedBeforeOpen); checks++;
      await page.locator('#config-close').click();
      assert.equal(await page.locator('#config').isVisible(), false); checks++;
      assert.equal(logs.some(log => /fixture-private-(token|key)/.test(log)), false); checks++;
      assert.deepEqual(errors, []); checks++;
      await page.close();
    }
    console.log(JSON.stringify({passed: true, checks, viewports: 4, screenshots: output,
      scope: 'Real ConfigHandler and Chromium with mocked preload/broker. Not an installed Windows or live enrollment test.'}));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
