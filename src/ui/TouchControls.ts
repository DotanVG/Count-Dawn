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
 * auto-strikes the nearest hunter (held = keeps striking, mirroring Space on
 * desktop), a small pause button, and tap-anywhere-else to strike in that
 * direction (mirroring desktop mouse clicks). Adapted from BeatEmPie.
 */
export class TouchControls {
  private moveVec = { x: 0, y: 0 };
  private base: Phaser.GameObjects.Arc;
  private thumb: Phaser.GameObjects.Arc;
  private joyPointerId = -1;
  private attackPointerId = -1;
  private readonly radius = 92;
  private autoAttackHeld = false;
  /** Circular keep-out zones (buttons) where a tap must NOT trigger a strike. */
  private controlZones: { x: number; y: number; r: number }[] = [];

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

    // Auto-strike button: press = strike nearest, hold = keep striking.
    this.makeButton(GAME_WIDTH - 130, GAME_HEIGHT - 140, 72, '⚔', (pointer) => {
      this.attackPointerId = pointer.id;
      this.autoAttackHeld = true;
    });
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
  ): void {
    const btn = this.scene.add
      .circle(x, y, r, JOY_COLOR, 0.28)
      .setStrokeStyle(4, THUMB_COLOR, 0.8)
      .setDepth(DEPTHS.hud + 10)
      .setScrollFactor(0)
      .setInteractive();
    this.scene.add
      .text(x, y, label, { fontSize: `${Math.round(r * 0.9)}px` })
      .setOrigin(0.5)
      .setDepth(DEPTHS.hud + 11)
      .setScrollFactor(0);
    btn.on('pointerdown', (p: Phaser.Input.Pointer, _lx: number, _ly: number, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      onDown(p);
    });
    this.controlZones.push({ x, y, r });
  }

  /** True while the ⚔ button is held — GameScene auto-strikes the nearest hunter. */
  isAutoAttackHeld(): boolean {
    return this.autoAttackHeld;
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
    if (pointer.id === this.attackPointerId) {
      this.attackPointerId = -1;
      this.autoAttackHeld = false;
    }
    if (pointer.id !== this.joyPointerId) return;
    this.joyPointerId = -1;
    this.moveVec = { x: 0, y: 0 };
    this.thumb.setPosition(this.base.x, this.base.y);
  }
}
