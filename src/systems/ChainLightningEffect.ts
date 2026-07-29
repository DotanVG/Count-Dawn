import Phaser from 'phaser';
import { DEPTHS } from '../game/constants';
import { TEXTURES } from '../utils/assetKeys';
import {
  CHAIN_LIGHTNING_DEFAULT_HOP_MS,
  chainLightningDuration,
  type ChainPoint,
} from './chainLightning';

const PURPLE = {
  deepGlow: 0x4b168f,
  glow: 0x7a32e8,
  body: 0xb060ff,
  core: 0xf7edff,
  sparks: [0x6d28d9, 0x9d6bff, 0xc98cff, 0xffffff],
} as const;

export interface PurpleChainLightningOptions {
  /**
   * Optional first source. Set connectOrigin to true to draw the first hop
   * from it; otherwise it is only documentary and targets remain the chain.
   */
  origin?: ChainPoint;
  connectOrigin?: boolean;
  /** Delay between one enemy lighting up and the next. */
  hopDelayMs?: number;
  /** Full-screen micro-flash and shake on the first/final hops. */
  cameraFx?: boolean;
  /** Called as each ordered target receives the visual strike. */
  onImpact?: (target: ChainPoint, index: number) => void;
  /** Called after the final arc, corona, particles, and afterimage have faded. */
  onComplete?: () => void;
}

export interface ChainLightningPlayback {
  /** Stable choreography contract for callers that prefer a scene timer. */
  durationMs: number;
  /** Removes pending hops and any still-visible lightning without completing. */
  cancel: () => void;
}

/**
 * Plays a purple, non-damaging chain through the supplied ORDERED points.
 *
 * Points are copied immediately, so the caller may remove or deactivate its
 * enemy objects as soon as onImpact/onComplete says to without invalidating
 * later arcs. Use orderChainTargets when nearest-neighbour ordering is wanted.
 */
export function playPurpleChainLightning(
  scene: Phaser.Scene,
  orderedTargets: readonly ChainPoint[],
  options: PurpleChainLightningOptions = {},
): ChainLightningPlayback {
  const targets = orderedTargets
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    .map((point) => ({ x: point.x, y: point.y }));
  const hopDelayMs = Math.max(24, options.hopDelayMs ?? CHAIN_LIGHTNING_DEFAULT_HOP_MS);
  const connectOrigin = options.connectOrigin === true && isFinitePoint(options.origin);
  const durationMs = chainLightningDuration(targets.length, hopDelayMs);

  const timers = new Set<Phaser.Time.TimerEvent>();
  const visuals = new Set<Phaser.GameObjects.GameObject>();
  let cancelled = false;
  let completed = false;

  const destroyVisual = (visual: Phaser.GameObjects.GameObject): void => {
    visuals.delete(visual);
    if (visual.active) visual.destroy();
  };

  const schedule = (delay: number, callback: () => void): void => {
    let timer: Phaser.Time.TimerEvent;
    timer = scene.time.delayedCall(Math.max(0, delay), () => {
      timers.delete(timer);
      if (!cancelled) callback();
    });
    timers.add(timer);
  };

  const cancel = (): void => {
    if (cancelled || completed) return;
    cancelled = true;
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, cancel);
    for (const timer of timers) timer.remove(false);
    timers.clear();
    for (const visual of [...visuals]) destroyVisual(visual);
  };

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cancel);

  if (targets.length === 0) {
    completed = true;
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, cancel);
    options.onComplete?.();
    return { durationMs, cancel };
  }

  const arcStart = connectOrigin
    ? { x: (options.origin as ChainPoint).x, y: (options.origin as ChainPoint).y }
    : targets[0];

  for (let index = 0; index < targets.length; index++) {
    const target = targets[index];
    const delay = index * hopDelayMs;
    const from = index === 0 ? arcStart : targets[index - 1];
    const shouldDrawArc = index > 0 || connectOrigin;

    schedule(delay, () => {
      if (shouldDrawArc) {
        drawArc(scene, from, target, 1, visuals, destroyVisual);
        // Electricity never holds one silhouette: two fast re-jitters make
        // the bolt crawl between targets before its violet afterimage fades.
        schedule(44, () => drawArc(scene, from, target, 0.72, visuals, destroyVisual));
        schedule(92, () => drawArc(scene, from, target, 0.42, visuals, destroyVisual));
      }

      strikeCorona(scene, target, visuals, destroyVisual);
      options.onImpact?.(target, index);

      if (options.cameraFx !== false && index === 0) {
        scene.cameras.main.flash(105, 196, 151, 255);
        scene.cameras.main.shake(150, 0.0045);
      }
      if (options.cameraFx !== false && index === targets.length - 1 && targets.length > 1) {
        scene.cameras.main.shake(230, 0.007);
      }
    });
  }

  schedule(durationMs, () => {
    completed = true;
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, cancel);
    options.onComplete?.();
  });

  return { durationMs, cancel };
}

function drawArc(
  scene: Phaser.Scene,
  from: ChainPoint,
  to: ChainPoint,
  intensity: number,
  visuals: Set<Phaser.GameObjects.GameObject>,
  destroyVisual: (visual: Phaser.GameObjects.GameObject) => void,
): void {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  if (distance < 1) return;

  const graphics = scene.add
    .graphics()
    .setDepth(DEPTHS.attackFx + 4)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setAlpha(intensity);
  visuals.add(graphics);

  const path = jaggedPath(from, to);
  stroke(graphics, path, 18, PURPLE.deepGlow, 0.13);
  stroke(graphics, path, 11, PURPLE.glow, 0.24);
  stroke(graphics, path, 6, PURPLE.body, 0.88);
  stroke(graphics, path, 2, PURPLE.core, 1);

  // Short violet tributaries break off the main channel. Drawing one from
  // several interior vertices avoids the flat "single zig-zag line" look.
  const forkCount = Phaser.Math.Clamp(Math.round(distance / 150), 1, 3);
  for (let fork = 0; fork < forkCount; fork++) {
    if (path.length < 4) break;
    const vertex = path[Phaser.Math.Between(1, path.length - 2)];
    const baseAngle = Math.atan2(to.y - from.y, to.x - from.x);
    const side = Math.random() < 0.5 ? -1 : 1;
    const angle = baseAngle + side * Phaser.Math.FloatBetween(0.7, 1.35);
    const length = Phaser.Math.FloatBetween(28, 72);
    const end = {
      x: vertex.x + Math.cos(angle) * length,
      y: vertex.y + Math.sin(angle) * length,
    };
    const forkPath = jaggedPath(vertex, end, 4);
    stroke(graphics, forkPath, 6, PURPLE.glow, 0.2);
    stroke(graphics, forkPath, 2, PURPLE.core, 0.85);
  }

  // Tiny hot beads caught in the channel make the arc feel emissive even
  // during its fade, especially against the cold-open darkness.
  graphics.fillStyle(PURPLE.core, 0.92);
  for (let index = 1; index < path.length - 1; index += 2) {
    graphics.fillCircle(path[index].x, path[index].y, Phaser.Math.FloatBetween(1.2, 2.5));
  }

  scene.tweens.add({
    targets: graphics,
    alpha: 0,
    delay: 48,
    duration: 175,
    ease: 'Quad.easeOut',
    onComplete: () => destroyVisual(graphics),
  });
}

function strikeCorona(
  scene: Phaser.Scene,
  point: ChainPoint,
  visuals: Set<Phaser.GameObjects.GameObject>,
  destroyVisual: (visual: Phaser.GameObjects.GameObject) => void,
): void {
  const corona = scene.add
    .graphics({ x: point.x, y: point.y })
    .setDepth(DEPTHS.attackFx + 5)
    .setBlendMode(Phaser.BlendModes.ADD);
  visuals.add(corona);
  corona.fillStyle(PURPLE.core, 0.95);
  corona.fillCircle(0, 0, 7);
  corona.fillStyle(PURPLE.body, 0.36);
  corona.fillCircle(0, 0, 24);
  corona.lineStyle(4, PURPLE.core, 0.88);
  corona.strokeCircle(0, 0, 13);
  corona.lineStyle(8, PURPLE.glow, 0.22);
  corona.strokeCircle(0, 0, 24);

  scene.tweens.add({
    targets: corona,
    scale: { from: 0.55, to: 1.85 },
    alpha: 0,
    duration: 300,
    ease: 'Cubic.easeOut',
    onComplete: () => destroyVisual(corona),
  });

  const sparks = scene.add
    .particles(point.x, point.y, TEXTURES.particle, {
      speed: { min: 75, max: 270 },
      angle: { min: 0, max: 360 },
      lifespan: { min: 180, max: 410 },
      scale: { start: 1.25, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [...PURPLE.sparks],
      blendMode: 'ADD',
      emitting: false,
    })
    .setDepth(DEPTHS.attackFx + 5);
  visuals.add(sparks);
  sparks.explode(Phaser.Math.Between(14, 21));
  scene.time.delayedCall(470, () => destroyVisual(sparks));
}

function jaggedPath(from: ChainPoint, to: ChainPoint, minimumSteps = 5): ChainPoint[] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  const steps = Phaser.Math.Clamp(Math.round(distance / 24), minimumSteps, 18);
  const normalX = -dy / (distance || 1);
  const normalY = dx / (distance || 1);
  const path: ChainPoint[] = [{ x: from.x, y: from.y }];

  for (let step = 1; step < steps; step++) {
    const t = step / steps;
    // Pinches jitter to zero at both ends so every redraw still lands exactly
    // on the enemy instead of visibly swimming around its feet.
    const amplitude = Math.sin(t * Math.PI) * Phaser.Math.Clamp(distance * 0.16, 10, 34);
    const offset = Phaser.Math.FloatBetween(-amplitude, amplitude);
    path.push({
      x: from.x + dx * t + normalX * offset,
      y: from.y + dy * t + normalY * offset,
    });
  }

  path.push({ x: to.x, y: to.y });
  return path;
}

function stroke(
  graphics: Phaser.GameObjects.Graphics,
  path: readonly ChainPoint[],
  width: number,
  color: number,
  alpha: number,
): void {
  graphics.lineStyle(width, color, alpha);
  graphics.beginPath();
  graphics.moveTo(path[0].x, path[0].y);
  for (let index = 1; index < path.length; index++) {
    graphics.lineTo(path[index].x, path[index].y);
  }
  graphics.strokePath();
}

function isFinitePoint(point: ChainPoint | undefined): point is ChainPoint {
  return Boolean(point && Number.isFinite(point.x) && Number.isFinite(point.y));
}
