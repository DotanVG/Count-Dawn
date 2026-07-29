import Phaser from 'phaser';
import type { AudioDirector } from '../systems/AudioDirector';

const ROOT_ID = 'cd-audio-toggles';
const STYLE_ID = 'cd-audio-toggle-style';

let installed = false;

/**
 * Installs the two player-facing audio controls for the lifetime of the game.
 *
 * These are DOM buttons rather than scene objects so they remain available on
 * the menu, during play, and on scene overlays. They intentionally control
 * separate persisted channels: muting the soundtrack never costs attack or
 * warning cues, while muting SFX never interrupts the current song.
 */
export function installAudioToggles(game: Phaser.Game, director: AudioDirector): void {
  if (installed || document.getElementById(ROOT_ID)) return;
  installed = true;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = STYLE;
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.id = ROOT_ID;
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'Audio settings');

  const musicButton = makeToggleButton('Music');
  const sfxButton = makeToggleButton('SFX');
  root.append(musicButton, sfxButton);
  (document.getElementById('game-root') ?? document.body).appendChild(root);

  musicButton.addEventListener('click', () => {
    const balance = director.getBalance();
    director.setMusicMuted(!(balance.muted || balance.musicMuted));
  });
  sfxButton.addEventListener('click', () => {
    const balance = director.getBalance();
    director.setSfxMuted(!(balance.muted || balance.sfxMuted));
  });

  const unsubscribe = director.onBalanceChange((balance) => {
    syncButton(musicButton, 'Music', balance.muted || balance.musicMuted);
    syncButton(sfxButton, 'SFX', balance.muted || balance.sfxMuted);
  });

  game.events.once(Phaser.Core.Events.DESTROY, () => {
    unsubscribe();
    root.remove();
    style.remove();
    installed = false;
  });
}

function makeToggleButton(label: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'cd-audio-toggle';
  button.addEventListener('pointerdown', (event) => event.stopPropagation());
  button.dataset.label = label;
  return button;
}

function syncButton(button: HTMLButtonElement, label: string, muted: boolean): void {
  button.classList.toggle('is-muted', muted);
  button.setAttribute('aria-pressed', String(muted));
  button.setAttribute('aria-label', muted ? `Unmute ${label}` : `Mute ${label}`);
  button.title = muted ? `Unmute ${label}` : `Mute ${label}`;
  button.textContent = `${label.toUpperCase()} ${muted ? 'OFF' : 'ON'}`;
}

const STYLE = `
#${ROOT_ID} {
  position: fixed;
  top: calc(env(safe-area-inset-top, 0px) + 76px);
  right: calc(env(safe-area-inset-right, 0px) + 16px);
  z-index: 9000;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
  pointer-events: auto;
}
#${ROOT_ID} .cd-audio-toggle {
  min-width: 98px;
  height: 34px;
  padding: 0 12px;
  border: 1px solid rgba(201, 167, 255, 0.68);
  border-radius: 999px;
  background: rgba(13, 7, 22, 0.72);
  color: #e8ddff;
  box-shadow: 0 3px 14px rgba(13, 7, 22, 0.42);
  font: 700 11px/1 'Trebuchet MS', sans-serif;
  letter-spacing: 0.08em;
  text-align: center;
  touch-action: manipulation;
  cursor: pointer !important;
  transition:
    transform 130ms ease,
    color 130ms ease,
    border-color 130ms ease,
    background 130ms ease;
}
#${ROOT_ID} .cd-audio-toggle:hover,
#${ROOT_ID} .cd-audio-toggle:focus-visible {
  outline: none;
  transform: scale(1.05);
  border-color: #e8ddff;
  background: rgba(58, 33, 92, 0.9);
}
#${ROOT_ID} .cd-audio-toggle.is-muted {
  border-color: rgba(224, 54, 74, 0.72);
  background: rgba(45, 13, 27, 0.78);
  color: #ff9aab;
}
@media (max-width: 720px), (max-height: 500px) {
  #${ROOT_ID} {
    top: calc(env(safe-area-inset-top, 0px) + 66px);
    right: calc(env(safe-area-inset-right, 0px) + 10px);
    gap: 4px;
  }
  #${ROOT_ID} .cd-audio-toggle {
    min-width: 84px;
    height: 30px;
    padding: 0 8px;
    font-size: 10px;
  }
}
`;
