import type { Dir4 } from './assetKeys';

/** Snap an angle in radians to one of the four sprite directions. */
export function angleToDir4(angle: number): Dir4 {
  const deg = ((angle * 180) / Math.PI + 360) % 360;
  if (deg >= 315 || deg < 45) return 'right';
  if (deg >= 45 && deg < 135) return 'down';
  if (deg >= 135 && deg < 225) return 'left';
  return 'up';
}
