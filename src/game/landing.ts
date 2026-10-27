import type Phaser from 'phaser';

/** Only deliberate entry imports Phaser and starts its existing asset loader. */
export function installDeferredStart(
  load: (context: AudioContext | undefined, progress: (value: number) => void) => Promise<() => void>,
): void {
  const shell = document.getElementById('landing-shell');
  const button = document.getElementById('start-night') as HTMLButtonElement;
  const status = document.getElementById('landing-status')!;
  let requested = false;

  const start = async (): Promise<void> => {
    if (requested) return;
    requested = true;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    status.textContent = 'Loading Count Dawn…';
    try {
      // Resume inside the gesture, before import() loses Safari user activation.
      const Audio = window.AudioContext ?? (window as typeof window & {
        webkitAudioContext?: typeof AudioContext;
      }).webkitAudioContext;
      const context = Audio ? new Audio() : undefined;
      void context?.resume().catch(() => { /* Phaser retries on the next gesture. */ });
      const enter = await load(context, (value) => {
        status.textContent = `Loading Count Dawn… ${Math.round(value * 100)}%`;
      });
      button.removeAttribute('aria-busy');
      status.textContent = 'Ready.';
      enter();
    } catch {
      status.textContent = 'The game could not load. Check your connection and retry.';
      button.removeAttribute('aria-busy');
      button.textContent = 'Retry loading';
      button.disabled = false;
      button.onclick = () => window.location.reload();
    }
  };

  shell!.onkeydown = (event) => event.stopPropagation();
  button.onclick = start;
  button.disabled = false;
  status.textContent = 'Ready. Start Night to load and enter the game.';
  document.getElementById('game-root')?.addEventListener('click', () => { void start(); });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !shell?.contains(event.target as Node)) void start();
  });
}

/** Share the existing menu action with a native button, without capturing page navigation keys. */
export function prepareLandingStart(game: Phaser.Game, start: () => void): void {
  if (document.documentElement.classList.contains('game-active')) return;
  if (game.events.listenerCount('landing-ready') > 0) {
    game.events.emit('landing-ready', start);
    return;
  }
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
