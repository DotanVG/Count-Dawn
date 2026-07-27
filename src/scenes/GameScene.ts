import Phaser from 'phaser';
import {
  BLOOD,
  BOSS,
  CROSS,
  HUNTER,
  NIGHT,
  PLAYER,
  PRIEST,
  THROWER,
  WRATH,
  bloodTargetForNight,
  bossLineupForNight,
  captainCountForNight,
  hunterPressureForNight,
  throwerCapForNight,
  weaponsForNight,
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
import { setVampireCursorVisible } from '../game/vampireCursor';
import { Player } from '../entities/Player';
import { Hunter, BASIC_LOOKS, PILGRIM_LOOK } from '../entities/Hunter';
import { ArmedHunter } from '../entities/ArmedHunter';
import { HunterCaptain, pluralBossName } from '../entities/HunterCaptain';
import { GarlicCaptain } from '../entities/GarlicCaptain';
import { CrossCaptain } from '../entities/CrossCaptain';
import { GoldCross } from '../entities/GoldCross';
import { GarlicThrower } from '../entities/GarlicThrower';
import { Priest } from '../entities/Priest';
import { Garlic } from '../entities/Garlic';
import { BloodPickup } from '../entities/BloodPickup';
import { Coffin } from '../entities/Coffin';
import { InputController } from '../systems/InputController';
import { CombatSystem } from '../systems/CombatSystem';
import { SpawnSystem } from '../systems/SpawnSystem';
import { offCanvasSpawnPoint } from '../systems/entrance';
import { CountdownSystem } from '../systems/CountdownSystem';
import {
  COLD_OPEN,
  COLD_OPEN_GROUP,
  COLD_OPEN_PRIEST_STATS,
  COLD_OPEN_STRIKE_SPOT,
  COLD_OPEN_THROWER_STATS,
  coldOpenHunterSlot,
  coldOpenSkyProgress,
  coldOpenSlotActor,
  coldOpenTimerSeconds,
  type ColdOpenActor,
} from '../systems/coldOpen';
import { GameFlowSystem } from '../systems/GameFlowSystem';
import { AudioDirector, getAudioDirector } from '../systems/AudioDirector';
import { CastleMap } from '../world/CastleMap';
import { DawnSky } from '../world/DawnSky';
import { HUD } from '../ui/HUD';
import { MenuLightning } from '../ui/MenuLightning';
import { TouchControls } from '../ui/TouchControls';
import { TEXTURES, ANIMS, AUDIO, BLOOD_DECALS } from '../utils/assetKeys';
import { VAMPIRE_ATTACK_DURATION_MS, VAMPIRE_SUNBURN_DURATION_MS } from '../utils/animations';
import { emptyRunStats } from '../types/game';
import type { BossKind, EndCause, HunterKind, RunStats, RunSummary } from '../types/game';

type Phase = 'menu' | 'intro' | 'playing' | 'transition' | 'ended';

interface GameSceneData {
  /** Skip the menu (used by the restart buttons) and rise straight from the coffin. */
  autostart?: boolean;
}

/**
 * Everything that has to die before the coffin will take the Count. The
 * Priest is not a Captain by rank, but he holds the same slot in a night's
 * lineup and the coffin waits on him identically.
 */
type Captain = HunterCaptain | GarlicCaptain | CrossCaptain | Priest;

const FONT = 'Trebuchet MS, sans-serif';
const COFFIN_POS = { x: 150, y: 430 };

/**
 * Slack on top of an animation's own length before the fallback that forces a
 * run to end anyway. Long enough that it never pre-empts the animation event in
 * normal play, short enough that a player never sits looking at a dead screen.
 */
const DEATH_FALLBACK_GRACE_MS = 400;

/** The state the Count comes home in during the opening cinematic. */
const CINEMATIC = {
  /** Low enough to sit in the red band, so the bar is flashing as he flies in. */
  startHealth: 12,
} as const;

/** The vampire's landing spot: the center of the hall. */
const PLAYER_SPAWN = {
  x: (ARENA.left + ARENA.right) / 2,
  y: (ARENA.top + ARENA.bottom) / 2,
};

/**
 * Screen-space blood splatter (spawnScreenBloodSplatter): bigger and less
 * transparent the more of a burst it is reading, picked from the same random
 * decal art the floor stains use (see stampBloodDecal) but drawn huge, faint
 * and fixed to the camera rather than small, opaque and pinned to the floor —
 * this reads as blood on the SCREEN, not blood in the room.
 */
const SCREEN_SPLATTER_TIERS = [
  { scale: [1.6, 2.1] as const, alpha: [0.16, 0.22] as const },
  { scale: [2.2, 2.8] as const, alpha: [0.22, 0.28] as const },
  { scale: [2.9, 3.6] as const, alpha: [0.28, 0.36] as const },
] as const;
/** How long a burst of kills stays "recent" for the next kill to add to it. */
const KILL_BURST_WINDOW_MS = 900;
/** Simultaneous-kill counts that step the splatter up through SCREEN_SPLATTER_TIERS. */
const KILL_BURST_TIER_THRESHOLDS = [3, 5, 7] as const;

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
  /** The game-wide audio authority; owned by the game, never by this scene. */
  private audio!: AudioDirector;
  private sky!: DawnSky;
  private player!: Player;
  private coffin!: Coffin;
  private captains = new Set<Captain>();
  private hunters!: Phaser.Physics.Arcade.Group;
  private pickups!: Phaser.Physics.Arcade.Group;
  private garlics!: Phaser.Physics.Arcade.Group;
  /** The huntress Captain's thrown crosses, in flight. */
  private crosses!: Phaser.Physics.Arcade.Group;
  private inputController!: InputController;
  private combat!: CombatSystem;
  private spawner: SpawnSystem | null = null;
  private hud: HUD | null = null;
  private touch: TouchControls | null = null;
  private dawnOverlay!: Phaser.GameObjects.Rectangle;
  private nightOverlay!: Phaser.GameObjects.Rectangle;
  private menuUi: Phaser.GameObjects.Container | null = null;
  private taglineTimer: Phaser.Time.TimerEvent | null = null;
  /** Drives the cover's title swapping on the menu; see ui/MenuLightning.ts. */
  private menuLightning: MenuLightning | null = null;
  /** The opening cinematic plays once, from the menu - restarts skip it. */
  private playCinematic = true;
  /**
   * Whole-RUN totals for the debrief. Reset only in create(), never in
   * beginRoundSystems — surviving a night adds to these rather than clearing
   * them, which is the whole point of "since the very beginning".
   */
  private runStats: RunStats = emptyRunStats();
  /** Drives the cold open's scripted clock; see systems/coldOpen.ts. */
  private coldOpenClock: Phaser.Time.TimerEvent | null = null;
  /**
   * Blood the Count has no use for (see WRATH in balance.ts). Persists across
   * nights like runStats — reset only in create(), never in
   * beginRoundSystems — and is spent all at once on the Ultimate.
   */
  private wrath = 0;
  /** True for the Ultimate's whole duration, so a second press can't restart it mid-swing. */
  private ultimateActive = false;
  private ultDarkenOverlay!: Phaser.GameObjects.Rectangle;
  /** Timestamps of recent kills, for spawnScreenBloodSplatter's burst sizing. */
  private recentKillTimes: number[] = [];

  constructor() {
    super(SCENES.game);
  }

  create(data: GameSceneData): void {
    this.phase = 'menu';
    this.isTouch = isTouchDevice();
    this.night = 1;
    this.runStats = emptyRunStats();
    this.wrath = 0;
    this.ultimateActive = false;
    this.recentKillTimes = [];
    this.captains.clear();
    this.countdown = null;
    this.spawner = null;
    this.hud = null;
    this.touch = null;

    this.emitter = new Phaser.Events.EventEmitter();
    this.flow = new GameFlowSystem(this.emitter, bloodTargetForNight(this.night));
    this.audio = getAudioDirector(this);

    new CastleMap(this);
    this.sky = new DawnSky(this);

    this.coffin = new Coffin(this, COFFIN_POS.x, COFFIN_POS.y);
    this.player = new Player(this, PLAYER_SPAWN.x, PLAYER_SPAWN.y, this.emitter);
    this.setPlayerDormant(true);

    this.hunters = this.physics.add.group();
    this.pickups = this.physics.add.group();
    this.garlics = this.physics.add.group();
    this.crosses = this.physics.add.group();

    this.inputController = new InputController(this);
    this.combat = new CombatSystem(
      this,
      this.player,
      (hunter) => this.onHunterKilled(hunter),
      // Fired by CombatSystem only once an attack has actually been accepted
      // (cooldown clear, Count alive) — never per frame while the button is
      // held, and never for a rejected swing. The swing is the whole sound of
      // an attack; the drink belongs to the blood arriving, not to the strike
      // (see collectPickup).
      () => this.audio.playSfx(AUDIO.playerAttackWhoosh),
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

    // The Ultimate's screen darken — a touch dimmer for its whole duration,
    // nowhere near the pause menu's near-black (see WRATH.screenDarkenAlpha).
    this.ultDarkenOverlay = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0d0716, 0)
      .setOrigin(0)
      .setDepth(DEPTHS.ultOverlay);

    this.setupCollisions();
    this.wireEvents();
    this.setupPauseKeys();

    // scene.events survives a restart, so these are paired with explicit
    // off() calls in cleanup — otherwise every restart adds another listener.
    this.events.on(Phaser.Scenes.Events.PAUSE, this.onScenePaused, this);
    this.events.on(Phaser.Scenes.Events.RESUME, this.onSceneResumed, this);
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
        // Throwers hold the line for the cutscene. Left alone they would start
        // painting a crosshair the moment they reach their slot - resetting
        // the aim first (never after: enterReposition dates its cooldown from
        // now) keeps the back row standing there, armed and silent.
        if (hunter instanceof GarlicThrower) hunter.abortAim();
        hunter.pursue(this.player.x, this.player.y);
      }
      return;
    }

    if (this.phase !== 'playing' || !this.countdown) return;

    this.countdown.update(delta);
    if (this.phase !== 'playing') return; // dawn may have just ended the run

    this.updatePlayerControl();
    this.updateCrosses();
    this.hud?.setDashCharge(this.player.dashCooldownProgress);

    for (const hunter of this.getAttackTargets()) {
      hunter.pursue(this.player.x, this.player.y);
    }

    this.vacuumNearbyPickups();

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

  /**
   * Music follows the scene, not the pause menu: this covers the pause
   * overlay AND the portrait-orientation gate, and opening the pause screen
   * never promotes the Main Title over a suspended run.
   */
  private onScenePaused(): void {
    this.audio.pauseMusic();
  }

  private onSceneResumed(): void {
    this.audio.resumeMusic();
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
      // Edge-triggered: one press, one strike — holding the button down must
      // not auto-fire on every frame it stays pressed.
      if (this.touch.consumeAutoAttackPressed()) {
        this.autoAttackNearest();
      }
      if (this.touch.consumeUltimatePressed()) this.tryUseUltimate();
      return;
    }

    const move = this.inputController.getMoveVector();
    // Only once the mouse has actually been somewhere. Before that its world
    // position is the hall's top-left corner, and aiming there would spin the
    // Count out of the landing pose he was handed over in.
    if (this.inputController.hasAimPoint) {
      const aim = this.inputController.getAimPoint();
      this.player.aimAt(aim.x, aim.y);
    }

    // Dash first: it takes over the velocity that move() would otherwise set.
    if (this.inputController.isDashJustPressed()) this.player.tryDash(move.x, move.y);
    this.player.move(move.x, move.y);

    // Edge-triggered: a click lands one strike. Holding the button down used
    // to auto-fire every frame it stayed down (rate-limited only by the
    // attack cooldown); a click is now the only way to swing, on desktop.
    if (this.inputController.consumeMouseAttackPressed()) {
      this.combat.tryAttack(this.getAttackTargets());
    }

    if (this.inputController.isUltimateJustPressed()) this.tryUseUltimate();
  }

  /** Mobile's ⚔ button: turn toward the nearest living hunter and strike, once per press. */
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

    // Cover art, fully opaque, centered in the upper middle of the page. Which
    // title it wears is the lightning's business from here on.
    const cover = this.add.image(cx, 260, TEXTURES.coverDawn).setDisplaySize(300, 300);
    this.menuLightning?.destroy();
    this.menuLightning = new MenuLightning(this, cover);

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
          'Lightning button - Ultimate, once the Wrath meter is full',
        ]
      : [
          'Move - WASD / Arrows    Aim - Mouse    Attack - Click',
          'Bat dash - Shift (short invulnerable burst)    Pause - Esc / P',
          'Ultimate - Space, once the Wrath meter is full',
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

    // The Main Title (Noam) owns everything that is not an active night: the
    // menu, the cold open, and every game-over screen. Asking for it while it
    // is already playing does nothing, so coming back here from game over
    // neither restarts it nor stacks a second copy.
    this.audio.playMainTitle();
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
    // The cold open and the coffin flight are watched, not played — teeth
    // tracking the mouse across a cutscene read as a bug. Every screen with a
    // button on it keeps them, because they are the game's ONLY pointer.
    setVampireCursorVisible(false);

    // The Main Title deliberately keeps playing from here: through the cold
    // open, through the coffin opening, and through the Count's flight into
    // the hall. It is handed over in startPlaying, not here.
    this.taglineTimer?.remove();
    this.taglineTimer = null;
    this.menuLightning?.destroy();
    this.menuLightning = null;
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

    const bloodTarget = bloodTargetForNight(1);
    let blood = bloodTarget - COLD_OPEN.bloodlets;

    // Held until animateIn's alpha tween is done: the low-health flash drives
    // the same alpha, and starting both at once leaves them fighting over it.
    this.time.delayedCall(600, () => {
      this.emitter.emit(EVENTS.PLAYER_DAMAGED, CINEMATIC.startHealth, PLAYER.maxHealth);
      this.emitter.emit(EVENTS.BLOOD_CHANGED, blood, bloodTarget);
    });

    // The clock is already inside its final ten seconds when the scene opens,
    // which is what puts the whole sequence under the gun. FINAL_TEN_SECONDS
    // is what dresses the timer for panic; the ticks come from the cold open's
    // own clock rather than a CountdownSystem, so the arithmetic is guaranteed
    // to land on one second left exactly as the lid shuts (see coldOpen.ts).
    this.emitter.emit(EVENTS.FINAL_TEN_SECONDS);
    const openedAt = this.time.now;
    let lastShown = -1;
    this.coldOpenClock = this.time.addEvent({
      delay: 50,
      loop: true,
      callback: () => {
        const elapsed = this.time.now - openedAt;
        const seconds = coldOpenTimerSeconds(elapsed);
        if (seconds !== lastShown) {
          lastShown = seconds;
          this.emitter.emit(EVENTS.COUNTDOWN_TICK, seconds);
        }
        // Night racing toward a sunrise it never quite reaches.
        const p = coldOpenSkyProgress(elapsed);
        this.sky.update(p);
        this.nightOverlay.setAlpha(0.42 * (1 - p * p));
        this.dawnOverlay.setAlpha(p * p * 0.18);
      },
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
      duration: COLD_OPEN.flyInMs,
      ease: 'Sine.easeInOut',
      onUpdate: (tween) => {
        const t = tween.getValue() ?? 0;
        // A shallow swoop in, not a straight drop.
        const x = GAME_WIDTH / 2 + Math.sin(t * Math.PI) * 150;
        this.player.faceBatTowards(x - this.player.x);
        this.player.setPosition(x, Phaser.Math.Linear(70, PLAYER_SPAWN.y, t));
        this.player.setBaseScale(Phaser.Math.Linear(0.7, PLAYER.spriteScale, t));
      },
      onComplete: () => {
        this.setBatForm(false);
        this.cameras.main.shake(120, 0.003);
      },
    });

    this.time.delayedCall(COLD_OPEN.huntersInMs, () => this.cinematicSurround());
    this.time.delayedCall(COLD_OPEN.lineStartMs, () => this.cinematicLine());
    this.time.delayedCall(COLD_OPEN.toGroupMs, () => this.cinematicCrossToGroup());
    this.time.delayedCall(COLD_OPEN.strikeMs, () =>
      this.cinematicStrike(bloodTarget, () => ++blood),
    );
    this.time.delayedCall(COLD_OPEN.toCoffinMs, () => this.cinematicRetire());
  }

  /** "Need... Blood..." typed out over the hall while the hunters close in. */
  private cinematicLine(): void {
    const line = 'Need... Blood...';
    const text = this.add
      .text(GAME_WIDTH / 2, PLAYER_SPAWN.y - 120, '', {
        fontFamily: FONT,
        fontSize: '30px',
        color: '#e8ddff',
        fontStyle: 'bold',
        stroke: '#0d0716',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(DEPTHS.hud);

    let shown = 0;
    const typer = this.time.addEvent({
      delay: 90,
      loop: true,
      callback: () => {
        text.setText(line.slice(0, ++shown));
        if (shown < line.length) return;
        typer.remove();
        this.tweens.add({ targets: text, alpha: 0, delay: 700, duration: 500 });
      },
    });
    // Whatever state the typing is in, the line is gone before the strike.
    this.time.delayedCall(COLD_OPEN.strikeMs - COLD_OPEN.lineStartMs, () => {
      typer.remove();
      text.destroy();
    });
  }

  /**
   * A squad walks in and masses on the right side of the hall: swordsmen in
   * the front columns, garlic throwers standing off behind them, so the scene
   * introduces both halves of what hunts him before the first night does. They
   * come in from the right edge specifically - it is the shortest walk to
   * where they need to be standing, and the scene has seconds, not minutes.
   *
   * Who stands where is fixed in coldOpen.ts, never rolled: the cutscene has
   * to play identically every time.
   */
  private cinematicSurround(): void {
    for (let i = 0; i < COLD_OPEN.hunterCount; i++) {
      const { spawn, arrival } = coldOpenHunterSlot(i);
      const hunter = this.createColdOpenActor(coldOpenSlotActor(i), spawn.x, spawn.y);
      this.hunters.add(hunter);
      hunter.beginEntrance(arrival.x, arrival.y);
    }
  }

  /**
   * One actor of the cold open's squad. They are SCENERY: the throwers are
   * deliberately not configureThrower'd (wiring onThrow would arm a bulb the
   * scene never wants launched) and the Priest's ward never gets a chance to
   * fire, because the whole squad dies to one strike seconds later.
   */
  private createColdOpenActor(actor: ColdOpenActor, x: number, y: number): Hunter {
    switch (actor) {
      case 'priest':
        return new Priest(this, x, y, this.emitter, COLD_OPEN_PRIEST_STATS);
      case 'thrower':
        return new GarlicThrower(this, x, y, { stats: COLD_OPEN_THROWER_STATS });
      case 'sword':
        return new Hunter(this, x, y);
      default:
        return new ArmedHunter(this, x, y, actor);
    }
  }

  /** He turns bat and crosses the hall to stand right on top of the group. */
  private cinematicCrossToGroup(): void {
    const from = { x: this.player.x, y: this.player.y };
    const to = COLD_OPEN_STRIKE_SPOT;
    this.setBatForm(true);

    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: COLD_OPEN.groupFlightMs,
      ease: 'Sine.easeInOut',
      onUpdate: (tween) => {
        const t = tween.getValue() ?? 0;
        const x = Phaser.Math.Linear(from.x, to.x, t);
        this.player.faceBatTowards(x - this.player.x);
        // A little lift through the middle so it reads as flight, not a slide.
        this.player.setPosition(x, Phaser.Math.Linear(from.y, to.y, t) - Math.sin(t * Math.PI) * 40);
      },
      onComplete: () => {
        this.setBatForm(false);
        this.player.aimAt(COLD_OPEN_GROUP.x, COLD_OPEN_GROUP.y);
      },
    });
  }

  /** One strike takes the whole ring, and their blood runs to the meter. */
  private cinematicStrike(bloodTarget: number, nextBlood: () => number): void {
    const victims = this.getAttackTargets();
    if (victims.length > 0) {
      this.player.aimAt(victims[0].x, victims[0].y);
    }
    this.player.playAttackAnim();
    this.audio.playSfx(AUDIO.playerAttackWhoosh);
    this.cameras.main.shake(220, 0.008);
    this.cameras.main.flash(220, 255, 255, 255);
    // Nothing drives updateAnimation during a cutscene, so the swing has to be
    // walked back to idle by hand or he stands there frozen mid-strike.
    this.time.delayedCall(VAMPIRE_ATTACK_DURATION_MS, () => this.player.playIdleAnim());

    const corpses: { x: number; y: number }[] = [];
    for (const hunter of victims) {
      corpses.push({ x: hunter.x, y: hunter.y });
      hunter.spawnCorpse();
      this.hunters.remove(hunter, true, true);
    }
    this.audio.playSfx(AUDIO.hunterDeath);

    // Every drop he is short of a full meter, flying home at once.
    const delay = COLD_OPEN.bloodStartMs - COLD_OPEN.strikeMs;
    // One audible drink per hunter, spread across the blood-arrival window.
    // These are intentionally stronger than the old per-bloodlet whispers:
    // twelve distinct overlapping slurps make the feast read as the Count
    // draining the whole squad without turning into one clipped sound.
    const drinkWindowMs = (COLD_OPEN.bloodlets - 1) * COLD_OPEN.bloodletStaggerMs;
    const drinkStepMs = corpses.length > 1 ? drinkWindowMs / (corpses.length - 1) : 0;
    for (let i = 0; i < corpses.length; i++) {
      this.time.delayedCall(delay + COLD_OPEN.bloodletFlightMs + i * drinkStepMs, () => {
        this.audio.playSfx(AUDIO.bloodPickup, { volumeScale: 0.35 });
      });
    }

    for (let i = 0; i < COLD_OPEN.bloodlets; i++) {
      const origin = corpses.length > 0 ? corpses[i % corpses.length] : PLAYER_SPAWN;
      this.time.delayedCall(delay + i * COLD_OPEN.bloodletStaggerMs, () => {
        const droplet = this.add
          .image(
            origin.x + Phaser.Math.Between(-18, 18),
            origin.y + Phaser.Math.Between(-18, 18),
            TEXTURES.blood,
          )
          .setDepth(DEPTHS.hud + 1)
          .setScale(BLOOD.dropletScale);
        this.tweens.add({
          targets: droplet,
          x: HUD_ANCHORS.bloodBar.x,
          y: HUD_ANCHORS.bloodBar.y,
          scale: BLOOD.dropletScale * 0.6,
          duration: COLD_OPEN.bloodletFlightMs,
          ease: 'Quad.easeIn',
          onComplete: () => {
            droplet.destroy();
            this.emitter.emit(EVENTS.BLOOD_CHANGED, nextBlood(), bloodTarget);
            this.hud?.burstAtBloodBar();
          },
        });
      });
    }
  }

  /** Beat four: into the coffin with a second to spare, then sleep off a day. */
  private cinematicRetire(): void {
    this.coffin.setOpen(true);
    this.setBatForm(true);

    this.flightSpiral({
      center: { x: COFFIN_POS.x, y: COFFIN_POS.y - 10 },
      from: { x: this.player.x, y: this.player.y },
      duration: COLD_OPEN.coffinFlightMs,
      toScale: 0.9,
      toAlpha: 0.55,
      squash: 0.6,
      onComplete: () => {
        this.setBatForm(false);
        this.player.setVisible(false);
        this.coffin.setOpen(false);

        // The cold open's clock runs right through the flight - that is what
        // puts one second on it as the lid shuts - and stops here, before the
        // refill takes the timer over. Leaving it running would let a stale
        // tick repaint the text mid-wind-up.
        this.coldOpenClock?.remove();
        this.coldOpenClock = null;

        // He sleeps: health refills, the blood is spent, the clock winds back
        // up to a full night - all of it WHILE the day passes overhead, not
        // queued up behind it. He came home almost dead (12 HP), so this
        // scripted transfer's own math sends none of the night's blood to
        // Wrath — see the real transfer below for the actual rule.
        const wrathFromColdOpen = Math.max(
          0,
          bloodTargetForNight(this.night) - (PLAYER.maxHealth - CINEMATIC.startHealth),
        );
        this.hud?.playCoffinTransfer(1, CINEMATIC.startHealth / PLAYER.maxHealth, 0, () => {
          if (wrathFromColdOpen > 0) this.gainWrath(wrathFromColdOpen);
        });
        this.playDayCycle(2200, () => {
          this.hud?.resetForNewRound(bloodTargetForNight(this.night));
          this.riseFromCoffin(() => this.startPlaying());
        });
      },
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
          // He lands facing the room, not wherever the spiral happened to leave
          // him — the flight is a bat and has no bearing on which way the man
          // is standing. The cursor takes over the instant control does.
          this.player.setFacing('down');
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
    // Control goes live, so the aiming fangs come out. Before this the menu and
    // the cold open are watched rather than played, and a cursor tracking the
    // mouse over a cutscene reads as a bug rather than as a cursor.
    setVampireCursorVisible(true);
    this.cameras.main.shake(120, 0.004); // landing thump

    // THE gameplay music cue. This is the one line in the run where the cold
    // open is over, the Count has landed, controls go live and (via
    // beginRoundSystems below) the first-night countdown and hunter spawning
    // start — so the handover is tied to the state change itself, not to a
    // timer guessing when the cutscene ends. Subsequent nights come through
    // beginRoundSystems directly and never re-request it; if they did, the
    // director would ignore it, which is what keeps the loop seamless.
    this.audio.playLevelMusic();

    // The opening cinematic builds the HUD early (it needs the bars on screen
    // to tell its story), so only create one here if it isn't already up.
    if (!this.hud) {
      this.hud = new HUD(this, this.emitter);
      this.hud.animateIn();
    }

    // The round is really starting now, so the night/objective announcements
    // come alive. Before beginRoundSystems, which is what raises the first one.
    this.hud.enableBanner();

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
    this.captains.clear();
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
   * Swings damage the player when they land (invulnerability still applies). A
   * share of every night's spawns arrive as garlic farmers instead — same
   * entrance, completely different threat — and everything else walks in
   * carrying one of Romi's weapons.
   */
  private createHunter(spawnX: number, spawnY: number, arrivalX: number, arrivalY: number): Hunter {
    const hunter = this.canSpawnThrower()
      ? this.createThrower(spawnX, spawnY)
      : this.createMeleeHunter(spawnX, spawnY);
    hunter.beginEntrance(arrivalX, arrivalY);
    hunter.onStrikeHit = () => {
      if (this.phase === 'playing') this.player.takeDamage(hunter.contactDamage);
    };
    return hunter;
  }

  /**
   * A melee spawn is a pilgrim or a huntress, carrying one of Romi's three
   * weapons. There is no unarmed flavour to fall back to any more — the
   * swordsman went with the bought pack — so which of the two faces turns up is
   * the only roll, and the weapon is the thing that changes how he fights (see
   * WEAPONS: reach and cadence, never damage).
   */
  private createMeleeHunter(spawnX: number, spawnY: number): Hunter {
    const weapon = Phaser.Utils.Array.GetRandom(weaponsForNight(this.night));
    const look = Phaser.Utils.Array.GetRandom([...BASIC_LOOKS]);
    return new ArmedHunter(this, spawnX, spawnY, weapon, look);
  }

  /**
   * Throwers are capped at the night number — one on night 1, two on night 2,
   * and so on — so the ranged pressure ramps predictably while the rest of the
   * (growing) spawn budget keeps going to melee hunters.
   */
  private canSpawnThrower(): boolean {
    if (this.night < THROWER.firstNight) return false;
    if (Math.random() >= THROWER.spawnChance) return false;
    return this.countAliveThrowers() < throwerCapForNight(this.night);
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
    return this.configureThrower(thrower);
  }

  /**
   * The huntress Captain throws crosses, not bulbs, so she gets her own wiring
   * on the same `onThrow` seam: a fan of them along the line her lock gave her,
   * each one flying flat until it hits him or leaves the hall.
   */
  private configureCrossCaptain(captain: CrossCaptain): CrossCaptain {
    let shot = 0;
    captain.onThrow = (fromX, fromY, toX, toY) => {
      if (this.phase !== 'playing') return;
      // Fan the volley around the locked line: middle one straight down it, the
      // others a fixed spread either side, so the wedge is the same every time
      // and can be learned.
      const middle = (CROSS.perVolley - 1) / 2;
      const offset = (shot % CROSS.perVolley) - middle;
      shot++;
      const angle = Phaser.Math.Angle.Between(fromX, fromY, toX, toY) + offset * CROSS.spread;
      const cross = new GoldCross(this, fromX, fromY, angle);
      this.crosses.add(cross);
      cross.launch(); // must follow the group add — see GoldCross.launch()
    };
    return captain;
  }

  private configureThrower<T extends GarlicThrower>(thrower: T): T {
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
    return this.hunters.getChildren().filter((h): h is Hunter => h instanceof Hunter);
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

    // A cross that reaches him bursts on the spot. One that misses keeps going
    // and leaves the hall — unlike a bulb, it never resolves where it was aimed.
    this.physics.add.overlap(this.player, this.crosses, (_player, crossObj) => {
      const cross = crossObj as GoldCross;
      if (cross.isSpent) return;
      if (this.player.isInvulnerable) return; // dashed clean through it
      cross.hitPlayer();
      if (this.phase === 'playing') this.player.takeDamage(CROSS.damage);
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

  /**
   * Collects any bloodlet close to the Count without waiting for their bodies
   * to actually overlap. The physics overlap alone strands blood he cannot
   * physically reach - a droplet pressed against a wall, or one that ended up
   * outside the hall - so walking near it is enough.
   */
  private vacuumNearbyPickups(): void {
    for (const object of this.pickups.getChildren()) {
      const pickup = object as BloodPickup;
      if (pickup.collecting || !pickup.active) continue;
      const distance = Phaser.Math.Distance.Between(
        pickup.x,
        pickup.y,
        this.player.x,
        this.player.y,
      );
      if (distance <= BLOOD.magnetRadius) this.collectPickup(pickup);
    }
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
          // The run-long total, which keeps climbing past each night's quota
          // and across the coffin — unlike flow.currentBlood, which resets.
          this.runStats.bloodCollected += pickup.amount;
          // Noam's slurp, on arrival rather than on the swing: the Count is
          // heard drinking exactly as the meter takes the blood in. One per
          // bloodlet, so a five-droplet kill is five drinks.
          this.audio.playSfx(AUDIO.bloodPickup);
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
    // HP already full is the one case healing this blood would do nothing
    // with — rather than fly a ribbon that visibly arrives and heals for
    // zero, it flies to the Wrath meter instead and actually charges it
    // (see WRATH in balance.ts). Decided once, before the flight starts: HP
    // does not change again until this flight's own completion callback.
    const toWrath = this.player.health >= PLAYER.maxHealth;

    // The live fill edges, not the bars' fixed midpoint anchors — the meter
    // is full at this exact moment (that is what "overflow" means), so the
    // blood bar's edge sits at its far right rather than its middle, and the
    // droplet has to land where the destination bar's own fill actually ends.
    const from = this.hud?.bloodBarEdge ?? HUD_ANCHORS.bloodBar;
    const to = toWrath
      ? (this.hud?.wrathBarEdge ?? { x: GAME_WIDTH / 2, y: 24 })
      : (this.hud?.healthBarEdge ?? HUD_ANCHORS.healthBar);
    const duration = 700;

    // A visible ribbon of blood crossing the top of the screen, not a lone
    // dot: three strands on their own swirl phases, each trailing particles,
    // so it reads unmistakably as the blood meter feeding whichever meter is
    // actually taking it. Tinted gold/purple rather than red when it is
    // headed for Wrath, so the two destinations never look the same.
    const trail = this.add
      .particles(0, 0, TEXTURES.particle, {
        speed: { min: 10, max: 50 },
        lifespan: { min: 260, max: 520 },
        scale: { start: 0.9, end: 0 },
        tint: toWrath ? [0xffd23d, 0x9d6bff, 0x241830] : [0xc41e2f, 0xff4d4d, 0xff8f9a],
        emitting: false,
      })
      .setDepth(DEPTHS.hud + 2);

    const strands = 3;
    let finished = 0;

    for (let s = 0; s < strands; s++) {
      const phase = (s / strands) * Math.PI * 2;
      const swirl = 26 + s * 10;
      const droplet = this.add
        .image(from.x, from.y, TEXTURES.blood)
        .setDepth(DEPTHS.hud + 3)
        .setScale(BLOOD.dropletScale * 0.8)
        .setTint(toWrath ? 0xffd23d : undefined);

      this.tweens.addCounter({
        from: 0,
        to: 1,
        duration,
        delay: s * 70,
        ease: 'Sine.easeInOut',
        onUpdate: (tween) => {
          const t = tween.getValue() ?? 0;
          // Straight line from bar to bar, plus a corkscrew around it that
          // fades out at both ends so the strands converge where they land.
          const taper = Math.sin(t * Math.PI);
          const x = Phaser.Math.Linear(from.x, to.x, t);
          const y =
            Phaser.Math.Linear(from.y, to.y, t) + Math.sin(t * Math.PI * 3 + phase) * swirl * taper;
          droplet.setPosition(x, y).setScale(0.8 - 0.3 * t);
          trail.emitParticleAt(x, y, 2);
        },
        onComplete: () => {
          droplet.destroy();
          if (++finished < strands) return;
          this.time.delayedCall(600, () => trail.destroy());
          if (toWrath) {
            this.gainWrath(bloodAmount);
          } else {
            // heal() emits PLAYER_HEALED, which is what repaints the bar and
            // fires the puff in whichever colour the bar has just become.
            this.player.heal(bloodAmount * BLOOD.overflowHealPerBlood);
          }
        },
      });
    }
  }

  // ── The Ultimate ────────────────────────────────────────────────────────

  /**
   * Blood the Count has no use for feeds Wrath instead of being wasted — see
   * WRATH in balance.ts. Silently caps at the target; spending it back to
   * zero is what fireUltimate does.
   */
  private gainWrath(amount: number): void {
    if (this.wrath >= WRATH.target) return;
    this.wrath = Math.min(WRATH.target, this.wrath + amount);
    this.hud?.setWrath(this.wrath, WRATH.target);
    this.touch?.setUltimateAvailable(this.wrath >= WRATH.target);
  }

  /** Space (desktop) or the mobile ⚡ button, once Wrath reads full. */
  private tryUseUltimate(): void {
    if (this.phase !== 'playing' || this.ultimateActive) return;
    if (this.wrath < WRATH.target) return;
    this.fireUltimate();
  }

  /**
   * The Ultimate: the Count rears up into the special pose Romi drew first
   * (Player.playSpecialAttackAnim, unused until now), the hall darkens a
   * touch, ~30 bats spawn out of dark magic and swirl the room, and a beat
   * later lightning spreads across the whole hall and kills everything still
   * standing in it, mini-bosses included.
   */
  private fireUltimate(): void {
    this.ultimateActive = true;
    this.wrath = 0;
    this.hud?.setWrath(0, WRATH.target);
    this.touch?.setUltimateAvailable(false);

    this.player.playSpecialAttackAnim();
    this.cameras.main.shake(160, 0.006);

    this.tweens.add({
      targets: this.ultDarkenOverlay,
      alpha: WRATH.screenDarkenAlpha,
      duration: 240,
      yoyo: true,
      hold: Math.max(0, WRATH.durationMs - 480),
      onComplete: () => {
        this.ultimateActive = false;
      },
    });

    this.spawnBatSwarm();
    // The strike lands a beat into the pose, not on its very first frame.
    this.time.delayedCall(320, () => this.lightningKillAll());
  }

  /**
   * ~30 bats, each launched out of its own burst of dark purple/black
   * particles, swirling the hall on its own Lissajous-ish path for the
   * Ultimate's duration before fading out. The flap sound is staggered by a
   * few tens of milliseconds per bat with pitch/level variance (see
   * AUDIO.batDashSound's manifest entry) so thirty plays read as a swarm
   * rather than one sound stamped out thirty times in the same frame.
   */
  private spawnBatSwarm(): void {
    const centerX = (ARENA.left + ARENA.right) / 2;
    const centerY = (ARENA.top + ARENA.bottom) / 2;
    const maxRadius = Math.min(ARENA.right - ARENA.left, ARENA.bottom - ARENA.top) / 2 - 40;

    for (let i = 0; i < WRATH.batCount; i++) {
      const spawnDelay = Phaser.Math.Between(0, 260);
      this.time.delayedCall(spawnDelay, () => {
        const angle0 = Phaser.Math.FloatBetween(0, Math.PI * 2);
        const startX = centerX + Math.cos(angle0) * Phaser.Math.FloatBetween(20, maxRadius);
        const startY = centerY + Math.sin(angle0) * Phaser.Math.FloatBetween(20, maxRadius);

        const puff = this.add
          .particles(startX, startY, TEXTURES.particle, {
            speed: { min: 30, max: 90 },
            lifespan: { min: 220, max: 420 },
            scale: { start: 1.6, end: 0 },
            alpha: { start: 0.9, end: 0 },
            tint: [0x241830, 0x9d6bff, 0x4a2e6b],
            emitting: false,
          })
          .setDepth(DEPTHS.attackFx);
        puff.explode(10);
        this.time.delayedCall(500, () => puff.destroy());

        const bat = this.add
          .sprite(startX, startY, TEXTURES.bat, 0)
          .setDepth(DEPTHS.attackFx + 1)
          .setScale(Phaser.Math.FloatBetween(0.9, 1.3))
          .setAlpha(0);
        bat.play(ANIMS.batFly);
        this.tweens.add({ targets: bat, alpha: 1, duration: 160 });

        const freqX = Phaser.Math.FloatBetween(1.2, 2.4);
        const freqY = Phaser.Math.FloatBetween(1.6, 2.8);
        const phaseX = Phaser.Math.FloatBetween(0, Math.PI * 2);
        const phaseY = Phaser.Math.FloatBetween(0, Math.PI * 2);
        const swirlRadius = Phaser.Math.FloatBetween(60, maxRadius);
        const flightMs = WRATH.durationMs - spawnDelay;

        this.tweens.addCounter({
          from: 0,
          to: 1,
          duration: flightMs,
          onUpdate: (tween) => {
            if (!bat.active) return;
            const t = tween.getValue() ?? 0;
            const x = centerX + Math.cos(t * Math.PI * 2 * freqX + phaseX) * swirlRadius;
            const y = centerY + Math.sin(t * Math.PI * 2 * freqY + phaseY) * swirlRadius * 0.6;
            bat.setFlipX(x < bat.x);
            bat.setPosition(x, y);
          },
          onComplete: () => {
            if (!bat.active) return;
            this.tweens.add({
              targets: bat,
              alpha: 0,
              scale: bat.scaleX * 0.6,
              duration: 260,
              onComplete: () => bat.destroy(),
            });
          },
        });

        this.time.delayedCall(Phaser.Math.Between(0, 90), () => {
          this.audio.playSfx(AUDIO.batDashSound, { volumeScale: 0.5 });
        });
      });
    }
  }

  /**
   * The lightning: a camera flash and shake, a jagged bolt down onto every
   * living thing in the hall, and then every one of them dies where it
   * stands — the same kill pipeline a melee hit uses (corpse, blood, decal,
   * stats), just fired for the whole roster at once rather than one target.
   */
  private lightningKillAll(): void {
    this.cameras.main.flash(260, 220, 200, 255);
    this.cameras.main.shake(420, 0.01);

    const targets = this.getAttackTargets().filter((t) => t.active && t.isAlive);
    for (const target of targets) {
      this.spawnLightningBolt(target.x, target.y);
      this.onHunterKilled(target);
    }
  }

  /** One jagged bolt from above the hall down to (x, y), flashed and gone. */
  private spawnLightningBolt(x: number, y: number): void {
    const originY = ARENA.top - 30;
    const segments = 6;
    const graphics = this.add.graphics().setDepth(DEPTHS.attackFx + 2);

    const drawBolt = (width: number, color: number, alpha: number): void => {
      graphics.lineStyle(width, color, alpha);
      graphics.beginPath();
      graphics.moveTo(x + Phaser.Math.Between(-20, 20), originY);
      for (let i = 1; i <= segments; i++) {
        const t = i / segments;
        const jitter = i === segments ? 0 : Phaser.Math.Between(-24, 24);
        graphics.lineTo(x + jitter, Phaser.Math.Linear(originY, y, t));
      }
      graphics.strokePath();
    };
    drawBolt(5, 0xe8ddff, 1);
    drawBolt(2, 0x9d6bff, 0.9);

    this.tweens.add({
      targets: graphics,
      alpha: 0,
      delay: 70,
      duration: 200,
      onComplete: () => graphics.destroy(),
    });
  }

  private coffinHintMessage(): string {
    const needsBlood = !this.flow.isBloodFull;
    const needsBoss = !this.flow.isBossDefeated;
    const { name, plural } = this.bossName();
    if (needsBlood && needsBoss) return `Not yet: collect blood and slay ${name}`;
    if (needsBoss) return plural;
    return 'You need more blood';
  }

  /** What to call tonight's boss (or bosses) in the coffin's hint messages. */
  private bossName(): { name: string; plural: string } {
    // Prefer the bosses actually standing in the hall — same reason the HUD
    // banner does (see HUD.setBossRoster). Falling back to the night number is
    // only for the case where the Count reaches the coffin before they spawn,
    // when guessing is all there is.
    // `isAlive` alone: the set is already pruned in onHunterKilled, and testing
    // `active` as well gave false negatives for a boss still walking in — which
    // is exactly when the Count is most likely to be at the coffin asking.
    const alive = [...this.captains].filter((captain) => captain.isAlive);
    if (alive.length > 0) {
      const counts = new Map<string, number>();
      for (const captain of alive) {
        counts.set(captain.bossName, (counts.get(captain.bossName) ?? 0) + 1);
      }
      const parts = [...counts].map(([name, n]) =>
        n > 1 ? `the ${n} ${pluralBossName(name)}` : `the ${name}`,
      );
      const listed =
        parts.length === 1
          ? parts[0]
          : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
      const stillLives =
        alive.length === 1
          ? `${parts[0][0].toUpperCase()}${parts[0].slice(1)} still lives`
          : `${listed[0].toUpperCase()}${listed.slice(1)} still live`;
      return { name: listed, plural: stillLives };
    }

    const lineup = bossLineupForNight(this.night);
    if (lineup.priests > 0 && lineup.captains === 0) {
      return { name: 'the Priest', plural: 'The Priest still lives' };
    }
    if (lineup.priests > 0) {
      const escort = lineup.captains > 1 ? 'Captains' : 'Captain';
      return { name: `the Priest and his ${escort}`, plural: 'The Priest still lives' };
    }
    return captainCountForNight(this.night) > 1
      ? { name: 'the Captains', plural: 'Captains still live' }
      : { name: 'the Captain', plural: 'The Captain still lives' };
  }

  private wireEvents(): void {
    this.emitter.on(EVENTS.BOSS_SPAWN_REQUESTED, this.spawnBoss, this);
    this.emitter.on(EVENTS.DAWN_REACHED, this.onDawnReached, this);
    this.emitter.on(EVENTS.BAT_FORM_CHANGED, (active: boolean, cause: 'flight' | 'dash') => {
      if (active && cause === 'dash') {
        this.audio.stopSfx(AUDIO.batDashSound);
        this.audio.playSfxSegment(AUDIO.batDashSound, 0.5, 1);
      } else if (active) {
        this.audio.playSfx(AUDIO.batSound1, { loop: true });
      } else if (cause === 'flight') {
        this.audio.stopSfx(AUDIO.batSound1);
      }
    });
    this.emitter.on(EVENTS.PLAYER_DIED, () => this.flow.notifyPlayerDied());
    this.emitter.on(EVENTS.PLAYER_DAMAGED, () => this.audio.playSfx(AUDIO.playerHurt));
    this.emitter.on(EVENTS.BLOOD_OVERFLOWED, this.hopBloodToHealth, this);
    this.emitter.on(EVENTS.COFFIN_ACTIVATED, () => this.coffin.activate());
    this.emitter.on(EVENTS.FINAL_TEN_SECONDS, () => {
      this.audio.playSfx(AUDIO.finalSeconds);
      this.cameras.main.flash(200, 255, 154, 61);
    });
    this.emitter.on(EVENTS.GAME_ENDED, this.onGameEnded, this);
  }

  private setupPauseKeys(): void {
    this.input.keyboard?.on('keydown-ESC', this.requestPause, this);
    this.input.keyboard?.on('keydown-P', this.requestPause, this);
  }

  private spawnBoss(): void {
    if (this.captains.size > 0) return;
    const lineup = bossLineupForNight(this.night);
    const arrivals = this.bossArrivalPositions(lineup.priests + lineup.captains);

    for (const [index, arrival] of arrivals.entries()) {
      const spawn = offCanvasSpawnPoint(arrival);
      // The Priests lead the lineup, so on a night that sends one he is the
      // boss who arrives at the spot farthest from the Count.
      const captain: Captain =
        index < lineup.priests
          ? this.createPriest(spawn.x, spawn.y)
          : this.createCaptain(spawn.x, spawn.y);

      captain.beginEntrance(arrival.x, arrival.y);
      captain.onEntranceArrived = () => captain.playEntrance();
      captain.onStrikeHit = () => {
        if (this.phase === 'playing' && captain.active) {
          this.player.takeDamage(captain.contactDamage);
        }
      };
      this.captains.add(captain);
      this.hunters.add(captain);
    }

    // Order matters: the HUD has to know WHO arrived before the objective flips,
    // because notifyBossSpawned is what triggers the banner.
    this.hud?.setBossRoster([...this.captains].map((captain) => captain.bossName));
    this.flow.notifyBossSpawned();
    this.audio.playSfx(AUDIO.bossAppear);
  }

  /** A Captain, half of them armed with garlic instead of a sword. */
  /**
   * A Captain is one of Romi's three hunters grown into a mini-boss, and which
   * one decides how he fights, exactly as the folder names promised:
   *
   *   farmer   -> garlic, a bulb in each hand (GarlicCaptain)
   *   huntress -> gold crosses, thrown like shuriken (CrossCaptain)
   *   pilgrim  -> the weapon his men carry, swung harder (HunterCaptain)
   *
   * Only the RANGED two are gated, and on the same thrower cap the ordinary
   * farmers share, so a night cannot stack ranged pressure past what the cap
   * allows. Everything else falls through to the melee pilgrim.
   */
  private createCaptain(spawnX: number, spawnY: number): Captain {
    const rangedAllowed = this.countAliveThrowers() < throwerCapForNight(this.night);
    if (rangedAllowed && Math.random() < BOSS.garlicCaptainChance) {
      return Math.random() < 0.5
        ? this.configureThrower(new GarlicCaptain(this, spawnX, spawnY, this.emitter))
        : this.configureCrossCaptain(new CrossCaptain(this, spawnX, spawnY, this.emitter));
    }
    const weapon = Phaser.Utils.Array.GetRandom(weaponsForNight(this.night));
    return new HunterCaptain(this, spawnX, spawnY, this.emitter, PILGRIM_LOOK, weapon);
  }

  /**
   * The Priest. His ward burns through the Count's own damage path, so the
   * invulnerability window applies and a dash carries him through the light
   * untouched — the same escape that beats a garlic lock.
   */
  private createPriest(spawnX: number, spawnY: number): Priest {
    const priest = new Priest(this, spawnX, spawnY, this.emitter);
    priest.onWardHit = () => {
      if (this.phase === 'playing') this.player.takeDamage(PRIEST.wardDamage);
    };
    return priest;
  }

  /**
   * Arena-edge midpoint farthest from the player — where the Captain
   * arrives. Bottom/left/right only, matching SpawnSystem: never the north
   * wall behind the player's spawn point.
   */
  private bossArrivalPositions(count: number): { x: number; y: number }[] {
    const cx = (ARENA.left + ARENA.right) / 2;
    const cy = (ARENA.top + ARENA.bottom) / 2;
    const inset = 70;
    const spacing = 105;
    const candidates: { x: number; y: number }[] = [];

    for (let x = ARENA.left + inset; x <= ARENA.right - inset; x += spacing) {
      candidates.push({ x, y: ARENA.bottom - inset });
    }
    for (let y = ARENA.top + inset; y <= ARENA.bottom - inset; y += spacing) {
      candidates.push({ x: ARENA.left + inset, y });
      candidates.push({ x: ARENA.right - inset, y });
    }

    candidates.sort((a, b) => {
      const da = Phaser.Math.Distance.Between(a.x, a.y, this.player.x, this.player.y);
      const db = Phaser.Math.Distance.Between(b.x, b.y, this.player.x, this.player.y);
      return db - da;
    });

    if (candidates.length === 0) return [{ x: cx, y: cy }];
    return Array.from({ length: count }, (_, i) => candidates[i % candidates.length]);
  }

  private onHunterKilled(hunter: Hunter): void {
    hunter.spawnCorpse();
    this.stampBloodDecal(hunter.x, hunter.y, hunter.displayHeight);
    const isBoss =
      hunter instanceof HunterCaptain ||
      hunter instanceof GarlicCaptain ||
      hunter instanceof CrossCaptain ||
      hunter instanceof Priest;

    if (isBoss) {
      this.runStats.bosses[this.bossKindOf(hunter)]++;
      this.captains.delete(hunter);
      if (this.captains.size === 0) this.flow.notifyBossDefeated();
      // A mini-boss only ever dies once the blood meter is already full (see
      // BOSS_SPAWN_REQUESTED), so this flood is guaranteed overflow — it tops
      // off HP, or once that is full too, fills Wrath (see hopBloodToHealth).
      this.scatterBloodlets(hunter.x, hunter.y, hunter instanceof Priest ? PRIEST.bloodDroplets : BOSS.bloodDroplets);
    } else {
      // Counted where he DIES rather than where his blood lands, so a hunter
      // killed on the last tick of a night still shows up on the tally.
      this.runStats.hunters[this.hunterKindOf(hunter)]++;
      this.scatterBloodlets(hunter.x, hunter.y);
      this.audio.playSfx(AUDIO.hunterDeath);
    }
    this.registerKillForSplatter(isBoss);
    this.hunters.remove(hunter, true, true);
  }

  /**
   * Screen-space blood splatter, scaled by how many kills just landed close
   * together in time — a lone kill or two is just the usual floor decal, but
   * several at once (or any mini-boss) floods the screen itself. See
   * SCREEN_SPLATTER_TIERS / KILL_BURST_TIER_THRESHOLDS.
   */
  private registerKillForSplatter(isBoss: boolean): void {
    const now = this.time.now;
    this.recentKillTimes = this.recentKillTimes.filter((t) => now - t < KILL_BURST_WINDOW_MS);
    this.recentKillTimes.push(now);

    if (isBoss) {
      this.spawnScreenBloodSplatter(SCREEN_SPLATTER_TIERS.length - 1);
      return;
    }
    const burst = this.recentKillTimes.length;
    const tier = KILL_BURST_TIER_THRESHOLDS.filter((t) => burst >= t).length - 1;
    if (tier >= 0) this.spawnScreenBloodSplatter(tier);
  }

  /** One big, faint, camera-fixed splatter — blood on the screen, not the room. */
  private spawnScreenBloodSplatter(tier: number): void {
    const { scale, alpha } = SCREEN_SPLATTER_TIERS[Phaser.Math.Clamp(tier, 0, SCREEN_SPLATTER_TIERS.length - 1)];
    const splatter = this.add
      .image(
        Phaser.Math.Between(GAME_WIDTH * 0.15, GAME_WIDTH * 0.85),
        Phaser.Math.Between(GAME_HEIGHT * 0.2, GAME_HEIGHT * 0.85),
        Phaser.Utils.Array.GetRandom([...BLOOD_DECALS]),
      )
      .setScrollFactor(0)
      .setDepth(DEPTHS.screenFx)
      .setRotation(Phaser.Math.FloatBetween(0, Math.PI * 2))
      .setScale(Phaser.Math.FloatBetween(scale[0], scale[1]))
      .setAlpha(0);

    const peak = Phaser.Math.FloatBetween(alpha[0], alpha[1]);
    this.tweens.add({ targets: splatter, alpha: peak, duration: 140 });
    this.tweens.add({
      targets: splatter,
      alpha: 0,
      delay: 2200,
      duration: 1400,
      onComplete: () => splatter.destroy(),
    });
  }

  /**
   * A crossed cross keeps flying until it hits him or leaves the hall. Nothing
   * else in the game needs an out-of-bounds check — a garlic bulb resolves at
   * the point it was aimed at, so it always ends somewhere — which is why this
   * lives here rather than on the projectile's own physics body.
   */
  private updateCrosses(): void {
    if (this.crosses.getLength() === 0) return;
    const bounds = new Phaser.Geom.Rectangle(
      ARENA.left - 40,
      ARENA.top - 40,
      ARENA.right - ARENA.left + 80,
      ARENA.bottom - ARENA.top + 80,
    );
    for (const cross of this.crosses.getChildren()) {
      (cross as GoldCross).updateFlight(bounds);
    }
  }

  /**
   * The stain a corpse leaves. One of Romi's marks, picked at random and turned
   * to a random angle so no two kills leave the same shape, laid flat on the
   * floor UNDER everything and fading slowly — long after the body itself has
   * gone, which is what makes a hall the Count has worked through look worked
   * through.
   */
  private stampBloodDecal(x: number, y: number, hunterHeight: number): void {
    const decal = this.add
      .image(
        Phaser.Math.Clamp(x, ARENA.left + 12, ARENA.right - 12),
        // Down at his feet, not at his middle: blood pools on the floor.
        Phaser.Math.Clamp(y + hunterHeight * 0.18, ARENA.top + 12, ARENA.bottom - 12),
        Phaser.Utils.Array.GetRandom([...BLOOD_DECALS]),
      )
      .setDepth(DEPTHS.groundFx)
      .setRotation(Phaser.Math.FloatBetween(0, Math.PI * 2))
      .setScale(Phaser.Math.FloatBetween(0.5, 0.8))
      .setAlpha(0);

    this.tweens.add({ targets: decal, alpha: 0.85, duration: 120 });
    this.tweens.add({
      targets: decal,
      alpha: 0,
      delay: BLOOD.decalLingerMs,
      duration: BLOOD.decalFadeMs,
      onComplete: () => decal.destroy(),
    });
  }

  /** Dead hunters burst into a handful of +1 bloodlets around the corpse; a mini-boss floods far more. */
  private scatterBloodlets(x: number, y: number, count: number = HUNTER.bloodDroplets): void {
    // The corpse itself can be outside the hall (killed mid-entrance, or shoved
    // against a wall), so the spawn point is clamped as well as the landing
    // point - otherwise the droplets are born somewhere unreachable.
    const fromX = Phaser.Math.Clamp(x, ARENA.left + 10, ARENA.right - 10);
    const fromY = Phaser.Math.Clamp(y, ARENA.top + 10, ARENA.bottom - 10);

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Phaser.Math.FloatBetween(-0.4, 0.4);
      // A big flood reaches further out than a handful of drops would, or a
      // mini-boss's 25+ droplets would all pile up in the same tight ring.
      const dist = Phaser.Math.Between(14, count > HUNTER.bloodDroplets ? 90 : 38);
      const px = Phaser.Math.Clamp(fromX + Math.cos(angle) * dist, ARENA.left + 10, ARENA.right - 10);
      const py = Phaser.Math.Clamp(fromY + Math.sin(angle) * dist, ARENA.top + 10, ARENA.bottom - 10);
      const pickup = new BloodPickup(this, fromX, fromY);
      this.pickups.add(pickup);
      pickup.settleAt(px, py);
    }
  }

  private onDawnReached(): void {
    this.audio.playSfx(AUDIO.dawn);
    this.flow.notifyDawnReached();
  }

  private onGameEnded(cause: EndCause): void {
    this.spawner?.stop();
    this.physics.pause();

    // A run that is over hands the music back to the Main Title straight
    // away, so it is already up and looping by the time the game-over screen
    // appears (death waits on a death animation first). GameFlowSystem lets
    // the run end exactly once, and the director ignores a request for the
    // track it is already playing, so this cannot fire the swap twice.
    if (cause !== 'victory') this.audio.playMainTitle();

    // Nothing is aiming at a Count who has already lost (or won) the night.
    this.garlics.clear(true, true);
    this.crosses.clear(true, true);
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
      stats: { ...this.runStats },
    };
  }

  /** Which line of the debrief a dead hunter belongs on. */
  private hunterKindOf(hunter: Hunter): HunterKind {
    if (hunter instanceof ArmedHunter) return hunter.weaponKind;
    return 'thrower';
  }

  /** Which line of the debrief a dead boss belongs on. */
  private bossKindOf(boss: Hunter): BossKind {
    if (boss instanceof Priest) return 'priest';
    if (boss instanceof CrossCaptain) return 'crossCaptain';
    if (boss instanceof GarlicCaptain) return 'garlicCaptain';
    return 'captain';
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

    // Romi drew the burning: he goes down, catches, flickers between two
    // burning frames, and settles into ash. Nothing is tinted on top of that —
    // an orange FILL strobe over frames that are already on fire would only
    // paint out the fire she painted. The embers pour off him the whole way.
    this.player.playSunburnAnim();
    const ash = this.time.addEvent({
      delay: 130,
      repeat: Math.floor(VAMPIRE_SUNBURN_DURATION_MS / 130),
      callback: () => embers.explode(6, this.player.x, this.player.y - 14),
    });

    // Reaching the game-over screen must NOT depend on an animation event.
    // It used to, and a death landing inside a dash's 175ms let the dash's
    // queued restore play over the sunburn — the animation never completed, the
    // event never fired, and the run hung forever with the music still playing.
    // Player.stopForDeath fixes that cause; this makes the whole class of it
    // impossible. Whichever arrives first wins, and `settled` keeps the scene
    // from being started twice.
    let settled = false;
    const toGameOver = (): void => {
      if (settled) return;
      settled = true;
      ash.remove();
      this.time.delayedCall(700, () => this.scene.start(SCENES.gameOver, summary));
    };

    this.player.once(Phaser.Animations.Events.ANIMATION_COMPLETE, toGameOver);
    this.time.delayedCall(VAMPIRE_SUNBURN_DURATION_MS + DEATH_FALLBACK_GRACE_MS, toGameOver);
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
    this.crosses.clear(true, true);

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
        // Overnight healing is a real 1-blood-per-HP rate, unlike the flat
        // BLOOD.overflowHealPerBlood the round itself uses — so whatever this
        // night's blood doesn't spend healing him back to full is blood with
        // nothing left to buy, same rule as any other overflow (see
        // hopBloodToHealth): it goes to Wrath instead of being wasted.
        const missingHp = PLAYER.maxHealth - this.player.health;
        const wrathFromOvernight = Math.max(0, this.flow.bloodTarget - missingHp);
        // He heals WHILE the sky turns, not before it: the sleep and the day
        // passing are one beat, so they run together and the cycle owns the
        // handoff into the next night.
        this.hud?.playCoffinTransfer(bloodRatio, healthRatio, secondsLeft, () => {
          if (wrathFromOvernight > 0) this.gainWrath(wrathFromOvernight);
        });
        this.playNightCycle();
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
        // He made it into the coffin, so the night he just played counts as
        // survived. Credited here rather than on the next night starting, so a
        // run that ends during the transition still gets the night it earned.
        this.runStats.nightsSurvived++;
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
    // Whatever comes next (game over, victory, the menu again) is clickable.
    setVampireCursorVisible(true);
    // Only this scene's own effects are silenced. The music is deliberately
    // left alone: it belongs to the game, not to the scene, and has to carry
    // across game over, the menu and the next run without a gap.
    this.audio.stopSfx(AUDIO.batSound1);
    this.audio.stopSfx(AUDIO.batDashSound);
    this.emitter.removeAllListeners();
    this.hud?.destroy();
    this.spawner?.stop();
    this.taglineTimer?.remove();
    this.menuLightning?.destroy();
    this.menuLightning = null;
    this.coldOpenClock?.remove();
    this.events.off(Phaser.Scenes.Events.PAUSE, this.onScenePaused, this);
    this.events.off(Phaser.Scenes.Events.RESUME, this.onSceneResumed, this);
    this.input.keyboard?.off('keydown-ESC', this.requestPause, this);
    this.input.keyboard?.off('keydown-P', this.requestPause, this);
  }
}
