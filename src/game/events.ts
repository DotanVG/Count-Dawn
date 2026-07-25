/**
 * Centralized gameplay event names. Systems communicate through a per-run
 * EventEmitter owned by GameScene, using only names defined here.
 */
export const EVENTS = {
  COUNTDOWN_TICK: 'countdown-tick',
  FINAL_TEN_SECONDS: 'final-ten-seconds',
  BOSS_SPAWN_REQUESTED: 'boss-spawn-requested',
  DAWN_REACHED: 'dawn-reached',
  BLOOD_CHANGED: 'blood-changed',
  BOSS_SPAWNED: 'boss-spawned',
  BOSS_HEALTH_CHANGED: 'boss-health-changed',
  BOSS_DEFEATED: 'boss-defeated',
  COFFIN_ACTIVATED: 'coffin-activated',
  BAT_FORM_CHANGED: 'bat-form-changed',
  PLAYER_DAMAGED: 'player-damaged',
  /** Blood collected while the meter was already full, spent as healing instead. */
  PLAYER_HEALED: 'player-healed',
  /** Same, from the rules side: a bloodlet arrived with nowhere left to go. */
  BLOOD_OVERFLOWED: 'blood-overflowed',
  PLAYER_DIED: 'player-died',
  OBJECTIVE_CHANGED: 'objective-changed',
  GAME_ENDED: 'game-ended',
} as const;

export type GameEventName = (typeof EVENTS)[keyof typeof EVENTS];

/** Minimal emitter contract so pure systems stay testable without Phaser. */
export interface GameEventEmitter {
  emit(event: GameEventName, ...args: unknown[]): boolean;
}
