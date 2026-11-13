# Windows wall presentation pilot

This candidate keeps Windows video walls borderless and above the taskbar while
preserving the existing CMS geometry and playback-only rotation controls.
Single-display and non-Windows players do not gain always-on-top behavior.
Display additions, removals, and metric changes reapply geometry without changing
Windows display resolution, scale, orientation, shell settings, or protections.

For an affected Windows device only, place the following non-secret preference in
`rendering-preferences.json` under the player's Electron user-data directory:

```json
{"softwareRendering": true}
```

The preference is loaded before GPU initialization, so it applies to task,
shortcut, Run-key, and manual starts. Missing, malformed, or non-boolean values
leave the default graphics behavior unchanged. It must not be deployed fleet-wide
without device qualification. Software rendering can increase CPU use.

Café 641's existing 4.0.19 task uses `--disable-gpu` as an interim workaround.
Retain that argument during initial 4.0.20 installation; test without it only after
the device-local preference is verified. Preserve the previous installer, app,
profile, and task export. Do not reset enrollment, clear media, change shared CMS
profiles, disable Windows security, or change BIOS settings.

Required qualification: verified installer checksum and version; current profile
identity retained; both panels fully covered; no white stripe/taskbar through
several video loops; configuration remains accessible; player restart; approved
Windows reboot with unattended login and startup. A code build does not constitute
physical-device or power-loss qualification. AC recovery remains a separate BIOS
and controlled power-loss check requiring on-site access.
