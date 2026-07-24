/** Displayed game title and metadata — rename the game from this one place. */
export const GAME_TITLE = 'Count Dawn';
export const GAME_TAGLINE = 'Hunt the hunters. Fill your veins. Beat the sunrise.';

/** Stable internal resolution; the canvas is fitted to the window by Phaser Scale.FIT. */
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

/** Thickness of the castle wall boundary around the arena. */
export const WALL_THICKNESS = 24;

export const SCENES = {
  boot: 'BootScene',
  preload: 'PreloadScene',
  mainMenu: 'MainMenuScene',
  game: 'GameScene',
  pause: 'PauseScene',
  gameOver: 'GameOverScene',
  victory: 'VictoryScene',
} as const;

export const COLORS = {
  nightSky: 0x0d0716,
  arenaFloor: 0x1a1226,
  wall: 0x2b1d3a,
  vampire: 0x7a3df0,
  vampireOutline: 0xc9a7ff,
  hunter: 0xd8cdb4,
  boss: 0x8a6b2f,
  bossOutline: 0xffd76b,
  blood: 0xc41e2f,
  coffin: 0x241830,
  coffinOutline: 0x6b4d8f,
  coffinActive: 0xc9a7ff,
  attackArc: 0xff5f7a,
  dawn: 0xff9a3d,
  uiText: 0xe8ddff,
} as const;
