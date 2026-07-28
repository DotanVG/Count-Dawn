import Phaser from 'phaser';
import { DEPTHS } from '../game/constants';

const BAR_WIDTH = 132;
/** Gap between the top of the painted sprite and the bottom of the bar. */
const HEAD_GAP = 3;

/**
 * A Hunter Captain's health, carried just above his head rather than pinned to
 * the top of the screen.
 *
 * One bar per Captain, owned by the Captain rather than the HUD: from night 5
 * there is more than one of them in the hall at a time, and a single shared
 * banner could not say whose health it was showing.
 */
export class BossHealthBar {
  private container: Phaser.GameObjects.Container;
  private fill: Phaser.GameObjects.Rectangle;
  /** Set by suppress() — a cutscene actor that should show no boss UI at all. */
  private suppressed = false;

  constructor(scene: Phaser.Scene, label: string) {
    const bg = scene.add.rectangle(0, 0, BAR_WIDTH, 10, 0x000000, 0.7).setOrigin(0.5);
    this.fill = scene.add
      .rectangle(-BAR_WIDTH / 2 + 2, 0, BAR_WIDTH - 4, 6, 0xffd76b)
      .setOrigin(0, 0.5);
    const caption = scene.add
      .text(0, -15, label, {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '12px',
        color: '#ffd76b',
        stroke: '#0d0716',
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    this.container = scene.add
      .container(0, 0, [bg, this.fill, caption])
      .setDepth(DEPTHS.hud)
      .setVisible(false);
  }

  /**
   * Anchors the bar to the top of the PAINTED sprite (Hunter.visibleTopY), not
   * to the sprite's origin or frame - the source art has ten scaled pixels of
   * empty padding above the head, which is what left the bar floating.
   */
  follow(x: number, visibleTopY: number): void {
    if (this.suppressed) return;
    this.container.setPosition(x, visibleTopY - HEAD_GAP - 5).setVisible(true);
  }

  setRatio(ratio: number): void {
    if (this.suppressed) return;
    this.fill.width = (BAR_WIDTH - 4) * Phaser.Math.Clamp(ratio, 0, 1);
  }

  /**
   * Permanently hides this bar and stops follow()/setRatio() from ever
   * showing it again — for cutscene actors (the cold open's scenery Priest)
   * that should carry no boss UI at all, since they are dressing, not a
   * fight the player is meant to track.
   */
  suppress(): void {
    this.suppressed = true;
    this.container.setVisible(false);
  }

  destroy(): void {
    this.container.destroy();
  }
}
