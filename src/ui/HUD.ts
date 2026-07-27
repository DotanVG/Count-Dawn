import Phaser from 'phaser';
import { BLOOD, NIGHT, PLAYER, bossLineupForNight } from '../data/balance';
import { DEPTHS, GAME_WIDTH, GAME_HEIGHT } from '../game/constants';
import { EVENTS } from '../game/events';
import { TEXTURES } from '../utils/assetKeys';
import { pluralBossName } from '../entities/HunterCaptain';
import type { Objective } from '../types/game';

const OBJECTIVE_TEXT: Record<Objective, string> = {
  'collect-blood': 'Collect blood before sunrise',
  'defeat-boss': 'Defeat the Hunter Captain',
  'collect-more-blood': 'Collect more blood',
  'return-to-coffin': 'Return to your coffin',
};

/**
 * Names tonight's lineup on the objective banner, from the bosses that ACTUALLY
 * walked in — GameScene hands the roster over in spawnBoss, before the objective
 * flips, so by the time this runs the names are known.
 *
 * It used to guess from the night number via `bossLineupForNight`, which knows
 * how MANY bosses a night sends but not which flavour each one turned out to be.
 * That is why a night the huntress Captain answered still announced "Defeat the
 * Hunter Captain".
 *
 * Identical names are grouped and counted rather than listed twice, so three
 * bosses never spill into a sentence nobody reads.
 */
function defeatBossText(roster: readonly string[], night: number): string {
  if (roster.length === 0) return countedBossText(night);

  const counts = new Map<string, number>();
  for (const name of roster) counts.set(name, (counts.get(name) ?? 0) + 1);

  const parts = [...counts].map(([name, n]) =>
    n > 1 ? `the ${n} ${pluralBossName(name)}` : `the ${name}`,
  );
  const listed =
    parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  return `Defeat ${listed}`;
}

/**
 * Fallback for the one case with no roster to read: the objective is re-emitted
 * on a state change that is not a fresh spawn (re-entering the coffin early,
 * for instance), so the banner still has to say something sensible.
 */
function countedBossText(night: number): string {
  const { priests, captains } = bossLineupForNight(night);
  if (priests > 0 && captains === 0) return 'Defeat the Priest';
  if (priests > 0) return `Defeat the Priest and his ${captains > 1 ? 'Captains' : 'Captain'}`;
  return captains > 1 ? `Defeat the ${captains} Captains` : OBJECTIVE_TEXT['defeat-boss'];
}

const FONT = 'Trebuchet MS, sans-serif';
const HP_GREEN = 0x4caf50;
const HP_ORANGE = 0xff9a3d;
const HP_RED = 0xe53935;
const BLOOD_RED = 0xc41e2f;
const BLOOD_FULL_GLOW = 0xff6b7a;
const HP_FULL_GLOW = 0x7dff9b;
const DASH_PURPLE = 0x9d6bff;
const BAR_W = 216;

/**
 * Health ratio at or below which the bar turns orange, then red - even
 * thirds, so each colour owns the same slice of the bar.
 */
const HP_WARN_RATIO = 2 / 3;
const HP_DANGER_RATIO = 1 / 3;
/** Seconds left when the timer starts blinking white on top of the red panic. */
const BLINK_SECONDS = 5;

/** Where a night/objective announcement pops, and where it settles afterwards. */
const BANNER_CENTER = { x: GAME_WIDTH / 2, y: 315 };
const BANNER_CORNER = { x: 172, y: 218, scale: 0.55 };
/** How long the announcement holds centre-screen before flying to the corner. */
const BANNER_HOLD_MS = 900;

/**
 * The bar's colour for a given health ratio - green down to HP_WARN_RATIO,
 * orange down to HP_DANGER_RATIO, red below it. Particles are tinted from the
 * same function so a puff always matches the bar it came off.
 */
function healthColor(ratio: number): number {
  if (ratio > HP_WARN_RATIO) return HP_GREEN;
  if (ratio > HP_DANGER_RATIO) return HP_ORANGE;
  return HP_RED;
}

/**
 * All in-game HUD elements. The sunrise timer is the centerpiece: it sits in
 * the middle sky window (where the sun rises into it), pops on every tick,
 * trembles harder as time runs out, and goes into a red panic mode for the
 * final ten seconds. Health/blood changes puff matching green/red particles
 * at the bars, and the victory coffin-transfer drains blood into health.
 */
export class HUD {
  private timerText: Phaser.GameObjects.Text;
  /**
   * Low in the wall band, clear of the window openings. It used to sit at the
   * top of the middle window, which is exactly where the sun and moon cross at
   * the peak of their arc - the clock was standing in front of them.
   */
  private timerHome = { x: GAME_WIDTH / 2, y: 158 };
  private healthBarFill: Phaser.GameObjects.Rectangle;
  private healthText: Phaser.GameObjects.Text;
  private dashBarFill: Phaser.GameObjects.Rectangle;
  private dashLabel: Phaser.GameObjects.Text;
  private bloodBarFill: Phaser.GameObjects.Rectangle;
  private bloodText: Phaser.GameObjects.Text;
  /** The announcement that pops centre-screen, then flies to the corner. */
  private bannerPop: Phaser.GameObjects.Text;
  /** The copy that rests in the corner between announcements. */
  private bannerCorner: Phaser.GameObjects.Text;
  private bannerEnabled = false;
  private bannerQueued = false;
  private night = 1;
  private objective: Objective = 'collect-blood';
  /** Names of the bosses currently on the field; see setBossRoster. */
  private bossRoster: readonly string[] = [];
  private vignette: Phaser.GameObjects.Rectangle;
  private hpParticles: Phaser.GameObjects.Particles.ParticleEmitter;
  private bloodParticles: Phaser.GameObjects.Particles.ParticleEmitter;
  private appearTargets: Phaser.GameObjects.GameObject[] = [];
  private panic = false;
  /** Ring around the blood bar, shown only while the meter is full. */
  private bloodGlow: Phaser.GameObjects.Rectangle;
  private bloodGlowTween: Phaser.Tweens.Tween | null = null;
  /** Same breathing ring, green, shown only while HP is full. */
  private healthGlow: Phaser.GameObjects.Rectangle;
  private healthGlowTween: Phaser.Tweens.Tween | null = null;
  /** Pulse on the health bar while HP is in the red band - the "you are about to die" tell. */
  private lowHealthTween: Phaser.Tweens.Tween | null = null;
  /** Last ratio handed to setHealth, so particle bursts can match the bar. */
  private healthRatio = 1;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly emitter: Phaser.Events.EventEmitter,
  ) {
    // Sunrise timer — centered in the middle sky window.
    this.timerText = scene.add
      .text(this.timerHome.x, this.timerHome.y, this.format(NIGHT.durationSeconds), {
        fontFamily: FONT,
        fontSize: '58px',
        color: '#e8ddff',
        fontStyle: 'bold',
        stroke: '#0d0716',
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(DEPTHS.hud);

    // Health (top-left).
    const healthBg = scene.add
      .rectangle(20, 24, BAR_W + 4, 18, 0x000000, 0.55)
      .setOrigin(0, 0.5)
      .setDepth(DEPTHS.hud);
    this.healthBarFill = scene.add
      .rectangle(22, 24, BAR_W, 14, HP_GREEN)
      .setOrigin(0, 0.5)
      .setDepth(DEPTHS.hud + 1);
    this.healthText = scene.add
      .text(24, 40, '', { fontFamily: FONT, fontSize: '14px', color: '#cfe8cf' })
      .setDepth(DEPTHS.hud + 1);

    // Bat-dash charge, a slim strip under the health bar.
    const dashBg = scene.add
      .rectangle(20, 62, BAR_W + 4, 8, 0x000000, 0.55)
      .setOrigin(0, 0.5)
      .setDepth(DEPTHS.hud);
    this.dashBarFill = scene.add
      .rectangle(22, 62, BAR_W, 5, DASH_PURPLE)
      .setOrigin(0, 0.5)
      .setDepth(DEPTHS.hud + 1);
    this.dashLabel = scene.add
      .text(24, 68, 'DASH', { fontFamily: FONT, fontSize: '11px', color: '#c9a7ff' })
      .setDepth(DEPTHS.hud + 1);

    // Blood meter (top-right).
    const bloodBg = scene.add
      .rectangle(GAME_WIDTH - 240, 24, BAR_W + 4, 18, 0x000000, 0.55)
      .setOrigin(0, 0.5)
      .setDepth(DEPTHS.hud);
    this.bloodBarFill = scene.add
      .rectangle(GAME_WIDTH - 238, 24, 0, 14, BLOOD_RED)
      .setOrigin(0, 0.5)
      .setDepth(DEPTHS.hud + 1);
    this.bloodText = scene.add
      .text(GAME_WIDTH - 236, 40, '', { fontFamily: FONT, fontSize: '14px', color: '#f0b7bd' })
      .setDepth(DEPTHS.hud + 1);

    // Ring around the blood meter, lit only once the meter is full - the cue
    // that the Captain is coming and the coffin is the next stop.
    this.bloodGlow = scene.add
      .rectangle(GAME_WIDTH - 242, 24, BAR_W + 12, 26)
      .setOrigin(0, 0.5)
      .setStrokeStyle(3, BLOOD_FULL_GLOW, 0.9)
      .setFillStyle(BLOOD_FULL_GLOW, 0)
      .setDepth(DEPTHS.hud + 2)
      .setVisible(false);

    // Same ring around the health bar, green, lit only once HP is topped off.
    this.healthGlow = scene.add
      .rectangle(18, 24, BAR_W + 12, 26)
      .setOrigin(0, 0.5)
      .setStrokeStyle(3, HP_FULL_GLOW, 0.9)
      .setFillStyle(HP_FULL_GLOW, 0)
      .setDepth(DEPTHS.hud + 2)
      .setVisible(false);

    // Night + objective. Two texts for one piece of information: the banner
    // announces a change big and centred, then flies into the corner slot and
    // hands off to the resting copy that lives there between announcements.
    this.bannerPop = scene.add
      .text(BANNER_CENTER.x, BANNER_CENTER.y, '', {
        fontFamily: FONT,
        fontSize: '30px',
        color: '#e8ddff',
        align: 'center',
        lineSpacing: 8,
        stroke: '#0d0716',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(DEPTHS.hud + 3)
      .setAlpha(0);

    this.bannerCorner = scene.add
      .text(BANNER_CORNER.x, BANNER_CORNER.y, '', {
        fontFamily: FONT,
        fontSize: '30px',
        color: '#c9a7ff',
        align: 'center',
        lineSpacing: 8,
        stroke: '#0d0716',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setScale(BANNER_CORNER.scale)
      .setDepth(DEPTHS.hud)
      .setAlpha(0);

    // Red panic vignette for the final seconds.
    this.vignette = scene.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, BLOOD_RED, 0)
      .setOrigin(0)
      .setDepth(DEPTHS.hud - 1);

    // Green/red puffs used for HP loss, blood gain, and the coffin transfer.
    this.hpParticles = scene.add
      .particles(0, 0, TEXTURES.particle, {
        speed: { min: 40, max: 140 },
        lifespan: { min: 250, max: 550 },
        scale: { start: 1.1, end: 0 },
        tint: HP_GREEN,
        emitting: false,
      })
      .setDepth(DEPTHS.hud + 2);
    this.bloodParticles = scene.add
      .particles(0, 0, TEXTURES.particle, {
        speed: { min: 40, max: 140 },
        lifespan: { min: 250, max: 550 },
        scale: { start: 1.1, end: 0 },
        tint: 0xff4d4d,
        emitting: false,
      })
      .setDepth(DEPTHS.hud + 2);

    this.setHealth(PLAYER.maxHealth, PLAYER.maxHealth);
    this.setBlood(0, BLOOD.target);

    this.appearTargets = [
      this.timerText,
      healthBg,
      this.healthBarFill,
      this.healthText,
      dashBg,
      this.dashBarFill,
      this.dashLabel,
      bloodBg,
      this.bloodBarFill,
      this.bloodText,
    ];

    emitter.on(EVENTS.COUNTDOWN_TICK, this.onTick, this);
    emitter.on(EVENTS.FINAL_TEN_SECONDS, this.onFinalSeconds, this);
    emitter.on(EVENTS.PLAYER_DAMAGED, this.onPlayerDamaged, this);
    emitter.on(EVENTS.PLAYER_HEALED, this.onPlayerHealed, this);
    emitter.on(EVENTS.BLOOD_CHANGED, this.onBloodChanged, this);
    emitter.on(EVENTS.OBJECTIVE_CHANGED, this.onObjective, this);
  }

  /** Fade/slide the HUD in when the night starts. */
  animateIn(): void {
    for (const target of this.appearTargets) {
      const obj = target as unknown as Phaser.GameObjects.Components.Transform &
        Phaser.GameObjects.Components.AlphaSingle;
      const toY = obj.y;
      obj.setAlpha(0);
      obj.y = toY - 24;
      this.scene.tweens.add({
        targets: obj,
        alpha: 1,
        y: toY,
        duration: 450,
        ease: 'Quad.easeOut',
        delay: 100,
      });
    }
  }

  /**
   * Dash charge, driven from GameScene.update: dim and short while it
   * recharges, full and bright the instant it's usable again.
   */
  setDashCharge(progress: number): void {
    const ready = progress >= 1;
    this.dashBarFill.width = BAR_W * Phaser.Math.Clamp(progress, 0, 1);
    this.dashBarFill.setFillStyle(DASH_PURPLE, ready ? 1 : 0.45);
    this.dashLabel.setAlpha(ready ? 1 : 0.5);
  }

  /**
   * Red burst where a bloodlet reaches the blood bar — at its live fill edge,
   * not the bar's fixed midpoint anchor. Mirrors burstAtHealthBar; the drain
   * side of this same bar (playCoffinTransfer) already reads the edge this
   * way, only the fill side was still bursting at the bar's centre.
   */
  burstAtBloodBar(): void {
    this.bloodParticles.explode(8, this.bloodBarEdge.x, this.bloodBarEdge.y);
  }

  /**
   * Live right edge of the blood bar's current fill, in screen space — where
   * anything arriving at "the blood bar" should actually land. HUD_ANCHORS is
   * the bar's fixed midpoint, which is right for placing the bar itself but
   * wrong for tracking how full it currently reads.
   */
  get bloodBarEdge(): { x: number; y: number } {
    return { x: GAME_WIDTH - 238 + this.bloodBarFill.width, y: 24 };
  }

  /** Live right edge of the health bar's current fill; see bloodBarEdge. */
  get healthBarEdge(): { x: number; y: number } {
    return { x: 22 + this.healthBarFill.width, y: 24 };
  }

  setNight(n: number): void {
    this.night = n;
    this.announce();
  }

  /**
   * The bosses that just walked in, by name. Called from GameScene.spawnBoss
   * BEFORE the objective flips to `defeat-boss`, which is the whole reason the
   * banner can name them: the flavour of each Captain is rolled at spawn time,
   * so nothing earlier than this knows whether tonight sent a pilgrim, a garlic
   * farmer or the huntress.
   */
  setBossRoster(names: readonly string[]): void {
    this.bossRoster = [...names];
  }

  /**
   * Turns the night/objective announcements on. They stay off through the
   * opening cinematic: "Night 1 - collect blood before sunrise" is an
   * instruction for a round that has not started, and it stepped on the
   * cold open's own storytelling.
   */
  enableBanner(): void {
    if (this.bannerEnabled) return;
    this.bannerEnabled = true;
    this.announce();
  }

  /**
   * Announces the current night and objective: it pops big in the middle of
   * the screen, holds for a beat, then shrinks and flies into the corner,
   * replacing whatever was resting there.
   *
   * Announcements coalesce over a frame. A new round changes the night AND the
   * objective, which would otherwise fire two banners that raced each other
   * across the screen.
   */
  private announce(): void {
    if (!this.bannerEnabled || this.bannerQueued) return;
    this.bannerQueued = true;

    this.scene.time.delayedCall(20, () => {
      this.bannerQueued = false;
      const objectiveText =
        this.objective === 'defeat-boss'
          ? defeatBossText(this.bossRoster, this.night)
          : OBJECTIVE_TEXT[this.objective];
      const content = `Night ${this.night}\n${objectiveText}`;

      this.scene.tweens.killTweensOf(this.bannerPop);
      this.bannerPop
        .setText(content)
        .setPosition(BANNER_CENTER.x, BANNER_CENTER.y)
        .setScale(1.35)
        .setAlpha(0);

      this.scene.tweens.add({
        targets: this.bannerPop,
        alpha: 1,
        scale: 1,
        duration: 260,
        ease: 'Back.easeOut',
        onComplete: () => {
          this.scene.tweens.add({
            targets: this.bannerPop,
            x: BANNER_CORNER.x,
            y: BANNER_CORNER.y,
            scale: BANNER_CORNER.scale,
            delay: BANNER_HOLD_MS,
            duration: 450,
            ease: 'Quad.easeInOut',
            onComplete: () => {
              // Hand off to the resting copy so the next announcement is free
              // to start from the middle again.
              this.bannerCorner.setText(content).setAlpha(1);
              this.bannerPop.setAlpha(0);
            },
          });
        },
      });
    });
  }

  /**
   * Called between rounds in the seamless day/night loop: clears any panic
   * styling left over from a previous night's final seconds and snaps the
   * bars back to a fresh-round look (the coffin transfer already set the
   * numbers; this just resets cosmetic state — color, size, jitter, vignette).
   */
  resetForNewRound(bloodTarget: number): void {
    // Last night's bosses are dead; a stale roster would name them again.
    this.bossRoster = [];
    this.panic = false;
    this.timerText.setColor('#e8ddff');
    this.timerText.setFontSize('58px');
    this.timerText.setScale(1);
    this.timerText.setAngle(0);
    this.timerText.setPosition(this.timerHome.x, this.timerHome.y);
    this.vignette.setAlpha(0);
    this.setLowHealthFlash(false);
    this.setBloodFullGlow(false);
    this.setHealthFullGlow(false);
    this.setHealth(PLAYER.maxHealth, PLAYER.maxHealth);
    this.setBlood(0, bloodTarget);
    // Without this the objective kept reading "Return to your coffin" (the
    // previous round's final state) until the new round's first
    // OBJECTIVE_CHANGED event — GameFlowSystem only emits on state changes,
    // not on construction, so nothing would correct it otherwise.
    this.objective = 'collect-blood';
  }

  /**
   * Victory beat: the blood meter drains into the health bar — HP fills as
   * blood empties, green/red particles streaming at each bar, plus a
   * literal ribbon of blood flying the width of the screen between them (see
   * flyBloodToHealth) so the drain and the fill read as one cause and effect
   * rather than two unconnected sparks at opposite corners.
   */
  playCoffinTransfer(
    bloodRatio: number,
    healthRatio: number,
    fromSeconds: number,
    onComplete: () => void,
  ): void {
    const duration = 1300;

    // He made it, so the clock stops panicking the moment the lid shuts: the
    // night winding back up reads white and calm, not red and doomed.
    this.panic = false;
    this.timerText.setColor('#e8ddff');
    this.timerText.setFontSize('58px');
    this.timerText.setAngle(0);
    this.timerText.setPosition(this.timerHome.x, this.timerHome.y);
    this.scene.tweens.add({ targets: this.vignette, alpha: 0, duration: 300 });

    this.flyBloodToHealth(duration);

    // The health puffs are re-tinted every burst rather than once up front:
    // the bar climbs through red into orange into green over this tween, and
    // a fixed tint would have left red motes landing on a green bar.
    const stream = this.scene.time.addEvent({
      delay: 90,
      loop: true,
      callback: () => {
        this.hpParticles.setParticleTint(healthColor(this.healthRatio));
        this.hpParticles.explode(5, this.healthBarEdge.x, this.healthBarEdge.y);
        this.bloodParticles.explode(5, this.bloodBarEdge.x, this.bloodBarEdge.y);
      },
    });

    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration,
      ease: 'Sine.easeInOut',
      onUpdate: (tween) => {
        const t = tween.getValue() ?? 0;
        this.bloodBarFill.width = BAR_W * bloodRatio * (1 - t);
        this.healthRatio = Phaser.Math.Linear(healthRatio, 1, t);
        this.healthBarFill.width = BAR_W * this.healthRatio;
        this.healthBarFill.setFillStyle(healthColor(this.healthRatio));

        // The night refills as he sleeps: the clock winds back up to a full
        // night, popping as it climbs, alongside the two bars.
        const seconds = Math.round(Phaser.Math.Linear(fromSeconds, NIGHT.durationSeconds, t));
        this.timerText.setText(this.format(seconds));
        this.timerText.setScale(1 + 0.14 * Math.abs(Math.sin(t * Math.PI * 5)));
      },
      onComplete: () => {
        stream.remove();
        this.setLowHealthFlash(false);
        this.setBloodFullGlow(false);
        // The transfer always ends with HP topped off (healthRatio tweens to
        // 1 above), so the same green ring the round uses for a full bar
        // belongs here too.
        this.setHealthFullGlow(true);
        this.healthText.setText(`HP ${PLAYER.maxHealth}/${PLAYER.maxHealth}`);
        this.bloodText.setText('Blood spent');
        this.timerText.setText(this.format(NIGHT.durationSeconds));
        // One last big pop as the clock lands on a full night.
        this.scene.tweens.add({
          targets: this.timerText,
          scale: { from: 1.6, to: 1 },
          duration: 420,
          ease: 'Back.easeOut',
        });
        onComplete();
      },
    });
  }

  /**
   * Three droplets on a swirling path from the blood bar to the health bar —
   * the same beat GameScene's hopBloodToHealth plays for a mid-round overflow
   * pickup, reused here so a night ending explains itself the same way: this
   * IS the blood he drank, arriving as health.
   */
  private flyBloodToHealth(duration: number): void {
    // Read live, not captured once: the blood bar is draining and the health
    // bar is filling for this whole duration (the counter tween above drives
    // both), so the ribbon's ends have to track the same moving edges rather
    // than the bars' fixed midpoint anchors.
    const from = (): { x: number; y: number } => this.bloodBarEdge;
    const to = (): { x: number; y: number } => this.healthBarEdge;

    const trail = this.scene.add
      .particles(0, 0, TEXTURES.particle, {
        speed: { min: 10, max: 50 },
        lifespan: { min: 260, max: 520 },
        scale: { start: 0.9, end: 0 },
        tint: [0xc41e2f, 0xff4d4d, 0xff8f9a],
        emitting: false,
      })
      .setDepth(DEPTHS.hud + 2);

    const strands = 3;
    let finished = 0;

    for (let s = 0; s < strands; s++) {
      const phase = (s / strands) * Math.PI * 2;
      const swirl = 20 + s * 8;
      const start = from();
      const droplet = this.scene.add
        .image(start.x, start.y, TEXTURES.blood)
        .setDepth(DEPTHS.hud + 3)
        .setScale(BLOOD.dropletScale * 0.8);

      this.scene.tweens.addCounter({
        from: 0,
        to: 1,
        duration,
        delay: s * 70,
        ease: 'Sine.easeInOut',
        onUpdate: (tween) => {
          const t = tween.getValue() ?? 0;
          const taper = Math.sin(t * Math.PI);
          const a = from();
          const b = to();
          const x = Phaser.Math.Linear(a.x, b.x, t);
          const y = Phaser.Math.Linear(a.y, b.y, t) + Math.sin(t * Math.PI * 3 + phase) * swirl * taper;
          droplet.setPosition(x, y).setScale(0.8 - 0.3 * t);
          trail.emitParticleAt(x, y, 2);
        },
        onComplete: () => {
          droplet.destroy();
          if (++finished < strands) return;
          this.scene.time.delayedCall(400, () => trail.destroy());
        },
      });
    }
  }

  /**
   * A bloodlet collected while the meter is already full: it lands on the
   * blood bar as usual, then carries on to the health bar as a heal. Called
   * by GameScene once the pickup's second hop arrives.
   */
  burstAtBloodBarOverflow(): void {
    this.bloodParticles.explode(6, this.bloodBarEdge.x, this.bloodBarEdge.y);
  }

  destroy(): void {
    this.emitter.off(EVENTS.COUNTDOWN_TICK, this.onTick, this);
    this.emitter.off(EVENTS.FINAL_TEN_SECONDS, this.onFinalSeconds, this);
    this.emitter.off(EVENTS.PLAYER_DAMAGED, this.onPlayerDamaged, this);
    this.emitter.off(EVENTS.PLAYER_HEALED, this.onPlayerHealed, this);
    this.emitter.off(EVENTS.BLOOD_CHANGED, this.onBloodChanged, this);
    this.emitter.off(EVENTS.OBJECTIVE_CHANGED, this.onObjective, this);
  }

  private format(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  /**
   * One tick of the clock. The timer stays PUT - it pops in place and never
   * wanders off its anchor. The final ten seconds pop hard (a full second's
   * worth of scale, settling back to normal before the next tick) instead of
   * jittering around the sky window, and the last five blink white on top of
   * the red so the very end reads differently from the merely urgent part.
   */
  private onTick(secondsRemaining: number): void {
    this.timerText.setText(this.format(secondsRemaining));

    // Tension ramp: 0 while relaxed -> 1 at the final seconds.
    const tension = Phaser.Math.Clamp(
      1 - (secondsRemaining - NIGHT.finalWarningSeconds) / 20,
      0,
      1,
    );
    const pop = this.panic ? 1.75 : 1 + 0.08 + tension * 0.22;

    this.scene.tweens.add({
      targets: this.timerText,
      scale: { from: pop, to: 1 },
      duration: this.panic ? 520 : 220,
      ease: this.panic ? 'Back.easeOut' : 'Quad.easeOut',
    });

    if (this.panic) {
      const blinking = secondsRemaining <= BLINK_SECONDS;
      if (blinking) {
        // White flash on the beat, decaying back to the panic red - unless
        // panic ended in between, e.g. he reached the coffin on this very
        // tick, in which case the red must not come back.
        this.timerText.setColor('#ffffff');
        this.scene.time.delayedCall(160, () => {
          if (this.panic) this.timerText.setColor('#ff4d4d');
        });
      } else {
        this.timerText.setColor(secondsRemaining % 2 === 0 ? '#ff4d4d' : '#ffd76b');
      }
      this.scene.cameras.main.shake(60, 0.0015 + 0.002 * (1 - secondsRemaining / 10));
      this.vignette.setAlpha(blinking ? 0.24 : 0.16);
      this.scene.tweens.add({ targets: this.vignette, alpha: 0.05, duration: 420 });
    }
  }

  private onFinalSeconds(): void {
    this.panic = true;
    this.timerText.setColor('#ff4d4d');
    this.timerText.setFontSize('72px');
    this.scene.tweens.add({
      targets: this.vignette,
      alpha: { from: 0, to: 0.08 },
      duration: 300,
    });
  }

  private onPlayerDamaged(current: number, max: number): void {
    this.setHealth(current, max);
    // Motes falling away from the end of the bar, tinted to the band the
    // Count just dropped into - green, then orange, then red.
    this.burstAtHealthBar(10);
  }

  private onPlayerHealed(current: number, max: number): void {
    this.setHealth(current, max);
    this.burstAtHealthBar(8);
  }

  /** Puff at the live end of the health bar, in the bar's current colour. */
  private burstAtHealthBar(count: number): void {
    this.hpParticles.setParticleTint(healthColor(this.healthRatio));
    this.hpParticles.explode(count, this.healthBarEdge.x, this.healthBarEdge.y);
  }

  private onBloodChanged(current: number, target: number): void {
    this.setBlood(current, target);
  }

  private setHealth(current: number, max: number): void {
    const ratio = Phaser.Math.Clamp(current / max, 0, 1);
    this.healthRatio = ratio;
    this.healthBarFill.width = BAR_W * ratio;
    this.healthBarFill.setFillStyle(healthColor(ratio));
    // Overflow healing restores half a point per blood, so health is not
    // necessarily whole - the readout rounds, the bar uses the real value.
    this.healthText.setText(`HP ${Math.round(current)}/${max}`);
    this.setLowHealthFlash(ratio <= HP_DANGER_RATIO && current > 0);
    this.setHealthFullGlow(ratio >= 1);
  }

  /**
   * Pulses the health bar while HP sits in the red band, so the last hits
   * before death are impossible to miss. Idempotent - re-setting the same
   * state leaves the running tween alone rather than restarting it every
   * time a hit lands.
   */
  private setLowHealthFlash(on: boolean): void {
    if (on === (this.lowHealthTween !== null)) return;

    if (!on) {
      this.lowHealthTween?.stop();
      this.lowHealthTween = null;
      this.healthBarFill.setAlpha(1);
      return;
    }

    this.lowHealthTween = this.scene.tweens.add({
      targets: this.healthBarFill,
      alpha: { from: 1, to: 0.25 },
      duration: 300,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private setBlood(current: number, target: number): void {
    const ratio = Phaser.Math.Clamp(current / target, 0, 1);
    this.bloodBarFill.width = BAR_W * ratio;
    this.bloodText.setText(`Blood ${Math.min(current, target)}/${target}`);
    this.setBloodFullGlow(ratio >= 1);
  }

  /** Breathing ring around the blood meter, on only while it reads full. */
  private setBloodFullGlow(on: boolean): void {
    if (on === (this.bloodGlowTween !== null)) return;

    if (!on) {
      this.bloodGlowTween?.stop();
      this.bloodGlowTween = null;
      this.bloodGlow.setVisible(false);
      return;
    }

    this.bloodGlow.setVisible(true).setAlpha(1).setScale(1);
    this.bloodGlowTween = this.scene.tweens.add({
      targets: this.bloodGlow,
      alpha: { from: 1, to: 0.35 },
      scaleY: { from: 1, to: 1.18 },
      duration: 620,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /** Same breathing ring, green, on only while HP reads full. */
  private setHealthFullGlow(on: boolean): void {
    if (on === (this.healthGlowTween !== null)) return;

    if (!on) {
      this.healthGlowTween?.stop();
      this.healthGlowTween = null;
      this.healthGlow.setVisible(false);
      return;
    }

    this.healthGlow.setVisible(true).setAlpha(1).setScale(1);
    this.healthGlowTween = this.scene.tweens.add({
      targets: this.healthGlow,
      alpha: { from: 1, to: 0.35 },
      scaleY: { from: 1, to: 1.18 },
      duration: 620,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private onObjective(objective: Objective): void {
    if (this.objective === objective) return;
    this.objective = objective;
    this.announce();
  }
}
