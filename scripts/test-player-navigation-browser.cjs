const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {build} = require('esbuild');
const {chromium} = require('playwright');

const root = path.resolve(__dirname, '..');
const dependencies = path.dirname(path.dirname(require.resolve('jquery/package.json')));

(async () => {
  const bundle = await build({
    entryPoints: [path.join(root, 'src/renderer/src/renderer.ts')],
    nodePaths: [dependencies], alias: {'@shared': path.join(root, 'src/shared')},
    bundle: true, write: false, format: 'iife', platform: 'browser',
    loader: {'.css': 'empty', '.png': 'dataurl', '.svg': 'dataurl'},
    define: {__APP_VERSION__: JSON.stringify('navigation-fixture'), __APP_VERSION_CODE__: '0'},
  });
  const html = fs.readFileSync(path.join(root, 'src/renderer/index.html'), 'utf8')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
  const browser = await chromium.launch({headless: true});
  let checks = 0;
  try {
    for (const [width, height] of [[1920, 1080], [1080, 1920]]) {
      const page = await browser.newPage({viewport: {width, height}});
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      // No fixture request may reach a real CMS or activation service.
      await page.route('**/*', route => route.fulfill({status: 200,
        contentType: route.request().isNavigationRequest() ? 'text/html' : 'text/xml',
        body: '<layout width="1920" height="1080" bgcolor="#000000" schemaVersion="1"><region id="1" width="1920" height="1080" left="0" top="0"><media id="1" type="text" duration="60"><options/><raw><text><![CDATA[<p>Harmless fixture</p>]]></text></raw></media><options/></region></layout>',
      }));
      await page.goto('http://pulse-fixture.invalid');
      await page.setContent(html);
      for (const filename of [path.join(root, 'src/renderer/src/assets/main.css'),
        path.join(dependencies, '@xibosignage/xibo-layout-renderer/dist/styles.css')]) {
        await page.addStyleTag({content: fs.readFileSync(filename, 'utf8')});
      }
      await page.evaluate(() => {
        const config = {isConfigured: true, cmsUrl: 'https://demo.invalid', cmsKey: 'fixture',
          hardwareKey: 'fixture', displayName: 'Navigation fixture', settings: {}, xmdsVersion: 7};
        window.fixtureListeners = {};
        window.fixtureCalls = [];
        console.alert = () => {};
        console._log = () => {};
        window.playerAPI = new Proxy({}, {get: (_, name) => {
          if (name === 'requestCallback') return async () => ({callbackName: 'fixture'});
          if (name === 'invokeCallback') return async () => {};
          if (name === 'getDeviceLocationEnabled') return async () => false;
          return arg => {
            if (String(name).startsWith('on')) window.fixtureListeners[name] = arg;
            else window.fixtureCalls.push([name, arg]);
          };
        }});
        window.apiHandler = new Proxy({}, {get: (_, name) =>
          ['loadConfig', 'getConfig'].includes(name) ? async () => config : async () => ({success: true})});
      });
      await page.addScriptTag({content: bundle.outputFiles[0].text});
      await page.waitForFunction(() => window.xlr && window.fixtureCalls.some(c => c[0] === 'notifyRendererReady'));
      await page.evaluate(async () => {
        await window.fixtureListeners.onUpdateUniqueLayouts([
          {layoutId: 1, path: '1.xlf', shortPath: '1.xlf', scheduleId: -1, duration: 60},
        ]);
        window.fixtureListeners.onUpdateLoop([{file: 1, layoutId: 1, id: 1, index: 0, duration: 60}]);
      });
      await page.waitForFunction(() => document.querySelector('[data-sequence]'));

      for (const [button, panel, close] of [
        ['nav-status', 'status', 'status-close'], ['nav-config', 'config', 'config-close'],
      ]) {
        await page.evaluate(() => window.fixtureListeners.onMouseMoved());
        await page.locator('#' + button).hover();
        await page.mouse.down();
        // A delayed remote pointer-up must not lose its target to the five-second timer.
        await page.waitForTimeout(5300);
        assert.equal(await page.locator('#nav-bar').evaluate(e => e.classList.contains('nav-bar--hidden')), false);
        checks++;
        await page.mouse.up();
        await page.locator('#' + panel).waitFor({state: 'visible', timeout: 3000});
        checks++;
        await page.locator('#' + close).click();
        await page.locator('#' + panel).waitFor({state: 'hidden'});
        checks++;
      }
      await page.locator('#nav-status').focus();
      await page.mouse.move(width / 2, height - 20);
      await page.waitForTimeout(5300);
      assert.equal(await page.locator('#nav-bar').evaluate(e => e.classList.contains('nav-bar--hidden')), false);
      checks++;
      await page.keyboard.press('Enter');
      await page.locator('#status').waitFor({state: 'visible'});
      checks++;
      await page.keyboard.press('Escape');
      await page.locator('#status').waitFor({state: 'hidden'});
      checks++;
      await page.evaluate(() => window.fixtureListeners.onShowStatusWindow(60));
      await page.locator('#status').waitFor({state: 'visible'});
      await page.keyboard.press('Escape');
      await page.locator('#status').waitFor({state: 'hidden'});
      checks++;
      // Once focus and pointer leave the controls, normal auto-hide must resume.
      await page.locator('#nav-status').evaluate(e => e.blur());
      await page.mouse.move(width / 2, height - 20);
      await page.evaluate(() => window.fixtureListeners.onMouseMoved());
      await page.waitForTimeout(5300);
      assert.equal(await page.locator('#nav-bar').evaluate(e => e.classList.contains('nav-bar--hidden')), true);
      checks++;
      assert.deepEqual(errors, []);
      checks++;
      await page.close();
    }
    console.log(JSON.stringify({passed: true, checks, viewports: 2,
      scope: 'Real renderer, real layout engine and Chromium pointer events with mocked preload/CMS; not an installed Windows test'}));
  } finally {
    await browser.close();
  }
})().catch(error => {console.error(error); process.exitCode = 1;});
