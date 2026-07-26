import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, SCENES } from '../game/constants';
import { isTouchDevice } from '../game/device';

const FONT = 'Trebuchet MS, sans-serif';

/**
 * The PAUSED blink, deliberately lopsided: a full second lit, half a second
 * dark. An even blink spends half the time hiding the one word that explains
 * why nothing is moving, and reads as a fault rather than as a state — so the
 * word is present for two thirds of every cycle and the gap is short enough to
 * scan as a pulse.
 */
const BLINK_ON_MS = 1000;
const BLINK_OFF_MS = 500;
/** How long the word takes to fade in or out at each end of the blink. */
const BLINK_FADE_MS = 130;

/** Overlay launched on top of a paused GameScene. */
export class PauseScene extends Phaser.Scene {
  constructor() {
    super(SCENES.pause);
  }

  create(): void {
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0d0716, 0.7).setOrigin(0);

    const paused = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT * 0.36, 'PAUSED', {
        fontFamily: FONT,
        fontSize: '56px',
        color: '#e8ddff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.blinkUneven(paused);

    const resume = this.makeButton(
      GAME_HEIGHT * 0.52,
      isTouchDevice() ? 'Resume' : 'Resume  (Esc / P)',
      () => this.resumeGame(),
    );
    // The same breathing the menu's START NIGHT wears, for the same reason:
    // one thing on the overlay is the way out, and it should be the thing the
    // eye lands on.
    this.tweens.add({
      targets: resume,
      scale: { from: 1, to: 1.05 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.makeButton(GAME_HEIGHT * 0.64, 'Quit to Menu', () => {
      this.scene.stop(SCENES.game);
      this.scene.stop();
      // Explicit false so the fresh scene boots into its menu phase, not a run.
      this.scene.start(SCENES.game, { autostart: false });
    });

    this.input.keyboard?.on('keydown-ESC', () => this.resumeGame());
    this.input.keyboard?.on('keydown-P', () => this.resumeGame());
  }

  private resumeGame(): void {
    this.scene.stop();
    this.scene.resume(SCENES.game);
  }

  /**
   * Lit for BLINK_ON_MS, dark for BLINK_OFF_MS, forever. A plain yoyo tween
   * would split the cycle evenly; this is a chain so the two halves can differ.
   */
  private blinkUneven(target: Phaser.GameObjects.Text): void {
    this.tweens.chain({
      targets: target,
      loop: -1,
      tweens: [
        { alpha: 0, duration: BLINK_FADE_MS, delay: BLINK_ON_MS },
        { alpha: 1, duration: BLINK_FADE_MS, delay: BLINK_OFF_MS },
      ],
    });
  }

  private makeButton(y: number, label: string, onClick: () => void): Phaser.GameObjects.Text {
    const button = this.add
      .text(GAME_WIDTH / 2, y, label, {
        fontFamily: FONT,
        fontSize: '24px',
        color: '#0d0716',
        backgroundColor: '#c9a7ff',
        padding: { x: 20, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    button.on('pointerover', () => button.setBackgroundColor('#e8ddff'));
    button.on('pointerout', () => button.setBackgroundColor('#c9a7ff'));
    button.on('pointerdown', onClick);
    return button;
  }
}
