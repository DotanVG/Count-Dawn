import Phaser from 'phaser';
import { BAT } from '../data/balance';
import { TEXTURES, ANIMS, animKey, type CharacterKey, type Dir4 } from './assetKeys';

/**
 * Registers every character + environment animation once, after loading.
 *
 * Everything is 64x64 frames in 4 rows, one per direction, and now that the
 * bought packs are gone every sheet in the game is built by a tools/build_*.py
 * script to the SAME row order: 0 = down, 1 = up, 2 = left, 3 = right. The
 * per-pack row shuffling that used to live here went with them.
 */
const VAMPIRE_ROWS: Record<Dir4, number> = { down: 0, up: 1, left: 2, right: 3 };

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
/**
 * Full attack duration — Player holds the pose this long so it plays out
 * completely. The bite and the roar are deliberately the same length, so
 * swapping which one a click fires changes nothing about the combat's timing.
 */
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
  // The bite: his regular attack. Six frames, opening and closing on the same
  // lunge crouch.
  {
    texture: TEXTURES.vampireBite,
    action: 'bite',
    frames: VAMPIRE_ATTACK_FRAMES,
    frameRate: VAMPIRE_ATTACK_FRAME_RATE,
    repeat: 0,
  },
  // The roar: registered, loaded, and currently unbound. It is the SPECIAL, and
  // it stays here rather than being deleted because the next iteration hangs
  // the BeatEmPie lightning off it — see Player.playSpecialAttackAnim.
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
 * Every human Romi drew is a TWO-FRAME character: one pose per direction and a
 * second that differs by a step, and that pair has to cover everything the
 * Hunter base class asks a character for. So instead of a sheet per action they
 * each get ONE 2x4 sheet, and every action is the same two frames played
 * differently — `from` picks which of the pair leads, which is the whole
 * difference between standing, walking, and driving a weapon down.
 *
 * This replaced the CraftPix packs outright. Those had six sheets and twelve
 * columns each; there is no dressing that up as equivalent, and the honest
 * trade is that the hall now moves in twos and is drawn by hand.
 */
const TWO_FRAME_ROWS: Record<Dir4, number> = { down: 0, up: 1, left: 2, right: 3 };
const TWO_FRAME_COLUMNS = 2;

interface TwoFrameAction {
  action: string;
  /** Which of the pair the animation opens on. */
  from: 0 | 1;
  frameRate: number;
  repeat: number;
}

const TWO_FRAME_ACTIONS: TwoFrameAction[] = [
  // Standing: a slow shift of weight. Fast enough and two frames read as a
  // twitch rather than as breathing.
  { action: 'idle', from: 0, frameRate: 2.2, repeat: -1 },
  { action: 'walk', from: 0, frameRate: 4, repeat: -1 },
  { action: 'run', from: 0, frameRate: 6, repeat: -1 },
  // A strike reads the other way round — raised first, then driven down.
  { action: 'attack', from: 1, frameRate: 5, repeat: 0 },
  { action: 'hurt', from: 1, frameRate: 8, repeat: 0 },
  { action: 'death', from: 1, frameRate: 3, repeat: 0 },
];

/** Every one of Romi's humans, and the sheet each wears. */
const TWO_FRAME_CHARACTERS: { character: CharacterKey; texture: string }[] = [
  { character: 'pilgrim', texture: TEXTURES.pilgrim },
  { character: 'huntress', texture: TEXTURES.huntress },
  { character: 'farmer', texture: TEXTURES.farmer },
  { character: 'priest', texture: TEXTURES.priest },
];

export function createCharacterAnimations(scene: Phaser.Scene): void {
  registerSheets(scene, 'vampire', VAMPIRE_SHEETS, VAMPIRE_ROWS);
  registerCountDeath(scene);
  for (const { character, texture } of TWO_FRAME_CHARACTERS) {
    registerTwoFrame(scene, character, texture);
  }

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

function registerTwoFrame(scene: Phaser.Scene, character: CharacterKey, texture: string): void {
  for (const spec of TWO_FRAME_ACTIONS) {
    for (const dir of DIRS) {
      const key = animKey(character, spec.action, dir);
      if (scene.anims.exists(key)) continue;
      const row = TWO_FRAME_ROWS[dir] * TWO_FRAME_COLUMNS;
      const order = spec.from === 0 ? [row, row + 1] : [row + 1, row];
      scene.anims.create({
        key,
        frames: order.map((frame) => ({ key: texture, frame })),
        frameRate: spec.frameRate,
        repeat: spec.repeat,
      });
    }
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
