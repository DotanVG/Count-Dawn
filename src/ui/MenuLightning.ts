import Phaser from 'phaser';
import { MENU_LIGHTNING } from '../data/balance';
import { DEPTHS, GAME_WIDTH, GAME_HEIGHT } from '../game/constants';
import { TEXTURES } from '../utils/assetKeys';

/**
 * The title gag on the main menu, run by lightning.
 *
 * Romi painted the cover three times, differing only in the title: COUNT DAWN
 * (the game), COUNT DOWN (the jam theme it is a pun on) and COUNT D_WN, where
 * the letter is physically absent. That third one is the whole trick — it is
 * not a state the menu ever rests on, it is the frame the strike passes
 * THROUGH, so the swap reads as the letter being knocked out and a different
 * one landing in its place rather than as two images cross-fading.
 *
 * The menu rests on DAWN for `restMs`, a storm flash cuts to DOWN for the much
 * shorter `punchlineMs`, and another flash puts it back. A strike is a real
 * stutter, not a single cut: three hard frames — flicker, target, flicker —
 * each with a white flash over the whole screen, because lightning would light
 * the hall too, not just the poster hanging in it.
 */
export class MenuLightning {
  private readonly flash: Phaser.GameObjects.Rectangle;
  private readonly timers = new Set<Phaser.Time.TimerEvent>();
  private showingDown = false;
  private stopped = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly cover: Phaser.GameObjects.Image,
  ) {
    // Sits over everything the menu draws: the room lights up, not the poster.
    this.flash = scene.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xffffff, 0)
      .setOrigin(0)
      .setDepth(DEPTHS.hud + 4);

    this.cover.setTexture(TEXTURES.coverDawn);
    this.scheduleNext(MENU_LIGHTNING.restMs);
  }

  /** Every object this owns, including the ones still waiting on a timer. */
  destroy(): void {
    this.stopped = true;
    for (const timer of this.timers) timer.remove();
    this.timers.clear();
    this.flash.destroy();
  }

  private later(delay: number, fn: () => void): void {
    if (this.stopped) return;
    const timer = this.scene.time.delayedCall(delay, () => {
      this.timers.delete(timer);
      if (!this.stopped) fn();
    });
    this.timers.add(timer);
  }

  /**
   * Randomised so the menu never feels metronomic: a long, variable calm on the
   * real title, and a short, variable beat on the punchline.
   */
  private scheduleNext(range: readonly [number, number]): void {
    this.later(Phaser.Math.Between(range[0], range[1]), () => this.strike());
  }

  private strike(): void {
    const target = this.showingDown ? TEXTURES.coverDawn : TEXTURES.coverDown;
    this.showingDown = !this.showingDown;

    // flicker -> target -> flicker -> target. Landing on the target twice is
    // what makes the last cut feel like the letter settling rather than the
    // stutter simply running out.
    const beats: { at: number; texture: string; bright: number }[] = [
      { at: 0, texture: TEXTURES.coverFlicker, bright: 1 },
      { at: MENU_LIGHTNING.beatMs, texture: target, bright: 0.55 },
      { at: MENU_LIGHTNING.beatMs * 2, texture: TEXTURES.coverFlicker, bright: 0.8 },
      { at: MENU_LIGHTNING.beatMs * 3.2, texture: target, bright: 0.35 },
    ];

    for (const beat of beats) {
      this.later(beat.at, () => {
        this.cover.setTexture(beat.texture);
        this.strobe(beat.bright);
      });
    }

    this.later(MENU_LIGHTNING.beatMs * 3.2, () =>
      this.scheduleNext(this.showingDown ? MENU_LIGHTNING.punchlineMs : MENU_LIGHTNING.restMs),
    );
  }

  /** One stab of white over the whole menu, decaying fast. */
  private strobe(strength: number): void {
    this.scene.tweens.killTweensOf(this.flash);
    this.flash.setAlpha(MENU_LIGHTNING.flashAlpha * strength);
    this.scene.tweens.add({
      targets: this.flash,
      alpha: 0,
      duration: MENU_LIGHTNING.flashFadeMs,
      ease: 'Quad.easeOut',
    });
  }
}
