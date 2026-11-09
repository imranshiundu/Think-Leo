"use client";

/**
 * Think Leo — Home hub
 * Daily-goal ring, streak strip, hearts, XP, league progress,
 * today's quest board, the badge shelf, world cards, welcome-back
 * gift and install. Art is 100% stickers + icons — no emojis.
 */

import { Leo } from "@/components/leo/Leo";
import { ChestArt } from "@/components/leo/badges";
import { AmbientCartoons } from "@/components/game/ambient";
import { Sticker } from "@/components/leo/stickers";
import {
  ChunkyButton,
  DailyRing,
  HeartPill,
  LeagueProgress,
  LevelProgress,
  QuestRow,
  SoundToggles,
  StreakFlame,
  StreakStrip,
  StarRow,
  XpPill,
} from "@/components/game/bits";
import {
  ACH_DEFINITIONS,
  LEVELS_PER_WORLD,
  WORLDS,
  leagueOf,
  leoGreeting,
  playerLevelFromXp,
} from "@/lib/game";
import { useComeback, useLeo, useQuests } from "@/lib/store";
import { sfx } from "@/lib/sound";
import { motion } from "framer-motion";
import {
  Brain,
  Crown,
  Download,
  Flame,
  Gem,
  Lock,
  Map,
  Medal,
  Play,
  Rocket,
  Sparkles,
  Star,
  Ticket,
  Trophy,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

const ACH_SHELF = Object.values(ACH_DEFINITIONS);

export function Home({
  onPlay,
  onMap,
}: {
  onPlay: () => void; // jumps straight into the current level
  onMap: (worldId: number) => void;
}) {
  const save = useLeo();
  const greet = useMemo(() => leoGreeting(), []);
  const quests = useQuests();
  const comeback = useComeback();

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

  const goalLeft = Math.max(0, 120 - save.todayXp);
  const bubble =
    comeback
      ? "You came back! I kept a gift for you."
      : save.streak >= 7
        ? "A WHOLE WEEK of thinking! You're legendary!"
        : save.streak >= 3
          ? "Three days strong — keep the flame alive!"
          : goalLeft > 0 && save.todayXp > 0
            ? `Only ${goalLeft} XP to finish today's goal!`
            : greet.line;

  const worldStars = (w: number) =>
    Array.from({ length: LEVELS_PER_WORLD }, (_, i) => save.stars[w * LEVELS_PER_WORLD + i + 1] ?? 0).reduce(
      (a, b) => a + b,
      0
    );

  const claimQuest = (i: number) => {
    if (save.claimQuest(i)) sfx.questClaim();
  };
  const claimBonus = () => {
    if (save.claimQuestBonus()) sfx.chestOpen();
  };
  const claimComeback = () => {
    if (save.claimComeback()) sfx.welcomeBack();
  };

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
            <div title={`${league.name} league — ${save.weekXp} XP this week`}>
              <LeagueProgress weekXp={save.weekXp} compact />
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

        {/* ── welcome-back gift ── */}
        {comeback && (
          <motion.section
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="leo-card mt-3 flex flex-wrap items-center gap-4 border-leo-sun p-4"
            style={{ background: "linear-gradient(120deg,#fff3c4,#ffe9f1)" }}
          >
            <ChestArt state="ready" size={52} />
            <div className="min-w-0 flex-1">
              <h3 className="font-display text-lg font-bold text-leo-ink">Welcome back, champion!</h3>
              <p className="text-xs text-leo-ink-soft">
                Leo missed you. Here is a comeback gift: 1 heart refill + 20 XP.
              </p>
            </div>
            <ChunkyButton color="sun" onClick={claimComeback} ariaLabel="Open your comeback gift">
              Open gift
            </ChunkyButton>
          </motion.section>
        )}

        {/* ── hero ── */}
        <section className="mt-4 grid flex-1 grid-cols-1 gap-4 md:grid-cols-[1.1fr_1fr]">
          <div className="leo-card relative flex items-center justify-center gap-4 overflow-hidden p-6">
            <AmbientCartoons world={Math.floor((currentLevel - 1) / LEVELS_PER_WORLD)} count={5} opacity={0.13} />
            <Sparkles width={86} height={86} className="pointer-events-none absolute -right-5 -top-5 text-leo-sun opacity-15" />
            <div className="shrink-0">
              <motion.div
                initial={{ scale: 0.5, opacity: 0, rotate: -8 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 14 }}
              >
                <Leo mood={greet.mood} size={185} bubble={bubble} />
              </motion.div>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <DailyRing value={save.todayXp} />
              <span className="font-display text-xs font-semibold text-leo-ink-soft">
                Daily goal
              </span>
              <div className="pill mt-1 px-3 py-1 text-xs text-leo-ink">
                <Flame width={13} height={13} className="fill-leo-sun text-leo-sun-deep" />
                Best streak: <b>{save.bestStreak}</b>
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
                <span className="pill px-3 py-1 text-xs text-leo-ink">
                  <Star width={13} height={13} className="fill-leo-sun text-leo-sun-deep" /> {totalStars} stars
                </span>
                <span className="pill px-3 py-1 text-xs text-leo-ink">
                  <Map width={13} height={13} className="text-leo-teal-deep" /> {levelsDone}/{WORLDS.length * LEVELS_PER_WORLD} levels
                </span>
                <span className="pill px-3 py-1 text-xs text-leo-ink">
                  <Ticket width={13} height={13} className="text-leo-berry-deep" /> {save.refills} refill{save.refills === 1 ? "" : "s"}
                </span>
              </div>
              <LevelProgress xp={save.xp} className="mt-4" />
            </div>
            <div className="mt-5 flex items-center justify-between gap-3">
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                <ChunkyButton color="leaf" size="xl" onClick={onPlay} ariaLabel="Play the current level">
                  <span className="inline-flex items-center gap-2">
                    <Play width={22} height={22} className="fill-white" /> PLAY
                  </span>
                </ChunkyButton>
              </motion.div>
              <ChunkyButton color="cocoa" onClick={() => onMap(Math.floor((currentLevel - 1) / LEVELS_PER_WORLD))}>
                Level map
              </ChunkyButton>
            </div>
          </div>
        </section>

        {/* ── daily quests ── */}
        <section className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-display text-lg font-bold text-leo-ink">Today&apos;s quests</h3>
            <span className="text-xs font-semibold text-leo-ink-soft">Fresh board every day</span>
          </div>
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-[1fr_auto]">
            <div className="flex flex-col gap-2">
              {quests.board.map((q, i) => (
                <QuestRow
                  key={q.id}
                  quest={q}
                  progress={quests.progress[i] ?? 0}
                  claimed={quests.claimed[i] ?? false}
                  onClaim={() => claimQuest(i)}
                />
              ))}
            </div>
            {/* finish-all chest */}
            <button
              type="button"
              onClick={claimBonus}
              disabled={!quests.bonusReady}
              aria-label={
                quests.allDone && !quests.bonusReady
                  ? "Daily chest already claimed"
                  : quests.bonusReady
                    ? "Claim the all-quests chest"
                    : "Finish all quests to open the chest"
              }
              className={`leo-card flex flex-col items-center justify-center gap-1 p-4 lg:w-44 ${
                quests.bonusReady ? "anim-pulse-ring cursor-pointer" : "opacity-70"
              }`}
            >
              <ChestArt state={quests.allDone ? "open" : quests.bonusReady ? "ready" : "locked"} size={64} />
              <span className="font-display text-sm font-bold text-leo-ink">
                {quests.allDone ? "Chest opened" : "All-quests chest"}
              </span>
              <span className="text-[11px] text-leo-ink-soft">+20 XP · +1 refill</span>
            </button>
          </div>
        </section>

        {/* ── badge shelf ── */}
        <section className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-display text-lg font-bold text-leo-ink">Badge shelf</h3>
            <span className="text-xs font-semibold text-leo-ink-soft">
              {save.ach.length}/{ACH_SHELF.length} unlocked
            </span>
          </div>
          <div className="leo-scroll flex gap-2 overflow-x-auto pb-1">
            {ACH_SHELF.map((a) => {
              const got = save.ach.includes(a.id);
              return (
                <motion.div
                  key={a.id}
                  whileHover={{ y: -3 }}
                  title={got ? `${a.name} — ${a.desc}` : `${a.desc} (locked)`}
                  className={`flex w-[104px] shrink-0 flex-col items-center gap-1 rounded-2xl border-[2.5px] p-2.5 text-center ${
                    got ? "border-leo-sun bg-white" : "border-leo-line bg-white/60"
                  }`}
                >
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-full border-[3px] ${
                      got ? "border-leo-sun-deep bg-gradient-to-b from-leo-honey to-leo-sun text-white" : "border-leo-line bg-leo-sand text-leo-line"
                    }`}
                  >
                    {got ? <AchGlyph icon={a.icon} /> : <Lock width={18} height={18} className="text-leo-ink-soft" />}
                  </span>
                  <span className={`font-display text-[11px] font-bold leading-tight ${got ? "text-leo-ink" : "text-leo-ink-soft"}`}>
                    {a.name}
                  </span>
                  <div className="flex items-center gap-0.5 text-[9px] font-semibold text-leo-ink-soft">
                    <Star width={9} height={9} className={got ? "fill-leo-sun text-leo-sun-deep" : ""} />
                    +{a.xp} XP
                  </div>
                </motion.div>
              );
            })}
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
                  {locked ? (
                    <Lock width={36} height={36} className="text-leo-ink-soft" />
                  ) : (
                    <motion.div
                      animate={{ y: [0, -5, 0] }}
                      transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut", delay: idx * 0.3 }}
                    >
                      <Sticker id={w.emblem} size={44} title={`${w.name} world`} />
                    </motion.div>
                  )}
                  <span className="mt-1 font-display text-base font-bold text-leo-ink">{w.name}</span>
                  <span className="mt-0.5 line-clamp-2 min-h-8 text-[11px] leading-snug text-leo-ink-soft">
                    {locked ? "Earn a star on the previous world to unlock" : w.tagline}
                  </span>
                  <div className="mt-2">
                    <StarRow n={Math.round((stars / (LEVELS_PER_WORLD * 3)) * 3)} size={15} />
                  </div>
                  <span className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-leo-ink-soft">
                    <Star width={11} height={11} className="fill-leo-sun text-leo-sun-deep" />
                    {stars}/{LEVELS_PER_WORLD * 3}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </section>

        {/* ── weekly streak strip ── */}
        <section className="leo-card mt-4 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-display text-base font-bold text-leo-ink">This week&apos;s flame</h3>
            <Trophy width={16} height={16} className="text-leo-sun-deep" />
          </div>
          <StreakStrip playDays={save.playDays} streak={save.streak} />
        </section>

        {/* ── parents / install ── */}
        <footer className="mt-auto pt-5">
          <div className="leo-card flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-start gap-2 text-xs leading-relaxed text-leo-ink-soft">
              <Sparkles width={18} height={18} className="mt-0.5 shrink-0 text-leo-ink" />
              <span>
                <b className="font-display text-sm text-leo-ink">For grown-ups:</b> kid-safe by design —
                no ads, no purchases, no chat. Progress saves on this device and works offline —
                on laptops, phones and tablets.
                <span className="mt-0.5 block text-[10px] opacity-75">
                  Music: &ldquo;Carefree&rdquo;, &ldquo;Monkeys Spinning Monkeys&rdquo;, &ldquo;Sneaky Snitch&rdquo; by Kevin MacLeod
                  (incompetech.com) — licensed under CC BY 4.0.
                </span>
              </span>
            </div>
            {installEvt && (
              <ChunkyButton
                color="sun"
                size="sm"
                onClick={() => {
                  void installEvt.prompt();
                  setInstallEvt(null);
                }}
                ariaLabel="Install Think Leo on this device"
              >
                <span className="inline-flex items-center gap-1.5">
                  <Download width={15} height={15} /> Install app
                </span>
              </ChunkyButton>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

/* achievement icon picker */
function AchGlyph({ icon }: { icon: string }) {
  const map: Record<string, React.ComponentType<{ width?: number; height?: number; className?: string }>> = {
    star: Star,
    flame: Flame,
    zap: Zap,
    rocket: Rocket,
    crown: Crown,
    map: Map,
    brain: Brain,
    trophy: Trophy,
    gem: Gem,
    medal: Medal,
  };
  const Icon = map[icon] ?? Star;
  return <Icon width={22} height={22} className="fill-white" />;
}
