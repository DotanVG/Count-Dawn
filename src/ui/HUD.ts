import Phaser from 'phaser';
import { BLOOD, NIGHT, PLAYER, WRATH, bossLineupForNight } from '../data/balance';
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
const WRATH_YELLOW = 0xffd23d;
const WRATH_DARK = 0x241830;
const BAR_W = 216;
/** Smaller than the HP/blood bars — Wrath is a bonus meter, not a survival stat. */
const WRATH_BAR_W = 150;
/** Dots swinging around the charged Wrath meter — see setWrathFullGlow. */
const WRATH_ORBIT_DOT_COUNT = 6;

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
  private wrathBarFill: Phaser.GameObjects.Rectangle;
  private wrathText: Phaser.GameObjects.Text;
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
  /** Ring around the Wrath meter, shown only once the Ultimate is charged. */
  private wrathGlow: Phaser.GameObjects.Rectangle;
  private wrathGlowTween: Phaser.Tweens.Tween | null = null;
  /** Dark motes orbiting the Wrath meter on an ellipse, only while charged. */
  private wrathOrbitDots: Phaser.GameObjects.Arc[] = [];
  private wrathOrbitTween: Phaser.Tweens.Tween | null = null;
  private wrathMotes: Phaser.GameObjects.Particles.ParticleEmitter;
  /** Spawns spawnWrathSparkle on a beat while charged; see setWrathFullGlow. */
  private wrathSparkleTimer: Phaser.Time.TimerEvent | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly emitter: Phaser.Events.EventEmitter,
    /** Desktop gets a "Press SPACE" hint on a full Wrath bar; mobile has the ⚡ button instead. */
    private readonly isTouch: boolean = false,
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

    // Wrath meter (top-middle, between health and blood): fills from blood the
    // Count has no use for — see WRATH in balance.ts. Smaller than the other
    // two on purpose; it is a bonus resource, not something survival hinges on.
    const wrathX = GAME_WIDTH / 2 - WRATH_BAR_W / 2;
    const wrathBg = scene.add
      .rectangle(wrathX - 2, 24, WRATH_BAR_W + 4, 18, 0x000000, 0.55)
      .setOrigin(0, 0.5)
      .setDepth(DEPTHS.hud);
    this.wrathBarFill = scene.add
      .rectangle(wrathX, 24, 0, 14, WRATH_YELLOW)
      .setOrigin(0, 0.5)
      .setDepth(DEPTHS.hud + 1);
    this.wrathText = scene.add
      .text(GAME_WIDTH / 2, 40, '', { fontFamily: FONT, fontSize: '13px', color: '#ffe9a3' })
      .setOrigin(0.5, 0)
      .setDepth(DEPTHS.hud + 1);

    // Charged flourish: a yellow ring, matching the other two bars' full glow,
    // plus dark motes swinging around the box on an ellipse — bigger and
    // brighter at the bottom of the loop, smaller and dimmer at the top, which
    // is the cheapest way two flat circles read as orbiting IN FRONT of and
    // BEHIND the meter instead of flatly around it.
    this.wrathGlow = scene.add
      .rectangle(wrathX - 6, 24, WRATH_BAR_W + 12, 26)
      .setOrigin(0, 0.5)
      .setStrokeStyle(3, WRATH_YELLOW, 0.9)
      .setFillStyle(WRATH_YELLOW, 0)
      .setDepth(DEPTHS.hud + 2)
      .setVisible(false);
    for (let i = 0; i < WRATH_ORBIT_DOT_COUNT; i++) {
      this.wrathOrbitDots.push(
        scene.add
          .circle(GAME_WIDTH / 2, 24, 4, i % 2 === 0 ? WRATH_DARK : DASH_PURPLE, 0.9)
          .setDepth(DEPTHS.hud + 3)
          .setVisible(false),
      );
    }
    this.wrathMotes = scene.add
      .particles(GAME_WIDTH / 2, 24, TEXTURES.particle, {
        speed: { min: 8, max: 34 },
        lifespan: { min: 400, max: 800 },
        scale: { start: 0.8, end: 0 },
        alpha: { start: 0.8, end: 0 },
        tint: [WRATH_DARK, DASH_PURPLE, 0x4a2e6b],
        frequency: 90,
        quantity: 1,
        emitting: false,
      })
      .setDepth(DEPTHS.hud + 2);

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
    this.setWrath(0, WRATH.target);

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
      wrathBg,
      this.wrathBarFill,
      this.wrathText,
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
   * Victory beat: the blood meter drains into the health bar first — HP
   * fills as blood empties, a literal ribbon flying the width of the screen
   * between them (flyBloodRibbon) so the drain and the fill read as one
   * cause and effect. ONLY once that phase ends does a second phase begin,
   * sending a second ribbon (and the blood still draining) into the Wrath
   * bar instead — sequential, not simultaneous, because that is the actual
   * rule: the pool heals him first, and Wrath only ever sees what's left
   * over once healing is done, never blood that hasn't been "spent" yet.
   *
   * Healing is no longer an unconditional top-off: `healthRatioEnd` is
   * whatever GameScene's computeOvernightTransfer actually worked out, which
   * can land short of 1 if the night's blood pool wasn't enough — and in
   * that case there is no leftover for Wrath, so the second phase never runs.
   */
  playCoffinTransfer(
    bloodRatio: number,
    healthRatioStart: number,
    healthRatioEnd: number,
    fromSeconds: number,
    wrathGain: number,
    onComplete: () => void,
  ): void {
    const healthDuration = 800;
    const wrathDuration = wrathGain > 0 ? 700 : 0;
    const totalDuration = healthDuration + wrathDuration;

    // He made it, so the clock stops panicking the moment the lid shuts: the
    // night winding back up reads white and calm, not red and doomed.
    this.panic = false;
    this.timerText.setColor('#e8ddff');
    this.timerText.setFontSize('58px');
    this.timerText.setAngle(0);
    this.timerText.setPosition(this.timerHome.x, this.timerHome.y);
    this.scene.tweens.add({ targets: this.vignette, alpha: 0, duration: 300 });

    // wrathGain is raw BLOOD, not Wrath points — it has to go through the same
    // WRATH.bloodPerPoint conversion gainWrath applies, or this tween visibly
    // overfills the bar (by exactly bloodPerPoint times too much) and then
    // GameScene's own gainWrath call snaps it back down to the real value the
    // instant the transfer completes.
    const wrathBeforeRatio = this.wrathBarFill.width / WRATH_BAR_W;
    const wrathAfterRatio = Phaser.Math.Clamp(
      wrathBeforeRatio + wrathGain / WRATH.bloodPerPoint / WRATH.target,
      0,
      1,
    );

    // Phase one's ribbon starts immediately; phase two's (if there is one)
    // only spawns once phase one's whole duration has actually elapsed —
    // otherwise its droplets would sit motionless at the blood bar for the
    // entire first phase instead of only appearing once it's their turn.
    this.flyBloodRibbon(() => this.healthBarEdge, healthDuration, [0xc41e2f, 0xff4d4d, 0xff8f9a]);
    if (wrathDuration > 0) {
      this.scene.time.delayedCall(healthDuration, () => {
        this.flyBloodRibbon(() => this.wrathBarEdge, wrathDuration, [0xffd23d, 0x9d6bff, 0x241830]);
      });
    }

    // The health puffs are re-tinted every burst rather than once up front:
    // the bar climbs through red into orange into green over this tween, and
    // a fixed tint would have left red motes landing on a green bar. Which
    // bar bursts follows the same phase the ribbons are in.
    const streamStart = this.scene.time.now;
    const stream = this.scene.time.addEvent({
      delay: 90,
      loop: true,
      callback: () => {
        const elapsed = this.scene.time.now - streamStart;
        this.bloodParticles.explode(5, this.bloodBarEdge.x, this.bloodBarEdge.y);
        if (elapsed < healthDuration) {
          this.hpParticles.setParticleTint(healthColor(this.healthRatio));
          this.hpParticles.explode(5, this.healthBarEdge.x, this.healthBarEdge.y);
        } else if (wrathDuration > 0) {
          // wrathMotes, not bloodParticles' fixed red — Wrath reads gold/purple
          // everywhere else, and a red puff at its bar would look like a mistake.
          this.wrathMotes.explode(4, this.wrathBarEdge.x, this.wrathBarEdge.y);
        }
      },
    });

    // Blood drains continuously across BOTH phases (it is one pool being
    // spent twice over, not two separate pools), while the night's clock
    // winds back up alongside it.
    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: totalDuration,
      ease: 'Sine.easeInOut',
      onUpdate: (tween) => {
        const t = tween.getValue() ?? 0;
        this.bloodBarFill.width = BAR_W * bloodRatio * (1 - t);
        const seconds = Math.round(Phaser.Math.Linear(fromSeconds, NIGHT.durationSeconds, t));
        this.timerText.setText(this.format(seconds));
        this.timerText.setScale(1 + 0.14 * Math.abs(Math.sin(t * Math.PI * 5)));
      },
    });

    const finish = (): void => {
      stream.remove();
      this.setBloodFullGlow(false);
      this.bloodText.setText('Blood spent');
      // Reuses setHealth's own logic for text/colour/low-health-flash/full-glow
      // against the REAL final ratio — which, unlike before, is not always 1.
      this.setHealth(PLAYER.maxHealth * healthRatioEnd, PLAYER.maxHealth);
      if (wrathDuration > 0) this.setWrath(wrathAfterRatio * WRATH.target, WRATH.target);
      this.timerText.setText(this.format(NIGHT.durationSeconds));
      // One last big pop as the clock lands on a full night.
      this.scene.tweens.add({
        targets: this.timerText,
        scale: { from: 1.6, to: 1 },
        duration: 420,
        ease: 'Back.easeOut',
      });
      onComplete();
    };

    // Phase one: health, 0..healthDuration.
    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: healthDuration,
      ease: 'Sine.easeInOut',
      onUpdate: (tween) => {
        const t = tween.getValue() ?? 0;
        this.healthRatio = Phaser.Math.Linear(healthRatioStart, healthRatioEnd, t);
        this.healthBarFill.width = BAR_W * this.healthRatio;
        this.healthBarFill.setFillStyle(healthColor(this.healthRatio));
      },
      onComplete: () => {
        if (wrathDuration === 0) finish();
      },
    });

    // Phase two: Wrath, starting only once phase one's full duration is up.
    if (wrathDuration > 0) {
      this.scene.time.delayedCall(healthDuration, () => {
        this.scene.tweens.addCounter({
          from: 0,
          to: 1,
          duration: wrathDuration,
          ease: 'Sine.easeInOut',
          onUpdate: (tween) => {
            const t = tween.getValue() ?? 0;
            this.wrathBarFill.width = WRATH_BAR_W * Phaser.Math.Linear(wrathBeforeRatio, wrathAfterRatio, t);
          },
          onComplete: finish,
        });
      });
    }
  }

  /**
   * Three droplets on a swirling path from the blood bar to WHICHEVER bar
   * `toGetter` points at — the same beat GameScene's hopBloodToHealth plays
   * for a mid-round overflow pickup, generalised so a night ending can send
   * it to the health bar first and, once that's spent, to the Wrath bar
   * next, both reading as "this IS the blood, arriving," not just the one
   * destination the health-only version used to serve.
   */
  private flyBloodRibbon(
    toGetter: () => { x: number; y: number },
    duration: number,
    tint: number[],
  ): void {
    // Read live, not captured once: the blood bar is draining and the
    // destination bar is filling for this whole duration, so the ribbon's
    // ends have to track the same moving edges rather than fixed points.
    const from = (): { x: number; y: number } => this.bloodBarEdge;

    const trail = this.scene.add
      .particles(0, 0, TEXTURES.particle, {
        speed: { min: 10, max: 50 },
        lifespan: { min: 260, max: 520 },
        scale: { start: 0.9, end: 0 },
        tint,
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
          const b = toGetter();
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

  /**
   * Sets the health and blood bars' NUMBERS straight away, with none of
   * setHealth/setBlood's side effects (the low-health flash, either bar's
   * full-glow ring) — those still need to wait for animateIn's own entrance
   * tween to finish, since both would otherwise animate the same bars'
   * alpha at once and visibly fight over it. For the cold open: without this
   * the bars show their true construction-time values (HP full, Blood 0) for
   * the ~600ms gap before the scripted low-health numbers arrive, which reads
   * as a wrong flash rather than "he already came home hurt" — worse now
   * that a full health bar also glows.
   */
  primeHealthAndBlood(health: number, maxHealth: number, blood: number, bloodTarget: number): void {
    // Construction initializes the ordinary gameplay HUD at full HP, which
    // starts the green full-health ring. Priming replaces that state before
    // the first rendered cold-open frame, so it must clear every cosmetic
    // state attached to the old values as well as changing widths and labels.
    // Otherwise the 12/100 red bar inherits the breathing green ring and
    // reads as both empty and full.
    this.setLowHealthFlash(false);
    this.setHealthFullGlow(false);
    this.setBloodFullGlow(false);

    const healthRatio = Phaser.Math.Clamp(health / maxHealth, 0, 1);
    this.healthRatio = healthRatio;
    this.healthBarFill.width = BAR_W * healthRatio;
    this.healthBarFill.setFillStyle(healthColor(healthRatio));
    this.healthText.setText(`HP ${Math.round(health)}/${maxHealth}`);

    const bloodRatio = Phaser.Math.Clamp(blood / bloodTarget, 0, 1);
    this.bloodBarFill.width = BAR_W * bloodRatio;
    this.bloodText.setText(`Blood ${Math.min(blood, bloodTarget)}/${bloodTarget}`);
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

  /**
   * Wrath meter: fills from blood the Count has no use for (see WRATH in
   * balance.ts). Reads "WRATH READY" once charged rather than a fraction —
   * a full meter is a thing to spend, not a number to watch.
   */
  setWrath(current: number, target: number): void {
    const ratio = Phaser.Math.Clamp(current / target, 0, 1);
    this.wrathBarFill.width = WRATH_BAR_W * ratio;
    if (ratio >= 1) {
      // Mobile already shows a dedicated ⚡ button; desktop has no equivalent
      // on-screen control, so the bar's own text carries the prompt instead.
      this.wrathText.setText(this.isTouch ? 'WRATH READY' : 'WRATH READY — Press SPACE');
    } else {
      this.wrathText.setText(`Wrath ${Math.floor(current)}/${target}`);
    }
    this.setWrathFullGlow(ratio >= 1);
  }

  /** Live right edge of the Wrath bar's current fill; see bloodBarEdge. */
  get wrathBarEdge(): { x: number; y: number } {
    return { x: GAME_WIDTH / 2 - WRATH_BAR_W / 2 + this.wrathBarFill.width, y: 24 };
  }

  /**
   * The charged flourish: the yellow ring every full bar gets, six dark motes
   * swinging around the box on an ellipse (bigger and brighter at the bottom
   * of the loop than the top — the cheapest way flat circles read as passing
   * in front of, then behind, the meter), a steady drift of dark particles
   * off the box, and small bright sparkles flickering directly on the bar's
   * own fill (spawnWrathSparkle) so the bar itself looks charged, not just
   * the space around it.
   */
  private setWrathFullGlow(on: boolean): void {
    if (on === (this.wrathGlowTween !== null)) return;

    if (!on) {
      this.wrathGlowTween?.stop();
      this.wrathGlowTween = null;
      this.wrathGlow.setVisible(false);
      this.wrathOrbitTween?.stop();
      this.wrathOrbitTween = null;
      for (const dot of this.wrathOrbitDots) dot.setVisible(false);
      this.wrathMotes.stop();
      this.wrathSparkleTimer?.remove();
      this.wrathSparkleTimer = null;
      return;
    }

    this.wrathGlow.setVisible(true).setAlpha(1).setScale(1);
    this.wrathGlowTween = this.scene.tweens.add({
      targets: this.wrathGlow,
      alpha: { from: 1, to: 0.35 },
      scaleY: { from: 1, to: 1.18 },
      duration: 620,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    for (const dot of this.wrathOrbitDots) dot.setVisible(true);
    const centerX = GAME_WIDTH / 2;
    const orbitX = WRATH_BAR_W / 2 + 16;
    const orbitY = 15;
    this.wrathOrbitTween = this.scene.tweens.addCounter({
      from: 0,
      to: Math.PI * 2,
      duration: 1500,
      repeat: -1,
      onUpdate: (tween) => {
        const base = tween.getValue() ?? 0;
        this.wrathOrbitDots.forEach((dot, i) => {
          const a = base + (i / this.wrathOrbitDots.length) * Math.PI * 2;
          const depth = Math.sin(a) * 0.5 + 0.5; // 0 at the top of the loop, 1 at the bottom
          dot.setPosition(centerX + Math.cos(a) * orbitX, 24 + Math.sin(a) * orbitY);
          dot.setScale(0.6 + 0.6 * depth).setAlpha(0.5 + 0.5 * depth);
        });
      },
    });

    this.wrathMotes.start();

    this.wrathSparkleTimer = this.scene.time.addEvent({
      delay: 140,
      loop: true,
      callback: () => this.spawnWrathSparkle(),
    });
  }

  /**
   * One small bright fleck flashing somewhere along the Wrath bar's own fill
   * — additive-blended so it reads as a spark rather than a solid dot — there
   * and gone in a quarter second. Fired on a beat by setWrathFullGlow while
   * the meter is charged; this is what makes the BAR ITSELF look charged
   * rather than just the space orbiting around it.
   */
  private spawnWrathSparkle(): void {
    const x = GAME_WIDTH / 2 - WRATH_BAR_W / 2 + Phaser.Math.Between(4, WRATH_BAR_W - 4);
    const y = 24 + Phaser.Math.Between(-5, 5);
    const spark = this.scene.add
      .star(x, y, 4, 1, 4, 0xfff3c4, 1)
      .setDepth(DEPTHS.hud + 4)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(0);
    this.scene.tweens.add({
      targets: spark,
      scale: { from: 0, to: Phaser.Math.FloatBetween(0.8, 1.3) },
      alpha: { from: 1, to: 0 },
      duration: 260,
      ease: 'Quad.easeOut',
      onComplete: () => spark.destroy(),
    });
  }

  private onObjective(objective: Objective): void {
    if (this.objective === objective) return;
    this.objective = objective;
    this.announce();
  }
}
