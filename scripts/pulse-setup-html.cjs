const {readFileSync} = require('node:fs');
const {join} = require('node:path');
/** Lab-only presentation transform. Keep upstream notices and default Store UI intact. */
module.exports = function pulseSetupHtml(html) {
  const notices = readFileSync(join(__dirname, '../src/renderer/public/assets/pulse-setup-licenses.txt'), 'utf8')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  return html.replace('<body>', '<body class="pulse-setup-beta">')
    .replace('<h3>Connect this media player</h3>', '<p class="setup-kicker">PULSE PLAYER / LAB PREVIEW</p><h3>Your screen.<br>Your next big thing.</h3>')
    .replace(/<div class="item2 activation-code">[\s\S]*?(?=\n                <\/div>\n                <!-- Configure Manually -->)/,
      `<aside class="item2 setup-guide" aria-label="Connect to Pulse">
        <div class="setup-signal" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div>
        <p class="setup-kicker">FROM HERE TO EVERYWHERE</p>
        <h2>Make the connection.</h2>
        <ol><li>Open your Pulse lab dashboard.</li><li>Choose <strong>Add Display</strong> and enter this code.</li><li>Approve the display and assign your content.</li></ol>
        <div class="setup-qr"><canvas id="pulse-portal-qr" aria-label="QR code to open the Pulse lab sign-in page"></canvas><p>Scan to open Pulse.<br><span>Then enter the code shown here.</span></p></div>
        <p class="setup-portal">ha-test.pulsedigitalcms.com</p>
      </aside>`)
    .replace(/<img[^>]+src="(?:\.\/|\/)assets\/images\/graphic-05\.png"[^>]*\/>/, '<p class="setup-tech-note">Technician setup<br>Changes here can disconnect this player.</p>')
    .replace(/<img[^>]+src="(?:\.\/|\/)assets\/images\/(?:help|code|no-wifi)\.svg"[^>]*\/>/g, '')
    .replace('<h2>Activation Code</h2>', '<h2>Your connection code</h2>')
    .replace('Keep this page open until this Pulse media player has been added to the CMS.', 'No server address. No shared key. Add this code in Pulse and keep this screen open.')
    .replace(/Sorry, the activation code is not available,[\s\S]*?above\./, 'We could not get a connection code. Check the network, then try again.')
    .replace('<!-- Unavailable Code and No connection -->', `<footer class="setup-footer"><p id="pulse-setup-state" role="status" aria-live="polite">Getting your connection code...</p><details><summary>About &amp; licenses</summary><p>Pulse Digital CMS Player. This lab preview still uses the external activation service at auth.signlicence.co.uk. QR opens the dashboard; it does not approve a display.</p><p>Includes Xibo-derived software under GNU AGPL v3 or later. See the bundled LICENSE and NOTICE. Source: https://github.com/RevoltSystemsllc/pulse-player. Technician settings: Ctrl+Shift+P (local convenience, not an access-control boundary).</p><details><summary>QR component licenses</summary><pre>${notices}</pre></details></details></footer><!-- Unavailable Code and No connection -->`);
};
