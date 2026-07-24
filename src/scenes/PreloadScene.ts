import Phaser from 'phaser';
import { SCENES } from '../game/constants';
import { TEXTURES } from '../utils/assetKeys';
import { createCharacterAnimations } from '../utils/animations';

const CHAR_FRAME = { frameWidth: 64, frameHeight: 64 };

/** Loads all real assets and registers the shared animations. */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SCENES.preload);
  }

  preload(): void {
    // Vampire (player) — CraftPix free vampire pack, character 1.
    this.load.spritesheet(TEXTURES.vampireIdle, 'assets/characters/vampire/vampire_idle.png', CHAR_FRAME);
    this.load.spritesheet(TEXTURES.vampireWalk, 'assets/characters/vampire/vampire_walk.png', CHAR_FRAME);
    this.load.spritesheet(TEXTURES.vampireRun, 'assets/characters/vampire/vampire_run.png', CHAR_FRAME);
    this.load.spritesheet(TEXTURES.vampireAttack, 'assets/characters/vampire/vampire_attack.png', CHAR_FRAME);
    this.load.spritesheet(TEXTURES.vampireHurt, 'assets/characters/vampire/vampire_hurt.png', CHAR_FRAME);
    this.load.spritesheet(TEXTURES.vampireDeath, 'assets/characters/vampire/vampire_death.png', CHAR_FRAME);

    // Hunters — CraftPix free male base pack, sword variant.
    this.load.spritesheet(TEXTURES.hunterIdle, 'assets/characters/humans/hunter_idle.png', CHAR_FRAME);
    this.load.spritesheet(TEXTURES.hunterWalk, 'assets/characters/humans/hunter_walk.png', CHAR_FRAME);
    this.load.spritesheet(TEXTURES.hunterRun, 'assets/characters/humans/hunter_run.png', CHAR_FRAME);
    this.load.spritesheet(TEXTURES.hunterAttack, 'assets/characters/humans/hunter_attack.png', CHAR_FRAME);
    this.load.spritesheet(TEXTURES.hunterHurt, 'assets/characters/humans/hunter_hurt.png', CHAR_FRAME);
    this.load.spritesheet(TEXTURES.hunterDeath, 'assets/characters/humans/hunter_death.png', CHAR_FRAME);

    // Menu / itch cover art.
    this.load.image(TEXTURES.cover, 'assets/ui/count_dawn_cover.jpeg');

    // Castle — CraftPix free top-down dungeon pack.
    this.load.image(TEXTURES.tiles, 'assets/environment/castle/walls_floor.png');
    this.load.spritesheet(TEXTURES.fire, 'assets/environment/castle/fire_animation.png', {
      frameWidth: 44,
      frameHeight: 48,
    });
  }

  create(): void {
    createCharacterAnimations(this);
    this.scene.start(SCENES.game);
  }
}
