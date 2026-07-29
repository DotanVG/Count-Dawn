import { gameSettings } from '../data/gameSettings';

const CURSOR_ID = 'vampire-cursor';
const MIN_BITE_MS = 220;
/** Set while the fangs should stay hidden regardless of pointer movement. */
const SUPPRESSED_CLASS = 'is-suppressed';
/** On <html> while something needs the real OS pointer back (the audio editor). */
const SYSTEM_CURSOR_CLASS = 'show-system-cursor';

/**
 * Hides or reveals the fangs without tearing them down.
 *
 * They default to VISIBLE, and that matters: the page sets `cursor: none` on
 * everything, so these teeth are the only pointer the game has. Hiding them on
 * a screen with a button on it leaves nothing to aim with at all. The one place
 * they come off is the opening cutscene, which is watched rather than played
 * (see GameScene.startIntro / startPlaying).
 */
export function setVampireCursorVisible(visible: boolean): void {
  document.getElementById(CURSOR_ID)?.classList.toggle(SUPPRESSED_CLASS, !visible);
}

/**
 * Puts the ordinary system pointer back on top of everything. The fangs are
 * deliberately left alone — the audio editor is a real HTML panel with sliders
 * to drag, and dragging a slider needs a pointer you can aim with.
 */
export function setSystemCursorVisible(visible: boolean): void {
  document.documentElement.classList.toggle(SYSTEM_CURSOR_CLASS, visible);
}

/**
 * Installs the desktop-only two-part vampire cursor. The hotspot is the
 * center of the open mouth, so the teeth close around the exact click point.
 */
export function installVampireCursor(): void {
  const finePointer = window.matchMedia('(pointer: fine)');
  if (!finePointer.matches || document.getElementById(CURSOR_ID)) return;

  const cursor = document.createElement('div');
  cursor.id = CURSOR_ID;
  cursor.setAttribute('aria-hidden', 'true');

  const upper = document.createElement('img');
  upper.className = 'vampire-cursor__jaw vampire-cursor__jaw--upper';
  upper.src = '/assets/ui/cursor/vampire_teeth_upper_jaw.png';
  upper.alt = '';
  upper.draggable = false;

  const lower = document.createElement('img');
  lower.className = 'vampire-cursor__jaw vampire-cursor__jaw--lower';
  lower.src = '/assets/ui/cursor/vampire_teeth_lower_jaw.png';
  lower.alt = '';
  lower.draggable = false;

  cursor.append(upper, lower);
  // The game root is the element promoted by the Fullscreen API. Keeping the
  // cursor inside it makes the jaws visible both normally and in fullscreen.
  (document.getElementById('game-root') ?? document.body).append(cursor);

  let pressed = false;
  let pressedAt = 0;
  let releaseTimer: number | undefined;
  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;
  let hasPosition = false;
  let cursorSpeed = 1;

  gameSettings.subscribe((settings) => {
    cursorSpeed = settings.cursorSpeed;
    cursor.style.setProperty('--jaw-width', `${30 * settings.cursorScale}px`);
  });

  const render = (): void => {
    if (hasPosition) {
      // The browser owns the real pointer, so "speed" here controls how
      // quickly the visible fangs catch it. At 200% they are effectively
      // immediate; lower values add progressively more follow-through.
      const response = 1 - Math.pow(0.18, cursorSpeed);
      currentX += (targetX - currentX) * response;
      currentY += (targetY - currentY) * response;
      cursor.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
    }
    window.requestAnimationFrame(render);
  };
  window.requestAnimationFrame(render);

  const move = (event: PointerEvent): void => {
    if (event.pointerType === 'touch') return;
    targetX = event.clientX;
    targetY = event.clientY;
    if (!hasPosition) {
      currentX = targetX;
      currentY = targetY;
      hasPosition = true;
    }
    cursor.classList.add('is-visible');
  };

  const press = (event: PointerEvent): void => {
    if (event.pointerType === 'touch') return;
    window.clearTimeout(releaseTimer);
    pressed = true;
    pressedAt = performance.now();
    cursor.classList.add('is-biting');
  };

  const release = (event: PointerEvent): void => {
    if (event.pointerType === 'touch') return;
    pressed = false;
    const remaining = Math.max(0, MIN_BITE_MS - (performance.now() - pressedAt));
    releaseTimer = window.setTimeout(() => {
      if (!pressed) cursor.classList.remove('is-biting');
    }, remaining);
  };

  document.addEventListener('pointermove', move, { passive: true });
  document.addEventListener('pointerdown', press, { passive: true });
  document.addEventListener('pointerup', release, { passive: true });
  document.addEventListener('pointercancel', release, { passive: true });
  document.documentElement.addEventListener('mouseleave', () => cursor.classList.remove('is-visible'));
  window.addEventListener('blur', () => {
    pressed = false;
    cursor.classList.remove('is-biting', 'is-visible');
  });
}
