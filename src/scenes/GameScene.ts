import Phaser from 'phaser';
import {
  BLOOD,
  HUNTER,
  NIGHT,
  PLAYER,
  THROWER,
  bloodTargetForNight,
  hunterPressureForNight,
} from '../data/balance';
import {
  ARENA,
  COLORS,
  DEPTHS,
  GAME_WIDTH,
  GAME_HEIGHT,
  HUD_ANCHORS,
  SCENES,
  TAGLINE_SENTENCES,
} from '../game/constants';
import { EVENTS } from '../game/events';
import { isTouchDevice } from '../game/device';
import { Player } from '../entities/Player';
import { Hunter } from '../entities/Hunter';
import { HunterCaptain } from '../entities/HunterCaptain';
import { GarlicThrower } from '../entities/GarlicThrower';
import { Garlic } from '../entities/Garlic';
import { BloodPickup } from '../entities/BloodPickup';
import { Coffin } from '../entities/Coffin';
import { InputController } from '../systems/InputController';
import { CombatSystem } from '../systems/CombatSystem';
import { SpawnSystem } from '../systems/SpawnSystem';
import { offCanvasSpawnPoint } from '../systems/entrance';
import { CountdownSystem } from '../systems/CountdownSystem';
import { GameFlowSystem } from '../systems/GameFlowSystem';
import { AudioSystem } from '../systems/AudioSystem';
import { CastleMap } from '../world/CastleMap';
import { DawnSky } from '../world/DawnSky';
import { HUD } from '../ui/HUD';
import { TouchControls } from '../ui/TouchControls';
import { TEXTURES, AUDIO } from '../utils/assetKeys';
import type { EndCause, RunSummary } from '../types/game';

type Phase = 'menu' | 'intro' | 'playing' | 'transition' | 'ended';

interface GameSceneData {
  /** Skip the menu (used by the restart buttons) and rise straight from the coffin. */
  autostart?: boolean;
}

const FONT = 'Trebuchet MS, sans-serif';
const COFFIN_POS = { x: 150, y: 430 };

/** The state the Count comes home in during the opening cinematic. */
const CINEMATIC = {
  /** Low enough to sit in the red band, so the bar is flashing as he flies in. */
  startHealth: 18,
  /** Blood he is short of a full meter - one hunter's worth. */
  bloodShortfall: 4,
} as const;
/** The vampire's landing spot: the center of the hall. */
const PLAYER_SPAWN = {
  x: (ARENA.left + ARENA.right) / 2,
  y: (ARENA.top + ARENA.bottom) / 2,
};

/**
 * One castle hall, played as an endless sequence of nights. The scene
 * doubles as the main menu: the hall, sky and torches are always alive;
 * pressing START opens the coffin and the Count spirals out to the hall
 * center. Successfully returning to the coffin doesn't end the game — it
 * plays the blood/HP transfer, fast-forwards dusk back into a fresh night
 * (moon rising), and flies him back out for the next round, with no screen
 * in between. Dawn or death are the only ways a run truly ends.
 */
export class GameScene extends Phaser.Scene {
  private phase: Phase = 'menu';
  private isTouch = false;
  private night = 1;
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
  private garlics!: Phaser.Physics.Arcade.Group;
  private inputController!: InputController;
  private combat!: CombatSystem;
  private spawner: SpawnSystem | null = null;
  private hud: HUD | null = null;
  private touch: TouchControls | null = null;
  private dawnOverlay!: Phaser.GameObjects.Rectangle;
  private nightOverlay!: Phaser.GameObjects.Rectangle;
  private menuUi: Phaser.GameObjects.Container | null = null;
  private taglineTimer: Phaser.Time.TimerEvent | null = null;
  /** The opening cinematic plays once, from the menu - restarts skip it. */
  private playCinematic = true;

  constructor() {
    super(SCENES.game);
  }

  create(data: GameSceneData): void {
    this.phase = 'menu';
    this.isTouch = isTouchDevice();
    this.night = 1;
    this.boss = null;
    this.countdown = null;
    this.spawner = null;
    this.hud = null;
    this.touch = null;

    this.emitter = new Phaser.Events.EventEmitter();
    this.flow = new GameFlowSystem(this.emitter, bloodTargetForNight(this.night));
    this.audioFx = new AudioSystem(this);

    new CastleMap(this);
    this.sky = new DawnSky(this);

    this.coffin = new Coffin(this, COFFIN_POS.x, COFFIN_POS.y);
    this.player = new Player(this, PLAYER_SPAWN.x, PLAYER_SPAWN.y, this.emitter);
    this.setPlayerDormant(true);

    this.hunters = this.physics.add.group();
    this.pickups = this.physics.add.group();
    this.garlics = this.physics.add.group();

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

    // Strict check: Phaser keeps the previous start()'s data when none is
    // passed, so a stale { autostart: true } must not skip the menu.
    if (data?.autostart === true) {
      // Restart from an end screen: straight back into a night, no cold open.
      this.playCinematic = false;
      this.startIntro();
    } else {
      this.playCinematic = true;
      this.buildMenu();
    }
  }

  update(_time: number, delta: number): void {
    // During 'transition' and 'intro' a cycle tween drives the sky directly
    // (playNightCycle / playDayCycle) — the automatic call here would fight it
    // using a stale countdown.progress, so it is skipped for those phases.
    if (this.phase !== 'transition' && this.phase !== 'intro') {
      this.sky.update(this.countdown?.progress ?? 0);
    }

    // The opening cinematic has a hunter walking in, and hunters only move
    // when something pursues them — without this he would stand off-screen
    // where he spawned and the Count would strike thin air.
    if (this.phase === 'intro') {
      for (const hunter of this.getAttackTargets()) {
        hunter.pursue(this.player.x, this.player.y);
      }
      return;
    }

    if (this.phase !== 'playing' || !this.countdown) return;

    this.countdown.update(delta);
    if (this.phase !== 'playing') return; // dawn may have just ended the run

    this.updatePlayerControl();
    this.hud?.setDashCharge(this.player.dashCooldownProgress);

    for (const hunter of this.getAttackTargets()) {
      hunter.pursue(this.player.x, this.player.y);
    }

    const p = this.countdown.progress;
    this.nightOverlay.setAlpha(0.42 * (1 - p * p));
    this.dawnOverlay.setAlpha(p * p * 0.18);
  }

  /** Called by the mobile pause button; the Esc/P keys route here too. */
  requestPause(): void {
    if (this.phase !== 'playing' || this.scene.isPaused()) return;
    this.scene.pause();
    this.scene.launch(SCENES.pause);
  }

  // ── Per-device control routing ──────────────────────────────────────────

  private updatePlayerControl(): void {
    if (this.isTouch && this.touch) {
      const mv = this.touch.getMove();
      // Face the direction of travel; taps/strikes override at strike time.
      if (mv.x !== 0 || mv.y !== 0) {
        this.player.aimAt(this.player.x + mv.x * 100, this.player.y + mv.y * 100);
      }
      if (this.touch.consumeDashPressed()) this.player.tryDash(mv.x, mv.y);
      this.player.move(mv.x, mv.y);
      if (this.touch.isAutoAttackHeld()) {
        this.autoAttackNearest();
      }
      return;
    }

    const move = this.inputController.getMoveVector();
    const aim = this.inputController.getAimPoint();
    this.player.aimAt(aim.x, aim.y);

    // Dash first: it takes over the velocity that move() would otherwise set.
    if (this.inputController.isDashJustPressed()) this.player.tryDash(move.x, move.y);
    this.player.move(move.x, move.y);

    if (this.inputController.isMouseAttackDown()) {
      this.combat.tryAttack(this.getAttackTargets());
    } else if (this.inputController.isAutoAttackDown()) {
      this.autoAttackNearest();
    }
  }

  /** Space / ⚔ button: turn toward the nearest living hunter and strike. */
  private autoAttackNearest(): void {
    const targets = this.getAttackTargets();
    let nearest: Hunter | null = null;
    let nearestDist = Infinity;
    for (const t of targets) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, t.x, t.y);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = t;
      }
    }
    if (nearest) this.player.aimAt(nearest.x, nearest.y);
    this.combat.tryAttack(targets);
  }

  // ── Menu & intro ────────────────────────────────────────────────────────

  private buildMenu(): void {
    const cx = GAME_WIDTH / 2;

    const dim = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0d0716, 0.45).setOrigin(0);

    // Cover art, fully opaque, centered in the upper middle of the page.
    const cover = this.add.image(cx, 260, TEXTURES.cover).setDisplaySize(300, 300);

    // Typewriter tagline: types a sentence, holds, deletes it, types the next.
    const tagline = this.add
      .text(cx, 470, '', { fontFamily: FONT, fontSize: '30px', color: '#e8ddff', fontStyle: 'bold' })
      .setOrigin(0.5);
    this.startTaglineTyper(tagline);

    // Two lines per device, plain hyphens only - no em or en dashes anywhere
    // in player-facing copy.
    const instructions = this.isTouch
      ? [
          'Joystick - Move    Tap - Strike toward tap    Sword - Strike nearest',
          'Bat button - Dash (short invulnerable burst)    Pause - Pause button',
        ]
      : [
          'Move - WASD / Arrows    Aim - Mouse    Attack - Click / Space',
          'Bat dash - Shift (short invulnerable burst)    Pause - Esc / P',
        ];
    const controls = this.add
      .text(cx, 545, instructions, {
        fontFamily: FONT,
        fontSize: '17px',
        color: '#9d8bbf',
        align: 'center',
        lineSpacing: 6,
      })
      .setOrigin(0.5);

    const start = this.add
      .text(cx, 630, 'START NIGHT', {
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

    this.menuUi = this.add.container(0, 0, [dim, cover, tagline, controls, start]).setDepth(DEPTHS.menu);

    this.input.keyboard?.once('keydown-ENTER', () => this.startIntro());

    // Menu-only theme (Noam) — looping, stopped the instant the night starts.
    this.audioFx.play(AUDIO.menuTheme, { loop: true, volume: 0.5 });
  }

  /** Write-stream / reverse-stream the three tagline sentences, forever. */
  private startTaglineTyper(target: Phaser.GameObjects.Text): void {
    let sentence = 0;
    let length = 0;
    let mode: 'typing' | 'holding' | 'deleting' = 'typing';
    let holdTicks = 0;

    this.taglineTimer = this.time.addEvent({
      delay: 55,
      loop: true,
      callback: () => {
        const text = TAGLINE_SENTENCES[sentence];
        if (mode === 'typing') {
          length++;
          target.setText(text.slice(0, length));
          if (length >= text.length) {
            mode = 'holding';
            holdTicks = 16; // ~0.9s pause on the full sentence
          }
        } else if (mode === 'holding') {
          if (--holdTicks <= 0) mode = 'deleting';
        } else {
          length--;
          target.setText(text.slice(0, length));
          if (length <= 0) {
            sentence = (sentence + 1) % TAGLINE_SENTENCES.length;
            mode = 'typing';
          }
        }
      },
    });
  }

  private startIntro(): void {
    if (this.phase !== 'menu') return;
    this.phase = 'intro';

    this.audioFx.stop(AUDIO.menuTheme);
    this.taglineTimer?.remove();
    this.taglineTimer = null;
    if (this.menuUi) {
      const ui = this.menuUi;
      this.menuUi = null;
      this.tweens.add({ targets: ui, alpha: 0, duration: 300, onComplete: () => ui.destroy() });
    }

    if (this.playCinematic) {
      this.playCinematic = false;
      this.playOpeningCinematic();
    } else {
      this.riseFromCoffin(() => this.startPlaying());
    }
  }

  /**
   * The cold open, played once before the first night of a run: the Count
   * comes home through the window at the end of a bad night - nearly dead and
   * a few mouthfuls short - takes a hunter who followed him in, drinks his
   * fill, and retires to the coffin to sleep off a whole day. It exists to
   * teach the loop in one wordless pass: the bars are what matter, the coffin
   * is where you end up, and the clock resets when you make it.
   *
   * The HUD is driven by emitting its events directly rather than by moving
   * real blood and health through GameFlowSystem. Nothing here should be able
   * to trip a rule - a scripted meter filling up would otherwise summon the
   * Captain mid-cutscene - and beginRoundSystems builds a fresh flow for the
   * actual night afterwards regardless.
   */
  private playOpeningCinematic(): void {
    this.hud = new HUD(this, this.emitter);
    this.hud.animateIn();

    // Held until animateIn's alpha tween is done: the low-health flash drives
    // the same alpha, and starting both at once leaves them fighting over it.
    const bloodTarget = bloodTargetForNight(1);
    this.time.delayedCall(600, () => {
      this.emitter.emit(EVENTS.PLAYER_DAMAGED, CINEMATIC.startHealth, PLAYER.maxHealth);
      this.emitter.emit(EVENTS.BLOOD_CHANGED, bloodTarget - CINEMATIC.bloodShortfall, bloodTarget);
    });

    // Enter as a bat through the middle window, high and small.
    this.setPlayerDormant(false);
    this.player.setPosition(GAME_WIDTH / 2, 70).setAlpha(0);
    this.player.setBaseScale(0.7);
    this.setBatForm(true);

    this.tweens.add({ targets: this.player, alpha: 1, duration: 400 });
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 1300,
      ease: 'Sine.easeInOut',
      onUpdate: (tween) => {
        const t = tween.getValue() ?? 0;
        // A shallow swoop in, not a straight drop.
        const x = GAME_WIDTH / 2 + Math.sin(t * Math.PI) * 150;
        this.player.setPosition(x, Phaser.Math.Linear(70, PLAYER_SPAWN.y, t));
        this.player.faceBatTowards(x - this.player.x);
        this.player.setBaseScale(Phaser.Math.Linear(0.7, PLAYER.spriteScale, t));
      },
      onComplete: () => {
        this.setBatForm(false);
        this.cameras.main.shake(120, 0.003);
        this.time.delayedCall(250, () => this.cinematicFeed(bloodTarget));
      },
    });
  }

  /** Beat two: a hunter walks in from the right and the Count drinks him dry. */
  private cinematicFeed(bloodTarget: number): void {
    let blood = bloodTarget - CINEMATIC.bloodShortfall;
    const arrival = { x: this.player.x + 130, y: this.player.y + 10 };
    // Just outside the arena so he is hidden by the wall band for his first
    // strides and walks into frame, rather than popping into the open hall.
    const spawnX = ARENA.right + 30;
    const hunter = new Hunter(this, spawnX, arrival.y);
    this.hunters.add(hunter);
    hunter.beginEntrance(arrival.x, arrival.y);

    // Timed off his actual walking speed rather than a guessed constant - a
    // fixed delay had the Count swinging at a hunter still off-screen.
    const walkMs = ((spawnX - arrival.x) / HUNTER.moveSpeed) * 1000 + 250;

    this.time.delayedCall(walkMs, () => {
      if (!hunter.active) return;
      this.player.aimAt(hunter.x, hunter.y);
      this.player.playAttackAnim();
      this.cameras.main.shake(160, 0.005);

      this.time.delayedCall(220, () => {
        const corpseX = hunter.x;
        const corpseY = hunter.y;
        hunter.spawnCorpse();
        this.hunters.remove(hunter, true, true);
        this.audioFx.play(AUDIO.hunterDeath);

        // The blood he was short of, flying home one mouthful at a time.
        for (let i = 0; i < CINEMATIC.bloodShortfall; i++) {
          this.time.delayedCall(i * 110, () => {
            const droplet = this.add
              .image(corpseX, corpseY, TEXTURES.blood)
              .setDepth(DEPTHS.hud + 1);
            this.tweens.add({
              targets: droplet,
              x: HUD_ANCHORS.bloodBar.x,
              y: HUD_ANCHORS.bloodBar.y,
              scale: 0.6,
              duration: 430,
              ease: 'Quad.easeIn',
              onComplete: () => {
                droplet.destroy();
                blood++;
                this.emitter.emit(EVENTS.BLOOD_CHANGED, blood, bloodTarget);
                this.hud?.burstAtBloodBar();
                if (blood >= bloodTarget) this.cinematicRetire();
              },
            });
          });
        }
      });
    });
  }

  /** Beat three: back to the coffin, sleep off a full day, wake to night one. */
  private cinematicRetire(): void {
    this.time.delayedCall(300, () => {
      this.coffin.setOpen(true);
      this.setBatForm(true);

      this.flightSpiral({
        center: { x: COFFIN_POS.x, y: COFFIN_POS.y - 10 },
        from: { x: this.player.x, y: this.player.y },
        duration: 1200,
        toScale: 0.9,
        toAlpha: 0.55,
        squash: 0.6,
        onComplete: () => {
          this.setBatForm(false);
          this.player.setVisible(false);
          this.coffin.setOpen(false);

          // He sleeps: health refills, the blood is spent, the clock winds
          // back up to a full night - the same beat every night ends on.
          this.hud?.playCoffinTransfer(1, CINEMATIC.startHealth / PLAYER.maxHealth, 0, () => {
            this.playDayCycle(1800, () => {
              this.hud?.resetForNewRound(bloodTargetForNight(this.night));
              this.riseFromCoffin(() => this.startPlaying());
            });
          });
        },
      });
    });
  }

  /**
   * The coffin creaks open, the Count rises out small, then sweeps around
   * the hall in a shrinking spiral, growing to full boss size, and lands
   * dead center. Shared by the very first rise (from the menu) and every
   * subsequent night's fly-out in the seamless loop.
   */
  private riseFromCoffin(onComplete: () => void): void {
    this.coffin.setOpen(true);
    this.player.setVisible(true).setPosition(COFFIN_POS.x, COFFIN_POS.y - 20).setAlpha(0.55);
    this.player.setBaseScale(0.9);
    this.setBatForm(true);

    this.time.delayedCall(300, () => {
      this.flightSpiral({
        center: PLAYER_SPAWN,
        from: { x: this.player.x, y: this.player.y },
        duration: 1600,
        toScale: PLAYER.spriteScale,
        toAlpha: 1,
        squash: 0.42,
        onComplete: () => {
          this.setBatForm(false);
          this.coffin.setOpen(false);
          onComplete();
        },
      });
    });
  }

  /**
   * The transformation itself lives on Player.setBatForm — shared by the
   * coffin fly-in/fly-out and the dash, so the bat sheet and its *poof* are
   * wired in exactly once.
   */
  private setBatForm(active: boolean): void {
    this.player.setBatForm(active);
  }

  /**
   * Fly the player along a spiral that starts at `from` and converges on
   * `center` (radius shrinking to zero over 1.5 turns). Used forward for the
   * coffin rise (coffin → hall center) and with a coffin-centered spiral for
   * the victory outro (hall → coffin).
   */
  private flightSpiral(opts: {
    center: { x: number; y: number };
    from: { x: number; y: number };
    duration: number;
    toScale: number;
    toAlpha: number;
    /** Vertical flattening so the spiral fits the wide, short hall. */
    squash: number;
    onComplete: () => void;
  }): void {
    const dx = opts.from.x - opts.center.x;
    const dy = opts.from.y - opts.center.y;
    const r0 = Math.hypot(dx, dy);
    const a0 = Math.atan2(dy, dx);
    // Base scale, not the rendered one: he flies this as a bat, and the bat
    // renders at a fraction of it (see Player.setBaseScale).
    const fromScale = this.player.displayBaseScale;
    const fromAlpha = this.player.alpha;
    let lastX = opts.from.x;

    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: opts.duration,
      ease: 'Sine.easeInOut',
      onUpdate: (tween) => {
        const t = tween.getValue() ?? 0;
        const angle = a0 + t * Math.PI * 3; // 1.5 loops
        const r = r0 * (1 - t);
        const x = opts.center.x + Math.cos(angle) * r;
        this.player.setPosition(x, opts.center.y + Math.sin(angle) * r * opts.squash);
        // Mirror the bat into the turn so he never flies backwards round the spiral.
        this.player.faceBatTowards(x - lastX);
        lastX = x;
        this.player.setBaseScale(Phaser.Math.Linear(fromScale, opts.toScale, t));
        this.player.setAlpha(Phaser.Math.Linear(fromAlpha, opts.toAlpha, t));
      },
      onComplete: opts.onComplete,
    });
  }

  /** First-ever round start (from the menu): builds the HUD/touch UI that persist for the whole scene. */
  private startPlaying(): void {
    this.phase = 'playing';
    this.setPlayerDormant(false);
    this.cameras.main.shake(120, 0.004); // landing thump

    // The opening cinematic builds the HUD early (it needs the bars on screen
    // to tell its story), so only create one here if it isn't already up.
    if (!this.hud) {
      this.hud = new HUD(this, this.emitter);
      this.hud.animateIn();
    }

    if (this.isTouch) {
      this.touch = new TouchControls(this, {
        onTapAttack: (worldX, worldY) => {
          if (this.phase !== 'playing') return;
          this.player.aimAt(worldX, worldY);
          this.combat.tryAttack(this.getAttackTargets());
        },
        onPause: () => this.requestPause(),
      });
    }

    this.beginRoundSystems();
  }

  /** (Re)creates the per-round simulation: flow, countdown, spawner. Reused every night. */
  private beginRoundSystems(): void {
    this.boss = null;
    // The Player and Coffin entities persist across rounds (unlike flow and
    // countdown, which are recreated below) — without resetting them
    // explicitly, HP stayed wherever it was left and the coffin stayed
    // permanently "activated" after the first win.
    this.player.resetForNewRound();
    this.coffin.resetForNewRound();
    const bloodTarget = bloodTargetForNight(this.night);
    const pressure = hunterPressureForNight(this.night);
    this.flow = new GameFlowSystem(this.emitter, bloodTarget);
    this.countdown = new CountdownSystem(
      this.emitter,
      NIGHT.durationSeconds,
      NIGHT.finalWarningSeconds,
    );

    this.spawner?.stop();
    this.spawner = new SpawnSystem(
      this,
      pressure.spawnIntervalMs,
      pressure.maxAlive,
      () => this.hunters.countActive(true),
      () => ({ x: this.player.x, y: this.player.y }),
      (sx, sy, ax, ay) => this.hunters.add(this.createHunter(sx, sy, ax, ay)),
    );

    this.hud?.setNight(this.night);
  }

  /**
   * Sword swings damage the player when they land (invulnerability still
   * applies). A share of every night's spawns arrive as garlic throwers
   * instead — same entrance, completely different threat.
   */
  private createHunter(spawnX: number, spawnY: number, arrivalX: number, arrivalY: number): Hunter {
    const hunter = this.canSpawnThrower()
      ? this.createThrower(spawnX, spawnY)
      : new Hunter(this, spawnX, spawnY);
    hunter.beginEntrance(arrivalX, arrivalY);
    hunter.onStrikeHit = () => {
      if (this.phase === 'playing') this.player.takeDamage(hunter.contactDamage);
    };
    return hunter;
  }

  /**
   * Throwers are capped at the night number — one on night 1, two on night 2,
   * and so on — so the ranged pressure ramps predictably while the rest of the
   * (growing) spawn budget keeps going to melee hunters.
   */
  private canSpawnThrower(): boolean {
    if (this.night < THROWER.firstNight) return false;
    if (Math.random() >= THROWER.spawnChance) return false;
    return this.countAliveThrowers() < this.night * THROWER.maxAlivePerNight;
  }

  private countAliveThrowers(): number {
    let alive = 0;
    for (const hunter of this.hunters.getChildren()) {
      if (hunter instanceof GarlicThrower && hunter.active && hunter.isAlive) alive++;
    }
    return alive;
  }

  private createThrower(spawnX: number, spawnY: number): GarlicThrower {
    const thrower = new GarlicThrower(this, spawnX, spawnY);
    thrower.onThrow = (fromX, fromY, toX, toY) => {
      if (this.phase !== 'playing') return;
      const garlic = new Garlic(this, fromX, fromY, toX, toY, (ix, iy, direct) =>
        this.onGarlicImpact(ix, iy, direct),
      );
      this.garlics.add(garlic);
      garlic.launch(); // must follow the group add — see Garlic.launch()
    };
    return thrower;
  }

  /**
   * A garlic bulb either thumped into the Count or landed on the floor where
   * the crosshair locked. A landing still splashes — standing next to the
   * lock point is not the same as dodging it.
   */
  private onGarlicImpact(x: number, y: number, direct: boolean): void {
    this.spawnGarlicBurst(x, y);
    if (this.phase !== 'playing') return;

    const hit =
      direct ||
      Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) <=
        THROWER.garlicSplashRadius;
    if (hit) this.player.takeDamage(THROWER.garlicDamage);
  }

  /** Green splash where a bulb bursts. */
  private spawnGarlicBurst(x: number, y: number): void {
    const burst = this.add
      .particles(0, 0, TEXTURES.particle, {
        speed: { min: 40, max: 170 },
        lifespan: { min: 220, max: 480 },
        scale: { start: 1.2, end: 0 },
        tint: [0x7dff9b, 0xd8ffe4, 0xffffff],
        emitting: false,
      })
      .setDepth(DEPTHS.attackFx);
    burst.explode(14, x, y);
    this.time.delayedCall(600, () => burst.destroy());

    const ring = this.add
      .circle(x, y, THROWER.garlicSplashRadius, 0x7dff9b, 0.3)
      .setDepth(DEPTHS.groundFx)
      .setStrokeStyle(3, 0xd8ffe4, 0.9)
      .setScale(0.2);
    this.tweens.add({
      targets: ring,
      scale: 1,
      alpha: 0,
      duration: 320,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    });
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
      this.collectPickup(pickupObj as BloodPickup);
    });

    // A bulb that reaches him mid-flight bursts on the spot; one that misses
    // keeps going and resolves at the locked point instead (see Garlic).
    this.physics.add.overlap(this.player, this.garlics, (_player, garlicObj) => {
      if (this.player.isInvulnerable) return; // dashed clean through it
      (garlicObj as Garlic).hitPlayer();
    });

    this.physics.add.overlap(this.player, this.coffin, () => {
      if (this.phase !== 'playing') return;
      if (this.flow.tryEnterCoffin()) return;
      this.coffin.showRequirementHint(this.coffinHintMessage());
    });

    // Solid body: hunters (and the Captain, same group) walk around the
    // coffin instead of through it — except while still walking IN from
    // off-screen, since an entrance path (esp. from the left, where the
    // coffin sits) can run right through its footprint; colliding then just
    // wedges them against it, stuck and invisible (still at the hidden
    // "entering" depth) forever.
    this.physics.add.collider(
      this.hunters,
      this.coffin,
      (object1, object2) => {
        // Phaser may reverse group-vs-static callback arguments internally.
        const hunter =
          object1 instanceof Hunter ? object1 : object2 instanceof Hunter ? object2 : null;
        if (!hunter) return;
        const body = this.coffin.body as Phaser.Physics.Arcade.StaticBody;
        hunter.avoidCoffin(
          this.coffin.x,
          this.coffin.y,
          body.width / 2,
          body.height / 2,
          this.player.x,
        );
      },
      (object1, object2) => {
        const hunter =
          object1 instanceof Hunter ? object1 : object2 instanceof Hunter ? object2 : null;
        return hunter !== null && !hunter.isEntering;
      },
      this,
    );
  }

  /** Fly the bloodlet up to the blood bar; it counts on arrival, in a red burst. */
  private collectPickup(pickup: BloodPickup): void {
    if (pickup.collecting) return;
    pickup.collecting = true;
    (pickup.body as Phaser.Physics.Arcade.Body).enable = false;
    this.tweens.killTweensOf(pickup); // stop the idle bob
    pickup.setDepth(DEPTHS.hud + 1);

    this.tweens.add({
      targets: pickup,
      x: HUD_ANCHORS.bloodBar.x,
      y: HUD_ANCHORS.bloodBar.y,
      scale: 0.6,
      duration: 420,
      ease: 'Quad.easeIn',
      onComplete: () => {
        if (!this.flow.hasEnded) {
          this.flow.addBlood(pickup.amount);
          this.audioFx.play(AUDIO.bloodPickup);
          this.hud?.burstAtBloodBar();
        }
        this.pickups.remove(pickup, true, true);
      },
    });
  }

  /**
   * Second leg of an overflow pickup: the bloodlet has already landed on the
   * blood meter, found it full, and now carries on to the health bar as a
   * heal. GameFlowSystem decides that this happened (BLOOD_OVERFLOWED); this
   * only flies the droplet and cashes it in on arrival.
   */
  private hopBloodToHealth(bloodAmount: number): void {
    const droplet = this.add
      .image(HUD_ANCHORS.bloodBar.x, HUD_ANCHORS.bloodBar.y, TEXTURES.blood)
      .setDepth(DEPTHS.hud + 3)
      .setScale(0.8);

    this.tweens.add({
      targets: droplet,
      x: HUD_ANCHORS.healthBar.x,
      y: HUD_ANCHORS.healthBar.y,
      scale: 0.5,
      duration: 480,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        droplet.destroy();
        // heal() emits PLAYER_HEALED, which is what repaints the bar and
        // fires the puff in whichever colour the bar has just become.
        this.player.heal(bloodAmount * BLOOD.overflowHealPerBlood);
      },
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
    this.emitter.on(EVENTS.BLOOD_OVERFLOWED, this.hopBloodToHealth, this);
    this.emitter.on(EVENTS.COFFIN_ACTIVATED, () => this.coffin.activate());
    this.emitter.on(EVENTS.FINAL_TEN_SECONDS, () => {
      this.audioFx.play(AUDIO.finalSeconds);
      this.cameras.main.flash(200, 255, 154, 61);
    });
    this.emitter.on(EVENTS.GAME_ENDED, this.onGameEnded, this);
  }

  private setupPauseKeys(): void {
    this.input.keyboard?.on('keydown-ESC', this.requestPause, this);
    this.input.keyboard?.on('keydown-P', this.requestPause, this);
  }

  private spawnBoss(): void {
    if (this.boss) return;
    const arrival = this.bossArrivalPosition();
    const spawn = offCanvasSpawnPoint(arrival);
    this.boss = new HunterCaptain(this, spawn.x, spawn.y, this.emitter);
    this.boss.beginEntrance(arrival.x, arrival.y);
    this.boss.onEntranceArrived = () => this.boss?.playEntrance();
    this.boss.onStrikeHit = () => {
      if (this.phase === 'playing' && this.boss) this.player.takeDamage(this.boss.contactDamage);
    };
    this.hunters.add(this.boss);
    this.flow.notifyBossSpawned();
    this.audioFx.play(AUDIO.bossAppear);
  }

  /**
   * Arena-edge midpoint farthest from the player — where the Captain
   * arrives. Bottom/left/right only, matching SpawnSystem: never the north
   * wall behind the player's spawn point.
   */
  private bossArrivalPosition(): { x: number; y: number } {
    const cx = (ARENA.left + ARENA.right) / 2;
    const cy = (ARENA.top + ARENA.bottom) / 2;
    const inset = 70;
    const candidates = [
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
      this.scatterBloodlets(hunter.x, hunter.y);
      this.audioFx.play(AUDIO.hunterDeath);
    }
    this.hunters.remove(hunter, true, true);
  }

  /** Dead hunters burst into a handful of +1 bloodlets around the corpse. */
  private scatterBloodlets(x: number, y: number): void {
    for (let i = 0; i < HUNTER.bloodDroplets; i++) {
      const angle = (Math.PI * 2 * i) / HUNTER.bloodDroplets + Phaser.Math.FloatBetween(-0.4, 0.4);
      const dist = Phaser.Math.Between(14, 38);
      const px = Phaser.Math.Clamp(x + Math.cos(angle) * dist, ARENA.left + 10, ARENA.right - 10);
      const py = Phaser.Math.Clamp(y + Math.sin(angle) * dist, ARENA.top + 10, ARENA.bottom - 10);
      const pickup = new BloodPickup(this, x, y);
      this.pickups.add(pickup);
      this.tweens.add({
        targets: pickup,
        x: px,
        y: py,
        duration: 220,
        ease: 'Quad.easeOut',
      });
    }
  }

  private onDawnReached(): void {
    this.audioFx.play(AUDIO.dawn);
    this.flow.notifyDawnReached();
  }

  private onGameEnded(cause: EndCause): void {
    this.spawner?.stop();
    this.physics.pause();

    // Nothing is aiming at a Count who has already lost (or won) the night.
    this.garlics.clear(true, true);
    for (const target of this.getAttackTargets()) {
      if (target instanceof GarlicThrower) target.abortAim();
    }

    if (cause === 'victory') {
      this.phase = 'transition';
      this.playVictoryOutro();
    } else if (cause === 'dawn') {
      this.phase = 'ended';
      this.playDawnBurn(this.buildSummary(cause));
    } else {
      this.phase = 'ended';
      // Death by hunters: the death animation already played in takeDamage.
      this.time.delayedCall(900, () => {
        this.scene.start(SCENES.gameOver, this.buildSummary(cause));
      });
    }
  }

  private buildSummary(cause: EndCause): RunSummary {
    return {
      cause,
      bloodCollected: this.flow.currentBlood,
      bloodTarget: this.flow.bloodTarget,
      timeSurvivedSeconds: Math.round(this.countdown?.elapsedSeconds ?? 0),
      timeRemainingSeconds: this.countdown?.remainingSeconds ?? 0,
    };
  }

  /**
   * Dawn caught the Count outside his coffin: sunlight burns him — orange
   * embers, a strobing burn flash — then he crumbles through his death
   * animation, and only after that does the game-over screen appear.
   */
  private playDawnBurn(summary: RunSummary): void {
    const embers = this.add
      .particles(0, 0, TEXTURES.particle, {
        speed: { min: 30, max: 120 },
        lifespan: { min: 400, max: 900 },
        scale: { start: 1.3, end: 0 },
        gravityY: -80, // embers rise
        tint: [0xff9a3d, 0xff4d4d, 0xffd76b],
        emitting: false,
      })
      .setDepth(DEPTHS.attackFx);

    // Blink: strobe the burn tint while embers pour off him.
    let flashes = 0;
    const strobe = this.time.addEvent({
      delay: 110,
      repeat: 7,
      callback: () => {
        flashes++;
        embers.explode(8, this.player.x, this.player.y - 20);
        if (flashes % 2 === 1) {
          this.player.setTint(0xff9a3d);
          this.player.setTintMode(Phaser.TintModes.FILL);
        } else {
          this.player.clearTint();
          this.player.setTintMode(Phaser.TintModes.MULTIPLY);
        }
      },
    });

    this.time.delayedCall(950, () => {
      strobe.remove();
      this.player.clearTint();
      this.player.setTintMode(Phaser.TintModes.MULTIPLY);
      this.player.playDeathAnim();
      this.player.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        embers.explode(24, this.player.x, this.player.y - 10);
        this.time.delayedCall(600, () => this.scene.start(SCENES.gameOver, summary));
      });
    });
  }

  /**
   * Victory: the coffin opens, the Count spirals back into it (the reverse
   * of his entrance), the lid closes, and his collected blood drains into
   * his health bar — then the night cycle fast-forwards and the next round
   * begins. No screen shown; see playNightCycle / startNewRound.
   */
  private playVictoryOutro(): void {
    // Clear the field immediately so the hall reads clean through the outro
    // (clearing the hunters also takes their targeting crosshairs with them).
    this.hunters.clear(true, true);
    this.pickups.clear(true, true);
    this.garlics.clear(true, true);

    this.coffin.setOpen(true);
    this.setBatForm(true); // he flies back to the coffin as a bat too

    this.flightSpiral({
      center: { x: COFFIN_POS.x, y: COFFIN_POS.y - 10 },
      from: { x: this.player.x, y: this.player.y },
      duration: 1500,
      toScale: 0.9,
      toAlpha: 0.55,
      squash: 0.6,
      onComplete: () => {
        this.setBatForm(false);
        this.player.setVisible(false);
        this.coffin.setOpen(false);

        const bloodRatio = Phaser.Math.Clamp(this.flow.currentBlood / this.flow.bloodTarget, 0, 1);
        const healthRatio = Phaser.Math.Clamp(this.player.health / PLAYER.maxHealth, 0, 1);
        const secondsLeft = this.countdown?.remainingSeconds ?? 0;
        this.hud?.playCoffinTransfer(bloodRatio, healthRatio, secondsLeft, () => {
          this.time.delayedCall(300, () => this.playNightCycle());
        });
      },
    });
  }

  /**
   * The Count sleeps through a whole day. Time runs FORWARD, never backward:
   * the interrupted night is played out to its sunrise, then the sun crosses
   * the sky and sets, and only then does the next night's moon rise wearing
   * its own phase. Rewinding the sky to dusk (which is what this used to do)
   * read as the night un-happening.
   */
  private playNightCycle(): void {
    const startProgress = this.countdown?.progress ?? 0.5;

    // Leg 1: finish the night he cut short, out to full sunrise.
    this.tweens.addCounter({
      from: startProgress,
      to: 1,
      duration: 900,
      ease: 'Sine.easeIn',
      onUpdate: (tween) => {
        const v = tween.getValue() ?? 0;
        this.sky.update(v);
        this.nightOverlay.setAlpha(0.42 * (1 - v * v));
        this.dawnOverlay.setAlpha(v * v * 0.18);
      },
      onComplete: () => {
        // The moon that rises at the end of this day belongs to the coming night.
        this.night++;
        this.playDayCycle(2600, () => {
          this.hud?.resetForNewRound(bloodTargetForNight(this.night));
          this.riseFromCoffin(() => {
            this.physics.resume();
            this.phase = 'playing';
            this.cameras.main.shake(120, 0.004);
            this.beginRoundSystems();
          });
        });
      },
    });
  }

  /**
   * Leg 2: sunrise → noon → sunset → dark, with `this.night`'s moon rising at
   * the end of it. Shared by the between-nights transition and the opening
   * cinematic, which plays the same day without advancing the night counter.
   */
  private playDayCycle(duration: number, onComplete: () => void): void {
    this.sky.setNight(this.night);

    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration,
      ease: 'Sine.easeInOut',
      onUpdate: (tween) => {
        const t = tween.getValue() ?? 0;
        this.sky.updateDayCycle(t);
        // Daylight floods the hall at noon and drains back out by nightfall.
        const daylight = Math.sin(t * Math.PI);
        this.nightOverlay.setAlpha(0.42 * (1 - daylight));
        this.dawnOverlay.setAlpha(daylight * 0.3);
      },
      onComplete: () => {
        this.sky.resetToNightStart();
        this.nightOverlay.setAlpha(0.42);
        this.dawnOverlay.setAlpha(0);
        onComplete();
      },
    });
  }

  private cleanup(): void {
    this.audioFx.stop(AUDIO.menuTheme);
    this.emitter.removeAllListeners();
    this.hud?.destroy();
    this.spawner?.stop();
    this.taglineTimer?.remove();
    this.input.keyboard?.off('keydown-ESC', this.requestPause, this);
    this.input.keyboard?.off('keydown-P', this.requestPause, this);
  }
}
