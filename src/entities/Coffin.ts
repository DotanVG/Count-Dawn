import Phaser from 'phaser';
import { COLORS, DEPTHS } from '../game/constants';
import { AUDIO, TEXTURES } from '../utils/assetKeys';
import { getAudioDirector } from '../systems/AudioDirector';

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
  /** Scale "breathing" on the coffin itself, running until the Count climbs in. */
  private breathTween: Phaser.Tweens.Tween | null = null;
  private glow: Phaser.GameObjects.Arc;
  private hintText: Phaser.GameObjects.Text | null = null;
  private hintCooldownUntil = 0;
  /** Current lid sound; the opposite transition waits until this finishes. */
  private transitionSound: Phaser.Sound.BaseSound | null = null;
  private queuedOpenState: boolean | null = null;
  /**
   * Safety net for transitionSound: if its COMPLETE event is ever dropped
   * (pause/resume mid-transition, a backgrounded tab suspending the audio
   * context, a flaky mobile audio backend), nothing would otherwise ever
   * clear transitionSound again — every future setOpen() call would see it
   * still set and silently queue forever, permanently jamming the lid for
   * the rest of the session. This timer forces the same cleanup finish()
   * does if COMPLETE hasn't shown up on its own by then.
   */
  private transitionFallback: Phaser.Time.TimerEvent | null = null;

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

    // Romi's coffin is not centred on its own 256px canvas - the painted
    // shape sits 11.5px right and 7.5px down of the middle - so a glow placed
    // at the sprite's origin reads as sitting off to the left of the coffin.
    // These are that measured offset, scaled to match the sprite.
    this.glow = scene.add
      .circle(x + 11.5 * 0.55, y + 7.5 * 0.55, 80, COLORS.coffinActive, 0.22)
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
    if (this.transitionSound) {
      this.queuedOpenState = open;
      return;
    }

    if (this.opened === open) return;

    this.opened = open;
    // The lid pop tweens scale too; the breath has to let go of it first or
    // the two fight and the coffin never settles back to its resting size.
    this.stopBreathing();
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
    this.playTransitionSound(open);
  }

  /**
   * Plays each lid sound in full. If the opposite transition is requested
   * while it is playing, that visual and its sound begin only after this one
   * completes, so opening and closing can never overlap or cut each other off.
   */
  private playTransitionSound(open: boolean): void {
    const key = open ? AUDIO.coffinOpen : AUDIO.coffinClose;
    // Owned here rather than fired and forgotten, because the queueing below
    // needs the instance; the level still comes from the central balance.
    const sound = getAudioDirector(this.scene).addSfx(key);
    if (!sound) return;
    this.transitionSound = sound;

    const finish = (): void => {
      if (this.transitionSound !== sound) return;
      this.transitionSound = null;
      this.transitionFallback?.remove();
      this.transitionFallback = null;
      sound.destroy();

      const queued = this.queuedOpenState;
      this.queuedOpenState = null;
      if (this.active && queued !== null && queued !== this.opened) {
        this.setOpen(queued);
      }
    };

    sound.once(Phaser.Sound.Events.COMPLETE, finish);
    // `duration` is only known once the AudioBuffer is decoded — it always
    // is by this point (PreloadScene loads every SFX up front), but 0 is a
    // defensive fallback rather than a real expectation. The +400ms margin
    // is slack for the fade/settle a browser's own audio backend adds after
    // the last audible sample, so this never races a COMPLETE that's simply
    // running a little late.
    const fallbackMs = (sound.duration > 0 ? sound.duration * 1000 : 1200) + 400;
    this.transitionFallback = this.scene.time.delayedCall(fallbackMs, finish);

    if (!sound.play()) finish();
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

    this.startBreathing();
  }

  /**
   * The coffin swells and settles, over and over, from the moment it is ready
   * until the Count actually climbs in. The glow alone was easy to lose
   * against a hall full of effects; movement catches the eye even in the
   * corner of the screen, which is the whole point - the player has a sunrise
   * to beat and needs to notice where to go.
   */
  private startBreathing(): void {
    if (this.breathTween) return;
    this.breathTween = this.scene.tweens.add({
      targets: this,
      scaleX: { from: 0.55, to: 0.6 },
      scaleY: { from: 0.55, to: 0.605 },
      duration: 620,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private stopBreathing(): void {
    this.breathTween?.stop();
    this.breathTween = null;
    this.setScale(0.55);
  }

  /**
   * Called at the start of each new round in the seamless day/night loop:
   * without this, `activated` stayed permanently true after the first
   * victory, so the glow never turned back off and `showRequirementHint`
   * (which bails out early while activated) stopped working for round 2+.
   *
   * Also force-clears any stuck transition state as a second line of
   * defense alongside playTransitionSound's own fallback timer above: even
   * if something got the lid jammed mid-transition, the very next night
   * starts from a guaranteed-clean slate rather than carrying a stuck
   * transitionSound forward indefinitely.
   */
  resetForNewRound(): void {
    this.activated = false;
    this.pulseTween?.stop();
    this.pulseTween = null;
    this.stopBreathing();
    this.glow.setVisible(false).setAlpha(0.22).setScale(1);

    this.transitionFallback?.remove();
    this.transitionFallback = null;
    this.transitionSound?.destroy();
    this.transitionSound = null;
    this.queuedOpenState = null;
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
    this.queuedOpenState = null;
    this.transitionFallback?.remove();
    this.transitionFallback = null;
    this.transitionSound?.destroy();
    this.transitionSound = null;
    this.breathTween?.stop();
    this.pulseTween?.stop();
    this.glow.destroy();
    this.hideHint();
    super.destroy(fromScene);
  }
}
