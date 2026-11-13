export function softwareRenderingRequested(platform: string, preferences: string): boolean {
  if (platform !== 'win32') return false;
  try {
    const parsed: unknown = JSON.parse(preferences);
    return parsed !== null && typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      (parsed as { softwareRendering?: unknown }).softwareRendering === true;
  } catch {
    return false;
  }
}

export function wallPresentation(platform: string, mode: unknown, displayCount: number) {
  return {
    alwaysOnTop: platform === 'win32' && mode === 'span-all' && displayCount > 1,
    ...(platform === 'win32' ? { thickFrame: false, roundedCorners: false } : {}),
  };
}
