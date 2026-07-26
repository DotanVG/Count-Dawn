# QA checklist — sprites rework

Everything introduced on `sprites/rework-all`: Romi's Count, the Priest boss,
the three hunter weapons, the cover-art lightning, and the round-two playtest
fixes on top of all four.

Run on desktop unless a row says otherwise. `FAST_DEV_MODE = true` in
[`src/data/balance.ts`](../src/data/balance.ts) shortens a night to 25s, which
makes anything involving the night loop far quicker to reach.

Legend: **Do** → what to try. **Want** → the behaviour that passes. **Fail** →
what specifically to report.

---

## 1. Main menu & the lightning title gag

| # | Do | Want | Fail |
|---|----|------|------|
| 1.1 | Load the game and watch the cover for ~30s without touching anything | Title rests on **COUNT DAWN**. Every few seconds a lightning flash cuts it to **COUNT DOWN**, holds briefly, and another flash puts it back | Title stuck on one variant; no flash |
| 1.2 | Watch a single strike closely (or record it) | The strike stutters through the **COUNT D_WN** frame (letter missing) on the way. It is never a resting state, only a pass-through | A cross-fade, or D_WN sitting there visibly |
| 1.3 | Time the two rests over several cycles | DAWN holds noticeably longer (~3–5s) than DOWN (~0.5–2s), and neither is metronomic | Equal or fixed timing |
| 1.4 | Watch the whole screen during a flash, not just the poster | The **hall, coffin and floor all brighten** with the flash | Only the cover changes |
| 1.5 | Leave the menu up for 2+ minutes | No slowdown, no flicker build-up, no console errors | Frame rate degrades |

## 2. Cursor visibility (fangs)

The fang cursor is the game's **only** pointer — the page hides the OS one.

| # | Do | Want | Fail |
|---|----|------|------|
| 2.1 | Sit on the main menu, move the mouse | Fangs visible and tracking | No cursor at all |
| 2.2 | Press START NIGHT, watch the cold open | Fangs **hidden** for the whole cutscene and coffin flight | Fangs tracking over the cutscene |
| 2.3 | The instant control lands (level music starts) | Fangs come back | Still hidden once you can move |
| 2.4 | Pause (Esc/P) | Fangs visible over the pause overlay | Nothing to aim Resume/Quit with |
| 2.5 | Die, land on the game-over screen | Fangs visible | RESTART unclickable-feeling |
| 2.6 | Win a night, reach the next night | Fangs stay visible across the transition | Fangs vanish between nights |
| 2.7 | Quit to Menu from pause | Fangs visible on the menu again | Hidden |
| 2.8 | Click and hold anywhere | Fangs bite (jaws close) and hold the bite briefly | No bite animation |

## 3. Opening cold open

| # | Do | Want | Fail |
|---|----|------|------|
| 3.1 | Start a fresh run, watch the squad assemble | **Every** hunter type present: swordsmen, wooden-spike, pitchfork, torch carriers, garlic throwers | Any type missing |
| 3.2 | Look at the head of the column | A **Priest** leads them | No Priest |
| 3.3 | Watch the throwers | They stand off at the **back**, further from the Count than the swordsmen | Throwers in the front line |
| 3.4 | Watch the whole squad walk in | They arrive together — nobody is still crossing the floor when the strike lands | Stragglers |
| 3.5 | The strike | The whole squad dies at once, blood flies to the meter, the Count retires to the coffin | Anything survives |
| 3.6 | Whole cold open | The Priest never casts his ward during it | A ward goes off mid-cutscene |

## 4. The Count — art and animation

| # | Do | Want | Fail |
|---|----|------|------|
| 4.1 | Stand still and look at him | Dark **green** robe, purple sleeve, grey face, dark red shoes | Robe black/charcoal (chroma key ate it) |
| 4.2 | Stand still ~5s | Idle **alternates two real poses** (a weight shift), not a floating single frame | One static frame, or a 1px bob |
| 4.3 | Hold **D** (right) | He runs **right** — faces right, cape trails left | Faces left |
| 4.4 | Hold **A** (left) | He runs **left** | Faces right |
| 4.5 | Hold **D** with the mouse far to the **left** | He **faces left** (the cursor wins — he is aiming, not steering) | — this is intended; see note at the bottom |
| 4.6 | Move the mouse in a full circle while standing still | He turns to follow it through all four directions | Sticks on one direction |
| 4.7 | Run **down-right** and watch every frame | **No frame where he looks left**. The toward-camera run only uses front/right-facing poses | A single left-facing frame per stride |
| 4.8 | Run **up** | Back view, legs alternating | A sideways frame |
| 4.9 | Click to attack | He rears up and roars, and a **magic burst is thrown out along the aim** | No burst, or burst on top of his face |
| 4.10 | Attack while facing each of the four directions | The swing plays and returns to idle cleanly every time | Frozen on the last attack frame |
| 4.11 | Compare him to a Hunter Captain | The Count is clearly the **biggest** thing on the field | Captain looks equal or bigger |

## 5. The Count — coffin, dash, deaths

| # | Do | Want | Fail |
|---|----|------|------|
| 5.1 | Start a night and **do not touch the mouse** | He lands out of the coffin facing **down** (into the room) and stays that way | Lands facing up / into a corner |
| 5.2 | Then move the mouse | He immediately starts following it | Stays locked down |
| 5.3 | Shift-dash | Turns into the bat, purple after-images, invulnerable burst, turns back | Body offset jumps on the swap |
| 5.4 | Die to hunters | 3-frame **fall**, he stays down, then the game-over screen | Burning frames on a hunter death |
| 5.5 | Let the timer run out (dawn) | Fall → **burning frames flicker** → **ash with smoke**, embers pouring off the whole time, then the screen | No fire, or an orange tint painted over the fire |
| 5.6 | Both deaths | No orange strobe tint over Romi's frames | Tinted |

## 6. Armed hunters (spike / pitchfork / torch)

| # | Do | Want | Fail |
|---|----|------|------|
| 6.1 | Night 1, look at the crowd | All three weapon types present **from night one**, alongside sword hunters | Any weapon missing on night 1 |
| 6.2 | Watch a carrier walk toward you | Weapon sits **in his hand**, overlapping his body — not floating beside him | Visible gap; prop looks like a separate object |
| 6.3 | Watch him walk sideways | The prop **rides his walk bob** — the join with his fist does not slide | Weapon stays still while his body bobs |
| 6.4 | Watch a **spike** attack | A **stab**: point comes to bear then drives straight in. No arc | Swings like a club |
| 6.5 | Watch a **pitchfork** attack | Same stab, from **noticeably further away** than a sword hunter | Same reach as a sword |
| 6.6 | Look at a pitchfork carrier | Fork is **roughly twice the spike's size** and its **butt end sticks out behind** his hand | Fork small, or balanced on his palm |
| 6.7 | Watch a **torch** attack | A **chop** through an arc, embers trailing | A stab |
| 6.8 | Watch a torch carrier walk around | Flame **flickers continuously** between two frames | Frozen flame |
| 6.9 | **Kill a torch carrier** and watch the corpse fade | The dropped torch **keeps flickering and smoking** until it disappears | Freezes on one frame |
| 6.10 | Kill a spike/pitchfork carrier | Weapon clatters to the floor and fades with the corpse | Vanishes instantly |
| 6.11 | Take a hit from each weapon | All cost **5 HP** — same as a sword | Any weapon hits harder |
| 6.12 | Hit a carrier mid-swing | He is knocked back and the swing is **cancelled** | Swing lands anyway |

## 7. Garlic throwers & spawn schedule

| # | Do | Want | Fail |
|---|----|------|------|
| 7.1 | Play all of night 1 | **Zero** garlic throwers | Any thrower on night 1 |
| 7.2 | Night 2 | At most **one** thrower alive at a time | Two or more |
| 7.3 | Night 4 | At most **three** at a time | More |
| 7.4 | Reach night 7+ | Never more than **five**, however long you play | Six or more |
| 7.5 | A thrower locks on | Green crosshair crawls from his feet onto you, locks, then a bulb is lobbed at the lock point | No telegraph |
| 7.6 | Dash through a locked throw | The dash's invulnerability carries you through clean | Damage anyway |
| 7.7 | Hit a plain thrower mid-lock | Lock is **broken** | Lock survives (that's Captain-only) |

## 8. The Priest & boss rules

| # | Do | Want | Fail |
|---|----|------|------|
| 8.1 | Reach **night 5** | The blood meter summons a **Priest alone** — no Captains | Captains instead of / alongside him |
| 8.2 | Night 5 banner and coffin hint | Both say **"the Priest"**, not "Hunter Captain" | Wrong name |
| 8.3 | Reach **night 10** | **Priest + one Captain** | Wrong lineup |
| 8.4 | Nights 1–4, 6–9 | Captains only, no Priest | Priest on a non-multiple of 5 |
| 8.5 | Look at the Priest | Navy cassock, gold cross, wooden stake; **bigger than a Captain**, smaller than the Count; correct facing all four ways | Wrong facing / size |
| 8.6 | **Watch a full ward** | Gold circle painted on the floor → a ring **closes inward on his body** → light sweeps out as **several staggered rings in different yellows** → a **giant golden cross** grows out trailing **sparkles** and lingers a beat after the rings die | Any part missing |
| 8.7 | **THE BIG ONE — hit him repeatedly mid-ward** | He is shoved but the ward **completes anyway**. Game keeps running | **Game freezes with audio still playing** — this was the crash, report immediately |
| 8.8 | **Kill him mid-ward** | Ward effects clean up, he topples over, game keeps running | Freeze |
| 8.9 | Walk out of the circle during the telegraph | You take no damage | Damaged anyway |
| 8.10 | Dash through the expanding edge | Clean, no damage | Damaged |
| 8.11 | Stand still inside the circle after the edge has passed | No second hit | Repeated damage |
| 8.12 | Watch a **Hunter Captain** before each swing | A **red** ring closes on him | No tell |
| 8.13 | Hit a Captain mid-swing | Shoved, but the swing **still lands** | Cancelled (that's hunter behaviour) |
| 8.14 | Watch a **garlic Captain** lock on | A **green** ring closes on him; hitting him does **not** break the lock | Lock breaks |
| 8.15 | Kill every boss on a night | Coffin activates (with a full meter) | Coffin stays inert |

## 9. Sky cycle

| # | Do | Want | Fail |
|---|----|------|------|
| 9.1 | Win a night, watch the day cycle | The sun crosses and **fully sets into the right-hand window** — it sinks to the horizon and fades out there | Sun blinks out mid-sky, still visibly high |
| 9.2 | Same transition, watch the moon appear | The moon **rises into the left-hand window** from the horizon | Moon already past the left window when it appears |
| 9.3 | Start of any night | Moon low in the left window, climbing | Moon mid-sky at t=0 |
| 9.4 | End of a night (sunrise) | Sun just rising in the left window as the timer runs out | Sun already high |
| 9.5 | Several nights in a row | Moon phase changes each night; time only ever runs forward | Sky rewinds |

## 10. Pause & audio editor

| # | Do | Want | Fail |
|---|----|------|------|
| 10.1 | Pause (Esc / P) | **PAUSED** blinks **unevenly** — roughly 1s visible, 0.5s hidden | Even blink, or no blink |
| 10.2 | Look at the Resume button | It **breathes** (gentle scale pulse), like START NIGHT on the menu | Static |
| 10.3 | Resume via Esc, P, and the button | All three work | Any dead |
| 10.4 | Quit to Menu | Returns to the menu with the lightning running, not into a run | Drops into gameplay |
| 10.5 | Open `?audioEditor=1` and press **F8** | Panel opens **and the normal OS mouse pointer appears** so sliders can be dragged | No system pointer |
| 10.6 | Drag a slider | Works normally; the fangs are still there underneath (expected) | Cannot aim |
| 10.7 | Press F8 to close | System pointer goes away again, fangs alone | Pointer stays |

## 11. Regression smoke

| # | Do | Want |
|---|----|------|
| 11.1 | Full run: menu → cold open → night 1 → win → night 2 | No console errors, no freezes |
| 11.2 | Die, press RESTART | New run starts, HP full, hunters move (physics resumed) |
| 11.3 | Play 3+ nights continuously | Frame rate stable; no growing pile of leftover effects |
| 11.4 | Mobile / touch (landscape) | Joystick, ⚔ and 🦇 buttons all work; rotate gate appears in portrait |
| 11.5 | `npm run build` then `npm run preview` | Production build behaves identically to dev |

---

## Known open question

**4.5 vs diagonal runs.** You asked for two things that pull against each other:
restore cursor-driven facing, *and* have up-left/up-right diagonals use the side
animation with the back view only on a lone **W**. With facing driven by the
cursor, the movement direction no longer selects an animation row at all, so the
diagonal rule has nothing to act on.

What shipped is cursor-driven facing (asked for as a restore) plus the frame-fix
that removes the left-looking frame you actually saw in the toward-camera run.
If you want the diagonal rule instead, facing has to go back on movement — say
which one wins and it is a small change either way.
