import type Phaser from 'phaser';

/** Share the existing menu action with a native button, without capturing page navigation keys. */
export function prepareLandingStart(game: Phaser.Game, start: () => void): void {
  if (document.documentElement.classList.contains('game-active')) return;
  const shell = document.getElementById('landing-shell');
  const button = document.getElementById('start-night') as HTMLButtonElement | null;
  const status = document.getElementById('landing-status');
  if (!shell || !button || !status) return;

  if (game.input.keyboard) game.input.keyboard.preventDefault = false;
  shell.onkeydown = (event) => event.stopPropagation();
  button.onclick = start;
  button.disabled = false;
  status.textContent = 'Ready. Start Night to enter the game.';
}

/** All existing entry paths keep the same intro and hand focus to the game. */
export function enterGameShell(game: Phaser.Game): void {
  document.documentElement.classList.add('game-active');
  if (game.input.keyboard) game.input.keyboard.preventDefault = true;
  window.scrollTo(0, 0);
  game.scale.refresh();
  document.getElementById('game-root')?.focus({ preventScroll: true });
}
