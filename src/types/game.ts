/** Why the run ended. */
export type EndCause = 'victory' | 'dawn' | 'death';

/**
 * The kinds of hunter that can be drained, in the order the debrief lists them.
 * The `sword` swordsman is gone with the bought pack — every melee hunter now
 * carries one of Romi's three weapons, so the weapon IS the kind.
 */
export type HunterKind = 'spike' | 'pitchfork' | 'torch' | 'thrower';

/** The kinds of mini-boss, in the order the debrief lists them. */
export type BossKind = 'priest' | 'captain' | 'garlicCaptain' | 'crossCaptain';

/**
 * Totals for a whole RUN, not a night — they survive the coffin and keep
 * climbing across every night until dawn or a hunter ends it. This is what the
 * debrief on the game-over screen is built from.
 */
export interface RunStats {
  /** Nights fully survived. The night you die on does not count. */
  nightsSurvived: number;
  /** Every bloodlet drunk since the run began, quota and overflow alike. */
  bloodCollected: number;
  hunters: Record<HunterKind, number>;
  bosses: Record<BossKind, number>;
}

/** Summary passed to the GameOver / Victory scenes. */
export interface RunSummary {
  cause: EndCause;
  /** Blood on THIS night's meter, against this night's quota. */
  bloodCollected: number;
  bloodTarget: number;
  /** Seconds from night start until the run ended. */
  timeSurvivedSeconds: number;
  /** Seconds left on the clock (relevant for victory). */
  timeRemainingSeconds: number;
  /** Whole-run totals for the debrief. */
  stats: RunStats;
}

/** A fresh, empty tally. */
export function emptyRunStats(): RunStats {
  return {
    nightsSurvived: 0,
    bloodCollected: 0,
    hunters: { spike: 0, pitchfork: 0, torch: 0, thrower: 0 },
    bosses: { priest: 0, captain: 0, garlicCaptain: 0, crossCaptain: 0 },
  };
}

/** Current HUD objective, decided by GameFlowSystem. */
export type Objective =
  | 'collect-blood'
  | 'defeat-boss'
  | 'collect-more-blood'
  | 'return-to-coffin';
