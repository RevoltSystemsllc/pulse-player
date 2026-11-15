# Pulse-first Windows setup preview

This is a lab-only presentation and activation-hardening candidate. It is not a
new Microsoft Store release and has not been installed on a Windows lab device.
The Windows lab candidate is version 4.0.26 (4026), using the separate Lab MSIX identity.

## Experience

- Original Pulse layout, typography and signal motif replace the instructional art.
- First boot shows a connection code and locally generated QR for HA-test login.
- QR opens the portal only. Admins must use Add Display, enter the code and approve.
- Normal playback hides Configuration. Ctrl+Shift+P opens technician settings;
  Escape closes them on configured players. The shortcut is not authentication.
- Location remains off by default and its consent control remains visible.
- About retains upstream attribution and QR-library license text.

## Boundaries

The beta media cache is isolated under its own profile; it does not use the original Documents cache.

Windows still uses the existing external activation broker. Pulse-native enrollment
currently supports Android, not Windows XMDS provisioning. This candidate does not
embed a shared CMS key, modify the backend, enroll production devices, or complete
that separate Windows-native integration.

New broker claims and manual registrations in this preview accept only the HTTPS
HA-test root URL. Production, lookalike hosts, URL credentials, paths and queries
are rejected. Existing configured-player moves still need explicit confirmation.
Polling expires locally after ten minutes, uses bounded requests and ignores
responses from abandoned sessions. Closing technician settings does not mint a
fresh code or stop playback.

## Build And Verify

After installing the pinned dependencies, run:

```sh
npm run build:setup-lab
npm run test:setup
PULSE_SETUP_BETA=1 node scripts/test-player-navigation-browser.cjs
node scripts/test-location-privacy.cjs
```

Browser fixtures need Playwright/Chromium in the test environment. Set
`PULSE_BROWSER_EXECUTABLE` for a preinstalled Chromium executable when needed.
Fixture screenshots use a mock code, not a working enrollment credential.

Default builds retain the published setup. Combining `PULSE_SETUP_BETA=1` and
`PULSE_STORE_BUILD=1` is rejected. Do not pass `dist-setup-lab` to Store packaging.

## Release Gates Still Open

- Build a distinct Windows lab installer and verify clean first-boot enrollment.
- Check return to playback, technician access and configuration persistence on Windows.
- Implement and qualify Pulse-native Windows enrollment before claiming the external
  activation service has been removed.
- Replace Store screenshots only after capture from the actual qualified Windows app.
- Repository-wide type checking still has existing errors; this candidate adds none
  in the baseline comparison. Dependency audit findings need a separate review.
