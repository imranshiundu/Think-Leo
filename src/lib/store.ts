/**
 * Think Leo — Save State (zustand + localStorage)
 * ─────────────────────────────��─────────────────
 * Offline-first PWA: the whole save lives on the kid's device.
 * Schema + hearts-regen and streak math documented in docs/ALGORITHM.md §6–7.
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useEffect } from "react";
import {
  CHEST_REWARDS,
  dayKey,
  HEART_REGEN_MS,
  MAX_HEARTS,
  weekKey,
  yesterdayKey,
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
  chests: Record<number, boolean>; // worldId -> claimed
  soundSfx: boolean;
  soundMusic: boolean;
  totalCorrect: number;
  runs: number;
  _hydrated: boolean;
}

export interface LeoActions {
  tickHearts: () => void;
  loseHeart: () => void;
  useRefill: () => boolean;
  addXp: (n: number) => void;
  recordLevel: (levelIdx: number, stars: number, score: number) => void;
  grantChest: (worldId: number) => void;
  toggleSfx: () => void;
  toggleMusic: () => void;
  reset: () => void;
}

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
  chests: {},
  soundSfx: true,
  soundMusic: true,
  totalCorrect: 0,
  runs: 0,
  _hydrated: false,
};

export type LeoStore = LeoSave & LeoActions;

export const useLeo = create<LeoStore>()(
  persist(
    (set, get) => ({
      ...DEFAULT_SAVE,

      /**
       * Hearts regen while away: on every tick, pour in
       * floor((now - heartsAt) / HEART_REGEN_MS) hearts.
       */
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
       * the weekly league and the streak — one currency, many meters
       * (the Duolingo trick, docs/ALGORITHM.md §2).
       */
      addXp: (n) => {
        const s = get();
        const today = dayKey();
        const wk = weekKey();
        let streak = s.streak;
        let freezes = s.freezes;
        let lastPlayDay = s.lastPlayDay;

        if (lastPlayDay !== today) {
          if (lastPlayDay === yesterdayKey()) {
            streak += 1;
          } else if (freezes > 0 && streak > 0 && lastPlayDay !== "") {
            freezes -= 1; // freeze silently saved the streak
            streak += 1;
          } else {
            streak = 1;
          }
          lastPlayDay = today;
        }

        // streak milestones: 3 days → +1 freeze, 7 days → +2 freezes
        if (streak === 3) freezes += 1;
        if (streak === 7) freezes += 2;

        set({
          xp: s.xp + n,
          todayXp: s.today === today ? s.todayXp + n : n,
          today,
          weekXp: s.leagueWeek === wk ? s.weekXp + n : n,
          leagueWeek: wk,
          streak,
          bestStreak: Math.max(s.bestStreak, streak),
          freezes,
          lastPlayDay,
        });
      },

      recordLevel: (levelIdx, stars, score) => {
        const s = get();
        const prevStars = s.stars[levelIdx] ?? 0;
        const prevBest = s.best[levelIdx] ?? 0;
        set({
          stars: { ...s.stars, [levelIdx]: Math.max(prevStars, stars) },
          best: { ...s.best, [levelIdx]: Math.max(prevBest, score) },
          runs: s.runs + 1,
          totalCorrect: s.totalCorrect + stars * 0, // kept for future stats
        });
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

      toggleSfx: () => set({ soundSfx: !get().soundSfx }),
      toggleMusic: () => set({ soundMusic: !get().soundMusic }),

      reset: () => set({ ...DEFAULT_SAVE, _hydrated: true }),
    }),
    {
      name: "think-leo-save-v1",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => {
        const { _hydrated, ...rest } = s;
        void _hydrated;
        return rest as LeoStore;
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
