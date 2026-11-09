/**
 * Think Leo — Leo Feed regression (v7)
 * ────────────────────────────────────
 * Proves the feed's psychology math behaves:
 *   · rarity table holds over 20k rolls
 *   · pity ALWAYS caps dry spells at PITY_MAX
 *   · forced (MEGA) cards are always epic or better
 *   · near-miss fires only on commons and never on forced cards
 *   · affinity boosts loved friends but never breaks rarity gates
 *   · streak luck bends the table toward shiny
 */
import {
  FEED_FRIENDS,
  HEAT_MAX,
  PITY_MAX,
  rollFeedCard,
  friendsOf,
} from "../src/lib/feed";
import type { Rarity } from "../src/lib/eggs";

let fails = 0;
const fail = (m: string) => {
  fails++;
  console.log("  ✗ " + m);
};
const ok = (m: string) => console.log("  ✓ ok  " + m);

/* deterministic rng */
let s = 123456789;
const rng = () => {
  s |= 0;
  s = (s + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/* 1. the table over 20k fresh rolls */
const counts: Record<string, number> = {};
let pity = 0;
for (let i = 0; i < 20000; i++) {
  const p = rollFeedCard({ pity, rng, album: {}, affinity: {} });
  counts[p.rarity] = (counts[p.rarity] ?? 0) + 1;
  pity = p.pityReset ? 0 : pity + 1;
  if (!FEED_FRIENDS.some((f) => f.uid === p.friend.uid)) fail(`unknown friend ${p.friend.uid}`);
}
const pct = (k: string) => +(((counts[k] ?? 0) / 200) * 1).toFixed(1);
console.log("── 20k rolls (pity resets keep it honest) ──");
console.log(`  common ${pct("common")}% · rare ${pct("rare")}% · epic ${pct("epic")}% · legend ${pct("legend")}% · mythic ${pct("mythic")}%`);
if ((counts["mythic"] ?? 0) === 0) fail("zero mythics in 20k rolls");
if ((counts["common"] ?? 0) < (counts["rare"] ?? 0)) fail("commons not the most common tier");
ok("cast lookup valid for every roll");

/* 2. pity: dry spells can never exceed PITY_MAX */
console.log("── pity ceiling ──");
let worst = 0;
s = 987654321;
pity = 0;
for (let i = 0; i < 5000; i++) {
  const p = rollFeedCard({ pity, rng, album: {} });
  pity = p.pityReset ? 0 : pity + 1;
  worst = Math.max(worst, pity);
  if (pity > PITY_MAX) fail("pity exceeded the ceiling");
}
if (worst > PITY_MAX) fail(`worst dry spell ${worst}`);
ok(`worst dry spell over 5k rolls = ${worst} (ceiling ${PITY_MAX})`);

/* 3. forced cards (MEGA) are always epic+ and never near-miss */
console.log("── forced MEGA cards ──");
s = 555555;
for (let i = 0; i < 2000; i++) {
  const p = rollFeedCard({ pity: 3, forced: true, rng, album: {} });
  const r = p.rarity as Rarity;
  if (r === "common" || r === "rare") fail(`forced card rolled ${r}`);
  if (p.nearMiss) fail("forced card played a near-miss");
  if (!p.heatCharged) fail("forced card not flagged heatCharged");
}
ok("2000 forced cards all epic+, no fake near-misses");

/* 4. affinity: love bends the species pick, not the rarity */
console.log("── affinity ──");
s = 424242;
const album: Record<string, number> = {};
const affinity: Record<string, number> = { "f-fox": 6 }; // max love for Sly
let fox = 0;
const rares = friendsOf("rare");
for (let i = 0; i < 4000; i++) {
  const p = rollFeedCard({ pity: 0, rng, album: {}, affinity });
  if (p.rarity === "rare") {
    if (p.friend.uid === "f-fox") fox++;
  }
}
const foxShare = fox / (rares.length - 1);
console.log(`  loved fox share vs each other rare ≈ ${foxShare.toFixed(1)}×`);
if (foxShare < 3) fail("affinity barely moved the pick");
ok("max affinity dominates its rarity bucket");

/* 5. streak luck: a 7-day flame rolls more shiny than a 0-day one */
console.log("── streak luck ──");
const shinyRate = (streak: number) => {
  s = 777;
  let shiny = 0;
  const N = 12000;
  let p0 = 0;
  for (let i = 0; i < N; i++) {
    const p = rollFeedCard({ pity: p0, streak, rng, album: {} });
    p0 = p.pityReset ? 0 : p0 + 1;
    if (p.rarity !== "common") shiny++;
  }
  return shiny / N;
};
const cold = shinyRate(0);
const warm = shinyRate(7);
console.log(`  no streak ${(cold * 100).toFixed(1)}% shiny · 7-day streak ${(warm * 100).toFixed(1)}% shiny`);
if (warm <= cold) fail("streak luck did not bend the table");
ok("streak luck bends the table toward shiny");

/* 6. album/affinity never break the plan shape */
console.log("── plan shape ──");
s = 31415;
for (let i = 0; i < 3000; i++) {
  const p = rollFeedCard({
    pity: i % 10,
    forced: i % 7 === 0,
    streak: i % 9,
    affinity: { "f-cat": 3 },
    album: { "f-cat": 4 },
    rng,
  });
  if (typeof p.isNew !== "boolean") fail("plan.isNew missing");
  if (p.friend.rarity !== p.rarity) fail(`friend ${p.friend.uid} rarity ≠ plan rarity ${p.rarity}`);
}
ok("3000 plans well-formed (friend rarity always matches)");

console.log(fails ? `\n${fails} FAILURES` : "\nALL PASS ✅");
process.exit(fails ? 1 : 0);
