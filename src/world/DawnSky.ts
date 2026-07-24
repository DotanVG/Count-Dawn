import Phaser from 'phaser';
import { DEPTHS, GAME_WIDTH, TILE } from '../game/constants';

/**
 * The sky visible through the north-wall windows: a color-lerped night→dawn
 * gradient, stars that fade out, and a pixel sun that physically rises into
 * the window openings near the end of the night.
 *
 * Everything renders BEHIND the tilemap layer; the arch-window tiles have
 * transparent interiors, so the sky only shows through them.
 */

const SKY_HEIGHT = TILE * 3; // the north wall band

// progress 0 → 1 keyframes for the top and bottom of the gradient.
const TOP_STOPS: [number, number][] = [
  [0.0, 0x07051a], // deep night
  [0.55, 0x0d0a2e],
  [0.8, 0x2a1a4a], // pre-dawn purple
  [1.0, 0x7a3f6d], // dawn
];
const BOTTOM_STOPS: [number, number][] = [
  [0.0, 0x141033], // horizon at night
  [0.55, 0x241645],
  [0.8, 0x8a3a55], // first light
  [1.0, 0xff9a3d], // sunrise
];

function sampleStops(stops: [number, number][], t: number): number {
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [t0, c0] = stops[i - 1];
      const [t1, c1] = stops[i];
      const local = Phaser.Math.Clamp((t - t0) / (t1 - t0), 0, 1);
      const a = Phaser.Display.Color.ValueToColor(c0);
      const b = Phaser.Display.Color.ValueToColor(c1);
      const out = Phaser.Display.Color.Interpolate.ColorWithColor(a, b, 100, local * 100);
      return Phaser.Display.Color.GetColor(out.r, out.g, out.b);
    }
  }
  return stops[stops.length - 1][1];
}

export class DawnSky {
  private gradient: Phaser.GameObjects.Graphics;
  private stars: Phaser.GameObjects.Rectangle[] = [];
  private sun: Phaser.GameObjects.Container;
  private moon: Phaser.GameObjects.Container;
  private lastBucket = -1;

  constructor(scene: Phaser.Scene) {
    this.gradient = scene.add.graphics().setDepth(DEPTHS.sky);
    this.drawGradient(0);

    const rng = new Phaser.Math.RandomDataGenerator(['count-dawn-stars']);
    for (let i = 0; i < 26; i++) {
      const size = rng.pick([2, 2, 3]);
      const star = scene.add
        .rectangle(rng.between(8, GAME_WIDTH - 8), rng.between(6, SKY_HEIGHT - 30), size, size, 0xfff6d8)
        .setDepth(DEPTHS.sky + 1)
        .setAlpha(rng.realInRange(0.35, 0.9));
      scene.tweens.add({
        targets: star,
        alpha: star.alpha * 0.4,
        duration: rng.between(900, 2200),
        yoyo: true,
        repeat: -1,
      });
      this.stars.push(star);
    }

    // Chunky pixel sun: core + halo, in a container so it moves as one.
    const halo = scene.add.circle(0, 0, 30, 0xffc46b, 0.35);
    const core = scene.add.circle(0, 0, 18, 0xffe08a, 1);
    const hot = scene.add.circle(0, 0, 10, 0xfff6d8, 1);
    this.sun = scene.add.container(GAME_WIDTH / 2, SKY_HEIGHT + 80, [halo, core, hot]).setDepth(DEPTHS.sky + 2);

    // Pale pixel moon: up and framed at night start, sets before the sun rises.
    const moonHalo = scene.add.circle(0, 0, 24, 0xcfd8ff, 0.22);
    const moonBody = scene.add.circle(0, 0, 14, 0xe9edff, 1);
    const moonShade = scene.add.circle(5, -3, 11, 0x0d0716, 0.9); // crescent bite
    this.moon = scene.add
      .container(GAME_WIDTH / 2, 44, [moonHalo, moonBody, moonShade])
      .setDepth(DEPTHS.sky + 2);
  }

  /** progress: 0 at night start, 1 at dawn. Cheap; called every frame. */
  update(progress: number): void {
    progress = Phaser.Math.Clamp(progress, 0, 1);

    // Redraw the gradient only when its colors would visibly change.
    const bucket = Math.round(progress * 200);
    if (bucket !== this.lastBucket) {
      this.lastBucket = bucket;
      this.drawGradient(progress);

      const starFade = Phaser.Math.Clamp(1 - (progress - 0.45) / 0.35, 0, 1);
      for (const star of this.stars) star.setScale(starFade);
    }

    // The sun stays hidden below the wall band until ~70%, then rises into
    // the windows and sits fully framed at dawn.
    const rise = Phaser.Math.Clamp((progress - 0.7) / 0.3, 0, 1);
    const eased = 1 - Math.pow(1 - rise, 2);
    this.sun.y = SKY_HEIGHT + 80 - eased * (SKY_HEIGHT + 80 - 92);
    this.sun.x = GAME_WIDTH / 2;
    this.sun.setScale(0.8 + eased * 0.4);

    // The moon is up and visible at night start, then sinks and fades out
    // well before the sun begins its own rise (which starts at 70%).
    const moonSet = Phaser.Math.Clamp(progress / 0.55, 0, 1);
    const moonEase = moonSet * moonSet;
    this.moon.y = 44 + moonEase * (SKY_HEIGHT + 50);
    this.moon.setAlpha(1 - moonSet);
  }

  private drawGradient(progress: number): void {
    const top = sampleStops(TOP_STOPS, progress);
    const bottom = sampleStops(BOTTOM_STOPS, progress);
    this.gradient.clear();
    this.gradient.fillGradientStyle(top, top, bottom, bottom, 1);
    this.gradient.fillRect(0, 0, GAME_WIDTH, SKY_HEIGHT);
  }
}
