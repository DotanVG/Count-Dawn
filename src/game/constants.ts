/** Displayed game title and metadata — rename the game from this one place. */
export const GAME_TITLE = 'Count Dawn';
export const GAME_TAGLINE = 'Hunt the hunters. Fill your veins. Beat the sunrise.';
/** Menu tagline, typed/erased one sentence at a time. */
export const TAGLINE_SENTENCES = ['Hunt the hunters', 'Fill your veins', 'Beat the sunrise'] as const;

/** Stable internal resolution; the canvas is fitted to the window by Phaser Scale.FIT. */
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

/** Dungeon tileset: 16px tiles rendered at 4x → 64px on screen. */
export const TILE_SOURCE = 16;
export const TILE_SCALE = 4;
export const TILE = TILE_SOURCE * TILE_SCALE;

/** Tile-grid size of the castle hall. */
export const MAP_COLS = GAME_WIDTH / TILE; // 20
export const MAP_ROWS = 12;

/**
 * Playable arena in world pixels. The north wall band (3 tile rows, with the
 * sky windows) and the 1-tile side/bottom walls sit outside these bounds.
 */
export const ARENA = {
  left: TILE,
  right: GAME_WIDTH - TILE,
  top: TILE * 3,
  bottom: TILE * 10,
} as const;

export const SCENES = {
  boot: 'BootScene',
  preload: 'PreloadScene',
  game: 'GameScene',
  pause: 'PauseScene',
  gameOver: 'GameOverScene',
  victory: 'VictoryScene',
} as const;

/** Screen anchors the gameplay layer needs to aim effects at (bar fill edges). */
export const HUD_ANCHORS = {
  healthBar: { x: 130, y: 24 },
  bloodBar: { x: GAME_WIDTH - 130, y: 24 },
} as const;

export const COLORS = {
  nightSky: 0x0d0716,
  blood: 0xc41e2f,
  coffin: 0x241830,
  coffinOutline: 0x6b4d8f,
  coffinActive: 0xc9a7ff,
  attackArc: 0xff5f7a,
  dawn: 0xff9a3d,
} as const;

/** Render depths, back to front. */
export const DEPTHS = {
  sky: -10,
  map: 0,
  torch: 2,
  coffinGlow: 3,
  coffin: 4,
  pickup: 5,
  corpse: 6,
  hunter: 8,
  boss: 9,
  player: 10,
  attackFx: 12,
  dawnOverlay: 50,
  hud: 100,
  menu: 200,
} as const;
