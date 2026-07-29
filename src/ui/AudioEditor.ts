import Phaser from 'phaser';
import { AUDIO_MANIFEST, MUSIC_ASSETS, SFX_ASSETS, type AudioAsset } from '../data/audioManifest';
import type { AudioDirector } from '../systems/AudioDirector';
import { setSystemCursorVisible } from '../game/vampireCursor';

const PANEL_ID = 'cd-audio-editor';
const TOGGLE_KEY = 'F8';
const STEP = 0.01;

/**
 * Developer tool, never normal player UI: a DOM overlay for balancing every
 * music track and sound effect live. Available in `npm run dev`, or in a
 * production build only when the URL carries `?audioEditor=1`. Hidden until
 * F8 is pressed.
 */
export function isAudioEditorAvailable(): boolean {
  if (import.meta.env.DEV) return true;
  try {
    return new URLSearchParams(window.location.search).get('audioEditor') === '1';
  } catch {
    return false;
  }
}

interface SliderRow {
  read: () => number;
  input: HTMLInputElement;
  value: HTMLElement;
}

/**
 * Installs the editor for the lifetime of the game. Rows are generated from
 * AUDIO_MANIFEST, so a new track or effect shows up here without touching
 * this file.
 */
export function installAudioEditor(game: Phaser.Game, director: AudioDirector): void {
  if (!isAudioEditorAvailable()) return;
  if (document.getElementById(PANEL_ID)) return;

  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.style.display = 'none';
  panel.innerHTML = `<style>${STYLE}</style>`;

  const rows: SliderRow[] = [];
  let muteInput: HTMLInputElement | null = null;

  const header = el('div', 'cd-ae-head');
  header.appendChild(el('span', 'cd-ae-title', 'Audio Balance  (F8)'));
  const closeButton = button('Close', () => setVisible(false));
  closeButton.classList.add('cd-ae-close');
  header.appendChild(closeButton);
  panel.appendChild(header);

  const body = el('div', 'cd-ae-body');
  panel.appendChild(body);

  // ── Global ──
  body.appendChild(el('div', 'cd-ae-section', 'Global'));
  rows.push(
    slider(body, 'Master', () => director.getBalance().master, (v) => director.setMasterVolume(v)),
  );
  rows.push(
    slider(body, 'Music group', () => director.getBalance().music, (v) => director.setMusicVolume(v)),
  );
  rows.push(
    slider(body, 'SFX group', () => director.getBalance().sfx, (v) => director.setSfxVolume(v)),
  );

  const muteRow = el('div', 'cd-ae-row');
  const muteLabel = el('label', 'cd-ae-label', 'Mute all');
  muteInput = document.createElement('input');
  muteInput.type = 'checkbox';
  muteInput.className = 'cd-ae-check';
  muteInput.addEventListener('change', () => director.setMuted(muteInput?.checked === true));
  muteLabel.appendChild(muteInput);
  muteRow.appendChild(muteLabel);
  body.appendChild(muteRow);

  // ── Music ──
  body.appendChild(el('div', 'cd-ae-section', 'Music'));
  for (const asset of MUSIC_ASSETS) rows.push(assetRow(body, director, asset));

  // ── SFX ──
  body.appendChild(el('div', 'cd-ae-section', 'Sound effects'));
  for (const asset of SFX_ASSETS) rows.push(assetRow(body, director, asset));

  // ── Footer ──
  const footer = el('div', 'cd-ae-foot');
  footer.appendChild(
    button('Reset to defaults', () => {
      director.resetBalance();
      sync();
    }),
  );
  const output = document.createElement('textarea');
  output.className = 'cd-ae-json';
  output.readOnly = true;
  output.style.display = 'none';
  footer.appendChild(button('Copy configuration', () => copyConfig(director, output)));
  panel.appendChild(footer);
  panel.appendChild(output);

  document.body.appendChild(panel);

  function sync(): void {
    for (const row of rows) {
      const value = row.read();
      row.input.value = String(value);
      row.value.textContent = value.toFixed(2);
    }
    if (muteInput) muteInput.checked = director.getBalance().muted;
  }

  function setVisible(visible: boolean): void {
    panel.style.display = visible ? 'flex' : 'none';
    // Sliders need a pointer you can aim with. The game's fangs stay where they
    // are — this only puts the ordinary system cursor back on top of them.
    setSystemCursorVisible(visible);
    if (visible) sync();
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== TOGGLE_KEY) return;
    event.preventDefault();
    setVisible(panel.style.display === 'none');
  };
  window.addEventListener('keydown', onKeyDown);

  // The panel and its one listener live as long as the game does; both go
  // together, so nothing is left attached to a destroyed game.
  game.events.once(Phaser.Core.Events.DESTROY, () => {
    window.removeEventListener('keydown', onKeyDown);
    panel.remove();
  });

  sync();
}

function assetRow(parent: HTMLElement, director: AudioDirector, asset: AudioAsset): SliderRow {
  const loaded = asset.files.length > 0;
  const label = loaded ? asset.label : `${asset.label} (no asset yet)`;
  const row = slider(
    parent,
    label,
    () => director.getBalance().assets[asset.key] ?? 0,
    (value) => director.setAssetVolume(asset.key, value),
  );

  const actions = el('div', 'cd-ae-actions');
  if (asset.group === 'music') {
    actions.appendChild(button('Play', () => director.previewMusic(asset.key), !loaded));
    actions.appendChild(button('Stop', () => director.stopPreview(), !loaded));
  } else {
    actions.appendChild(button('Preview', () => director.previewSfx(asset.key), !loaded));
  }
  row.input.parentElement?.appendChild(actions);
  return row;
}

function slider(
  parent: HTMLElement,
  label: string,
  read: () => number,
  write: (value: number) => void,
): SliderRow {
  const row = el('div', 'cd-ae-row');
  row.appendChild(el('label', 'cd-ae-label', label));

  const controls = el('div', 'cd-ae-controls');
  const input = document.createElement('input');
  input.type = 'range';
  input.min = '0';
  input.max = '1';
  input.step = String(STEP);
  input.className = 'cd-ae-slider';

  const value = el('span', 'cd-ae-value', '0.00');
  input.addEventListener('input', () => {
    const parsed = Number(input.value);
    write(parsed);
    value.textContent = parsed.toFixed(2);
  });

  controls.appendChild(input);
  controls.appendChild(value);
  row.appendChild(controls);
  parent.appendChild(row);

  return { read, input, value };
}

function copyConfig(director: AudioDirector, output: HTMLTextAreaElement): void {
  const balance = director.getBalance();
  // Emitted in manifest order so it pastes straight back into
  // data/audioBalance.ts as a readable DEFAULT_AUDIO_BALANCE.
  const assets: Record<string, number> = {};
  for (const asset of AUDIO_MANIFEST) assets[asset.key] = balance.assets[asset.key] ?? 0;
  const json = JSON.stringify({ ...balance, assets }, null, 2);

  output.value = json;
  const reveal = (): void => {
    output.style.display = 'block';
    output.select();
  };

  const clipboard = window.navigator.clipboard;
  if (!clipboard) {
    reveal();
    return;
  }
  // Clipboard access is refused in cross-origin iframes (itch.io); showing the
  // JSON in a selectable box is the fallback, never a failure.
  clipboard.writeText(json).then(
    () => {
      output.style.display = 'none';
    },
    reveal,
  );
}

function el(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label: string, onClick: () => void, disabled = false): HTMLButtonElement {
  const node = document.createElement('button');
  node.type = 'button';
  node.className = 'cd-ae-button';
  node.textContent = label;
  node.disabled = disabled;
  node.addEventListener('click', onClick);
  return node;
}

const STYLE = `
#${PANEL_ID} {
  position: fixed; top: 12px; right: 12px; z-index: 10000;
  display: flex; flex-direction: column; gap: 8px;
  width: 380px; max-height: calc(100vh - 24px);
  padding: 12px; box-sizing: border-box;
  background: rgba(13, 7, 22, 0.95); color: #e8ddff;
  border: 1px solid #6b4d8f; border-radius: 8px;
  font: 12px/1.4 'Trebuchet MS', sans-serif;
}
#${PANEL_ID} .cd-ae-head { display: flex; align-items: center; justify-content: space-between; }
#${PANEL_ID} .cd-ae-title { font-size: 14px; font-weight: bold; color: #c9a7ff; }
#${PANEL_ID} .cd-ae-body { overflow-y: auto; padding-right: 4px; }
#${PANEL_ID} .cd-ae-section {
  margin: 10px 0 4px; padding-bottom: 2px;
  border-bottom: 1px solid #3a2b55; color: #9d8bbf;
  text-transform: uppercase; letter-spacing: 0.08em; font-size: 10px;
}
#${PANEL_ID} .cd-ae-row { margin: 6px 0; }
#${PANEL_ID} .cd-ae-label { display: block; margin-bottom: 2px; }
#${PANEL_ID} .cd-ae-controls { display: flex; align-items: center; gap: 8px; }
#${PANEL_ID} .cd-ae-slider { flex: 1; accent-color: #c9a7ff; }
#${PANEL_ID} .cd-ae-value { width: 34px; text-align: right; font-variant-numeric: tabular-nums; }
#${PANEL_ID} .cd-ae-actions { display: flex; gap: 4px; }
#${PANEL_ID} .cd-ae-check { margin-left: 8px; vertical-align: middle; accent-color: #c9a7ff; }
#${PANEL_ID} .cd-ae-foot { display: flex; gap: 6px; flex-wrap: wrap; }
#${PANEL_ID} .cd-ae-button {
  padding: 3px 8px; cursor: pointer;
  background: #c9a7ff; color: #0d0716;
  border: 0; border-radius: 4px; font: inherit;
}
#${PANEL_ID} .cd-ae-button:hover:enabled { background: #e8ddff; }
#${PANEL_ID} .cd-ae-button:disabled { background: #4a3b66; color: #9d8bbf; cursor: default; }
#${PANEL_ID} .cd-ae-json {
  width: 100%; height: 140px; box-sizing: border-box; resize: vertical;
  background: #0d0716; color: #e8ddff; border: 1px solid #6b4d8f; border-radius: 4px;
  font: 11px/1.4 monospace;
}
`;
