/**
 * Think Leo — LEO FEED (the infinite surprise feed)
 * ─────────────────────────────────────────────────
 * The pure-fun, zero-learning game #3 — and the most honest piece of
 * attention engineering in the app. There are no questions, no levels,
 * no fail state and nothing to read: just an endless stream of mystery
 * cards, one swipe away, each hiding a friend for the Wall of Fame.
 * The full design brain lives in docs/ALGORITHM.md §16.
 *
 * Why a feed (researched, §16.1):
 *   · Instagram's loop is not content — it is the GAP. The next card is
 *     always one flick away and always "maybe amazing". No board, no
 *     level, no end: a feed has no finish line, so play never hits a
 *     natural stop.
 *   · Variable-ratio reinforcement — rarity follows the same slot table
 *     used by Leo Eggs. Every card pays something (a friend or Spark),
 *     nobody ever "loses", the brain just keeps re-arming.
 *   · The reveal is a ritual — dopamine spikes BEFORE the unwrap, so the
 *     card shakes harder and glows before it opens (anticipation is the
 *     product, the reveal is the receipt).
 *   · Near-miss tease — a card that rolled *just* under a rarity flashes
 *     gold first. "So close — the next one is MINE" is the strongest
 *     re-grip in game design (skinner labs → modern gacha).
 *   · HEAT — every reveal raises a visible For-You meter. Full meter =
 *     MEGA CARD (guaranteed epic or better). Momentum you can SEE.
 *   · Pity — epic+ within 9 cards, dots always visible. Dry spells end,
 *     hope never does.
 *   · The feed LEARNS — every pull feeds an affinity table, so cards
 *     lean toward the friends the kid loves most. "It knows me" is the
 *     quiet magic that makes a feed feel alive.
 *   · Daily MEGA gift — one guaranteed epic+ card every day, free. The
 *     reason to open the app tomorrow.
 */

import { clamp, dayKey, daysBetween } from "./game";
import type { StickerId } from "@/components/leo/stickers";
import type { Rarity } from "./eggs";

/* ── rarities (same ladder as Leo Eggs) ────────────────────────── */

export const FEED_W: Record<Rarity, number> = {
  common: 55,
  rare: 25,
  epic: 13,
  legend: 5.5,
  mythic: 1.5,
};

/** Rare-or-better is "shiny" — it powers heat, quests and teases. */
export function isShiny(r: Rarity): boolean {
  return r !== "common";
}

/** A card that rolled *just* under its next rarity flashes gold. */
export const NEAR_MISS_MARGIN = 3; // percent points under the next gate

/* ── HEAT — the For-You momentum meter ─────────────────────────── */

export const HEAT_MAX = 5; // shiny reveals to charge a MEGA CARD
export const HEAT_XP = 15; // the MEGA card itself pays this too
export const PITY_MAX = 9; // epic+ guaranteed within 9 cards

/* ── the cast — 16 friends, all from the sticker library ──────── */

export interface FeedFriend {
  uid: string;
  id: StickerId;
  name: string;
  species: string;
  rarity: Rarity;
  line: string; // the caption on the revealed card
}

export const FEED_FRIENDS: FeedFriend[] = [
  // commons — everyone meets them fast (the on-ramp)
  { uid: "f-monkey",    id: "monkey",    name: "Momo",    species: "Monkey",    rarity: "common", line: "Swung by to say hi!" },
  { uid: "f-rabbit",    id: "rabbit",    name: "Hop",     species: "Rabbit",    rarity: "common", line: "Hopped straight into your feed" },
  { uid: "f-chicken",   id: "chicken",   name: "Nugget",  species: "Chicken",   rarity: "common", line: "Came for the corn, stayed for you" },
  { uid: "f-sheep",     id: "sheep",     name: "Fluff",   species: "Sheep",     rarity: "common", line: "Cloud or sheep? Yes." },
  { uid: "f-butterfly", id: "butterfly", name: "Flutter", species: "Butterfly", rarity: "common", line: "Followed the sparkles here" },
  // rares — the chase begins
  { uid: "f-fox",       id: "fox",       name: "Sly",     species: "Fox",       rarity: "rare",   line: "Sneaked in through your camera roll" },
  { uid: "f-owl",       id: "owl",       name: "Hoot",    species: "Owl",       rarity: "rare",   line: "Only posts at night" },
  { uid: "f-frog",      id: "frog",      name: "Pip",     species: "Frog",      rarity: "rare",   line: "Jumped the queue just for you" },
  { uid: "f-cat",       id: "cat",       name: "Whiskers",species: "Cat",       rarity: "rare",   line: "Owns this feed now" },
  { uid: "f-mouse",     id: "mouse",     name: "Nibbles", species: "Mouse",     rarity: "rare",   line: "Tiny friend, big energy" },
  // epics — the "whoa" tier
  { uid: "f-parrot",    id: "parrot",    name: "Echo",    species: "Parrot",    rarity: "epic",   line: "Says everything twice. Everything twice!" },
  { uid: "f-dog",       id: "dog",       name: "Buddy",   species: "Dog",       rarity: "epic",   line: "Liked every single thing you do" },
  { uid: "f-elephant",  id: "elephant",  name: "Trunky",  species: "Elephant",  rarity: "epic",   line: "Never forgets a friend" },
  // legends — the shelf trophies
  { uid: "f-dolphin",   id: "dolphin",   name: "Splash",  species: "Dolphin",   rarity: "legend", line: "Leapt out of the feed to find you" },
  { uid: "f-ufo",       id: "ufo",       name: "Zippy",   species: "UFO",       rarity: "legend", line: "Travelled 4 light-years for this post" },
  // mythic — the once-in-a-hundred dream
  { uid: "f-rocket",    id: "rocket",    name: "Blaze",   species: "Rocket",    rarity: "mythic", line: "THE RAREST POST IN THE FEED" },
];

export const FEED_TARGET = FEED_FRIENDS.length; // 16 — the full Wall of Fame

export const FRIEND_BY_UID: Record<string, FeedFriend> = Object.fromEntries(
  FEED_FRIENDS.map((f) => [f.uid, f])
);

export function friendsOf(rarity: Rarity): FeedFriend[] {
  return FEED_FRIENDS.filter((f) => f.rarity === rarity);
}

/* ── affinity — the feed learns what the kid loves ─────────────── */

/** Starting weight per species; every pull multiplies its friend's pull. */
const AFFINITY_BASE = 1;
export const AFFINITY_STEP = 1.35; // each sighting makes a friend ~35% likelier
export const AFFINITY_CAP = 6; // love, but never a monopoly

export type Affinity = Record<string, number>;

export function affinityWeight(a: Affinity | undefined, f: FeedFriend): number {
  const v = a?.[f.uid] ?? AFFINITY_BASE;
  return clamp(v, AFFINITY_BASE, AFFINITY_CAP);
}

/* ── the pull — ONE pure function, all the psychology ──────────── */

export interface FeedPlan {
  friend: FeedFriend;
  rarity: Rarity;
  isNew: boolean;
  nearMiss: boolean; // rolled just under the next tier
  pityReset: boolean; // this card cleared the pity counter
  heatCharged: boolean; // this card was the MEGA CARD (guaranteed shiny)
  megaReady: boolean; // heat full → NEXT card is a MEGA CARD
}

/**
 * Roll one card.
 *   pity   — cards pulled since the last epic+ (0..8; 9 forces epic+)
 *   forced — true when heat was full: this card is a MEGA CARD
 * Luck: a longer daily streak bends the table toward shiny (same trick
 * as Leo Eggs — the lion app and the feed pull in the same direction).
 */
export function rollFeedCard(opts: {
  pity: number;
  forced?: boolean;
  streak?: number;
  affinity?: Affinity;
  album?: Record<string, number>;
  rng?: () => number;
}): FeedPlan {
  const rng = opts.rng ?? Math.random;
  const streakBonus = Math.min(10, (opts.streak ?? 0) * 0.5); // +0.5% per day, cap 10
  const forced = !!opts.forced || opts.pity >= PITY_MAX;

  /* pick rarity — slot table + streak luck, pity floors at epic */
  let rarity: Rarity;
  const roll = rng() * 100;
  const shinyGate = roll - streakBonus; // luck pushes the roll DOWN the table
  if (forced) {
    rarity = rng() < 0.12 ? "mythic" : rng() < 0.4 ? "legend" : "epic";
  } else if (shinyGate < FEED_W.mythic) {
    rarity = "mythic";
  } else if (shinyGate < FEED_W.mythic + FEED_W.legend) {
    rarity = "legend";
  } else if (shinyGate < FEED_W.mythic + FEED_W.legend + FEED_W.epic) {
    rarity = "epic";
  } else if (shinyGate < FEED_W.mythic + FEED_W.legend + FEED_W.epic + FEED_W.rare) {
    rarity = "rare";
  } else {
    rarity = "common";
  }

  /* near-miss: how far UNDER the next gate did the roll land? */
  const gates = [FEED_W.mythic, FEED_W.mythic + FEED_W.legend, FEED_W.mythic + FEED_W.legend + FEED_W.epic];
  const nextGate = gates.find((g) => shinyGate < g - streakBonus);
  const nearMiss =
    !forced &&
    rarity === "common" &&
    typeof nextGate === "number" &&
    nextGate - Math.max(0, shinyGate) < NEAR_MISS_MARGIN &&
    rng() < 0.65; // tease honestly but not always — pattern-hunger needs variety

  /* pick the friend: rarity bucket, weighted by affinity (the feed learns) */
  const bucket = friendsOf(rarity);
  const weights = bucket.map((f) => affinityWeight(opts.affinity, f));
  const total = weights.reduce((a, b) => a + b, 0);
  let pick = rng() * total;
  let friend = bucket[0];
  for (let i = 0; i < bucket.length; i++) {
    pick -= weights[i];
    if (pick <= 0) {
      friend = bucket[i];
      break;
    }
  }

  const isNew = (opts.album?.[friend.uid] ?? 0) === 0;
  return {
    friend,
    rarity,
    isNew,
    nearMiss,
    pityReset: rarity === "epic" || rarity === "legend" || rarity === "mythic",
    heatCharged: forced,
    megaReady: false,
  };
}

/* ── the daily MEGA gift ───────────────────────────────────────── */

export const MEGA_GIFT_XP = 10; // claiming the free daily card also pays XP

/* ── Spark payout for duplicates (same purse as Leo Eggs) ──────── */

export const FEED_DUPE_SPARK: Record<Rarity, number> = {
  common: 2,
  rare: 5,
  epic: 12,
  legend: 30,
  mythic: 60,
};

/** New-discovery bonus Spark (same as eggs' discovery stars). */
export const FEED_DISCOVERY_SPARK = 5;

/* ── comeback warmth — the feed remembers when you were away ───── */

/** Cards get +luck the longer the kid was away (max +8). */
export function comebackLuck(lastPullDay: string): number {
  if (!lastPullDay) return 0;
  const gap = daysBetween(lastPullDay, dayKey());
  return clamp(gap - 1, 0, 8);
}
