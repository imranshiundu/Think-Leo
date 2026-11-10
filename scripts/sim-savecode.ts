/**
 * Think Leo — save-code regression (v9)
 * Run: bun scripts/sim-savecode.ts
 * The codec must be round-trip safe, whitespace-proof and tamper-proof —
 * a bad paste must never corrupt a kid's save.
 */
import { decodeSaveCode, encodeSaveCode, pickPayload } from "../src/lib/savecode";
import type { LeoSave } from "../src/lib/store";

let failures = 0;
function check(name: string, cond: boolean) {
  console.log(cond ? `  ✓ ok  ${name}` : `  ✗ FAIL ${name}`);
  if (!cond) failures++;
}

const fake = {
  xp: 420,
  weekXp: 90,
  leagueWeek: "2026-W46",
  hearts: 3,
  refills: 2,
  streak: 6,
  bestStreak: 11,
  lastPlayDay: "2026-11-10",
  freezes: 1,
  todayXp: 55,
  today: "2026-11-10",
  stars: { 1: 3, 2: 2, 3: 1 },
  best: { 1: 2200 },
  done: { 1: true, 2: true, 3: true },
  chests: { 0: true },
  soundSfx: true,
  soundMusic: false,
  boostDay: "",
  totalCorrect: 210,
  runs: 9,
  playDays: ["2026-11-09", "2026-11-10"],
  questDay: "2026-11-10",
  questProgress: [2, 0, 1],
  questClaimed: [true, false, false],
  questAllBonusDay: "",
  ach: ["sprout"],
  seenPlayerLevel: 3,
  comebackDay: "",
  mergeBest: 12,
  mergeDiscoveries: { 1: 3, 2: 1 },
  mergeEggDay: "",
  mergePlays: 4,
  totalMerges: 17,
  eggStars: 33,
  eggBag: { egg_a1: { count: 2, evolved: false } },
  eggHatched: 7,
  eggPity: 2,
  eggNestAt: 0,
  eggRoyalDay: "",
  feedPulls: 21,
  feedAlbum: { feed_pip: 3 },
  feedAffinity: { feed_pip: 5 },
  feedPity: 1,
  feedHeat: 3,
  feedBestHeat: 5,
  feedMegaDay: "",
  feedPullDay: "2026-11-10",
  skillStats: { count: { ok: 12, n: 14 } },
  playToday: { day: "2026-11-10", ms: 420000, bonus: 0 },
  dailyCapMin: 30,
} as unknown as LeoSave;

/* 1 — round trip keeps every durable field */
const code = encodeSaveCode(fake);
const back = decodeSaveCode(code);
check("round trip decodes ok", back.ok);
if (back.ok) {
  check("stars survive", JSON.stringify(back.payload.stars) === '{"1":3,"2":2,"3":1}');
  check("egg bag survives", back.payload.eggBag.egg_a1.count === 2);
  check("skill stats survive", back.payload.skillStats.count.ok === 12);
  check("cap survives", back.payload.dailyCapMin === 30);
  check("payload has no runtime fields", !("_hydrated" in back.payload));
}

/* 2 — a chat-app line wrap must not break it */
check("line-wrapped code decodes", decodeSaveCode(code.replace(/(.{40})/g, "$1\n")).ok);

/* 3 — tamper → friendly error, never a partial save */
const parts = code.split(".");
const tampered = `${parts[0]}.${parts[1].slice(0, -4)}AAAA.${parts[2]}`;
const bad = decodeSaveCode(tampered);
check("tampered body rejected", !bad.ok && /scrambled/.test(bad.error ?? ""));

/* 4 — not a Think Leo code at all */
check("garbage rejected", !decodeSaveCode("HELLO.WORLD.1234").ok);
check("truncated rejected", !decodeSaveCode(code.slice(0, 30)).ok);

/* 5 — payload covers the full durable surface (no LeoSave drift) */
check("payload key count", Object.keys(pickPayload(fake)).length >= 45);

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
