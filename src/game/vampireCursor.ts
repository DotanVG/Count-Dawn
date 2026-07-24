const CURSOR_ID = 'vampire-cursor';
const MIN_BITE_MS = 220;

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

  const move = (event: PointerEvent): void => {
    if (event.pointerType === 'touch') return;
    cursor.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
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
