import Phaser from 'phaser';
import { BLOOD, NIGHT } from '../data/balance';
import {
  ARENA,
  COLORS,
  DEPTHS,
  GAME_TAGLINE,
  GAME_TITLE,
  GAME_WIDTH,
  GAME_HEIGHT,
  SCENES,
} from '../game/constants';
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
import { CastleMap } from '../world/CastleMap';
import { DawnSky } from '../world/DawnSky';
import { HUD } from '../ui/HUD';
import { AUDIO } from '../utils/assetKeys';
import type { EndCause, RunSummary } from '../types/game';

type Phase = 'menu' | 'intro' | 'playing' | 'ended';

interface GameSceneData {
  /** Skip the menu (used by the restart buttons) and fly straight in. */
  autostart?: boolean;
}

const FONT = 'Trebuchet MS, sans-serif';
const PLAYER_SPAWN = { x: 280, y: 430 };
const COFFIN_POS = { x: 150, y: 430 };
/** The vampire flies in through the middle sky window. */
const FLY_IN_START = { x: GAME_WIDTH / 2, y: 120 };

/**
 * One night in the castle. The scene doubles as the main menu: the hall,
 * sky and torches are always alive; pressing START triggers the vampire
 * fly-in, the HUD appears and the countdown begins.
 */
export class GameScene extends Phaser.Scene {
  private phase: Phase = 'menu';
  private emitter!: Phaser.Events.EventEmitter;
  private flow!: GameFlowSystem;
  private countdown: CountdownSystem | null = null;
  private audioFx!: AudioSystem;
  private sky!: DawnSky;
  private player!: Player;
  private coffin!: Coffin;
  private boss: HunterCaptain | null = null;
  private hunters!: Phaser.Physics.Arcade.Group;
  private pickups!: Phaser.Physics.Arcade.Group;
  private inputController!: InputController;
  private combat!: CombatSystem;
  private spawner: SpawnSystem | null = null;
  private hud: HUD | null = null;
  private dawnOverlay!: Phaser.GameObjects.Rectangle;
  private nightOverlay!: Phaser.GameObjects.Rectangle;
  private menuUi: Phaser.GameObjects.Container | null = null;

  constructor() {
    super(SCENES.game);
  }

  create(data: GameSceneData): void {
    this.phase = 'menu';
    this.boss = null;
    this.countdown = null;
    this.spawner = null;
    this.hud = null;

    this.emitter = new Phaser.Events.EventEmitter();
    this.flow = new GameFlowSystem(this.emitter, BLOOD.target);
    this.audioFx = new AudioSystem(this);

    new CastleMap(this);
    this.sky = new DawnSky(this);

    this.coffin = new Coffin(this, COFFIN_POS.x, COFFIN_POS.y);
    this.player = new Player(this, PLAYER_SPAWN.x, PLAYER_SPAWN.y, this.emitter);
    this.setPlayerDormant(true);

    this.hunters = this.physics.add.group();
    this.pickups = this.physics.add.group();

    this.inputController = new InputController(this);
    this.combat = new CombatSystem(
      this,
      this.player,
      (hunter) => this.onHunterKilled(hunter),
      () => this.audioFx.play(AUDIO.playerAttack),
    );

    // Cold ambient darkness that lifts as the night passes…
    this.nightOverlay = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x150c33, 0.42)
      .setOrigin(0)
      .setDepth(DEPTHS.dawnOverlay - 1);
    // …and warm dawn light that ramps in near sunrise.
    this.dawnOverlay = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.dawn, 0)
      .setOrigin(0)
      .setDepth(DEPTHS.dawnOverlay);

    this.setupCollisions();
    this.wireEvents();
    this.setupPauseKeys();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);

    if (data?.autostart) {
      this.startIntro();
    } else {
      this.buildMenu();
    }
  }

  update(_time: number, delta: number): void {
    this.sky.update(this.countdown?.progress ?? 0);

    if (this.phase !== 'playing' || !this.countdown) return;

    this.countdown.update(delta);
    if (this.phase !== 'playing') return; // dawn may have just ended the run

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

    this.hud?.setCooldownProgress(this.combat.cooldownProgress);

    const p = this.countdown.progress;
    this.nightOverlay.setAlpha(0.42 * (1 - p * p));
    this.dawnOverlay.setAlpha(p * p * 0.18);
  }

  // ── Menu & intro ────────────────────────────────────────────────────────

  private buildMenu(): void {
    const cx = GAME_WIDTH / 2;

    const dim = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0d0716, 0.45).setOrigin(0);
    const title = this.add
      .text(cx, GAME_HEIGHT * 0.3, GAME_TITLE, {
        fontFamily: FONT,
        fontSize: '84px',
        color: '#c9a7ff',
        fontStyle: 'bold',
        stroke: '#0d0716',
        strokeThickness: 10,
      })
      .setOrigin(0.5);
    const tagline = this.add
      .text(cx, GAME_HEIGHT * 0.42, GAME_TAGLINE, { fontFamily: FONT, fontSize: '22px', color: '#e8ddff' })
      .setOrigin(0.5);
    const controls = this.add
      .text(
        cx,
        GAME_HEIGHT * 0.55,
        'Move — WASD / Arrows      Aim — Mouse      Attack — Click / Space      Pause — Esc / P',
        { fontFamily: FONT, fontSize: '17px', color: '#9d8bbf' },
      )
      .setOrigin(0.5);

    const start = this.add
      .text(cx, GAME_HEIGHT * 0.7, 'START NIGHT', {
        fontFamily: FONT,
        fontSize: '34px',
        color: '#0d0716',
        backgroundColor: '#c9a7ff',
        padding: { x: 30, y: 12 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    start.on('pointerover', () => start.setBackgroundColor('#e8ddff'));
    start.on('pointerout', () => start.setBackgroundColor('#c9a7ff'));
    start.on('pointerdown', () => this.startIntro());

    this.tweens.add({
      targets: start,
      scale: { from: 1, to: 1.05 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.menuUi = this.add.container(0, 0, [dim, title, tagline, controls, start]).setDepth(DEPTHS.menu);

    this.input.keyboard?.once('keydown-ENTER', () => this.startIntro());
  }

  private startIntro(): void {
    if (this.phase !== 'menu') return;
    this.phase = 'intro';

    if (this.menuUi) {
      const ui = this.menuUi;
      this.menuUi = null;
      this.tweens.add({ targets: ui, alpha: 0, duration: 300, onComplete: () => ui.destroy() });
    }

    // The Count swoops in through the middle window.
    this.player
      .setVisible(true)
      .setPosition(FLY_IN_START.x, FLY_IN_START.y)
      .setScale(0.7)
      .setAlpha(0.6);
    this.player.play('vampire-run-down');

    this.tweens.add({
      targets: this.player,
      x: PLAYER_SPAWN.x,
      duration: 1100,
      ease: 'Sine.easeOut',
    });
    this.tweens.add({
      targets: this.player,
      y: PLAYER_SPAWN.y,
      scale: 2,
      alpha: 1,
      duration: 1100,
      ease: 'Quad.easeIn',
      onComplete: () => this.startPlaying(),
    });
    this.tweens.add({
      targets: this.player,
      angle: { from: -14, to: 0 },
      duration: 1100,
      ease: 'Sine.easeInOut',
    });
  }

  private startPlaying(): void {
    this.phase = 'playing';
    this.setPlayerDormant(false);
    this.cameras.main.shake(120, 0.004); // landing thump

    this.hud = new HUD(this, this.emitter);
    this.hud.animateIn();

    this.countdown = new CountdownSystem(
      this.emitter,
      NIGHT.durationSeconds,
      NIGHT.bossSpawnAtRemainingSeconds,
      NIGHT.finalWarningSeconds,
    );

    this.spawner = new SpawnSystem(
      this,
      () => this.hunters.countActive(true),
      () => ({ x: this.player.x, y: this.player.y }),
      (x, y) => this.hunters.add(new Hunter(this, x, y)),
    );
  }

  private setPlayerDormant(dormant: boolean): void {
    this.player.setVisible(!dormant);
    const body = this.player.body as Phaser.Physics.Arcade.Body | null;
    if (body) body.enable = !dormant;
  }

  // ── Wiring ──────────────────────────────────────────────────────────────

  private getAttackTargets(): Hunter[] {
    const targets = this.hunters.getChildren().filter((h): h is Hunter => h instanceof Hunter);
    if (this.boss?.active) targets.push(this.boss);
    return targets;
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
      if (this.phase !== 'playing') return;
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
    if (this.phase !== 'playing' || this.scene.isPaused()) return;
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

  /** Arena-edge midpoint farthest from the player. */
  private bossSpawnPosition(): { x: number; y: number } {
    const cx = (ARENA.left + ARENA.right) / 2;
    const cy = (ARENA.top + ARENA.bottom) / 2;
    const inset = 70;
    const candidates = [
      { x: cx, y: ARENA.top + inset },
      { x: cx, y: ARENA.bottom - inset },
      { x: ARENA.left + inset, y: cy },
      { x: ARENA.right - inset, y: cy },
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
    hunter.spawnCorpse();
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
    this.phase = 'ended';
    this.spawner?.stop();
    this.physics.pause();

    const summary: RunSummary = {
      cause,
      bloodCollected: this.flow.currentBlood,
      bloodTarget: this.flow.bloodTarget,
      timeSurvivedSeconds: Math.round(this.countdown?.elapsedSeconds ?? 0),
      timeRemainingSeconds: this.countdown?.remainingSeconds ?? 0,
    };

    this.audioFx.play(cause === 'victory' ? AUDIO.victory : AUDIO.defeat);

    // Short beat so the last hit / dawn flash reads before the transition.
    this.time.delayedCall(900, () => {
      this.scene.start(cause === 'victory' ? SCENES.victory : SCENES.gameOver, summary);
    });
  }

  private cleanup(): void {
    this.emitter.removeAllListeners();
    this.hud?.destroy();
    this.spawner?.stop();
    this.input.keyboard?.off('keydown-ESC', this.pauseGame, this);
    this.input.keyboard?.off('keydown-P', this.pauseGame, this);
  }
}
