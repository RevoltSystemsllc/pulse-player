# Pulse Player Store submission preparation

Status: internal draft; not submitted, certified or installed.

## Listing draft

Reserved name: Pulse Digital CMS Player.
Store ID: 9N3B4R0PJ9XF.
Publisher display name: Pulse Digital CMS.
The owner supplied the exact Partner Center identity; see identity.json.
Account verification/reservation was reported by the owner, not independently
checked in Partner Center. This is not Store certification or publication.

Short description: Digital signage playback for Pulse Digital CMS.

Description: Connect a Windows signage computer to your Pulse Digital CMS
account to play assigned layouts and media. Supports portrait and landscape
playback and a combined canvas across multiple connected monitors.
An authorized Pulse Digital CMS account and device enrollment are required.

Do not advertise offline recovery, seamless updates or unattended Store startup
as Store-qualified features until the packaged Windows pilot passes.
Do not add pricing or licensing promises without owner review.

## Owner information still required

- Compare the supplied identity.json with Partner Center before submission.
- Approved public support URL/contact and privacy-policy URL.
- Approved Store screenshots and logo assets (no customer information).
- Markets, visibility, category and account/access requirements.
- Certification tester access using a dedicated restricted demo environment,
  never an owner's production credentials or a customer CMS key.

## Privacy and licensing review

Before publishing a privacy policy, inventory actual enrollment identifiers,
CMS connection information, local media/cache, logs, playback statistics,
screenshots and remote command behavior. Confirm destinations, retention,
access controls, deletion process and support contact with the owner. Do not
publish guessed retention periods or claim that no data leaves the device.

Retain upstream copyright notices and licenses. This source includes
AGPL-derived components; review corresponding-source availability, required
notices and Store distribution terms before submission. Rebranding does not
remove upstream obligations. Obtain legal review if compatibility is unclear.

## Restricted capability justification draft

runFullTrust is requested for the existing Electron desktop application,
native media playback, local SQLite state, multi-monitor presentation and
CMS communication. No elevation capability or firewall exception is declared.
Confirm that this accurately describes the final submitted payload.

## One-device release gate

Record the exact source commit, payload hashes, real Store identity and
certification results. Qualify a Store-distributed test package on an isolated
Windows signage PC. Verify first launch, enrollment/profile continuity,
polling, native SQLite, cached playback, screenshots, orientation, full-wall
bounds, restart, login startup, user-disabled startup and an update cycle.

Back up the existing profile/cache while Pulse is stopped before any migration.
Inventory external autostart tasks/Run keys and avoid concurrent MSI/MSIX
instances. Keep rollback files but do not run two writers against the profile.
Do not remove the working MSI or alter any customer device for packaging tests.
