import Phaser from 'phaser';
import { DEPTHS, GAME_WIDTH, GAME_HEIGHT } from '../game/constants';

const JOY_COLOR = 0xc41e2f;
const THUMB_COLOR = 0xff4d4d;

export interface TouchCallbacks {
  /** Tap anywhere on the playfield: strike toward that world point. */
  onTapAttack(worldX: number, worldY: number): void;
  /** Pause button. */
  onPause(): void;
}

/**
 * Mobile-only on-screen controls (blood-red to match the palette): a fixed
 * bottom-left virtual joystick for movement, a bottom-right ⚔ button that
 * strikes the nearest hunter once per press (mirroring a desktop click — no
 * holding it down for a stream of hits), a small pause button, a ⚡ Ultimate
 * button that only appears once Wrath is charged, and tap-anywhere-else to
 * strike in that direction (also once per tap, mirroring desktop mouse
 * clicks). Adapted from BeatEmPie.
 *
 * Two idle-vs-active tells so the controls read as alive rather than static
 * chrome: every button flashes brighter and pops on press (flashButton), and
 * the joystick breathes a slow alpha pulse while NOT being held, which stops
 * dead the instant a touch grabs it (joyBlinkTween) — the pulse IS the "use
 * me to move" hint, so it has no reason to keep going once that has happened.
 */
export class TouchControls {
  private moveVec = { x: 0, y: 0 };
  private base: Phaser.GameObjects.Arc;
  private thumb: Phaser.GameObjects.Arc;
  private joyPointerId = -1;
  private readonly radius = 92;
  /** Latched by the ⚔ button, consumed once by GameScene — one press, one strike. */
  private autoAttackPressed = false;
  /** Latched by the 🦇 button, consumed once by GameScene — one press, one dash. */
  private dashPressed = false;
  /** Latched by the ⚡ button, consumed once by GameScene — one press, one Ultimate. */
  private ultimatePressed = false;
  private ultimateAvailable = false;
  private ultButton!: Phaser.GameObjects.Arc;
  private ultButtonLabel!: Phaser.GameObjects.Text;
  /** Circular keep-out zones (buttons) where a tap must NOT trigger a strike. */
  private controlZones: { x: number; y: number; r: number }[] = [];
  /** Slow breathing pulse on the joystick while it is NOT being held — the
   *  tell that it is there to be used, not just idle chrome. Paused the
   *  instant a touch grabs it and resumed on release. */
  private joyBlinkTween!: Phaser.Tweens.Tween;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly callbacks: TouchCallbacks,
  ) {
    // Phaser tracks a single touch pointer by default; add more so the
    // joystick, attack button and taps can all be held at the same time.
    // Without this, moving and attacking are mutually exclusive.
    scene.input.addPointer(2);

    const joyX = 150;
    const joyY = GAME_HEIGHT - 150;
    this.base = scene.add
      .circle(joyX, joyY, this.radius, 0xffffff, 0.06)
      .setStrokeStyle(4, JOY_COLOR, 0.55)
      .setDepth(DEPTHS.hud + 10)
      .setScrollFactor(0);
    this.thumb = scene.add
      .circle(joyX, joyY, this.radius * 0.45, THUMB_COLOR, 0.45)
      .setDepth(DEPTHS.hud + 10)
      .setScrollFactor(0);
    this.joyBlinkTween = scene.tweens.add({
      targets: [this.base, this.thumb],
      alpha: { from: 1, to: 0.35 },
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Strike button: one press, one strike toward the nearest hunter.
    this.makeButton(GAME_WIDTH - 130, GAME_HEIGHT - 140, 72, '⚔', () => {
      this.autoAttackPressed = true;
    });
    // Bat dash, tucked above and inside the strike button.
    this.makeButton(GAME_WIDTH - 250, GAME_HEIGHT - 96, 52, '🦇', () => {
      this.dashPressed = true;
    });
    // Ultimate: above and to the right of the strike button (not directly
    // above it, which is the dash's spot) — hidden until Wrath is charged.
    const ult = this.makeButton(GAME_WIDTH - 90, GAME_HEIGHT - 240, 46, '⚡', () => {
      if (this.ultimateAvailable) this.ultimatePressed = true;
    });
    this.ultButton = ult.circle;
    this.ultButtonLabel = ult.text;
    this.ultButton.setVisible(false).disableInteractive();
    this.ultButtonLabel.setVisible(false);
    // Mobile-only pause, below the fullscreen button.
    this.makeButton(GAME_WIDTH - 56, 140, 30, '⏸', () => this.callbacks.onPause());

    scene.input.on('pointerdown', this.onDown, this);
    scene.input.on('pointermove', this.onMove, this);
    scene.input.on('pointerup', this.onUp, this);
    scene.input.on('pointerupoutside', this.onUp, this);
  }

  private makeButton(
    x: number,
    y: number,
    r: number,
    label: string,
    onDown: (pointer: Phaser.Input.Pointer) => void,
  ): { circle: Phaser.GameObjects.Arc; text: Phaser.GameObjects.Text } {
    const btn = this.scene.add
      .circle(x, y, r, JOY_COLOR, 0.28)
      .setStrokeStyle(4, THUMB_COLOR, 0.8)
      .setDepth(DEPTHS.hud + 10)
      .setScrollFactor(0)
      .setInteractive();
    const text = this.scene.add
      .text(x, y, label, { fontSize: `${Math.round(r * 0.9)}px` })
      .setOrigin(0.5)
      .setDepth(DEPTHS.hud + 11)
      .setScrollFactor(0);
    btn.on('pointerdown', (p: Phaser.Input.Pointer, _lx: number, _ly: number, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      this.flashButton(btn);
      onDown(p);
    });
    this.controlZones.push({ x, y, r });
    return { circle: btn, text };
  }

  /** Brighter fill and a quick pop on press, easing back to resting — the tap actually landed. */
  private flashButton(btn: Phaser.GameObjects.Arc): void {
    this.scene.tweens.killTweensOf(btn);
    btn.setScale(1.15);
    this.scene.tweens.add({ targets: btn, scale: 1, duration: 220, ease: 'Quad.easeOut' });
    this.scene.tweens.addCounter({
      from: 0.75,
      to: 0.28,
      duration: 220,
      onUpdate: (tween) => btn.setFillStyle(JOY_COLOR, tween.getValue() ?? 0.28),
    });
  }

  /** True once per ⚔ press; reading it clears the latch — GameScene strikes the nearest hunter. */
  consumeAutoAttackPressed(): boolean {
    const pressed = this.autoAttackPressed;
    this.autoAttackPressed = false;
    return pressed;
  }

  /** True once per 🦇 press; reading it clears the latch. */
  consumeDashPressed(): boolean {
    const pressed = this.dashPressed;
    this.dashPressed = false;
    return pressed;
  }

  /** True once per ⚡ press (only latches while available); reading it clears the latch. */
  consumeUltimatePressed(): boolean {
    const pressed = this.ultimatePressed;
    this.ultimatePressed = false;
    return pressed;
  }

  /** Shows/hides and enables/disables the ⚡ button — only interactive once Wrath is full. */
  setUltimateAvailable(available: boolean): void {
    if (this.ultimateAvailable === available) return;
    this.ultimateAvailable = available;
    this.ultButton.setVisible(available);
    this.ultButtonLabel.setVisible(available);
    if (available) this.ultButton.setInteractive();
    else this.ultButton.disableInteractive();
  }

  getMove(): { x: number; y: number } {
    return this.moveVec;
  }

  private onDown(pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]): void {
    if (currentlyOver.length > 0) return; // a button handled it

    // Joystick: a touch starting on/near the fixed base engages it.
    const joyDist = Math.hypot(pointer.x - this.base.x, pointer.y - this.base.y);
    if (this.joyPointerId < 0 && joyDist <= this.radius * 1.35) {
      this.joyPointerId = pointer.id;
      // Held: steady and fully lit, not blinking — the blink is the "use me"
      // tell, and it stops making that point the moment it is in use.
      this.joyBlinkTween.pause();
      this.base.setAlpha(1);
      this.thumb.setAlpha(1);
      return;
    }

    for (const z of this.controlZones) {
      if (Math.hypot(pointer.x - z.x, pointer.y - z.y) <= z.r + 8) return;
    }

    // Otherwise: strike toward the tap point, exactly like a PC left-click.
    this.callbacks.onTapAttack(pointer.worldX, pointer.worldY);
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.joyPointerId) return;
    const dx = pointer.x - this.base.x;
    const dy = pointer.y - this.base.y;
    const len = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(len, this.radius);
    const nx = dx / len;
    const ny = dy / len;
    this.thumb.setPosition(this.base.x + nx * clamped, this.base.y + ny * clamped);
    const mag = clamped / this.radius;
    this.moveVec = { x: nx * mag, y: ny * mag };
  }

  private onUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.joyPointerId) return;
    this.joyPointerId = -1;
    this.moveVec = { x: 0, y: 0 };
    this.thumb.setPosition(this.base.x, this.base.y);
    this.joyBlinkTween.resume();
  }
}
