# Microsoft Store route (preparation only)

Microsoft signs MSIX packages after Store certification, without a recurring
signing subscription. An MSI/EXE listing does not provide this free signing.
No certificate, account, installation or publication is created by these tools.

## Account handoff

The owner has supplied the reserved identity for **Pulse Digital CMS Player**,
Store ID **9N3B4R0PJ9XF**. It is stored in identity.json and regression-tested.
Use this file for the actual candidate; do not substitute a sample identity.
These values have not been independently checked against Partner Center.

Use the company-owned developer account at https://storedeveloper.microsoft.com.
The owner must complete identity verification and accept any legal agreements.
Reserve the app name and copy the exact Package/Identity/Name,
Package/Identity/Publisher and publisher display name from Partner Center.
These are public identifiers, not passwords or signing secrets.

The JSON file contains `name`, `publisher`, `publisherDisplayName`, plus the
reserved `displayName`. PFN and Store ID are reference metadata, not credentials.
Do not invent a publisher or generate a self-signed release certificate.

## Stage a candidate

Build the Windows x64 application using the existing Forge packaging pipeline,
not the MSI installer. Supply approved, genuine PNG artwork named StoreLogo.png
(50x50), Square150x150Logo.png (150x150), Square44x44Logo.png (44x44).

```sh
node scripts/test-store-packaging.cjs
node installer/windows/store/prepare.cjs APP_DIR IDENTITY_JSON ASSETS_DIR NEW_OUTPUT_DIR
```

The new output contains app/, Assets/ and AppxManifest.xml. It must not contain
device profiles, CMS keys, cached customer media or credentials. Inspect the
entire payload before submission. Header checks do not replace image validation.
Staging rejects symbolic links and common exposed device-state/credential files;
this is not a complete secret scanner and cannot inspect inside app.asar. Use a
clean reproducible build, never an installed player's application directory.
On an isolated Windows build machine with the Windows SDK:

```powershell
MakeAppx.exe pack /d STAGING_DIRECTORY /p PulsePlayer.msix
```

Alternatively, `build-msix.ps1` stages and packs into a new output directory,
checks the SDK tool's Microsoft signature, retains semantic validation and writes
the resulting MSIX SHA-256 to build-report.json. Pass AppDirectory, IdentityJson,
AssetsDirectory, NewOutputDirectory and the explicit Windows SDK MakeAppx path.
It never installs, signs or submits. It has not yet been executed on Windows.
Staging supports the existing unpacked Forge payload and validates its package
name/version/main entry, as well as a future ASAR layout. ASAR contents still
require separate provenance review.

Do not skip MakeAppx validation. Run Windows App Certification Kit checks and
review restricted `runFullTrust` capability justification (Electron desktop
signage playback). Upload through Partner Center only after owner review.
Unsigned staging output is NOT an installer for customer devices.

## Required qualification before deployment

- The candidate skips its HKCU Run-key startup write when Electron reports
  MSIX execution; the manifest declares PulsePlayerStartup instead. This is
  fixture-tested, not yet Windows-qualified. Users must launch once and can
  disable startup in Windows settings; the app does not re-enable it.
- Verify reboot/login launch and respect user-disabled startup. Windows
  autologin and BIOS restore-after-power-loss remain separate configuration.
- Qualify existing userData/profile identity and Documents/xibo_library access
  under MSIX virtualization; implement explicit, backed-up migration if needed.
  Never assume uninstall preserves package-local data.
- Verify native SQLite, localhost:9696, screenshots, CMS polling, orientation,
  two-screen spanning, software rendering and taskbar exclusion on Windows.
- Prevent MSI and MSIX instances/startup mechanisms from fighting; retain the
  working MSI/profile backup until a reviewed per-device migration passes.
- Qualify Store update/restart behavior and retention of enrollment/cache.
  Store approval is not proof of unattended signage recovery.
- Complete privacy policy, licensing/attributions, screenshots and listing;
  use private certification/test distribution before a customer rollout.

The runtime change exists only in this source candidate. No production device,
installed player or fleet update feed is changed here.

`profile-preflight.ps1` inventories expected file presence/sizes without reading
credential contents or copying files. Run from unpackaged PowerShell as the
playback user with observed absolute legacy profile, packaged profile and
library paths. It does not authorize migration or prove virtualization safety.
See SUBMISSION-CHECKLIST.md for listing drafts and the remaining release gates.

References:
- https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options
- https://learn.microsoft.com/en-us/windows/msix/package/signing-package-overview
- https://learn.microsoft.com/en-us/windows/apps/desktop/modernize/desktop-to-uwp-extensions
- https://learn.microsoft.com/en-us/windows/msix/desktop/desktop-to-uwp-behind-the-scenes
