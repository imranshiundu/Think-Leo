/**
 * Think Leo — LEO POP (the arcade)
 * ────────────────────────────────
 * The pure-fun, zero-math game: drop cute creatures into the jar, two of
 * a kind fuse into the next one, and the chain ends with LEO himself.
 * Design brain lives here so every number is tunable (and documented) in
 * one place — docs/ALGORITHM.md §14.
 *
 * The psychology (researched, §14.1):
 *   · Merge physics  — "completion drive": kids NEED to see the next
 *     creature (Suika Game's core loop).
 *   · Golden eggs    — a variable-ratio reward table (the slot-machine
 *     schedule that keeps every drop interesting).
 *   · Chain windows  — cascades multiply score while the screen is still
 *     moving; the sound pitch climbs with every step (dopamine ladder).
 *   · Zoo Book       — collection completion: undiscovered silhouettes
 *     nag at kids until the set is complete.
 *   · Daily egg      — the first egg of each local day is guaranteed:
 *     the reason to open the app today.
 */

import { clamp } from "./game";
import type { StickerId } from "@/components/leo/stickers";

/* ── the evolution chain ─────────────────────────────────────────
   11 creatures, small → huge. Two of tier N fuse into tier N+1.
   Two LEOs fuse into GOLDEN LEO — both vanish in a jackpot blast. */

export interface PopCreature {
  tier: number;
  id: StickerId; // art from the sticker library (tier 9+ renders "lion")
  name: string;
  r: number; // physics radius at jar width 380
  bg: string; // ball fill
  edge: string; // ball rim tint
}

export const POP_CHAIN: PopCreature[] = [
  { tier: 0,  id: "ladybug",  name: "Ladybug",     r: 17, bg: "#FFDCE4", edge: "#F8BBC9" },
  { tier: 1,  id: "bee",      name: "Bee",         r: 22, bg: "#FFF1BF", edge: "#F2D888" },
  { tier: 2,  id: "mouse",    name: "Mouse",       r: 28, bg: "#EDE4F9", edge: "#D4C2EF" },
  { tier: 3,  id: "frog",     name: "Frog",        r: 35, bg: "#D9F5C8", edge: "#B4E694" },
  { tier: 4,  id: "rabbit",   name: "Rabbit",      r: 43, bg: "#FFE9F3", edge: "#F7C2DB" },
  { tier: 5,  id: "cat",      name: "Cat",         r: 52, bg: "#E3F6FF", edge: "#BCE3F5" },
  { tier: 6,  id: "fox",      name: "Fox",         r: 62, bg: "#FFE3C9", edge: "#F5C49A" },
  { tier: 7,  id: "monkey",   name: "Monkey",      r: 72, bg: "#F1E4D2", edge: "#DCC3A2" },
  { tier: 8,  id: "elephant", name: "Elephant",    r: 83, bg: "#E4E9FF", edge: "#C2CBF2" },
  { tier: 9,  id: "lion",     name: "LEO",         r: 94, bg: "#FFE49A", edge: "#F5C860" },
  { tier: 10, id: "lion",     name: "Golden Leo",  r: 94, bg: "#FFD75E", edge: "#E8A80C" },
];

export const LEO_TIER = 9;
export const GOLDEN_TIER = 10;
export const ZOO_TARGET = 10; // tiers 0..9 — golden Leo is the secret bonus

export const LEO_NAMES: Record<number, string> = Object.fromEntries(
  POP_CHAIN.map((c) => [c.tier, c.name])
);

/** Points for one merge, indexed by the tier CREATED (1..10). */
export const MERGE_SCORE = [0, 1, 3, 6, 10, 15, 21, 28, 36, 45, 100];
export const GOLDEN_BLAST_SCORE = 100;

/** Chain multiplier: 2nd cascade ×1.5, 3rd ×2 … capped at ×4. */
export function chainMult(chain: number): number {
  return Math.min(4, 1 + 0.5 * Math.max(0, chain - 1));
}
export const CHAIN_WINDOW_MS = 1150;

export function mergePoints(createdTier: number, chain: number): number {
  return Math.round((MERGE_SCORE[createdTier] ?? 0) * chainMult(chain));
}

/* ── the dropper ─────────────────────────────────────────────────
   Only small creatures fall from the sky (Suika rule): tiers 0-4,
   smaller = more common. Weighted without a seed — the feel stays
   alive because no two runs deal the same hand. */

const DROP_WEIGHTS: [number, number][] = [
  [0, 30],
  [1, 26],
  [2, 20],
  [3, 14],
  [4, 10],
];
const DROP_TOTAL = DROP_WEIGHTS.reduce((a, [, w]) => a + w, 0);

export function rollDrop(): number {
  let r = Math.random() * DROP_TOTAL;
  for (const [tier, w] of DROP_WEIGHTS) {
    r -= w;
    if (r < 0) return tier;
  }
  return 0;
}

/* ── golden eggs: the variable-ratio heart of the game ───────────
   Weighted outcome table (§14.3). Never a "miss": every egg gives
   something — the schedule is about SIZE of the surprise, not
   presence. 12% per drop, with a pity ceiling of 9 drops. */

export type EggOutcome = "gift" | "party" | "twins" | "popcorn";

const EGG_TABLE: [EggOutcome, number][] = [
  ["gift", 34], // hatches a random mid creature (tiers 4-7)
  ["party", 24], // confetti + 60 points
  ["twins", 22], // two mice pop out — chain fuel
  ["popcorn", 20], // one whole tier pops — the relief bomb
];
const EGG_TOTAL = EGG_TABLE.reduce((a, [, w]) => a + w, 0);

export function rollEgg(): EggOutcome {
  let r = Math.random() * EGG_TOTAL;
  for (const [k, w] of EGG_TABLE) {
    r -= w;
    if (r < 0) return k;
  }
  return "gift";
}

export const EGG_CHANCE = 0.12; // per drop, after the 4th
export const EGG_PITY = 9; // guaranteed within 9 eggless drops
export const EGG_R = 26; // egg physics radius
export const PARTY_SCORE = 60;

/* ── jar geometry (physics units = CSS px inside the jar) ─────── */

export const JAR_FALLBACK = { w: 380, h: 540 };
export const DROP_Y = 46; // where held creatures hover
export const LINE_Y = 96; // the overflow line
export const OVERFLOW_MS = 2200; // a creature riding the line this long ends the run
export const DROP_COOLDOWN_MS = 480;

/** Scale creature radii to the real jar width (design width = 380). */
export function radiusFor(tier: number, jarW: number): number {
  const base = POP_CHAIN[tier]?.r ?? 20;
  return Math.round(base * clamp(jarW / JAR_FALLBACK.w, 0.7, 1.25));
}

/* ── XP — fed into the ONE economy (leagues, daily goal, streaks) ── */

export function xpForMergeRun(score: number, newDiscoveries: number): number {
  return 6 + Math.min(24, Math.floor(score / 70)) + 4 * newDiscoveries;
}
export const DAILY_EGG_XP = 5;

/* ── encouragement copy (Leo's voice, no emoji anywhere) ───────── */

export const POP_PRAISE = ["Roarrsome!", "Pop pop pop!", "So squishy!", "Zoo-tastic!"];
export const POP_CHAIN_WORDS = ["CHAIN!", "MEGA CHAIN!", "ULTRA CHAIN!", "LEO CHAIN!"];
export const POP_OVER_LINES = [
  "The jar is full — what a zoo!",
  "So many friends! One more run?",
  "Leo is proud of that zoo!",
];
export const POP_NEAR_MISS = (best: number) =>
  `So close to your best: ${best}!`;

/* ── phone feel ────────────────────────────────────────────────── */

/** Light haptic taps — a merge you can FEEL. Never fires on laptops. */
export function buzz(ms: number | number[]) {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate(ms);
  } catch {
    /* some browsers throw on unusual patterns — silence is fine */
  }
}
