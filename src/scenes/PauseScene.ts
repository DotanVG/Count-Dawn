import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, SCENES } from '../game/constants';
import { isTouchDevice } from '../game/device';

const FONT = 'Trebuchet MS, sans-serif';

/** Overlay launched on top of a paused GameScene. */
export class PauseScene extends Phaser.Scene {
  constructor() {
    super(SCENES.pause);
  }

  create(): void {
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0d0716, 0.7).setOrigin(0);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT * 0.36, 'PAUSED', {
        fontFamily: FONT,
        fontSize: '56px',
        color: '#e8ddff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.makeButton(
      GAME_HEIGHT * 0.52,
      isTouchDevice() ? 'Resume' : 'Resume  (Esc / P)',
      () => this.resumeGame(),
    );
    this.makeButton(GAME_HEIGHT * 0.64, 'Quit to Menu', () => {
      this.scene.stop(SCENES.game);
      this.scene.stop();
      this.scene.start(SCENES.game); // fresh scene boots into its menu phase
    });

    this.input.keyboard?.on('keydown-ESC', () => this.resumeGame());
    this.input.keyboard?.on('keydown-P', () => this.resumeGame());
  }

  private resumeGame(): void {
    this.scene.stop();
    this.scene.resume(SCENES.game);
  }

  private makeButton(y: number, label: string, onClick: () => void): void {
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
  }
}
