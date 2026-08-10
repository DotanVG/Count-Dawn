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
 * Playable arena in world pixels. The north wall band (with the sky windows)
 * and the side/bottom walls sit outside these bounds.
 *
 * Phase 1 room-replacement test: measured against Romi's flat room_bg.jpeg
 * (1280x768, stretched to the 1280x720 canvas — see CastleMap.ts) rather
 * than derived from the tile grid. left/right land almost exactly on the old
 * tile-based values; top/bottom shrink slightly to match the new floor.
 */
export const ARENA = {
  left: 64,
  right: 1216,
  top: 200,
  bottom: 620,
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
  dawn: 0xff9a3d,
} as const;

/** Render depths, back to front. */
export const DEPTHS = {
  sky: -10,
  floor: -6,
  /** Hunters walking in from off-screen: hidden behind the wall layer, above the floor. */
  enteringHunter: -4,
  wall: -2,
  coffinGlow: 3,
  coffin: 4,
  pickup: 5,
  corpse: 6,
  /** Floor-level effects: the garlic throwers' targeting crosshair. */
  groundFx: 7,
  hunter: 8,
  boss: 9,
  player: 10,
  /**
   * The wall sconces sit well above the walkable arena (y ~150 vs
   * ARENA.top 200), so this never actually competes with a hunter or the
   * Count for the same pixel — it's set above them anyway so a torch's
   * flame sheet can never be mistakenly clipped behind an entrant standing
   * near the wall band.
   */
  torch: 11,
  attackFx: 12,
  dawnOverlay: 50,
  /** Screen-space blood splatter on a big kill burst — over everything in the hall, under the HUD. */
  screenFx: 90,
  /** The Ultimate's screen darken, over the splatter too, still clear of the HUD. */
  ultOverlay: 91,
  hud: 100,
  menu: 200,
} as const;
