# Kid-Brain Field Test — thinkleo.vercel.app (2026-11-10)

**Method:** drove the live deployment with a real browser at a phone viewport
(390×844), behaving like a 5–7-year-old: tap the shiniest thing, answer wrong on
purpose, freeze under pressure, rage around, go offline. Everything below was
*actually clicked*, with screenshots.

**Headline:** the site kids are playing today is the **old v3 build**
(`sw.js` on the deployment says `think-leo-v3`), not the code we fixed. The
build we pushed compiles clean — the deployment just never picked it up.

## What failed (kid's eyes)

| # | What a kid hits | Live build today | New build (in repo) |
| --- | --- | --- | --- |
| 1 | **The deployment is stale** — 4 worlds, no LEO FEED / LEO POP / LEO EGGS anywhere on the home screen; the arcade games simply don't exist for them | v3 (old) | fixed by *deploying* — build verified: `next build` passes |
| 2 | **Pattern round is unanswerable**: "What comes next in the pattern?" shows **every cell as a dashed "?"** — the pattern itself is never shown. A kid can only guess and watch the timer eat a heart-worth of time | broken | kind removed — replaced by number *sequence* puzzles (`genSequence`) |
| 3 | **Machine text leaks into a kid's answer card**: one option literally renders `square-#9b5de5` (and `star-…`, `triangle-…` on later rounds) — a colour-name lookup missing a palette entry fell back to the raw key | broken | kind has no shape-pattern questions at all |
| 4 | **A struggling kid earns nothing**: finishing Level 1 at 13% accuracy shows **+0 XP**. They *did* finish — they opened Level 2 — but the effort paid zero toward the daily goal | broken | fixed — `xpForRun = 8 + stars×6 + min(16, score/250)`: every finished run pays at least 8 XP |
| 5 | **Shadow round is shadow-to-shadow**: the question is a black cat silhouette and *all three answers are also black silhouettes*. For a pre-reader that's abstract shape algebra, on a timer that was already down to 6 s when the round opened | hard | new build keeps Shadow Match but the round library was rebuilt (and the feed-bowl overlay bug is gone — bowl only appears on `feedLeo`) |
| 6 | **Timeouts are silent**: the round just… moves on (amber paw print, no heart lost, no "time's up!" beat a kid can feel). Kind on hearts, confusing in rhythm | old | unchanged behaviour — candidate for a small "time's up" shake+sound beat |

## What a kid hits that *works* (don't regress these)

- **Wrong-answer coaching is genuinely kind** — the tapped answer glows pink,
  the right one glows green, Leo says *"No worries — Touch each one and count
  out loud!"*, a free retry with a fresh 10 s timer.
- **The level ends.** 8 rounds → LEO RUSH (live countdown, 11.4 s observed) →
  hard stop at 0 → "Level finished!" → **Level 2 opens**. The "I've been on
  level one forever" bug is dead even on the old build.
- **Tap-it round is the best round** — "Tap all the monkeys!", big icons, a
  real `0 / 3 found` counter, zero reading required.
- **Maths reads clean** — "1 + 8 = ?" huge and unmissable.
- **Hearts/streak actually record** — 5→4 on a mistake, streak flame showed 1.
- **Offline bus-ride test passes** — airplane mode + reload → full home screen
  from the service-worker cache, streak and stars intact.

## Smaller notes

- The map opens with a wall of grey locks; the kid's green level *is* visible
  at the bottom, but the first thing at eye level is everything they can't do.
  Camera framing could start at the kid's node.
- Progress paw-prints and the countdown ring are small and pale at the top of
  the play screen — a pre-reader can't read "6" in a 28 px ring.
- Points (117 pts) vs XP (+0/+8) is two currencies on one screen; kids count
  stars, parents read XP.

## The one action that matters

**Redeploy.** The pushed code builds (`next build` ✓, 5/5 pages) but Vercel
still serves `think-leo-v3`, so either the Git integration points at a
different repo/branch or auto-deploy is off. Every finding in rows 1–4 is
already fixed on disk — the kid in Nairobi is just not being served it.

## Shipped the same day (2026-11-10, evening)

The normal push triggered Vercel and the live site serves the new build
(`sw.js` = `think-leo-v6`). Three kid-test findings became code, each verified
with real clicks on the dev build before shipping:

- **#5 → coloured shadow answers.** The question keeps its black silhouette;
  the answers now show the real coloured animals (monkey, elephant, parrot),
  60 px for an easy thumb hit. Screenshot-verified.
- **#6 → the "TIME'S UP!" beat.** Timeouts now slam a big wobbly stamp into
  the middle of the screen with their own friendly SFX (`timeUp`: two
  woodblock knocks down + a rising "try again!" chirp) — the clock gets a
  voice instead of a silent drift to the next round. DOM + screenshot
  verified; the stamp lives exactly through the 1.6 s feedback window.
- **Map camera → the kid's node.** The camera effect only depended on
  `[scale]`, so with a save that rehydrated after mount it aimed at level 1
  and never corrected. It now re-aims on `currentLevel`/`save.stars`:
  seeded levels 1–5 done → the map opens with level 6 mid-screen, Leo beside
  it, the starred trail below and the locked future above. Verified with a
  seeded save.

Still open on purpose (design decisions, not bugs): timer ring and paw-print
progress are small for pre-readers, and points vs XP is two currencies on one
screen — both queued for the parent-HQ pass.
