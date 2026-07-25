# Audio

Everything about sound in Count Dawn: where the files come from, how they are
encoded, who decides what is playing, and how to balance it without editing
code.

Music and SFX are by **Noam**. Do not process, normalise, pitch-shift or
otherwise alter his recordings when re-exporting them — the encode steps below
are format conversions only.

---

## 1. Source masters and runtime exports

Two different things live in two different places:

| | Master | Runtime |
| --- | --- | --- |
| Format | WAV (or AIFF/FLAC) | OGG Vorbis **and** MP3 |
| Lives in | outside the repo (e.g. `~/Downloads`, shared drive) | `public/assets/audio/` |
| Committed | **never** | yes |

`.gitignore` blocks `public/assets/audio/**/*.wav` (plus `.aif`, `.aiff`,
`.flac`) so a master can never be dropped into the runtime folder by accident.
Never put a WAV under `public/` — Vite copies that folder verbatim into
`dist/`, and a 35 MB master would ship to players.

Both runtime formats are always encoded **from the master**. Never transcode
OGG → MP3 or MP3 → OGG: that stacks two lossy generations on top of each other.

### Why two formats

They are two encodings of *one* sound, not two sounds. Every current browser
plays MP3; OGG Vorbis is smaller at the same perceived quality but is not
universal (older Safari). Shipping both means every browser gets the file it
can decode, and most get the smaller one.

### How Phaser chooses

`this.load.audio(key, [ogg, mp3])` hands Phaser an ordered list. Phaser asks
the browser which formats it can decode and downloads **only the first
supported entry** — so the pair costs one HTTP request, not two. OGG is listed
first, MP3 second.

Confirm it in DevTools → Network: loading the game requests
`main-title.ogg` and `count-dawn-level.ogg` in Chrome/Firefox, and never the
matching `.mp3`.

Game code plays the shared key (`AUDIO.mainTitle`), never a file path, and
never picks a format.

### Folder structure

```
public/assets/audio/
  music/
    main-title.ogg          main-title.mp3
    count-dawn-level.ogg    count-dawn-level.mp3
  sfx/
    player-attack-whoosh.ogg  player-attack-whoosh.mp3
    player-attack-slurp.ogg   player-attack-slurp.mp3
    bat-sound-1.mp3
    coffin-open.mp3           coffin-close.mp3
```

### Encoding commands (PowerShell)

Music — OGG Vorbis q4 and MP3 160 kbps, 44.1 kHz, metadata stripped:

```powershell
New-Item -ItemType Directory -Force -Path ".\public\assets\audio\music" | Out-Null

ffmpeg -y -i "PATH\TO\MASTER.wav" -map_metadata -1 -ar 44100 `
  -c:a libvorbis -q:a 4 ".\public\assets\audio\music\NAME.ogg"

ffmpeg -y -i "PATH\TO\MASTER.wav" -map_metadata -1 -ar 44100 `
  -c:a libmp3lame -b:a 160k ".\public\assets\audio\music\NAME.mp3"
```

SFX — same, at MP3 128 kbps:

```powershell
ffmpeg -y -i "PATH\TO\MASTER.wav" -map_metadata -1 -ar 44100 `
  -c:a libvorbis -q:a 4 ".\public\assets\audio\sfx\NAME.ogg"

ffmpeg -y -i "PATH\TO\MASTER.wav" -map_metadata -1 -ar 44100 `
  -c:a libmp3lame -b:a 128k ".\public\assets\audio\sfx\NAME.mp3"
```

Add `-ac 1` **only** if the master is genuinely mono. Check first — a source
can be a stereo file that happens to sound centred:

```powershell
# Mid level vs. side (L-R) level. If the side is far below the mid
# (roughly 30 dB or more), the file is effectively mono.
ffmpeg -i "MASTER.wav" -af "volumedetect" -f null -
ffmpeg -i "MASTER.wav" -af "pan=mono|c0=0.5*c0+-0.5*c1,volumedetect" -f null -
```

Verify every export, and check that the OGG and the MP3 report the same
duration:

```powershell
ffprobe -v error -show_entries stream=codec_name,sample_rate,channels `
  -show_entries format=duration,size,bit_rate -of default=noprint_wrappers=1 "FILE"
```

### Trimming policy

Do not trim, fade, normalise or compress. The single exception is obviously
accidental leading/trailing digital silence.

One current export departs from that and is worth knowing about:
`slurp.wav` arrived as a **20.5 s multi-take session** — its first 0.16 s is a
bit-identical copy of `Woosh.wav`, followed by fourteen separate slurp takes
separated by silence. Shipping it whole would play every take on every attack.
The runtime file is therefore a straight cut of the single strongest, cleanly
isolated take, `3.39 s → 4.17 s`, with no processing of any kind:

```powershell
ffmpeg -y -ss 3.39 -to 4.17 -i "slurp.wav" -map_metadata -1 -ar 44100 `
  -c:a libvorbis -q:a 4 ".\public\assets\audio\sfx\player-attack-slurp.ogg"
```

To audition a different take, re-run with different `-ss`/`-to` values. The
take boundaries come from
`ffmpeg -i slurp.wav -af "silencedetect=noise=-60dB:d=0.15" -f null -`.

---

## 2. Who owns the sound

One authority for the whole game: **`src/systems/AudioDirector.ts`**.

It is created once in `BootScene.create()` and parked on the Phaser game
registry, so it outlives every scene transition (menu → cold open → night →
game over → menu). No scene builds its own audio manager; every scene gets the
same instance with `getAudioDirector(this)`.

```ts
const audio = getAudioDirector(this);

audio.playMainTitle();          // menu / cold open / run-ending screens
audio.playLevelMusic();         // the gameplay cue
audio.stopMusic();
audio.pauseMusic();             // pause overlay, orientation gate
audio.resumeMusic();
audio.playSfx(key, options);
audio.playSfxStack([a, b]);     // several layers, one cue
audio.playSfxSegment(key, start, duration);
audio.stopSfx(key);
audio.setMasterVolume(v);
audio.setMusicVolume(v);
audio.setSfxVolume(v);
audio.setAssetVolume(key, v);
audio.setMuted(muted);
```

Guarantees it makes:

- **One music instance, ever.** Switching hands the outgoing sound to a fade
  that owns and destroys it; starting a track first kills any fade still
  holding an older instance of the same key.
- **Re-requesting the active track does nothing** — no restart, no second
  copy, no fade. This is what makes repeated scene events safe.
- **Missing audio is a silent no-op.** A key with no file loaded is skipped;
  the game stays fully playable if audio fails to load.
- **Crossfades are ~300 ms** and are driven by the game's own step
  (`Phaser.Core.Events.PRE_STEP`), not a scene tween manager — a fade has to
  survive the teardown of the scene that started it (death fades out while
  GameScene is shutting down), and must never be a stray timer.

> Implementation note: a sound's volume can **not** be read back. The Web
> Audio getter reports the gain computed at the audio clock's current time, so
> a value written moments ago still reads as the old one. The director tracks
> the level it applied (`currentLevel`, `Fade.from`) instead of ever reading it.

### Autoplay locking

If the browser blocks audio until a gesture, the director records the intended
track anyway and listens once for `Phaser.Sound.Events.UNLOCKED`. On unlock it
starts the track **only if** it is not already playing, so pressing START (a
valid unlock gesture) can never leave two Main Titles running.

---

## 3. Music state flow

State lives in `src/systems/MusicStateMachine.ts` — `'none' | 'main-title' |
'level'`. `request()` returns `true` only when the intended track actually
changed, which is what makes every repeated event idempotent.

| Moment | Transition |
| --- | --- |
| First frame of the menu | `none → main-title` |
| START pressed | *(no change)* |
| Cold-start cutscene, coffin opening, the Count's flight | *(no change)* |
| **First night begins, player gains control** | `main-title → level` |
| Night survived, seamless next night | *(no change)* |
| Pause / resume | stays `level`; the sound pauses and resumes in place |
| Player death or dawn defeat | `level → main-title` |
| Game Over screen | *(no change)* |
| Game Over → Main Menu | *(no change)* |
| Restart → next cold open | *(no change)* |
| New run gains control | `main-title → level` |

The Main Title therefore plays continuously from the menu, through START,
through the entire cold open, through the coffin opening and the fly-in — and
stops only at the exact frame the night starts.

### The exact gameplay cue

**`GameScene.startPlaying()` → `this.audio.playLevelMusic()`**
([src/scenes/GameScene.ts](../src/scenes/GameScene.ts))

That method *is* the state change:

- the cold open has finished (it is the cutscene's own completion callback),
- `setPlayerDormant(false)` re-enables the player body,
- `phase` becomes `'playing'`, which is what lets input reach the Count,
- `beginRoundSystems()` immediately after creates the first-night
  `CountdownSystem` and starts the `SpawnSystem`.

It is not a delayed timer guessing when the cutscene ends. Later nights re-enter
gameplay through `beginRoundSystems()` without touching the music, which is why
the loop stays seamless; even if they did request it, the director would ignore
a request for the track already playing.

The death/dawn side is `GameScene.onGameEnded()`, which calls `playMainTitle()`
for any non-victory cause. `GameFlowSystem` lets a run end exactly once, and
the state machine ignores a repeat, so the swap cannot fire twice.

---

## 4. Attack SFX layering

A single accepted attack plays **two separate files on two separate keys, in
the same frame**:

```ts
audio.playSfxStack(PLAYER_ATTACK_SFX); // [playerAttackWhoosh, playerAttackSlurp]
```

They are deliberately not merged into one file, so each keeps its own level in
the balance editor.

The cue is wired as `CombatSystem`'s `onAttack` callback, which fires only
**after** the cooldown check and the alive check pass. Consequences, all
intentional:

- holding the attack button plays it once per accepted swing, not per frame;
- a swing rejected by the cooldown makes no sound;
- it plays whether or not the swing connects — this is the sound of the Count
  attacking, not of a hit landing. Impact sounds stay a separate, future key;
- the menu and the cold open never trigger it (the cinematic drives
  `player.playAttackAnim()` directly, bypassing `CombatSystem`);
- a dead Count makes no sound (`CombatSystem` checks `player.isAlive`).

---

## 5. Audio balance editor

A developer tool, not player UI.

**Available when** `import.meta.env.DEV` is true (i.e. `npm run dev`), **or**
the URL contains `?audioEditor=1`. In a normal production URL it is not built
into the page at all, so players cannot open it.

**Open it with `F8`.** It is hidden until then, and F8 toggles it.

It contains:

- **Global** — Master, Music group, SFX group, Mute all
- **Music** — Main Title, Level Music, each with Play / Stop
- **Sound effects** — every registered SFX key, each with Preview

Every row is generated from `AUDIO_MANIFEST`, so new sounds appear without
touching the editor.

Sliders run 0 → 1 in steps of 0.01, show their numeric value, and apply
immediately: new SFX pick up the new level on their next play, and music
already playing follows the slider live (mid-crossfade included). No restart.

Previewing music does not damage the real music state: **Play** remembers what
was playing and **Stop** puts it back. Preview goes through the same single-
instance director, so it cannot spawn a duplicate loop.

### Saved values

Values are written to `localStorage` under `count-dawn-audio-balance-v1` on
every change and reloaded at boot. Missing, out-of-range, non-numeric or
outright corrupt entries fall back **field by field** to the defaults, so a bad
save never costs you the rest of the balance and never breaks the game.

**Reset to defaults** restores `DEFAULT_AUDIO_BALANCE`.

**Copy configuration** puts the full balance on the clipboard as JSON. If the
Clipboard API is refused (cross-origin iframes such as itch.io), the JSON
appears in a selectable text area instead.

### Promoting a balance into the code

1. Tune with the editor.
2. Press **Copy configuration**.
3. The `master`, `music` and `sfx` numbers go into `DEFAULT_AUDIO_BALANCE` in
   [src/data/audioBalance.ts](../src/data/audioBalance.ts).
4. Each `assets` entry goes into that key's `defaultVolume` in
   [src/data/audioManifest.ts](../src/data/audioManifest.ts) — the defaults
   record is derived from the manifest, so the manifest is the one place a
   per-sound level is written down.
5. Clear `count-dawn-audio-balance-v1` from localStorage (or press Reset) to
   confirm the new defaults sound right on a fresh machine.

---

## 6. Volume model

```
music volume = master × music group × individual level
sfx   volume = master × sfx group   × individual level
```

Every factor and the product are clamped to `0..1`. "Mute all" is applied as
the Phaser global mute, not as a volume of zero.

No scene carries a volume number. Scene code asks for a track or a cue; the
director applies the balance. If you find yourself typing `volume: 0.5` in a
scene, it belongs in the manifest instead.

---

## 7. Adding a future track or effect

**A new music track**

1. Export OGG + MP3 from the master into `public/assets/audio/music/`.
2. Add a key to `AUDIO` in [src/utils/assetKeys.ts](../src/utils/assetKeys.ts).
3. Add a `group: 'music'` entry to `AUDIO_MANIFEST` with both files and a
   `defaultVolume`.
4. Add the state to `MusicState` and to both maps in
   [src/systems/MusicStateMachine.ts](../src/systems/MusicStateMachine.ts).
5. Call `audio.setMusicState('your-state')` at the real state change.

PreloadScene and the editor pick it up automatically.

**A new sound effect**

1. Export OGG + MP3 into `public/assets/audio/sfx/`.
2. Add a key to `AUDIO`.
3. Add a `group: 'sfx'` manifest entry.
4. Call `audio.playSfx(AUDIO.yourKey)` at the moment it should fire — or add it
   to a `playSfxStack([...])` for a layered cue.

A key can be added to the manifest with `files: []` before the sound exists.
It shows up in the editor as "(no asset yet)", and playing it is a silent
no-op — which is how the reserved keys (player hurt, hunter death, blood
pickup, boss appearance, final seconds, dawn, victory, defeat) work today.

---

## 8. Pause and cleanup

`GameScene` listens for the scene's own `PAUSE`/`RESUME` events, so the Level
Music pauses and resumes from the same position for both the pause overlay and
the portrait-orientation gate. Opening the pause screen never promotes the Main
Title over a suspended run. Already-playing SFX finish naturally.

Those two listeners are registered with `.on()` and removed in `cleanup()`:
`scene.events` survives a scene restart, so an unpaired `.on()` would stack a
new listener on every restart.

`cleanup()` deliberately does **not** stop the music — it belongs to the game,
not the scene.
