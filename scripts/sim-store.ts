/**
 * Think Leo — save-state regression (v7, bun + in-memory storage)
 * ────────────────────────────────────────────────────────────────
 * The two historic headline bugs, pinned by tests:
 *   1. levels ALWAYS end — any finished run opens the next level
 *   2. streaks ALWAYS record — XP grants stamp the play day
 * Plus the v7 feed pipeline (economy, pity, quests, achievements).
 */
import { useLeo, type LeoSave } from "../src/lib/store";
import { isUnlocked, dayKey, yesterdayKey } from "../src/lib/game";
import { rollFeedCard, HEAT_MAX, PITY_MAX } from "../src/lib/feed";

let fails = 0;
const fail = (m: string) => {
  fails++;
  console.log("  ✗ " + m);
};
const ok = (m: string) => console.log("  ✓ ok  " + m);

/* stub browser storage so zustand/persist is happy in bun */
const mem = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => void mem.clear(),
};
(globalThis as Record<string, unknown>).window = globalThis;

const S = () => useLeo.getState();
const reset = () =>
  useLeo.setState({
    xp: 0,
    weekXp: 0,
    hearts: 5,
    refills: 1,
    streak: 0,
    bestStreak: 0,
    lastPlayDay: "",
    todayXp: 0,
    stars: {},
    best: {},
    done: {},
    chests: {},
    totalCorrect: 0,
    runs: 0,
    ach: [],
    seenPlayerLevel: 1,
    mergeBest: 0,
    mergeDiscoveries: {},
    mergePlays: 0,
    totalMerges: 0,
    eggStars: 10,
    eggBag: {},
    eggHatched: 0,
    eggPity: 0,
    feedPulls: 0,
    feedAlbum: {},
    feedAffinity: {},
    feedPity: 0,
    feedHeat: 0,
    feedBestHeat: 0,
    feedMegaDay: "",
    feedPullDay: "",
    pendingAch: [],
  } as Partial<LeoSave>);

/* ── 1. LEVELS ALWAYS END ── */
console.log("── levels always end ──");
reset();
S().recordLevel(1, 0, 40); // a 0-star run STILL finishes the level
if (!S().done[1]) fail("0-star run did not set done[1]");
if (!isUnlocked(2, S().stars, S().done)) fail("level 2 did not open after a 0-star finish");
ok("0-star finish of level 1 opens level 2");

S().recordLevel(2, 1, 300);
if (!isUnlocked(3, S().stars, S().done)) fail("level 3 did not open");
if (S().runs !== 2) fail(`runs = ${S().runs}, expected 2`);
ok("1-star finish of level 2 opens level 3, run counter honest");

/* world gate: 3 finished levels of world 1 open level 11 */
reset();
S().recordLevel(1, 3, 800);
S().recordLevel(2, 2, 500);
if (isUnlocked(11, S().stars, S().done)) fail("world 2 opened with only 2 finished levels");
S().recordLevel(3, 1, 200);
if (!isUnlocked(11, S().stars, S().done)) fail("world gate did not open at 3 finished levels");
ok("world gate opens after 3 finished levels");

/* ── 2. STREAKS ALWAYS RECORD ── */
console.log("── streaks always record ──");
reset();
S().addXp(10); // first grant today → the streak begins at 1
if (S().streak !== 1) fail(`first-day streak = ${S().streak}, expected 1`);
if (S().lastPlayDay !== dayKey()) fail("lastPlayDay not stamped");
ok("first XP grant starts the streak at 1");

useLeo.setState({ lastPlayDay: yesterdayKey(), streak: 3, freezes: 1 });
S().addXp(5); // yesterday → today: streak lives
if (S().streak !== 4) fail(`chain streak = ${S().streak}, expected 4`);
ok("yesterday→today chains the streak to 4");

useLeo.setState({ lastPlayDay: "2026-01-01", streak: 6, freezes: 2 });
S().noteActivity(); // a finished run with no XP still counts the day
if (S().streak !== 1) fail(`broken chain reset to ${S().streak}, expected 1`);
ok("a long gap kindly restarts at 1 (freeze math separate)");

/* ── 3. THE FEED JOINS THE ONE ECONOMY ── */
console.log("── leo feed pipeline ──");
reset();
const rng = (() => {
  let x = 42;
  return () => ((x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
})();

/* a dry streak: commons until pity forces epic+ */
let epicSeen = false;
let pulls = 0;
while (!epicSeen && pulls < PITY_MAX + 1) {
  const plan = rollFeedCard({ pity: S().feedPity, rng, album: S().feedAlbum, affinity: S().feedAffinity });
  const { gainedSpark, xp } = S().trackFeed(plan);
  pulls++;
  if (plan.rarity !== "common") {
    epicSeen = true;
    if (xp < 5) fail(`shiny XP = ${xp}, expected ≥ 5`);
    ok(`pity fired at pull ${pulls}: ${plan.rarity} (+${xp} XP, +${gainedSpark} Spark)`);
  }
}
if (!epicSeen) fail("pity never fired within the ceiling");

if (S().feedPulls !== pulls) fail("feedPulls mismatch");
if ((S().feedAlbum["f-monkey"] ?? 0) < 1 && pulls > 3) fail("album not recording");
if (S().streak !== 1) fail("feed pulls did not stamp the play day");
ok("every pull stamped the day (streak lives while kids just play)");

/* new friend discovery bumps quests + pays discovery Spark */
reset();
const foxPlan = rollFeedCard({ pity: 0, rng, album: {}, affinity: {} });
const foxResolved = (() => {
  const p = { ...foxPlan, friend: { ...foxPlan.friend, uid: "f-fox", rarity: "rare" as const } };
  return { plan: p, pay: S().trackFeed(p) };
})();
if ((S().feedAlbum["f-fox"] ?? 0) !== 1) fail("new friend not in the Wall of Fame");
if (foxResolved.pay.gainedSpark < 5) fail("discovery Spark missing");
const boardQuests = S().questProgress;
if (!boardQuests.some((v) => v >= 1)) fail("no quest progress after feed pulls");
ok("first meeting pays discovery Spark + quest progress");

/* achievements fire */
if (!S().ach.includes("feedFirst")) fail("feedFirst achievement did not unlock");
ok("First Swipe achievement unlocked");

/* heat charges toward MEGA */
reset();
for (let i = 0; i < HEAT_MAX; i++) {
  const plan = rollFeedCard({ pity: 0, rng, album: S().feedAlbum, affinity: S().feedAffinity });
  S().trackFeed({ ...plan, rarity: "rare", friend: { ...plan.friend, rarity: "rare" } });
}
if (S().feedHeat !== HEAT_MAX) fail(`heat = ${S().feedHeat}, expected ${HEAT_MAX}`);
if (!S().ach.includes("feedHeat")) fail("Feed on Fire achievement missing");
ok(`heat reached ${HEAT_MAX} → next card is a MEGA card`);

console.log(fails ? `\n${fails} FAILURES` : "\nALL PASS ✅");
process.exit(fails ? 1 : 0);
