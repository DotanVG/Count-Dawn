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
  frames: number;
  frameRate: number;
  repeat: number;
}

const VAMPIRE_ATTACK_FRAMES = 12;
const VAMPIRE_ATTACK_FRAME_RATE = 30;
/** Full swing+magic-burst duration — Player holds the attack pose this long so it plays out completely. */
export const VAMPIRE_ATTACK_DURATION_MS = (VAMPIRE_ATTACK_FRAMES / VAMPIRE_ATTACK_FRAME_RATE) * 1000;

const VAMPIRE_SHEETS: SheetSpec[] = [
  { texture: TEXTURES.vampireIdle, action: 'idle', frames: 4, frameRate: 6, repeat: -1 },
  { texture: TEXTURES.vampireWalk, action: 'walk', frames: 6, frameRate: 10, repeat: -1 },
  { texture: TEXTURES.vampireRun, action: 'run', frames: 8, frameRate: 14, repeat: -1 },
  {
    texture: TEXTURES.vampireAttack,
    action: 'attack',
    frames: VAMPIRE_ATTACK_FRAMES,
    frameRate: VAMPIRE_ATTACK_FRAME_RATE,
    repeat: 0,
  },
  { texture: TEXTURES.vampireHurt, action: 'hurt', frames: 4, frameRate: 12, repeat: 0 },
  { texture: TEXTURES.vampireDeath, action: 'death', frames: 11, frameRate: 12, repeat: 0 },
];

const HUNTER_SHEETS: SheetSpec[] = [
  { texture: TEXTURES.hunterIdle, action: 'idle', frames: 12, frameRate: 8, repeat: -1 },
  { texture: TEXTURES.hunterWalk, action: 'walk', frames: 6, frameRate: 10, repeat: -1 },
  { texture: TEXTURES.hunterRun, action: 'run', frames: 8, frameRate: 12, repeat: -1 },
  { texture: TEXTURES.hunterAttack, action: 'attack', frames: 8, frameRate: 14, repeat: 0 },
  { texture: TEXTURES.hunterHurt, action: 'hurt', frames: 5, frameRate: 14, repeat: 0 },
  { texture: TEXTURES.hunterDeath, action: 'death', frames: 7, frameRate: 10, repeat: 0 },
];

/** The unarmed variant ships no attack sheet — the throw is animated by code. */
const THROWER_SHEETS: SheetSpec[] = [
  { texture: TEXTURES.throwerIdle, action: 'idle', frames: 12, frameRate: 8, repeat: -1 },
  { texture: TEXTURES.throwerWalk, action: 'walk', frames: 6, frameRate: 10, repeat: -1 },
  { texture: TEXTURES.throwerRun, action: 'run', frames: 8, frameRate: 12, repeat: -1 },
  { texture: TEXTURES.throwerHurt, action: 'hurt', frames: 5, frameRate: 14, repeat: 0 },
  { texture: TEXTURES.throwerDeath, action: 'death', frames: 7, frameRate: 10, repeat: 0 },
];

export function createCharacterAnimations(scene: Phaser.Scene): void {
  registerSheets(scene, 'vampire', VAMPIRE_SHEETS, VAMPIRE_ROWS);
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
      const start = rows[dir] * sheet.frames;
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers(sheet.texture, {
          start,
          end: start + sheet.frames - 1,
        }),
        frameRate: sheet.frameRate,
        repeat: sheet.repeat,
      });
    }
  }
}
