import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, SCENES } from '../game/constants';
import { isTouchDevice } from '../game/device';
import { getAudioDirector } from '../systems/AudioDirector';
import { RunDebrief } from '../ui/RunDebrief';
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

    // GameScene already handed the music back at the moment the run ended,
    // so this is a no-op in the normal flow — it is here so the screen is
    // never reached with the Level Music still running underneath.
    getAudioDirector(this).playMainTitle();

    this.add
      .text(cx, 62, 'DAWN CLAIMS YOU', {
        fontFamily: FONT,
        fontSize: '52px',
        color: '#ff5f5f',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.add
      .text(cx, 108, CAUSE_TEXT[summary.cause] ?? 'The night is over.', {
        fontFamily: FONT,
        fontSize: '21px',
        color: '#e8ddff',
      })
      .setOrigin(0.5);

    // The last night, in its own line — the debrief below is the whole run.
    this.add
      .text(
        cx,
        140,
        `Final night: ${summary.bloodCollected}/${summary.bloodTarget} blood  ·  survived ${summary.timeSurvivedSeconds}s`,
        { fontFamily: FONT, fontSize: '16px', color: '#7d6ea3' },
      )
      .setOrigin(0.5);

    new RunDebrief(this, cx, 210, summary.stats);

    const touch = isTouchDevice();
    const restart = this.add
      .text(cx, GAME_HEIGHT - 96, touch ? 'RESTART' : 'RESTART  (R)', {
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
      .text(cx, GAME_HEIGHT - 42, touch ? 'Back to menu' : 'M - back to menu', {
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
