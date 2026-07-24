import Phaser from 'phaser';
import { COLORS, DEPTHS } from '../game/constants';
import { TEXTURES } from '../utils/assetKeys';

/**
 * The coffin (Romi's art, three states: closed → half-open → open): visible
 * from the start, inert until GameFlowSystem activates it. Opens/closes for
 * the vampire's coffin entrances and exits. When approached too early it
 * shows a short hint about unmet requirements.
 */
export class Coffin extends Phaser.Physics.Arcade.Image {
  private activated = false;
  private opened = false;
  private pulseTween: Phaser.Tweens.Tween | null = null;
  private glow: Phaser.GameObjects.Arc;
  private hintText: Phaser.GameObjects.Text | null = null;
  private hintCooldownUntil = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, TEXTURES.coffinClosed);
    scene.add.existing(this);
    scene.physics.add.existing(this, true);
    // The art lives on a 256px canvas; the coffin shape itself is roughly
    // 160x230 within it. StaticBody.setSize's 3rd arg (default true) centers
    // the body on the game object's center, which is what we want here.
    this.setScale(0.55);
    const body = this.body as Phaser.Physics.Arcade.StaticBody;
    // Arcade StaticBody's setSize() takes literal world-pixel dimensions —
    // it does NOT multiply by the game object's scale itself, and (verified
    // empirically) its auto-centering also doesn't correctly account for
    // scale, leaving the body's center dozens of pixels off from the actual
    // sprite (exactly why the coffin's overlap used to catch near its top
    // but miss near its bottom). So: scale the content box ourselves (the
    // coffin's drawn shape is ~160x230 in the unscaled 256x256 canvas) and
    // force position/center from the known (x, y) directly, sidestepping
    // the quirk entirely instead of fighting it.
    const bodyW = 160 * 0.55;
    const bodyH = 230 * 0.55;
    body.setSize(bodyW, bodyH);
    body.position.set(x - bodyW / 2, y - bodyH / 2);
    body.updateCenter();
    this.setDepth(DEPTHS.coffin);

    this.glow = scene.add
      .circle(x, y, 80, COLORS.coffinActive, 0.22)
      .setDepth(DEPTHS.coffinGlow)
      .setVisible(false);
  }

  get isActivated(): boolean {
    return this.activated;
  }

  get isOpen(): boolean {
    return this.opened;
  }

  /** Animate the lid through the half-open frame with a small pop. */
  setOpen(open: boolean): void {
    if (this.opened === open) return;
    this.opened = open;
    this.setTexture(TEXTURES.coffinHalf);
    this.scene.time.delayedCall(130, () => {
      if (!this.active) return;
      this.setTexture(open ? TEXTURES.coffinOpen : TEXTURES.coffinClosed);
    });
    this.scene.tweens.add({
      targets: this,
      scaleX: { from: 0.62, to: 0.55 },
      scaleY: { from: 0.6, to: 0.55 },
      duration: 200,
      ease: 'Quad.easeOut',
    });
  }

  activate(): void {
    if (this.activated) return;
    this.activated = true;
    this.hideHint();

    // Pulsing glow, the clearest visual "come back now" signal — no tint on
    // the sprite itself, Romi's art keeps its own colors.
    this.glow.setVisible(true);
    this.pulseTween = this.scene.tweens.add({
      targets: this.glow,
      alpha: { from: 0.16, to: 0.5 },
      scale: { from: 0.9, to: 1.2 },
      duration: 650,
      yoyo: true,
      repeat: -1,
    });
  }

  /**
   * Called at the start of each new round in the seamless day/night loop:
   * without this, `activated` stayed permanently true after the first
   * victory, so the glow never turned back off and `showRequirementHint`
   * (which bails out early while activated) stopped working for round 2+.
   */
  resetForNewRound(): void {
    this.activated = false;
    this.pulseTween?.stop();
    this.pulseTween = null;
    this.glow.setVisible(false).setAlpha(0.22).setScale(1);
  }

  /** Shown when the player touches the coffin before requirements are met. */
  showRequirementHint(message: string): void {
    if (this.activated || this.scene.time.now < this.hintCooldownUntil) return;
    this.hintCooldownUntil = this.scene.time.now + 2500;

    this.hideHint();
    this.hintText = this.scene.add
      .text(this.x, this.y - 64, message, {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '15px',
        color: '#c9a7ff',
        backgroundColor: '#0d0716cc',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5)
      .setDepth(30);
    this.scene.tweens.add({
      targets: this.hintText,
      alpha: 0,
      delay: 1600,
      duration: 400,
      onComplete: () => this.hideHint(),
    });
  }

  private hideHint(): void {
    this.hintText?.destroy();
    this.hintText = null;
  }

  override destroy(fromScene?: boolean): void {
    this.pulseTween?.stop();
    this.glow.destroy();
    this.hideHint();
    super.destroy(fromScene);
  }
}
