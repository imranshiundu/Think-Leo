# BEHAVIOUR AUDIT — how the app runs, sounds, and breathes

> **The health check:** every sound's start, end and envelope; the music's
> screen-to-screen rhythm; the flow of screens, timers and transitions; and a
> responsiveness sweep of every surface on a small phone. Written after the
> v10 audit pass — each finding below links to the fix that landed.

---

## 1 · The sound contract (when each cue starts, and how it ends)

Every cue is synthesized live (no samples) over one shared instrument palette:
**marimba** (the "correct" voice), **pluck** (arps), **chime** (stars/magic),
**horn** (soft fails), **kick/snare/hat** (drums), **riser** (ignitions),
**roar** (the character voice). One synthesized impulse-response gives
everything the same "room"; a master compressor (−18 dB, 4:1) protects kids'
ears when they crank the volume.

### 1.1 Envelope grammar — how sounds END

| Instrument | Start | End |
| --- | --- | --- |
| marimba | 6 ms attack, exponential bloom | decays to silence over **0.34 s**, +0.08 s oscillator tail buffer |
| pluck | 6 ms | **0.22 s**, lowpass pinned to `5×freq` so highs never buzz |
| chime | 6 ms | **0.6 s** shimmer with 2.76× + 5.4× partials, wet into reverb |
| horn | **30 ms** soft attack (never a buzzer) | 0.17–0.34 s fall, filtered to 900 Hz |
| kick / thud | 2–4 ms | pitch glides **down** (150→44 Hz / 96→52 Hz) — landing, not beeping |
| noise hits | instant (percussion) | 35–140 ms filtered decay |
| roar | 120 ms growl-in | 0.85 s fall of three detuned saws + breath noise |

**The ending rule:** every gain envelope ramps to `0.0001` *before* the
oscillator stops (`at + dur`, stop at `+0.08`) — no node ever cuts mid-air, so
there are no clicks. Nothing loops except the three music tracks.

### 1.2 The cue map — trigger → sound → rhythm

| Moment | Cue | Timing |
| --- | --- | --- |
| Any button | `click` (marimba C5 + air tick) | fires with the tap |
| Correct answer | `correct` major arp (C-E-G, 70 ms apart, panned L-C-R) | immediately |
| Streak ≥ 3 | `combo` — one motif, root climbs a semitone per step; marimba joins at 5, chime at 7, snare+arp at 10 | +140 ms after correct |
| Wrong answer | `wrong` — two-note horn "hmm" | immediately |
| Time out | `timeUp` — two woodblock knocks winding DOWN + rising "try again" chirp at +0.5 s | immediately |
| Heart lost | `heartLost` sine fall + thud | **+240 ms** (after wrong, so the two reads don't smear) |
| Last 5 s | `tick` each whole second | countdown interval |
| Last 3.5 s | `pulse` heartbeat (kick-kick) | every 1.1 s while danger |
| Round 8 done | `whoosh` + `rushGo` (0.75 s riser → kick → arp) | at rush intro; phase flips 1.7 s later |
| Rush combo | `combo(nc+2)` | with each hit |
| Results | `fanfare` (music ducks), `star(i)` chimes 600/980/1360 ms, `leagueUp` +700 ms | staggered with the star slam animation |
| Zero stars | `sadTrombone` — 3 soft horn falls | immediately |
| Level wipe | `wipe` — 0.5 s curtain whoosh + thud landing **at 0.42 s** (the curtain peaks) | fires the moment the tap commits |
| Chest / quest / gift | `chestOpen`, `questClaim`, `questDone`, `welcomeBack`, `achievement`, `goalDone` | on claim success only — the cue never lies |
| Badge toast | `achievement` (two chimes) | when the toast slides in |
| Merge pop | `mergePop` — pitch climbs with tier **and** chain step | every fusion; chime at chain 3, fireworks at 5 |
| Creature lands | `dropBall(tier)` — big creatures land HEAVY (pitch & vol scale) | on release |
| Egg crack | `eggCrack` ×3 milestones at 22/50/80% of the hold | inside the hold rAF, one per stage |
| Egg burst | `eggBurst` major arp (music ducks) | crack = 1, once |
| Leo born | `goldenRoar` — roar + chime ladder + kick | the arcade's jackpot |
| Arcade over | `arcadeOver` — soft thud + horn slide | invitation, never a buzzer |

### 1.3 Where sounds may NOT start

`guard()` is the gate: SFX only schedule when the AudioContext is **running**
(or mid-resume from a real gesture — the `resuming` flag from
`unlock(fromGesture)`). Why: `currentTime` freezes while a context is
suspended, so every cue scheduled then piles onto the same instant and would
**blast simultaneously** the first time sound unlocked. The splash's whoosh +
roar used to do exactly this; now pre-gesture cues are silently dropped and
the visuals carry the show until the first tap — then paw prints tick and the
fanfare plays for real.

## 2 · Music — the screen-to-screen rhythm

Three licensed tracks (Kevin MacLeod, CC-BY), one per mood:

| Mood | Track | Where | Level |
| --- | --- | --- | --- |
| `home` | "Carefree" | hub, map, results, out-of-hearts | 0.50 |
| `play` | "Monkeys Spinning Monkeys" | intro, play, reveal, rush intro | 0.42 |
| `rush` | "Sneaky Snitch" | LEO RUSH + the whole LEO POP arcade | 0.52 |

**The contract (fixed in v10):** the shell owns hub↔screen switches
(home/map → `home`); Play owns its *phases* — `intro|play|reveal|rushIntro →
play`, `rush → rush`, `results|out → home`. Before the fix, replay and
practice fell through the phase map and ran whole levels on the hub track,
and every next-level transition stacked two crossfades.

**Manners:** crossfades are per-element rAF ramps (outgoing and incoming never
cancel); `duck()` dips music to 22% for ~950 ms under fanfares/level-ups and
rides back over 700 ms; the tab hiding pauses music (battery); autoplay-blocked
requests are remembered and retried on the first gesture.

## 3 · Behaviour — how things run

**Screen flow:** splash (3.7 s, skippable) → home ⇄ map ⇄ play; home →
arcade/eggs/feed. Every jump into a level or arcade is a 1.25 s curtain wipe:
circle bursts to 78% in 0.52 s, the world card springs in at 0.18 s, the view
swaps at 0.56 s (mid-cover), the curtain fades by 1.25 s. Wipe state is
ref-guarded — a double-tap can't stack two curtains or double the sound.

**A level:** 8 rounds × 11 mini-game types; each answer → 0.9 s (correct) /
1.6 s (wrong) reveal → advance. Flow Ranger bends difficulty after streaks of
3 right / 2 wrong. LEO RUSH: 200 rapid questions in 12 s, ×2 points, no heart
loss. Every finished run records — stars open the next level even at 0 stars.

**Endings, everywhere:** intro/out/results are scrollable; the wipe can't be
re-entered mid-flight; quest toasts clean their timers; the quest chest only
opens when actually reached; the refill button plays its flame cue **only**
when the refill succeeds; out-of-hearts always offers a free path (practice).

## 4 · Responsiveness — the small-phone verdict

**Fixed in this pass:**

| Finding | Fix |
| --- | --- |
| `h-screen` on Play/Home/Map/Feed — iOS URL bar ate the bottom of the answer grid, no scroll escape | `h-dvh` everywhere the app renders |
| Play/reveal phase had **no scroll fallback** and `justify-center` clipped the TOP of tall count-boards on short screens | scroll container + `m-auto` centring (centres when it fits, never clips when it doesn't) |
| HUDs ignored `safe-area-inset-top` — the first row sat under the notch on all five screens | `pt-[max(0.75rem,env(safe-area-inset-top))]` on Play/Map/Feed HUDs + achievement toasts; Parent HQ/Zoo sheets gained bottom insets |
| Exit pills ~31 px — the MAP button during a timed game | `min-h-[44px]` on Play exit, Map back/LEO POP, Feed home, LeoPop home/zoo, sound toggles → 44 px squares, quest Claim 44 px |
| Home hero (Leo 185 + ring 92 = 293 px) clipped its card at 360 px | hero wraps now |
| Map nodes shrank to ~31 px touch at 360 px (0.53× scale) | invisible `after:-inset-4` hit-ring → ~48 px effective; stars 13→16 |
| FeedLeo take-back snacks were 22 px targets | padded to 38 px hit area without moving the art |
| LeoPop jar `min-h-[330px]` beat `max-h-[58vh]` in landscape and overflowed the screen | deterministic `h-[clamp(250px,52dvh,440px)]` |
| LeoPop physics walls baked once per run — balls **escaped the jar** after rotating the phone | walls tracked in a ref + rebuilt on every jar re-measure mid-run |
| SpaceSky/PopSky/FeedSky never resized — stale aspect + buffer after rotation | `ResizeObserver` + `camera.aspect` + `setSize(nw, nh, false)` (Egg3D's pattern) |
| 8–9 px kid-facing text (egg costs, "CAN GROW!", rarity chips) | ≥10–11 px |
| Grey tap flash, rubber-banding, 300 ms tap delay, stray text selection | tap-highlight transparent, `overscroll-behavior: none`, `touch-action: manipulation`, `user-select: none` (inputs exempt) |
| Reduced-motion only covered 11 of the custom anims | all 14 + heartbeat/shake/pop/slam |
| `PhoneGate.tsx` — stale "laptop-only" dead code | deleted |

**Verified good:** answer bubbles `min-h-[64px]`, memory pads 96 px, TapTarget
52 px, hold-to-open parent gates, safe-area bottoms on all bottom consoles,
grid collapse on every screen, DPR caps + `visibilitychange` pauses + full
WebGL disposal on every canvas, focus-visible rings, coloured answer art for
pre-readers, 64 px timer ring.

## 5 · Sound-behaviour purity rules the code now follows

1. **No side effects in state updaters** — sound/timers live outside
   `setWipe`/`setRushCombo`/`setCrack` (React StrictMode double-invokes
   updaters; a cue inside one plays twice).
2. **Cues never lie** — `flame()` only fires when the refill/boost actually
   succeeded; `chestOpen`/`questClaim` only on successful claims.
3. **One cue per interaction by design** — layered cues (click + wipe,
   click + whoosh on the arcade launch) are intentional choreography, not
   accidents.
4. **Timers are cleaned** — quest toasts, splash, memory pads, popcorn
   cascades, danger heartbeats all clear on unmount.
5. **Nothing schedules pre-gesture** — the guard drops it; music waits for
   `unlock()` and retries.
