export type PolishQuality = 'high' | 'reduced' | 'minimal';

/**
 * Presentation-only tuning. Keeping these values together makes the full
 * polish layer easy to profile without touching combat or round balance.
 */
export const POLISH = {
  quality: 'high' as PolishQuality,
  camera: {
    hitShakeIntensity: 0.0024,
    killShakeIntensity: 0.0048,
    bossHitShakeIntensity: 0.0055,
    bossKillShakeIntensity: 0.009,
    ultimateShakeIntensity: 0.011,
    playerHitShakeIntensity: 0.005,
    dashShakeIntensity: 0.0018,
    hitShakeDurationMs: 55,
    killShakeDurationMs: 95,
    bossKillShakeDurationMs: 190,
    ultimateShakeDurationMs: 170,
    zoomPunch: 1.018,
    ultimateZoom: 1.045,
    restoreDurationMs: 230,
  },
  hitStop: {
    regularMs: 28,
    killMs: 48,
    bossMs: 62,
    ultimateMs: 68,
  },
  flashes: {
    hitMs: 55,
    killMs: 85,
    playerHitMs: 105,
    lightningMs: 65,
    maxAlpha: 0.24,
  },
  particles: {
    hitCount: 7,
    killCount: 15,
    bossHitCount: 12,
    bossKillCount: 28,
    playerHitCount: 10,
    dashPuffCount: 10,
    lightningCount: 18,
    bloodArrivalCount: 8,
    hitLifetimeMs: 390,
    smokeLifetimeMs: 920,
    maxActive: 190,
    maxAmbientActive: 42,
  },
  atmosphere: {
    nightOverlayAlpha: 0.42,
    dawnOverlayAlpha: 0.18,
    vignetteStrength: 0.2,
    lowHealthVignetteStrength: 0.16,
    torchGlowAlpha: 0.16,
    windowGlowAlpha: 0.3,
    ambientDustFrequencyMs: 420,
  },
  fx: {
    glowStrength: 2.2,
    bloomStrength: 0,
    enableFullscreenBloom: false,
  },
  ultimate: {
    anticipationMs: 430,
    waveDurationMs: 260,
    aftermathMs: 520,
    slowMotionDurationMs: 130,
    maxSimultaneousBolts: 4,
    killsBosses: true,
    activationInvulnerability: false,
  },
  limits: {
    maxSimultaneousScreenEffects: 5,
    cameraShakeCooldownMs: 38,
    hitStopCooldownMs: 72,
  },
  mobile: {
    particleMultiplier: 0.55,
    cameraShakeMultiplier: 0.68,
    afterImageMultiplier: 0.6,
    maxActiveParticles: 105,
    maxSimultaneousBolts: 2,
  },
  reducedMotion: {
    particleMultiplier: 0.65,
    cameraShakeMultiplier: 0.2,
    zoomMultiplier: 0.2,
    flashMultiplier: 0.45,
  },
} as const;

export interface PolishProfile {
  quality: PolishQuality;
  isTouch: boolean;
  reducedMotion: boolean;
  enableCameraShake: boolean;
  enableHitStop: boolean;
  enableAmbientParticles: boolean;
  enableExpensiveFx: boolean;
  enableZoomPunch: boolean;
  particleMultiplier: number;
  cameraShakeMultiplier: number;
  zoomMultiplier: number;
  flashMultiplier: number;
  maxActiveParticles: number;
  maxSimultaneousBolts: number;
}

export interface PolishProfileOptions {
  quality?: PolishQuality;
  isTouch?: boolean;
  reducedMotion?: boolean;
}

/** Pure profile resolution, kept separate so quality behavior is unit-testable. */
export function resolvePolishProfile(options: PolishProfileOptions = {}): PolishProfile {
  const quality = options.quality ?? POLISH.quality;
  const isTouch = options.isTouch ?? false;
  const reducedMotion = options.reducedMotion ?? false;
  const qualityMultiplier = quality === 'high' ? 1 : quality === 'reduced' ? 0.65 : 0.35;
  const motionParticleMultiplier = reducedMotion
    ? POLISH.reducedMotion.particleMultiplier
    : 1;
  const touchParticleMultiplier = isTouch ? POLISH.mobile.particleMultiplier : 1;

  return {
    quality,
    isTouch,
    reducedMotion,
    enableCameraShake: quality !== 'minimal',
    enableHitStop: quality === 'high' && !isTouch && !reducedMotion,
    enableAmbientParticles: quality === 'high' && !isTouch && !reducedMotion,
    enableExpensiveFx: quality === 'high' && !isTouch,
    enableZoomPunch: quality !== 'minimal',
    particleMultiplier:
      qualityMultiplier * motionParticleMultiplier * touchParticleMultiplier,
    cameraShakeMultiplier:
      (isTouch ? POLISH.mobile.cameraShakeMultiplier : 1) *
      (reducedMotion ? POLISH.reducedMotion.cameraShakeMultiplier : 1),
    zoomMultiplier: reducedMotion ? POLISH.reducedMotion.zoomMultiplier : 1,
    flashMultiplier: reducedMotion ? POLISH.reducedMotion.flashMultiplier : 1,
    maxActiveParticles: isTouch
      ? POLISH.mobile.maxActiveParticles
      : Math.round(POLISH.particles.maxActive * qualityMultiplier),
    maxSimultaneousBolts: isTouch
      ? POLISH.mobile.maxSimultaneousBolts
      : quality === 'minimal'
        ? 1
        : POLISH.ultimate.maxSimultaneousBolts,
  };
}

/** Browser quality override for profiling: ?polish=high|reduced|minimal. */
export function getPolishProfile(isTouch: boolean): PolishProfile {
  let quality: PolishQuality | undefined;
  let reducedMotion = false;

  if (typeof window !== 'undefined') {
    const requested = new URLSearchParams(window.location.search).get('polish');
    if (requested === 'high' || requested === 'reduced' || requested === 'minimal') {
      quality = requested;
    }
    reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  return resolvePolishProfile({ quality, isTouch, reducedMotion });
}

export function scaledParticleCount(profile: PolishProfile, baseCount: number): number {
  if (baseCount <= 0) return 0;
  return Math.max(1, Math.round(baseCount * profile.particleMultiplier));
}
