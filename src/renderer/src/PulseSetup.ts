import QRCode from 'qrcode';

declare const __PULSE_SETUP_BETA__: boolean;
export const pulseSetupBeta = typeof __PULSE_SETUP_BETA__ !== 'undefined' && __PULSE_SETUP_BETA__;
export const pulseLabOrigin = 'https://ha-test.pulsedigitalcms.com';
export const pulsePortalUrl = `${pulseLabOrigin}/login`;

/** Lab build must never silently enroll with production or a lookalike hostname. */
export function isPulseLabClaim(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.origin === pulseLabOrigin && !url.username && !url.password
      && url.pathname === '/' && !url.search && !url.hash;
  } catch {
    return false;
  }
}

export function isTechnicianShortcut(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  return event.ctrlKey && event.shiftKey && !event.altKey && !event.metaKey && !event.repeat
    && event.code === 'KeyP' && !target?.isContentEditable
    && !target?.closest('input, textarea, select');
}

export function setupState(message: string) {
  const state = document.getElementById('pulse-setup-state');
  if (state) state.textContent = message;
}

export async function renderPortalQr() {
  const canvas = document.getElementById('pulse-portal-qr') as HTMLCanvasElement | null;
  if (!canvas) return;
  try {
    // Local encoding only. No activation code, polling token or shared CMS key in QR.
    await QRCode.toCanvas(canvas, pulsePortalUrl, {width: 144, margin: 4, errorCorrectionLevel: 'M'});
  } catch {
    canvas.hidden = true; // Written portal address remains usable if QR rendering fails.
  }
}
