/**
 * Single source of truth for mobile-vs-desktop decisions (touch UI, control
 * hints, rotate gate). Coarse pointer = touch-first device; a desktop with a
 * touchscreen but a mouse attached still reports a fine pointer and gets the
 * desktop experience.
 */
export function isTouchDevice(): boolean {
  return window.matchMedia('(pointer: coarse)').matches;
}
