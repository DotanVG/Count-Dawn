import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, SCENES } from '../game/constants';
import { isTouchDevice } from '../game/device';
import { setVampireCursorVisible } from '../game/vampireCursor';
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
    setVampireCursorVisible(true);
    const cx = GAME_WIDTH / 2;

    // GameScene already handed the music back at the moment the run ended,
    // so this is a no-op in the normal flow — it is here so the screen is
    // never reached with the Level Music still running underneath.
    const audio = getAudioDirector(this);
    audio.playMainTitle();
    audio.enterMenuMode();
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0d0716, 0.96).setOrigin(0);

    const title = this.add
      .text(cx, 62, 'DAWN CLAIMS YOU', {
        fontFamily: FONT,
        fontSize: '52px',
        color: '#ff5f5f',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setScale(0.82);

    const cause = this.add
      .text(cx, 108, CAUSE_TEXT[summary.cause] ?? 'The night is over.', {
        fontFamily: FONT,
        fontSize: '21px',
        color: '#e8ddff',
      })
      .setOrigin(0.5)
      .setAlpha(0);

    // The last night, in its own line — the debrief below is the whole run.
    const finalNight = this.add
      .text(
        cx,
        140,
        `Final night: ${summary.bloodCollected}/${summary.bloodTarget} blood  ·  survived ${summary.timeSurvivedSeconds}s`,
        { fontFamily: FONT, fontSize: '16px', color: '#7d6ea3' },
      )
      .setOrigin(0.5)
      .setAlpha(0);

    const debrief = new RunDebrief(this, cx, 210, summary.stats);
    debrief.container.setAlpha(0).setY(230);
    this.tweens.add({
      targets: title,
      alpha: 1,
      scale: 1,
      duration: 330,
      ease: 'Back.easeOut',
    });
    this.tweens.add({ targets: cause, alpha: 1, duration: 240, delay: 150 });
    this.tweens.add({ targets: finalNight, alpha: 1, duration: 240, delay: 240 });
    this.tweens.add({
      targets: debrief.container,
      alpha: 1,
      y: 210,
      duration: 320,
      delay: 320,
      ease: 'Quad.easeOut',
    });

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
      .setAlpha(0)
      .setInteractive({ useHandCursor: true });
    restart.on('pointerover', () => restart.setBackgroundColor('#e8ddff'));
    restart.on('pointerout', () => restart.setBackgroundColor('#c9a7ff'));
    const restartRun = (): void => {
      this.scene.start(SCENES.game, { autostart: true, showOpening: true });
    };
    restart.on('pointerdown', () => {
      restart.disableInteractive().setScale(0.94).setBackgroundColor('#ffffff');
      this.time.delayedCall(80, restartRun);
    });
    this.tweens.add({ targets: restart, alpha: 1, duration: 220, delay: 520 });

    this.input.keyboard?.on('keydown-R', restartRun);
    const returnToMenu = (): void => {
      this.scene.start(SCENES.game, { autostart: false });
    };
    this.input.keyboard?.on('keydown-M', returnToMenu);

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
    menuLink.on('pointerover', () => menuLink.setColor('#e8ddff').setScale(1.05));
    menuLink.on('pointerout', () => menuLink.setColor('#9d8bbf').setScale(1));
    menuLink.on('pointerdown', returnToMenu);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown-R', restartRun);
      this.input.keyboard?.off('keydown-M', returnToMenu);
    });
  }
}
