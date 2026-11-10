/**
 * Think Leo — Save State v4 (zustand + localStorage)
 * ─────────────────────────────────────────────────
 * Offline-first: the whole save lives on the kid's device.
 * Schema + hearts-regen, streak, quest and achievement math are
 * documented in docs/ALGORITHM.md §6–7 and §13.
 *
 * ENGINE RULES (v3 — after the great wipe-bug of v2):
 *  · Every helper is PURE: it takes a state snapshot and returns a new one.
 *    No helper ever re-reads `get()` mid-transaction — that is exactly what
 *    used to wipe stars the millisecond they were recorded.
 *  · The quest board is ALWAYS the length of questsForDay(today) (3 rows,
 *    distinct events) — a mismatch only happens on a genuine day rollover.
 *  · Any XP grant or finished run counts as "played today": the streak,
 *    playDays strip and daily ring can never disagree with each other.
 *
 * V4 — "levels must always end":
 *  · `done[levelIdx]` records ANY finished run (0 stars or practice too),
 *    so finishing a level always opens the next one;
 *  · `boostDay` powers Leo's courage boost (one free full refill per day),
 *    so a kid with 0 hearts is never stuck waiting;
 *  · heart regen is 8 min (was 15) — kids wait badly.
 *
 * V5 — Leo Pop (the arcade) joins the ONE economy:
 *  · merge XP flows through addXp like every other grant — leagues,
 *    streaks, the daily ring and the quest board all stay in sync;
 *  · the Zoo Book (mergeDiscoveries) is a collection, not a currency;
 *  · the daily egg (mergeEggDay) is the comeback hook for the arcade.
 *
 * V6 — LEO EGGS (the surprise-egg arcade) joins the same ONE economy:
 *  · every hatch pays rarity XP through the same pipe (daily ring,
 *    league, streak, quests) and duplicate stars into its own purse;
 *  · the egg bag is a collection with memory (count + evolved stage);
 *  · the nest (eggNestAt) is the real-time comeback engine — it keeps
 *    incubating while the app is closed;
 *  · the pity counter (eggPity) guarantees rare-or-better every 8
 *    free Spark eggs — losing streaks always end.
 *
 * V7 — LEO FEED (the infinite surprise feed) joins the ONE economy:
 *  · every card pays rarity XP through the same pipe — a pull IS a
 *    played day, so the streak records itself while kids have fun;
 *  · the Wall of Fame (feedAlbum) is a collection with a visible face;
 *  · the feed LEARNS (feedAffinity) — cards lean toward loved friends;
 *  · heat (feedHeat) charges toward a guaranteed MEGA card, and the
 *    pity counter (feedPity) guarantees epic+ within 9 cards;
 *  · the daily MEGA gift (feedMegaDay) is the comeback trigger.
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { decodeSaveCode, encodeSaveCode } from "./savecode";
import { useEffect, useState } from "react";
import {
  ACH_DEFINITIONS,
  BOOST_XP,
  CHEST_REWARDS,
  QUEST_ALL_DONE_BONUS,
  dayKey,
  daysBetween,
  HEART_REGEN_MS,
  leagueOf,
  MAX_HEARTS,
  playerLevelFromXp,
  questsForDay,
  TOTAL_LEVELS,
  weekKey,
  yesterdayKey,
  type AchDef,
} from "./game";
import { LEO_TIER, ZOO_TARGET } from "./arcade";
import {
  COLLECTION_TARGET,
  CRITTERS,
  CRITTERS_BY_UID,
  EGG_DISCOVERY_STARS,
  GROW_COPIES,
  GROW_SPEND,
  GROW_XP,
  RARITY_META,
  isRarePlus,
  nestState,
  type EggPlan,
  type NestState,
} from "./eggs";
import {
  AFFINITY_CAP,
  AFFINITY_STEP,
  FEED_DUPE_SPARK,
  FEED_DISCOVERY_SPARK,
  FEED_FRIENDS,
  FEED_TARGET,
  HEAT_MAX,
  MEGA_GIFT_XP,
  PITY_MAX,
  type FeedPlan,
} from "./feed";

export interface LeoSave {
  xp: number;
  weekXp: number;
  leagueWeek: string;
  hearts: number;
  heartsAt: number; // ms epoch of the last heart-regen boundary
  refills: number; // refill tokens from world chests
  streak: number;
  bestStreak: number;
  lastPlayDay: string;
  freezes: number; // streak freezes earned at milestones
  todayXp: number;
  today: string;
  stars: Record<number, number>; // levelIdx -> best stars
  best: Record<number, number>; // levelIdx -> best score
  done: Record<number, boolean>; // levelIdx -> finished at least once (any result)
  chests: Record<number, boolean>; // worldId -> claimed
  soundSfx: boolean;
  soundMusic: boolean;
  boostDay: string; // day Leo's courage boost (free full refill) was used
  totalCorrect: number;
  runs: number;
  /* retention systems */
  playDays: string[]; // last ~30 local days that earned XP (streak strip)
  questDay: string;
  questProgress: number[];
  questClaimed: boolean[];
  questAllBonusDay: string; // day the finish-all-quests chest was claimed
  ach: string[]; // unlocked achievement ids
  seenPlayerLevel: number;
  comebackDay: string; // day the last welcome-back gift was claimed
  /* LEO POP — the arcade (v5) */
  mergeBest: number; // best Leo Pop score
  mergeDiscoveries: Record<number, number>; // tier -> times fused (the Zoo Book)
  mergeEggDay: string; // day the guaranteed daily egg was dropped
  mergePlays: number; // Leo Pop runs finished
  totalMerges: number; // lifetime fusions
  /* LEO EGGS — the surprise-egg arcade (v6) */
  eggStars: number; // the egg purse (duplicates pay in)
  eggBag: Record<string, { count: number; evolved: boolean }>; // uid -> collection entry
  eggHatched: number; // lifetime cracks
  eggPity: number; // dry Spark eggs since the last rare-or-better
  eggNestAt: number; // ms epoch the free nest egg started incubating (0 = ready)
  eggRoyalDay: string; // day the free daily Royal Egg was claimed
  /* LEO FEED — the infinite surprise feed (v7) */
  feedPulls: number; // lifetime cards opened
  feedAlbum: Record<string, number>; // uid -> times met (the Wall of Fame)
  feedAffinity: Record<string, number>; // uid -> love weight (the feed learns)
  feedPity: number; // cards since the last epic+ (pity at 9)
  feedHeat: number; // shiny reveals toward the MEGA card
  feedBestHeat: number; // best heat ever charged (achievement)
  feedMegaDay: string; // day the free daily MEGA card was claimed
  feedPullDay: string; // last day a card was opened (comeback luck)
  /* Parent HQ (v8) — grown-up-facing telemetry + the play window */
  skillStats: Record<string, { ok: number; n: number }>; // question kind -> correct/total
  playToday: { day: string; ms: number; bonus: number }; // today's playtime + grown-up extensions
  dailyCapMin: number; // the family play window (minutes; 0 = open ended)
  tourDone: boolean; // v9 — the first-run welcome tour has been finished (or skipped)
  _hydrated: boolean;
}

export interface LeoActions {
  tickHearts: () => void;
  loseHeart: () => void;
  useRefill: () => boolean;
  addXp: (n: number) => void;
  /** Any finished run counts the day for streak/playDays — even 0 stars. */
  noteActivity: () => void;
  trackAnswer: (correct: boolean) => void;
  /** Parent HQ: per-skill mastery — kind is optional so old callers keep working. */
  trackSkill: (kind: string, correct: boolean) => void;
  /** Parent HQ: the play window — visible time today, cap, grown-up extensions. */
  bumpPlayMs: (ms: number) => void;
  setDailyCap: (min: number) => void;
  extendPlay: (min: number) => void;
  /** Minutes of play used today against the window (cap + bonus). */
  playMinutesToday: () => number;
  trackCombo: (n: number) => void;
  trackRush: (hits: number) => void;
  recordLevel: (levelIdx: number, stars: number, score: number) => void;
  grantChest: (worldId: number) => void;
  /** Leo's courage boost: one free full refill per local day. */
  claimBoost: () => boolean;
  boostReady: () => boolean;
  claimQuest: (i: number) => boolean;
  claimQuestBonus: () => boolean;
  claimComeback: () => boolean;
  /** Leo Pop: one fusion — updates the Zoo Book, quests + achievements.
   *  Returns true when this tier was discovered for the FIRST time. */
  trackMerge: (tier: number, chain: number) => boolean;
  /** Leo Pop: a finished run — best score, play counter, day credit. */
  recordMergeRun: (score: number) => void;
  /** Leo Pop: the guaranteed daily egg just dropped. Returns true when it
   *  was actually claimed (only then does the +5 XP pay out). */
  claimMergeEgg: () => boolean;
  /** Leo Pop: a creature SEEN for the first time (dropped/hatched — not
   *  fused). Registers the Zoo Book + the discovery quest, no merge count. */
  seeCreature: (tier: number) => boolean;
  /** Leo Eggs: one crack resolved — bag, star payout, rarity XP, pity,
   *  quests and achievements in ONE pipeline. `nest` restarts the
   *  real-time incubation when the free nest egg was the one cracked. */
  trackEgg: (plan: EggPlan, opts: { nest?: boolean }) => { gainedStars: number; xp: number };
  /** Leo Eggs: claim today's free Royal Egg (the morning trigger). */
  claimRoyalEgg: () => boolean;
  /** Leo Eggs: pay stars for a Rainbow/Royal egg. False when too poor. */
  spendEggStars: (n: number) => boolean;
  /** Leo Eggs: feed GROW_SPEND duplicate copies to grow a friend to
   *  Stage 2 (pride only — same art, golden frame). */
  evolveCritter: (uid: string) => boolean;
  /** Leo Feed: one card resolved — Wall of Fame, affinity, heat, pity,
   *  rarity XP, quests and achievements in ONE pipeline. */
  trackFeed: (plan: FeedPlan) => { gainedSpark: number; xp: number };
  /** Leo Feed: claim today's free MEGA card (the morning trigger). */
  claimFeedMega: () => boolean;
  pendingAch: AchDef[];
  dismissAch: () => void;
  levelUpPulse: number; // increments on every new player level (UI trigger)
  toggleSfx: () => void;
  toggleMusic: () => void;
  /** v9 — first-run tour done (finished or skipped); never shown again. */
  finishTour: () => void;
  /** v9 — the save code: export a portable snapshot of this kid's progress. */
  makeSaveCode: () => string;
  /** v9 — restore from a save code (Parent HQ, hold-gated). The code wins. */
  applySaveCode: (code: string) => { ok: boolean; error?: string };
  reset: () => void;
}

export type LeoStore = LeoSave & LeoActions;

const DEFAULT_SAVE: LeoSave = {
  xp: 0,
  weekXp: 0,
  leagueWeek: weekKey(),
  hearts: MAX_HEARTS,
  heartsAt: Date.now(),
  refills: 1,
  streak: 0,
  bestStreak: 0,
  lastPlayDay: "",
  freezes: 0,
  todayXp: 0,
  today: dayKey(),
  stars: {},
  best: {},
  done: {},
  chests: {},
  soundSfx: true,
  soundMusic: true,
  boostDay: "",
  totalCorrect: 0,
  runs: 0,
  playDays: [],
  questDay: "",
  questProgress: [],
  questClaimed: [],
  questAllBonusDay: "",
  ach: [],
  seenPlayerLevel: 1,
  comebackDay: "",
  mergeBest: 0,
  mergeDiscoveries: {},
  mergeEggDay: "",
  mergePlays: 0,
  totalMerges: 0,
  eggStars: 10, // a starter purse — almost a Rainbow Egg for the curious
  eggBag: {},
  eggHatched: 0,
  eggPity: 0,
  eggNestAt: 0, // first visit: the nest is already warm
  eggRoyalDay: "",
  feedPulls: 0,
  feedAlbum: {},
  feedAffinity: {},
  feedPity: 0,
  feedHeat: 0,
  feedBestHeat: 0,
  feedMegaDay: "",
  feedPullDay: "",
  skillStats: {},
  playToday: { day: "", ms: 0, bonus: 0 },
  dailyCapMin: 30, // the default family window: 30 focused minutes
  tourDone: false,
  _hydrated: false,
};

/* ══════════════════ pure state helpers (no get(), ever) ══════════ */

/** Distinct egg friends discovered (bag keys that are real critters). */
function eggDistinct(s: LeoSave): number {
  return Object.keys(s.eggBag).filter((k) => CRITTERS_BY_UID[k]).length;
}

/** Distinct feed friends met (Wall of Fame keys that are real friends). */
function feedDistinct(s: LeoSave): number {
  return Object.keys(s.feedAlbum).filter((k) => FEED_FRIENDS.some((f) => f.uid === k)).length;
}

/** A fresh, empty quest board for today. */
function freshBoard(today: string): Pick<LeoSave, "questDay" | "questProgress" | "questClaimed"> {
  const board = questsForDay(today);
  return {
    questDay: today,
    questProgress: board.map(() => 0),
    questClaimed: board.map(() => false),
  };
}

/** Rebase the snapshot onto today's board if (and only if) it is stale. */
function ensureQuestDay(s: LeoSave): LeoSave {
  const today = dayKey();
  const boardLen = questsForDay(today).length;
  if (s.questDay === today && s.questProgress.length === boardLen) return s;
  return { ...s, ...freshBoard(today) };
}

/** Bump every quest listening to `event`. `max` mode keeps the highest value. */
function bumpQuests(
  sBase: LeoSave,
  event: string,
  n: number,
  mode: "add" | "max" = "add"
): LeoSave {
  const s = ensureQuestDay(sBase); // preserves every field of sBase
  const board = questsForDay(s.questDay);
  const progress = [...s.questProgress];
  board.forEach((q, i) => {
    if (q.event !== event) return;
    progress[i] = mode === "max" ? Math.max(progress[i] ?? 0, n) : (progress[i] ?? 0) + n;
  });
  return { ...s, questProgress: progress };
}

/** The day counter: streak, best streak, freezes and the playDays strip. */
function bumpPlayDay(s0: LeoSave): LeoSave {
  const today = dayKey();
  let streak = s0.streak;
  let freezes = s0.freezes;
  let lastPlayDay = s0.lastPlayDay;

  if (lastPlayDay !== today) {
    // 999 = first-ever play (no yesterday to chain from)
    const gap = lastPlayDay ? daysBetween(lastPlayDay, today) : 999;
    if (gap === 1) {
      streak += 1; // yesterday → today: the streak lives
    } else if (gap === 2 && freezes > 0 && streak > 0) {
      freezes -= 1; // a streak freeze silently saved the streak
      streak += 1;
    } else {
      streak = 1; // fresh start or first ever — kindly begin at 1
    }
    lastPlayDay = today;
  }
  if (streak === 3) freezes += 1; // milestone: earn a freeze
  if (streak === 7) freezes += 2;

  const playDays = s0.playDays.includes(today)
    ? s0.playDays
    : [...s0.playDays, today].slice(-30);

  return {
    ...s0,
    streak,
    bestStreak: Math.max(s0.bestStreak, streak),
    freezes,
    lastPlayDay,
    playDays,
    today,
  };
}

/** XP plumbing without side effects on achievements (they call it too). */
function addXpPure(s0: LeoSave, n: number): { save: LeoSave; leveledTo: number | null } {
  const today = dayKey();
  const wk = weekKey();
  const played = bumpPlayDay(s0);

  const xp = played.xp + n;
  const todayXp = played.today === today ? played.todayXp + n : n;
  const newLvl = playerLevelFromXp(xp);
  const leveledTo = newLvl > s0.seenPlayerLevel ? newLvl : null;

  return {
    save: {
      ...played,
      xp,
      todayXp,
      today,
      weekXp: played.leagueWeek === wk ? played.weekXp + n : n,
      leagueWeek: wk,
      seenPlayerLevel: leveledTo ?? played.seenPlayerLevel,
    },
    leveledTo,
  };
}

/** Evaluate one-shot achievements against a snapshot. Pure. */
function checkAchievements(snapshot: LeoSave): { save: LeoSave; unlocked: AchDef[] } {
  const s = snapshot;
  const starLevels = Object.values(s.stars).filter((v) => v > 0).length;
  const chestCount = Object.values(s.chests).filter(Boolean).length;
  const league = leagueOf(s.weekXp);

  const conditions: Record<string, boolean> = {
    firstStar: starLevels >= 1,
    flawless: Object.values(s.stars).some((v) => v >= 3),
    streak3: s.streak >= 3,
    streak7: s.streak >= 7,
    streak14: s.streak >= 14,
    trail10: starLevels >= 10,
    collector25: starLevels >= 25,
    champion40: starLevels >= TOTAL_LEVELS,
    century: s.totalCorrect >= 100,
    megamind: s.totalCorrect >= 500,
    hunter: chestCount >= 2,
    rising5: playerLevelFromXp(s.xp) >= 5,
    legendLeague: league.index >= 3,
    // Leo Pop
    mergeLeo: (s.mergeDiscoveries[LEO_TIER] ?? 0) >= 1,
    zooAll: Object.keys(s.mergeDiscoveries).filter((k) => Number(k) < ZOO_TARGET).length >= ZOO_TARGET,
    // Leo Eggs
    eggFirst: s.eggHatched >= 1,
    eggExplorer: eggDistinct(s) >= 6,
    eggMaster: eggDistinct(s) >= COLLECTION_TARGET,
    eggLegend: CRITTERS.some((c) => (c.rarity === "legend" || c.rarity === "mythic") && (s.eggBag[c.uid]?.count ?? 0) >= 1),
    eggEvolve: Object.values(s.eggBag).some((c) => c.evolved),
    // Leo Feed
    feedFirst: s.feedPulls >= 1,
    feedHeat: s.feedBestHeat >= HEAT_MAX,
    feedLegend: FEED_FRIENDS.some((f) => f.rarity === "legend" && (s.feedAlbum[f.uid] ?? 0) >= 1),
    feedMythic: FEED_FRIENDS.some((f) => f.rarity === "mythic" && (s.feedAlbum[f.uid] ?? 0) >= 1),
    feedExplorer: feedDistinct(s) >= 6,
    feedMaster: feedDistinct(s) >= FEED_TARGET,
  };

  const unlocked: AchDef[] = [];
  let bonusXp = 0;
  for (const [id, cond] of Object.entries(conditions)) {
    if (cond && !s.ach.includes(id)) {
      const def = ACH_DEFINITIONS[id];
      if (def) {
        unlocked.push(def);
        bonusXp += def.xp;
      }
    }
  }
  if (unlocked.length === 0) return { save: s, unlocked: [] };
  // ids added first → no recursion; XP flows through the same pipe as every
  // other grant (level math AND the daily "Earn XP" quest stay in sync)
  const withIds = { ...s, ach: [...s.ach, ...unlocked.map((a) => a.id)] };
  const added = addXpPure(withIds, bonusXp);
  const quested = bumpQuests(added.save, "xp", bonusXp);
  return { save: quested, unlocked };
}

/* ══════════════════════════ the store ════════════════════════════ */

export const useLeo = create<LeoStore>()(
  persist(
    (set, get) => ({
      ...DEFAULT_SAVE,

      tickHearts: () => {
        const s = get();
        if (s.hearts >= MAX_HEARTS) {
          if (s.heartsAt !== 0) set({ heartsAt: Date.now() });
          return;
        }
        const now = Date.now();
        const gained = Math.floor((now - s.heartsAt) / HEART_REGEN_MS);
        if (gained > 0) {
          const hearts = Math.min(MAX_HEARTS, s.hearts + gained);
          set({
            hearts,
            heartsAt: hearts >= MAX_HEARTS ? now : s.heartsAt + gained * HEART_REGEN_MS,
          });
        }
      },

      loseHeart: () => {
        const s = get();
        if (s.hearts <= 0) return;
        const wasFull = s.hearts >= MAX_HEARTS;
        set({
          hearts: s.hearts - 1,
          heartsAt: wasFull ? Date.now() : s.heartsAt,
        });
      },

      useRefill: () => {
        const s = get();
        if (s.refills <= 0 || s.hearts >= MAX_HEARTS) return false;
        set({ refills: s.refills - 1, hearts: MAX_HEARTS, heartsAt: Date.now() });
        return true;
      },

      /**
       * XP always flows through here: it feeds the daily goal ring,
       * the quest board, the weekly league, the streak and the player
       * level — one currency, many meters (the Duolingo trick, §2).
       */
      addXp: (n) => {
        const base = ensureQuestDay(get());
        const quested = bumpQuests(base, "xp", n);
        const { save, leveledTo } = addXpPure(quested, n);
        const { save: finalSave, unlocked } = checkAchievements(save);
        set({
          ...finalSave,
          levelUpPulse: get().levelUpPulse + (leveledTo ? 1 : 0),
          pendingAch: unlocked.length ? [...get().pendingAch, ...unlocked] : get().pendingAch,
        });
      },

      /** A finished run (any result) counts today as played. */
      noteActivity: () => {
        set(bumpPlayDay(ensureQuestDay(get())));
      },

      trackAnswer: (correct) => {
        const base = ensureQuestDay(get());
        const quested = correct ? bumpQuests(base, "correct", 1) : base;
        const withCount: LeoSave = correct
          ? { ...quested, totalCorrect: quested.totalCorrect + 1 }
          : quested;
        set(withCount);
        if (correct) {
          const { save, unlocked } = checkAchievements(get());
          if (unlocked.length) {
            set({ ...save, pendingAch: [...get().pendingAch, ...unlocked] });
          }
        }
      },

      /** Per-skill mastery for Parent HQ — which puzzles the kid nails vs fumbles. */
      trackSkill: (kind, correct) => {
        const s = get().skillStats[kind] ?? { ok: 0, n: 0 };
        set({
          skillStats: {
            ...get().skillStats,
            [kind]: { ok: s.ok + (correct ? 1 : 0), n: s.n + 1 },
          },
        });
      },

      /** The play-window clock: one heartbeat per visible second (shell ticker). */
      bumpPlayMs: (ms) => {
        // NEVER write before the save rehydrates — an early tick would reset
        // playToday to zero and persist that, wiping the kid's used minutes
        // on every app start (this exact bug shipped once; never again).
        if (!get()._hydrated) return;
        const today = dayKey();
        const pt = get().playToday;
        // a new day resets the window — yesterday's minutes are gone
        const base = pt.day === today ? pt : { day: today, ms: 0, bonus: 0 };
        set({ playToday: { ...base, ms: Math.min(base.ms + ms, 24 * 60 * 60000) } });
      },

      setDailyCap: (min) => set({ dailyCapMin: Math.max(0, Math.min(240, min)) }),

      /** Grown-ups can stretch today's window without changing the family rule. */
      extendPlay: (min) => {
        const today = dayKey();
        const pt = get().playToday;
        const base = pt.day === today ? pt : { day: today, ms: 0, bonus: 0 };
        set({ playToday: { ...base, bonus: base.bonus + min * 60000 } });
      },

      playMinutesToday: () => {
        const pt = get().playToday;
        if (pt.day !== dayKey()) return 0;
        return Math.floor(pt.ms / 60000);
      },

      trackCombo: (n) => {
        const base = ensureQuestDay(get());
        set(bumpQuests(base, "maxcombo", n, "max"));
        if (n >= 10 && !get().ach.includes("combo10")) {
          const def = ACH_DEFINITIONS.combo10;
          const withAch = { ...get(), ach: [...get().ach, "combo10"] };
          const { save } = addXpPure(withAch, def.xp);
          set({ ...bumpQuests(save, "xp", def.xp), pendingAch: [...get().pendingAch, def] });
        }
      },

      trackRush: (hits) => {
        const base = ensureQuestDay(get());
        set(bumpQuests(base, "rushhits", hits, "max"));
        if (hits >= 12 && !get().ach.includes("rushAce")) {
          const def = ACH_DEFINITIONS.rushAce;
          const withAch = { ...get(), ach: [...get().ach, "rushAce"] };
          const { save } = addXpPure(withAch, def.xp);
          set({ ...bumpQuests(save, "xp", def.xp), pendingAch: [...get().pendingAch, def] });
        }
      },

      /**
       * Records a finished level — ANY finished run (v4): best stars, best
       * score, `done` flag (so the next level always opens), run counter,
       * first-clear quest bumps — then achievement checks. ONE set, built
       * from a single snapshot; nothing can be wiped mid-way any more.
       */
      recordLevel: (levelIdx, stars, score) => {
        const s0 = ensureQuestDay(get());
        const prevStars = s0.stars[levelIdx] ?? 0;
        const prevBest = s0.best[levelIdx] ?? 0;
        const firstClear = prevStars === 0 && stars > 0;

        let s: LeoSave = {
          ...s0,
          stars: { ...s0.stars, [levelIdx]: Math.max(prevStars, stars) },
          best: { ...s0.best, [levelIdx]: Math.max(prevBest, score) },
          done: { ...s0.done, [levelIdx]: true },
          runs: s0.runs + 1,
        };
        if (firstClear) {
          s = bumpQuests(s, "levels", 1);
          if (stars >= 3) s = bumpQuests(s, "stars3", 1);
        }
        set(s);

        const { save, unlocked } = checkAchievements(get());
        if (unlocked.length) {
          set({ ...save, pendingAch: [...get().pendingAch, ...unlocked] });
        }
      },

      claimBoost: () => {
        const s = get();
        const today = dayKey();
        if (s.boostDay === today || s.hearts >= MAX_HEARTS) return false;
        set({
          ...s,
          boostDay: today,
          hearts: MAX_HEARTS,
          heartsAt: Date.now(),
        });
        get().addXp(BOOST_XP);
        return true;
      },

      boostReady: () => {
        const s = get();
        return s.boostDay !== dayKey() && s.hearts < MAX_HEARTS;
      },

      grantChest: (worldId) => {
        const s = get();
        if (s.chests[worldId]) return;
        set({
          chests: { ...s.chests, [worldId]: true },
          refills: s.refills + CHEST_REWARDS.refills,
        });
        get().addXp(CHEST_REWARDS.xp);
      },

      claimQuest: (i) => {
        const s = ensureQuestDay(get());
        const board = questsForDay(s.questDay);
        const q = board[i];
        if (!q) return false;
        if (s.questClaimed[i] || (s.questProgress[i] ?? 0) < q.target) return false;
        const claimed = [...s.questClaimed];
        claimed[i] = true;
        set({ ...s, questClaimed: claimed });
        get().addXp(q.rewardXp);
        return true;
      },

      claimQuestBonus: () => {
        const s = ensureQuestDay(get());
        const board = questsForDay(s.questDay);
        const allDone = board.every(
          (q, i) => s.questClaimed[i] && (s.questProgress[i] ?? 0) >= q.target
        );
        if (!allDone || s.questAllBonusDay === s.questDay) return false;
        set({
          ...s,
          questAllBonusDay: s.questDay,
          refills: s.refills + QUEST_ALL_DONE_BONUS.refill,
        });
        get().addXp(QUEST_ALL_DONE_BONUS.xp);
        return true;
      },

      claimComeback: () => {
        const s = get();
        const today = dayKey();
        if (s.comebackDay === today) return false;
        set({ ...s, comebackDay: today, refills: s.refills + 1 });
        get().addXp(20);
        return true;
      },

      /* ── Leo Pop (the arcade) ─────────────────────────────────── */

      trackMerge: (tier, chain) => {
        const s0 = ensureQuestDay(get());
        const disc = { ...s0.mergeDiscoveries };
        const isNew = !disc[tier];
        disc[tier] = (disc[tier] ?? 0) + 1;

        let s: LeoSave = {
          ...s0,
          mergeDiscoveries: disc,
          totalMerges: s0.totalMerges + 1,
        };
        s = bumpQuests(s, "merges", 1);
        if (isNew) s = bumpQuests(s, "mergeNew", 1);
        if (tier === LEO_TIER) s = bumpQuests(s, "mergeLeo", 1);
        set(s);

        // direct-unlock achievements (same pattern as combo10 / rushAce)
        const unlock = (id: string, cond: boolean) => {
          if (!cond || get().ach.includes(id)) return;
          const def = ACH_DEFINITIONS[id];
          if (!def) return;
          const withAch: LeoSave = { ...get(), ach: [...get().ach, id] };
          const { save } = addXpPure(withAch, def.xp);
          set({ ...bumpQuests(save, "xp", def.xp), pendingAch: [...get().pendingAch, def] });
        };
        unlock("mergeLeo", tier === LEO_TIER);
        unlock("mergeChain5", chain >= 5);

        if (isNew) {
          const { save, unlocked } = checkAchievements(get());
          if (unlocked.length) {
            set({ ...save, pendingAch: [...get().pendingAch, ...unlocked] });
          }
        }
        return isNew;
      },

      recordMergeRun: (score) => {
        const s0 = ensureQuestDay(get());
        set({
          ...s0,
          mergeBest: Math.max(s0.mergeBest, score),
          mergePlays: s0.mergePlays + 1,
        });
        // Pop Star (1500 in one run) — direct unlock like combo10
        if (score >= 1500 && !get().ach.includes("mergeScore")) {
          const def = ACH_DEFINITIONS.mergeScore;
          const withAch: LeoSave = { ...get(), ach: [...get().ach, "mergeScore"] };
          const { save } = addXpPure(withAch, def.xp);
          set({ ...bumpQuests(save, "xp", def.xp), pendingAch: [...get().pendingAch, def] });
        }
      },

      claimMergeEgg: () => {
        const s = get();
        const today = dayKey();
        if (s.mergeEggDay === today) return false;
        set({ ...s, mergeEggDay: today });
        return true;
      },

      seeCreature: (tier) => {
        const s0 = ensureQuestDay(get());
        if (s0.mergeDiscoveries[tier]) return false;
        let s: LeoSave = {
          ...s0,
          mergeDiscoveries: { ...s0.mergeDiscoveries, [tier]: 1 },
        };
        s = bumpQuests(s, "mergeNew", 1);
        set(s);
        const { save, unlocked } = checkAchievements(get());
        if (unlocked.length) {
          set({ ...save, pendingAch: [...get().pendingAch, ...unlocked] });
        }
        return true;
      },

      /* ── Leo Eggs (the surprise-egg arcade) ──────────────────── */

      /**
       * One crack resolved. Everything an egg touches happens HERE, in
       * one pure pipeline built from a single snapshot: the bag, the
       * star purse, the pity counter, the nest restart, the rarity XP
       * (through the same addXp pipe as every other grant) and the
       * egg quests. Achievements are checked once, at the end.
       */
      trackEgg: (plan, opts) => {
        const s0 = ensureQuestDay(get());
        const uid = plan.critter.uid;
        const cur = s0.eggBag[uid];
        const bag: LeoSave["eggBag"] = {
          ...s0.eggBag,
          [uid]: { count: (cur?.count ?? 0) + 1, evolved: cur?.evolved ?? false },
        };
        const gainedStars = plan.dupeStars + (plan.isNew ? EGG_DISCOVERY_STARS : 0);
        const xp = RARITY_META[plan.rarity].xp;

        let s: LeoSave = {
          ...s0,
          eggBag: bag,
          eggStars: s0.eggStars + gainedStars,
          eggHatched: s0.eggHatched + 1,
          // pity guards only the free Spark egg — paid eggs are their own guarantee
          eggPity: plan.kind === "spark" ? (plan.pityReset ? 0 : s0.eggPity + 1) : s0.eggPity,
          // the nest immediately starts incubating the next free egg
          eggNestAt: opts.nest ? Date.now() : s0.eggNestAt,
        };
        s = bumpQuests(s, "eggs", 1);
        if (plan.isNew) s = bumpQuests(s, "eggNew", 1);
        if (isRarePlus(plan.rarity)) s = bumpQuests(s, "eggRare", 1);
        const { save: xped } = addXpPure(s, xp);
        s = bumpQuests(xped, "xp", xp);
        set(s);

        const { save, unlocked } = checkAchievements(get());
        if (unlocked.length) {
          set({ ...save, pendingAch: [...get().pendingAch, ...unlocked] });
        }
        return { gainedStars, xp };
      },

      claimRoyalEgg: () => {
        const s = get();
        const today = dayKey();
        if (s.eggRoyalDay === today) return false;
        set({ ...s, eggRoyalDay: today });
        return true;
      },

      spendEggStars: (n) => {
        const s = get();
        if (s.eggStars < n) return false;
        set({ eggStars: s.eggStars - n });
        return true;
      },

      evolveCritter: (uid) => {
        const s0 = ensureQuestDay(get());
        const cur = s0.eggBag[uid];
        if (!cur || cur.evolved || cur.count < GROW_COPIES) return false;
        set({
          ...s0,
          eggBag: {
            ...s0.eggBag,
            [uid]: { count: cur.count - GROW_SPEND, evolved: true },
          },
        });
        get().addXp(GROW_XP); // quest + league + achievements in one pipe
        const { save, unlocked } = checkAchievements(get());
        if (unlocked.length) {
          set({ ...save, pendingAch: [...get().pendingAch, ...unlocked] });
        }
        return true;
      },

      /* ── Leo Feed (the infinite surprise feed) ───────────────── */

      /**
       * One card resolved. Everything a pull touches happens HERE, in
       * one pure pipeline built from a single snapshot: the Wall of
       * Fame, the affinity table (the feed learns), the heat meter,
       * the pity counter, the Spark payout and the rarity XP — which
       * flows through the same addXp pipe as every other grant, so a
       * pull IS a played day (streaks record themselves while kids
       * just have fun). Achievements are checked once, at the end.
       */
      trackFeed: (plan) => {
        const s0 = ensureQuestDay(get());
        const uid = plan.friend.uid;
        const cur = s0.feedAlbum[uid] ?? 0;
        const shiny = plan.rarity !== "common";
        const heat = plan.heatCharged
          ? 0 // the MEGA card fires and cools the meter
          : Math.min(HEAT_MAX, s0.feedHeat + (shiny ? 1 : 0)); // commons keep the warmth

        let s: LeoSave = {
          ...s0,
          feedAlbum: { ...s0.feedAlbum, [uid]: cur + 1 },
          feedAffinity: {
            ...s0.feedAffinity,
            [uid]: Math.min(AFFINITY_CAP, (s0.feedAffinity[uid] ?? 1) * AFFINITY_STEP),
          },
          feedHeat: heat,
          feedBestHeat: Math.max(s0.feedBestHeat, plan.heatCharged ? HEAT_MAX : heat),
          feedPity: plan.pityReset ? 0 : Math.min(PITY_MAX, s0.feedPity + 1),
          feedPulls: s0.feedPulls + 1,
          feedPullDay: dayKey(),
          // duplicates pay Spark into the SAME purse the egg shop uses
          eggStars: s0.eggStars + FEED_DUPE_SPARK[plan.rarity] + (plan.isNew ? FEED_DISCOVERY_SPARK : 0),
        };
        s = bumpQuests(s, "pulls", 1);
        if (plan.isNew) s = bumpQuests(s, "feedNew", 1);
        if (shiny) s = bumpQuests(s, "feedRare", 1);
        const xp = RARITY_META[plan.rarity].xp;
        const { save: xped } = addXpPure(s, xp);
        s = bumpQuests(xped, "xp", xp);
        set(s);

        const { save, unlocked } = checkAchievements(get());
        if (unlocked.length) {
          set({ ...save, pendingAch: [...get().pendingAch, ...unlocked] });
        }
        const gainedSpark = FEED_DUPE_SPARK[plan.rarity] + (plan.isNew ? FEED_DISCOVERY_SPARK : 0);
        return { gainedSpark, xp };
      },

      claimFeedMega: () => {
        const s = get();
        const today = dayKey();
        if (s.feedMegaDay === today) return false;
        set({ ...s, feedMegaDay: today });
        get().addXp(MEGA_GIFT_XP);
        return true;
      },

      pendingAch: [],
      dismissAch: () => set({ pendingAch: get().pendingAch.slice(1) }),
      levelUpPulse: 0,

      toggleSfx: () => set({ soundSfx: !get().soundSfx }),
      toggleMusic: () => set({ soundMusic: !get().soundMusic }),

      /* ── v9 — first-run tour ─────────────────────────────── */
      finishTour: () => set({ tourDone: true }),

      /* ── v9 — the save code: export / restore ───────────── */
      makeSaveCode: () => encodeSaveCode(get()),
      applySaveCode: (code) => {
        const r = decodeSaveCode(code);
        if (!r.ok) return { ok: false, error: r.error };
        // The code wins: it IS the kid's progress. Runtime-only fields
        // (_hydrated, pendingAch, levelUpPulse) stay with this device.
        set({ ...r.payload, _hydrated: true });
        return { ok: true };
      },

      reset: () => set({ ...DEFAULT_SAVE, _hydrated: true, pendingAch: [], levelUpPulse: 0 }),
    }),
    {
      name: "think-leo-save-v1",
      version: 7,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => {
        const { _hydrated, pendingAch, levelUpPulse, ...rest } = s;
        void _hydrated;
        void pendingAch;
        void levelUpPulse;
        return rest as LeoStore;
      },
      migrate: (persisted, version) => {
        const p = (persisted ?? {}) as Partial<LeoSave>;
        // v2 saves carry XP from the inflated economy (score/12 per run — one
        // run could mint 700+ XP and skip three leagues). Rescale to the v3
        // curve so returning kids land in a sane state without losing progress.
        // (v3+ saves were already rescaled — never touch their XP again.)
        const scale = version < 3 ? 12 : 1;
        const xp = Math.round((p.xp ?? 0) / scale);
        const weekXp = Math.round((p.weekXp ?? 0) / scale);
        // v4: backfill `done` from stars so old saves keep every unlocked door
        const done: Record<number, boolean> = {};
        Object.entries(p.stars ?? {}).forEach(([k, v]) => {
          if (v > 0) done[Number(k)] = true;
        });
        return {
          ...DEFAULT_SAVE,
          ...p,
          xp,
          weekXp,
          todayXp: Math.round((p.todayXp ?? 0) / scale),
          hearts: Math.max(p.hearts ?? MAX_HEARTS, 3), // arriving from a fix: be kind
          // v3: boards rebuilt under the exact-3 contract; stars/best survive
          ...freshBoard(dayKey()),
          playDays: p.playDays ?? [],
          ach: p.ach ?? [],
          seenPlayerLevel: playerLevelFromXp(xp),
          comebackDay: "",
          done: { ...done, ...(p.done ?? {}) },
          boostDay: p.boostDay ?? "",
          // v5: the arcade fields (older saves simply start their zoo fresh)
          mergeBest: p.mergeBest ?? 0,
          mergeDiscoveries: p.mergeDiscoveries ?? {},
          mergeEggDay: p.mergeEggDay ?? "",
          mergePlays: p.mergePlays ?? 0,
          totalMerges: p.totalMerges ?? 0,
          // v6: the egg fields (a warm nest + a starter purse for everyone)
          eggStars: p.eggStars ?? 10,
          eggBag: p.eggBag ?? {},
          eggHatched: p.eggHatched ?? 0,
          eggPity: p.eggPity ?? 0,
          eggNestAt: p.eggNestAt ?? 0,
          eggRoyalDay: p.eggRoyalDay ?? "",
          // v7: the feed fields (an empty wall that is about to fill up)
          feedPulls: p.feedPulls ?? 0,
          feedAlbum: p.feedAlbum ?? {},
          feedAffinity: p.feedAffinity ?? {},
          feedPity: p.feedPity ?? 0,
          feedHeat: p.feedHeat ?? 0,
          feedBestHeat: p.feedBestHeat ?? 0,
          feedMegaDay: p.feedMegaDay ?? "",
          feedPullDay: p.feedPullDay ?? "",
        };
      },
      /**
       * Hydration merge — THE hydration flag lives here, not in
       * onRehydrateStorage. Why: that callback runs while `create()` is
       * still executing, so referencing `useLeo` inside it dies in the
       * temporal dead zone (an error persist swallows silently). That
       * bug shipped unnoticed for weeks: `_hydrated` never turned true,
       * so the welcome-back gift and the quick splash never ran. The
       * merge runs for every hydration (stored or fresh) and simply
       * stamps the flag — no store reference needed.
       */
      merge: (persisted, current) =>
        ({
          ...current,
          ...(persisted as Partial<LeoSave>),
          _hydrated: true,
        }) as LeoStore,
      onRehydrateStorage: () => (state) => {
        state?.tickHearts();
      },
    }
  )
);

/* e2e/debug hook — lets test harnesses (and the curious) inspect the save
   engine: window.__leoStore.getState().mergeDiscoveries, … */
if (typeof window !== "undefined") {
  (window as unknown as { __leoStore?: typeof useLeo }).__leoStore = useLeo;
}

/** Convenience selector: hearts display never needs manual math. */
export function useHearts(): { hearts: number; max: number; nextInMin: number } {
  const hearts = useLeo((s) => s.hearts);
  const heartsAt = useLeo((s) => s.heartsAt);
  const tick = useLeo((s) => s.tickHearts);
  // light polling keeps regen honest while the tab is open
  useEffect(() => {
    const id = window.setInterval(tick, 5000);
    return () => window.clearInterval(id);
  }, [tick]);
  if (hearts >= MAX_HEARTS) return { hearts, max: MAX_HEARTS, nextInMin: 0 };
  const nextIn = Math.max(
    0,
    Math.ceil((heartsAt + HEART_REGEN_MS - Date.now()) / 60000)
  );
  return { hearts, max: MAX_HEARTS, nextInMin: nextIn };
}

/** Today's quest board + progress (safe during hydration). */
export function useQuests() {
  const questDay = useLeo((s) => s.questDay);
  const questProgress = useLeo((s) => s.questProgress);
  const questClaimed = useLeo((s) => s.questClaimed);
  const questAllBonusDay = useLeo((s) => s.questAllBonusDay);
  const today = dayKey();
  const board = questsForDay(today);
  const stale = questDay !== today || questProgress.length !== board.length;
  const progress = stale ? board.map(() => 0) : questProgress;
  const claimed = stale ? board.map(() => false) : questClaimed;
  const bonusReady =
    !stale &&
    questAllBonusDay !== today &&
    board.every((q, i) => claimed[i] && (progress[i] ?? 0) >= q.target);
  const allDone = board.every((q, i) => claimed[i] && (progress[i] ?? 0) >= q.target);
  return { board, progress, claimed, bonusReady, allDone, stale, today };
}

/** Is the guaranteed daily egg still waiting in Leo Pop? */
export function useMergeEggReady(): boolean {
  const mergeEggDay = useLeo((s) => s.mergeEggDay);
  const hydrated = useLeo((s) => s._hydrated);
  if (!hydrated) return false;
  return mergeEggDay !== dayKey();
}

/** Zoo Book progress: distinct creatures discovered (0..10) + golden flag. */
export function useZooProgress(): { found: number; target: number; golden: boolean } {
  const disc = useLeo((s) => s.mergeDiscoveries);
  const found = Object.keys(disc).filter((k) => Number(k) < ZOO_TARGET).length;
  return { found, target: ZOO_TARGET, golden: (disc[10] ?? 0) > 0 };
}

/**
 * The nest, live: a 1s ticker that only runs while the app is open.
 * `ready` means a free egg is waiting in the nest right now — the Home
 * card and the egg game both read this one truth.
 */
export function useEggNest(): NestState & { hydrated: boolean } {
  const eggNestAt = useLeo((s) => s.eggNestAt);
  const hydrated = useLeo((s) => s._hydrated);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!hydrated) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [hydrated]);
  if (!hydrated) return { ready: false, pct: 0, minsLeft: 0, hydrated: false };
  return { ...nestState(eggNestAt, now), hydrated: true };
}

/** Egg album progress: distinct friends discovered + the bag itself. */
export function useEggCollection() {
  const eggBag = useLeo((s) => s.eggBag);
  const found = Object.keys(eggBag).filter((k) => CRITTERS_BY_UID[k]).length;
  return { found, target: COLLECTION_TARGET, bag: eggBag };
}

/** Is a welcome-back gift waiting? (2+ days away, one per comeback) */
export function useComeback(): boolean {
  const lastPlayDay = useLeo((s) => s.lastPlayDay);
  const comebackDay = useLeo((s) => s.comebackDay);
  const hydrated = useLeo((s) => s._hydrated);
  if (!hydrated || !lastPlayDay) return false;
  const today = dayKey();
  return daysBetween(lastPlayDay, today) >= 2 && comebackDay !== today;
}

/* ── Leo Feed selectors ─────────────────────────────────────────── */

/** Wall of Fame progress: distinct friends met + the album itself. */
export function useFeedWall() {
  const feedAlbum = useLeo((s) => s.feedAlbum);
  const found = Object.keys(feedAlbum).filter((k) => FEED_FRIENDS.some((f) => f.uid === k)).length;
  return { found, target: FEED_TARGET, album: feedAlbum };
}

/** Is the free daily MEGA card waiting? (hydrated + not claimed today) */
export function useFeedMegaReady(): boolean {
  const feedMegaDay = useLeo((s) => s.feedMegaDay);
  const hydrated = useLeo((s) => s._hydrated);
  if (!hydrated) return false;
  return feedMegaDay !== dayKey();
}
