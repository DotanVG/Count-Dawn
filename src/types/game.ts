/** Why the run ended. */
export type EndCause = 'victory' | 'dawn' | 'death';

/** Summary passed to the GameOver / Victory scenes. */
export interface RunSummary {
  cause: EndCause;
  bloodCollected: number;
  bloodTarget: number;
  /** Seconds from night start until the run ended. */
  timeSurvivedSeconds: number;
  /** Seconds left on the clock (relevant for victory). */
  timeRemainingSeconds: number;
}

/** Current HUD objective, decided by GameFlowSystem. */
export type Objective =
  | 'collect-blood'
  | 'defeat-boss'
  | 'collect-more-blood'
  | 'return-to-coffin';
