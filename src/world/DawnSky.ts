import Phaser from 'phaser';
import { DEPTHS, GAME_WIDTH, TILE } from '../game/constants';

/**
 * The sky visible through the north-wall windows: a color-lerped night→dawn
 * gradient, stars that fade out, a pixel sun that physically rises into the
 * window openings near the end of the night, and a moon that carries a real
 * lunar phase which advances one night at a time.
 *
 * Everything renders BEHIND the tilemap layer; the arch-window tiles have
 * transparent interiors, so the sky only shows through them.
 */

const SKY_HEIGHT = TILE * 3; // the north wall band

/** Nights in one full lunar cycle - full, waning to new, waxing back to full. */
export const LUNAR_CYCLE_NIGHTS = 30;

const MOON_RADIUS = 14;

/**
 * Both bodies travel one shared arc across the windows, east to west, on a
 * single 24h clock: `cycle` 0 is the start of the night, 0.5 is sunrise, 1 is
 * the following nightfall. Night and day are two windows onto the same clock,
 * which is the whole point - there is exactly one sun and one moon in the
 * scene, each visible only over its own stretch of the cycle, so no arrangement
 * of tweens can ever put two of either on screen at once.
 */
/**
 * The arc is cut to the three windows rather than to the canvas. CastleMap
 * puts them at tile columns 3, 9 and 15, two tiles wide, so their world-x
 * centres are 256, 640 and 1024: a body rises inside the LEFT window, crosses
 * the MIDDLE one at the top of its arc, and sets inside the RIGHT one. The
 * arc is deliberately shallow - peaking above the windows would hide the
 * middle of every crossing behind the wall stone, which is exactly what a
 * canvas-width arc did.
 */
const ARC_LEFT = 210; // inside the left window's 192..320 span
const ARC_RIGHT = 1070; // inside the right window's 960..1088 span
const HORIZON_Y = 178; // bottom of the window openings
const PEAK_Y = 88; // clear of the arch stone at the top

/**
 * Cycle span each body is above the horizon for. The sun rises a little before
 * the night formally ends, which is what makes dawn dawn.
 *
 * Both spans END exactly where their half of the clock does, and that is load
 * bearing. The sun used to run to 1.02, so the day cycle stopped at 96% of its
 * arc and the sun simply blinked out still well short of the right window
 * instead of setting. The moon used to start at 0.93, which put it 12% along
 * its arc — already past the left window — at the instant a night began. A
 * body should enter at one window and leave at the other, with nothing popping.
 */
const SUN_UP = { from: 0.44, to: 1.0 };
/** The moon is up across midnight, so its span wraps past 1 back to 0. */
const MOON_UP = { from: 1.0, to: 1.5 };

/**
 * How far below the horizon a body sinks (or, symmetrically, starts from)
 * at either end of its arc, and over what fraction of the arc that extra
 * drop plays out.
 *
 * DROP_ZONE is wider than FADE_ZONE and runs first: the body spends most of
 * the closing (or opening) sliver of its arc sinking below the window's
 * visible opening at FULL alpha, and only fades once it is already mostly
 * hidden there — which is what makes it disappear (or appear) below the
 * sill instead of fading out while still framed inside the opening. The sun
 * used to fade to alpha 0 with its centre sitting exactly on HORIZON_Y,
 * which is still inside the window's transparent cut-out — visibly fading
 * out mid-air rather than setting.
 */
const SET_DROP = 46;
const DROP_ZONE = 0.08;
const FADE_ZONE = 0.025;

/** Position along a rising-and-setting arc for t in 0..1, plus a visibility fade. */
function arcPoint(t: number): { x: number; y: number; alpha: number; lift: number } {
  const clamped = Phaser.Math.Clamp(t, 0, 1);
  const lift = Math.sin(clamped * Math.PI);
  // Distance from whichever edge (0 or 1) is nearer — 0 at either edge, 0.5
  // mid-arc — so the same formula handles the rise (near t=0) and the set
  // (near t=1) symmetrically.
  const edgeT = Math.min(clamped, 1 - clamped);
  const dropFrac = Phaser.Math.Clamp(1 - edgeT / DROP_ZONE, 0, 1);
  return {
    x: Phaser.Math.Linear(ARC_LEFT, ARC_RIGHT, t),
    y: HORIZON_Y - lift * (HORIZON_Y - PEAK_Y) + dropFrac * SET_DROP,
    // Only fades once well into the drop (FADE_ZONE < DROP_ZONE), so the body
    // is already below the sill, mostly opaque, before it starts vanishing.
    alpha: Phaser.Math.Clamp(edgeT / FADE_ZONE, 0, 1),
    lift,
  };
}

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

// The daytime half of the cycle, played only between nights: dawn climbs to
// a bright noon sky, then falls back through sunset into the new night.
const DAY_TOP_STOPS: [number, number][] = [
  [0.0, 0x7a3f6d], // dawn, where the night's gradient left off
  [0.3, 0x4a8fd0],
  [0.5, 0x63b3ff], // noon
  [0.7, 0x9a5a8a],
  [1.0, 0x07051a], // back to deep night
];
const DAY_BOTTOM_STOPS: [number, number][] = [
  [0.0, 0xff9a3d], // sunrise
  [0.3, 0x9fd0f0],
  [0.5, 0xcfe9ff], // noon haze
  [0.7, 0xff7a3d], // sunset
  [1.0, 0x141033],
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
  private moonLit: Phaser.GameObjects.Graphics;
  private moonHalo: Phaser.GameObjects.Arc;
  private lastBucket = -1;
  private phaseNight = 1;

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
    this.sun = scene.add.container(ARC_LEFT, HORIZON_Y, [halo, core, hot]).setDepth(DEPTHS.sky + 2);

    // The moon is drawn rather than composed from circles: only the sunlit
    // part is ever painted, so the dark limb is genuinely absent instead of
    // being a dark disc pasted over the sky (which is what the old crescent
    // "bite" circle was, and why it only ever produced one fixed shape).
    this.moonHalo = scene.add.circle(0, 0, 24, 0xcfd8ff, 0.22);
    this.moonLit = scene.add.graphics();
    this.moon = scene.add
      .container(ARC_LEFT, HORIZON_Y, [this.moonHalo, this.moonLit])
      .setDepth(DEPTHS.sky + 2);
    this.setNight(this.phaseNight);
    this.renderCycle(0);
  }

  /**
   * Sets which night's moon to show. Night 1 is full; the moon then wanes to
   * new around night 15 and waxes back to full over LUNAR_CYCLE_NIGHTS, so
   * every night in the cycle gets its own distinct shape and lit side.
   */
  setNight(night: number): void {
    this.phaseNight = night;
    this.drawMoonPhase(night);
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

    // The night is the first half of the 24h cycle.
    this.renderCycle(progress * 0.5);
  }

  /**
   * The daylight half of the cycle, played between nights: t runs 0 at the
   * dawn the night ended on, through noon at 0.5, to full dark at 1. The sun
   * crosses the windows west-ward and sets; the moon then rises on the other
   * side wearing the NEXT night's phase.
   *
   * Callers drive this instead of update() for the whole transition - the two
   * would otherwise fight over the same gradient and sun.
   */
  updateDayCycle(t: number): void {
    t = Phaser.Math.Clamp(t, 0, 1);

    const bucket = 1000 + Math.round(t * 200);
    if (bucket !== this.lastBucket) {
      this.lastBucket = bucket;
      const top = sampleStops(DAY_TOP_STOPS, t);
      const bottom = sampleStops(DAY_BOTTOM_STOPS, t);
      this.gradient.clear();
      this.gradient.fillGradientStyle(top, top, bottom, bottom, 1);
      this.gradient.fillRect(0, 0, GAME_WIDTH, SKY_HEIGHT);

      // Stars are washed out all day and come back with the dark.
      const starFade = Phaser.Math.Clamp((t - 0.78) / 0.22, 0, 1);
      for (const star of this.stars) star.setScale(starFade);
    }

    // The day is the second half of the same 24h cycle - the sun simply
    // carries on along the arc it was already climbing at sunrise.
    this.renderCycle(0.5 + t * 0.5);
  }

  /** Puts the sun/moon/stars back to their night-start state after a day cycle. */
  resetToNightStart(): void {
    this.lastBucket = -1;
    for (const star of this.stars) star.setScale(1);
    this.renderCycle(0);
  }

  /**
   * Places both bodies for a point on the 24h clock. This is the ONLY code
   * that positions the sun or the moon; night and day both route through it,
   * so the two can never disagree about where either one is.
   */
  private renderCycle(cycle: number): void {
    const sunT = (cycle - SUN_UP.from) / (SUN_UP.to - SUN_UP.from);
    const sunUp = sunT >= 0 && sunT <= 1;
    this.sun.setVisible(sunUp);
    if (sunUp) {
      const p = arcPoint(sunT);
      this.sun.setPosition(p.x, p.y).setAlpha(p.alpha).setScale(1.15 - p.lift * 0.3);
    }

    // The moon's window wraps past the end of the cycle, so a point early in
    // the night is also a point late in the previous day's span.
    const wrapped = cycle < MOON_UP.to - 1 ? cycle + 1 : cycle;
    const moonT = (wrapped - MOON_UP.from) / (MOON_UP.to - MOON_UP.from);
    const moonUp = moonT >= 0 && moonT <= 1;
    this.moon.setVisible(moonUp);
    if (moonUp) {
      const p = arcPoint(moonT);
      this.moon.setPosition(p.x, p.y).setAlpha(p.alpha);
    }
  }

  /**
   * Paints only the sunlit sliver of the moon for the given night.
   *
   * The lit region is bounded by two curves that share their end points at
   * the poles: the outer limb (a half circle on the lit side) and the
   * terminator (a half ellipse whose x-radius is R * (1 - 2k) for
   * illuminated fraction k). When that radius is positive the terminator
   * bows toward the lit side and the result is a crescent; when it is
   * negative it bows away and the result is gibbous; at k = 0.5 it is a
   * straight line and the moon reads as a clean half. That is the same
   * construction the real terminator follows, which is why the shapes look
   * right rather than like a disc with a bite taken out of it.
   *
   * Lit side follows the northern-hemisphere convention: waning moons are
   * lit on the left, waxing moons on the right.
   */
  private drawMoonPhase(night: number): void {
    const index = ((night - 1) % LUNAR_CYCLE_NIGHTS + LUNAR_CYCLE_NIGHTS) % LUNAR_CYCLE_NIGHTS;
    const phaseAngle = (index / LUNAR_CYCLE_NIGHTS) * Math.PI * 2; // 0 = full
    const illuminated = (1 + Math.cos(phaseAngle)) / 2;
    // First half of the cycle is waning (lit on the left), second half waxing.
    const litSide = phaseAngle <= Math.PI ? -1 : 1;
    const terminatorX = MOON_RADIUS * (1 - 2 * illuminated) * litSide;

    this.moonHalo.setAlpha(0.06 + 0.2 * illuminated);

    this.moonLit.clear();
    if (illuminated < 0.02) return; // new moon: nothing is lit

    const steps = 48;
    const points: Phaser.Math.Vector2[] = [];
    // Outer limb, pole to pole down the lit side.
    for (let i = 0; i <= steps; i++) {
      const a = -Math.PI / 2 + (i / steps) * Math.PI;
      points.push(
        new Phaser.Math.Vector2(litSide * MOON_RADIUS * Math.cos(a), MOON_RADIUS * Math.sin(a)),
      );
    }
    // Terminator, back up to where we started.
    for (let i = steps; i >= 0; i--) {
      const a = -Math.PI / 2 + (i / steps) * Math.PI;
      points.push(new Phaser.Math.Vector2(terminatorX * Math.cos(a), MOON_RADIUS * Math.sin(a)));
    }

    this.moonLit.fillStyle(0xe9edff, 1);
    this.moonLit.fillPoints(points, true);
  }

  private drawGradient(progress: number): void {
    const top = sampleStops(TOP_STOPS, progress);
    const bottom = sampleStops(BOTTOM_STOPS, progress);
    this.gradient.clear();
    this.gradient.fillGradientStyle(top, top, bottom, bottom, 1);
    this.gradient.fillRect(0, 0, GAME_WIDTH, SKY_HEIGHT);
  }
}
