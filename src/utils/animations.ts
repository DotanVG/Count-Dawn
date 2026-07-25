import Phaser from 'phaser';
import { BAT } from '../data/balance';
import { TEXTURES, ANIMS, animKey, type CharacterKey, type Dir4 } from './assetKeys';

/**
 * Registers every character + environment animation once, after loading.
 *
 * All packs use 64x64 frames in 4 rows (one per direction) but with
 * DIFFERENT row orders, verified pixel-by-pixel from the sheets:
 *   vampire: row 0 = down, 1 = up,   2 = left, 3 = right
 *   hunter:  row 0 = down, 1 = left, 2 = right, 3 = up
 *   thrower: same base pack as the hunter (unarmed variant) — same row order,
 *            re-verified on the unarmed sheets rather than assumed.
 */
const VAMPIRE_ROWS: Record<Dir4, number> = { down: 0, up: 1, left: 2, right: 3 };
const HUNTER_ROWS: Record<Dir4, number> = { down: 0, left: 1, right: 2, up: 3 };
const THROWER_ROWS: Record<Dir4, number> = HUNTER_ROWS;

const DIRS: Dir4[] = ['down', 'up', 'left', 'right'];

interface SheetSpec {
  texture: string;
  action: string;
  /** Columns in the sheet — also the stride from one direction's row to the next. */
  frames: number;
  frameRate: number;
  repeat: number;
  /**
   * Directions whose row holds FEWER real frames than the sheet is wide,
   * because the pack left the rest of that row transparent. Playing the whole
   * row blinks the character out of existence for the padding frames — see
   * the note on HUNTER_SHEETS' idle entry for the one case that ships.
   */
  shortRows?: Partial<Record<Dir4, number>>;
}

const VAMPIRE_ATTACK_FRAMES = 6;
const VAMPIRE_ATTACK_FRAME_RATE = 15;
/** Full swing+magic-burst duration — Player holds the attack pose this long so it plays out completely. */
export const VAMPIRE_ATTACK_DURATION_MS = (VAMPIRE_ATTACK_FRAMES / VAMPIRE_ATTACK_FRAME_RATE) * 1000;

/**
 * Romi drew the Count's run facing LEFT and nothing else, so the rows toward
 * and away from the camera are made of far fewer real frames than the sheet is
 * wide (see tools/build_count_sheets.py for exactly what stands in for what).
 * Declaring them here is what stops the padding from blinking him out of
 * existence, and `registerSheets` slows a short loop to the full row's cycle
 * length so all four directions keep the same stride.
 */
const COUNT_RUN_SHORT_ROWS: Partial<Record<Dir4, number>> = { down: 4, up: 4 };

const VAMPIRE_SHEETS: SheetSpec[] = [
  // Two frames: the drawing, and the drawing one pixel lower. Slow, because at
  // any speed at all a two-frame loop reads as a twitch rather than breathing.
  { texture: TEXTURES.vampireIdle, action: 'idle', frames: 2, frameRate: 1.6, repeat: -1 },
  {
    texture: TEXTURES.vampireRun,
    action: 'run',
    frames: 6,
    frameRate: 12,
    repeat: -1,
    shortRows: COUNT_RUN_SHORT_ROWS,
  },
  {
    texture: TEXTURES.vampireAttack,
    action: 'attack',
    frames: VAMPIRE_ATTACK_FRAMES,
    frameRate: VAMPIRE_ATTACK_FRAME_RATE,
    repeat: 0,
  },
];

/**
 * The death sheet is seven frames wide and feeds TWO animations, because how
 * the Count dies depends on what killed him:
 *
 *   `death`   — frames 0-2, the fall. A hunter got him; he goes down and stays
 *               down while the game-over screen comes up.
 *   `sunburn` — the fall, then the burning pair beaten against each other,
 *               then the ash pair. Only the sunrise does this to him.
 */
const COUNT_DEATH_FRAMES = 7;
const COUNT_FALL = [0, 1, 2];
const COUNT_SUNBURN = [...COUNT_FALL, 3, 4, 3, 4, 3, 4, 5, 6, 5, 6, 5, 6];
const COUNT_FALL_FRAME_RATE = 6;
const COUNT_SUNBURN_FRAME_RATE = 8;
/** How long playSunburnAnim runs for — GameScene paces the dawn ending off it. */
export const VAMPIRE_SUNBURN_DURATION_MS =
  (COUNT_SUNBURN.length / COUNT_SUNBURN_FRAME_RATE) * 1000;

/**
 * The pack's idle sheet is 12 columns wide, but the BACK-TURNED row only holds
 * four painted frames — columns 4-11 of that row are fully transparent. Played
 * as a 12-frame loop the hunter vanished for a solid second out of every one
 * and a half whenever he stood still facing away from the camera. It was most
 * obvious on the garlic thrower, whose carried bulb is a separate image and so
 * kept hovering there on its own with no one holding it.
 */
const IDLE_BACK_TURNED_FRAMES: Partial<Record<Dir4, number>> = { up: 4 };

const HUNTER_SHEETS: SheetSpec[] = [
  {
    texture: TEXTURES.hunterIdle,
    action: 'idle',
    frames: 12,
    frameRate: 8,
    repeat: -1,
    shortRows: IDLE_BACK_TURNED_FRAMES,
  },
  { texture: TEXTURES.hunterWalk, action: 'walk', frames: 6, frameRate: 10, repeat: -1 },
  { texture: TEXTURES.hunterRun, action: 'run', frames: 8, frameRate: 12, repeat: -1 },
  { texture: TEXTURES.hunterAttack, action: 'attack', frames: 8, frameRate: 14, repeat: 0 },
  { texture: TEXTURES.hunterHurt, action: 'hurt', frames: 5, frameRate: 14, repeat: 0 },
  { texture: TEXTURES.hunterDeath, action: 'death', frames: 7, frameRate: 10, repeat: 0 },
];

/** The unarmed variant ships no attack sheet — the throw is animated by code. */
const THROWER_SHEETS: SheetSpec[] = [
  {
    texture: TEXTURES.throwerIdle,
    action: 'idle',
    frames: 12,
    frameRate: 8,
    repeat: -1,
    shortRows: IDLE_BACK_TURNED_FRAMES, // same pack, same padded back row
  },
  { texture: TEXTURES.throwerWalk, action: 'walk', frames: 6, frameRate: 10, repeat: -1 },
  { texture: TEXTURES.throwerRun, action: 'run', frames: 8, frameRate: 12, repeat: -1 },
  { texture: TEXTURES.throwerHurt, action: 'hurt', frames: 5, frameRate: 14, repeat: 0 },
  { texture: TEXTURES.throwerDeath, action: 'death', frames: 7, frameRate: 10, repeat: 0 },
];

export function createCharacterAnimations(scene: Phaser.Scene): void {
  registerSheets(scene, 'vampire', VAMPIRE_SHEETS, VAMPIRE_ROWS);
  registerCountDeath(scene);
  registerSheets(scene, 'hunter', HUNTER_SHEETS, HUNTER_ROWS);
  registerSheets(scene, 'thrower', THROWER_SHEETS, THROWER_ROWS);

  // Bat form: Romi's two hand-painted frames, wings up then wings spread,
  // registered on the eyes so only the wings move. Unlike every character
  // sheet above there are no directional rows — the bat is drawn facing RIGHT
  // and Player mirrors it with flipX, so one animation serves all directions.
  if (!scene.anims.exists(ANIMS.batFly)) {
    scene.anims.create({
      key: ANIMS.batFly,
      frames: scene.anims.generateFrameNumbers(TEXTURES.bat, { start: 0, end: BAT.flapFrames - 1 }),
      frameRate: BAT.flapFrameRate,
      repeat: -1,
    });
  }

  // Wall torch: fire_animation.png is a 4-column grid (44x48 frames) where
  // each COLUMN is one prop and each row is the next flame frame.
  // Column 1 = the wall sconce; its frames are indices 1, 5, 9, ...
  if (!scene.anims.exists(ANIMS.torch)) {
    scene.anims.create({
      key: ANIMS.torch,
      frames: [1, 5, 9, 13, 17, 21].map((frame) => ({ key: TEXTURES.fire, frame })),
      frameRate: 10,
      repeat: -1,
    });
  }

  // Hit-impact burst: the magic-only overlay layer from the vampire attack
  // sheet (down row), frames 6-10 — the charge-burst-to-star-to-fade beat,
  // spawned standalone at a hunter's position on every landed strike.
  if (!scene.anims.exists(ANIMS.hitMagic)) {
    scene.anims.create({
      key: ANIMS.hitMagic,
      frames: scene.anims.generateFrameNumbers(TEXTURES.vampireAttackMagic, { start: 6, end: 10 }),
      frameRate: 20,
      repeat: 0,
    });
  }

  // The Count's own cast: the earlier half of the same layer — the skull
  // gathering and bursting — thrown out along his aim as the swing starts.
  // Its length is tied to the swing's so the spell and the pose end together.
  if (!scene.anims.exists(ANIMS.castFlare)) {
    scene.anims.create({
      key: ANIMS.castFlare,
      frames: scene.anims.generateFrameNumbers(TEXTURES.vampireAttackMagic, { start: 3, end: 8 }),
      frameRate: VAMPIRE_ATTACK_FRAME_RATE,
      repeat: 0,
    });
  }
}

/** Both ways the Count can end, cut from the one seven-frame death sheet. */
function registerCountDeath(scene: Phaser.Scene): void {
  const build = (action: string, sequence: number[], frameRate: number, dir: Dir4) => {
    const key = animKey('vampire', action, dir);
    if (scene.anims.exists(key)) return;
    const row = VAMPIRE_ROWS[dir] * COUNT_DEATH_FRAMES;
    scene.anims.create({
      key,
      frames: sequence.map((frame) => ({ key: TEXTURES.vampireDeath, frame: row + frame })),
      frameRate,
      repeat: 0,
    });
  };

  for (const dir of DIRS) {
    build('death', COUNT_FALL, COUNT_FALL_FRAME_RATE, dir);
    build('sunburn', COUNT_SUNBURN, COUNT_SUNBURN_FRAME_RATE, dir);
  }
}

function registerSheets(
  scene: Phaser.Scene,
  character: CharacterKey,
  sheets: SheetSpec[],
  rows: Record<Dir4, number>,
): void {
  for (const sheet of sheets) {
    for (const dir of DIRS) {
      const key = animKey(character, sheet.action, dir);
      if (scene.anims.exists(key)) continue;
      // The row always starts a full sheet-width in, even when the painted
      // frames run out early — the padding is at the END of the short row.
      const start = rows[dir] * sheet.frames;
      const count = sheet.shortRows?.[dir] ?? sheet.frames;
      // A short LOOP is slowed to match the full rows' cycle length, so the
      // back-turned idle keeps breathing at the same pace as the others
      // instead of twitching through four frames three times as fast.
      const looping = sheet.repeat === -1;
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers(sheet.texture, {
          start,
          end: start + count - 1,
        }),
        frameRate: looping ? (sheet.frameRate * count) / sheet.frames : sheet.frameRate,
        repeat: sheet.repeat,
      });
    }
  }
}
