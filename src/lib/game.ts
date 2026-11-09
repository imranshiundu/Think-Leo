/**
 * Think Leo — Game Economy & Formulas
 * ───────────────────────────────────
 * Every number that makes Think Leo feel like a game lives here so the
 * whole balance can be tuned (and documented) in one place.
 * Full math explained in docs/ALGORITHM.md.
 */

import type { StickerId } from "@/components/leo/stickers";
import type { BadgeId } from "@/components/leo/badges";

export type Mood =
  | "idle"
  | "happy"
  | "excited"
  | "sad"
  | "thinking"
  | "celebrate"
  | "wow"
  | "cheer"
  | "sleep";

export interface World {
  id: number;
  name: string;
  emblem: StickerId; // illustrated world mark (replaces emoji)
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
    emblem: "monkey",
    tagline: "Count, add & spot the odd one out",
    node: "#58cc02",
    edge: "#3f9a00",
    wash: ["#fff3d6", "#e3f6c9"],
    banner: "#58cc02",
  },
  {
    id: 1,
    name: "Coral Cove",
    emblem: "fish",
    tagline: "Compare, sequence & think fast",
    node: "#2ec4b6",
    edge: "#1e9e92",
    wash: ["#dcf9f4", "#d4f3ef"],
    banner: "#2ec4b6",
  },
  {
    id: 2,
    name: "Space Hop",
    emblem: "rocket",
    tagline: "Times tables & memory rockets",
    node: "#9b5de5",
    edge: "#7a3fc4",
    wash: ["#f3e9ff", "#ffecf3"],
    banner: "#9b5de5",
  },
  {
    id: 3,
    name: "Candy Peak",
    emblem: "lollipop",
    tagline: "The big brain championship",
    node: "#ff5a8c",
    edge: "#d63a6c",
    wash: ["#ffe9f1", "#fff3d6"],
    banner: "#ff5a8c",
  },
  {
    id: 4,
    name: "Farm Days",
    emblem: "cow",
    tagline: "Barnyard counting & country quests",
    node: "#ff9f43",
    edge: "#d97706",
    wash: ["#ffefd0", "#ffe2b8"],
    banner: "#ff9f43",
  },
  {
    id: 5,
    name: "Road Rush",
    emblem: "car",
    tagline: "Fast eyes, fast taps, big trips",
    node: "#3a86ff",
    edge: "#2667cc",
    wash: ["#e3f0ff", "#d8eaff"],
    banner: "#3a86ff",
  },
];

export const LEVELS_PER_WORLD = 10;
export const TOTAL_LEVELS = WORLDS.length * LEVELS_PER_WORLD; // 60
export const ROUND_COUNT = 8; // questions per level
export const RUSH_SECONDS = 12; // "Leo Rush" finale length
export const MAX_HEARTS = 5;
export const HEART_REGEN_MS = 8 * 60 * 1000; // one heart every 8 minutes (kids wait badly)
export const DAILY_GOAL_XP = 120;
/** Levels 1-2 are learning levels: running out of time never costs a heart. */
export const GENTLE_LEVELS = 2;
/** How many finished levels open the gate to the next world (early access). */
export const WORLD_GATE_DONE = 3;
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

/**
 * XP earned for a finished level run — Duolingo-scale (a lesson ≈ 10–30 XP,
 * the daily goal = a handful of lessons). Score stays big and juicy on the
 * results screen, but XP is deliberately small so player levels, the daily
 * ring and the weekly league each take a satisfying *few days* to climb —
 * one run must never jump three leagues (that bug shipped once; never again).
 */
export function xpForRun(score: number, stars: number): number {
  return 8 + stars * 6 + Math.min(16, Math.floor(score / 250));
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

/**
 * Weekly league tiers — cosmetic bragging rights, reset every Monday.
 * Calibrated to the XP economy: a good run ≈ 25–35 XP, a solid day ≈ 60–120 XP,
 * so Bronze lands after ~2–3 days of play and Legend is a true weekly grind.
 */
export const LEAGUES: { name: string; min: number; badge: BadgeId; color: string }[] = [
  { name: "Grass", min: 0, badge: "sprout", color: "#58cc02" },
  { name: "Bronze", min: 100, badge: "bronze", color: "#c47a3d" },
  { name: "Silver", min: 250, badge: "silver", color: "#9aa7b5" },
  { name: "Gold", min: 500, badge: "gold", color: "#ffc93c" },
  { name: "Crystal", min: 900, badge: "gem", color: "#2ec4b6" },
  { name: "Legend", min: 1500, badge: "trophy", color: "#9b5de5" },
];

export function leagueOf(weekXp: number) {
  let cur = LEAGUES[0];
  let idx = 0;
  LEAGUES.forEach((l, i) => {
    if (weekXp >= l.min) {
      cur = l;
      idx = i;
    }
  });
  const next = LEAGUES[idx + 1] ?? null;
  return { ...cur, index: idx, next };
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

/** Whole days between two day keys (b - a). */
export function daysBetween(a: string, b: string): number {
  if (!a || !b) return 0;
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const da = Date.UTC(ay, am - 1, ad);
  const db = Date.UTC(by, bm - 1, bd);
  return Math.round((db - da) / 86400000);
}

/**
 * Unlock rules (v4 — "levels must always end, kids must always move"):
 *   · levels 1-2 are open from the start;
 *   · a level opens when the previous one was FINISHED — a star is the
 *     shiny version, but any completed run (even 0 stars, even practice)
 *     counts as done;
 *   · the first level of every world opens after 3 finished levels in the
 *     previous world, so curious kids can peek into new worlds early.
 */
export function isUnlocked(
  levelIdx: number,
  stars: Record<number, number>,
  done: Record<number, boolean> = {}
): boolean {
  if (levelIdx <= 2) return true;
  if ((stars[levelIdx - 1] ?? 0) >= 1 || done[levelIdx - 1]) return true;
  const world = worldOf(levelIdx).id;
  if (world > 0 && levelIdx === world * LEVELS_PER_WORLD + 1) {
    let finished = 0;
    for (let i = (world - 1) * LEVELS_PER_WORLD + 1; i <= (world - 1) * LEVELS_PER_WORLD + LEVELS_PER_WORLD; i++) {
      if ((stars[i] ?? 0) >= 1 || done[i]) finished++;
    }
    if (finished >= WORLD_GATE_DONE) return true;
  }
  return false;
}

/** How many distinct levels a kid has finished (stars or done). */
export function finishedCount(
  stars: Record<number, number>,
  done: Record<number, boolean>
): number {
  let n = 0;
  for (let i = 1; i <= TOTAL_LEVELS; i++) if ((stars[i] ?? 0) >= 1 || done[i]) n++;
  return n;
}

/** A world chest waits after every 10th level. */
export function chestAfterLevel(levelIdx: number): boolean {
  return levelIdx % LEVELS_PER_WORLD === 0;
}

export const CHEST_REWARDS = { refills: 3, xp: 40 } as const;
/** Leo's courage boost — one free full-heart refill per local day. */
export const BOOST_XP = 10;

/* ════════════════════════════════════════════════════════════════
   DAILY QUESTS — the "why do I open it today" engine (§13.1)
   Three quests per local day, picked deterministically from the
   day key so every device sees the same board on the same day.
   ════════════════════════════════════════════════════════════════ */

export type QuestEvent =
  | "xp" // cumulative XP earned today
  | "correct" // correct answers today
  | "levels" // levels finished (≥1 star) today
  | "maxcombo" // best combo reached today (progress = max, not sum)
  | "stars3" // levels finished with 3 stars today
  | "rushhits" // correct answers inside one single LEO RUSH
  // LEO POP (the arcade) — merge quests share the same board (§14.5)
  | "merges" // creatures merged in Leo Pop today
  | "mergeNew" // NEW creatures discovered in Leo Pop today
  | "mergeLeo" // LEOs created in Leo Pop today
  // LEO EGGS (the surprise-egg arcade, §15) — same ONE board
  | "eggs" // eggs cracked today (any egg, any result)
  | "eggNew" // NEW friends hatched today
  | "eggRare" // rare-or-better hatches today
  // LEO FEED (the infinite surprise feed, §16) — same ONE board
  | "pulls" // feed cards opened today
  | "feedNew" // NEW friends met in the feed today
  | "feedRare"; // shiny (rare-or-better) feed cards today

export interface QuestDef {
  id: string;
  label: string;
  event: QuestEvent;
  target: number;
  rewardXp: number;
  icon: "zap" | "brain" | "map" | "star" | "rocket" | "flame" | "egg";
}

export const QUEST_POOL: QuestDef[] = [
  { id: "xp60", label: "Earn 60 XP", event: "xp", target: 60, rewardXp: 20, icon: "zap" },
  { id: "xp120", label: "Earn 120 XP", event: "xp", target: 120, rewardXp: 35, icon: "zap" },
  { id: "correct10", label: "Answer 10 puzzles right", event: "correct", target: 10, rewardXp: 20, icon: "brain" },
  { id: "correct18", label: "Answer 18 puzzles right", event: "correct", target: 18, rewardXp: 35, icon: "brain" },
  { id: "levels2", label: "Finish 2 levels", event: "levels", target: 2, rewardXp: 25, icon: "map" },
  { id: "combo5", label: "Reach a ×5 combo", event: "maxcombo", target: 5, rewardXp: 25, icon: "flame" },
  { id: "combo8", label: "Reach a ×8 combo", event: "maxcombo", target: 8, rewardXp: 35, icon: "flame" },
  { id: "stars3", label: "Get 3 stars on a level", event: "stars3", target: 1, rewardXp: 30, icon: "star" },
  { id: "rush8", label: "8 Rush hits in one LEO RUSH", event: "rushhits", target: 8, rewardXp: 30, icon: "rocket" },
  { id: "merge25", label: "Merge 25 friends in Leo Pop", event: "merges", target: 25, rewardXp: 25, icon: "star" },
  { id: "mergeDisco", label: "Discover a NEW creature in Leo Pop", event: "mergeNew", target: 1, rewardXp: 20, icon: "map" },
  { id: "mergeLeoToday", label: "Create a LEO in Leo Pop", event: "mergeLeo", target: 1, rewardXp: 30, icon: "rocket" },
  // LEO EGGS — the egg game shares the ONE daily board (§15)
  { id: "eggs5", label: "Crack 5 surprise eggs", event: "eggs", target: 5, rewardXp: 20, icon: "egg" },
  { id: "eggNewToday", label: "Hatch a brand-new friend", event: "eggNew", target: 1, rewardXp: 20, icon: "egg" },
  { id: "eggRare2", label: "Hatch 2 rare-or-better friends", event: "eggRare", target: 2, rewardXp: 30, icon: "egg" },
  // LEO FEED — the feed shares the ONE daily board (§16)
  { id: "pull8", label: "Open 8 feed cards", event: "pulls", target: 8, rewardXp: 20, icon: "zap" },
  { id: "feedNewToday", label: "Meet a NEW feed friend", event: "feedNew", target: 1, rewardXp: 20, icon: "map" },
  { id: "feedRare2", label: "Open 2 shiny feed cards", event: "feedRare", target: 2, rewardXp: 30, icon: "star" },
];

/**
 * Deterministic 3-quest board for a given day (same board all day).
 * CONTRACT (the store depends on this): EXACTLY 3 quests, all with
 * DISTINCT event types — the save-state engine indexes progress by board
 * position and must never see two quests racing on the same event.
 */
export function questsForDay(day: string, dailyGoalXp = DAILY_GOAL_XP): QuestDef[] {
  let h = 2166136261;
  for (let i = 0; i < day.length; i++) {
    h ^= day.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rng = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822519);
    h = Math.imul(h ^ (h >>> 13), 3266489917);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
  // Slot 1 always anchors the daily goal (xp 60 or 120) — the ring and the
  // quest board then tell one story, not two.
  const anchor = dailyGoalXp >= 120 ? "xp120" : "xp60";
  const anchorDef = QUEST_POOL.find((q) => q.id === anchor)!;
  const picked: QuestDef[] = [anchorDef];
  const usedEvents = new Set<string>([anchorDef.event]);
  let guard = 0;
  while (picked.length < 3 && guard++ < 200) {
    const q = QUEST_POOL[Math.floor(rng() * QUEST_POOL.length)];
    if (usedEvents.has(q.event)) continue; // one quest per event type
    picked.push(q);
    usedEvents.add(q.event);
  }
  return picked;
}

export const QUEST_ALL_DONE_BONUS = { xp: 20, refill: 1 } as const;

/* ════════════════════════════════════════════════════════════════
   ACHIEVEMENTS — the trophy wall (§13.2)
   One-time unlocks; each pays a small XP bounty the moment it pops.
   `test` is a pure predicate over the save snapshot.
   ════════════════════════════════════════════════════════════════ */

export interface AchDef {
  id: string;
  name: string;
  desc: string;
  icon: "star" | "flame" | "zap" | "rocket" | "crown" | "map" | "brain" | "trophy" | "gem" | "medal";
  xp: number;
}

export const ACH_DEFINITIONS: Record<string, AchDef> = {
  firstStar: { id: "firstStar", name: "First Spark", desc: "Earn your very first star", icon: "star", xp: 40 },
  flawless: { id: "flawless", name: "Flawless Roar", desc: "Finish a level with 3 stars", icon: "star", xp: 60 },
  combo10: { id: "combo10", name: "Combo King", desc: "Reach a ×10 combo", icon: "zap", xp: 60 },
  rushAce: { id: "rushAce", name: "Rush Ace", desc: "12 hits in one LEO RUSH", icon: "rocket", xp: 60 },
  streak3: { id: "streak3", name: "Heating Up", desc: "3-day streak", icon: "flame", xp: 40 },
  streak7: { id: "streak7", name: "Week of Fire", desc: "7-day streak", icon: "flame", xp: 80 },
  streak14: { id: "streak14", name: "Fortnight Legend", desc: "14-day streak", icon: "crown", xp: 120 },
  trail10: { id: "trail10", name: "Trail Blazer", desc: "Stars on 10 levels", icon: "map", xp: 60 },
  collector25: { id: "collector25", name: "Star Collector", desc: "Stars on 25 levels", icon: "medal", xp: 100 },
  champion40: { id: "champion40", name: "Brain Champion", desc: `Stars on all ${TOTAL_LEVELS} levels`, icon: "trophy", xp: 200 },
  century: { id: "century", name: "Century Brain", desc: "100 correct answers", icon: "brain", xp: 60 },
  megamind: { id: "megamind", name: "Mega Mind", desc: "500 correct answers", icon: "brain", xp: 120 },
  hunter: { id: "hunter", name: "Treasure Hunter", desc: "Open 2 world chests", icon: "gem", xp: 50 },
  rising5: { id: "rising5", name: "Rising Star", desc: "Reach player level 5", icon: "medal", xp: 50 },
  legendLeague: { id: "legendLeague", name: "Gold Roar", desc: "Reach the Gold league", icon: "trophy", xp: 80 },
  // Leo Pop (the arcade)
  mergeLeo: { id: "mergeLeo", name: "Leo Maker", desc: "Create your first LEO in Leo Pop", icon: "crown", xp: 80 },
  mergeChain5: { id: "mergeChain5", name: "Chain Wizard", desc: "Hit a ×5 chain in Leo Pop", icon: "zap", xp: 60 },
  zooAll: { id: "zooAll", name: "Zoo Keeper", desc: "Discover all 10 Leo Pop creatures", icon: "gem", xp: 150 },
  mergeScore: { id: "mergeScore", name: "Pop Star", desc: "Score 1500 in one Leo Pop run", icon: "trophy", xp: 80 },
  // Leo Eggs (the surprise-egg arcade)
  eggFirst: { id: "eggFirst", name: "First Crack", desc: "Crack your first surprise egg", icon: "star", xp: 40 },
  eggExplorer: { id: "eggExplorer", name: "Egg Explorer", desc: "Discover 6 nest friends", icon: "map", xp: 60 },
  eggLegend: { id: "eggLegend", name: "Golden Luck", desc: "Hatch a LEGENDARY friend", icon: "gem", xp: 120 },
  eggMaster: { id: "eggMaster", name: "Nest Master", desc: "Discover all 13 nest friends", icon: "trophy", xp: 200 },
  eggEvolve: { id: "eggEvolve", name: "Grow Up", desc: "Grow a friend to Stage 2", icon: "crown", xp: 60 },
  // Leo Feed (the infinite surprise feed)
  feedFirst: { id: "feedFirst", name: "First Swipe", desc: "Open your first feed card", icon: "star", xp: 40 },
  feedHeat: { id: "feedHeat", name: "Feed on Fire", desc: "Charge a MEGA card with heat", icon: "zap", xp: 60 },
  feedLegend: { id: "feedLegend", name: "Golden Feed", desc: "Open a LEGENDARY feed card", icon: "gem", xp: 120 },
  feedMythic: { id: "feedMythic", name: "Feed Dreamer", desc: "Open a MYTHIC feed card", icon: "crown", xp: 200 },
  feedExplorer: { id: "feedExplorer", name: "Feed Explorer", desc: "Meet 6 feed friends", icon: "map", xp: 60 },
  feedMaster: { id: "feedMaster", name: "Feed Master", desc: "Meet all 16 feed friends", icon: "trophy", xp: 200 },
};

/* ── Leo's encouragement — picked by mood across the app ──────── */
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
  streak3: ["Three days strong! Keep the flame alive!"],
  streak7: ["A WHOLE WEEK of thinking! You're legendary!"],
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
