import Phaser from 'phaser';
import { HUNTER } from '../data/balance';
import { ARENA } from '../game/constants';
import { offCanvasSpawnPoint } from './entrance';

/**
 * Spawns regular hunters at random arena-edge positions on a fixed interval,
 * respecting the alive cap and a minimum distance from the player. Each spawn
 * is reported as an off-screen spawn point plus the just-inside arrival point
 * it should walk to, so the caller can wire up Hunter.beginEntrance().
 */
export class SpawnSystem {
  private timer: Phaser.Time.TimerEvent;

  constructor(
    scene: Phaser.Scene,
    private readonly countAlive: () => number,
    private readonly getPlayerPosition: () => { x: number; y: number },
    private readonly spawnHunter: (spawnX: number, spawnY: number, arrivalX: number, arrivalY: number) => void,
  ) {
    this.timer = scene.time.addEvent({
      delay: HUNTER.spawnIntervalMs,
      loop: true,
      callback: () => this.trySpawn(),
    });
  }

  stop(): void {
    this.timer.remove();
  }

  private trySpawn(): void {
    if (this.countAlive() >= HUNTER.maxAlive) return;

    const player = this.getPlayerPosition();
    for (let attempt = 0; attempt < 8; attempt++) {
      const arrival = this.randomEdgePosition();
      const dist = Phaser.Math.Distance.Between(arrival.x, arrival.y, player.x, player.y);
      if (dist >= HUNTER.minSpawnDistanceFromPlayer) {
        const spawn = offCanvasSpawnPoint(arrival);
        this.spawnHunter(spawn.x, spawn.y, arrival.x, arrival.y);
        return;
      }
    }
    // All attempts were too close to the player — skip this interval.
  }

  /**
   * Bottom, left, or right only — never the north wall. The player starts
   * facing that wall from the coffin, so hunters walking in from behind him
   * (off the top edge) would spawn out of view in an unfair way; the sides
   * and the bottom are all visible/approachable from the play area instead.
   */
  private randomEdgePosition(): { x: number; y: number } {
    const inset = 40;
    const edge = Phaser.Math.Between(0, 2);
    switch (edge) {
      case 0: // bottom
        return { x: Phaser.Math.Between(ARENA.left + inset, ARENA.right - inset), y: ARENA.bottom - inset };
      case 1: // left
        return { x: ARENA.left + inset, y: Phaser.Math.Between(ARENA.top + inset, ARENA.bottom - inset) };
      default: // right
        return { x: ARENA.right - inset, y: Phaser.Math.Between(ARENA.top + inset, ARENA.bottom - inset) };
    }
  }
}
