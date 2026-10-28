# Pulse Player Branding

This repository is the Pulse Player fork of the Xibo Electron Player.

## Product identity

- Display name: `Pulse Player`
- Windows manufacturer: `Pulse Digital`
- Windows MSI upgrade code: unique to Pulse Player
- Windows executable: `pulse-player.exe`

The unique MSI identity is intentional for the pilot. It prevents installation
from silently replacing an existing Xibo Windows player. A later migration
release can include a deliberately tested conversion path after a device-level
pilot succeeds.

## Licensing

Pulse Player remains distributed under the upstream AGPLv3 terms. The upstream
copyright headers and the repository `LICENSE` are preserved. The in-player
open-source notice is intentional and must remain available in distributed
builds.

## Next branding tasks

1. Add the approved Pulse logo in ICO and PNG formats under `resources/`.
2. Replace the temporary CSS mark with the approved logo in the setup screen.
3. Update the Windows installer icon to the Pulse ICO asset.
4. Add a Keyser Command enrollment file so a new device is pre-labeled with its
   customer, location, and asset name before its first CMS connection.
