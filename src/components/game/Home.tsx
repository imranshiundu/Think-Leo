"use client";

/**
 * Think Leo — Home hub
 * Daily-goal ring, streak, hearts, XP, league, world cards, install.
 */

import { Leo } from "@/components/leo/Leo";
import {
  ChunkyButton,
  DailyRing,
  HeartPill,
  SoundToggles,
  StreakFlame,
  StarRow,
  XpPill,
} from "@/components/game/bits";
import { WORLDS, LEVELS_PER_WORLD, leagueOf, leoGreeting, playerLevelFromXp } from "@/lib/game";
import { useLeo } from "@/lib/store";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

export function Home({
  onPlay,
  onMap,
}: {
  onPlay: () => void; // jumps straight into the current level
  onMap: (worldId: number) => void;
}) {
  const save = useLeo();
  const greet = useMemo(() => leoGreeting(), []);

  const [installEvt, setInstallEvt] = useState<InstallPromptEvent | null>(null);
  useEffect(() => {
    const h = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);

  const lvl = playerLevelFromXp(save.xp);
  const league = leagueOf(save.weekXp);
  const totalStars = Object.values(save.stars).reduce((a, b) => a + b, 0);
  const levelsDone = Object.values(save.stars).filter((s) => s > 0).length;

  const currentLevel = useMemo(() => {
    for (let i = 1; i <= WORLDS.length * LEVELS_PER_WORLD; i++) {
      if ((save.stars[i] ?? 0) === 0) return i;
    }
    return WORLDS.length * LEVELS_PER_WORLD; // everything mastered — replay finale
  }, [save.stars]);

  const bubble =
    save.streak >= 7
      ? "A WHOLE WEEK of thinking! You're legendary! 🔥"
      : save.streak >= 3
        ? "Three days strong — keep the flame alive!"
        : greet.line;

  const worldStars = (w: number) =>
    Array.from({ length: LEVELS_PER_WORLD }, (_, i) => save.stars[w * LEVELS_PER_WORLD + i + 1] ?? 0).reduce(
      (a, b) => a + b,
      0
    );

  return (
    <div className="leo-bg h-screen w-full overflow-y-auto leo-scroll">
      <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col px-5 pb-5 pt-4 md:px-8">
        {/* ── top bar ── */}
        <header className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <Leo mood="happy" size={54} />
            <div className="font-display text-xl font-bold leading-none text-leo-ink">
              Think <span className="bg-gradient-to-r from-leo-sun to-leo-berry bg-clip-text text-transparent">Leo!</span>
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="pill px-3 py-1" title={`Player level ${lvl}`}>
              <span className="text-sm font-bold text-leo-ink">Lv {lvl}</span>
            </div>
            <div className="pill px-3 py-1" title={`${league.name} league — ${save.weekXp} XP this week`}>
              <span>{league.emoji}</span>
              <span className="text-sm text-leo-ink">{league.name}</span>
            </div>
            <XpPill xp={save.xp} />
            <StreakFlame streak={save.streak} />
            <HeartPill compact />
            <SoundToggles
              sfxOn={save.soundSfx}
              musicOn={save.soundMusic}
              onSfx={() => save.toggleSfx()}
              onMusic={() => save.toggleMusic()}
            />
          </div>
        </header>

        {/* ── hero ── */}
        <section className="mt-4 grid flex-1 grid-cols-1 gap-4 md:grid-cols-[1.1fr_1fr]">
          <div className="leo-card relative flex items-center justify-center gap-4 overflow-hidden p-6">
            <div className="pointer-events-none absolute -right-6 -top-6 select-none text-7xl opacity-15">🧠</div>
            <div className="shrink-0">
              <Leo mood={greet.mood} size={185} bubble={bubble} />
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <DailyRing value={save.todayXp} />
              <span className="font-display text-xs font-semibold text-leo-ink-soft">
                Daily goal
              </span>
              <div className="pill mt-1 px-3 py-1 text-xs text-leo-ink">
                🔥 Best streak: <b>{save.bestStreak}</b>
              </div>
            </div>
          </div>

          <div className="leo-card flex flex-col justify-between p-6">
            <div>
              <h2 className="font-display text-2xl font-bold text-leo-ink">
                Level {currentLevel} · {WORLDS[Math.floor((currentLevel - 1) / LEVELS_PER_WORLD)].name}
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-leo-ink-soft">
                8 puzzles, a combo meter and the wild <b className="text-leo-ink">LEO RUSH</b> finale.
                Keep your hearts to reach it!
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="pill px-3 py-1 text-xs text-leo-ink">⭐ {totalStars} stars</span>
                <span className="pill px-3 py-1 text-xs text-leo-ink">🎒 {levelsDone}/{WORLDS.length * LEVELS_PER_WORLD} levels</span>
                <span className="pill px-3 py-1 text-xs text-leo-ink">🎟️ {save.refills} refill{save.refills === 1 ? "" : "s"}</span>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-between gap-3">
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                <ChunkyButton color="leaf" size="xl" onClick={onPlay} ariaLabel="Play the current level">
                  ▶ PLAY
                </ChunkyButton>
              </motion.div>
              <ChunkyButton color="cocoa" onClick={() => onMap(Math.floor((currentLevel - 1) / LEVELS_PER_WORLD))}>
                Level map
              </ChunkyButton>
            </div>
          </div>
        </section>

        {/* ── worlds ── */}
        <section className="mt-4">
          <h3 className="mb-2 font-display text-lg font-bold text-leo-ink">Worlds</h3>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {WORLDS.map((w, idx) => {
              const firstLevel = idx * LEVELS_PER_WORLD + 1;
              const locked = firstLevel > 1 && (save.stars[firstLevel - 1] ?? 0) < 1;
              const stars = worldStars(idx);
              return (
                <motion.button
                  key={w.id}
                  type="button"
                  disabled={locked}
                  onClick={() => onMap(idx)}
                  whileHover={locked ? {} : { y: -4 }}
                  whileTap={locked ? {} : { scale: 0.97 }}
                  className={`leo-card flex flex-col items-center p-4 text-center ${
                    locked ? "opacity-60 grayscale" : "cursor-pointer"
                  }`}
                  style={{ background: `linear-gradient(160deg, ${w.wash[0]}, ${w.wash[1]})` }}
                >
                  <span className="text-4xl">{locked ? "🔒" : w.emoji}</span>
                  <span className="mt-1 font-display text-base font-bold text-leo-ink">{w.name}</span>
                  <span className="mt-0.5 line-clamp-2 min-h-8 text-[11px] leading-snug text-leo-ink-soft">
                    {locked ? "Earn a star on the previous world to unlock" : w.tagline}
                  </span>
                  <div className="mt-2">
                    <StarRow n={Math.round((stars / (LEVELS_PER_WORLD * 3)) * 3)} size={15} />
                  </div>
                  <span className="mt-1 text-[11px] font-semibold text-leo-ink-soft">
                    {stars}/{LEVELS_PER_WORLD * 3} ⭐
                  </span>
                </motion.button>
              );
            })}
          </div>
        </section>

        {/* ── parents / install ── */}
        <footer className="mt-auto pt-5">
          <div className="leo-card flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="text-xs leading-relaxed text-leo-ink-soft">
              <b className="font-display text-sm text-leo-ink">For grown-ups:</b> kid-safe by design —
              no ads, no purchases, no chat. Progress saves on this device and works offline.{" "}
              <span className="whitespace-nowrap">Best on a laptop 💻.</span>
            </div>
            {installEvt && (
              <ChunkyButton
                color="sun"
                size="sm"
                onClick={() => {
                  void installEvt.prompt();
                  setInstallEvt(null);
                }}
              >
                ⬇ Install app
              </ChunkyButton>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
