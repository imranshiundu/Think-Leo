# Think Leo — Brain Quests for Kids

A gamified thinking game for kids, starring **Leo the lion**. Built with the
loops that make Duolingo and Candy Crush sticky — streaks, XP, hearts, stars,
a winding level map, combo multipliers and a rich sound family — wrapped in a
kid-safe, phone-first experience that also runs great on laptops and tablets.

> **The full design & math is documented in [`docs/ALGORITHM.md`](docs/ALGORITHM.md).**

## What's inside

| | |
| --- | --- |
| **Leo** | Parametric SVG mascot with 9 moods (idle, happy, excited, sad, thinking, celebrate, wow, cheer, sleep), blinking, tail-wag and speech bubbles |
| **Startup animation** | The app icon drops in, the wordmark pops letter by letter, a cartoon parade marches, paw prints fill as the loading beat — a GSAP-timed show (once per session) |
| **40 levels, 4 worlds** | Jungle Jam · Coral Cove · Space Hop · Candy Peak — Candy-Crush-style winding map, locks, 3-star ratings, world chests, and a world-coloured wipe every time you enter a level |
| **12 mini-game types** | Count · Maths · Compare · Odd-one-out · Sequences · Times tables · True-or-Trap · Memory — plus four hands-on games: **Tap the Target**, **Shadow Match**, **Colour Patterns** and **Feed Leo** (counting you can feel) |
| **Levels always end** | Every finished run — any score, even practice — is recorded and opens the next level; the first level of each world opens after 3 finished levels of the previous one |
| **Kind hearts** | 1 heart back every 8 min, timeouts on learning levels cost nothing, Leo's free daily courage boost, and a practice mode (frozen hearts, half XP) so no kid is ever stuck |
| **Adrenaline** | Combo meter up to ×3, countdown ring, heartbeat vignette, screen shake, escalating combo sounds, and the **LEO RUSH ×2** finale |
| **Flow Ranger** | Adaptive difficulty breathes with the kid (§5.2 of the docs) |
| **Retention loops** | Daily goal ring, streak flame with freezes, weekly leagues, XP levels, quests, badges, comeback gifts |
| **Sound** | A synthesized SFX studio (correct/wrong voices, combo climbs, munches, boings) + three licensed Kevin MacLeod tracks that crossfade and duck like a real DJ |
| **A 3D touch** | The Space Hop world floats in a lazy-loaded three.js sky — starfield and low-poly planets that pause off-screen and never load in the other worlds |
| **Made for phones** | Installable from the browser ("Add to Home Screen"), full-screen, safe-area aware, fully offline — no jargon anywhere for parents |

## Stack

Next.js 16 (App Router) · TypeScript 5 · Tailwind CSS 4 · framer-motion ·
GSAP (splash timeline) · three.js (lazy Space Hop sky) · zustand (persisted
save) · Web Audio API · sharp (icon pipeline).
No database needed for play — a kids' game must be private and offline-first
(an optional SQLite store only logs anonymous device visits).

## Run

```bash
bun install        # or npm install
bun run dev        # dev server on :3000
bun run lint       # eslint
bun scripts/sim-v4.ts   # logic regression: unlocks, question factory, practice guarantee
bun scripts/make-icons.mjs   # regenerate the app icons from Leo's face
```

Open the app on a **phone** (or anything with a browser), tap **PLAY**, keep
hearts alive and chase the 3-star finish. Keys `1–4` answer puzzles on
laptops.

## Layout

```
src/
  app/            layout (fonts, app meta) · page · globals.css (juice layer)
  lib/
    game.ts       economy: worlds, XP, stars, combos, hearts, streaks, unlocks
    questions.ts  seeded puzzle factory (12 mini-games) + Flow Ranger inputs
    sound.ts      Web Audio engine (SFX family + 3 licensed tracks)
    store.ts      zustand + localStorage save (v4 schema)
    device.ts     device detection (labels only — everyone plays)
    deviceInfo.ts anonymous device snapshot → /api/device + local log
  components/
    leo/          Leo.tsx (mascot) · stickers.tsx (44 hand-drawn SVG stickers)
    game/         Splash · Home · LevelMap · Play · SpaceSky · bits (UI kit)
public/           manifest · sw.js · icons · audio (Kevin MacLeod, CC BY 4.0)
docs/ALGORITHM.md the whole design, with citations
```
