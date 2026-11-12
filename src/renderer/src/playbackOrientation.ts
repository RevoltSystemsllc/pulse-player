import { playbackViewport } from '../../shared/playbackOrientation';

/** Rotate only playback; configuration/status/navigation stay upright and usable. */
export function applyPlaybackOrientation(value: unknown, width: number, height: number) {
  const viewport = playbackViewport(value, width, height);
  for (const id of ['screen_container', 'pulse-heartbeat']) {
    const element = document.getElementById(id);
    if (!element) continue;
    Object.assign(element.style, {
      position: 'fixed', left: '50%', top: '50%',
      width: `${viewport.width}px`, height: `${viewport.height}px`,
      transformOrigin: 'center center',
      transform: `translate(-50%, -50%) rotate(${viewport.degrees}deg)`,
    });
  }
  return viewport;
}
