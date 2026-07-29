import Phaser from 'phaser';
import type { AudioBalanceConfig } from '../data/audioBalance';
import {
  gameSettings,
  shouldShowCursorSettings,
  type GameSettingsConfig,
} from '../data/gameSettings';
import { ARENA, GAME_HEIGHT, GAME_WIDTH, SCENES } from '../game/constants';
import { isTouchDevice } from '../game/device';
import { setVampireCursorVisible } from '../game/vampireCursor';
import { getAudioDirector } from '../systems/AudioDirector';

const FONT = 'Trebuchet MS, sans-serif';
const BUTTON = '#c9a7ff';
const BUTTON_HOVER = '#e8ddff';
const BUTTON_DARK = '#491326';
const BLINK_ON_MS = 1000;
const BLINK_OFF_MS = 500;
const BLINK_FADE_MS = 130;

interface Slider {
  setValue(value: number): void;
}

interface DesktopCursorSettings {
  size: Slider;
  speed: Slider;
}

interface CursorAwareGameScene extends Phaser.Scene {
  restoreCursorForCurrentPhase(): void;
}

/** Overlay launched on top of a paused GameScene. */
export class PauseScene extends Phaser.Scene {
  private settingsOpen = false;
  private mainUi?: Phaser.GameObjects.Container;
  private settingsUi?: Phaser.GameObjects.Container;
  private generalUi?: Phaser.GameObjects.Container;
  private soundUi?: Phaser.GameObjects.Container;
  private generalTab?: Phaser.GameObjects.Text;
  private soundTab?: Phaser.GameObjects.Text;
  private isTouch = false;

  constructor() {
    super(SCENES.pause);
  }

  create(): void {
    const audio = getAudioDirector(this);
    this.isTouch = isTouchDevice();
    // Pause and settings are menus, regardless of which gameplay/cinematic
    // phase is frozen beneath them. Menus always own a visible aiming cursor.
    setVampireCursorVisible(true);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0d0716, 0.72).setOrigin(0);

    // The north wall ends at ARENA.top. Keeping the label below it prevents
    // the pulse from ever crossing the HUD or countdown.
    const paused = this.add
      .text(GAME_WIDTH / 2, ARENA.top + 46, 'PAUSED', {
        fontFamily: FONT,
        fontSize: '50px',
        color: '#e8ddff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.blinkUneven(paused);

    this.mainUi = this.add.container(0, 0);
    const resume = this.makeButton(
      this.mainUi,
      GAME_WIDTH / 2,
      350,
      this.isTouch ? 'Resume' : 'Resume  (Esc / P)',
      () => this.resumeGame(),
    );
    this.addGuidanceBreath(resume);
    this.makeButton(this.mainUi, GAME_WIDTH / 2, 430, 'Settings', () =>
      this.showSettings(),
    );
    this.makeButton(this.mainUi, GAME_WIDTH / 2, 510, 'Quit to Menu', () => {
      this.scene.stop(SCENES.game);
      this.scene.stop();
      this.scene.start(SCENES.game, { autostart: false });
    });

    this.settingsUi = this.add.container(0, 0).setVisible(false);
    const back = this.makeButton(this.settingsUi, 155, ARENA.top + 46, '‹ Back', () =>
      this.showMain(),
    ).setFontSize(20);
    this.addGuidanceBreath(back);

    this.generalTab = this.makeTab(this.settingsUi, GAME_WIDTH / 2 - 105, 305, 'General', () =>
      this.showTab('general'),
    );
    this.soundTab = this.makeTab(this.settingsUi, GAME_WIDTH / 2 + 105, 305, 'Sound', () =>
      this.showTab('sound'),
    );

    const generalUi = this.add.container(0, 0).setVisible(false);
    this.generalUi = generalUi;
    this.settingsUi.add(generalUi);
    const palette = this.makeButton(
      generalUi,
      GAME_WIDTH / 2,
      this.isTouch ? 430 : 380,
      '',
      () => {
        const current = gameSettings.get();
        gameSettings.update({ redBlindPalette: !current.redBlindPalette });
      },
    );
    // Cursor controls belong exclusively to the fine-pointer branch. Keeping
    // their construction in one desktop-only method prevents future mobile
    // settings from accidentally inheriting mouse concepts.
    const desktopCursor = shouldShowCursorSettings(this.isTouch)
      ? this.buildDesktopCursorSettings(generalUi)
      : null;
    this.makeButton(generalUi, GAME_WIDTH / 2, this.isTouch ? 520 : 598, 'Reset General', () =>
      gameSettings.reset(),
    ).setFontSize(19);

    const syncGeneral = (settings: GameSettingsConfig): void => {
      this.syncToggle(palette, 'Red-friendly palette', settings.redBlindPalette);
      desktopCursor?.size.setValue(settings.cursorScale);
      desktopCursor?.speed.setValue(settings.cursorSpeed);
    };
    const unsubscribeSettings = gameSettings.subscribe(syncGeneral);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribeSettings);

    this.soundUi = this.add.container(0, 0).setVisible(false);
    this.settingsUi.add(this.soundUi);
    const master = this.makeSlider(
      this.soundUi,
      385,
      'Master volume',
      0,
      1,
      (value) => audio.setMasterVolume(value),
    );
    const music = this.makeSlider(
      this.soundUi,
      445,
      'Music volume',
      0,
      1,
      (value) => audio.setMusicVolume(value),
    );
    const sfx = this.makeSlider(
      this.soundUi,
      505,
      'SFX volume',
      0,
      1,
      (value) => audio.setSfxVolume(value),
    );
    const musicMute = this.makeButton(this.soundUi, GAME_WIDTH / 2 - 130, 565, '', () => {
      audio.resumeFromGesture();
      const balance = audio.getBalance();
      audio.setMusicMuted(!(balance.muted || balance.musicMuted));
    }).setFontSize(19);
    const sfxMute = this.makeButton(this.soundUi, GAME_WIDTH / 2 + 130, 565, '', () => {
      audio.resumeFromGesture();
      const balance = audio.getBalance();
      audio.setSfxMuted(!(balance.muted || balance.sfxMuted));
    }).setFontSize(19);

    const syncAudio = (balance: AudioBalanceConfig): void => {
      master.setValue(balance.master);
      music.setValue(balance.music);
      sfx.setValue(balance.sfx);
      this.syncToggle(musicMute, 'Music', !(balance.muted || balance.musicMuted));
      this.syncToggle(sfxMute, 'SFX', !(balance.muted || balance.sfxMuted));
    };
    const unsubscribeAudio = audio.onBalanceChange(syncAudio);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribeAudio);
    this.makeButton(this.soundUi, GAME_WIDTH / 2, 620, 'Reset Sound', () =>
      audio.resetBalance(),
    ).setFontSize(19);

    const leaveOrResume = (): void => {
      if (this.settingsOpen) this.showMain();
      else this.resumeGame();
    };
    this.input.keyboard?.on('keydown-ESC', leaveOrResume);
    this.input.keyboard?.on('keydown-P', leaveOrResume);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown-ESC', leaveOrResume);
      this.input.keyboard?.off('keydown-P', leaveOrResume);
    });
  }

  private showSettings(): void {
    this.settingsOpen = true;
    this.mainUi?.setVisible(false);
    this.settingsUi?.setVisible(true);
    this.showTab('general');
  }

  private showMain(): void {
    this.settingsOpen = false;
    this.settingsUi?.setVisible(false);
    this.mainUi?.setVisible(true);
  }

  private showTab(tab: 'general' | 'sound'): void {
    this.generalUi?.setVisible(tab === 'general');
    this.soundUi?.setVisible(tab === 'sound');
    this.styleTab(this.generalTab, tab === 'general');
    this.styleTab(this.soundTab, tab === 'sound');
  }

  private resumeGame(): void {
    getAudioDirector(this).resumeFromGesture();
    const gameScene = this.scene.get(SCENES.game) as CursorAwareGameScene;
    // Hand cursor ownership back before the underlying scene advances:
    // gameplay shows it; an unfinished cinematic hides it again.
    gameScene.restoreCursorForCurrentPhase();
    this.scene.stop();
    this.scene.resume(SCENES.game);
  }

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

  /** Same active-choice breathing used by START NIGHT and Resume. */
  private addGuidanceBreath(target: Phaser.GameObjects.Text): void {
    this.tweens.add({
      targets: target,
      scale: { from: 1, to: 1.05 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private makeButton(
    parent: Phaser.GameObjects.Container,
    x: number,
    y: number,
    label: string,
    onClick: () => void,
  ): Phaser.GameObjects.Text {
    const button = this.add
      .text(x, y, label, {
        fontFamily: FONT,
        fontSize: '24px',
        color: '#0d0716',
        backgroundColor: BUTTON,
        padding: { x: 20, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    button.setData('restingBackground', BUTTON);
    button.on('pointerover', () => button.setBackgroundColor(BUTTON_HOVER));
    button.on('pointerout', () =>
      button.setBackgroundColor(button.getData('restingBackground') ?? BUTTON),
    );
    button.on('pointerdown', onClick);
    parent.add(button);
    return button;
  }

  private makeTab(
    parent: Phaser.GameObjects.Container,
    x: number,
    y: number,
    label: string,
    onClick: () => void,
  ): Phaser.GameObjects.Text {
    const tab = this.makeButton(parent, x, y, label, onClick).setFontSize(20);
    tab.setFixedSize(180, 44).setAlign('center');
    return tab;
  }

  private styleTab(tab: Phaser.GameObjects.Text | undefined, active: boolean): void {
    if (!tab) return;
    const background = active ? BUTTON_HOVER : '#5b4475';
    tab
      .setColor(active ? '#0d0716' : '#e8ddff')
      .setBackgroundColor(background)
      .setData('restingBackground', background);
  }

  private makeSlider(
    parent: Phaser.GameObjects.Container,
    y: number,
    label: string,
    min: number,
    max: number,
    onChange: (value: number) => void,
    format: (value: number) => string = (value) => `${Math.round(value * 100)}%`,
    midpoint?: number,
  ): Slider {
    const x = GAME_WIDTH / 2;
    const width = 360;
    const left = x - width / 2;
    const labelText = this.add
      .text(left, y - 28, label, {
        fontFamily: FONT,
        fontSize: '19px',
        color: '#e8ddff',
      })
      .setOrigin(0, 0.5);
    const valueText = this.add
      .text(x + width / 2, y - 28, '', {
        fontFamily: FONT,
        fontSize: '18px',
        color: '#c9a7ff',
      })
      .setOrigin(1, 0.5);
    const track = this.add
      .rectangle(x, y, width, 12, 0x332342)
      .setStrokeStyle(2, 0x6b4d8f)
      .setInteractive({ useHandCursor: true });
    const fill = this.add.rectangle(left, y, 0, 8, 0xc9a7ff).setOrigin(0, 0.5);
    const knob = this.add
      .circle(left, y, 12, 0xe8ddff)
      .setStrokeStyle(2, 0x6b4d8f)
      .setInteractive({ useHandCursor: true, draggable: true });
    parent.add([labelText, valueText, track, fill, knob]);

    const setValue = (value: number): void => {
      const clamped = Phaser.Math.Clamp(value, min, max);
      const progress =
        midpoint === undefined
          ? (clamped - min) / (max - min)
          : clamped <= midpoint
            ? 0.5 * ((clamped - min) / (midpoint - min))
            : 0.5 + 0.5 * ((clamped - midpoint) / (max - midpoint));
      fill.width = width * progress;
      knob.x = left + width * progress;
      valueText.setText(format(clamped));
    };
    const updateFromX = (pointerX: number): void => {
      const progress = Phaser.Math.Clamp((pointerX - left) / width, 0, 1);
      const value =
        midpoint === undefined
          ? min + progress * (max - min)
          : progress <= 0.5
            ? min + (progress / 0.5) * (midpoint - min)
            : midpoint + ((progress - 0.5) / 0.5) * (max - midpoint);
      setValue(value);
      onChange(value);
    };
    track.on('pointerdown', (pointer: Phaser.Input.Pointer) => updateFromX(pointer.x));
    knob.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number) => updateFromX(dragX));
    return { setValue };
  }

  private syncToggle(
    button: Phaser.GameObjects.Text,
    label: string,
    enabled: boolean,
  ): void {
    const background = enabled ? BUTTON : BUTTON_DARK;
    button
      .setText(`${label} ${enabled ? 'ON' : 'OFF'}`)
      .setColor(enabled ? '#0d0716' : '#ff9aab')
      .setBackgroundColor(background)
      .setData('restingBackground', background);
  }

  /** Fine-pointer settings never exist in the touch UI tree. */
  private buildDesktopCursorSettings(
    parent: Phaser.GameObjects.Container,
  ): DesktopCursorSettings {
    const size = this.makeSlider(
      parent,
      455,
      'Cursor size',
      0.5,
      2,
      (value) => gameSettings.update({ cursorScale: value }),
      (value) => `${Math.round(value * 100)}%`,
      1,
    );
    const speed = this.makeSlider(
      parent,
      525,
      'Cursor speed',
      0.25,
      2,
      (value) => gameSettings.update({ cursorSpeed: value }),
      (value) => `${Math.round(value * 100)}%`,
      1,
    );
    return { size, speed };
  }
}
