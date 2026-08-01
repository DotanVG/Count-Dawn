export type PixelScaleDecision = {
  scale: number;
  displayWidth: number;
  displayHeight: number;
  mode: 'integer-upscale' | 'reciprocal-downscale';
  downscaleDivisor: number | null;
};

function greatestCommonDivisor(a: number, b: number): number {
  let x = Math.abs(Math.trunc(a));
  let y = Math.abs(Math.trunc(b));
  while (y !== 0) {
    const remainder = x % y;
    x = y;
    y = remainder;
  }
  return Math.max(1, x);
}

/** Selects the largest discrete scale that fits entirely inside the viewport. */
export function selectPixelScale(
  availableWidth: number,
  availableHeight: number,
  internalWidth: number,
  internalHeight: number,
): PixelScaleDecision {
  const safeWidth = Number.isFinite(availableWidth) ? Math.max(0, availableWidth) : 0;
  const safeHeight = Number.isFinite(availableHeight) ? Math.max(0, availableHeight) : 0;
  const fitScale = Math.min(safeWidth / internalWidth, safeHeight / internalHeight);

  if (fitScale >= 1) {
    const scale = Math.max(1, Math.floor(fitScale));
    return {
      scale,
      displayWidth: internalWidth * scale,
      displayHeight: internalHeight * scale,
      mode: 'integer-upscale',
      downscaleDivisor: null,
    };
  }

  // Restrict the fallback to divisors shared by both internal dimensions so
  // the resulting CSS width and height remain whole pixels.
  const maxDivisor = greatestCommonDivisor(internalWidth, internalHeight);
  let divisor = 2;
  while (
    divisor < maxDivisor &&
    (internalWidth % divisor !== 0 || internalHeight % divisor !== 0 || 1 / divisor > fitScale)
  ) {
    divisor += 1;
  }

  return {
    scale: 1 / divisor,
    displayWidth: internalWidth / divisor,
    displayHeight: internalHeight / divisor,
    mode: 'reciprocal-downscale',
    downscaleDivisor: divisor,
  };
}
