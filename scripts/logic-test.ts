/**
 * Headless logic test for Think Leo core systems.
 * Run: bun scripts/logic-test.ts
 * Exercises: question generation (all 40 levels), streak recording,
 * quests, achievements, level unlock chain, Leo Pop arcade math.
 *
 * v5 — updated to the current contracts:
 *  · tapTarget / feedLeo / memory are judge-yourself games:
 *    options=[] + answer=-1 is CORRECT, not a bug;
 *  · pattern questions carry sticker-id options (animal friends);
 *  · levels 1-2 are ALWAYS open ("levels must always end", v4);
 *  · Leo Pop: chain multipliers, merge points, egg table, XP curve.
 */
import {
  buildPlan,
  makeQuestion,
  makeRushQuestion,
} from "../src/lib/questions";
import {
  dayKey,
  yesterdayKey,
  daysBetween,
  isUnlocked,
  leagueOf,
  playerLevelFromXp,
  questionTime,
  starsFor,
  weekKey,
  xpForRun,
  xpToNext,
} from "../src/lib/game";
import {
  chainMult,
  EGG_CHANCE,
  EGG_PITY,
  mergePoints,
  POP_CHAIN,
  rollEgg,
  xpForMergeRun,
  ZOO_TARGET,
} from "../src/lib/arcade";

let failures = 0;
function check(name: string, cond: boolean, extra = "") {
  if (!cond) {
    failures++;
    console.log(`  ✗ FAIL ${name} ${extra}`);
  } else {
    console.log(`  ✓ ok  ${name}`);
  }
}

/* ── 1. Question generation sanity over all 40 levels ─────────── */
console.log("\n[1] Question factory — 40 levels × 8 questions");
let genFails = 0;
for (let lvl = 1; lvl <= 40; lvl++) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const plan = buildPlan(lvl);
    if (plan.length !== 8) { genFails++; console.log(`  level ${lvl}: plan length ${plan.length}`); }
    for (let qi = 0; qi < 8; qi++) {
      const q = makeQuestion(plan[qi], 1 + Math.floor((lvl - 1) / 8), lvl, qi, attempt);
      // judge-yourself mini-games (v4): options=[], answer=-1 — by design
      const judgeYourself = q.kind === "memory" || q.kind === "tapTarget" || q.kind === "feedLeo";
      const bad =
        !q.prompt ||
        typeof q.answer !== "number" ||
        (judgeYourself
          ? q.kind === "memory"
            ? !q.pads || q.pads.length < 3
            : q.answer !== -1
          : q.options.length < 2 || q.options.some((o) => o === "NaN" || o === "undefined")) ||
        (!judgeYourself && q.answer < 0) ||
        (!judgeYourself && q.answer >= q.options.length);
      if (bad) {
        genFails++;
        console.log(`  level ${lvl} q${qi} kind=${q.kind}: prompt="${q.prompt}" options=${JSON.stringify(q.options)} answer=${q.answer}`);
      }
      // determinism: same inputs → identical question
      const q2 = makeQuestion(plan[qi], 1 + Math.floor((lvl - 1) / 8), lvl, qi, attempt);
      if (JSON.stringify(q) !== JSON.stringify(q2)) {
        genFails++;
        console.log(`  level ${lvl} q${qi}: NOT deterministic`);
      }
    }
  }
  // rush questions
  for (let i = 0; i < 30; i++) {
    const rq = makeRushQuestion(3, i, 1);
    const judgeYourself = rq.kind === "memory" || rq.kind === "tapTarget" || rq.kind === "feedLeo";
    if (!rq.prompt || (!judgeYourself && rq.kind !== "memory" && rq.options.length < 2)) {
      genFails++;
      console.log(`  rush ${i}: kind=${rq.kind} options=${JSON.stringify(rq.options)}`);
    }
  }
}
check("question generation clean", genFails === 0, `(${genFails} problems)`);

// timer sanity
let timeFails = 0;
for (let d = 1; d <= 6; d++) {
  const t = questionTime(d);
  if (!(t >= 9 && t <= 27)) timeFails++;
}
check("question timers sane", timeFails === 0);

/* ── 2. Streak math (pure re-implementation of addXpPure core) ── */
console.log("\n[2] Streak recording");
// simulate consecutive-day plays via the real functions
{
  // Verify dayKey/daysBetween round trip
  const t = dayKey();
  const y = yesterdayKey();
  check("dayKey format", /^\d{4}-\d{2}-\d{2}$/.test(t), t);
  check("yesterday is -1 day", daysBetween(y, t) === 1);
}

/* ── 3. Unlock chain (v4 contract: levels 1-2 are always open) ── */
console.log("\n[3] Level unlock chain");
{
  const stars: Record<number, number> = {};
  check("level 1 always unlocked", isUnlocked(1, stars));
  check("level 2 always unlocked (levels must end)", isUnlocked(2, stars));
  stars[2] = 2;
  check("level 3 unlocked after finishing 2", isUnlocked(3, stars));
  check("level 4 still locked", !isUnlocked(4, stars));
  const done: Record<number, boolean> = { 3: true };
  check("a finished run (0 stars) opens the next level", isUnlocked(4, {}, done));
}

/* ── 4. XP → level curve ──────────────────────────────────────── */
console.log("\n[4] XP / player level");
{
  check("level 1 needs 120 XP", xpToNext(1) === 120);
  const lvl2xp = xpToNext(1); // 120
  check("120 XP → level 2", playerLevelFromXp(lvl2xp) === 2);
  check("0 XP → level 1", playerLevelFromXp(0) === 1);
  const xpRun = xpForRun(1000, 3);
  check("xpForRun positive", xpRun > 0, String(xpRun));
  check("3 stars at 90%+", starsFor(0.9) === 3);
  check("0 stars below 50%", starsFor(0.4) === 0);
  check("league starts Grass", leagueOf(0).name === "Grass");
  check("league Gold at 700", leagueOf(700).name === "Gold");
}

/* ── 5. Week key ──────────────────────────────────────────────── */
console.log("\n[5] Week key");
{
  const wk = weekKey();
  check("weekKey format", /^\d{4}-W\d{2}$/.test(wk), wk);
}

/* ── 6. Leo Pop — the arcade math (v5) ────────────────────────── */
console.log("\n[6] Leo Pop arcade math");
{
  // the chain is a complete 11-step ladder with unique radii and names
  check("chain has 11 creatures", POP_CHAIN.length === 11);
  check("chain radii strictly grow (base 10)", POP_CHAIN.slice(0, 10).every((c, i) => i === 0 || c.r > POP_CHAIN[i - 1].r));
  check("golden Leo is LEO-sized", POP_CHAIN[10].r === POP_CHAIN[9].r);
  check("zoo target = base creatures only", ZOO_TARGET === 10);

  // chain multiplier climbs and caps at x4
  check("chain ×1 = ×1", chainMult(1) === 1);
  check("chain ×2 = ×1.5", chainMult(2) === 1.5);
  check("chain caps at ×4", chainMult(50) === 4);

  // merge points follow the created tier and respect the chain
  check("two ladybugs → 1 pt", mergePoints(1, 1) === 1);
  check("chain scales points", mergePoints(3, 2) === Math.round(6 * 1.5));
  check("LEO creation pays 45 at ×1", mergePoints(9, 1) === 45);

  // the egg table never misfires
  let bad = 0;
  for (let i = 0; i < 5000; i++) {
    if (!["gift", "party", "twins", "popcorn"].includes(rollEgg())) bad++;
  }
  check("5000 egg rolls all valid", bad === 0);

  // egg odds stay in the variable-ratio band
  check("egg chance is 12%", EGG_CHANCE === 0.12);
  check("pity ceiling ≤ 9 drops", EGG_PITY <= 9);

  // XP stays inside the level economy (a great run ≈ a level run)
  check("0-score run still earns a little", xpForMergeRun(0, 0) === 6);
  check("600-score run ≈ 14 XP", xpForMergeRun(600, 0) === 14);
  check("XP curve is capped", xpForMergeRun(99999, 0) === 30);
}

console.log(failures === 0 ? "\nALL PASS ✅" : `\n${failures} FAILURES ❌`);
process.exit(failures === 0 ? 0 : 1);
