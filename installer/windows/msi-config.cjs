/**
 * Identity and versioning for the Windows MSI.
 *
 * Kept in its own module so the build, CI and anyone reading the packaging
 * document see the same numbers, and so changing them is a reviewable diff
 * rather than an edit inside a build script.
 */

/**
 * The MSI's version is deliberately NOT the player's version.
 *
 * Pulse Player has a distinct UpgradeCode from the legacy Xibo product, so its
 * MSI can use a valid, independent version series. Windows Installer requires
 * major and minor values below 256; keeping the version compliant avoids
 * unpredictable install and upgrade behavior on the pilot devices.
 */
const MSI_VERSION_MAJOR = 5;
const MSI_VERSION_MINOR = 0;

/**
 * Inherited from the legacy player's Advanced Installer project. This single
 * value is what makes the new package an upgrade of the old player rather than
 * a second product beside it, and it can never change.
 */
// Pulse Player intentionally uses its own product identity so an early pilot
// cannot silently replace an existing Xibo deployment.
const UPGRADE_CODE = '9F078909-13B7-46C6-8A4E-E189DC1B1924';

const PRODUCT_NAME = 'Pulse Player';
const MANUFACTURER = 'Pulse Digital';

/**
 * Build the MSI version from package.json.
 *
 * The build field tracks `versionCode`, which already rises with every release,
 * so the version increases on its own and nobody has to remember to bump it.
 *
 * @param {object} packageJSON The player's package.json, parsed.
 * @return {string} A three-field MSI ProductVersion.
 */
function msiVersion(packageJSON) {
  const versionCode = Number(packageJSON.versionCode);

  if (!Number.isInteger(versionCode) || versionCode < 0) {
    throw new Error(
      `versionCode in package.json must be a non-negative integer, got ` +
        `${JSON.stringify(packageJSON.versionCode)}. The MSI version is derived ` +
        `from it.`);
  }

  // The build field is 16 bits. Overflowing it would make a newer release look
  // older than its predecessor and silently stop upgrading fielded screens.
  if (versionCode > 65535) {
    throw new Error(
      `versionCode ${versionCode} exceeds the 65535 maximum for the MSI build ` +
        `field. Raise MSI_VERSION_MINOR in installer/windows/msi-config.cjs and ` +
        `restart the build field from a lower number.`);
  }

  return `${MSI_VERSION_MAJOR}.${MSI_VERSION_MINOR}.${versionCode}`;
}

module.exports = {
  MANUFACTURER,
  MSI_VERSION_MAJOR,
  MSI_VERSION_MINOR,
  PRODUCT_NAME,
  UPGRADE_CODE,
  msiVersion,
};
