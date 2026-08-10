import Phaser from 'phaser';
import { HUNTER } from '../data/balance';
import { EntranceController, type SpawnEntrant } from './EntranceController';

/**
 * Spawns regular hunters on a fixed interval, respecting the alive cap, by
 * routing every spawn through EntranceController — one of the hall's three
 * doors, never a random arena edge. The caller's `spawnHunter` still owns
 * actually constructing the Hunter and calling Hunter.beginEntrance(); this
 * class only decides *when* to ask for one and hands the door math off to
 * the controller.
 */
export class SpawnSystem {
  private readonly entranceController: EntranceController;
  private timer: Phaser.Time.TimerEvent;

  constructor(
    scene: Phaser.Scene,
    private readonly spawnIntervalMs: number,
    private readonly maxAlive: number,
    private readonly countAlive: () => number,
    getPlayerPosition: () => { x: number; y: number },
    spawnHunter: SpawnEntrant,
  ) {
    this.entranceController = new EntranceController(
      getPlayerPosition,
      HUNTER.minSpawnDistanceFromPlayer,
      spawnHunter,
    );
    this.timer = scene.time.addEvent({
      delay: this.spawnIntervalMs,
      loop: true,
      callback: () => this.trySpawn(),
    });
  }

  stop(): void {
    this.timer.remove();
  }

  private trySpawn(): void {
    if (this.countAlive() >= this.maxAlive) return;
    this.entranceController.spawnAt();
  }
}
