import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, SCENES } from '../game/constants';
import { isTouchDevice } from '../game/device';
import { setVampireCursorVisible } from '../game/vampireCursor';
import { getAudioDirector } from '../systems/AudioDirector';
import type { RunSummary } from '../types/game';

const FONT = 'Trebuchet MS, sans-serif';

export class VictoryScene extends Phaser.Scene {
  constructor() {
    super(SCENES.victory);
  }

  create(summary: RunSummary): void {
    setVampireCursorVisible(true);
    const cx = GAME_WIDTH / 2;

    // Any run-ending screen is Main Title territory, same as game over.
    const audio = getAudioDirector(this);
    audio.playMainTitle();
    audio.enterMenuMode();
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0d0716, 0.96).setOrigin(0);

    const title = this.add
      .text(cx, GAME_HEIGHT * 0.26, 'SAFE BEFORE SUNRISE', {
        fontFamily: FONT,
        fontSize: '56px',
        color: '#c9a7ff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setScale(0.82);

    const subtitle = this.add
      .text(cx, GAME_HEIGHT * 0.38, 'The Count rests, full and victorious.', {
        fontFamily: FONT,
        fontSize: '22px',
        color: '#e8ddff',
      })
      .setOrigin(0.5)
      .setAlpha(0);

    const stats = this.add
      .text(
        cx,
        GAME_HEIGHT * 0.5,
        `Blood collected: ${summary.bloodCollected}/${summary.bloodTarget}      Time to spare: ${summary.timeRemainingSeconds}s`,
        { fontFamily: FONT, fontSize: '20px', color: '#9d8bbf' },
      )
      .setOrigin(0.5)
      .setAlpha(0);
    this.tweens.add({
      targets: title,
      alpha: 1,
      scale: 1,
      duration: 340,
      ease: 'Back.easeOut',
    });
    this.tweens.add({ targets: subtitle, alpha: 1, duration: 260, delay: 160 });
    this.tweens.add({ targets: stats, alpha: 1, duration: 260, delay: 280 });

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
      .setAlpha(0)
      .setInteractive({ useHandCursor: true });
    restart.on('pointerover', () => restart.setBackgroundColor('#e8ddff'));
    restart.on('pointerout', () => restart.setBackgroundColor('#c9a7ff'));
    const restartRun = (): void => {
      this.scene.start(SCENES.game, { autostart: true });
    };
    restart.on('pointerdown', () => {
      restart.disableInteractive().setScale(0.94).setBackgroundColor('#ffffff');
      this.time.delayedCall(80, restartRun);
    });
    this.tweens.add({ targets: restart, alpha: 1, duration: 220, delay: 430 });

    this.input.keyboard?.on('keydown-R', restartRun);
    const returnToMenu = (): void => {
      this.scene.start(SCENES.game, { autostart: false });
    };
    this.input.keyboard?.on('keydown-M', returnToMenu);

    const menuLink = this.add
      .text(cx, GAME_HEIGHT * 0.78, touch ? 'Back to menu' : 'M - back to menu', {
        fontFamily: FONT,
        fontSize: touch ? '20px' : '16px',
        color: '#9d8bbf',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    // Explicit false: Phaser reuses prior start() data when omitted (stale autostart).
    menuLink.on('pointerover', () => menuLink.setColor('#e8ddff').setScale(1.05));
    menuLink.on('pointerout', () => menuLink.setColor('#9d8bbf').setScale(1));
    menuLink.on('pointerdown', returnToMenu);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown-R', restartRun);
      this.input.keyboard?.off('keydown-M', returnToMenu);
    });
  }
}
