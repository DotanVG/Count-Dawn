import Phaser from 'phaser';
import { BLOOD, NIGHT } from '../data/balance';
import { COLORS, GAME_WIDTH, GAME_HEIGHT, SCENES, WALL_THICKNESS } from '../game/constants';
import { EVENTS } from '../game/events';
import { Player } from '../entities/Player';
import { Hunter } from '../entities/Hunter';
import { HunterCaptain } from '../entities/HunterCaptain';
import { BloodPickup } from '../entities/BloodPickup';
import { Coffin } from '../entities/Coffin';
import { InputController } from '../systems/InputController';
import { CombatSystem } from '../systems/CombatSystem';
import { SpawnSystem } from '../systems/SpawnSystem';
import { CountdownSystem } from '../systems/CountdownSystem';
import { GameFlowSystem } from '../systems/GameFlowSystem';
import { AudioSystem } from '../systems/AudioSystem';
import { HUD } from '../ui/HUD';
import { AUDIO } from '../utils/assetKeys';
import type { EndCause, RunSummary } from '../types/game';

/**
 * Coordinates one night: entities, systems and HUD wired together through a
 * per-run EventEmitter. Rule decisions live in GameFlowSystem; timing in
 * CountdownSystem — this scene just connects them to Phaser objects.
 */
export class GameScene extends Phaser.Scene {
  private emitter!: Phaser.Events.EventEmitter;
  private flow!: GameFlowSystem;
  private countdown!: CountdownSystem;
  private audioFx!: AudioSystem;
  private player!: Player;
  private coffin!: Coffin;
  private boss: HunterCaptain | null = null;
  private hunters!: Phaser.Physics.Arcade.Group;
  private pickups!: Phaser.Physics.Arcade.Group;
  private inputController!: InputController;
  private combat!: CombatSystem;
  private spawner!: SpawnSystem;
  private hud!: HUD;
  private dawnOverlay!: Phaser.GameObjects.Rectangle;
  private runEnded = false;

  constructor() {
    super(SCENES.game);
  }

  create(): void {
    this.runEnded = false;
    this.boss = null;

    this.emitter = new Phaser.Events.EventEmitter();
    this.flow = new GameFlowSystem(this.emitter, BLOOD.target);
    this.countdown = new CountdownSystem(
      this.emitter,
      NIGHT.durationSeconds,
      NIGHT.bossSpawnAtRemainingSeconds,
      NIGHT.finalWarningSeconds,
    );
    this.audioFx = new AudioSystem(this);

    this.createArena();

    this.coffin = new Coffin(this, 110, GAME_HEIGHT / 2);
    this.player = new Player(this, 220, GAME_HEIGHT / 2, this.emitter);

    this.hunters = this.physics.add.group();
    this.pickups = this.physics.add.group();

    this.inputController = new InputController(this);
    this.combat = new CombatSystem(
      this,
      this.player,
      (hunter) => this.onHunterKilled(hunter),
      () => this.audioFx.play(AUDIO.playerAttack),
    );
    this.spawner = new SpawnSystem(
      this,
      () => this.hunters.countActive(true),
      () => ({ x: this.player.x, y: this.player.y }),
      (x, y) => this.hunters.add(new Hunter(this, x, y)),
    );

    this.hud = new HUD(this, this.emitter);

    // Night → dawn transition overlay; alpha grows with countdown progress.
    this.dawnOverlay = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.dawn, 0)
      .setOrigin(0)
      .setDepth(50);

    this.setupCollisions();
    this.wireEvents();
    this.setupPauseKeys();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
  }

  update(_time: number, delta: number): void {
    if (this.runEnded) return;

    this.countdown.update(delta);
    if (this.runEnded) return; // dawn may have just ended the run

    const move = this.inputController.getMoveVector();
    this.player.move(move.x, move.y);

    const aim = this.inputController.getAimPoint();
    this.player.aimAt(aim.x, aim.y);

    if (this.inputController.isAttackDown()) {
      this.combat.tryAttack(this.getAttackTargets());
    }

    for (const hunter of this.getAttackTargets()) {
      hunter.pursue(this.player.x, this.player.y);
    }

    this.hud.setCooldownProgress(this.combat.cooldownProgress);

    // Ease the dawn light in; ramps harder over the final stretch.
    const p = this.countdown.progress;
    this.dawnOverlay.setAlpha(p * p * 0.3);
  }

  private getAttackTargets(): Hunter[] {
    const targets = this.hunters.getChildren().filter((h): h is Hunter => h instanceof Hunter);
    if (this.boss?.active) targets.push(this.boss);
    return targets;
  }

  private createArena(): void {
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.arenaFloor).setOrigin(0).setDepth(0);

    const t = WALL_THICKNESS;
    const wallRects = [
      [0, 0, GAME_WIDTH, t],
      [0, GAME_HEIGHT - t, GAME_WIDTH, t],
      [0, 0, t, GAME_HEIGHT],
      [GAME_WIDTH - t, 0, t, GAME_HEIGHT],
    ] as const;
    for (const [x, y, w, h] of wallRects) {
      this.add.rectangle(x, y, w, h, COLORS.wall).setOrigin(0).setDepth(1);
    }

    this.physics.world.setBounds(t, t, GAME_WIDTH - 2 * t, GAME_HEIGHT - 2 * t);
  }

  private setupCollisions(): void {
    this.physics.add.overlap(this.player, this.hunters, (_player, hunterObj) => {
      const hunter = hunterObj as Hunter;
      if (hunter.isAlive) this.player.takeDamage(hunter.contactDamage);
    });

    this.physics.add.overlap(this.player, this.pickups, (_player, pickupObj) => {
      const pickup = pickupObj as BloodPickup;
      this.flow.addBlood(pickup.amount);
      this.audioFx.play(AUDIO.bloodPickup);
      pickup.collect();
    });

    this.physics.add.overlap(this.player, this.coffin, () => {
      if (this.flow.tryEnterCoffin()) return;
      this.coffin.showRequirementHint(this.coffinHintMessage());
    });
  }

  private coffinHintMessage(): string {
    const needsBlood = !this.flow.isBloodFull;
    const needsBoss = !this.flow.isBossDefeated;
    if (needsBlood && needsBoss) return 'Not yet: collect blood and slay the Captain';
    if (needsBoss) return 'The Hunter Captain still lives';
    return 'You need more blood';
  }

  private wireEvents(): void {
    this.emitter.on(EVENTS.BOSS_SPAWN_REQUESTED, this.spawnBoss, this);
    this.emitter.on(EVENTS.DAWN_REACHED, this.onDawnReached, this);
    this.emitter.on(EVENTS.PLAYER_DIED, () => this.flow.notifyPlayerDied());
    this.emitter.on(EVENTS.PLAYER_DAMAGED, () => this.audioFx.play(AUDIO.playerHurt));
    this.emitter.on(EVENTS.COFFIN_ACTIVATED, () => this.coffin.activate());
    this.emitter.on(EVENTS.FINAL_TEN_SECONDS, () => {
      this.audioFx.play(AUDIO.finalSeconds);
      this.cameras.main.flash(200, 255, 154, 61);
    });
    this.emitter.on(EVENTS.GAME_ENDED, this.onGameEnded, this);
  }

  private setupPauseKeys(): void {
    this.input.keyboard?.on('keydown-ESC', this.pauseGame, this);
    this.input.keyboard?.on('keydown-P', this.pauseGame, this);
  }

  private pauseGame(): void {
    if (this.runEnded || this.scene.isPaused()) return;
    this.scene.pause();
    this.scene.launch(SCENES.pause);
  }

  private spawnBoss(): void {
    if (this.boss) return;
    const pos = this.bossSpawnPosition();
    this.boss = new HunterCaptain(this, pos.x, pos.y, this.emitter);
    this.hunters.add(this.boss);
    this.boss.playEntrance();
    this.flow.notifyBossSpawned();
    this.audioFx.play(AUDIO.bossAppear);
  }

  /** Edge midpoint farthest from the player, so the boss never pops in on top of him. */
  private bossSpawnPosition(): { x: number; y: number } {
    const m = WALL_THICKNESS + 50;
    const candidates = [
      { x: GAME_WIDTH / 2, y: m },
      { x: GAME_WIDTH / 2, y: GAME_HEIGHT - m },
      { x: m, y: GAME_HEIGHT / 2 },
      { x: GAME_WIDTH - m, y: GAME_HEIGHT / 2 },
    ];
    let best = candidates[0];
    let bestDist = -1;
    for (const c of candidates) {
      const d = Phaser.Math.Distance.Between(c.x, c.y, this.player.x, this.player.y);
      if (d > bestDist) {
        bestDist = d;
        best = c;
      }
    }
    return best;
  }

  private onHunterKilled(hunter: Hunter): void {
    if (hunter instanceof HunterCaptain) {
      this.boss = null;
      this.flow.notifyBossDefeated();
    } else {
      this.pickups.add(new BloodPickup(this, hunter.x, hunter.y));
      this.audioFx.play(AUDIO.hunterDeath);
    }
    this.hunters.remove(hunter, true, true);
  }

  private onDawnReached(): void {
    this.audioFx.play(AUDIO.dawn);
    this.flow.notifyDawnReached();
  }

  private onGameEnded(cause: EndCause): void {
    this.runEnded = true;
    this.spawner.stop();
    this.physics.pause();

    const summary: RunSummary = {
      cause,
      bloodCollected: this.flow.currentBlood,
      bloodTarget: this.flow.bloodTarget,
      timeSurvivedSeconds: Math.round(this.countdown.elapsedSeconds),
      timeRemainingSeconds: this.countdown.remainingSeconds,
    };

    this.audioFx.play(cause === 'victory' ? AUDIO.victory : AUDIO.defeat);

    // Short beat so the last hit / dawn flash reads before the transition.
    this.time.delayedCall(900, () => {
      this.scene.start(cause === 'victory' ? SCENES.victory : SCENES.gameOver, summary);
    });
  }

  private cleanup(): void {
    this.emitter.removeAllListeners();
    this.hud.destroy();
    this.spawner.stop();
    this.input.keyboard?.off('keydown-ESC', this.pauseGame, this);
    this.input.keyboard?.off('keydown-P', this.pauseGame, this);
  }
}
