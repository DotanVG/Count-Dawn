import Phaser from 'phaser';
import { GAME_TITLE, GAME_TAGLINE, GAME_WIDTH, GAME_HEIGHT, SCENES } from '../game/constants';

const FONT = 'Trebuchet MS, sans-serif';

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super(SCENES.mainMenu);
  }

  create(): void {
    const cx = GAME_WIDTH / 2;

    this.add
      .text(cx, GAME_HEIGHT * 0.24, GAME_TITLE, {
        fontFamily: FONT,
        fontSize: '72px',
        color: '#c9a7ff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.add
      .text(cx, GAME_HEIGHT * 0.37, GAME_TAGLINE, {
        fontFamily: FONT,
        fontSize: '20px',
        color: '#e8ddff',
      })
      .setOrigin(0.5);

    this.add
      .text(
        cx,
        GAME_HEIGHT * 0.52,
        'Move — WASD / Arrows      Aim — Mouse      Attack — Click / Space      Pause — Esc / P',
        { fontFamily: FONT, fontSize: '17px', color: '#9d8bbf' },
      )
      .setOrigin(0.5);

    const startButton = this.add
      .text(cx, GAME_HEIGHT * 0.68, 'START NIGHT', {
        fontFamily: FONT,
        fontSize: '32px',
        color: '#0d0716',
        backgroundColor: '#c9a7ff',
        padding: { x: 28, y: 12 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    startButton.on('pointerover', () => startButton.setBackgroundColor('#e8ddff'));
    startButton.on('pointerout', () => startButton.setBackgroundColor('#c9a7ff'));
    startButton.on('pointerdown', () => this.startGame());

    this.input.keyboard?.on('keydown-ENTER', () => this.startGame());
    this.input.keyboard?.on('keydown-SPACE', () => this.startGame());
  }

  private startGame(): void {
    this.scene.start(SCENES.game);
  }
}
