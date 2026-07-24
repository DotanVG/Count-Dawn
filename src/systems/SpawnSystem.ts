import Phaser from 'phaser';
import { HUNTER } from '../data/balance';
import { ARENA } from '../game/constants';

/**
 * Spawns regular hunters at random arena-edge positions on a fixed interval,
 * respecting the alive cap and a minimum distance from the player.
 */
export class SpawnSystem {
  private timer: Phaser.Time.TimerEvent;

  constructor(
    scene: Phaser.Scene,
    private readonly countAlive: () => number,
    private readonly getPlayerPosition: () => { x: number; y: number },
    private readonly spawnHunter: (x: number, y: number) => void,
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
      const pos = this.randomEdgePosition();
      const dist = Phaser.Math.Distance.Between(pos.x, pos.y, player.x, player.y);
      if (dist >= HUNTER.minSpawnDistanceFromPlayer) {
        this.spawnHunter(pos.x, pos.y);
        return;
      }
    }
    // All attempts were too close to the player — skip this interval.
  }

  private randomEdgePosition(): { x: number; y: number } {
    const inset = 40;
    const edge = Phaser.Math.Between(0, 3);
    switch (edge) {
      case 0: // along the north wall
        return { x: Phaser.Math.Between(ARENA.left + inset, ARENA.right - inset), y: ARENA.top + inset };
      case 1: // bottom
        return { x: Phaser.Math.Between(ARENA.left + inset, ARENA.right - inset), y: ARENA.bottom - inset };
      case 2: // left
        return { x: ARENA.left + inset, y: Phaser.Math.Between(ARENA.top + inset, ARENA.bottom - inset) };
      default: // right
        return { x: ARENA.right - inset, y: Phaser.Math.Between(ARENA.top + inset, ARENA.bottom - inset) };
    }
  }
}
