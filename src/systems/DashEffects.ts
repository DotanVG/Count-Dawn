import type Phaser from 'phaser';
import { DASH, DASH_FX } from '../data/balance.ts';

type Ghost = { image: Phaser.GameObjects.Image; bornAt: number };
type Particle = {
  kind: 'dust' | 'stone' | 'spark' | 'line';
  bornAt: number; lifeMs: number;
  x: number; y: number; vx: number; vy: number; gravity: number;
  size: number; growth: number; tint: number; alpha: number;
};
type Burst = typeof DASH_FX.dust | typeof DASH_FX.stones | typeof DASH_FX.skid;

/**
 * One player's scene-wide, bounded cosmetic pool. The render double is the
 * visual pivot: scaling an Arcade Sprite would also resize its physics body.
 * Only visibility changes on the source; form scale, animation, aim, velocity,
 * rotation and body stay under Player's existing ownership.
 */
export class DashEffects {
  private readonly visual: Phaser.GameObjects.Image;
  private readonly ink: Phaser.GameObjects.Graphics;
  private readonly ghosts: Ghost[];
  private readonly particles: Particle[];
  private rng = DASH_FX.rngSeed as number;
  private startedAt = -1;
  private skidAt = -1;
  private nextGhostAt = 0;
  private previousAt = 0;
  private previousX = 0;
  private previousY = 0;
  private dx = 1;
  private dy = 0;
  private ownsVisibility = false;
  private wasVisible = true;
  private destroyed = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly source: Phaser.GameObjects.Sprite,
  ) {
    this.visual = scene.add.image(0, 0, source.texture.key, source.frame.name).setVisible(false);
    this.ink = scene.add.graphics().setDepth(source.depth - 0.5);
    this.ghosts = Array.from({ length: DASH_FX.ghost.limit }, () => ({
      image: scene.add.image(0, 0, source.texture.key, source.frame.name)
        .setDepth(source.depth - 1).setTint(DASH_FX.ghost.tint).setVisible(false),
      bornAt: -1,
    }));
    this.particles = Array.from({ length: DASH_FX.particles.limit }, () => ({
      kind: 'dust', bornAt: -1, lifeMs: 1, x: 0, y: 0, vx: 0, vy: 0,
      gravity: 0, size: 0, growth: 1, tint: 0, alpha: 0,
    }));
    scene.events.on('postupdate', this.update, this);
    scene.events.once('shutdown', this.destroy, this);
    source.once('destroy', this.destroy, this);
  }

  start(dx: number, dy: number): void {
    if (this.destroyed) return;
    this.cancel();
    this.dx = dx;
    this.dy = dy;
    this.startedAt = this.scene.time.now;
    this.previousAt = this.startedAt;
    this.previousX = this.source.x;
    this.previousY = this.source.y;
    this.nextGhostAt = this.startedAt + DASH_FX.ghost.intervalMs;
    this.wasVisible = this.source.visible;
    this.ownsVisibility = true;
    this.source.setVisible(false);
    this.syncVisual(1, 1, 0);
    this.emitGhost(this.startedAt, this.source.x, this.source.y);
    this.burst(DASH_FX.dust, 'dust', -1);
    this.burst(DASH_FX.stones, 'stone', -1);
    for (let i = 0; i < DASH_FX.lines.count; i++) {
      const p = this.freeParticle();
      if (!p) break;
      p.kind = 'line';
      p.bornAt = this.startedAt;
      p.lifeMs = Math.min(DASH.durationMs, DASH_FX.lines.lifeMs);
      p.x = this.range(0, DASH_FX.lines.travel);
      p.y = this.range(-DASH_FX.lines.spread, DASH_FX.lines.spread);
      p.size = this.range(...DASH_FX.lines.length);
      p.tint = DASH_FX.lines.tint;
      p.alpha = DASH_FX.lines.alpha;
    }
    this.update();
  }

  /** Called only after Player's guarded dash restore has returned to vampire. */
  finish(): void {
    if (this.destroyed || this.startedAt < 0) return;
    this.startedAt = -1;
    this.skidAt = this.scene.time.now;
    for (const p of this.particles) if (p.kind === 'line') p.bornAt = -1;
    this.burst(DASH_FX.skid, 'spark', 1);
    this.update();
  }

  /** Death, coffin ownership, round reset: no pending callbacks or stale pose. */
  cancel(): void {
    if (this.destroyed) return;
    this.startedAt = this.skidAt = -1;
    this.restoreVisibility();
    this.ink.clear();
    for (const g of this.ghosts) {
      g.bornAt = -1;
      g.image.setVisible(false);
    }
    for (const p of this.particles) p.bornAt = -1;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.cancel();
    this.destroyed = true;
    this.scene.events.off('postupdate', this.update, this);
    this.scene.events.off('shutdown', this.destroy, this);
    this.source.off('destroy', this.destroy, this);
    this.visual.destroy();
    this.ink.destroy();
    for (const g of this.ghosts) g.image.destroy();
  }

  private restoreVisibility(): void {
    if (this.ownsVisibility) this.source.setVisible(this.wasVisible);
    this.ownsVisibility = false;
    this.visual.setVisible(false);
  }

  private update(): void {
    if (this.destroyed) return;
    if (!this.source.active) {
      this.cancel();
      return;
    }
    const now = this.scene.time.now;
    this.ink.clear();
    if (this.startedAt >= 0) {
      const age = now - this.startedAt;
      const stretch = Math.sin(Math.PI * Math.min(1, age / DASH.durationMs));
      // Project the stretch onto the dash direction for vertical/diagonal dashes.
      const along = 1 + (DASH_FX.stretch.width - 1) * stretch;
      const across = 1 + (DASH_FX.stretch.height - 1) * stretch;
      this.syncVisual(
        this.dx * this.dx * along + this.dy * this.dy * across,
        this.dy * this.dy * along + this.dx * this.dx * across, 0,
      );
      // Bound catch-up, interpolate along the last render step, and never
      // snapshot the vampire if a slow frame straddles the restore timer.
      let emitted = 0;
      while (this.nextGhostAt <= now && this.nextGhostAt < this.startedAt + DASH.durationMs
        && emitted < DASH_FX.ghost.limit) {
        const weight = (this.nextGhostAt - this.previousAt) / Math.max(1, now - this.previousAt);
        this.emitGhost(this.nextGhostAt,
          this.previousX + (this.source.x - this.previousX) * weight,
          this.previousY + (this.source.y - this.previousY) * weight);
        this.nextGhostAt += DASH_FX.ghost.intervalMs;
        emitted++;
      }
      this.previousAt = now;
      this.previousX = this.source.x;
      this.previousY = this.source.y;
      if (age < DASH_FX.smear.lifeMs) this.drawSmear(age);
    } else if (this.skidAt >= 0) {
      const age = now - this.skidAt;
      const t = Math.min(1, age / DASH_FX.stretch.recoverMs);
      // A small damped spring, ending at exactly neutral (no pose tween races).
      const width = 1 - (1 - DASH_FX.stretch.squash) * Math.cos(t * Math.PI * 3) * (1 - t) ** 2;
      const lean = Math.max(0, 1 - age / DASH_FX.skid.lifeMs) ** 2;
      this.syncVisual(width, 1, -this.dx * DASH_FX.skid.angleDeg * Math.PI / 180 * lean);
      if (age >= Math.max(DASH_FX.stretch.recoverMs, DASH_FX.skid.lifeMs)) {
        this.skidAt = -1;
        this.restoreVisibility();
      }
    }
    for (const g of this.ghosts) {
      if (g.bornAt < 0) continue;
      const t = (now - g.bornAt) / DASH_FX.ghost.lifeMs;
      if (t >= 1) {
        g.bornAt = -1;
        g.image.setVisible(false);
      } else g.image.setAlpha(DASH_FX.ghost.alpha * (1 - t) ** 2);
    }
    this.drawParticles(now);
  }

  private syncVisual(width: number, height: number, lean: number): void {
    const s = this.source;
    this.visual.setTexture(s.texture.key, s.frame.name).setOrigin(s.originX, s.originY)
      .setPosition(s.x, s.y).setScale(s.scaleX * width, s.scaleY * height)
      .setRotation(s.rotation + lean).setFlip(s.flipX, s.flipY)
      .setScrollFactor(s.scrollFactorX, s.scrollFactorY).setDepth(s.depth)
      .setAlpha(s.alpha).setTint(s.tintTopLeft, s.tintTopRight, s.tintBottomLeft, s.tintBottomRight)
      .setVisible(this.wasVisible);
  }

  private emitGhost(bornAt: number, x: number, y: number): void {
    const g = this.ghosts.find((slot) => slot.bornAt < 0);
    if (!g) return;
    g.bornAt = bornAt;
    const v = this.visual;
    g.image.setTexture(v.texture.key, v.frame.name).setOrigin(v.originX, v.originY)
      .setPosition(x, y).setScale(v.scaleX, v.scaleY).setRotation(v.rotation)
      .setFlip(v.flipX, v.flipY).setAlpha(DASH_FX.ghost.alpha).setVisible(this.wasVisible);
  }

  private freeParticle(): Particle | undefined {
    return this.particles.find((p) => p.bornAt < 0);
  }

  private burst(config: Burst, kind: Particle['kind'], direction: number): void {
    for (let i = 0; i < config.count; i++) {
      const p = this.freeParticle();
      if (!p) return;
      const speed = this.range(config.speed[0], config.speed[1]) * direction;
      p.kind = kind;
      p.bornAt = this.scene.time.now;
      p.lifeMs = config.lifeMs;
      p.x = this.source.x - this.dx * DASH_FX.particles.rear
        + this.range(-DASH_FX.particles.spread, DASH_FX.particles.spread);
      p.y = this.source.y + DASH_FX.particles.footOffsetY;
      p.vx = this.dx * speed;
      p.vy = this.dy * speed - this.range(config.lift[0], config.lift[1]);
      p.gravity = config.gravity;
      p.size = this.range(config.size[0], config.size[1]);
      p.growth = config.growth;
      p.tint = config.tint;
      p.alpha = config.alpha;
    }
  }

  private drawParticles(now: number): void {
    for (const p of this.particles) {
      if (p.bornAt < 0) continue;
      const age = now - p.bornAt;
      const t = age / p.lifeMs;
      if (t >= 1) { p.bornAt = -1; continue; }
      const seconds = age / 1000;
      this.ink.fillStyle(p.tint, this.wasVisible ? p.alpha * (1 - t) : 0);
      if (p.kind === 'line') {
        const rear = DASH_FX.lines.rear + (p.x + seconds * DASH_FX.lines.speed) % DASH_FX.lines.travel;
        this.wedge(this.source.x - this.dx * rear - this.dy * p.y,
          this.source.y - this.dy * rear + this.dx * p.y, p.size, DASH_FX.lines.width);
      } else {
        const x = Math.round(p.x + p.vx * seconds);
        const y = Math.round(p.y + p.vy * seconds + p.gravity * seconds * seconds * 0.5);
        const size = Math.max(1, Math.round(p.size * (1 + (p.growth - 1) * t)));
        // Two overlapping rectangles give clouds a stepped pixel silhouette.
        this.ink.fillRect(x - size / 2, y - size / 2, size, size);
        if (p.kind === 'dust') this.ink.fillRect(x - size * 0.75, y - size / 4, size * 1.5, size / 2);
      }
    }
  }

  private drawSmear(age: number): void {
    const cfg = DASH_FX.smear;
    const bandHeight = cfg.height / cfg.colors.length;
    for (let i = 0; i < cfg.colors.length; i++) {
      const offset = (i - (cfg.colors.length - 1) / 2) * bandHeight;
      this.ink.fillStyle(cfg.colors[i], this.wasVisible ? cfg.alpha * (1 - age / cfg.lifeMs) : 0);
      this.wedge(this.source.x - this.dy * offset, this.source.y + this.dx * offset,
        cfg.length * (1 - i * cfg.bandLengthStep), bandHeight, cfg.taper);
    }
    // The bat remains readable over the smear; the puff still masks the morph.
  }

  private wedge(x: number, y: number, length: number, width: number, taper = 0): void {
    const nx = -this.dy * width / 2;
    const ny = this.dx * width / 2;
    const tailX = x - this.dx * length;
    const tailY = y - this.dy * length;
    this.ink.fillTriangle(x + nx, y + ny, x - nx, y - ny, tailX - nx * taper, tailY - ny * taper);
    if (taper > 0) this.ink.fillTriangle(x + nx, y + ny,
      tailX - nx * taper, tailY - ny * taper, tailX + nx * taper, tailY + ny * taper);
  }

  /** Private xorshift stream: cosmetic jitter never consumes gameplay RNG. */
  private range(min: number, max: number): number {
    this.rng ^= this.rng << 13;
    this.rng ^= this.rng >>> 17;
    this.rng ^= this.rng << 5;
    return min + ((this.rng >>> 0) / 4294967296) * (max - min);
  }
}
