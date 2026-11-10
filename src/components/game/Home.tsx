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
import { CssEgg } from "@/components/eggs/EggGame";
import { HoldButton, ParentHQ } from "@/components/game/ParentHQ";
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
  finishedCount,
  isUnlocked,
  leagueOf,
  leoGreeting,
  playerLevelFromXp,
} from "@/lib/game";
import { useComeback, useEggCollection, useEggNest, useFeedMegaReady, useFeedWall, useLeo, useMergeEggReady, useQuests, useZooProgress } from "@/lib/store";
import { sfx } from "@/lib/sound";
import { AnimatePresence, motion } from "framer-motion";
import {
  Brain,
  Crown,
  Download,
  Egg,
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
  onFeed,
  onArcade,
  onEggs,
}: {
  onPlay: () => void; // jumps straight into the current level
  onMap: (worldId: number) => void;
  onFeed: () => void; // opens LEO FEED, the infinite surprise feed
  onArcade: () => void; // opens LEO POP, the merge arcade
  onEggs: () => void; // opens LEO EGGS, the surprise-egg arcade
}) {
  const save = useLeo();
  const greet = useMemo(() => leoGreeting(), []);
  const quests = useQuests();
  const comeback = useComeback();
  const eggReady = useMergeEggReady();
  const zoo = useZooProgress();
  const nest = useEggNest();
  const eggs = useEggCollection();
  const feedWall = useFeedWall();
  const feedGift = useFeedMegaReady();

  const [installEvt, setInstallEvt] = useState<InstallPromptEvent | null>(null);
  const [hqOpen, setHqOpen] = useState(false);
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
  const levelsDone = finishedCount(save.stars, save.done);

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
      <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 md:px-8">
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

        {/* ── LEO POP — the arcade ── (a div with button semantics: the
            PLAY chunky-button inside must not nest <button> in <button>) */}
        <section className="mt-4">
          <motion.div
            role="button"
            tabIndex={0}
            onClick={onArcade}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onArcade();
            }}
            whileTap={{ scale: 0.98 }}
            className="leo-card relative flex w-full cursor-pointer items-center gap-4 overflow-hidden border-[3px] p-5 text-left"
            style={{ background: "linear-gradient(120deg,#ffe9f1 0%,#f3e9ff 55%,#fff3c4 100%)" }}
            aria-label="Open LEO POP, the merge arcade"
          >
            <Sparkles width={90} height={90} className="pointer-events-none absolute -right-4 -top-6 text-leo-berry opacity-15" />
            {eggReady && (
              <span className="anim-pulse-ring absolute right-4 top-4 rounded-full border-[2.5px] border-leo-sun bg-white px-2.5 py-0.5 font-display text-[10px] font-bold text-leo-sun-deep">
                Daily egg ready!
              </span>
            )}
            <motion.div
              className="relative shrink-0"
              animate={{ y: [0, -7, 0], rotate: [-3, 3, -3] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
            >
              <span
                className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-[3px] border-[#F5C860]"
                style={{ background: "radial-gradient(circle at 32% 28%, #ffffff 8%, #FFE49A 62%)" }}
              >
                <Sticker id="lion" size={56} />
              </span>
              <motion.span
                className="absolute -left-3 -top-1"
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, delay: 0.3 }}
              >
                <Sticker id="ladybug" size={22} />
              </motion.span>
              <motion.span
                className="absolute -bottom-1 -right-3"
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 2.1, repeat: Infinity, delay: 0.8 }}
              >
                <Sticker id="bee" size={22} />
              </motion.span>
            </motion.div>
            <div className="min-w-0 flex-1">
              <h3 className="font-display text-2xl font-bold leading-none text-leo-ink">
                LEO <span className="bg-gradient-to-r from-leo-berry to-leo-grape bg-clip-text text-transparent">POP</span>
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-leo-ink-soft">
                Drop friends in the jar, fuse two of a kind, grow the zoo — no maths, just popping fun.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="pill px-2.5 py-0.5 text-[11px] text-leo-ink">
                  <Trophy width={12} height={12} className="text-leo-sun-deep" /> Best {save.mergeBest}
                </span>
                <span className="pill px-2.5 py-0.5 text-[11px] text-leo-ink">
                  <Star width={12} height={12} className="fill-leo-sun text-leo-sun-deep" /> Zoo {zoo.found}/{zoo.target}
                </span>
                {zoo.golden && (
                  <span className="pill px-2.5 py-0.5 text-[11px] text-leo-ink">
                    <Crown width={12} height={12} className="text-leo-sun-deep" /> Golden Leo
                  </span>
                )}
              </div>
            </div>
            <span onClick={(e) => e.stopPropagation()} className="shrink-0">
              <ChunkyButton color="berry" onClick={onArcade} ariaLabel="Play Leo Pop">
                <span className="inline-flex items-center gap-1.5">
                  <Play width={16} height={16} className="fill-white" /> PLAY
                </span>
              </ChunkyButton>
            </span>
          </motion.div>
        </section>

        {/* ── LEO EGGS — the surprise-egg arcade ── (a div with button
            semantics: the PLAY chunky-button inside must not nest
            <button> in <button>) */}
        <section className="mt-4">
          <motion.div
            role="button"
            tabIndex={0}
            onClick={onEggs}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onEggs();
            }}
            whileTap={{ scale: 0.98 }}
            className="leo-card relative flex w-full cursor-pointer items-center gap-4 overflow-hidden border-[3px] p-5 text-left"
            style={{ background: "linear-gradient(120deg,#fff3c4 0%,#ffeef6 55%,#f3e9ff 100%)" }}
            aria-label="Open LEO EGGS, the surprise-egg arcade"
          >
            {nest.ready && (
              <span className="anim-pulse-ring absolute right-4 top-4 rounded-full border-[2.5px] border-leo-berry bg-white px-2.5 py-0.5 font-display text-[10px] font-bold text-leo-berry-deep">
                Nest egg ready!
              </span>
            )}
            <motion.div
              className="relative shrink-0"
              animate={{ y: [0, -7, 0], rotate: [-4, 4, -4] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
            >
              <CssEgg kind="spark" size={70} />
              <motion.span
                className="absolute -right-3 -top-1"
                animate={{ rotate: [0, 14, 0] }}
                transition={{ duration: 2.2, repeat: Infinity, delay: 0.4 }}
              >
                <Sparkles width={20} height={20} className="text-leo-berry" />
              </motion.span>
            </motion.div>
            <div className="min-w-0 flex-1">
              <h3 className="font-display text-2xl font-bold leading-none text-leo-ink">
                LEO <span className="bg-gradient-to-r from-leo-sun-deep to-leo-berry bg-clip-text text-transparent">EGGS</span>
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-leo-ink-soft">
                Hold an egg, hear it crack, meet the friend inside — then do it again. Collect them all.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="pill px-2.5 py-0.5 text-[11px] text-leo-ink">
                  <Egg width={12} height={12} className="text-leo-berry-deep" /> {eggs.found}/{eggs.target} friends
                </span>
                <span className="pill px-2.5 py-0.5 text-[11px] text-leo-ink">
                  <Star width={12} height={12} className="fill-leo-sun text-leo-sun-deep" /> {save.eggStars} egg stars
                </span>
                {save.streak >= 1 && (
                  <span className="pill px-2.5 py-0.5 text-[11px] text-leo-ink">
                    <Flame width={12} height={12} className="text-leo-sun-deep" /> streak luck +{Math.min(12, save.streak * 2)}%
                  </span>
                )}
              </div>
            </div>
            <span onClick={(e) => e.stopPropagation()} className="shrink-0">
              <ChunkyButton color="berry" onClick={onEggs} ariaLabel="Play Leo Eggs">
                <span className="inline-flex items-center gap-1.5">
                  <Play width={16} height={16} className="fill-white" /> PLAY
                </span>
              </ChunkyButton>
            </span>
          </motion.div>
        </section>

        {/* ── LEO FEED — the infinite surprise feed ── (a div with
            button semantics: the PLAY chunky-button inside must not nest
            <button> in <button>) */}
        <section className="mt-4">
          <motion.div
            role="button"
            tabIndex={0}
            onClick={onFeed}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onFeed();
            }}
            whileTap={{ scale: 0.98 }}
            className="leo-card relative flex w-full cursor-pointer items-center gap-4 overflow-hidden border-[3px] p-5 text-left"
            style={{ background: "linear-gradient(120deg,#f3e9ff 0%,#ffecf3 50%,#dcf9f4 100%)" }}
            aria-label="Open LEO FEED, the infinite surprise feed"
          >
            {feedGift && (
              <span className="anim-pulse-ring absolute right-4 top-4 rounded-full border-[2.5px] border-leo-grape bg-white px-2.5 py-0.5 font-display text-[10px] font-bold text-leo-grape-deep">
                Daily gift ready!
              </span>
            )}
            <span className="absolute left-4 top-4 rounded-full bg-gradient-to-r from-leo-berry to-leo-grape px-2.5 py-0.5 font-display text-[10px] font-bold text-white">
              NEW GAME
            </span>
            <motion.div
              className="relative shrink-0"
              animate={{ y: [0, -8, 0], rotate: [-4, 4, -4] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            >
              <span
                className="flex h-[72px] w-[72px] items-center justify-center rounded-[24px] border-[3px] border-[#e8a80c]"
                style={{ background: "radial-gradient(circle at 34% 26%, #fffbe8 10%, #ffd75e 72%)" }}
              >
                <Sticker id="rocket" size={52} />
              </span>
              <motion.span
                className="absolute -right-3 -top-2"
                animate={{ y: [0, -6, 0], rotate: [0, 15, 0] }}
                transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
              >
                <Sparkles width={22} height={22} className="text-leo-grape" />
              </motion.span>
            </motion.div>
            <div className="min-w-0 flex-1">
              <h3 className="font-display text-2xl font-bold leading-none text-leo-ink">
                LEO <span className="bg-gradient-to-r from-leo-grape to-leo-teal bg-clip-text text-transparent">FEED</span>
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-leo-ink-soft">
                An endless feed of mystery cards — open one, meet a friend, and the next is already waiting. No maths, ever.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="pill px-2.5 py-0.5 text-[11px] text-leo-ink">
                  <Star width={12} height={12} className="fill-leo-sun text-leo-sun-deep" /> Wall {feedWall.found}/{feedWall.target}
                </span>
                <span className="pill px-2.5 py-0.5 text-[11px] text-leo-ink">
                  <Zap width={12} height={12} className="text-leo-grape" /> {save.feedPulls} cards opened
                </span>
                {save.feedHeat > 0 && (
                  <span className="pill px-2.5 py-0.5 text-[11px] text-leo-ink">
                    <Flame width={12} height={12} className="text-leo-berry-deep" /> heat {save.feedHeat}/5
                  </span>
                )}
              </div>
            </div>
            <span onClick={(e) => e.stopPropagation()} className="shrink-0">
              <ChunkyButton color="grape" onClick={onFeed} ariaLabel="Play Leo Feed">
                <span className="inline-flex items-center gap-1.5">
                  <Play width={16} height={16} className="fill-white" /> PLAY
                </span>
              </ChunkyButton>
            </span>
          </motion.div>
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
              const locked = !isUnlocked(firstLevel, save.stars, save.done);
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
                    {locked
                      ? `Finish 3 levels in ${WORLDS[idx - 1]?.name ?? "the previous world"} to open`
                      : w.tagline}
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

        {/* ── grown-ups: the gated door to Parent HQ ── */}
        <footer className="mt-auto pt-5">
          <div className="leo-card flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-start gap-2 text-xs leading-relaxed text-leo-ink-soft">
              <Sparkles width={18} height={18} className="mt-0.5 shrink-0 text-leo-ink" />
              <span>
                <b className="font-display text-sm text-leo-ink">For grown-ups:</b> kid-safe by design —
                no ads, no purchases, no chat. Progress saves on this device and keeps working with no
                internet. Made for phones and tablets — laptops love it too.
                <span className="mt-0.5 block text-[10px] opacity-75">
                  Music: &ldquo;Carefree&rdquo;, &ldquo;Monkeys Spinning Monkeys&rdquo;, &ldquo;Sneaky Snitch&rdquo; by Kevin MacLeod
                  (incompetech.com) — licensed under CC BY 4.0.
                </span>
              </span>
            </div>
            <div className="flex flex-col items-stretch gap-2">
              {installEvt && (
                <ChunkyButton
                  color="sun"
                  size="sm"
                  onClick={() => {
                    void installEvt.prompt();
                    setInstallEvt(null);
                  }}
                  ariaLabel="Add Think Leo to your home screen"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Download width={15} height={15} /> Add to Home Screen
                  </span>
                </ChunkyButton>
              )}
              {/* the parent gate: a 4-year-old TAPS — holding is the grown-up's move */}
              <HoldButton
                label="Open Parent HQ"
                hint="press and hold"
                onDone={() => setHqOpen(true)}
              />
            </div>
          </div>
        </footer>

        <AnimatePresence>
          {hqOpen && <ParentHQ open onClose={() => setHqOpen(false)} />}
        </AnimatePresence>
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
