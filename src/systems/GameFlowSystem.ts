// Explicit .ts extension so Node can run this module directly in unit tests.
import { EVENTS, type GameEventEmitter } from '../game/events.ts';
import type { EndCause, Objective } from '../types/game';

/**
 * Single authority for the game rules: blood progress, boss state, coffin
 * activation, and the one-and-only end-of-run transition.
 *
 * Pure TypeScript (no Phaser import) so game rules stay unit-testable.
 */
export class GameFlowSystem {
  private blood = 0;
  private bossSpawned = false;
  private bossDefeated = false;
  private coffinActive = false;
  private ended = false;
  private endCause: EndCause | null = null;

  constructor(
    private readonly emitter: GameEventEmitter,
    readonly bloodTarget: number,
  ) {}

  get currentBlood(): number {
    return this.blood;
  }

  get isBloodFull(): boolean {
    return this.blood >= this.bloodTarget;
  }

  get hasBossSpawned(): boolean {
    return this.bossSpawned;
  }

  get isBossDefeated(): boolean {
    return this.bossDefeated;
  }

  get isCoffinActive(): boolean {
    return this.coffinActive;
  }

  get hasEnded(): boolean {
    return this.ended;
  }

  get result(): EndCause | null {
    return this.endCause;
  }

  get objective(): Objective {
    if (this.coffinActive) return 'return-to-coffin';
    if (this.bossSpawned && !this.bossDefeated) return 'defeat-boss';
    if (this.bossDefeated && !this.isBloodFull) return 'collect-more-blood';
    return 'collect-blood';
  }

  addBlood(amount: number): void {
    if (this.ended) return;
    const wasFull = this.isBloodFull;
    this.blood += amount;
    this.emitter.emit(EVENTS.BLOOD_CHANGED, this.blood, this.bloodTarget);
    if (!wasFull && this.isBloodFull && !this.bossSpawned) {
      this.emitter.emit(EVENTS.BOSS_SPAWN_REQUESTED);
    }
    this.refreshCoffinState();
  }

  notifyBossSpawned(): void {
    if (this.bossSpawned) return;
    this.bossSpawned = true;
    this.emitter.emit(EVENTS.BOSS_SPAWNED);
    this.emitObjective();
  }

  notifyBossDefeated(): void {
    if (this.ended || this.bossDefeated) return;
    this.bossDefeated = true;
    this.emitter.emit(EVENTS.BOSS_DEFEATED);
    this.refreshCoffinState();
  }

  /** Player overlapped the coffin. Returns true when this produced victory. */
  tryEnterCoffin(): boolean {
    if (this.ended || !this.coffinActive) return false;
    this.end('victory');
    return true;
  }

  notifyDawnReached(): void {
    this.end('dawn');
  }

  notifyPlayerDied(): void {
    this.end('death');
  }

  private refreshCoffinState(): void {
    if (!this.coffinActive && this.isBloodFull && this.bossDefeated) {
      this.coffinActive = true;
      this.emitter.emit(EVENTS.COFFIN_ACTIVATED);
    }
    this.emitObjective();
  }

  private emitObjective(): void {
    this.emitter.emit(EVENTS.OBJECTIVE_CHANGED, this.objective);
  }

  private end(cause: EndCause): void {
    if (this.ended) return;
    this.ended = true;
    this.endCause = cause;
    this.emitter.emit(EVENTS.GAME_ENDED, cause);
  }
}
