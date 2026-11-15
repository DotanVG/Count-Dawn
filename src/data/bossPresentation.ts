import type { CharacterKey } from '../utils/assetKeys';

/** Tint that separates the Captain from his men (dark blood-red armor look). */
export const CAPTAIN_TINT = 0xff9a7a;

/** What a Captain is called, by which of Romi's hunters he was grown from. */
export const CAPTAIN_NAMES: Partial<Record<CharacterKey, string>> = {
  pilgrim: 'Pilgrim Captain',
  huntress: 'Huntress Captain',
  farmer: 'Garlic Captain',
};

/**
 * Colours for the wind-up ring each Captain flavour wears (see BossCharge).
 * A melee Captain charges red, a garlic Captain green — the same cue as the
 * Priest's gold, so the hall reads at a glance which threat is about to land.
 */
export const CAPTAIN_CHARGE_COLOR = 0xff5a4a;
export const GARLIC_CHARGE_COLOR = 0x7dff9b;

/**
 * Preserves first-occurrence order so the HUD and coffin name the same roster
 * consistently. Callers keep their distinct empty-roster fallback messages.
 */
export function formatBossNames(roster: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const name of roster) counts.set(name, (counts.get(name) ?? 0) + 1);

  const parts = [...counts].map(([name, n]) =>
    n > 1 ? `the ${n} ${name}s` : `the ${name}`,
  );
  return parts.length === 1
    ? parts[0]
    : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}
