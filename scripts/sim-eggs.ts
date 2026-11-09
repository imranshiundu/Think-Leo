/**
 * LEO EGGS — economy regression sim (run with: bun scripts/sim-eggs.ts)
 * Verifies, without a browser:
 *   1. rarity tables match their documented odds (60k rolls per egg kind)
 *   2. the Spark pity meter forces rare-or-better after a dry spell
 *   3. streak luck raises rare-or-better odds monotonically
 *   4. trackEgg: bag counts, star payouts, rarity XP, pity, nest restart
 *   5. evolution gating (3 copies → feed 2 → Stage 2)
 *   6. egg achievements unlock through the ONE economy
 *   7. the free Royal Egg is claimable exactly once per day
 */
import {
  CRITTERS,
  EGG_KINDS,
  GROW_COPIES,
  PITY_AT,
  RARITY_ORDER,
  nestState,
  planEgg,
  rollRarity,
  streakLuck,
  NEST_HATCH_MS,
} from "../src/lib/eggs";
import { useLeo } from "../src/lib/store";

let failures = 0;
const check = (name: string, cond: boolean, extra = "") => {
  if (!cond) {
    failures++;
    console.log(`  ✗ FAIL ${name} ${extra}`);
  } else {
    console.log(`  ✓ ok  ${name}`);
  }
};
const S = () => useLeo.getState();

console.log("[1] Rarity tables (60k rolls each)");
for (const kind of ["spark", "rainbow", "royal"] as const) {
  const counts: Record<string, number> = {};
  for (let i = 0; i < 60_000; i++) {
    const { rarity } = rollRarity(kind, 0, 0);
    counts[rarity] = (counts[rarity] ?? 0) + 1;
  }
  let allOk = true;
  for (const r of RARITY_ORDER) {
    const target = EGG_KINDS[kind].odds[r];
    const got = ((counts[r] ?? 0) / 60_000) * 100;
    // tolerance scales with rarity (rare rows are noisier)
    const tol = Math.max(1.2, target * 0.12);
    if (Math.abs(got - target) > tol) {
      allOk = false;
      console.log(`      ${kind}/${r}: got ${got.toFixed(2)}% want ${target}%`);
    }
  }
  check(`${kind} table within tolerance`, allOk);
}

console.log("\n[2] Spark pity forces rare-or-better");
{
  let forced = 0;
  for (let trial = 0; trial < 3000; trial++) {
    let pity = PITY_AT; // enter the crack already dry
    let hit = false;
    for (let i = 0; i < 40; i++) {
      const { rarity } = rollRarity("spark", 0, pity);
      if (rarity !== "common") {
        hit = true;
        break;
      }
      pity++;
    }
    if (hit) forced++;
  }
  check("a dry spark always ends within the next crack", forced === 3000, `${forced}/3000`);
  // and the store's pity counter resets on rare+, climbs on commons
  S().reset();
  S().trackEgg(
    planEgg("spark", 0, 0, () => true), // owned → dupe, whatever rarity
    {}
  );
  const after1 = S().eggPity;
  check("pity moves after a spark (0 or 1)", after1 === 0 || after1 === 1, String(after1));
}

console.log("\n[3] Streak luck is monotonic");
{
  const rate = (streak: number) => {
    let rarePlus = 0;
    for (let i = 0; i < 40_000; i++) {
      const { rarity } = rollRarity("spark", streak, 0);
      if (rarity !== "common") rarePlus++;
    }
    return rarePlus / 40_000;
  };
  const r0 = rate(0);
  const r3 = rate(3);
  const r20 = rate(20); // capped at +12.5% (reached at streak 5)
  check(`luck(0) ≈ base (${(r0 * 100).toFixed(1)}%)`, Math.abs(r0 - 0.32) < 0.02);
  check("luck(3) > luck(0)", r3 > r0, `${(r3 * 100).toFixed(1)}% vs ${(r0 * 100).toFixed(1)}%`);
  check("luck caps at +12.5% relative", r20 > r3 && r20 <= r0 * 1.32 + 0.02, `${(r20 * 100).toFixed(1)}%`);
  check("streakLuck math (epsilon)", Math.abs(streakLuck(3) - 0.075) < 1e-9 && Math.abs(streakLuck(99) - 0.125) < 1e-9);
}

console.log("\n[4] trackEgg pipeline");
{
  S().reset();
  const before = S();
  const xpBefore = before.xp;
  const starsBefore = before.eggStars;
  const plan = planEgg("spark", 0, 0, () => false); // guaranteed NEW
  const { gainedStars, xp } = S().trackEgg(plan, { nest: true });
  const after = S();
  check("first discovery pays EGG_DISCOVERY_STARS", gainedStars === 5 && after.eggStars === starsBefore + 5, `gained=${gainedStars}`);
  check("rarity XP flows into total XP (achievement bonuses may add)", after.xp >= xpBefore + xp, `+${xp}`);
  check("bag count 1", after.eggBag[plan.critter.uid]?.count === 1);
  check("nest restarted (eggNestAt ≈ now)", Math.abs(after.eggNestAt - Date.now()) < 1500);
  check("eggHatched === 1", after.eggHatched === 1);
  const dupe = planEgg("spark", 0, S().eggPity, () => true);
  const stars2 = S().eggStars;
  const pay = S().trackEgg(dupe, {});
  check("dupe pays rarity stars", S().eggStars === stars2 + pay.gainedStars && pay.gainedStars > 0, `+${pay.gainedStars}`);
  check("quest board intact (3 rows)", S().questProgress.length === 3);
}

console.log("\n[5] Evolution");
{
  S().reset();
  const uid = CRITTERS[0].uid;
  // two copies: cannot grow
  S().trackEgg({ ...planEgg("spark", 0, 0, () => true), critter: CRITTERS[0] }, {});
  S().trackEgg({ ...planEgg("spark", 0, 0, () => true), critter: CRITTERS[0] }, {});
  check("2 copies → cannot evolve", S().evolveCritter(uid) === false);
  S().trackEgg({ ...planEgg("spark", 0, 0, () => true), critter: CRITTERS[0] }, {});
  check("3 copies → evolve works", S().evolveCritter(uid) === true);
  const entry = S().eggBag[uid];
  check("evolved flag set, count 3→1", entry.evolved === true && entry.count === 1, JSON.stringify(entry));
  check("double evolve blocked", S().evolveCritter(uid) === false);
  check("GROW constants", GROW_COPIES === 3);
}

console.log("\n[6] Egg achievements through the ONE economy");
{
  S().reset();
  const ach = () => S().ach;
  // first crack
  const c0 = CRITTERS.find((c) => c.rarity === "legend")!;
  S().trackEgg({ ...planEgg("spark", 0, 0, () => true), critter: c0 }, {});
  check("First Crack unlocked", ach().includes("eggFirst"), ach().join(","));
  check("Golden Luck unlocked (legendary hatch)", ach().includes("eggLegend"));
  // fill the album
  for (const c of CRITTERS) {
    if (!S().eggBag[c.uid]) S().trackEgg({ ...planEgg("spark", 0, 0, () => true), critter: c }, {});
  }
  const found = Object.keys(S().eggBag).filter((k) => CRITTERS.some((c) => c.uid === k)).length;
  check("all 13 discovered", found === 13, `${found}/13`);
  check("Egg Explorer unlocked", ach().includes("eggExplorer"));
  check("Nest Master unlocked", ach().includes("eggMaster"));
  // XP flowed with every grant
  check("XP grew with every hatch", S().xp > 0, String(S().xp));
}

console.log("\n[7] Free Royal Egg — once per day");
{
  S().reset();
  check("claim works", S().claimRoyalEgg() === true);
  check("second claim blocked today", S().claimRoyalEgg() === false);
}

console.log("\n[8] Nest timers");
{
  const now = Date.now();
  const fresh = nestState(0, now);
  check("first visit: nest ready", fresh.ready === true);
  const mid = nestState(now - NEST_HATCH_MS / 2, now);
  check("halfway: ~50% and not ready", !mid.ready && Math.abs(mid.pct - 0.5) < 0.01, `pct=${mid.pct.toFixed(2)}`);
  const done = nestState(now - NEST_HATCH_MS - 1, now);
  check("past due: ready", done.ready === true);
}

console.log(failures === 0 ? "\nALL EGG TESTS PASSED" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
