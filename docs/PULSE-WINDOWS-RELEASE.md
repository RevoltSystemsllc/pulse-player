# Pulse Player Windows release

The Pulse Player MSI is built from the `build-windows` job in
`.github/workflows/release.yml`. The job signs the application binaries before
they are packaged, builds the MSI, signs that MSI, and verifies its
Authenticode signature before saving it as an artifact or publishing it.

## Required GitHub environment

Create the `artifact-signing` environment in the `RevoltSystemsllc/pulse-player`
repository and configure the existing Azure Trusted Signing connection there:

- Secrets: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`
- Variables: `AZURE_SIGNING_ENDPOINT`, `AZURE_SIGNING_ACCOUNT`,
  `AZURE_SIGNING_PROFILE`

The certificate profile must be issued to Pulse Digital or the appropriate
company legal name. Never disable the signing or verification steps for a
customer-facing release.

## Pilot build

Run **Release & Publish** manually from the `codex/pulse-player-branding`
branch with:

- `tag`: `pilot-0.1.0`
- `platforms`: `windows`
- `upload`: unchecked

After the workflow succeeds, download the `pulse-player-windows-msi` artifact.
Verify the signer in Windows before installing it on `NYBC517-OUTDOOR`.

## Pilot checklist

1. Confirm the MSI's signer and SHA-256 hash.
2. Install while a technician can view the display.
3. Enroll the player with the intended Pulse CMS URL and display key.
4. Reboot the device and confirm the all-users Startup shortcut relaunches it.
5. Confirm Keyser Command Remote remains connected and the device reports back.
