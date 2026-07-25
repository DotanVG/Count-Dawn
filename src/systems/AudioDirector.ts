import Phaser from 'phaser';
import {
  AUDIO_BALANCE_STORAGE_KEY,
  effectiveMusicVolume,
  effectiveSfxVolume,
  normalizeBalance,
  type AudioBalanceConfig,
} from '../data/audioBalance';
import { MusicStateMachine, musicKeyForState, musicStateForKey } from './MusicStateMachine';
import type { MusicState } from './MusicStateMachine';

/**
 * Phaser's BaseSound type does not declare `volume`, but every concrete
 * implementation (WebAudio, HTML5 and the no-audio stub) does.
 */
type LevelledSound = Phaser.Sound.BaseSound & { volume: number };

export interface SfxOptions {
  loop?: boolean;
  rate?: number;
  detune?: number;
}

/** Short enough to feel like one gesture, long enough not to click. */
const CROSSFADE_MS = 300;

interface Fade {
  sound: LevelledSound;
  /**
   * Explicit, because a sound's volume can NOT be read back reliably: the
   * Web Audio getter reports the gain computed at the audio clock's current
   * time, so a value written moments ago still reads as the old one.
   */
  from: number;
  to: number;
  elapsedMs: number;
  durationMs: number;
  /** Fade-outs own the sound and destroy it when they land on zero. */
  destroyWhenDone: boolean;
}

/**
 * The game's single audio authority. It lives on the Phaser game (registry,
 * see installAudioDirector) rather than on a scene, because the music has to
 * survive every scene transition the game makes: menu -> cold open -> night,
 * night -> game over -> menu, and every restart in between.
 *
 * Everything it owns is keyed off one intended MusicState, so re-requesting
 * the track that is already playing is a no-op by construction. There is
 * never more than one music instance: switching hands the outgoing sound to a
 * fade that destroys it, and starting a track first kills any fade still
 * holding an older instance of the same key.
 *
 * Playing a key that was never loaded is a silent no-op, so the game stays
 * fully playable if audio fails to load.
 */
export class AudioDirector {
  static readonly REGISTRY_KEY = 'audio-director';

  private readonly sound: Phaser.Sound.BaseSoundManager;
  private readonly machine = new MusicStateMachine();
  private readonly fades: Fade[] = [];
  private balance: AudioBalanceConfig;
  private currentKey: string | null = null;
  private currentSound: LevelledSound | null = null;
  /** The level last written to currentSound — see Fade.from for why. */
  private currentLevel = 0;
  /** State to fall back to when the editor's music preview is stopped. */
  private previewRestore: MusicState | null = null;
  private destroyed = false;

  constructor(private readonly game: Phaser.Game) {
    this.sound = game.sound;
    this.balance = loadBalance();
    this.sound.mute = this.balance.muted;

    this.game.events.on(Phaser.Core.Events.PRE_STEP, this.step, this);
    // Autoplay lock: whatever the game asked for gets started for real the
    // moment the browser lets us, without ever producing a second copy.
    this.sound.once(Phaser.Sound.Events.UNLOCKED, this.onUnlocked, this);
    this.game.events.once(Phaser.Core.Events.DESTROY, this.destroy, this);
  }

  // ── Music ───────────────────────────────────────────────────────────────

  get musicState(): MusicState {
    return this.machine.current;
  }

  /** Main menu, cold open and every run-ending screen. */
  playMainTitle(): boolean {
    return this.setMusicState('main-title');
  }

  /** The gameplay cue: the first night has handed control to the player. */
  playLevelMusic(): boolean {
    return this.setMusicState('level');
  }

  stopMusic(): boolean {
    return this.setMusicState('none');
  }

  /**
   * Requests a track by key. Asking for the track that is already active does
   * nothing at all — no restart, no second instance, no fade.
   */
  playMusic(key: string): boolean {
    return this.setMusicState(musicStateForKey(key));
  }

  /** Returns true when the intended track actually changed. */
  setMusicState(next: MusicState): boolean {
    if (this.destroyed) return false;
    if (!this.machine.request(next)) return false;
    this.applyMusicState(next);
    return true;
  }

  pauseMusic(): void {
    const sound = this.currentSound;
    if (sound?.isPlaying) sound.pause();
  }

  resumeMusic(): void {
    const sound = this.currentSound;
    if (sound?.isPaused) sound.resume();
  }

  private applyMusicState(state: MusicState): void {
    this.releaseCurrentMusic();
    const key = musicKeyForState(state);
    if (key) this.startMusic(key);
  }

  /**
   * Hands the playing track to a fade-out that owns and destroys it, so the
   * director's "current" slot is free immediately and cannot be double-stopped.
   */
  private releaseCurrentMusic(): void {
    const sound = this.currentSound;
    const level = this.currentLevel;
    this.currentSound = null;
    this.currentKey = null;
    this.currentLevel = 0;
    if (!sound) return;

    // A paused track cannot fade (its clock is stopped) — drop it outright.
    if (sound.isPaused || !sound.isPlaying) {
      this.discard(sound);
      return;
    }
    this.fade(sound, level, 0, CROSSFADE_MS, true);
  }

  private startMusic(key: string): void {
    // Record the intent even when nothing ships for the key: the state stays
    // truthful and a later unlock/reload has something to act on.
    this.currentKey = key;
    this.currentSound = null;
    if (!this.exists(key)) return;

    // An older instance of this same key may still be fading out (fast
    // A -> B -> A). Kill it now rather than let two copies overlap.
    this.finishFadesFor(key);

    const sound = this.sound.add(key, { loop: true }) as LevelledSound;
    this.currentSound = sound;
    sound.play();
    // Silenced AFTER play(): starting playback re-applies the sound's own
    // config volume, so zeroing it beforehand is undone and the track comes
    // in at full level.
    this.applyMusicLevel(0);
    this.fade(sound, 0, effectiveMusicVolume(this.balance, key), CROSSFADE_MS, false);
  }

  private onUnlocked(): void {
    if (this.destroyed) return;
    const key = this.currentKey;
    if (!key) return;
    const sound = this.currentSound;
    if (sound && (sound.isPlaying || sound.isPaused)) return; // already running
    if (sound) this.discard(sound);
    this.currentSound = null;
    this.startMusic(key);
  }

  // ── SFX ─────────────────────────────────────────────────────────────────

  playSfx(key: string, options?: SfxOptions): void {
    if (this.destroyed || !this.exists(key)) return;
    this.sound.play(key, { ...options, volume: effectiveSfxVolume(this.balance, key) });
  }

  /**
   * One logical cue made of several separate sounds, started in the same
   * frame so they are heard as one layered effect. They stay separate files
   * and separate keys precisely so each keeps its own level for balancing.
   */
  playSfxStack(keys: readonly string[], options?: SfxOptions): void {
    for (const key of keys) this.playSfx(key, options);
  }

  /**
   * A balanced SFX instance the CALLER owns and destroys — for the rare case
   * that needs the sound object itself (the coffin queues its lid sounds on
   * COMPLETE). Returns null when nothing ships for the key.
   */
  addSfx(key: string, options?: SfxOptions): Phaser.Sound.BaseSound | null {
    if (this.destroyed || !this.exists(key)) return null;
    return this.sound.add(key, { ...options, volume: effectiveSfxVolume(this.balance, key) });
  }

  /** Plays one exact excerpt and releases its temporary sound instance afterward. */
  playSfxSegment(key: string, start: number, duration: number): void {
    if (this.destroyed || !this.exists(key)) return;

    const sound = this.sound.add(key, { volume: effectiveSfxVolume(this.balance, key) });
    sound.addMarker({ name: 'segment', start, duration });
    const destroy = (): void => sound.destroy();
    sound.once(Phaser.Sound.Events.COMPLETE, destroy);
    sound.once(Phaser.Sound.Events.STOP, destroy);
    sound.play('segment');
  }

  /** Stops every playing instance of an SFX key (e.g. the bat-form loop). */
  stopSfx(key: string): void {
    if (this.destroyed || !this.exists(key)) return;
    this.sound.stopByKey(key);
  }

  // ── Balance ─────────────────────────────────────────────────────────────

  getBalance(): AudioBalanceConfig {
    return { ...this.balance, assets: { ...this.balance.assets } };
  }

  setMasterVolume(value: number): void {
    this.balance.master = value;
    this.commitBalance();
  }

  setMusicVolume(value: number): void {
    this.balance.music = value;
    this.commitBalance();
  }

  setSfxVolume(value: number): void {
    this.balance.sfx = value;
    this.commitBalance();
  }

  setAssetVolume(key: string, value: number): void {
    this.balance.assets[key] = value;
    this.commitBalance();
  }

  setMuted(muted: boolean): void {
    this.balance.muted = muted;
    this.commitBalance();
  }

  resetBalance(): void {
    this.balance = normalizeBalance(null);
    this.commitBalance();
  }

  private commitBalance(): void {
    this.balance = normalizeBalance(this.balance);
    this.sound.mute = this.balance.muted;
    this.refreshMusicVolume();
    saveBalance(this.balance);
  }

  /** Music already playing follows the sliders live, mid-fade included. */
  private refreshMusicVolume(): void {
    const sound = this.currentSound;
    const key = this.currentKey;
    if (!sound || !key) return;

    const target = effectiveMusicVolume(this.balance, key);
    const fade = this.fades.find((f) => f.sound === sound && !f.destroyWhenDone);
    if (fade) fade.to = target;
    else this.applyMusicLevel(target);
  }

  private applyMusicLevel(level: number): void {
    this.currentLevel = level;
    if (this.currentSound) this.currentSound.volume = level;
  }

  // ── Editor preview ──────────────────────────────────────────────────────

  /**
   * Dev-tool only. Auditions a track and remembers what was playing, so
   * stopPreview puts the real music state back exactly as it was instead of
   * leaving the game silent (or looping the wrong track forever).
   */
  previewMusic(key: string): void {
    if (this.previewRestore === null) this.previewRestore = this.machine.current;
    this.setMusicState(musicStateForKey(key));
  }

  stopPreview(): void {
    const restore = this.previewRestore;
    this.previewRestore = null;
    this.setMusicState(restore ?? 'none');
  }

  // ── Fade engine ─────────────────────────────────────────────────────────

  /**
   * Driven by the game's own step rather than a scene tween manager: a fade
   * must outlive the scene that triggered it (death fades out while GameScene
   * is being torn down), and must never be a timer left running on its own.
   */
  private step(_time: number, delta: number): void {
    for (let i = this.fades.length - 1; i >= 0; i--) {
      const fade = this.fades[i];
      fade.elapsedMs += delta;
      const t = fade.durationMs <= 0 ? 1 : Math.min(fade.elapsedMs / fade.durationMs, 1);
      this.writeFade(fade, fade.from + (fade.to - fade.from) * t);
      if (t < 1) continue;

      this.fades.splice(i, 1);
      if (fade.destroyWhenDone) this.discard(fade.sound);
    }
  }

  private writeFade(fade: Fade, level: number): void {
    if (fade.sound === this.currentSound) this.applyMusicLevel(level);
    else fade.sound.volume = level;
  }

  private fade(
    sound: LevelledSound,
    from: number,
    to: number,
    durationMs: number,
    destroyWhenDone: boolean,
  ): void {
    this.fades.push({ sound, from, to, elapsedMs: 0, durationMs, destroyWhenDone });
  }

  /** Lands every pending fade on this key immediately (destroying as instructed). */
  private finishFadesFor(key: string): void {
    for (let i = this.fades.length - 1; i >= 0; i--) {
      const fade = this.fades[i];
      if (fade.sound.key !== key) continue;
      this.fades.splice(i, 1);
      if (fade.destroyWhenDone) this.discard(fade.sound);
      else this.writeFade(fade, fade.to);
    }
  }

  /**
   * Ends a sound for good. Any fade still holding it is dropped FIRST: a fade
   * that outlived its sound would write a volume into a destroyed audio node
   * on the next frame and throw.
   */
  private discard(sound: LevelledSound): void {
    for (let i = this.fades.length - 1; i >= 0; i--) {
      if (this.fades[i].sound === sound) this.fades.splice(i, 1);
    }
    sound.stop();
    sound.destroy();
  }

  private exists(key: string): boolean {
    return this.game.cache.audio.exists(key);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.game.events.off(Phaser.Core.Events.PRE_STEP, this.step, this);
    this.sound.off(Phaser.Sound.Events.UNLOCKED, this.onUnlocked, this);
    for (const fade of this.fades.splice(0)) this.discard(fade.sound);
    if (this.currentSound) this.discard(this.currentSound);
    this.currentSound = null;
    this.currentKey = null;
  }
}

function loadBalance(): AudioBalanceConfig {
  try {
    const raw = window.localStorage.getItem(AUDIO_BALANCE_STORAGE_KEY);
    return normalizeBalance(raw === null ? null : JSON.parse(raw));
  } catch {
    // Private mode, a disabled storage quota, or unparsable data: defaults.
    return normalizeBalance(null);
  }
}

function saveBalance(balance: AudioBalanceConfig): void {
  try {
    window.localStorage.setItem(AUDIO_BALANCE_STORAGE_KEY, JSON.stringify(balance));
  } catch {
    // Persisting is a convenience; failing to persist must not break audio.
  }
}

/** Creates the one director for this game and parks it on the registry. */
export function installAudioDirector(game: Phaser.Game): AudioDirector {
  const existing = game.registry.get(AudioDirector.REGISTRY_KEY) as AudioDirector | undefined;
  if (existing) return existing;

  const director = new AudioDirector(game);
  game.registry.set(AudioDirector.REGISTRY_KEY, director);
  return director;
}

/** Every scene shares the same director — no scene ever builds its own. */
export function getAudioDirector(scene: Phaser.Scene): AudioDirector {
  const director = scene.registry.get(AudioDirector.REGISTRY_KEY) as AudioDirector | undefined;
  return director ?? installAudioDirector(scene.game);
}
