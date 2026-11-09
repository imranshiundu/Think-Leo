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
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useEffect } from "react";
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
  weekKey,
  yesterdayKey,
  type AchDef,
} from "./game";

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
  pendingAch: AchDef[];
  dismissAch: () => void;
  levelUpPulse: number; // increments on every new player level (UI trigger)
  toggleSfx: () => void;
  toggleMusic: () => void;
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
  _hydrated: false,
};

/* ══════════════════ pure state helpers (no get(), ever) ══════════ */

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
    champion40: starLevels >= 40,
    century: s.totalCorrect >= 100,
    megamind: s.totalCorrect >= 500,
    hunter: chestCount >= 2,
    rising5: playerLevelFromXp(s.xp) >= 5,
    legendLeague: league.index >= 3,
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

      pendingAch: [],
      dismissAch: () => set({ pendingAch: get().pendingAch.slice(1) }),
      levelUpPulse: 0,

      toggleSfx: () => set({ soundSfx: !get().soundSfx }),
      toggleMusic: () => set({ soundMusic: !get().soundMusic }),

      reset: () => set({ ...DEFAULT_SAVE, _hydrated: true, pendingAch: [], levelUpPulse: 0 }),
    }),
    {
      name: "think-leo-save-v1",
      version: 4,
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
        };
      },
      onRehydrateStorage: () => (state) => {
        state?.tickHearts();
        useLeo.setState({ _hydrated: true });
      },
    }
  )
);

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

/** Is a welcome-back gift waiting? (2+ days away, one per comeback) */
export function useComeback(): boolean {
  const lastPlayDay = useLeo((s) => s.lastPlayDay);
  const comebackDay = useLeo((s) => s.comebackDay);
  const hydrated = useLeo((s) => s._hydrated);
  if (!hydrated || !lastPlayDay) return false;
  const today = dayKey();
  return daysBetween(lastPlayDay, today) >= 2 && comebackDay !== today;
}
