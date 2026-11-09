# Think Leo — The Algorithm Book

> Everything that makes Think Leo *feel* the way it does: the loops, the math,
> the sounds, the lion. Written to be read by a designer, an engineer, or a
> curious 10-year-old.
>
> Code map: `src/lib/game.ts` (economy) · `src/lib/questions.ts` (puzzle
> factory) · `src/lib/sound.ts` (audio engine) · `src/lib/store.ts` (save
> state) · `src/lib/device.ts` (laptop gate) · `src/components/leo/Leo.tsx`
> (mascot) · `src/components/game/*` (screens).

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
   players *don't* burn out. → Think Leo: **5 hearts, +1 every 15 min**
   (kinder for kids), plus refill tickets from world chests (§6.2).
2. **The level map.** A winding trail of star-rated, locked nodes makes
   progress *visible and ownable* (Core Drive 2: Development &
   Accomplishment). → `LevelMap.tsx`: sine-wave trail, 3-star nodes, locks,
   world banners, chests (§3).
3. **The end-of-level celebration.** "Sugar Crush" turns the end of a board
   into a free, escalating fireworks bonus. → **LEO RUSH**: after the 8th
   puzzle, 12 seconds of ×2 points where hearts can't be lost — pure
   adrenaline with zero punishment (§5.4).

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

- **4 worlds × 10 levels = 40 levels** (`WORLDS`, `LEVELS_PER_WORLD`):
  🌴 Jungle Jam → 🌊 Coral Cove → 🚀 Space Hop → 🍭 Candy Peak.
- **Unlock rule:** level *i* unlocks when level *i−1* has ≥ 1 star.
  `isUnlocked(i, stars) = i === 1 || stars[i-1] >= 1`.
- **Map geometry** (`LevelMap.tsx`): nodes sit on a sine trail
  `x(i) = centerX + sin(i × 1.05) × 165`, `y(i) = H − pad − (i−1) × 96`,
  rendered bottom-up (level 1 at the bottom, like Candy Crush). A dotted
  polyline threads the nodes; the current quest pulses and Leo stands on it.
- **World chests** wait after levels 10/20/30/40: first 1-star clear claims
  **+2 heart-refill tickets + 40 XP** (once each; `grantChest`).

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

### 4.3 The 8 mini-games

| Kind | Skill | Difficulty scaling (diff 1→6) |
| --- | --- | --- |
| 🔢 Count | cardinality | 3 → 16 items, tighter near-miss options (±1 → ±3) |
| ➕ Maths | add/subtract | 1-digit → 2-digit → 3-term `a + b − c` |
| ⚖️ Compare | magnitude | emoji plates → numbers up to 999; bigger *or* smaller |
| 🔍 Odd one | categorization | unrelated intruder → *look-alike category* intruder (fruit vs veggie) |
| 🧩 Sequence | pattern rules | +1 hop → doubles → triples → zigzag (+u,−d) → Fibonacci-style |
| ✖️ Tables | multiplication | ×2–3 → full ×12, distractors = ±one group (`a(b±1)`, `ab±a`) |
| 🎯 True/Trap | verification | sums ≤ 10 → ±50 with sneaky ±5 lies |
| 🎵 Memory | working memory | Simon-style: 3 → 6 pads, each pad has its own note |

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

### 6.2 Hearts (scarcity, softened)

```
max = 5 · regen = 1 heart / 15 min · tokens from chests = instant full refill
```

Regen is computed from timestamps, not tick counts: `tickHearts()` pours in
`⌊(now − heartsAt) / 15min⌋` hearts whenever the app is open, and the stamp
advances by exactly the poured amount, so offline time counts too. Losing a
heart starts the clock only if the tank was full.

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

`localStorage["think-leo-save-v1"]` via zustand `persist` (offline-first PWA;
no server, no accounts, nothing leaves the device):

```jsonc
{
  "xp": 1240, "weekXp": 420, "leagueWeek": "2026-W45",
  "hearts": 4, "heartsAt": 1731150000000, "refills": 2,
  "streak": 5, "bestStreak": 5, "lastPlayDay": "2026-11-08", "freezes": 1,
  "todayXp": 80, "today": "2026-11-08",
  "stars": { "1": 3, "2": 2 }, "best": { "1": 2310 },
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
| `combo(n)` | see §8.3 | escalation |
| `heartLost` | two-note minor fall | gentle "oh" |
| `tick` | 30 ms 1320 Hz square | urgency |
| `star(i)` | 1046/1318/1568 Hz sparkle | reward streak |
| `win` | 4-note fanfare + sub-octave + shimmer | parade |
| `fail` | 3-note sad wobble | sympathy |
| `whoosh` | bandpass noise sweep 300→2400 Hz | ignition |
| `flame` | noise crackle + rising tone | streak fire |
| `pad(i)` | C4/E4/G4/C5 triangle | memory melody |

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

## 9. The laptop-only gate

**Requirement: the game never runs on phones or tablets.** `detectDevice()`
(`src/lib/device.ts`) returns `mobile` when *any* of:

```
1. mobile UA          /Android|iPhone|iPod|Windows Phone|…|iPad/
2. disguised iPad     /Macintosh/ UA  &&  maxTouchPoints > 1
3. touch-first        primary pointer = coarse  &&  no fine pointer
4. small touch screen min(w,h) < 700 px  &&  primary pointer coarse
```

Rule of thumb: **a laptop's physical signature is a fine primary pointer**
(mouse/trackpad). Touchscreen laptops pass; phones and tablets (including
iPads pretending to be Macs) don't. `watchDevice()` re-checks on
resize/rotation, and the gate screen has an honest escape hatch ("Wait — I am
on a laptop") that re-runs detection. While gated, *nothing* of the game
renders — not even behind a loader.

### 9.1 Device details are recorded (both sides of the gate)

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
on the network. The gate screen shows the detected device back to the visitor
("We spotted: Phone · Android · Chrome · 393×873"), which proves the detection
is real, not a vibe.

---

## 10. Leo the mascot (state machine)

Leo is parametric SVG: a 12-circle mane ring, a face, and a `Look` table per
mood (`Leo.tsx`). framer-motion drives body bob, tail wag (2.2 s cycle), and
blink (scaleY squash every ~4 s); paws animate independently when raised.

| Mood | Eyes | Mouth | Body | Trigger |
| --- | --- | --- | --- | --- |
| `idle` | open + blink | smile | float | resting / between questions |
| `happy` | open | open smile | bounce | correct answer |
| `excited` | wide | open | bounce fast | combos ≥ 5, Rush, intro |
| `sad` | downturned pupils, brows | frown | slow droop | miss / timeout / out of hearts |
| `thinking` | pupils up-right, one brow | flat | still, paw on chin | phone gate, hints |
| `celebrate` | **star eyes** | open | dance + sparkles | level clear |
| `sleep` | closed | flat | slow breathe + zzz | before 6 AM |

Leo speaks through a spring-loaded speech bubble: praise on streaks, the
*puzzle's own hint* on a miss (teaching, not judging), time-of-day greetings
on home, and soft no-heart encouragement.

---

## 11. Startup animation

First visit per session (2.6 s): whoosh → Leo springs in (stiffness 160,
damping 15) → wordmark pops letter-by-letter (70 ms stagger) → fanfare +
star-burst → curtain lifts. Repeat visits in the same session get a 0.75 s
logo fade. Any tap skips. The splash doubles as the hydration cover, so the
app never flashes unhydrated state.

---

## 12. PWA shape

- `manifest.webmanifest`: standalone (+ `display_override`,
  `launch_handler: navigate-existing`), theme `#FFB020`, maskable + any icons.
- `public/sw.js` **v3**: precaches the shell, icons and the three music
  tracks; cache-first for `/_next/static`, icons and `/audio/*`; network-first
  for navigations with cached-shell fallback → **the game fully boots and
  sounds right offline**. `SKIP_WAITING` + `clients.claim()` plus a
  controller-change reload keep installed apps auto-updated.
- Registration happens at the root layout — the service worker installs even
  on the phone gate, so the installed app on any device is a real PWA.
- Install prompt captured via `beforeinstallprompt` and surfaced as a chunky
  button on Home.

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

Migration: v2 saves (inflated XP era) are rescaled ÷12 on load, boards are
rebuilt, stars/best survive.

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
