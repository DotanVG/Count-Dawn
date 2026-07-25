// Explicit .ts extensions so Node can run this module directly in unit tests.
import { AUDIO } from '../utils/assetKeys.ts';

/**
 * What the game intends to be hearing. Kept separate from the sound objects
 * themselves so the flow is stated once and cannot drift:
 *
 *   menu                       none        -> main-title
 *   START pressed              main-title  -> main-title   (no change)
 *   cold-start cutscene        main-title  -> main-title   (no change)
 *   first night, control given main-title  -> level
 *   successful night / next    level       -> level        (no change)
 *   pause / resume             level stays level, the sound pauses
 *   death or dawn              level       -> main-title
 *   game over -> main menu     main-title  -> main-title   (no change)
 *   restart, cold open again   main-title  -> main-title   (no change)
 *   new run gains control      main-title  -> level
 */
export type MusicState = 'none' | 'main-title' | 'level';

export class MusicStateMachine {
  private state: MusicState = 'none';

  get current(): MusicState {
    return this.state;
  }

  /**
   * Records the intended track. Returns true ONLY when this actually changed
   * it — which is what makes repeated scene events (a second death signal, a
   * game-over screen re-asserting the Main Title, a run restarting) idempotent
   * instead of a second transition.
   */
  request(next: MusicState): boolean {
    if (next === this.state) return false;
    this.state = next;
    return true;
  }

  /** Restores a state without reporting a change (used to undo an editor preview). */
  force(next: MusicState): void {
    this.state = next;
  }
}

export function musicKeyForState(state: MusicState): string | null {
  if (state === 'main-title') return AUDIO.mainTitle;
  if (state === 'level') return AUDIO.levelMusic;
  return null;
}

export function musicStateForKey(key: string): MusicState {
  if (key === AUDIO.mainTitle) return 'main-title';
  if (key === AUDIO.levelMusic) return 'level';
  return 'none';
}
