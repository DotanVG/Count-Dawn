export interface GameSettingsConfig {
  /** Global palette shift for players with reduced red perception. */
  redBlindPalette: boolean;
  /** Desktop vampire-cursor size multiplier. */
  cursorScale: number;
  /** Cursor response multiplier shown to the player as 25%..200%. */
  cursorSpeed: number;
}

export const GAME_SETTINGS_STORAGE_KEY = 'count-dawn-settings-v1';

export const DEFAULT_GAME_SETTINGS: Readonly<GameSettingsConfig> = {
  redBlindPalette: false,
  cursorScale: 1,
  cursorSpeed: 1,
};

/** Cursor tuning is meaningful only on the fine-pointer desktop path. */
export function shouldShowCursorSettings(isTouch: boolean): boolean {
  return !isTouch;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function numberSetting(
  source: Record<string, unknown>,
  field: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const value = source[field];
  return typeof value === 'number' && Number.isFinite(value)
    ? clamp(value, min, max)
    : fallback;
}

export function normalizeGameSettings(raw: unknown): GameSettingsConfig {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ...DEFAULT_GAME_SETTINGS };
  }

  const source = raw as Record<string, unknown>;
  return {
    redBlindPalette:
      typeof source.redBlindPalette === 'boolean'
        ? source.redBlindPalette
        : DEFAULT_GAME_SETTINGS.redBlindPalette,
    cursorScale: numberSetting(
      source,
      'cursorScale',
      DEFAULT_GAME_SETTINGS.cursorScale,
      0.5,
      2,
    ),
    cursorSpeed: numberSetting(
      source,
      'cursorSpeed',
      DEFAULT_GAME_SETTINGS.cursorSpeed,
      0.25,
      2,
    ),
  };
}

/**
 * Produces the intentionally tiny browser save: defaults are omitted, and an
 * entirely default configuration becomes null so callers can remove the key.
 */
export function compactGameSettings(
  settings: GameSettingsConfig,
): Partial<GameSettingsConfig> | null {
  const compact: Partial<GameSettingsConfig> = {};
  if (settings.redBlindPalette !== DEFAULT_GAME_SETTINGS.redBlindPalette) {
    compact.redBlindPalette = settings.redBlindPalette;
  }
  if (settings.cursorScale !== DEFAULT_GAME_SETTINGS.cursorScale) {
    compact.cursorScale = settings.cursorScale;
  }
  if (settings.cursorSpeed !== DEFAULT_GAME_SETTINGS.cursorSpeed) {
    compact.cursorSpeed = settings.cursorSpeed;
  }
  return Object.keys(compact).length > 0 ? compact : null;
}

export type GameSettingsListener = (settings: GameSettingsConfig) => void;

class GameSettingsStore {
  private settings = this.load();
  private readonly listeners = new Set<GameSettingsListener>();

  get(): GameSettingsConfig {
    return { ...this.settings };
  }

  update(change: Partial<GameSettingsConfig>): void {
    this.settings = normalizeGameSettings({ ...this.settings, ...change });
    this.persist();
    this.apply();
    const snapshot = this.get();
    for (const listener of this.listeners) listener(snapshot);
  }

  reset(): void {
    this.update({ ...DEFAULT_GAME_SETTINGS });
  }

  subscribe(listener: GameSettingsListener): () => void {
    this.listeners.add(listener);
    listener(this.get());
    return () => this.listeners.delete(listener);
  }

  install(): void {
    this.apply();
  }

  private load(): GameSettingsConfig {
    if (typeof window === 'undefined') return normalizeGameSettings(null);
    try {
      const raw = window.localStorage.getItem(GAME_SETTINGS_STORAGE_KEY);
      return normalizeGameSettings(raw === null ? null : JSON.parse(raw));
    } catch {
      return normalizeGameSettings(null);
    }
  }

  private persist(): void {
    if (typeof window === 'undefined') return;
    try {
      const compact = compactGameSettings(this.settings);
      if (compact) {
        window.localStorage.setItem(GAME_SETTINGS_STORAGE_KEY, JSON.stringify(compact));
      } else {
        window.localStorage.removeItem(GAME_SETTINGS_STORAGE_KEY);
      }
    } catch {
      // Settings still work for this session when storage is unavailable.
    }
  }

  private apply(): void {
    if (typeof document === 'undefined') return;
    document
      .getElementById('game-root')
      ?.classList.toggle('red-blind-palette', this.settings.redBlindPalette);
  }
}

export const gameSettings = new GameSettingsStore();
