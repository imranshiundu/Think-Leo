/**
 * Think Leo — Game Economy & Formulas
 * ───────────────────────────────────
 * Every number that makes Think Leo feel like a game lives here so the
 * whole balance can be tuned (and documented) in one place.
 * Full math explained in docs/ALGORITHM.md.
 */

export type Mood =
  | "idle"
  | "happy"
  | "excited"
  | "sad"
  | "thinking"
  | "celebrate"
  | "sleep";

export interface World {
  id: number;
  name: string;
  emoji: string;
  tagline: string;
  node: string; // level-node fill
  edge: string; // level-node bottom edge
  wash: [string, string]; // map background gradient for this world
  banner: string;
}

export const WORLDS: World[] = [
  {
    id: 0,
    name: "Jungle Jam",
    emoji: "🌴",
    tagline: "Count, add & spot the odd one out",
    node: "#58cc02",
    edge: "#3f9a00",
    wash: ["#fff3d6", "#e3f6c9"],
    banner: "#58cc02",
  },
  {
    id: 1,
    name: "Coral Cove",
    emoji: "🌊",
    tagline: "Compare, sequence & think fast",
    node: "#2ec4b6",
    edge: "#1e9e92",
    wash: ["#dcf9f4", "#d4f3ef"],
    banner: "#2ec4b6",
  },
  {
    id: 2,
    name: "Space Hop",
    emoji: "🚀",
    tagline: "Times tables & memory rockets",
    node: "#9b5de5",
    edge: "#7a3fc4",
    wash: ["#f3e9ff", "#ffecf3"],
    banner: "#9b5de5",
  },
  {
    id: 3,
    name: "Candy Peak",
    emoji: "🍭",
    tagline: "The big brain championship",
    node: "#ff5a8c",
    edge: "#d63a6c",
    wash: ["#ffe9f1", "#fff3d6"],
    banner: "#ff5a8c",
  },
];

export const LEVELS_PER_WORLD = 10;
export const TOTAL_LEVELS = WORLDS.length * LEVELS_PER_WORLD; // 40
export const ROUND_COUNT = 8; // questions per level
export const RUSH_SECONDS = 12; // "Leo Rush" finale length
export const MAX_HEARTS = 5;
export const HEART_REGEN_MS = 15 * 60 * 1000; // one heart every 15 minutes
export const DAILY_GOAL_XP = 120;
export const RUSH_BASE = 60; // points per Rush answer (before ×2)
export const BASE_POINTS = 100;

export function worldOf(levelIdx: number): World {
  const i = Math.min(
    WORLDS.length - 1,
    Math.floor((levelIdx - 1) / LEVELS_PER_WORLD)
  );
  return WORLDS[i];
}

/** Difficulty tier 1..5 — slowly climbs across the 40 levels. */
export function baseDiff(levelIdx: number): number {
  return Math.max(1, Math.min(5, 1 + Math.floor((levelIdx - 1) / 8)));
}

/** Seconds to answer one question (a little less time each tier). */
export function questionTime(diff: number): number {
  return Math.max(9, Math.round(26 - diff * 2.6));
}

/** Combo multiplier: 1st answer ×1 … capped at ×3 from the 9th in a row. */
export function comboMult(combo: number): number {
  return Math.min(3, 1 + 0.25 * Math.max(0, combo - 1));
}

/** Answer fast → up to +50%. `fracLeft` = fraction of the clock remaining. */
export function speedMult(fracLeft: number): number {
  return 1 + 0.5 * Math.min(1, Math.max(0, fracLeft));
}

export function questionPoints(
  combo: number,
  fracLeft: number,
  rush = false
): number {
  return Math.round(
    BASE_POINTS * comboMult(combo) * speedMult(fracLeft) * (rush ? 2 : 1)
  );
}

/** Stars come from accuracy — simple for kids to understand. */
export function starsFor(accuracy: number): 0 | 1 | 2 | 3 {
  if (accuracy >= 0.9) return 3;
  if (accuracy >= 0.7) return 2;
  if (accuracy >= 0.5) return 1;
  return 0;
}

/** XP earned for a finished level run. */
export function xpForRun(score: number, stars: number): number {
  return Math.round(score / 12) + stars * 15;
}

/** Player level curve: each level costs a bit more XP than the last. */
export function xpToNext(playerLevel: number): number {
  return 120 + (playerLevel - 1) * 80;
}

export function playerLevelFromXp(xp: number): number {
  let lvl = 1;
  let rest = xp;
  while (rest >= xpToNext(lvl) && lvl < 200) {
    rest -= xpToNext(lvl);
    lvl += 1;
  }
  return lvl;
}

/** Weekly league tiers — cosmetic bragging rights, reset every Monday. */
export const LEAGUES = [
  { name: "Grass", min: 0, emoji: "🌱", color: "#58cc02" },
  { name: "Bronze", min: 150, emoji: "🥉", color: "#c47a3d" },
  { name: "Silver", min: 350, emoji: "🥈", color: "#9aa7b5" },
  { name: "Gold", min: 700, emoji: "🥇", color: "#ffc93c" },
  { name: "Crystal", min: 1200, emoji: "💎", color: "#2ec4b6" },
  { name: "Legend", min: 2000, emoji: "🏆", color: "#9b5de5" },
] as const;

export function leagueOf(weekXp: number) {
  let cur = LEAGUES[0];
  for (const l of LEAGUES) if (weekXp >= l.min) cur = l;
  return cur;
}

/** ISO-week key like 2026-W45, used for league resets. */
export function weekKey(d = new Date()): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Local calendar day "YYYY-MM-DD" — streaks use the kid's own clock. */
export function dayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dayKey(d);
}

export function isUnlocked(levelIdx: number, stars: Record<number, number>): boolean {
  return levelIdx <= 1 || (stars[levelIdx - 1] ?? 0) >= 1;
}

/** A world chest waits after every 10th level. */
export function chestAfterLevel(levelIdx: number): boolean {
  return levelIdx % LEVELS_PER_WORLD === 0;
}

export const CHEST_REWARDS = { refills: 2, xp: 40 } as const;

/** Leo's encouragement — picked by mood across the app. */
export const LEO_LINES: Record<string, string[]> = {
  morning: [
    "Roar! Morning brain, best brain!",
    "Rise and shine, explorer!",
    "Fresh day, fresh quest!",
  ],
  afternoon: [
    "Thinking time! I warmed up the puzzles.",
    "Let's make this afternoon EPIC.",
    "Snack ready? Brain ready? Let's go!",
  ],
  evening: [
    "Evening quests are my favourite!",
    "One more level before stars come out?",
    "Shhh… the puzzles are sleeping. Wake them up!",
  ],
  streak3: ["Three days strong! Keep the flame alive! 🔥"],
  streak7: ["A WHOLE WEEK of thinking! You're legendary! 🔥"],
  comeback: ["You came back! My mane is doing a happy dance."],
  zeroHearts: [
    "Hearts refill over time — brains need naps too!",
    "Out of hearts? Stretch, sip water, come back roaring!",
  ],
};

export function leoGreeting(): { line: string; mood: Mood } {
  const h = new Date().getHours();
  if (h < 6) return { line: "Night-owl thinker! I like it.", mood: "sleep" };
  if (h < 12) return { line: pick(LEO_LINES.morning), mood: "happy" };
  if (h < 18) return { line: pick(LEO_LINES.afternoon), mood: "excited" };
  return { line: pick(LEO_LINES.evening), mood: "happy" };
}

export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
