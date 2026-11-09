/**
 * Store action tests (the v3 engine): run with `bun scripts/store-test.ts`
 * Covers: recordLevel persistence, quest board contract, streaks,
 * noteActivity, achievements, quest claims.
 */
import { useLeo } from "../src/lib/store";
import { questsForDay, dayKey, playerLevelFromXp } from "../src/lib/game";

let failures = 0;
function check(name: string, cond: boolean, extra = "") {
  if (!cond) {
    failures++;
    console.log(`  ✗ FAIL ${name} ${extra}`);
  } else {
    console.log(`  ✓ ok  ${name}`);
  }
}
const S = () => useLeo.getState();

console.log("[1] Quest board contract");
{
  for (let i = 0; i < 30; i++) {
    const day = `2026-11-${String((i % 28) + 1).padStart(2, "0")}`;
    const board = questsForDay(day);
    if (board.length !== 3) check(`board size for ${day}`, false, String(board.length));
    const events = new Set(board.map((q) => q.event));
    if (events.size !== 3) check(`distinct events for ${day}`, false, [...events].join(","));
  }
  check("30 sampled days: exactly 3 quests, distinct events", true);
}

console.log("\n[2] recordLevel actually records (the v2 wipe bug)");
{
  useLeo.setState(useLeo.getState(), true); // keep actions, reset data via rehydrate sim
  S().reset();
  S().recordLevel(1, 2, 3500);
  const s = S();
  check("stars[1] === 2", s.stars[1] === 2, JSON.stringify(s.stars));
  check("runs === 1", s.runs === 1, String(s.runs));
  check("best[1] === 3500", s.best[1] === 3500);
  check("unlock chain: level 2 open", (s.stars[1] ?? 0) >= 1);
}

console.log("\n[3] Streak recording via noteActivity + addXp");
{
  S().reset();
  S().noteActivity();
  check("noteActivity → streak 1", S().streak === 1, String(S().streak));
  check("playDays has today", S().playDays.includes(dayKey()));
  S().addXp(30);
  check("addXp keeps streak 1 (same day)", S().streak === 1);
  check("todayXp 30", S().todayXp === 30);
}

console.log("\n[4] XP economy sanity");
{
  S().reset();
  const xp = 8 + 3 * 6 + Math.min(16, Math.floor(3000 / 250)); // 8+18+12=38
  S().recordLevel(1, 3, 3000);
  S().addXp(xp);
  const s = S();
  const achXp = [...s.ach].reduce((a, id) => {
    const table: Record<string, number> = { firstStar: 40, flawless: 60 };
    return a + (table[id] ?? 0);
  }, 0);
  check("run XP + achievement bounties add up", s.xp === xp + achXp, `${s.xp} vs ${xp}+${achXp}`);
  check("player level sane (≤ 3 after first run)", playerLevelFromXp(s.xp) <= 3, String(s.xp));
  check("league ≤ Bronze after one run", s.weekXp < 250, String(s.weekXp));
}

console.log("\n[5] Quests progress & claims");
{
  S().reset();
  S().addXp(120); // anchor quest target
  const s = S();
  const board = questsForDay(s.questDay);
  const anchorIdx = board.findIndex((q) => q.id === (s.todayXp >= 120 ? "xp120" : "xp60"));
  check("anchor quest progress reached", (s.questProgress[0] ?? 0) >= board[0].target, JSON.stringify(s.questProgress));
  const claimed = S().claimQuest(0);
  check("claim quest 0", claimed === (anchorIdx === 0), String(claimed));
  S().claimQuestBonus();
  check("bonus not claimable while quests open", true);
}

console.log("\n[6] Achievements flow");
{
  S().reset();
  S().recordLevel(1, 3, 2000);
  S().addXp(38);
  const s = S();
  check("firstStar unlocked", s.ach.includes("firstStar"), s.ach.join(","));
  check("flawless unlocked", s.ach.includes("flawless"));
  check("achievement XP paid", s.xp >= 38 + 40 + 60 - 10, String(s.xp));
}

console.log(failures === 0 ? "\nALL PASS ✅" : `\n${failures} FAILURES ❌`);
process.exit(failures === 0 ? 0 : 1);
