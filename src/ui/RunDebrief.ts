import Phaser from 'phaser';
import { BLOOD as BLOOD_BALANCE } from '../data/balance';
import { TEXTURES, animKey } from '../utils/assetKeys';
import { CAPTAIN_TINT } from '../entities/HunterCaptain';
import type { BossKind, HunterKind, RunStats } from '../types/game';

const FONT = 'Trebuchet MS, sans-serif';
const HEADING = '#c9a7ff';
const VALUE = '#e8ddff';
const MUTED = '#9d8bbf';
const BLOOD = '#f0b7bd';

/** Row spacing inside a column, and how far the icon sits left of its label. */
const ROW_H = 38;
const ICON_DX = -22;

/**
 * How each tally line is drawn. `anim` is played on a sprite if the animation
 * exists, otherwise the sprite just shows `frame` — the blood droplet is a
 * runtime-generated placeholder texture with no animation, so it is bobbed by a
 * tween instead (see makeIcon).
 */
interface IconSpec {
  texture: string;
  anim?: string;
  frame?: number;
  scale: number;
  tint?: number;
  /** Bob it by hand, for icons with no animation of their own. */
  float?: boolean;
  /** A second texture to alternate with, for the torch's flame. */
  flicker?: string;
}

const HUNTER_ICONS: Record<HunterKind, IconSpec> = {
  // A melee kill is counted by the WEAPON, so the icon is the weapon. The props
  // have no animation of their own, so they bob; the torch also flickers between
  // its two flame frames, exactly as it does in the hall.
  spike: { texture: TEXTURES.weaponSpike, scale: 0.6, float: true },
  pitchfork: { texture: TEXTURES.weaponPitchfork, scale: 0.6, float: true },
  torch: { texture: TEXTURES.weaponTorch1, scale: 0.6, float: true, flicker: TEXTURES.weaponTorch2 },
  thrower: { texture: TEXTURES.farmer, anim: animKey('farmer', 'walk', 'down'), scale: 1.8 },
};

const HUNTER_LABELS: Record<HunterKind, string> = {
  spike: 'Spike',
  pitchfork: 'Pitchfork',
  torch: 'Torch',
  thrower: 'Garlic farmers',
};

const BOSS_ICONS: Record<BossKind, IconSpec> = {
  priest: { texture: TEXTURES.priest, anim: animKey('priest', 'idle', 'down'), scale: 1.5 },
  captain: {
    texture: TEXTURES.pilgrim,
    anim: animKey('pilgrim', 'idle', 'down'),
    scale: 1.9,
    tint: CAPTAIN_TINT,
  },
  garlicCaptain: {
    texture: TEXTURES.farmer,
    anim: animKey('farmer', 'idle', 'down'),
    scale: 1.9,
    tint: CAPTAIN_TINT,
  },
  crossCaptain: {
    texture: TEXTURES.huntress,
    anim: animKey('huntress', 'idle', 'down'),
    scale: 1.9,
    tint: CAPTAIN_TINT,
  },
};

const BOSS_LABELS: Record<BossKind, string> = {
  priest: 'Priests',
  captain: 'Pilgrim Captains',
  garlicCaptain: 'Garlic Captains',
  crossCaptain: 'Huntress Captains',
};

/** Listed in the order the debrief reads them out. */
const HUNTER_ORDER: HunterKind[] = ['spike', 'pitchfork', 'torch', 'thrower'];
const BOSS_ORDER: BossKind[] = ['priest', 'captain', 'garlicCaptain', 'crossCaptain'];

/**
 * The end-of-run debrief: what the Count actually did across the whole run,
 * with the thing being counted alive next to each number rather than a bullet.
 *
 * Everything here is read-only decoration over a finished run — it owns a
 * container the caller can drop anywhere and destroy in one go.
 */
export class RunDebrief {
  readonly container: Phaser.GameObjects.Container;

  constructor(
    private readonly scene: Phaser.Scene,
    x: number,
    y: number,
    stats: RunStats,
  ) {
    this.container = scene.add.container(x, y);

    // Two headline numbers across the top, then the two breakdowns side by
    // side underneath. Nights and blood are the run in one glance; the columns
    // are for the player who wants to know what they actually killed.
    this.headline(-170, 0, String(stats.nightsSurvived), 'Nights survived');
    this.headline(170, 0, String(stats.bloodCollected), 'Blood drained', BLOOD);
    this.bloodDrop(170 - 74, 2);

    const hunterTotal = HUNTER_ORDER.reduce((n, k) => n + stats.hunters[k], 0);
    const bossTotal = BOSS_ORDER.reduce((n, k) => n + stats.bosses[k], 0);

    this.column(
      -170,
      74,
      `Hunters drained — ${hunterTotal}`,
      HUNTER_ORDER.map((kind) => ({
        label: HUNTER_LABELS[kind],
        value: stats.hunters[kind],
        icon: HUNTER_ICONS[kind],
      })),
    );

    this.column(
      170,
      74,
      `Mini-bosses slain — ${bossTotal}`,
      BOSS_ORDER.map((kind) => ({
        label: BOSS_LABELS[kind],
        value: stats.bosses[kind],
        icon: BOSS_ICONS[kind],
      })),
    );
  }

  destroy(): void {
    this.container.destroy();
  }

  private headline(x: number, y: number, value: string, label: string, color = VALUE): void {
    this.container.add([
      this.scene.add
        .text(x, y, value, { fontFamily: FONT, fontSize: '40px', color, fontStyle: 'bold' })
        .setOrigin(0.5),
      this.scene.add
        .text(x, y + 30, label, { fontFamily: FONT, fontSize: '15px', color: MUTED })
        .setOrigin(0.5),
    ]);
  }

  private column(
    x: number,
    y: number,
    heading: string,
    rows: { label: string; value: number; icon: IconSpec }[],
  ): void {
    this.container.add(
      this.scene.add
        .text(x, y, heading, { fontFamily: FONT, fontSize: '17px', color: HEADING, fontStyle: 'bold' })
        .setOrigin(0.5),
    );

    rows.forEach((row, i) => {
      const rowY = y + 28 + i * ROW_H;
      // Zeroes are kept rather than hidden: a column that changes shape between
      // runs is harder to read at a glance than one with a 0 in it, and seeing
      // "Priests 0" is itself information about how far you got.
      const dim = row.value === 0;
      this.container.add([
        this.makeIcon(x - 96 + ICON_DX, rowY, row.icon, dim),
        this.scene.add
          .text(x - 78, rowY, row.label, {
            fontFamily: FONT,
            fontSize: '16px',
            color: dim ? '#5f5480' : MUTED,
          })
          .setOrigin(0, 0.5),
        this.scene.add
          .text(x + 96, rowY, String(row.value), {
            fontFamily: FONT,
            fontSize: '18px',
            color: dim ? '#5f5480' : VALUE,
            fontStyle: 'bold',
          })
          .setOrigin(1, 0.5),
      ]);
    });
  }

  private makeIcon(x: number, y: number, spec: IconSpec, dim: boolean): Phaser.GameObjects.GameObject {
    // A texture that somehow is not loaded would draw Phaser's bright green
    // missing-texture box, which is far worse on a results screen than simply
    // having no icon. The row's label and number carry it on their own.
    if (!this.scene.textures.exists(spec.texture)) {
      return this.scene.add.zone(x, y, 1, 1);
    }

    const sprite = this.scene.add
      .sprite(x, y, spec.texture, spec.frame ?? 0)
      .setScale(spec.scale)
      .setAlpha(dim ? 0.3 : 1);
    if (spec.tint !== undefined) sprite.setTint(spec.tint);

    // A tally of things that are dead still reads better alive — but only the
    // rows that scored. A row of zero keeps its icon still, greyed out.
    if (!dim && spec.anim && this.scene.anims.exists(spec.anim)) {
      sprite.play(spec.anim);
    }
    if (!dim && spec.float) {
      this.scene.tweens.add({
        targets: sprite,
        y: y - 5,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
    if (!dim && spec.flicker) {
      const frames = [spec.texture, spec.flicker];
      let i = 0;
      const timer = this.scene.time.addEvent({
        delay: 110,
        loop: true,
        callback: () => sprite.setTexture(frames[++i % frames.length]),
      });
      sprite.once(Phaser.GameObjects.Events.DESTROY, () => timer.remove());
    }
    return sprite;
  }

  /** The blood droplet beside the headline, bobbing the way a bloodlet does. */
  private bloodDrop(x: number, y: number): void {
    this.container.add(this.makeIcon(x, y, { texture: TEXTURES.blood, scale: 2.2 * BLOOD_BALANCE.dropletScale, float: true }, false));
  }
}
