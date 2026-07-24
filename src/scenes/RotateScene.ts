import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, SCENES } from '../game/constants';

// Palette: purple phone/labels to match the castle UI, blood-red arrow.
const PHONE_COLOR = 0xc9a7ff;
const ARROW_COLOR = 0xe0364a;

// Easing helper — same curve Phaser's Sine.easeInOut uses
const sineEaseInOut = (t: number): number => -(Math.cos(Math.PI * t) - 1) / 2;

// Phone rotation cycle breakdown (ms):
//   0–990    : rotate 0° → -90° (easeInOut, counterclockwise)
//   990–1800 : hold at -90°
//   1800–2790: rotate -90° → 0°
//   2790–3150: hold at 0°
const PHONE_IN = 990;
const PHONE_HOLD_END = 1800;
const PHONE_OUT_END = 2790;
const PHONE_CYCLE = 3150;

// Arrow fill/deplete cycle (ms): 0 → 1 → 0, triangle wave
const ARROW_CYCLE = 1600;

/**
 * Fullscreen "rotate your device" overlay, launched by the orientation gate
 * when a touch device is held in portrait; stopped on landscape.
 *
 * Animation is driven by wall-clock time so it is immune to delta = 0 /
 * corrupted delta on mobile WebGL; a setInterval fallback takes over if the
 * game loop ever stops ticking. Adapted from BeatEmPie.
 */
export class RotateScene extends Phaser.Scene {
  private phoneContainer!: Phaser.GameObjects.Container;
  private arrowGfx!: Phaser.GameObjects.Graphics;
  private arrowCx = 0;
  private arrowCy = 0;

  private startTime = 0;
  private elapsed = 0;
  private arrowElapsed = 0;
  private frameCount = 0;

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastIntervalFrame = -1;

  constructor() {
    super({ key: SCENES.rotate, active: false });
  }

  create(): void {
    this.startTime = Date.now();
    this.elapsed = 0;
    this.arrowElapsed = 0;
    this.frameCount = 0;

    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x0d0716, 0.97);

    // Violet radial glow (faked with stacked low-alpha circles)
    for (let i = 5; i >= 1; i--) {
      this.add.circle(cx, cy - 40, 220 * (i / 5), 0x3a215c, 0.05 * i);
    }

    // Phone shape — drawn on a container so rotation works as a unit
    const phoneW = 110;
    const phoneH = 200;

    const phoneGfx = this.make.graphics({}, false);
    phoneGfx.lineStyle(6, PHONE_COLOR, 1);
    phoneGfx.fillStyle(PHONE_COLOR, 0.08);
    phoneGfx.fillRoundedRect(-phoneW / 2, -phoneH / 2, phoneW, phoneH, 14);
    phoneGfx.strokeRoundedRect(-phoneW / 2, -phoneH / 2, phoneW, phoneH, 14);

    const sw = phoneW * 0.72;
    const sh = phoneH * 0.58;
    phoneGfx.fillStyle(PHONE_COLOR, 0.14);
    phoneGfx.fillRoundedRect(-sw / 2, -sh / 2 + 8, sw, sh, 6);

    phoneGfx.fillStyle(PHONE_COLOR, 0.85);
    phoneGfx.fillRoundedRect(-16, -phoneH / 2 + 10, 32, 6, 3);
    phoneGfx.fillCircle(0, phoneH / 2 - 15, 8);

    this.phoneContainer = this.add.container(cx, cy - 40, [phoneGfx]);

    // Curved rotation arrow — arc length animated via progressive fill
    this.arrowCx = cx;
    this.arrowCy = cy - 40;
    this.arrowGfx = this.add.graphics();

    this.add
      .text(cx, cy + 140, 'Rotate your device', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '48px',
        color: '#c9a7ff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.add
      .text(cx, cy + 205, 'Count Dawn plays best in landscape 🦇', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '28px',
        color: '#e8ddff',
      })
      .setOrigin(0.5)
      .setAlpha(0.72);

    // setInterval fallback: yields to update() whenever the game loop is
    // healthy (frameCount advances), drives the animation directly otherwise.
    this.lastIntervalFrame = -1;
    this.intervalId = setInterval(() => this.intervalTick(), 16);

    this.events.once('shutdown', () => this.clearFallback());

    this.scene.bringToTop();
  }

  update(): void {
    this.frameCount++;
    const wallMs = Date.now() - this.startTime;
    this.elapsed = wallMs % PHONE_CYCLE;
    this.arrowElapsed = wallMs % ARROW_CYCLE;
    this.applyAnimation();
  }

  private intervalTick(): void {
    if (this.frameCount !== this.lastIntervalFrame) {
      this.lastIntervalFrame = this.frameCount;
      return;
    }
    const wallMs = Date.now() - this.startTime;
    this.elapsed = wallMs % PHONE_CYCLE;
    this.arrowElapsed = wallMs % ARROW_CYCLE;
    this.applyAnimation();
  }

  private computeAngle(t: number): number {
    if (t < PHONE_IN) return sineEaseInOut(t / PHONE_IN) * -90;
    if (t < PHONE_HOLD_END) return -90;
    if (t < PHONE_OUT_END) {
      return (1 - sineEaseInOut((t - PHONE_HOLD_END) / (PHONE_OUT_END - PHONE_HOLD_END))) * -90;
    }
    return 0;
  }

  private applyAnimation(): void {
    this.phoneContainer.setAngle(this.computeAngle(this.elapsed));
    const at = this.arrowElapsed / ARROW_CYCLE;
    const fillT = at < 0.5 ? at * 2 : 2 - at * 2;
    this.drawRotationArrow(this.arrowGfx, this.arrowCx, this.arrowCy, fillT);
  }

  private clearFallback(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Counterclockwise "hat" arc from upper-right through the top to upper-left,
   * progressively filled by `fillT` (0–1), arrowhead tracking the fill front.
   */
  private drawRotationArrow(g: Phaser.GameObjects.Graphics, cx: number, cy: number, fillT: number): void {
    const radius = 150;
    const arcCy = cy + 14;

    const destDeg = 222;
    const originDeg = 318;
    const currentDeg = originDeg - fillT * (originDeg - destDeg);

    const currentRad = Phaser.Math.DegToRad(currentDeg);
    const originRad = Phaser.Math.DegToRad(originDeg);

    g.clear();
    g.lineStyle(6, ARROW_COLOR, 1);

    g.beginPath();
    g.arc(cx, arcCy, radius, currentRad, originRad, false);
    g.strokePath();

    const ax = cx + radius * Math.cos(currentRad);
    const ay = arcCy + radius * Math.sin(currentRad);
    const tangent = currentRad - Math.PI / 2;
    const headLen = 24;
    const spread = 0.42;

    g.beginPath();
    g.moveTo(ax - headLen * Math.cos(tangent - spread), ay - headLen * Math.sin(tangent - spread));
    g.lineTo(ax, ay);
    g.lineTo(ax - headLen * Math.cos(tangent + spread), ay - headLen * Math.sin(tangent + spread));
    g.strokePath();
  }
}
