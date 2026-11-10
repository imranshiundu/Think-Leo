# Think Leo — The Algorithm Book

> Everything that makes Think Leo *feel* the way it does: the loops, the math,
> the sounds, the lion. Written to be read by a designer, an engineer, or a
> curious 10-year-old.
>
> Code map: `src/lib/game.ts` (economy) · `src/lib/questions.ts` (puzzle
> factory) · `src/lib/sound.ts` (audio engine) · `src/lib/store.ts` (save
> state) · `src/lib/device.ts` (device detection) · `src/components/leo/Leo.tsx`
> (mascot) · `src/components/game/*` (screens).
>
> **Sibling books:** every icon → [`ICONS.md`](ICONS.md) · every animation →
> [`ANIMATIONS.md`](ANIMATIONS.md) · the whole journey → [`END-TO-END.md`](END-TO-END.md) ·
> the kid test → [`KID-TEST.md`](KID-TEST.md)

---

## 1. Design research — what we copied, and from whom

### 1.1 How Duolingo works (and what we borrowed)

Duolingo lifted its retention from ~12% to ~55% by replacing "study sessions"
with a tight, high-frequency game loop (StriveCloud case study). Its engine has
four gears:

| Duolingo gear | What research says | Think Leo equivalent |
| --- | --- | --- |
| **Streaks** | A 7-day streak makes a user **3.6× more likely to stay engaged long-term** (Orizon analysis of Duolingo data) | 🔥 Streak flame with milestone freezes (§7) |
| **XP & levels** | XP drives ~40% more weekly engagement; one currency feeds many meters (Ptengine case study) | XP feeds the daily ring, player level, weekly league (§6) |
| **Leagues** | Social comparison without real friends = safe competition | 6 cosmetic weekly tiers: 🌱→🥉→🥈→🥇→💎→🏆 (§6.4) |
| **Mascot encouragement** | Duo's emotional design keeps sessions human; rare moments feel "enormous" | Leo reacts to every answer with mood + voice bubble (§10) |

**The one-currency trick** (documented in Duolingo strategy breakdowns): every
lesson simultaneously advances the streak, the daily goal, the league and the
XP level. In Think Leo, `addXp()` is the *only* way XP enters the system — it
updates `todayXp`, `weekXp`, the streak and `xp` in one atomic action
(`src/lib/store.ts`).

### 1.2 How Candy Crush works (and what we borrowed)

Yu-kai Chou's Octalysis breakdown credits Candy Crush's estimated **$3M/day**
to stacking all 8 core drives; three matter most to us:

1. **Scarcity (lives).** The 5-life limit with ~30-minute cooldowns creates a
   natural stop-and-come-back rhythm — Psychology of Games calls it the reason
   players *don't* burn out. → Think Leo: **5 hearts, +1 every 8 min**
   (kids wait badly — `HEART_REGEN_MS`), plus refill tickets from world chests (§6.2).
2. **The level map.** A winding trail of star-rated, locked nodes makes
   progress *visible and ownable* (Core Drive 2: Development &
   Accomplishment). → `LevelMap.tsx`: sine-wave trail, 3-star nodes, locks,
   world banners, chests (§3).
3. **The end-of-level celebration.** "Sugar Crush" turns the end of a board
   into a free, escalating fireworks bonus. → **LEO RUSH**: after the 8th
   puzzle, 12 seconds of ×2 points where hearts can't be lost — pure
   adrenaline with zero punishment (§5.4).

### 1.2.1 The kind economy, in constants

All tuning constants live in `src/lib/game.ts` and are quoted in this book;
the headline ones: `MAX_HEARTS = 5` with `HEART_REGEN_MS = 8 min`,
`ROUND_COUNT = 8`, `RUSH_SECONDS = 12`, `DAILY_GOAL_XP = 120`,
`WORLD_GATE_DONE = 3` (finished levels that open the next world).

### 1.3 Typography (researched, not guessed)

Guidance from EdTech typography research (Rubens Cantuni, *UX of EdTech*) is
unambiguous: **rounded sans-serifs win for kids' products** — they read like
handwriting, have tall x-heights, and no confusing double-story letterforms
for early readers (Joanna Varro's early-literacy font review reaches the same
conclusion). Duolingo's custom DIN-Round and Candy Crush's chunky display
faces follow the same logic.

| Role | Font | Why |
| --- | --- | --- |
| Display / headings / buttons | **Fredoka** (300–700, variable) | Chunky, bubbly, high x-height — the "Duolingo weight" |
| Body / numbers / answers | **Nunito** (variable) | Rounded terminals keep digits unambiguous (`1` vs `7`, `6` vs `9`) |

Both ship via `next/font/google` in `src/app/layout.tsx` (zero layout shift,
self-hosted, works offline once cached).

### 1.4 Sound design (the invisible mascot)

Duolingo's own sound team describes the golden rule as *"one musical and
sonic idea, several levels of reward"*: the combo sounds are a single family
that escalates — clean hit at 5×, bigger at 10×, peak at a perfect lesson —
all built on the iconic "correct answer" ding. We implemented exactly that
hierarchy (§8.3). Everything is **synthesized with the Web Audio API** — no
audio files — so the whole PWA stays tiny and offline.

### 1.5 Ethics for kids (non-negotiable)

Reward loops are sugar; a kids' app must be a vitamin. Think Leo's rules:

- **No purchases, no ads, no chat, no external links.**
- Hearts regen in 15 min (half of Candy Crush's 30) and levels are retryable
  forever — scarcity creates rhythm, never paywalls.
- Leo never shames: wrong answers get a *hint*, not a buzzer; "out of hearts"
  screens suggest stretching and water.
- LEO RUSH cannot cost hearts — the climax is always safe.
- `prefers-reduced-motion` disables ambient animations.

---

## 2. The core loop

```
            ┌──────────────────────────────────────────────┐
            ▼                                              │
   ┌─── HOME ────┐   tap PLAY   ┌─── PLAY (8 puzzles) ──┐ │
   │ daily ring  │─────────────►│ combo × timer × Leo   │ │
   │ streak 🔥   │              └──────────┬────────────┘ │
   │ hearts ❤️   │                         ▼              │
   └───▲─────────┘              win? ──► LEO RUSH ×2      │
       │                        (fail)──► out of hearts   │
       │                                │ hearts regen    │
       │   XP, stars, streak, chests    ▼                 │
       └──────── RESULTS: ★★★ + XP + confetti ────────────┘
```

One session = one level ≈ 2–4 minutes. Every exit point (results, fail, map)
returns a *visible* reward or a *visible* next step — the compulsion loop, in
kid-safe form.

---

## 3. Worlds, levels & the map

- **6 worlds × 10 levels = 60 levels** (`WORLDS`, `LEVELS_PER_WORLD`):
  Jungle Jam → Coral Cove → Space Hop → Candy Peak → Farm Days → Road Rush.
- **Unlock rule (v4 — “levels must always end”):** level *i* unlocks when
  level *i−1* was **finished** — a star is the shiny version, but ANY
  completed run (even 0 stars, even practice) sets the `done[i−1]` flag and
  opens the door:

  ```
  isUnlocked(i, stars, done) =
      i ≤ 2                                            // gentle start
   || stars[i−1] ≥ 1 || done[i−1]                      // finish → next opens
   || (i is a world's first level
       && finishedLevels(previousWorld) ≥ 3)           // early world access
  ```

  The world gate lets curious kids peek into the next world after finishing
  **3** levels of the current one (`WORLD_GATE_DONE`), instead of grinding
  all 10. Finished = star or done (`finishedCount`).
- **Map geometry** (`LevelMap.tsx`): nodes sit on a sine trail
  `x(i) = centerX + sin(i × 1.05) × 165`, `y(i) = H − pad − (i−1) × 96`,
  rendered bottom-up (level 1 at the bottom, like Candy Crush). A dotted
  polyline threads the nodes; the current quest pulses and Leo stands on it.
  A node a kid finished without stars shows a check mark — effort is visible.
- **Level transitions:** every jump into a level plays a world-coloured
  circular wipe with Leo running across (`LevelWipe` in `ThinkLeo.tsx`) —
  travel is part of the game, not a route change.
- **World chests** wait after levels 10/20/30/40/50/60: first 1-star clear claims
  **+3 heart-refill tickets + 40 XP** (once each; `grantChest`).

---

## 4. Question generation (the puzzle factory)

### 4.1 Reproducible randomness

```
rng = mulberry32( hash3( levelIdx·31 + diff, attemptId, questionIndex ) )
```

Every number in a puzzle comes from one seeded PRNG (mulberry32 — fast,
tiny, well-distributed). Same level + same attempt id ⇒ the *same* puzzle
set (fair, learnable); a new attempt ⇒ a fresh set. Nothing is stored.

### 4.2 The plan

`buildPlan(levelIdx)` deals 8 mini-game kinds per level from a world-specific
pool, with two hard rules: **no immediate repeats** and **at most one Memory
puzzle per level**. Levels 1–2 always open with a Count puzzle (gentle
onboarding).

### 4.3 The 12 mini-games

Eight thinking classics plus four hands-on games (v4) — the hands-on games
exist because young kids want to **do** things, not only compute:

| Kind | Skill | Difficulty scaling (diff 1→6) |
| --- | --- | --- |
| Count | cardinality | 3 → 16 items, tighter near-miss options (±1 → ±3) |
| Maths | add/subtract | 1-digit → 2-digit → 3-term `a + b − c` |
| Compare | magnitude | sticker plates → numbers up to 999; bigger *or* smaller |
| Odd one | categorization | unrelated intruder → *look-alike category* intruder (fruit vs veggie) |
| Sequence | pattern rules | +1 hop → doubles → triples → zigzag (+u,−d) → Fibonacci-style |
| Tables | multiplication | ×2–3 → full ×12, distractors = ±one group (`a(b±1)`, `ab±a`) |
| True/Trap | verification | sums ≤ 10 → ±50 with sneaky ±5 lies |
| Memory | working memory | Simon-style: 3 → 6 pads, each pad has its own note |
| **Tap it!** (v4) | scanning + reaction | “Tap all the monkeys!” — 9 → 16-tile mixed crowd, 3–6 targets; wrong taps only *boing*, all-found ends the puzzle with a rising scale (`found(n)`) |
| **Shadow** (v4) | visual discrimination | match the silhouette to the **coloured** animal — the question stays a black shadow, the answers show real animals (kid-tested: shadow-to-shadow matching is abstract shape algebra for a pre-reader, docs/KID-TEST.md #5); decoys come from the same world + a woodland cast (frog, fox, owl joined the sticker catalog) |
| **Sequence** (v7) | pre-math logic | number trains `[a, a+r, a+2r, ?]` — arithmetic → geometric → alternating → Fibonacci; the "?" cell is always LAST and the train is always visible (the old colour/shape "Pattern" kind died in the rewrite — on the stale v3 deployment it rendered every cell as "?" with hex-leak labels, docs/KID-TEST.md #2–3) |
| **Feed Leo** (v4) | counting you can feel | drop snacks into Leo's bowl one tap at a time (munch SFX), take extras back, tap DONE when the count matches; bowl holds want+4 so overshoots are fixable |

Judge-yourself games (Memory, Tap it!, Feed Leo) return `answer: −1` and
resolve through an internal `onResult(ok)` — the reveal shows Leo's reaction,
not a highlighted option.

### 4.4 Distractors

`nearMisses()` generates unique "close-but-wrong" answers — ±1, ±2, ±10, the
classic off-by-one/off-by-ten traps — never below 0, always unique, shuffled
by the same seeded rng. For multiplication the distractors are
*conceptual* mistakes (one group more/less), which is what makes them fun to
fall for once.

---

## 5. The play loop: scoring, combos, Flow Ranger, LEO RUSH

### 5.1 Per-question score

```
points = 100 × comboMult(combo) × speedMult(fracTimeLeft) × (rush ? 2 : 1)

comboMult(c)    = min(3, 1 + 0.25 × (c − 1))      // ×1 … ×3 from the 9th in a row
speedMult(f)    = 1 + 0.5 × f                     // answer instantly → +50%
```

Fast *and* streaky play is worth up to **4.5×** base. One wrong answer drops
the multiplier back to ×1 — that's the adrenaline ratchet.

### 5.2 Flow Ranger (adaptive difficulty)

Within one attempt, per-question difficulty `diff` starts at the level's base
tier (`1 + ⌊(levelIdx−1)/8⌋`, clamped 1–6) and drifts ±:

```
3 correct in a row  →  diff + 1   (max base + 2)   "heat up"
2 wrong in a row    →  diff − 1   (min base − 1)   "cool down"
```

The kid never sees a difficulty number — they feel a game that breathes with
them, which is the flow-channel principle (challenge rises with skill, backs
off after failure).

### 5.3 The clock

`questionTime(diff) = max(9, 26 − diff × 2.6)` seconds. Last 5 seconds tick
audibly; the last 3.5 seconds pulse a red vignette (adrenaline, not terror —
the timer ring turns berry-pink, never blood-red). Timeouts count as a miss
and cost a heart.

### 5.4 LEO RUSH (the Sugar-Crush moment)

After puzzle 8, if at least one heart survived:

1. **RushIntro** (1.7 s): whoosh, gradient slam "LEO RUSH!", Leo bouncing.
2. **Rush** (12.0 s): rapid-fire puzzles from `makeRushQuestion()` (2 tiers
   easier so pace stays high), each worth a flat **120 pts (60 × 2)**.
   **No hearts can be lost in the Rush** — it's the reward lap.
3. Streak sounds escalate with every consecutive hit (§8.3).

### 5.5 Stars & XP

```
accuracy   = correctAnswers / answeredPuzzles        (main round only)
stars      = 3 if ≥90% · 2 if ≥70% · 1 if ≥50% · else 0
XP         = 8 + stars × 6 + min(16, ⌊totalScore / 250⌋)   (0 XP on a failed run)
```

Stars gate the map; score feeds best-score badges; XP feeds everything else.
A typical clear earns **26–38 XP**, so the 120-XP daily goal ≈ 3–4 levels and
player levels arrive every handful of runs. Score stays deliberately big and
juicy on the results screen (thousands) — XP is the *slow*, meaningful currency.
Any finished run — even 0 stars — also calls `noteActivity()`, which counts the
day for the streak and the play strip: effort always leaves a trace.

---

## 6. The economy

### 6.1 Player level & daily goal

```
xpToNext(l) = 120 + (l − 1) × 80            // gentle super-linear curve
dailyGoal   = 120 XP                        // ≈ 3–4 level runs
```

Achievement bounties (§13.2) pay 40–200 XP each, so early levels and the
first badges land inside the first session — dopamine up front, grind after.

### 6.2 Hearts (scarcity, softened twice)

```
max = 5 · regen = 1 heart / 8 min · tokens from chests = instant full refill
Leo's courage boost = 1 free full refill per local day (boostDay)
learning mercy     = levels 1–2: timeouts cost NO heart (slow readers ≠ wrong)
practice mode      = hearts frozen entirely, run always ends, XP halved
```

Regen is computed from timestamps, not tick counts: `tickHearts()` pours in
`⌊(now − heartsAt) / 8min⌋` hearts whenever the app is open, and the stamp
advances by exactly the poured amount, so offline time counts too. Losing a
heart starts the clock only if the tank was full.

**Why the changes:** the #1 kid complaint was “level 1 never ends”. The
chain was: slow reader → timeout → heart lost → 0 hearts → hard stop for
15+ minutes → kid (and parent) give up. v4 removes every hard stop: the
daily boost, the practice mode (`Keep playing` on the out-of-hearts screen)
and the 8-minute regen guarantee that a play session can always continue,
and every finished run still opens the next level (§3).

### 6.3 Streaks (loss-aversion, softened)

On the first play of a local day — XP *or* any finished run (`noteActivity`):

```
lastPlayDay == yesterday → streak + 1
gap = 2 days + freeze available → consume 1 freeze, streak + 1 (saved!)
otherwise                → streak = 1   (first-ever play starts at 1 too)
milestones: day 3 → +1 freeze · day 7 → +2 freezes
```

Day boundaries use the kid's own clock (`dayKey()` = local YYYY-MM-DD), and a
streak only *breaks* after a full missed day without a freeze.

### 6.4 Weekly league

`weekKey()` = ISO week. Weekly XP resets each ISO week and maps to cosmetic
tiers: Grass 0 · Bronze 100 · Silver 250 · Gold 500 · Crystal 900 · Legend
1500. Calibrated to the XP economy: Bronze ≈ 2–3 playing days, Gold is a
committed week. No real-player leaderboards — the opponent is yourself.

---

## 7. Persistence schema

`localStorage["think-leo-save-v1"]` via zustand `persist` (offline-first;
no server, no accounts, nothing leaves the device):

```jsonc
{
  "xp": 1240, "weekXp": 420, "leagueWeek": "2026-W45",
  "hearts": 4, "heartsAt": 1731150000000, "refills": 3,
  "streak": 5, "bestStreak": 5, "lastPlayDay": "2026-11-09", "freezes": 1,
  "todayXp": 80, "today": "2026-11-09",
  "stars": { "1": 3, "2": 2 }, "best": { "1": 2310 },
  "done":  { "1": true, "2": true },          // v4: any finished run unlocks the next level
  "boostDay": "",                             // v4: Leo's daily courage boost
  "chests": { "0": true },
  "soundSfx": true, "soundMusic": true,
  "totalCorrect": 0, "runs": 7
}
```

---

## 8. The sound engine (all synthesized)

### 8.1 Voices

`src/lib/sound.ts` runs a lazy `AudioContext` behind a master gain, unlocked
on the first pointer/key event (browser autoplay policy — documented in the
UI as "sound starts after your first tap"). Voices: sine/triangle/sawtooth
oscillators with ADSR-ish envelopes, plus filtered white noise for whooshes,
ticks and sparkle.

### 8.2 The SFX table

| Cue | Recipe | Feeling |
| --- | --- | --- |
| `correct` | C5–E5–G5 triangle arp, 70 ms steps + air sparkle | the iconic ding family |
| `wrong` | soft sawtooth A3→F3 fall, low volume | "hmm", never "NO!" |
| `timeUp` | two square knocks winding down + rising marimba chirp | the clock's own friendly voice — a timeout is nobody's fault, so it never uses the wrong-answer horn (§kid-test #6) |
| `combo(n)` | see §8.3 | escalation |
| `heartLost` | two-note minor fall | gentle "oh" |
| `tick` | 30 ms 1320 Hz square | urgency |
| `star(i)` | 1046/1318/1568 Hz sparkle | reward streak |
| `win` | 4-note fanfare + sub-octave + shimmer | parade |
| `fail` | 3-note sad wobble | sympathy |
| `whoosh` | bandpass noise sweep 300→2400 Hz | ignition |
| `flame` | noise crackle + rising tone | streak fire |
| `pad(i)` | C4/E4/G4/C5 triangle | memory melody |
| `found(n)` | rising pluck + air, pitch = hit count | tap-the-target sweep |
| `munch` | two filtered noise crunches + lip pop | feed-Leo snacking |
| `boing` | triangle 300→110 Hz glide | wrong tap in hands-on games (funny, never scary) |
| `wipe` | falling noise sweep + thud | level-transition curtain |

### 8.3 The combo escalation family (Duolingo principle)

ONE motif — a major-third leap — at FOUR levels of reward:

```
combo 3+ : root + third                         (clean hit)
combo 5+ : + fifth layer                        (bigger)
combo 7+ : + octave + high-pass noise shimmer   (bigger still)
combo 10+: + double-octave triplet fanfare      (perfect-streak territory)
```

The root also *rises with the combo* (semitone per streak, capped at 12), so
long streaks literally climb a scale.

### 8.4 The music (real tracks, not synth)

The v2 synth loop was replaced with **licensed background tracks** after the
music failed to earn its keep — the kid-facing rule: *if we can't ship a good
soundtrack, ship none.* Three tracks by Kevin MacLeod (incompetech.com,
CC BY 4.0, credited in the Home footer), trimmed, loudness-normalized to
≈ −19 LUFS and looped:

| Mood | Track | Where |
| --- | --- | --- |
| home | "Carefree" (96 s loop) | hub & level map |
| play | "Monkeys Spinning Monkeys" (121 s) | gameplay |
| rush | "Sneaky Snitch" (46 s) | LEO RUSH finale |

The player (`sound.ts`) crossfades between moods (~0.9 s), **ducks** to ~22%
under big cues (fanfare, level-up) and rides back, pauses on tab-hide
(battery manners) and retries on the next gesture when the browser blocks
autoplay — the requested mood is remembered, so music *always* starts as
soon as it is allowed to. Music sits under the SFX mix, never on top.

---

## 9. Device detection — everyone plays, every visit is recorded

**Policy (updated): laptops, phones and tablets all get the full game.**
`detectDevice()` (`src/lib/device.ts`) still classifies the device, but the
result is now used for *recording and tuning*, never for blocking:

```
1. mobile UA          /Android|iPhone|iPod|Windows Phone|…|iPad/
2. disguised iPad     /Macintosh/ UA  &&  maxTouchPoints > 1
3. touch-first        primary pointer = coarse  &&  no fine pointer
4. small touch screen min(w,h) < 700 px  &&  primary pointer coarse
```

Rule of thumb: **a laptop's physical signature is a fine primary pointer**
(mouse/trackpad). Touchscreen laptops pass; phones and tablets (including
iPads pretending to be Macs) classify as `mobile`. `watchDevice()` re-checks
on resize/rotation (docked tablets, rotated phones) so the recorded details
always match reality.

Phone-specific adaptations that ship with this policy:

- the level map scales itself to the viewport (same trail, same feel);
- a pocket-sized Leo rides along next to every question card;
- option grids, cards and the HUD wrap cleanly down to 360 px widths.

### 9.1 Device details are recorded (every visit)

`src/lib/deviceInfo.ts` builds an anonymous hardware snapshot on every load:

```
kind (laptop/mobile) · formFactor (Phone/Tablet/Laptop/Desktop)
os · browser · platform · screen · viewport · pixelRatio
cpuCores · ramGB · touchPoints · language · timezone
online · standalone (installed PWA?) · gpu renderer · UA (truncated)
```

It is stored twice: locally (`localStorage`, last 20 visits) and POSTed to
`/api/device`, which validates the payload with zod and appends a
`DeviceVisit` row to the SQLite database (Prisma). Reporting is throttled to
twice a day per device and is strictly fire-and-forget — the game never waits
on the network.

---

## 10. Leo the mascot (state machine)

Leo is parametric SVG: a 12-circle mane ring, a face, and a `Look` table per
mood (`Leo.tsx`). framer-motion drives body bob, tail wag (2.2 s cycle), and
blink (scaleY squash every ~4 s); paws animate independently when raised.

| Mood | Eyes | Mouth | Body | Trigger |
| --- | --- | --- | --- | --- |
| `idle` | open + blink | smile | float | resting / between questions |
| `happy` | open | open smile | bounce | correct answer, full bowl |
| `excited` | wide | open | bounce fast | combos ≥ 5, Rush, intro |
| `sad` | downturned pupils, brows | frown | slow droop | miss / timeout / out of hearts |
| `thinking` | pupils up-right, one brow | flat | still, paw on chin | hints, feed-Leo counting |
| `celebrate` | **star eyes** | open | dance + sparkles | level clear (1–2 stars) |
| `wow` | wide | **ooh** (round) | pop-jump + wobble | LEO RUSH ignition |
| `cheer` | **star eyes** | open | victory jumps with hip twist | 3-star runs |
| `sleep` | closed | flat | slow breathe + zzz | before 6 AM |

Leo speaks through a spring-loaded speech bubble: praise on streaks, the
*puzzle's own hint* on a miss (teaching, not judging), time-of-day greetings
on home, and soft no-heart encouragement.

---

## 11. Startup animation (the "app icon came alive" moment)

This is the page a kid sees in the second after tapping the Think Leo icon
on a phone's home screen, so it opens with **the app icon itself**: a
squircle icon card drops in with an elastic wobble, the "Think Leo!"
wordmark pops letter by letter, a shine sweeps across, the world cartoon
parade (elephant → monkey → parrot → dolphin → rocket → cupcake → butterfly →
candy) marches across the bottom while Leo bobs at the corner, then **paw
prints fill one by one** as the loading beat (each with a tick) and a star
burst + fanfare hands over to the curtain lift. Full choreography is a GSAP
timeline (~3.7 s); any tap skips. Repeat visits in the same session get a
0.75 s logo card. The splash doubles as the hydration cover, so the app
never flashes unhydrated state.

---

## 12. The app on a phone (installable, offline, no jargon)

Parents never see the letters "PWA" — the app simply **installs and works**:

- `manifest.webmanifest`: standalone (+ `display_override`,
  `launch_handler: navigate-existing`), theme `#FFB020`, maskable + any
  icons — so "Add to Home Screen" gives a real app icon and a real
  full-screen app on phones and tablets.
- `public/sw.js` **v5**: precaches the shell, icons and the three music
  tracks; **network-first for all code (`_next/*`, js, css) and
  navigations** — while the kid is online every launch pulls the newest
  build, and the cached copy is only the offline fallback (v3/v4 cached
  code first, which let devices keep running an old build after fixes —
  the "still broken" bug, §17). Icons/audio/manifest stay cache-first
  (immutable). → **the game fully boots and sounds right with no
  internet, and is never stale online**. `SKIP_WAITING` +
  `clients.claim()` plus a controller-change reload keep installed apps
  auto-updated; installing v5 deletes every v1–v4 cache on the device.
- Registration happens at the root layout, so the installed app updates
  itself on any device.
- `viewport-fit: cover` + `env(safe-area-inset-bottom)` padding keep the HUD
  clear of notches and home-indicator bars.
- Install prompt captured via `beforeinstallprompt` and surfaced on Home as
  **“Add to Home Screen”** — grown-up language, zero jargon.

---

## 12.1 Save-state engine contract (v3 — regression notes)

Three invariants were learned the hard way and are covered by
`scripts/store-test.ts` (run with `bun scripts/store-test.ts`):

1. `questsForDay(day)` returns **exactly 3 quests with distinct event types**.
   The save engine indexes progress by board position; two quests on one event
   or a 4-row board once wiped progress on every write.
2. State helpers are **pure and rebased**: `bumpQuests` / `ensureQuestDay`
   take a snapshot and return a new snapshot — they never re-read `get()`
   mid-transaction. (A re-read used to discard the stars `recordLevel` had
   just built: levels finished, nothing saved, unlocks frozen.)
3. Every XP grant and every finished run flows through `bumpPlayDay`, which
   owns streak / playDays / lastPlayDay — first-ever play starts the streak
   at 1, milestones mint freezes.

Migration: v2 saves (inflated XP era) are rescaled ÷12 on load (guarded by
the persisted `version`, so v3+ XP is never touched twice), boards are
rebuilt, stars/best survive. **v4** backfills `done` from stars (old saves
keep every unlocked door) and adds `boostDay`.

### 12.2 v4 regression proof

`bun scripts/sim-v4.ts` verifies, without a browser:

1. all 40 level plans build; every one of the 12 mini-games generates a
   valid, answerable question at every difficulty 1–6;
2. unlock rules: levels 1–2 open, `done[i−1]` opens level *i* even at 0
   stars, the 3-level world gate opens new worlds early;
3. a **0-star practice finish unlocks level 2** — the “level 1 never ends”
   bug is structurally impossible now.

The older `scripts/store-test.ts` (quest-board contract, achievement XP,
heart math) still passes unchanged.

---

## 13. References (opened & used)

1. StriveCloud — *How Duolingo Uses Gamification to Improve User Retention* (12% → 55%) — strivecloud.io/blog/gamification-examples-boost-user-retention-duolingo
2. Orizon — *Duolingo's Gamification Secrets: Streaks & XP* (3.6× 7-day-streak stat) — orizon.co/blog/duolingos-gamification-secrets
3. Ptengine — *Duolingo Gamification Strategy Explained* — ptengine.com (via search snapshot)
4. Yu-kai Chou — *Why Is Candy Crush So Addicting? (Octalysis)* — yukaichou.com/gamification-study/game-mechanics-research-candy-crush-addicting
5. *Why You Don't Burn Out on Candy Crush Saga* (lives/scarcity) — psychologyofgames.com/2013/10/why-you-dont-burn-out-on-candy-crush-saga
6. Ambrose Yu — *Duolingo: The sounds in every lesson* (combo escalation family) — ambroseyu.com/work/duolingo-core-product-sounds
7. Rubens Cantuni — *Typography in digital products for kids* — medium.com/ux-of-edtech
8. Joanna Varro — *The Easiest Fonts for Kids to Read* — varrojoanna.com
9. Baloo 2 specimen (type selection) — fonts.google.com/specimen/Baloo+2

---

## 14. LEO POP — the merge arcade (v5)

The first pure-fun game, zero maths. A Suika-style physics jar
(`matter-js`) with the Think Leo cast: drop a creature, two of a kind
fuse into the next, the chain ends with LEO, and two LEOs detonate into
the Golden Leo jackpot. Design brain: `src/lib/arcade.ts`.

### 14.1 The psychology

| Hook | Mechanic |
| --- | --- |
| Completion drive | You saw tier N+1 once — now you NEED to build it (Suika's core loop) |
| Variable ratio | Golden eggs: 12% per drop after the 4th, pity-guaranteed within 9 eggless drops — every egg pays *something*, the table only varies the SIZE of the surprise |
| Dopamine ladder | Chain cascades multiply score while the screen still moves (1.15 s window); the merge sound pitch climbs with every chain step |
| Collection | The Zoo Book (10 creatures) shows undiscovered silhouettes — completion compulsion |
| Comeback | The first egg of each local day is guaranteed (`mergeEggDay`) |

### 14.2 The numbers

- Drop weights (tiers 0–4): 30/26/20/14/10 — small creatures only fall from the sky.
- Merge score by created tier: `[0,1,3,6,10,15,21,28,36,45,100]`, chain multiplier `min(4, 1 + 0.5·(chain−1))`.
- Golden egg outcomes: gift 34% (random tier 4–7) · party 24% (+60) · twins 22% · popcorn 20% (a whole tier pops).
- Overflow line: a creature riding the line 2.2 s ends the run.
- XP: `6 + min(24, floor(score/70)) + 4·newDiscoveries` — flows through the ONE economy.

### 14.3 The ONE-economy contract (§14.5)

`trackMerge` / `recordMergeRun` / `claimMergeEgg` / `seeCreature` are pure
pipelines: quest bumps (`merges`, `mergeNew`, `mergeLeo`) and achievement
XP all pass through `addXpPure` + `bumpQuests`, so the daily ring, the
league and the streak can never disagree with the arcade. The quest board
is exactly 3 rows with DISTINCT event types — `questsForDay` guarantees it.

---

## 15. LEO EGGS — the surprise-egg arcade (v6)

The flagship pure-fun game #2, built on blind-box psychology — the same
hooks that keep a feed scroll going, tuned for small hands. You pick an
egg, PRESS AND HOLD it (one thumb, zero skill), the three.js egg shakes,
fissures spread, gold light teases — then it bursts and a friend joins
the collection. Design brain: `src/lib/eggs.ts`; renderer
`components/eggs/Egg3D.tsx` (three.js) + `EggGame.tsx` (GSAP timeline).

### 15.1 The psychology (researched)

| Hook (Hooked model) | Mechanic in LEO EGGS |
| --- | --- |
| Trigger | The Home card glows "Nest egg ready!"; the Royal Egg is free every morning; quest rows pull egg events |
| Action | Pick an egg → hold-to-crack. No fail state, no skill gate — releasing early just pauses |
| Variable reward | Rarity table (slot-machine schedule), near-miss gold tease, 1.4 s silhouette suspense, rarity-scaled fanfare + screen shake + haptics. Never a "miss": duplicates pay stars |
| Investment | Album completion (silhouettes nag), Stage-2 growth (feed 2 extra copies), the nest keeps incubating after the app closes, streak days make eggs luckier |

Key researched principles baked in:

- **Blind-box reveal** — "maybe this is the rare one" is the engine; dopamine
  peaks BEFORE the reveal, so the crack is a slow, touchable ritual and the
  next egg is always one tap away (the infinite-feed affordance).
- **Variable-ratio table** — Spark (free): 68/22/7.5/2/0.5 %, Rainbow (25★):
  20/48/22/8/2 %, Royal (60★): 0/40/40/16/4 % (common/rare/epic/legend/mythic).
- **Near-miss tease** — P(gold glow) per rarity: 15/45/80/100/100 %. Honest
  but noisy: informative enough to chase, never a promise.
- **Pity** — after 7 dry Spark eggs the 8th is forced rare-or-better, and the
  countdown is VISIBLE (the pity meter). Losing streaks end; hope never does.
- **Streak luck** — `+2.5%/streak-day` rare-or-better luck, capped at +12.5 %:
  the lion app and the egg game now pull the same direction.

### 15.2 The economy

- 13 friends across 5 rarities (5 common, 4 rare, 2 epic, 1 legendary cub,
  1 mythic star). All art from the sticker library — zero new assets.
- Duplicates pay stars: 2/5/12/30/60 by rarity; a first discovery pays +5★
  and +XP. Rarity XP (2/3/5/10/20) flows through the ONE economy.
- Stars buy Rainbow (25★) / Royal (60★) eggs — the duplicate sink.
- Growth: 3 hatches of one species → feed 2 extra → Stage 2 (golden frame,
  +10 XP, pure pride).
- Nest: a free Spark egg incubates in real time (`NEST_HATCH_MS` = 15 min,
  `eggNestAt`); when it hatches the next one starts immediately — the app
  is always growing something while it is closed.
- Spark rest: 4 s between free eggs (≈ one reveal read) so the crack →
  reveal → NEXT loop never stalls at its dopamine peak.
- Quest events `eggs` / `eggNew` / `eggRare` joined the SAME daily board
  (§14.3 contract still holds: 3 rows, distinct events).
- Achievements: First Crack · Egg Explorer (6) · Golden Luck (legendary) ·
  Nest Master (all 13) · Grow Up (first Stage 2).

### 15.3 The three.js egg

`Egg3D` renders one canvas: a speckled candy egg (generated canvas
textures, no downloads), hemisphere + key + rim lights, drag-to-spin with
inertia, hold-shake driven by crack progress, an alpha crack overlay that
eases in, an additive gold glow sprite (the tease), and a burst — two
shell halves with gravity + 90 round glow sparks (radial-gradient sprite
particles, never squares). DPR capped at 2, everything disposed on
unmount; props reach the loop through refs so a hold never re-renders.

---

## 16. LEO FEED — the infinite surprise feed (v7)

### 16.1 Why a feed, and what it copies

The brief: *not* educational, "a game with the mind like an Instagram
algorithm", something that keeps kids on the screen without a single
question to answer. The feed format is the answer, and every mechanic
has a named lineage:

| Mechanic | Borrowed from | Why it works |
| --- | --- | --- |
| The endless card stream | Instagram/TikTok | A feed has no finish line — "the next one" is always one flick away, so play never hits a natural stop |
| Variable-ratio rarity | Slot machines / gacha | Every card pays something; the brain keeps re-arming for the big one |
| The unwrap ritual | Candy Crush Sugar Crush / gacha pulls | Dopamine peaks BEFORE the reveal — the shake is the product, the reveal is the receipt |
| Near-miss gold flash | Skinner boxes / modern gacha | "SO CLOSE" is the strongest known re-grip in game design |
| HEAT meter | Hype/train meters (Brawl Stars, TikTok streaks) | Momentum you can SEE; full meter = a guaranteed MEGA card |
| Pity counter | Gacha pity systems (Genshin) | Dry spells always end; hope never does |
| Affinity ("Leo picked this for you") | Recommender systems | The feed LEARNS which friends the kid loves and leans toward them |
| Wall of Fame | Trading-card albums / Pokédex | Completion pull with visible faces nagging from the gaps |
| Daily MEGA gift | Duolingo / daily-shop FOMO | The reason to open the app again tomorrow |

There is no text to read anywhere in the loop: icons, colours and
animation carry it. The "algorithm" wink is the chip on every card:
*Leo picked this for you.*

### 16.2 The math (lib/feed.ts)

- **Rarity table** (variable ratio, same ladder as Leo Eggs):
  common 55% · rare 25% · epic 13% · legend 5.5% · mythic 1.5%.
- **Streak luck**: −0.5 percentage points off the roll per streak day
  (cap 10) — a longer flame bends the table toward shiny, so the lion
  app and the feed pull in the same direction.
- **Near-miss**: a common that rolled <3 points under the epic/legend/
  mythic gate flashes gold mid-shake (65% of qualifying rolls — honest
  but noisy, pattern-hunger needs variety).
- **Pity**: `feedPity` counts cards since the last epic+; at
  `PITY_MAX = 9` the next card is forced epic-or-better. Dots are always
  visible under the card.
- **HEAT**: shiny reveals +1 heat (commons keep the warmth), at
  `HEAT_MAX = 5` the NEXT card is a MEGA card — forced epic+ — and the
  meter cools to 0. Best heat is kept in `feedBestHeat` for the
  achievement.
- **Affinity** (the recommender): every sighting multiplies that
  friend's pull weight by `AFFINITY_STEP = 1.35`, capped ×6 — favourites
  recur, but rarity is always governed by the table above, so love
  never becomes a monopoly.
- **Payouts**: rarity XP 2/3/5/10/20 through `addXp` (daily ring, league,
  streak, quests — a pull IS a played day); duplicates pay Spark into
  the same purse Leo Eggs uses (2/5/12/30/60 + 5 for a first discovery).
- **Daily MEGA gift**: one free forced-epic+ card per local day
  (`feedMegaDay`), +10 XP on claim — the Home card pulses when it waits.
- **Comeback warmth**: `comebackLuck` reads `feedPullDay` and adds up to
  +8 luck after days away.

### 16.3 The ritual (FeedGame.tsx)

The unwrap is a **GSAP timeline**: the card wobbles harder and faster
(amplitude 2→9 px, ~130 ms per beat), a radial glow breathes in the
rarity colour, and the ritual lasts longer for higher rarity
(0.85 s common → 2.4 s mythic) — anticipation scales with reward.
A near-miss flashes "SO CLOSE!" at peak tension. The reveal pops with a
spring, pays its XP/Spark chips, and legend/mythic pull Leo on screen
with a fanfare / golden roar. Swipe up (or NEXT) flicks the card away
and the next one rises from below — with the edge of the card after it
peeking at the bottom, the infinite-scroll affordance.

`FeedSky` (three.js) drifts a real 3D galaxy behind the cards —
200-point dust field + 14 spinning octahedron stars and icosahedron
gems, DPR capped at 1.5, render loop paused when the tab hides,
everything disposed on unmount. three.js and GSAP both ride in lazy
chunks; phones never download them until the feed opens.

### 16.4 Integration — the ONE economy (store v7)

`trackFeed(plan)` is ONE pure pipeline built from a single snapshot:
Wall of Fame (`feedAlbum`), affinity (`feedAffinity`), heat (`feedHeat`
/ `feedBestHeat`), pity (`feedPity`), pulls (`feedPulls`, `feedPullDay`),
Spark (`eggStars` — the shared purse), the quests (`pulls` / `feedNew` /
`feedRare` joined the SAME 3-row daily board) and the rarity XP through
`addXpPure` — so streaks, leagues, the daily ring and player levels all
advance while the kid "just plays". Achievements: First Swipe · Feed on
Fire · Golden Feed · Feed Dreamer · Feed Explorer (6) · Feed Master
(all 16).

### 16.5 The pattern question is gone

The old "What comes next in the pattern?" mini-game (the square-#9b5de5
screen) is deleted from the question factory, the play screen and both
simulation scripts. A four-year-old never has to parse an abstract
sequence again — pattern-hunting moved to where it belongs: the feed,
where the pattern is "maybe THIS one is the golden one".

---

## 17. v8 — the staleness bug, and the E2E proof run

### 17.1 The bug that made every fix invisible (the real root cause)

Report: *"now, it's not working"* — while the code on disk was correct.
Diagnosis in a real browser: the page was controlled by the **v4
service worker**, which served **`_next/static` and every `.js` chunk
cache-first**. In dev (Turbopack) a chunk's URL never changes, only its
content does — so every device kept executing the **old build forever**,
no matter how many bugs were fixed on disk. Three reported symptoms were
all stale-code ghosts:

| Report | What the stale build showed | What the disk code actually did |
| --- | --- | --- |
| "it's not working" | a Feed-Leo snack bowl bolted onto every *shadow* round (`kind === "shadow"` conditioned the bowl) | the bowl keys on `kind === "feedLeo"` only (fixed in Play.tsx) |
| "Think leo leo" typo-graphy | the splash swapped every "L" for the string "Leo!" while `e`, `o`, `!` still rendered → wordmark read "Think Leo!eo!" | "Think " pops letter-by-letter + "Leo!" pops as ONE gradient word (fixed in Splash.tsx) |
| literal `{feedPulls === 1 ? …}` on a feed card | a template string missing its `$` | `` `${feedPulls} ${…} opened · the feed never ends` `` (fixed in FeedGame.tsx) |

**The fix (`public/sw.js` v5):** code and navigations are
**network-first** — online launches always fetch the newest build, the
cache is only the offline fallback; icons/music/manifest stay
cache-first (immutable); installing v5 **deletes every v1–v4 cache** on
the device, and the existing `SKIP_WAITING` → controller-change reload
pipeline swaps the running worker without a second tap. Verified live:
unregister v4 → wipe caches → reload → `think-leo-v5` active → the
shadow round renders clean.

### 17.2 The browser proof run (E2E, real clicks)

Driven with a headless browser at phone/desktop viewports, after the v5
swap, with screenshots at every step:

1. **Level 1** — all 8 rounds answered live (count · shadow · compare ·
   shadow · shadow · count · shadow), no bowl on any shadow round;
   **LEO RUSH** fired; 12 s hard timer expired the rush even with no
   input; **"Level complete!"** — 3 stars, 100% accuracy, +33 XP, "New
   best score!", "Welcome to the Bronze league!", PLAYER LEVEL 2.
2. **Level 2** — completed including the **Feed Leo** round: dropped 3
   apples (bowl showed "3 in the bowl · Leo wants 6"), then 3 more
   ("6 in the bowl" turned green, DONE! turned green), tap DONE →
   LEO RUSH with the **"UNSTOPPABLE!"** ×7-combo banner → complete.
3. **Map** — Levels 1–2 show 3 gold stars each, Level 3 marked
   "your next quest", Levels 4–10 locked; Leo stands beside the
   current level.
4. **LEO FEED** — daily MEGA gift ("Leo picked this for you") shook,
   revealed **Hop the Bunny (COMMON)**: +2 XP, +7 Spark
   (purse 10 → 17), album 0/16 → 1/16, footer
   *"1 card opened · the feed never ends"*; NEXT → second card
   **Nugget (COMMON)**: 2/16, Spark 17 → 24, pluralised footer correct.
5. **LEO EGGS** — nest egg ready, hold-to-crack ritual, **Ember the Fox
   (RARE)** hatched: +5★, +3 XP, album +1, badge toast **"First Crack
   · +40 XP"** fired top-right.
6. **LEO POP** — physics jar: dropped 3 mice, **two fused into a frog**,
   score 0 → 6, NEXT preview advanced.
7. **Offline** — `offline on` → reload → the **full home screen booted
   from the v5 cache** (streak, XP, stars, Level 3 ready to play).

### 17.3 The update contract going forward

Because of §17.1 the project now has one invariant, same spirit as the
ONE-economy rule: **a fix that never reaches the device is not a fix.**
Network-first code (v5) is what makes every future change land on the
next launch — online. (Offline launches get the last-good build; that
is the trade the install contract promises.)

## 18. Parent HQ — the grown-up side of the door (v8)

The kid owns the game; the adult who hands over the phone owns the
boundaries. Parent HQ (gated entrance: **press and hold** the paw ~2.5 s —
4-year-olds tap, holding is a grown-up motor skill) adds three things:

### 18.1 The play window (the nap)

A visible-time budget, not a screen-time nag:

- The shell ticks `bumpPlayMs(5 000)` every 5 **visible** seconds
  (`visibilityState === "visible"` — background tabs never count).
- `dailyCapMin` (family rule, default 30, selectable 15/30/60/open) +
  `playToday.bonus` (grown-up extensions, today only) = today's window.
- When the window runs out, the **nap screen** floats above everything:
  sleeping Leo, "Today's thinking time is used up — Leo saves every star",
  and a hold-gated *Add 15 more minutes today*. A new day resets it.
- **The hydration guard** (a bug shipped and caught in the same hour): the
  first tick fired before zustand rehydrated, reset `playToday`, and
  persisted the reset — wiping used minutes on every app start. `bumpPlayMs`
  now refuses to write until `_hydrated`; the ticker also waits for it.

### 18.2 Skills so far (the Flow Ranger, made visible)

Every judged answer feeds `skillStats[kind] = {ok, n}` (11 puzzle kinds).
Parent HQ renders one bar per skill — green ≥70 %, amber ≥40 %, berry below —
so a parent sees "counting: strong, tables: wobbly". The SAME numbers are
what the Flow Ranger already breathes with (§5): Parent HQ doesn't collect
anything new, it just shows the family what the difficulty engine knows.
Still local-only: nothing leaves the device.

### 18.3 The pre-reader HUD (kid-test follow-ups)

- `TimerRing`: 44 → 64 px, 5 → 7 px stroke, `text-sm` → `text-2xl` black
  digit — "a pre-reader can't read 6 in a 28 px ring" (docs/KID-TEST.md).
- `PawProgress`: 18/22 → 24/30 px paws, future paws opacity 45 → 70 % —
  the kid can count their own progress across the 8 rounds.

---

## 19. v9 — the family release: save codes, the first-run tour, CBC strands

### 19.1 The save code — a kid's progress becomes portable

Everything lives in one device's localStorage, which is perfect for privacy
and terrible for "we got a new phone". The save code (`src/lib/savecode.ts`,
regression `scripts/sim-savecode.ts`) is the escape hatch, in Parent HQ:

```
LEO1.<base64url(JSON of the ~47 durable fields)>.<fnv1a-32 checksum, 8 hex>
```

- **Durable only** — stars, XP, streak, hearts, refill tickets, all three
  arcade collections, `skillStats`, the play window. Runtime fields
  (`_hydrated`, toast queues) never travel.
- **Day-stamps ride along** so claimed dailies don't re-mint on the new
  device (the daily egg stays claimed, the MEGA gift stays claimed).
- **Restore is hold-gated** (2.5 s paw, same as the HQ entrance) because it
  *replaces* the save on that device — "the code wins", one predictable rule.
- **Kid-proof failure:** whitespace/line-wraps are stripped (chat apps wrap
  long codes), the checksum catches truncation and typos, and every failure
  is a friendly sentence ("copy the whole thing again, including LEO1") —
  never a corrupted save. Sim suite: round-trip, wrap-proof, tamper-proof,
  garbage-proof (11 checks).

### 19.2 The first-run tour

Four bottom-sheet beats, Leo narrating (`Home.tsx` `TourOverlay`): "Hi, I'm
Leo!" → the map → the three arcade doors → come back every day. Next/Skip,
progress dots, one `roar()` on finish. Shown **once** (`tourDone` in the
save), gated on `_hydrated` so a returning kid never sees it flash during
rehydration. A wiped save is a brand-new kid — `reset()` brings the tour
back by design.

### 19.3 CBC strand grouping (Parent HQ → Skills)

The mastery bars are now grouped under the four official strands of Kenya's
CBC **Mathematical Activities** (KICD PP2 Mathematical Activities design,
2024 rationalization) — `src/lib/cbc.ts`:

| CBC strand | Think Leo skills that feed it |
| --- | --- |
| **Pre-Number Activities** (sorting & grouping · matching & pairing · ordering · patterns) | odd-one-out · shadow match · memory · sequences · tap-the-target |
| **Numbers** (counting · putting together & taking away · number value · tables) | count · add & subtract · more-or-less · true-or-trap · times tables · feed Leo |
| **Measurement** (mass · capacity · time · money · area) | *coming* — new puzzle kinds are being drawn |
| **Geometry** (lines · shapes) | *coming* |

The mapping is honest: no skill is stretched into a strand it doesn't belong
to, and the two uncovered strands say "coming" instead of silently
disappearing.

### 19.4 Accessibility & correctness sweep

- **Answer feedback is now colour + shape:** the correct card gets a green
  ✓ badge, the wrong pick a berry ✗ badge — readable with colour-blind eyes
  (the colours alone were the only signal before).
- **`:focus-visible`** gets a grape 3 px outline globally — keyboard and
  switch users always see where they are.
- **HoldButton purity fix** (a real bug shipped in v8): `tick()` called
  `onDone()` *inside* the `setProgress` updater — a side effect during
  render that fired React's setstate-in-render error (the "1 Issue" dev
  overlay). The hold value now lives in a ref and `onDone()` fires outside
  any updater. Verified: zero warnings in the browser after the fix.
