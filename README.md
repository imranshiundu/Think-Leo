# Think Leo — Brain Quests for Kids

A gamified thinking game for kids, starring **Leo the lion**. Built with the
loops that make Duolingo and Candy Crush sticky — streaks, XP, hearts, stars,
a winding level map, combo multipliers and a rich sound family — wrapped in a
kid-safe, phone-first experience that also runs great on laptops and tablets.

> **The bookshelf:** design & math in [`docs/ALGORITHM.md`](docs/ALGORITHM.md) · every icon in [`docs/ICONS.md`](docs/ICONS.md) · every animation in [`docs/ANIMATIONS.md`](docs/ANIMATIONS.md) · the whole journey in [`docs/END-TO-END.md`](docs/END-TO-END.md) · how it runs & sounds in [`docs/BEHAVIOUR-AUDIT.md`](docs/BEHAVIOUR-AUDIT.md) · the kid test in [`docs/KID-TEST.md`](docs/KID-TEST.md)

## What's inside

| | |
| --- | --- |
| **Leo** | Parametric SVG mascot with 9 moods (idle, happy, excited, sad, thinking, celebrate, wow, cheer, sleep), blinking, tail-wag and speech bubbles |
| **Startup animation** | The app icon drops in, the wordmark pops letter by letter, a cartoon parade marches, paw prints fill as the loading beat — a GSAP-timed show (once per session) |
| **60 levels, 6 worlds** | Jungle Jam · Coral Cove · Space Hop · Candy Peak · Farm Days · Road Rush — Candy-Crush-style winding map, locks, 3-star ratings, world chests, and a world-coloured wipe every time you enter a level |
| **11 mini-game types** | Count · Maths · Compare · Odd-one-out · Sequences · Times tables · True-or-Trap · Memory — plus three hands-on games: **Tap the Target**, **Shadow Match** and **Feed Leo** (counting you can feel) |
| **Levels always end** | Every finished run — any score, even practice — is recorded and opens the next level; the first level of each world opens after 3 finished levels of the previous one |
| **Kind hearts** | 1 heart back every 8 min, timeouts on learning levels cost nothing, Leo's free daily courage boost, and a practice mode (frozen hearts, half XP) so no kid is ever stuck |
| **Adrenaline** | Combo meter up to ×3, countdown ring, heartbeat vignette, screen shake, escalating combo sounds, and the **LEO RUSH ×2** finale |
| **Flow Ranger** | Adaptive difficulty breathes with the kid (§5.2 of the docs) |
| **LEO FEED** | The infinite surprise feed (the Instagram-brain game): an endless stream of mystery cards — tap, watch the GSAP unwrap ritual glow and wobble harder, and meet one of 16 collectible friends across 5 rarities. Variable-ratio rewards, a gold near-miss tease, a visible pity meter, a HEAT meter that charges into a guaranteed MEGA card, an affinity table so the feed learns favourite friends, a free daily MEGA gift and a 3D three.js galaxy behind it all — zero maths, ever |
| **LEO POP** | The merge arcade: drop friends in a physics jar, fuse two of a kind, chase the Golden Leo, collect the 10-creature Zoo Book — no maths, just popping |
| **LEO EGGS** | The surprise-egg arcade: pick an egg, press and HOLD, watch the three.js egg shake, crack and burst — 13 collectible friends across 5 rarities, a golden near-miss tease, a visible pity meter, a real-time nest that keeps incubating after the app closes, streak-powered luck and a friends album + room |
| **Retention loops** | Daily goal ring, streak flame with freezes, weekly leagues, XP levels, quests (levels + arcade + eggs share ONE board), badges, comeback gifts |
| **Parent HQ (v8)** | The grown-up side of the door: press-and-hold for 2.5 s to enter — today's play minutes, per-skill mastery bars from the Flow Ranger data **grouped by CBC Mathematical Activities strand**, the daily play window (15/30/60 min or open) with a gentle nap screen when it runs out, +15 min extensions, and a hold-gated reset |
| **Save code (v9)** | A portable code in Parent HQ moves a kid's whole progress (stars, streak, collections) between devices — copy on the old phone, hold-to-restore on the new one; checksummed, line-wrap-proof, and nothing ever leaves the devices |
| **First-run tour (v9)** | Four Leo-narrated beats on first launch (map, arcades, streak flame) — skippable, once only; plus colour+shape right/wrong badges and visible keyboard focus |
| **Sound** | A synthesized SFX studio (correct/wrong voices, combo climbs, egg cracks, bursts, roars) + three licensed Kevin MacLeod tracks that crossfade and duck like a real DJ |
| **A 3D touch** | The Space Hop world floats in a lazy-loaded three.js sky; the LEO EGGS egg is a fully interactive three.js object — drag it, hold it, crack it |
| **Made for phones** | Installable from the browser ("Add to Home Screen"), full-screen, safe-area aware, fully offline — no jargon anywhere for parents |

## Stack

Next.js 16 (App Router) · TypeScript 5 · Tailwind CSS 4 · framer-motion ·
GSAP (splash + feed unwrap timelines) · three.js (Space Hop sky, the LEO
EGGS egg, the LEO FEED galaxy) · matter-js (LEO POP jar physics) · zustand (persisted save) ·
Web Audio API · sharp (icon pipeline).
No database needed for play — a kids' game must be private and offline-first
(an optional SQLite store only logs anonymous device visits).

## Run

```bash
bun install        # or npm install
bun run dev        # dev server on :3000
bun run lint       # eslint
bun scripts/sim-v4.ts    # logic regression: unlocks, question factory, practice guarantee
bun scripts/sim-feed.ts  # feed regression: rarity table, pity, MEGA, affinity, streak luck
bun scripts/sim-store.ts # save-state regression: levels always end, streaks always record, feed economy
bun scripts/sim-savecode.ts # save-code regression: round-trip, line-wrap, tamper & garbage proof
bun scripts/make-icons.mjs   # regenerate the app icons from Leo's face
bun scripts/docs-mood-gallery.tsx # regenerate the mood gallery in docs/assets/
```

Open the app on a **phone** (or anything with a browser), tap **PLAY**, keep
hearts alive and chase the 3-star finish — or slip over to **LEO POP**, **LEO EGGS** and
**LEO FEED** when the brain needs pure fun. Keys `1–4` answer puzzles on
laptops.

## Layout

```
src/
  app/            layout (fonts, app meta) · page · globals.css (juice layer)
  lib/
    game.ts       economy: worlds, XP, stars, combos, hearts, streaks, unlocks
    questions.ts  seeded puzzle factory (12 mini-games) + Flow Ranger inputs
    arcade.ts     LEO POP design brain (chain, weights, golden eggs)
    eggs.ts       LEO EGGS design brain (rarities, tease, pity, nest)
    feed.ts       LEO FEED design brain (variable rewards, near-miss, heat, pity, affinity)
    sound.ts      Web Audio engine (SFX family + 3 licensed tracks)
    store.ts      zustand + localStorage save (v7 schema — one economy)
    device.ts     device detection (labels only — everyone plays)
    deviceInfo.ts anonymous device snapshot → /api/device + local log
  components/
    leo/          Leo.tsx (mascot) · stickers.tsx (44 hand-drawn SVG stickers)
    game/         Splash · Home · LevelMap · Play · SpaceSky · bits (UI kit)
    arcade/       LeoPop (matter-js jar) · PopSky · ZooBook
    eggs/         EggGame (hold-to-crack loop) · Egg3D (three.js egg) ·
                  EggAlbum (collection) · EggRoom (care surface)
    feed/         FeedGame (the infinite feed) · FeedSky (three.js galaxy)
public/           manifest · sw.js · icons · audio (Kevin MacLeod, CC BY 4.0)
docs/ALGORITHM.md the whole design, with citations
```
