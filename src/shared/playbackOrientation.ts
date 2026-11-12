export type PlaybackOrientation = 'landscape' | 'portrait' | 'reverse_landscape' | 'reverse_portrait';

export function playbackOrientation(value: unknown): PlaybackOrientation {
  return typeof value === 'string' &&
    ['landscape', 'portrait', 'reverse_landscape', 'reverse_portrait'].includes(value)
    ? value as PlaybackOrientation : 'landscape';
}

export function playbackViewport(value: unknown, width: number, height: number) {
  if (![width, height].every(n => Number.isInteger(n) && n > 0 && n <= 32768)) {
    throw new Error('Invalid playback viewport');
  }
  const orientation = playbackOrientation(value);
  const degrees = {landscape: 0, portrait: 90, reverse_landscape: 180, reverse_portrait: 270}[orientation];
  return {orientation, degrees, width: degrees % 180 ? height : width,
    height: degrees % 180 ? width : height};
}
