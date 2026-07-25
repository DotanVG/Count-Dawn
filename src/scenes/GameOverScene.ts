import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, SCENES } from '../game/constants';
import { isTouchDevice } from '../game/device';
import type { RunSummary } from '../types/game';

const FONT = 'Trebuchet MS, sans-serif';

const CAUSE_TEXT: Record<string, string> = {
  dawn: 'The sun caught you outside your coffin.',
  death: 'The hunters bled you dry.',
};

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super(SCENES.gameOver);
  }

  create(summary: RunSummary): void {
    const cx = GAME_WIDTH / 2;

    this.add
      .text(cx, GAME_HEIGHT * 0.26, 'DAWN CLAIMS YOU', {
        fontFamily: FONT,
        fontSize: '56px',
        color: '#ff5f5f',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.add
      .text(cx, GAME_HEIGHT * 0.38, CAUSE_TEXT[summary.cause] ?? 'The night is over.', {
        fontFamily: FONT,
        fontSize: '22px',
        color: '#e8ddff',
      })
      .setOrigin(0.5);

    this.add
      .text(
        cx,
        GAME_HEIGHT * 0.5,
        `Blood collected: ${summary.bloodCollected}/${summary.bloodTarget}      Time survived: ${summary.timeSurvivedSeconds}s`,
        { fontFamily: FONT, fontSize: '20px', color: '#9d8bbf' },
      )
      .setOrigin(0.5);

    const touch = isTouchDevice();
    const restart = this.add
      .text(cx, GAME_HEIGHT * 0.66, touch ? 'RESTART' : 'RESTART  (R)', {
        fontFamily: FONT,
        fontSize: '28px',
        color: '#0d0716',
        backgroundColor: '#c9a7ff',
        padding: { x: 24, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    restart.on('pointerover', () => restart.setBackgroundColor('#e8ddff'));
    restart.on('pointerout', () => restart.setBackgroundColor('#c9a7ff'));
    restart.on('pointerdown', () => this.scene.start(SCENES.game, { autostart: true }));

    this.input.keyboard?.on('keydown-R', () => this.scene.start(SCENES.game, { autostart: true }));
    this.input.keyboard?.on('keydown-M', () => this.scene.start(SCENES.game, { autostart: false }));

    const menuLink = this.add
      .text(cx, GAME_HEIGHT * 0.78, touch ? 'Back to menu' : 'M - back to menu', {
        fontFamily: FONT,
        fontSize: touch ? '20px' : '16px',
        color: '#9d8bbf',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    // Explicit false: Phaser reuses the previous start() data when omitted,
    // which would carry a stale autostart:true and skip the menu.
    menuLink.on('pointerdown', () => this.scene.start(SCENES.game, { autostart: false }));
  }
}
