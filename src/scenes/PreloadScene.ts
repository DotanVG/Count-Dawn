import Phaser from 'phaser';
import { SCENES } from '../game/constants';
import { TEXTURES } from '../utils/assetKeys';
import { AUDIO_MANIFEST } from '../data/audioManifest';
import { createCharacterAnimations } from '../utils/animations';
import { createPlaceholderTextures } from '../utils/placeholderTextures';

const CHAR_FRAME = { frameWidth: 64, frameHeight: 64 };
/** Temp load key for room_bg.jpeg before chroma-keying replaces it under TEXTURES.roomBg. */
const ROOM_BG_RAW = 'castle-room-bg-raw';

/** Loads all real assets and registers the shared animations. */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SCENES.preload);
  }

  preload(): void {
    // The Count (player) — Romi's art, built by tools/build_count_sheets.py.
    this.load.spritesheet(TEXTURES.vampireIdle, 'assets/characters/vampire/vampire_idle.png', CHAR_FRAME);
    this.load.spritesheet(TEXTURES.vampireRun, 'assets/characters/vampire/vampire_run.png', CHAR_FRAME);
    this.load.spritesheet(TEXTURES.vampireBite, 'assets/characters/vampire/vampire_bite.png', CHAR_FRAME);
    // The roar. Loaded but not currently bound to an input — it is the special,
    // waiting on the lightning (see Player.playSpecialAttackAnim).
    this.load.spritesheet(TEXTURES.vampireAttack, 'assets/characters/vampire/vampire_attack.png', CHAR_FRAME);
    this.load.spritesheet(TEXTURES.vampireDeath, 'assets/characters/vampire/vampire_death.png', CHAR_FRAME);
    // Spell effect only — the CraftPix pack's effects layer, no character on it.
    this.load.spritesheet(
      TEXTURES.vampireAttackMagic,
      'assets/characters/vampire/vampire_attack_magic.png',
      CHAR_FRAME,
    );

    // Every human in the hall (Romi's art) — one 2x4 sheet each, all in the row
    // order animations.ts expects: down, up, left, right. The pilgrim and the
    // huntress are the basic hunters, the farmer throws garlic, and any of the
    // three can turn up as a Captain; the Priest is the fifth-night boss.
    this.load.spritesheet(TEXTURES.pilgrim, 'assets/characters/humans/pilgrim.png', CHAR_FRAME);
    this.load.spritesheet(TEXTURES.huntress, 'assets/characters/humans/huntress.png', CHAR_FRAME);
    this.load.spritesheet(TEXTURES.farmer, 'assets/characters/humans/farmer.png', CHAR_FRAME);
    this.load.spritesheet(TEXTURES.priest, 'assets/characters/humans/priest.png', CHAR_FRAME);

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

    // Hunter weapons (Romi's art) — held props swung by code, so they load as
    // plain images rather than as sheets. The torch ships two frames because
    // its flame flickers; the other two are single drawings.
    this.load.image(TEXTURES.weaponSpike, 'assets/environment/weapons/wooden_spike.png');
    this.load.image(TEXTURES.weaponPitchfork, 'assets/environment/weapons/pitchfork.png');
    this.load.image(TEXTURES.weaponTorch1, 'assets/environment/weapons/torch_1.png');
    this.load.image(TEXTURES.weaponTorch2, 'assets/environment/weapons/torch_2.png');
    // Thrown, not swung: the farmer's garlic and the huntress Captain's crosses.
    this.load.image(TEXTURES.garlic, 'assets/environment/weapons/garlic.png');
    this.load.image(TEXTURES.weaponGoldCross, 'assets/environment/weapons/gold_cross.png');

    // Blood (Romi's art) — the droplet the Count drinks, plus the floor marks a
    // corpse leaves behind. See BLOOD_DECALS / BLOOD_SPOTS in assetKeys.ts.
    this.load.image(TEXTURES.blood, 'assets/environment/blood/droplet.png');
    this.load.image(TEXTURES.bloodSpot1, 'assets/environment/blood/spot_1.png');
    this.load.image(TEXTURES.bloodSpot2, 'assets/environment/blood/spot_2.png');
    this.load.image(TEXTURES.bloodSplatter1, 'assets/environment/blood/splatter_1.png');
    this.load.image(TEXTURES.bloodSplatter2, 'assets/environment/blood/splatter_2.png');
    this.load.image(TEXTURES.bloodSplatter3, 'assets/environment/blood/splatter_3.png');
    this.load.image(TEXTURES.bloodSplatter4, 'assets/environment/blood/splatter_4.png');
    this.load.image(TEXTURES.bloodStreak, 'assets/environment/blood/streak.png');
    this.load.image(TEXTURES.bloodSpray, 'assets/environment/blood/spray.png');
    this.load.image(TEXTURES.bloodGore1, 'assets/environment/blood/gore_1.png');
    this.load.image(TEXTURES.bloodGore2, 'assets/environment/blood/gore_2.png');

    // Props — Romi's coffin (3 states).
    this.load.image(TEXTURES.coffinClosed, 'assets/environment/props/coffin_closed.png');
    this.load.image(TEXTURES.coffinHalf, 'assets/environment/props/coffin_half.png');
    this.load.image(TEXTURES.coffinOpen, 'assets/environment/props/coffin_open.png');

    // Castle — CraftPix free top-down dungeon pack. Kept loaded (unused by
    // CastleMap for now) so reverting the Phase 1 swap is a one-line change.
    this.load.image(TEXTURES.tiles, 'assets/environment/castle/walls_floor.png');
    this.load.spritesheet(TEXTURES.fire, 'assets/environment/castle/fire_animation.png', {
      frameWidth: 44,
      frameHeight: 48,
    });
    // Phase 1 room-replacement test — Romi's flat painted great-hall. Loaded
    // under a raw key; create() chroma-keys it into TEXTURES.roomBg.
    this.load.image(ROOM_BG_RAW, 'assets/environment/castle/room_bg.jpeg');
  }

  create(): void {
    this.createChromaKeyedRoomBg();
    // After loading: generated textures only fill keys no real asset claimed.
    createPlaceholderTextures(this);
    createCharacterAnimations(this);
    this.scene.start(SCENES.game);
  }

  /**
   * Romi's room_bg.jpeg marks its three windows with flat chroma-key green
   * (no alpha channel in a JPEG) so DawnSky can still show through them, the
   * same way the old tile windows had transparent interiors. Bake a
   * green-keyed copy once here rather than re-keying per CastleMap build
   * (GameScene.restart() on night transitions would otherwise redo this
   * every night).
   */
  private createChromaKeyedRoomBg(): void {
    const source = this.textures.get(ROOM_BG_RAW).getSourceImage() as HTMLImageElement;
    const canvasTexture = this.textures.createCanvas(TEXTURES.roomBg, source.width, source.height);
    if (!canvasTexture) return;
    canvasTexture.draw(0, 0, source);
    const ctx = canvasTexture.getContext();
    const imageData = ctx.getImageData(0, 0, source.width, source.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // Two cases: the bulk of the flat chroma green, and its darker,
      // JPEG-blurred edge pixels against the arch outline — both green-
      // dominant, but the edge ring doesn't clear a brightness cutoff.
      // Tuned against the actual room_bg.jpeg (see Phase 1 notes above):
      // zero false positives on the portraits' dark-green backdrop or the
      // floor grates, near-zero leftover fringe on the window edges.
      const isBrightChroma = g > 150 && g - r > 60 && g - b > 60;
      const isDarkChromaEdge = r < 20 && b < 20 && g > 35;
      if (isBrightChroma || isDarkChromaEdge) data[i + 3] = 0;
    }
    canvasTexture.putData(imageData, 0, 0);
    canvasTexture.refresh();
    this.textures.remove(ROOM_BG_RAW);
  }
}
