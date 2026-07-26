import Phaser from 'phaser';
import { SCENES } from '../game/constants';
import { TEXTURES } from '../utils/assetKeys';
import { AUDIO_MANIFEST } from '../data/audioManifest';
import { createCharacterAnimations } from '../utils/animations';
import { createPlaceholderTextures } from '../utils/placeholderTextures';

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
    this.load.spritesheet(
      TEXTURES.vampireAttackMagic,
      'assets/characters/vampire/vampire_attack_magic.png',
      CHAR_FRAME,
    );
    this.load.spritesheet(TEXTURES.vampireHurt, 'assets/characters/vampire/vampire_hurt.png', CHAR_FRAME);
    this.load.spritesheet(TEXTURES.vampireDeath, 'assets/characters/vampire/vampire_death.png', CHAR_FRAME);

    // Hunters — CraftPix free male base pack, sword variant.
    this.load.spritesheet(TEXTURES.hunterIdle, 'assets/characters/humans/hunter_idle.png', CHAR_FRAME);
    this.load.spritesheet(TEXTURES.hunterWalk, 'assets/characters/humans/hunter_walk.png', CHAR_FRAME);
    this.load.spritesheet(TEXTURES.hunterRun, 'assets/characters/humans/hunter_run.png', CHAR_FRAME);
    this.load.spritesheet(TEXTURES.hunterAttack, 'assets/characters/humans/hunter_attack.png', CHAR_FRAME);
    this.load.spritesheet(TEXTURES.hunterHurt, 'assets/characters/humans/hunter_hurt.png', CHAR_FRAME);
    this.load.spritesheet(TEXTURES.hunterDeath, 'assets/characters/humans/hunter_death.png', CHAR_FRAME);

    // Garlic throwers — same pack, unarmed variant (no attack sheet exists).
    this.load.spritesheet(TEXTURES.throwerIdle, 'assets/characters/humans/thrower_idle.png', CHAR_FRAME);
    this.load.spritesheet(TEXTURES.throwerWalk, 'assets/characters/humans/thrower_walk.png', CHAR_FRAME);
    this.load.spritesheet(TEXTURES.throwerRun, 'assets/characters/humans/thrower_run.png', CHAR_FRAME);
    this.load.spritesheet(TEXTURES.throwerHurt, 'assets/characters/humans/thrower_hurt.png', CHAR_FRAME);
    this.load.spritesheet(TEXTURES.throwerDeath, 'assets/characters/humans/thrower_death.png', CHAR_FRAME);

    // Bat form (Romi's art) — 2 frames, right-facing, mirrored in code for left.
    this.load.spritesheet(TEXTURES.bat, 'assets/characters/bat/bat_fly.png', CHAR_FRAME);

    // Menu cover art — three title variants the lightning cuts between. The
    // itch.io-ratio export lives beside them but is not loaded: it is for the
    // store page, not the game.
    this.load.image(TEXTURES.coverDawn, 'assets/ui/cover/cover_dawn.jpeg');
    this.load.image(TEXTURES.coverDown, 'assets/ui/cover/cover_down.jpeg');
    this.load.image(TEXTURES.coverFlicker, 'assets/ui/cover/cover_flicker.jpeg');

    // Music and SFX (Noam) — one Phaser key per sound, several encodings per
    // key. Phaser downloads only the first format the browser can decode, so
    // the OGG/MP3 pair costs one request, not two. See data/audioManifest.ts.
    for (const asset of AUDIO_MANIFEST) {
      if (asset.files.length === 0) continue;
      this.load.audio(asset.key, [...asset.files]);
    }

    // Props — Romi's coffin (3 states) + the garlic thrown by the throwers.
    this.load.image(TEXTURES.coffinClosed, 'assets/environment/props/coffin_closed.png');
    this.load.image(TEXTURES.coffinHalf, 'assets/environment/props/coffin_half.png');
    this.load.image(TEXTURES.coffinOpen, 'assets/environment/props/coffin_open.png');
    this.load.image(TEXTURES.garlic, 'assets/environment/props/garlic.png');

    // Castle — CraftPix free top-down dungeon pack.
    this.load.image(TEXTURES.tiles, 'assets/environment/castle/walls_floor.png');
    this.load.spritesheet(TEXTURES.fire, 'assets/environment/castle/fire_animation.png', {
      frameWidth: 44,
      frameHeight: 48,
    });
  }

  create(): void {
    // After loading: generated textures only fill keys no real asset claimed.
    createPlaceholderTextures(this);
    createCharacterAnimations(this);
    this.scene.start(SCENES.game);
  }
}
