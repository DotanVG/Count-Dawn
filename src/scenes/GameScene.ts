import Phaser from 'phaser';
import {
  HUNTER,
  NIGHT,
  PLAYER,
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
  private inputController!: InputController;
  private combat!: CombatSystem;
  private spawner: SpawnSystem | null = null;
  private hud: HUD | null = null;
  private touch: TouchControls | null = null;
  private dawnOverlay!: Phaser.GameObjects.Rectangle;
  private nightOverlay!: Phaser.GameObjects.Rectangle;
  private menuUi: Phaser.GameObjects.Container | null = null;
  private taglineTimer: Phaser.Time.TimerEvent | null = null;
  private aimArc: Phaser.GameObjects.Graphics | null = null;

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
      this.startIntro();
    } else {
      this.buildMenu();
    }
  }

  update(_time: number, delta: number): void {
    // During 'transition' the day/night cycle tween drives the sky directly
    // (see playNightCycle) — the automatic call here would fight it using a
    // stale countdown.progress, so it's skipped for that phase only.
    if (this.phase !== 'transition') {
      this.sky.update(this.countdown?.progress ?? 0);
    }

    if (this.phase !== 'playing' || !this.countdown) return;

    this.countdown.update(delta);
    if (this.phase !== 'playing') return; // dawn may have just ended the run

    this.updatePlayerControl();

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
      this.player.move(mv.x, mv.y);
      // Face the direction of travel; taps/strikes override at strike time.
      if (mv.x !== 0 || mv.y !== 0) {
        this.player.aimAt(this.player.x + mv.x * 100, this.player.y + mv.y * 100);
      }
      this.drawAimArc();
      if (this.touch.isAutoAttackHeld()) {
        this.autoAttackNearest();
      }
      return;
    }

    const move = this.inputController.getMoveVector();
    this.player.move(move.x, move.y);

    const aim = this.inputController.getAimPoint();
    this.player.aimAt(aim.x, aim.y);
    this.drawAimArc();

    if (this.inputController.isMouseAttackDown()) {
      this.combat.tryAttack(this.getAttackTargets());
    } else if (this.inputController.isAutoAttackDown()) {
      this.autoAttackNearest();
    }
  }

  /**
   * Aim reticle around the Count, facing the mouse (desktop) or the current
   * travel/strike direction (mobile): a thin outer arc, a small fan of tick
   * marks, and a chevron tip — an eighth of a circle, not a plain line.
   */
  private drawAimArc(): void {
    if (!this.aimArc) return;
    const g = this.aimArc;
    const halfAngle = Math.PI / 8; // 45° total — an eighth of a circle
    const radius = 130;
    const aim = this.player.aimAngle;
    g.clear();
    g.setPosition(this.player.x, this.player.y);

    // Outer arc.
    g.lineStyle(3, COLORS.attackArc, 0.3);
    g.beginPath();
    g.arc(0, 0, radius, aim - halfAngle, aim + halfAngle, false);
    g.strokePath();

    // Radial tick marks fanning across the arc, brightest at dead-center.
    const ticks = 5;
    for (let i = 0; i < ticks; i++) {
      const t = i / (ticks - 1);
      const angle = aim - halfAngle + t * (2 * halfAngle);
      const alpha = 0.15 + 0.45 * (1 - Math.abs(t - 0.5) * 2);
      g.lineStyle(2, COLORS.attackArc, alpha);
      g.beginPath();
      g.moveTo(Math.cos(angle) * (radius - 9), Math.sin(angle) * (radius - 9));
      g.lineTo(Math.cos(angle) * (radius + 7), Math.sin(angle) * (radius + 7));
      g.strokePath();
    }

    // Chevron tip at the exact aim angle, pointing outward.
    const tipR = radius + 16;
    const cx = Math.cos(aim) * tipR;
    const cy = Math.sin(aim) * tipR;
    const backA = aim + Math.PI * 0.82;
    const backB = aim - Math.PI * 0.82;
    g.fillStyle(COLORS.attackArc, 0.65);
    g.fillTriangle(
      cx,
      cy,
      cx + Math.cos(backA) * 12,
      cy + Math.sin(backA) * 12,
      cx + Math.cos(backB) * 12,
      cy + Math.sin(backB) * 12,
    );
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

    const instructions = this.isTouch
      ? 'Joystick — Move      Tap — Strike toward tap      ⚔ — Strike nearest      ⏸ — Pause'
      : 'Move — WASD / Arrows      Aim — Mouse      Attack — Click / Space      Pause — Esc / P';
    const controls = this.add
      .text(cx, 545, instructions, { fontFamily: FONT, fontSize: '17px', color: '#9d8bbf' })
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

    this.riseFromCoffin(() => this.startPlaying());
  }

  /**
   * The coffin creaks open, the Count rises out small, then sweeps around
   * the hall in a shrinking spiral, growing to full boss size, and lands
   * dead center. Shared by the very first rise (from the menu) and every
   * subsequent night's fly-out in the seamless loop.
   */
  private riseFromCoffin(onComplete: () => void): void {
    this.coffin.setOpen(true);
    this.player
      .setVisible(true)
      .setPosition(COFFIN_POS.x, COFFIN_POS.y - 20)
      .setScale(0.9)
      .setAlpha(0.55);
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
   * BAT PLACEHOLDER: when the bat spritesheet lands (TEXTURES.bat +
   * ANIMS.batFly), this is where the Count turns into a bat for the coffin
   * fly-in/fly-out — swap the texture/anim here and back. The same sheet
   * will power the future bat-minion summons: spawned bats that pick a
   * random subset of hunters and pull their pursuit onto themselves (so not
   * every mob reacts the same) until the hunter kills the bat.
   */
  private setBatForm(active: boolean): void {
    this.player.play(active ? 'vampire-run-down' : 'vampire-idle-down');
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
    const fromScale = this.player.scale;
    const fromAlpha = this.player.alpha;

    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: opts.duration,
      ease: 'Sine.easeInOut',
      onUpdate: (tween) => {
        const t = tween.getValue() ?? 0;
        const angle = a0 + t * Math.PI * 3; // 1.5 loops
        const r = r0 * (1 - t);
        this.player.setPosition(
          opts.center.x + Math.cos(angle) * r,
          opts.center.y + Math.sin(angle) * r * opts.squash,
        );
        this.player.setScale(Phaser.Math.Linear(fromScale, opts.toScale, t));
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

    this.hud = new HUD(this, this.emitter);
    this.hud.animateIn();

    if (!this.isTouch) {
      this.aimArc = this.add.graphics().setDepth(DEPTHS.player - 1);
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

  /** Sword swings damage the player when they land (invulnerability still applies). */
  private createHunter(spawnX: number, spawnY: number, arrivalX: number, arrivalY: number): Hunter {
    const hunter = new Hunter(this, spawnX, spawnY);
    hunter.beginEntrance(arrivalX, arrivalY);
    hunter.onStrikeHit = () => {
      if (this.phase === 'playing') this.player.takeDamage(hunter.contactDamage);
    };
    return hunter;
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
      (hunterObj) => {
        const body = this.coffin.body as Phaser.Physics.Arcade.StaticBody;
        (hunterObj as Hunter).avoidCoffin(
          this.coffin.x,
          this.coffin.y,
          body.width / 2,
          body.height / 2,
          this.player.x,
        );
      },
      (hunterObj) => !(hunterObj as Hunter).isEntering,
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
    this.aimArc?.clear();

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
    // Clear the field immediately so the hall reads clean through the outro.
    this.hunters.clear(true, true);
    this.pickups.clear(true, true);

    this.coffin.setOpen(true);
    this.setBatForm(true); // BAT PLACEHOLDER: he flies back as a bat too

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
        this.hud?.playCoffinTransfer(bloodRatio, healthRatio, () => {
          this.time.delayedCall(300, () => this.playNightCycle());
        });
      },
    });
  }

  /**
   * Fast-forwards the sky from wherever the night ended back to full dark —
   * sunset finishing fast, night falling, the moon rising again — then
   * starts the next round's fly-out from the coffin.
   */
  private playNightCycle(): void {
    const startProgress = this.countdown?.progress ?? 0.5;

    this.tweens.addCounter({
      from: startProgress,
      to: 0,
      duration: 1600,
      ease: 'Sine.easeInOut',
      onUpdate: (tween) => {
        const v = tween.getValue() ?? 0;
        this.sky.update(v);
        this.nightOverlay.setAlpha(0.42 * (1 - v * v));
        this.dawnOverlay.setAlpha(v * v * 0.18);
      },
      onComplete: () => {
        this.night++;
        this.hud?.resetForNewRound(bloodTargetForNight(this.night));
        this.riseFromCoffin(() => {
          this.physics.resume();
          this.phase = 'playing';
          this.cameras.main.shake(120, 0.004);
          this.beginRoundSystems();
        });
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
