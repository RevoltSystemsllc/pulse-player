const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
const {build} = require('esbuild');
const root = path.resolve(__dirname, '..');

(async () => {
  const output = process.env.PULSE_ORIENTATION_EVIDENCE;
  if (!output || !path.isAbsolute(output)) throw Error('Absolute evidence directory required');
  fs.mkdirSync(output, {recursive: true});
  const bundle = await build({entryPoints: [path.join(root, 'src/renderer/src/playbackOrientation.ts')],
    bundle: true, write: false, format: 'iife', globalName: 'Orientation', platform: 'browser'});
  const css = fs.readFileSync(path.join(root, 'node_modules/@xibosignage/xibo-layout-renderer/dist/styles.css'), 'utf8');
  const browser = await chromium.launch({headless: true});
  let checks = 0;
  try {
    for (const [width, height] of [[1920,1080], [1080,1920], [2160,1920]]) {
      const page = await browser.newPage({viewport: {width, height}, deviceScaleFactor: 1});
      await page.setContent(`<style>${css}</style><style>
        html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#111}
        #screen_container{background:#173a4b;color:white;overflow:hidden}
        .corner{position:absolute;width:100px;height:100px}
        #tl{left:0;top:0;background:#e65b43} #tr{right:0;top:0;background:#48ba89}
        #br{right:0;bottom:0;background:#f3c15d} #bl{left:0;bottom:0;background:#589adc}
        #operator{position:fixed;right:12px;top:12px;background:white;color:black;z-index:99999}
      </style><div id="player_container" class="player-preview"><div id="screen_container" class="screen-preview">
        <div id="tl" class="corner">TOP LEFT</div><div id="tr" class="corner">TOP RIGHT</div>
        <div id="br" class="corner">BOTTOM RIGHT</div><div id="bl" class="corner">BOTTOM LEFT</div>
      </div></div><button id="operator">Configuration</button>`);
      await page.addScriptTag({content: bundle.outputFiles[0].text});
      for (const mode of ['landscape','portrait','reverse_landscape','reverse_portrait']) {
        const result = await page.evaluate(({mode,width,height}) => {
          const v = Orientation.applyPlaybackOrientation(mode,width,height);
          const s = document.getElementById('screen_container'), r = s.getBoundingClientRect();
          const corners = ['tl','tr','br','bl'].map(id => {
            const b = document.getElementById(id).getBoundingClientRect();
            return {id,x:Math.round(b.x),y:Math.round(b.y),right:Math.round(b.right),bottom:Math.round(b.bottom)};
          });
          return {v,bounds:[r.x,r.y,r.width,r.height].map(Math.round),logical:[s.offsetWidth,s.offsetHeight],
            operatorTransform:getComputedStyle(document.getElementById('operator')).transform,corners};
        }, {mode,width,height});
        assert.deepEqual(result.bounds,[0,0,width,height]); checks++;
        assert.deepEqual(result.logical,[result.v.width,result.v.height]); checks++;
        assert.equal(result.operatorTransform,'none'); checks++;
        for (const c of result.corners) {
          assert.ok(c.x>=0 && c.y>=0 && c.right<=width && c.bottom<=height); checks++;
        }
        const tl=result.corners[0];
        const expected={landscape:[0,0],portrait:[width-100,0],reverse_landscape:[width-100,height-100],reverse_portrait:[0,height-100]}[mode];
        assert.deepEqual([tl.x,tl.y],expected); checks++;
        if (width===1920 && height===1080) await page.screenshot({path:path.join(output,mode+'.png')});
      }
      await page.close();
    }
    const receipt={passed:true,checks,viewports:3,orientations:4,
      scope:'Real Chromium geometry with installed layout-renderer CSS; not Windows device/XMDS/video qualification'};
    fs.writeFileSync(path.join(output,'browser-verification.json'),JSON.stringify(receipt,null,2));
    console.log(JSON.stringify(receipt));
  } finally { await browser.close(); }
})().catch(error => {console.error(error);process.exitCode=1;});
