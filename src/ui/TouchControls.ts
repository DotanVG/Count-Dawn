import Phaser from 'phaser';
import { DEPTHS, GAME_WIDTH, GAME_HEIGHT } from '../game/constants';

const JOY_COLOR = 0xc41e2f;
const THUMB_COLOR = 0xff4d4d;

/**
 * Shared by the live joystick and the opening hold-to-skip affordance so the
 * hand target does not jump between cinematic and gameplay.
 */
export const TOUCH_JOYSTICK = Object.freeze({
  x: 142,
  y: GAME_HEIGHT - 150,
  radius: 68,
  grabRadius: 100,
});

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
  private joyGlow: Phaser.GameObjects.Arc;
  private base: Phaser.GameObjects.Arc;
  private innerRing: Phaser.GameObjects.Arc;
  private thumb: Phaser.GameObjects.Arc;
  private thumbGlyph: Phaser.GameObjects.Text;
  private joyPointerId = -1;
  private readonly radius = TOUCH_JOYSTICK.radius;
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

    const joyX = TOUCH_JOYSTICK.x;
    const joyY = TOUCH_JOYSTICK.y;
    this.joyGlow = scene.add
      .circle(joyX, joyY, this.radius + 7, 0x1b0d26, 0.18)
      .setStrokeStyle(2, 0x6b4d8f, 0.42)
      .setDepth(DEPTHS.hud + 9)
      .setScrollFactor(0);
    this.base = scene.add
      .circle(joyX, joyY, this.radius, 0x160c20, 0.58)
      .setStrokeStyle(4, JOY_COLOR, 0.72)
      .setDepth(DEPTHS.hud + 10)
      .setScrollFactor(0);
    this.innerRing = scene.add
      .circle(joyX, joyY, this.radius * 0.62, 0x000000, 0)
      .setStrokeStyle(2, 0xc9a7ff, 0.45)
      .setDepth(DEPTHS.hud + 10)
      .setScrollFactor(0);
    this.thumb = scene.add
      .circle(joyX, joyY, 27, THUMB_COLOR, 0.58)
      .setStrokeStyle(3, 0xff9aaa, 0.9)
      .setDepth(DEPTHS.hud + 10)
      .setScrollFactor(0);
    this.thumbGlyph = scene.add
      .text(joyX, joyY, 'V', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '18px',
        color: '#f1e8ff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(DEPTHS.hud + 11)
      .setScrollFactor(0);

    // Four small notches give the control a deliberate compass/socket shape
    // without adding interactive objects that could steal combat taps.
    for (const [x, y, horizontal] of [
      [joyX, joyY - this.radius + 8, true],
      [joyX, joyY + this.radius - 8, true],
      [joyX - this.radius + 8, joyY, false],
      [joyX + this.radius - 8, joyY, false],
    ] as const) {
      scene.add
        .rectangle(x, y, horizontal ? 15 : 3, horizontal ? 3 : 15, 0xff7180, 0.75)
        .setDepth(DEPTHS.hud + 11)
        .setScrollFactor(0);
    }
    this.joyBlinkTween = scene.tweens.add({
      targets: [this.joyGlow, this.base, this.innerRing, this.thumb, this.thumbGlyph],
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
    // Far enough up-and-right that its 42px radius clears the strike
    // button's 72px one by a comfortable margin (they used to overlap).
    const ult = this.makeButton(GAME_WIDTH - 70, GAME_HEIGHT - 270, 42, '⚡', () => {
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
    if (this.joyPointerId < 0 && joyDist <= TOUCH_JOYSTICK.grabRadius) {
      this.joyPointerId = pointer.id;
      // Held: steady and fully lit, not blinking — the blink is the "use me"
      // tell, and it stops making that point the moment it is in use.
      this.joyBlinkTween.pause();
      this.joyGlow.setAlpha(1);
      this.base.setAlpha(1);
      this.innerRing.setAlpha(1);
      this.thumb.setAlpha(1);
      this.thumbGlyph.setAlpha(1);
      this.onMove(pointer);
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
    const travelRadius = this.radius * 0.58;
    const clamped = Math.min(len, travelRadius);
    const nx = dx / len;
    const ny = dy / len;
    const thumbX = this.base.x + nx * clamped;
    const thumbY = this.base.y + ny * clamped;
    this.thumb.setPosition(thumbX, thumbY);
    this.thumbGlyph.setPosition(thumbX, thumbY);
    const mag = clamped / travelRadius;
    this.moveVec = { x: nx * mag, y: ny * mag };
  }

  private onUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.joyPointerId) return;
    this.joyPointerId = -1;
    this.moveVec = { x: 0, y: 0 };
    this.thumb.setPosition(this.base.x, this.base.y);
    this.thumbGlyph.setPosition(this.base.x, this.base.y);
    this.joyBlinkTween.resume();
  }
}
