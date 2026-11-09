# 🦁 Think Leo — Brain Quests for Kids

A gamified thinking-game PWA for kids, starring **Leo the lion**. Built with
the loops that make Duolingo and Candy Crush sticky — streaks, XP, hearts,
stars, a winding level map, combo multipliers and a synthesized sound family —
wrapped in a kid-safe, laptop-only experience.

> **The full design & math is documented in [`docs/ALGORITHM.md`](docs/ALGORITHM.md).**

## ✨ What's inside

| | |
| --- | --- |
| 🦁 **Leo** | Parametric SVG mascot with 7 moods, blinking, tail-wag and speech bubbles |
| 🚀 **Startup animation** | Spring-in splash with letter-pop wordmark, star burst & fanfare (once per session) |
| 🗺️ **40 levels, 4 worlds** | 🌴 Jungle Jam · 🌊 Coral Cove · 🚀 Space Hop · 🍭 Candy Peak — Candy-Crush-style winding map, locks, 3-star ratings, world chests |
| 🧩 **8 mini-game types** | Count · Maths · Compare · Odd-one-out · Sequences · Times tables · True-or-Trap · Simon-style Memory |
| ⚡ **Adrenaline** | Combo meter up to ×3, countdown ring, heartbeat vignette, screen shake, escalating combo sounds, and the **LEO RUSH ×2** finale |
| 🧠 **Flow Ranger** | Adaptive difficulty breathes with the kid (§5.2 of the docs) |
| 🔥 **Duolingo loops** | Daily goal ring, streak flame with freezes, weekly leagues, XP levels, hearts (1 per 15 min) |
| 🔊 **100% synthesized audio** | Web Audio engine — every ding, fanfare and the home/level music loop; zero audio files |
| 💻 **Laptop-only by design** | Phones & tablets get a friendly gate screen — the game never runs on mobile |
| 📴 **Offline PWA** | Installable, service-worker cached, saves locally, works with no network |

## 🛠 Stack

Next.js 16 (App Router) · TypeScript 5 · Tailwind CSS 4 · framer-motion ·
zustand (persisted save) · Web Audio API · sharp (icon pipeline).
No database by design — a kids' game must be private and offline-first.

## ▶ Run

```bash
bun install        # or npm install
bun run dev        # dev server on :3000
bun run lint       # eslint
bun scripts/make-icons.mjs   # regenerate PWA icons from Leo's face
```

Open the app on a **laptop/desktop**, click **▶ PLAY**, keep hearts alive and
chase the 3-star finish. Keys `1–4` answer puzzles.

## 📁 Layout

```
src/
  app/            layout (fonts, PWA meta) · page · globals.css (juice layer)
  lib/
    game.ts       economy: worlds, XP, stars, combos, hearts, streaks, leagues
    questions.ts  seeded puzzle factory + Flow Ranger inputs
    sound.ts      Web Audio engine (SFX family + music loop)
    store.ts      zustand + localStorage save
    device.ts     laptop-only gate logic
  components/
    leo/Leo.tsx   the mascot + wordmark
    game/         Splash · PhoneGate · Home · LevelMap · Play · bits (UI kit)
public/           manifest · sw.js · icons
docs/ALGORITHM.md the whole design, with citations
```
