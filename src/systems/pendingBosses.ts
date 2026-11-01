// Explicit .ts extension so Node can run this module directly in unit tests.

export interface BookedBoss {
  readonly name: string;
  /** True for the Priest. Queued captains have not rolled a flavour yet. */
  readonly priest: boolean;
}

export interface BossLineupCounts {
  readonly priests: number;
  readonly captains: number;
}

/**
 * A night's bosses, including ones still waiting on a busy door.
 * Defeat is the whole booked lineup, not the subset that has entered.
 */
export class PendingBossLineup {
  private pending = 0;

  /** Bosses booked but not yet killed. Includes ones still queued at a door. */
  get remaining(): number {
    return this.pending;
  }

  /**
   * Book `total` bosses. A second call while any are still pending is
   * refused, so a repeat spawn request cannot stack another wave on top.
   */
  begin(total: number): boolean {
    if (this.pending > 0 || total <= 0) return false;
    this.pending = total;
    return true;
  }

  /**
   * One booked boss died. True only when that was the last one, including
   * a boss that had not entered yet.
   */
  defeat(): boolean {
    if (this.pending <= 0) return false;
    this.pending -= 1;
    return this.pending === 0;
  }

  reset(): void {
    this.pending = 0;
  }
}

/**
 * Banner names for a lineup. Bosses that have claimed a door keep the
 * flavour they rolled. Anyone still queued has no sprite yet, so the rest
 * of the booking is filled in as Priest / Captain — the banner must not
 * shrink to whoever happened to find a free door.
 */
export function bossRosterNames(
  entered: readonly BookedBoss[],
  lineup: BossLineupCounts,
): string[] {
  const names = entered.map((boss) => boss.name);
  const total = lineup.priests + lineup.captains;
  const queued = Math.max(0, total - names.length);
  if (queued === 0) return names;

  const priestsEntered = entered.filter((boss) => boss.priest).length;
  const priestsQueued = Math.min(queued, Math.max(0, lineup.priests - priestsEntered));
  const captainsQueued = queued - priestsQueued;
  for (let i = 0; i < priestsQueued; i++) names.push('Priest');
  for (let i = 0; i < captainsQueued; i++) names.push('Captain');
  return names;
}
