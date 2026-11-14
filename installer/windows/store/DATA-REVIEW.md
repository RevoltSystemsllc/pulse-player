# Store privacy review: observed data flows

Internal technical inventory, not a published privacy policy or legal opinion.
Observed in the Store candidate source. No device secrets or customer records
were accessed to produce this inventory.

| Data category | Observed use | Source evidence |
| --- | --- | --- |
| Device/enrollment identifiers | Registration sends hardware key, display name, MAC address, player type/version/code, XMR channel and OS to the configured CMS. | src/main/xmds/xmds.ts, registerDisplay |
| CMS connection information | Config and CMS config files persist under Electron userData; configuration includes CMS URL/key and optional proxy credentials. | src/main/config/config.ts |
| Screenshots | Captured screen image is submitted to the configured CMS when available/requested. Images can contain customer content. | src/main/xmds/xmds.ts, screenshot |
| Diagnostic logs | Logs are selected according to logging settings and submitted to the configured CMS. Review messages for accidental sensitive values before publication. | src/main/xmds/xmds.ts, handleSubmitLogs/submitLogs |
| Playback statistics | Statistics XML is sent to the configured CMS. | src/main/xmds/xmds.ts, submitStats |
| Cached content/local state | Media library defaults to Documents/xibo_library on Windows; local SQLite state uses the player data directory. | src/main/config/config.ts constructor |

Do not describe this app as collecting no data. The configured CMS receives
registration/status traffic and may receive screenshots, logs and statistics.
The inventory is not an exhaustive dependency, embedded-content or network audit.

## Technical qualifications still needed

- Confirm package virtualization, effective profile paths, file permissions,
  credential protection and uninstall/retention behavior on a Windows pilot.
- The local content server uses server.listen(port) without an explicit bind
  address in src/main/express.ts. Do not claim it is loopback-only. Assess LAN
  reachability and any intended remote use before changing its binding; no
  firewall exception is added by the Store manifest.
- Review external/embedded content and dependency network behavior separately.
- Verify that the release payload retains LICENSE and NOTICE. NOTICE names the
  AGPL-derived upstream and corresponding-source repository; this does not by
  itself establish complete licensing or Store-terms compliance.

## Owner decisions needed for the public policy

Confirm the responsible business, public privacy/support contact, applicable
CMS hosting/deployment model, processors, retention/deletion practices and
how customers exercise data requests. Do not invent these details. The final
policy must match actual operations and be approved before publishing its URL.
