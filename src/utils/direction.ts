import type { Dir4 } from './assetKeys';

/** Snap an angle in radians to one of the four sprite directions. */
export function angleToDir4(angle: number): Dir4 {
  const deg = ((angle * 180) / Math.PI + 360) % 360;
  if (deg >= 315 || deg < 45) return 'right';
  if (deg >= 45 && deg < 135) return 'down';
  if (deg >= 135 && deg < 225) return 'left';
  return 'up';
}

/**
 * The right-facing death row is the authored source of truth. Mirroring it
 * around the sprite's vertical (Y) axis produces the correct left-facing fall;
 * the sheet's dedicated left row falls toward the wrong side.
 */
export function deathRenderDirection(facing: Dir4): {
  animationDirection: Dir4;
  flipX: boolean;
} {
  return facing === 'left'
    ? { animationDirection: 'right', flipX: true }
    : { animationDirection: facing, flipX: false };
}
