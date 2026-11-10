# Think Leo — The Animation Book

> How everything moves, and why. Five motion engines share one job: make a
> 5-year-old *feel* the game without a single word. Every parameter below is
> the real shipped value, lifted from the source.

---

## 1. The five motion engines

| Engine | File(s) | What it owns |
| --- | --- | --- |
| **framer-motion** | `Leo.tsx`, `bits.tsx`, `Play.tsx`, every screen | React-state motion: moods, stamps, star pops, screen transitions, the nap flip |
| **GSAP** | `Splash.tsx`, `FeedGame.tsx` | Timed *shows*: the 3.7 s startup timeline, the feed unwrap ritual |
| **CSS keyframes** | `globals.css` (`anim-*` utility classes) | Infinite ambient loops — cheap, GPU-friendly, auto-cleaned |
| **three.js** | `Egg3D.tsx`, `FeedSky.tsx`, `SpaceSky.tsx` | The 3D layer: holdable egg, feed galaxy, Space Hop sky (all lazy-loaded) |
| **matter-js** | `LeoPop.tsx` | Physics: the merge-jar drops, fuses and pops |

---

## 2. Leo — the mascot motion system

Leo's whole body is data. A `Look` per mood picks eyes / pupils / brows /
mouth / paws, a `bob` variant picks the body loop, and framer-motion runs
three independent loops on top (blink, tail, raised paws). Gallery of all
moods: [`ICONS.md` §2](ICONS.md#2-leo-himself--the-living-logo).

### The 9 moods (`LOOKS` table in `src/components/leo/Leo.tsx`)

| Mood | Eyes | Mouth | Paws | Body loop | When a kid sees it |
| --- | --- | --- | --- | --- | --- |
| `idle` | open, blinking | smile | down | gentle float | resting, between questions |
| `happy` | open | open smile | up | bounce (−18 px, 0.62 s) | correct answer, full bowl |
| `excited` | wide | open | up | bounce | combos ≥ 5, level intro, splash icon |
| `sad` | pupils down 3, sad brows | frown | down | slow droop sway | a miss, timeout, no hearts |
| `thinking` | pupils up-right, one raised brow | flat | **paw on chin** | held still | hints, Feed Leo counting |
| `celebrate` | **star eyes** | open | up | dance (−11 px + rotate ±4°) + sparkles | level clear, 1–2 stars |
| `wow` | wide | **ooh** (round) | down | pop-jump (−30 px) + squash | LEO RUSH ignition |
| `cheer` | **star eyes** | open | up | victory jumps (−26 px) + hip twist ±7° | 3-star runs |
| `sleep` | closed | flat | down | slow breathe (scaleY 1.04, 3.4 s) + drifting zzz | before 6 AM |

### The always-on loops

| Loop | Motion | Timing |
| --- | --- | --- |
| **Blink** | both eyes scaleY squash to 0.12 | every 4.2 s, squashed 44 %→52 % of the loop — a real blink, not a flicker |
| **Tail** | rotate −3°→+6° around the base | 2.2 s ease-in-out, infinite |
| **Paws up** | y −6 px bounce | 0.5 s, only when `paws: "up"` |
| **Sparkles** | three `Sparkle` marks drifting (`anim-drift`, 5 s) at staggered delays (0 / 1.2 / 2.1 s) | moods celebrate · excited · wow · cheer |
| **Speech bubble** | spring 380 / 22, scale 0.4→1, tail rotates in | every praise, hint and greeting |

**Design intent:** Leo is the *emotional scoreboard* — a pre-reader who can't
parse "Wrong, try again" still reads sad-eyes + frown + droop instantly, and a
3-star run *pays out* in star-eyed hip-twisting jumps. The mood table with
triggers lives in [`ALGORITHM.md` §10](ALGORITHM.md#10-leo-the-mascot-state-machine).

---

## 3. The startup show (GSAP, ~3.7 s, once per session)

The first thing a kid sees after tapping the Think Leo icon — so the **app
icon itself** performs. Six beats, one GSAP timeline in `Splash.tsx`
(`defaults: ease "power2.out"`), audio cues bolted on with `.call()`:

| Beat | t (s) | Motion | Sound |
| --- | --- | --- | --- |
| 1. The icon drops in | 0.10 | y −220→0, scale 0.35→1, rotate −18°→0, `elastic.out(1, 0.55)` (0.75 s) — it *wobbles* like jelly on landing | whoosh + roar |
| 2. Wordmark pops | 0.55 | each letter scale 0→1, y +26→0, `back.out(2.2)`, stagger 0.055 — "Think " letter-by-letter, "Leo!" as one gradient word | — |
| 3. Shine sweep | 1.15 | a skewed white bar sweeps xPercent −140→240 across the wordmark (0.6 s) | — |
| 4. Parade marches | 1.00→3.6 | 8 world stickers (elephant → monkey → parrot → dolphin → rocket → cupcake → butterfly → candy) cross the full width, stagger 0.12, each bobbing y −8 px ×7; Leo wiggles at the corner | — |
| 5. Paw prints fill | 1.45 → +0.16 each | 8 paw stamps pop in `back.out(2.4)` — the loading bar | a tick per paw (last one accents) |
| 6. Star burst | 2.75 | `StarPop` scale 0→1, rotate −140°→0, `back.out(2)` | fanfare |
| Exit | 3.05 / 3.70 | curtain lifts y → −102 % (0.62 s, custom cubic) — owned by the root, so it doubles as the **hydration cover** (no unhydrated flash, ever) | — |

Tap **anywhere** to skip; repeat visits in the same session get a 0.75 s logo
card with a pop sound.

---

## 4. The ambient CSS library (`globals.css`)

Fourteen `anim-*` utilities — every infinite loop in the app is one of these,
so they cost nothing and stop together under reduced-motion:

| Class | Keyframes | Loop | Where it's used |
| --- | --- | --- | --- |
| `anim-float` | y ±9 px | 3.2 s | idle décor, orbs |
| `anim-wiggle` | rotate ±2.5° | 2.4 s | the wordmark's Leo, logos, CTA lions |
| `anim-flame` | scale 1→1.12 + rotate ±2°, origin bottom | 0.9 s | the streak flame |
| `anim-shake` | x ±7 px quake | 0.5 s, once | a wrong answer |
| `anim-pop` | scale 0.4→1.08→1 | 0.35 s, once | anything that just arrived |
| `anim-heartbeat` | double-thump scale 1→1.22 | 1 s | the timer at ≤ 5 s, low-heart warnings |
| `anim-pulse-ring` | green ring expanding to 16 px | 1.6 s | the current level node on the map |
| `anim-drift` | y ±14 px + rotate ±8° | 5 s | sparkles, floating stickers |
| `anim-spin-slow` | 360° | 14 s | background suns, UFO idle |
| `anim-ring` | scale 0.25→2.4, fade | 0.7 s, once | tap ripples, level-open pop |
| `anim-slam` | scale 0.2→1.18→1 | 0.5 s, once | stamps and slams |
| `anim-bob-x` | x ±7 px | 3.4 s | things that sway side-to-side |
| `.trail-march` | dashed path marching (`leo-march`) | — | the map's dotted trail "walks" |
| `.rush-lines` / `.rush-aura` | bg pan 240 px / opacity breathe | — | the LEO RUSH racing streaks + aura |

---

## 5. The play loop, moment by moment (`Play.tsx`)

| Moment | Animation | Spec |
| --- | --- | --- |
| Enter a level | **world-coloured wipe** — a full-screen panel in the world's colour sweeps over (root-owned, 1.25 s, with a `wipe()` swoosh); also used for arcade doors | `ThinkLeo.tsx` |
| Level intro | Leo `excited` + bubble "Ready to think fast?"; card springs in scale 0.94→1 | framer default |
| Question arrives | card + answers `anim-pop` in; shadow answers are **coloured stickers**, never silhouettes | v6 kid-test fix |
| Correct | tapped card glows green, `anim-pop`; combo meter climbs; at ≥ 5 combo Leo goes `excited` | combo sounds escalate |
| Wrong | card **shakes** (`anim-shake` 0.5 s) and glows berry; the right one glows leaf; Leo `sad` + teaches the hint | free retry, fresh timer |
| Time pressure | **TimerRing** — a 64 px dial (kid-tested: the old 28 px ring was invisible to pre-readers); stroke `leaf`→`berry` at ≤ 5 s while the whole ring `anim-heartbeat`s | `TimerRing` in `Play.tsx` |
| Timeout | **TIME'S UP!** stamp: scale 2.2→1, rotate 10°→−6°, spring 320/15, berry border, wobbles once, `timeUp()` SFX (a square-wave "knock-knock" then a gentle marimba rise — a beat, not a punishment) | `AnimatePresence` |
| **LEO RUSH ×2** | Leo `wow` pop-jumps, racing `rush-lines` + breathing `rush-aura` over the screen, ×2 chip pulses; 12 s where hearts can't be lost | §506 `Play.tsx` |
| Level clear | **StarRow** pops star-by-star: spring 300/12, delays 0.25 / 0.60 / 0.95 s — the score you can *hear*; Leo `celebrate` (1–2★) or `cheer` (3★) | `bits.tsx` |
| League / XP ups | banner slams in (`anim-slam` family), confetti burst | `bits.tsx` |
| Nap screen | the play-window lock fades to a sleeping Leo (mood `sleep`, zzz drifting) — the day is done, gently | `ParentHQ.tsx` |

---

## 6. The arcades — the big shows

| Arcade | The motion story |
| --- | --- |
| **LEO FEED** | A mystery card idles wobbling harder and harder while its rarity-coloured glow breathes (`anim-drift` + GSAP wobble tween); tap and the **unwrap ritual** runs — a GSAP timeline whose *duration scales with rarity*: wobble grows → glow flares → burst → friend pops out with `anim-pop`. A gold **near-miss** tease shimmers when the pity table says "you almost had a MEGA"; the pity & HEAT meters fill in real time; the three.js galaxy behind it all drifts on parallax |
| **LEO EGGS** | Press and **HOLD**: the three.js egg shakes harder the longer you hold, cracks spider out, then bursts — 3D you can feel. The nest keeps incubating after the app closes (real-time), so returning kids find eggs hatched |
| **LEO POP** | matter-js physics: dropped friends tumble and stack in the jar; two of a kind **fuse** upward in the merge chain toward the Golden Leo; pops spray particles |
| **Space Hop** | a lazy-loaded three.js starfield parallax behind the world's levels |

---

## 7. Calm by default: reduced motion & performance

- `globals.css` ends with a **`prefers-reduced-motion` block** that switches
  off every infinite ambient loop (`anim-float`, `anim-wiggle`, `anim-flame`,
  `anim-drift`, `anim-spin-slow`, `anim-pulse-ring`, `anim-bob-x`,
  `trail-march`, `rush-lines`, `rush-aura`, `anim-ring`) — the game stays
  playable and still, for kids (and parents) who need it.
- Every loop animates **transform / opacity only** — no layout thrash, no
  re paints on the hot path.
- GSAP timelines are **killed on unmount** (`Splash` cleanup), so a skipped
  splash never leaks tweens.
- three.js scenes are **lazy-loaded chunks** — the egg, galaxy and space sky
  cost nothing until their arcade opens.
- Infinite CSS loops are preferred over JS loops for ambient motion: the main
  thread stays free for taps and sound.
