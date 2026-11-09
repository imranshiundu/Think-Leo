/**
 * Think Leo — LEO EGGS (the surprise-egg arcade)
 * ──────────────────────────────────────────────
 * The pure-fun, zero-learning game #2: pick an egg, HOLD to crack it,
 * and watch the suspense do its work. What hatches is a friend for the
 * collection — sometimes ordinary, sometimes the one the kid has been
 * chasing for days. Design brain lives here so every number is tunable
 * (and documented) in one place — docs/ALGORITHM.md §15.
 *
 * The psychology (researched, §15.1):
 *   · Blind-box reveal — "maybe this is the rare one" is the engine.
 *     Dopamine peaks BEFORE the shell opens, so the crack is a slow,
 *     touchable ritual: press, shake, light leaks, THEN the burst.
 *   · Variable-ratio table — rarities follow the slot-machine schedule
 *     that keeps every crack interesting (never a "miss": every egg
 *     gives a friend or stars for duplicates).
 *   · Near-miss tease — the egg sometimes glows GOLD while shaking.
 *     The glow is honest-but-noisy: it correlates with rarity, it does
 *     not promise it. That "it teased me… next one is MINE" pull is
 *     the single strongest known re-grip in game design.
 *   · Pity meter — rare-or-better is guaranteed every 8 Spark eggs and
 *     the countdown is VISIBLE. Losing streaks end; hope never does.
 *   · Streak luck — a longer daily streak makes every egg luckier.
 *     The lion app and the egg game now pull in the same direction.
 *   · The Nest — a free egg incubates in real time (15 min). When the
 *     kid leaves, something is still growing. That is the reason to
 *     come back, and the Home card glows when it is ready.
 *   · Album + Room — silhouettes of unfound friends nag until the set
 *     is complete (collection completion); owned friends live in Leo's
 *     Room where they can be petted and GROWN (investment phase).
 */

import { clamp } from "./game";
import type { StickerId } from "@/components/leo/stickers";

/* ── rarities ──────────────────────────────────────────────────── */

export type Rarity = "common" | "rare" | "epic" | "legend" | "mythic";

export const RARITY_ORDER: Rarity[] = ["common", "rare", "epic", "legend", "mythic"];

export interface RarityMeta {
  label: string; // kid-facing shout, e.g. "EPIC!"
  color: string; // burst + banner
  soft: string; // card wash
  stars: number; // duplicate payout
  xp: number; // every hatch feeds the ONE economy
  wobble: number; // reveal screen shake (px)
}

export const RARITY_META: Record<Rarity, RarityMeta> = {
  common: { label: "COMMON", color: "#8f9bb3", soft: "#eef2f8", stars: 2, xp: 2, wobble: 2 },
  rare:   { label: "RARE!",  color: "#2ec4b6", soft: "#dcf9f4", stars: 5, xp: 3, wobble: 4 },
  epic:   { label: "EPIC!!", color: "#9b5de5", soft: "#f3e9ff", stars: 12, xp: 5, wobble: 7 },
  legend: { label: "LEGENDARY!!!", color: "#ffc93c", soft: "#fff3c4", stars: 30, xp: 10, wobble: 11 },
  mythic: { label: "MYTHIC!!!", color: "#ff5a8c", soft: "#ffe9f1", stars: 60, xp: 20, wobble: 15 },
};

/** Is this rarity "rare or better" (pity + quests + tease math)? */
export function isRarePlus(r: Rarity): boolean {
  return r !== "common";
}

/* ── the critters ────────────────────────────────────────────────
   13 friends, all drawn from the sticker library (zero new art).
   Roary the lion cub is the legend; Twinkle the comet is the mythic
   "falls once in a hundred eggs" dream. */

export interface EggCritter {
  uid: string; // save key (bag / album)
  id: StickerId; // sticker art
  name: string;
  species: string; // what the kid calls it: "the Fox", "the Star"
  rarity: Rarity;
  home: string; // flavour line for the album card
}

export const CRITTERS: EggCritter[] = [
  { uid: "bee",      id: "bee",      name: "Buzz",     species: "Bee",      rarity: "common", home: "Naps inside flowers" },
  { uid: "ladybug",  id: "ladybug",  name: "Dot",      species: "Ladybug",  rarity: "common", home: "Counts her own spots" },
  { uid: "mouse",    id: "mouse",    name: "Pip",      species: "Mouse",    rarity: "common", home: "Collects button treasures" },
  { uid: "chicken",  id: "chicken",  name: "Nugget",   species: "Chicken",  rarity: "common", home: "Thinks she is a dinosaur" },
  { uid: "frog",     id: "frog",     name: "Hop",      species: "Frog",     rarity: "common", home: "Champion of puddle jumps" },
  { uid: "cat",      id: "cat",      name: "Whiskers", species: "Cat",      rarity: "rare",   home: "Boss of the sunbeam" },
  { uid: "rabbit",   id: "rabbit",   name: "Clover",   species: "Rabbit",   rarity: "rare",   home: "Hops in lucky sevens" },
  { uid: "parrot",   id: "parrot",   name: "Riki",     species: "Parrot",   rarity: "rare",   home: "Repeats your best roars" },
  { uid: "fox",      id: "fox",      name: "Ember",    species: "Fox",      rarity: "rare",   home: "Tail glows at bedtime" },
  { uid: "elephant", id: "elephant", name: "Titan",    species: "Elephant", rarity: "epic",   home: "Sneezes like thunder" },
  { uid: "dolphin",  id: "dolphin",  name: "Wave",     species: "Dolphin",  rarity: "epic",   home: "Surfs the bathtub" },
  { uid: "lion",     id: "lion",     name: "Roary",    species: "Lion Cub", rarity: "legend", home: "Leo's own cub — ROAR!" },
  { uid: "comet",    id: "comet",    name: "Twinkle",  species: "Star",     rarity: "mythic", home: "Fell out of the night sky" },
];

export const CRITTERS_BY_UID: Record<string, EggCritter> = Object.fromEntries(
  CRITTERS.map((c) => [c.uid, c])
);

export const COLLECTION_TARGET = CRITTERS.length; // 13

/** First-discovery bonus — a NEW friend always pays a little extra. */
export const EGG_DISCOVERY_STARS = 5;

export function crittersOf(rarity: Rarity): EggCritter[] {
  return CRITTERS.filter((c) => c.rarity === rarity);
}

/* ── the eggs ────────────────────────────────────────────────────
   Three shells, three appetites. Spark is free and always flowing —
   the loop must never hard-block a kid. Rainbow and Royal cost stars
   (the duplicate sink) and bend the table upward. */

export type EggKind = "spark" | "rainbow" | "royal";

export interface EggMeta {
  kind: EggKind;
  name: string;
  cost: number; // in egg stars (0 = free)
  blurb: string;
  shell: [string, string]; // 3D gradient top/bottom
  spots: string; // speckle + rim colour
  odds: Record<Rarity, number>; // %, must sum to 100
}

export const EGG_KINDS: Record<EggKind, EggMeta> = {
  spark: {
    kind: "spark",
    name: "Spark Egg",
    cost: 0,
    blurb: "Always warm, always free",
    shell: ["#FFFBEA", "#FFD9A0"],
    spots: "#FFC96B",
    odds: { common: 68, rare: 22, epic: 7.5, legend: 2, mythic: 0.5 },
  },
  rainbow: {
    kind: "rainbow",
    name: "Rainbow Egg",
    cost: 25,
    blurb: "Commons are almost gone",
    shell: ["#EAF7FF", "#DCCBFF"],
    spots: "#9B5DE5",
    odds: { common: 20, rare: 48, epic: 22, legend: 8, mythic: 2 },
  },
  royal: {
    kind: "royal",
    name: "Royal Egg",
    cost: 60,
    blurb: "No commons. Ever.",
    shell: ["#FFF6D8", "#FFE49A"],
    spots: "#E8A80C",
    odds: { common: 0, rare: 40, epic: 40, legend: 16, mythic: 4 },
  },
};

export const EGG_KIND_LIST: EggKind[] = ["spark", "rainbow", "royal"];

/** Free Spark eggs take a SHORT rest (≈ one reveal read) so the crack
 *  → reveal → NEXT loop never stalls at its dopamine peak. */
export const SPARK_REST_MS = 4_000;
/** The nest incubates in real time — the comeback engine. */
export const NEST_HATCH_MS = 15 * 60 * 1000;
/** Spark pity: crack #8 after a dry spell is forced rare-or-better. */
export const PITY_AT = 7; // dry sparks counted; forced when >= 7
/** Streak luck: +2.5% rare-or-better per streak day, capped. */
export const LUCK_PER_DAY = 0.025;
export const LUCK_CAP = 0.125;

export function streakLuck(streak: number): number {
  return Math.min(LUCK_CAP, Math.max(0, streak) * LUCK_PER_DAY);
}

/* ── the roll ────────────────────────────────────────────────────
   Rarity is rolled FIRST (Math.random — like the arcade dropper, the
   feel stays alive because no two eggs deal the same hand). Streak
   luck steals share from `common`; spark pity hard-promotes after a
   dry spell. The gold tease is rolled AFTER, honestly-but-noisily. */

export interface EggPlan {
  kind: EggKind;
  critter: EggCritter;
  rarity: Rarity;
  isNew: boolean; // first time this friend has ever hatched
  dupeStars: number; // star payout when it is a duplicate
  teased: boolean; // the shell glowed gold during the shake
  pityReset: boolean; // did this crack end a dry spell?
  luckUsed: number; // streak luck applied (for docs/debug)
}

export function rollRarity(kind: EggKind, streak: number, pity: number): { rarity: Rarity; luckUsed: number } {
  const luck = streakLuck(streak);
  const odds = { ...EGG_KINDS[kind].odds };
  if (luck > 0 && odds.common > 0) {
    const take = odds.common * (luck / (1 - luck));
    odds.common = Math.max(0, odds.common - take);
    odds.rare += take * 0.62;
    odds.epic += take * 0.25;
    odds.legend += take * 0.1;
    odds.mythic += take * 0.03;
  }
  // pity only guards the free egg — paid eggs are already generous
  if (kind === "spark" && pity >= PITY_AT) {
    odds.common = 0;
    const pool = odds.rare + odds.epic + odds.legend + odds.mythic;
    odds.rare = (odds.rare / pool) * 100;
    odds.epic = (odds.epic / pool) * 100;
    odds.legend = (odds.legend / pool) * 100;
    odds.mythic = (odds.mythic / pool) * 100;
  }
  let r = Math.random() * 100;
  for (const rarity of RARITY_ORDER) {
    r -= odds[rarity];
    if (r < 0) return { rarity, luckUsed: kind === "spark" ? luck : 0 };
  }
  return { rarity: "common", luckUsed: kind === "spark" ? luck : 0 };
}

/** P(gold tease | outcome) — informative, never a promise (§15.1). */
const TEASE_CHANCE: Record<Rarity, number> = {
  common: 0.15,
  rare: 0.45,
  epic: 0.8,
  legend: 1,
  mythic: 1,
};

export function planEgg(
  kind: EggKind,
  streak: number,
  pity: number,
  ownedHas: (uid: string) => boolean
): EggPlan {
  const { rarity, luckUsed } = rollRarity(kind, streak, pity);
  const pool = crittersOf(rarity);
  const critter = pool[Math.floor(Math.random() * pool.length)];
  const isNew = !ownedHas(critter.uid);
  return {
    kind,
    critter,
    rarity,
    isNew,
    dupeStars: isNew ? 0 : RARITY_META[rarity].stars,
    teased: Math.random() < TEASE_CHANCE[rarity],
    pityReset: isRarePlus(rarity),
    luckUsed,
  };
}

/* ── the nest (real-time incubation) ───────────────────────────── */

export interface NestState {
  ready: boolean;
  pct: number; // 0..1 incubated
  minsLeft: number;
}

export function nestState(eggNestAt: number, now = Date.now()): NestState {
  if (!eggNestAt) return { ready: true, pct: 1, minsLeft: 0 }; // first visit: instant nest
  const elapsed = now - eggNestAt;
  if (elapsed >= NEST_HATCH_MS) return { ready: true, pct: 1, minsLeft: 0 };
  return {
    ready: false,
    pct: clamp(elapsed / NEST_HATCH_MS, 0, 1),
    minsLeft: Math.max(1, Math.ceil((NEST_HATCH_MS - elapsed) / 60000)),
  };
}

/* ── evolution (the investment phase) ────────────────────────────
   Hatch the same friend 3 times and it can GROW: the two extra
   copies are fed to the first one. Stage 2 friends wear a golden
   frame in the Room and the Album — pure pride, no stat changes. */

export const GROW_COPIES = 3; // total hatches needed
export const GROW_SPEND = 2; // copies consumed
export const GROW_XP = 10;

/* ── copy (Leo's voice, no emoji anywhere) ─────────────────────── */

export const EGG_PRAISE: Record<Rarity, string[]> = {
  common: ["A new little pal!", "Warm and wobbly!", "Every friend counts!"],
  rare: ["Shiny! The nest is lucky today!", "A rare one — roar together!", "Sparkly find!"],
  epic: ["EPIC! The whole nest is shaking!", "Mega hatch! Leo is cheering!", "An EPIC friend!"],
  legend: ["LEGENDARY!!! Roary is HERE!", "The legendary egg!! ROAAAR!", "Leo heard the legend egg!"],
  mythic: ["MYTHIC!!! A star just hatched!", "Twinkle fell from the sky for YOU!", "The sky-egg! UNBELIEVABLE!"],
};

export const EGG_TEASE_LINES = [
  "It glowed gold… so close!",
  "The shell sparkled — next one!",
  "Almost legendary… the nest remembers.",
];

export const EGG_NEW_LINES = [
  "NEW FRIEND discovered!",
  "First time hatching this pal!",
  "The album learned a new face!",
];

export const EGG_OVER_COPY = "The nest is always ready for one more crack…";
