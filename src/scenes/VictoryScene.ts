import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, SCENES } from '../game/constants';
import { isTouchDevice } from '../game/device';
import type { RunSummary } from '../types/game';

const FONT = 'Trebuchet MS, sans-serif';

export class VictoryScene extends Phaser.Scene {
  constructor() {
    super(SCENES.victory);
  }

  create(summary: RunSummary): void {
    const cx = GAME_WIDTH / 2;

    this.add
      .text(cx, GAME_HEIGHT * 0.26, 'SAFE BEFORE SUNRISE', {
        fontFamily: FONT,
        fontSize: '56px',
        color: '#c9a7ff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.add
      .text(cx, GAME_HEIGHT * 0.38, 'The Count rests, full and victorious.', {
        fontFamily: FONT,
        fontSize: '22px',
        color: '#e8ddff',
      })
      .setOrigin(0.5);

    this.add
      .text(
        cx,
        GAME_HEIGHT * 0.5,
        `Blood collected: ${summary.bloodCollected}/${summary.bloodTarget}      Time to spare: ${summary.timeRemainingSeconds}s`,
        { fontFamily: FONT, fontSize: '20px', color: '#9d8bbf' },
      )
      .setOrigin(0.5);

    const touch = isTouchDevice();
    const restart = this.add
      .text(cx, GAME_HEIGHT * 0.66, touch ? 'PLAY AGAIN' : 'PLAY AGAIN  (R)', {
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
    // Explicit false: Phaser reuses prior start() data when omitted (stale autostart).
    menuLink.on('pointerdown', () => this.scene.start(SCENES.game, { autostart: false }));
  }
}
