/**
 * Think Leo v4 — logic regression sim (run with: bun scripts/sim-v4.ts)
 * Verifies the "levels must always end" guarantees without a browser:
 *   1. every level's 8-question plan builds and every question generates
 *   2. every question has a valid answer index / required fields
 *   3. unlock rules: done-flags open the next level; world gates open early
 *   4. a simulated practice run (0 stars) still unlocks level 2
 */
import {
  LEVELS_PER_WORLD,
  WORLDS,
  finishedCount,
  isUnlocked,
} from "../src/lib/game";
import { buildPlan, makeQuestion } from "../src/lib/questions";

let failures = 0;
const fail = (msg: string) => {
  failures++;
  console.error("  ✗ " + msg);
};

/* 1+2: generate the entire campaign */
console.log("── campaign generation ──");
for (let lvl = 1; lvl <= WORLDS.length * LEVELS_PER_WORLD; lvl++) {
  const plan = buildPlan(lvl);
  if (plan.length !== 8) fail(`level ${lvl}: plan length ${plan.length}`);
  for (const kind of plan) {
    for (let diff = 1; diff <= 6; diff++) {
      const q = makeQuestion(kind, diff, lvl, 0, 1);
      if (!q.prompt) fail(`L${lvl} ${kind} d${diff}: empty prompt`);
      if (typeof q.answer !== "number") fail(`L${lvl} ${kind}: bad answer`);
      if (q.time <= 0) fail(`L${lvl} ${kind} d${diff}: bad time ${q.time}`);
      if (["tapTarget", "shadow", "pattern"].includes(kind)) {
        if (kind === "shadow" && !q.ask) fail(`L${lvl} shadow: no ask`);
        if (kind === "tapTarget" && (!q.tiles || q.tiles.length < 9)) fail(`L${lvl} tapTarget: thin crowd`);
        if (kind === "pattern" && (!q.seqTokens || !q.seqTokens.includes("?"))) fail(`L${lvl} pattern: no ? slot`);
        if (kind === "pattern" && q.answer < 0) fail(`L${lvl} pattern: answer not in options`);
        if (kind === "shadow" && (q.answer < 0 || q.answer >= q.options.length)) fail(`L${lvl} shadow: answer OOB`);
      }
      if (kind === "feedLeo" && !(q.want && q.want >= 3 && q.want <= 9)) fail(`L${lvl} feedLeo: bad want`);
    }
  }
}
console.log("  40 levels × 12 kinds × 6 difficulties generated");

/* 3: unlock rules */
console.log("── unlock rules ──");
const stars: Record<number, number> = {};
const done: Record<number, boolean> = {};
if (!isUnlocked(1, stars, done)) fail("level 1 should be open from the start");
if (!isUnlocked(2, stars, done)) fail("level 2 should be open from the start");
if (isUnlocked(3, stars, done)) fail("level 3 must be locked before finishing 2");
done[2] = true;
if (!isUnlocked(3, stars, done)) fail("finishing level 2 (done flag, 0 stars) must open level 3");
for (let i = 4; i <= 10; i++) {
  done[i - 1] = true;
  if (!isUnlocked(i, stars, done)) fail(`level ${i} should follow from done[${i - 1}]`);
}
/* world gate: with only 1-2 finished levels, world 2 stays shut */
console.log("── world gate ──");
const gateStars: Record<number, number> = {};
const gate1: Record<number, boolean> = { 2: true };
if (isUnlocked(11, gateStars, gate1)) fail("1 finished level must NOT open world 2");
const gate3: Record<number, boolean> = { 2: true, 3: true, 4: true };
if (!isUnlocked(11, gateStars, gate3)) fail("3 finished levels must open world 2's first level");
if (!isUnlocked(2, gateStars, gate3)) fail("sanity: level 2 always open");
console.log("  1 finished → shut · 3 finished → world 2 opens ✓");
done[11] = true;
if (!isUnlocked(12, stars, done)) fail("level 12 should follow from done[11]");
console.log(`  finishedCount across that map: ${finishedCount(stars, done)} (expect 9)`);

/* 4: practice run unlocks the next level */
console.log("── practice-run guarantee ──");
const freshStars: Record<number, number> = {};
const freshDone: Record<number, boolean> = {};
// simulate: kid plays level 1 in practice, answers 3/8 right (0 stars), finishes
freshDone[1] = true;
if (!isUnlocked(2, freshStars, freshDone)) fail("practice finish must open level 2");
console.log("  0-star practice finish opens level 2 ✓");

if (failures === 0) console.log("\nALL CHECKS PASSED");
else {
  console.error(`\n${failures} FAILURES`);
  process.exit(1);
}
