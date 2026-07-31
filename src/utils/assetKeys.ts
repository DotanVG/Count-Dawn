/**
 * Every texture / animation / audio key used by the game, in one place.
 * Character art: Romi's Count, CraftPix free packs for everyone else (see
 * README credits). Frames are 64x64.
 */
export const TEXTURES = {
  /**
   * The Count (Romi's art) — rows: 0=down(front), 1=up(back), 2=left, 3=right.
   *
   * There is no walk sheet and no hurt sheet, because there are no drawings
   * for them and nothing ever played them: the Count runs or stands, and a hit
   * on him is told by the damage flash, not by a pose.
   */
  vampireIdle: 'vampire-idle',
  vampireRun: 'vampire-run',
  vampireAttack: 'vampire-attack',
  /**
   * Effects-only layer from the CraftPix vampire pack's attack sheet: a blood
   * skull that forms and bursts into a star. It is the last thing left of the
   * bought vampire — the Count is Romi's now — and it is used purely as a
   * spell effect, on the target when a strike lands and in front of him while
   * he casts.
   */
  vampireAttackMagic: 'vampire-attack-magic',
  /** Fall (0-2), burning (3-4), ash (5-6). See ANIMS / animations.ts. */
  vampireDeath: 'vampire-death',
  /**
   * The bite — his REGULAR attack, and the only one of his moves Romi drew as a
   * real sequence: drop into a lunge, head back, drive it home, come up
   * grinning. `vampireAttack` above is the rear-up-and-roar, kept as the
   * SPECIAL for a later iteration (the BeatEmPie lightning goes on it).
   */
  vampireBite: 'vampire-bite',
  /**
   * Everyone Romi drew who walks on two legs and dies to the Count. All four
   * are one 2x4 sheet rather than a sheet per action, because two frames per
   * direction is everything any of them has — see the two-frame registration in
   * animations.ts, which builds idle, walk, run, attack, hurt and death out of
   * that same pair at different rates.
   *
   * `pilgrim` and `huntress` are the basic hunters; `farmer` throws garlic;
   * `priest` is the fifth-night boss. Any of them can turn up as a Captain,
   * scaled up and tinted (see HunterCaptain).
   */
  pilgrim: 'pilgrim',
  huntress: 'huntress',
  farmer: 'farmer',
  priest: 'priest',
  /**
   * Romi's hunter weapons — held props, not spritesheets: one drawing each for
   * the spike, the pitchfork and the gold cross, two for the torch so its flame
   * can flicker. ArmedHunter parents them to a hunter's hand and swings them in
   * code, because none of her hunters has an attack sheet.
   */
  weaponSpike: 'weapon-spike',
  weaponPitchfork: 'weapon-pitchfork',
  weaponTorch1: 'weapon-torch-1',
  weaponTorch2: 'weapon-torch-2',
  /**
   * Thrown like a shuriken by the huntress Captain, and stood in the middle of
   * the Priest's ward as it opens out.
   */
  weaponGoldCross: 'weapon-gold-cross',
  // Environment
  tiles: 'castle-tiles',
  fire: 'fire-animation',
  objects: 'castle-objects',
  /**
   * Phase 1 room-replacement test: Romi's flat painted great-hall (single
   * 1280x768 image, stretched to fill the 1280x720 canvas) standing in for
   * the walls_floor.png tilemap. See CastleMap.ts.
   */
  roomBg: 'castle-room-bg',
  /**
   * Cover art (Romi's), three takes on the same painting that differ only in
   * the title. `coverDawn` is the game's real name and what the menu rests on;
   * `coverDown` is the jam theme the title is a pun on; `coverFlicker` has the
   * letter physically missing, which is what makes it the frame to strike
   * through when lightning swaps one for the other (see MenuLightning).
   */
  coverDawn: 'cover-dawn',
  coverDown: 'cover-down',
  coverFlicker: 'cover-flicker',
  // Props (Romi's art)
  coffinClosed: 'coffin-closed',
  coffinHalf: 'coffin-half',
  coffinOpen: 'coffin-open',
  /**
   * Thrown by the garlic farmer once his target locks onto the Count. It lives
   * under environment/weapons/ with the rest of what the hunters throw and
   * swing, not under props/ — it is a weapon, and the coffin is a prop.
   */
  garlic: 'garlic',
  /**
   * Romi's blood. `blood` is the droplet the Count drinks; the rest are floor
   * marks stamped where a hunter died, picked at random per corpse so no two
   * kills leave the same stain (see BLOOD_DECALS).
   */
  bloodSpot1: 'blood-spot-1',
  bloodSpot2: 'blood-spot-2',
  bloodSplatter1: 'blood-splatter-1',
  bloodSplatter2: 'blood-splatter-2',
  bloodSplatter3: 'blood-splatter-3',
  bloodSplatter4: 'blood-splatter-4',
  bloodStreak: 'blood-streak',
  bloodSpray: 'blood-spray',
  bloodGore1: 'blood-gore-1',
  bloodGore2: 'blood-gore-2',
  /**
   * Bat form (Romi's art) — a 2-frame 64x64 flap. Replaces the vampire sprite
   * for the dash and the coffin fly-in/fly-out (see Player.setBatForm), and is
   * the sheet the future summonable bat minions will use too.
   *
   * Drawn facing RIGHT with no directional rows: mirror with flipX for left,
   * which is why there is no animKey('bat', ...) family — one animation,
   * ANIMS.batFly, covers every direction.
   */
  bat: 'bat',
  /** Romi's droplet, the one the Count actually drinks. */
  blood: 'tex-blood',
  // Still a runtime-generated placeholder
  particle: 'tex-particle',
} as const;

/** The floor marks a corpse can leave, one picked at random per kill. */
export const BLOOD_DECALS = [
  TEXTURES.bloodSplatter1,
  TEXTURES.bloodSplatter2,
  TEXTURES.bloodSplatter3,
  TEXTURES.bloodSplatter4,
  TEXTURES.bloodStreak,
  TEXTURES.bloodSpray,
  TEXTURES.bloodGore1,
  TEXTURES.bloodGore2,
] as const;

/** The smaller marks, for a hit that lands without killing. */
export const BLOOD_SPOTS = [TEXTURES.bloodSpot1, TEXTURES.bloodSpot2] as const;

export type Dir4 = 'down' | 'up' | 'left' | 'right';

/**
 * Every character that has a set of directional animations registered. The
 * bought CraftPix `hunter`/`thrower` families are gone — every human in the
 * hall is one of Romi's now.
 */
export type CharacterKey = 'vampire' | 'pilgrim' | 'huntress' | 'farmer' | 'priest';

/**
 * `death` is the fall alone — the three frames a hunter's kill earns. `sunburn`
 * is the fall PLUS the burning and ash frames, and belongs only to being caught
 * by the sunrise.
 */
export type VampireAction = 'idle' | 'run' | 'bite' | 'attack' | 'death' | 'sunburn';
export type HunterAction = 'idle' | 'walk' | 'run' | 'attack' | 'hurt' | 'death';

/** Directional animation key, e.g. animKey('vampire', 'walk', 'left'). */
export function animKey(character: CharacterKey, action: string, dir: Dir4): string {
  return `${character}-${action}-${dir}`;
}

export const ANIMS = {
  torch: 'torch-flame',
  /** One-shot magic burst spawned at a hunter's position when a strike lands. */
  hitMagic: 'hit-magic-burst',
  /**
   * The same effects layer earlier in its life — the charge and the burst —
   * thrown out along the Count's aim as he swings. Romi's attack poses are a
   * roar, not a cast, so this is what makes them one.
   */
  castFlare: 'vampire-cast-flare',
  /**
   * The bat's wing flap. Used by Player.setBatForm for BOTH the coffin
   * fly-in/out and the dash — and by the bat minions when they land.
   */
  batFly: 'bat-fly',
} as const;

/**
 * Audio keys. One key per logical sound: the OGG and MP3 that ship for a key
 * are fallback encodings of the same track, not two sounds (see
 * data/audioManifest.ts, which owns the files, and docs/AUDIO.md). Keys with
 * no asset yet are safe no-ops — AudioDirector only plays what was loaded.
 */
export const AUDIO = {
  /** Noam's Main Title. Menu, cold open and every game-over screen. */
  mainTitle: 'music-main-title',
  /** Noam's Level Music. Starts the instant the first night hands over control. */
  levelMusic: 'music-level',
  /** Bat-form chirping loop, active only while the Count is transformed. */
  batSound1: 'sfx-bat-loop',
  /** Independent key for the 0.5s–1.5s dash excerpt of the bat loop. */
  batDashSound: 'sfx-bat-dash',
  coffinOpen: 'sfx-coffin-open',
  coffinClose: 'sfx-coffin-close',
  /** Noam's swing through the air. The whole sound of an attack. */
  playerAttackWhoosh: 'sfx-player-attack-whoosh',
  playerHurt: 'sfx-player-hurt',
  hunterDeath: 'sfx-hunter-death',
  /**
   * Noam's slurp — the Count drinking. Fires when a bloodlet lands on the
   * blood meter and counts, NOT when he swings: the swing is the whoosh, the
   * drink is the blood arriving.
   */
  bloodPickup: 'sfx-blood-pickup',
  bossAppear: 'sfx-boss-appear',
  finalSeconds: 'sfx-final-seconds',
  dawn: 'sfx-dawn',
  victory: 'sfx-victory',
  defeat: 'sfx-defeat',
} as const;
