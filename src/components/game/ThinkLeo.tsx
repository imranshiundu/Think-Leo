"use client";

/**
 * Think Leo — app root & view state machine
 * ─────────────────────────────────────────
 * boot → splash → home ⇄ map ⇄ play, home ⇄ arcade ⇄ eggs
 * The whole experience is one route ("/") with client view switching,
 * which keeps the installed app instant and offline-friendly.
 *
 * Devices: laptops, phones and tablets all play. Every visit still has
 * its hardware details detected and recorded (lib/deviceInfo.ts →
 * /api/device + local log) so the parents' dashboard knows what the
 * family plays on.
 */

import { Home } from "@/components/game/Home";
import { LevelMap } from "@/components/game/LevelMap";
import { LevelUpOverlay } from "@/components/game/LevelUp";
import { Play } from "@/components/game/Play";
import { Splash } from "@/components/game/Splash";
import { LeoPop } from "@/components/arcade/LeoPop";
import { EggGame } from "@/components/eggs/EggGame";
import { FeedGame } from "@/components/feed/FeedGame";
import { AchievementToasts } from "@/components/game/bits";
import { detectDevice, watchDevice, type DeviceKind } from "@/lib/device";
import { recordDevice } from "@/lib/deviceInfo";
import { LEVELS_PER_WORLD, WORLDS, dayKey, worldOf } from "@/lib/game";
import { sfx } from "@/lib/sound";
import { useLeo } from "@/lib/store";
import { NapScreen } from "@/components/game/ParentHQ";
import { Sticker } from "@/components/leo/stickers";
import { Leo } from "@/components/leo/Leo";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type View = "home" | "map" | "play" | "arcade" | "eggs" | "feed";

export default function ThinkLeo() {
  const [device, setDevice] = useState<DeviceKind | null>(null);
  const [view, setView] = useState<View>("home");
  const [focusWorld, setFocusWorld] = useState(0);
  const [levelIdx, setLevelIdx] = useState(1);
  const [splashDone, setSplashDone] = useState(false);

  const hydrated = useLeo((s) => s._hydrated);
  const soundSfx = useLeo((s) => s.soundSfx);
  const soundMusic = useLeo((s) => s.soundMusic);
  const stars = useLeo((s) => s.stars);

  /* device detection — every kind plays; details are always recorded
     (locally + parents' dashboard) so every visit leaves a footprint. */
  useEffect(() => {
    const t = window.setTimeout(() => {
      setDevice(detectDevice());
      recordDevice();
    }, 0);
    const un = watchDevice(setDevice);
    return () => {
      window.clearTimeout(t);
      un();
    };
  }, []);

  /* audio unlock on the first gesture (browser autoplay policy) */
  useEffect(() => {
    const h = () => sfx.unlock(true);
    window.addEventListener("pointerdown", h, { passive: true });
    window.addEventListener("keydown", h);
    return () => {
      window.removeEventListener("pointerdown", h);
      window.removeEventListener("keydown", h);
    };
  }, []);

  /* keep the engine in sync with the kid's sound settings — and make the
     music follow the screen (home/map = hub track; play/rush own theirs) */
  useEffect(() => {
    sfx.setSfx(soundSfx);
  }, [soundSfx]);
  useEffect(() => {
    sfx.setMusic(soundMusic);
  }, [soundMusic]);
  useEffect(() => {
    if (!soundMusic) return;
    if (view === "home" || view === "map") sfx.startMusic("home");
    // "play" is driven by the Play screen itself (play + rush moods)
  }, [soundMusic, view]);

  /* splash plays in full once per session. NOTE: onDone MUST be stable —
     Splash rebuilds its GSAP timeline whenever [quick, onDone] change, so a
     fresh closure here would restart the show forever. */
  const finishSplash = useCallback(() => setSplashDone(true), []);
  const [quickSplash] = useState(
    () => typeof sessionStorage !== "undefined" && sessionStorage.getItem("tl-seen") === "1"
  );
  useEffect(() => {
    if (splashDone) sessionStorage.setItem("tl-seen", "1");
  }, [splashDone]);

  /* Parent HQ — the play-window clock: one heartbeat per 5 VISIBLE seconds
     (minutes-scale window; 5 s granularity keeps re-renders near zero).
     Subscribing to the derived BOOLEAN keeps the shell quiet — only the
     actual nap flip re-renders, never the ticking clock. */
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") useLeo.getState().bumpPlayMs(5000);
    }, 5000);
    return () => window.clearInterval(id);
  }, []);
  const napping = useLeo((s) => {
    if (s.dailyCapMin === 0) return false; // open-ended
    const today = s.playToday.day === dayKey();
    return today && s.playToday.ms >= s.dailyCapMin * 60000 + s.playToday.bonus;
  });

  /* ── level-transition wipe: every jump into a level is a moment ──
     Sound + timers live OUTSIDE the state updaters: React may invoke an
     updater twice (StrictMode), and side effects inside one fire twice
     with it — a double wipe sound, double navigation timers. A ref is the
     honest "already running" flag. */
  const [wipe, setWipe] = useState<number | null>(null);
  const wipeRef = useRef<number | null>(null);
  const goLevel = useCallback((i: number) => {
    if (wipeRef.current !== null) return; // a wipe is already running
    wipeRef.current = i;
    sfx.wipe();
    setWipe(i);
    window.setTimeout(() => {
      setLevelIdx(i);
      setView("play");
    }, 560);
    window.setTimeout(() => {
      setWipe(null);
      wipeRef.current = null;
    }, 1250);
  }, []);

  /* the arcade gets its own berry-coloured curtain */
  const [arcadeWipe, setArcadeWipe] = useState(false);
  const arcadeWipeRef = useRef(false);
  const goArcade = useCallback(() => {
    if (arcadeWipeRef.current) return;
    arcadeWipeRef.current = true;
    sfx.wipe();
    setArcadeWipe(true);
    window.setTimeout(() => setView("arcade"), 560);
    window.setTimeout(() => {
      setArcadeWipe(false);
      arcadeWipeRef.current = false;
    }, 1250);
  }, []);

  /* the egg game gets a sunrise curtain — warm like a shell */
  const [eggWipe, setEggWipe] = useState(false);
  const eggWipeRef = useRef(false);
  const goEggs = useCallback(() => {
    if (eggWipeRef.current) return;
    eggWipeRef.current = true;
    sfx.wipe();
    setEggWipe(true);
    window.setTimeout(() => setView("eggs"), 560);
    window.setTimeout(() => {
      setEggWipe(false);
      eggWipeRef.current = false;
    }, 1250);
  }, []);

  /* the feed gets a galaxy curtain — grape to teal, like a night sky */
  const [feedWipe, setFeedWipe] = useState(false);
  const feedWipeRef = useRef(false);
  const goFeed = useCallback(() => {
    if (feedWipeRef.current) return;
    feedWipeRef.current = true;
    sfx.wipe();
    setFeedWipe(true);
    window.setTimeout(() => setView("feed"), 560);
    window.setTimeout(() => {
      setFeedWipe(false);
      feedWipeRef.current = false;
    }, 1250);
  }, []);

  /* next unmastered level */
  const currentLevel = useMemo(() => {
    for (let i = 1; i <= WORLDS.length * LEVELS_PER_WORLD; i++) {
      if ((stars[i] ?? 0) === 0) return i;
    }
    return WORLDS.length * LEVELS_PER_WORLD;
  }, [stars]);

  if (device === null) return <div className="leo-bg fixed inset-0" />;

  return (
    <>
      <AchievementToasts />
      <LevelUpOverlay />
      <AnimatePresence>
        {!splashDone && (
          <Splash
            key="splash"
            quick={quickSplash || !hydrated}
            onDone={finishSplash}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>{wipe !== null && <LevelWipe key="wipe" level={wipe} />}</AnimatePresence>
      <AnimatePresence>{arcadeWipe && <ArcadeWipe key="arcade-wipe" />}</AnimatePresence>
      <AnimatePresence>{eggWipe && <EggWipe key="egg-wipe" />}</AnimatePresence>
      <AnimatePresence>{feedWipe && <FeedWipe key="feed-wipe" />}</AnimatePresence>

      {/* the play window, enforced above every screen */}
      <AnimatePresence>
        {napping && <NapScreen onExtend={() => useLeo.getState().extendPlay(15)} />}
      </AnimatePresence>

      <motion.div
        key={view}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {view === "home" && (
          <Home
            onPlay={() => {
              sfx.click();
              goLevel(currentLevel);
            }}
            onMap={(w) => {
              sfx.click();
              setFocusWorld(w);
              setView("map");
            }}
            onFeed={() => {
              sfx.click();
              goFeed();
            }}
            onArcade={() => {
              sfx.click();
              goArcade();
            }}
            onEggs={() => {
              sfx.click();
              goEggs();
            }}
          />
        )}

        {view === "map" && (
          <LevelMap
            startWorld={focusWorld}
            onBack={() => setView("home")}
            onPlay={(i) => goLevel(i)}
            onArcade={() => goArcade()}
          />
        )}

        {view === "play" && (
          <Play
            key={levelIdx}
            levelIdx={levelIdx}
            hasNext={levelIdx < WORLDS.length * LEVELS_PER_WORLD}
            onExit={() => setView("map")}
            onNext={() => {
              goLevel(Math.min(WORLDS.length * LEVELS_PER_WORLD, levelIdx + 1));
            }}
          />
        )}

        {view === "arcade" && <LeoPop key="arcade" onExit={() => setView("home")} />}

        {view === "eggs" && <EggGame key="eggs" onExit={() => setView("home")} />}

        {view === "feed" && <FeedGame key="feed" onExit={() => setView("home")} />}
      </motion.div>
    </>
  );
}

/* ── the curtain between screens: a world-coloured burst with Leo running
      across it — the "travelling to the next quest" beat ── */
function LevelWipe({ level }: { level: number }) {
  const world = worldOf(level);
  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-[85] flex items-center justify-center"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.45, ease: "easeOut" } }}
    >
      <motion.div
        className="absolute inset-0"
        style={{ background: `linear-gradient(135deg, ${world.node}, ${world.edge})` }}
        initial={{ clipPath: "circle(0% at 50% 46%)" }}
        animate={{ clipPath: "circle(78% at 50% 46%)" }}
        transition={{ duration: 0.52, ease: [0.7, 0, 0.3, 1] }}
      />
      <motion.div
        className="relative flex flex-col items-center"
        initial={{ scale: 0.6, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ delay: 0.18, type: "spring", stiffness: 260, damping: 18 }}
      >
        <div className="flex items-center gap-3 rounded-3xl border-[4px] border-white/90 bg-white/25 px-7 py-4 backdrop-blur-sm">
          <div className="anim-bob-x">
            <Leo mood="excited" size={86} />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-widest text-white/90">
              <Sticker id={world.emblem} size={20} />
              {world.name}
            </div>
            <div className="font-display text-4xl font-bold text-white text-outline-sm">Level {level}</div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── the arcade curtain: a berry burst with a bouncing lion sticker ── */
function ArcadeWipe() {
  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-[85] flex items-center justify-center"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.45, ease: "easeOut" } }}
    >
      <motion.div
        className="absolute inset-0"
        style={{ background: "linear-gradient(135deg, #ff5a8c, #9b5de5)" }}
        initial={{ clipPath: "circle(0% at 50% 46%)" }}
        animate={{ clipPath: "circle(78% at 50% 46%)" }}
        transition={{ duration: 0.52, ease: [0.7, 0, 0.3, 1] }}
      />
      <motion.div
        className="relative flex flex-col items-center"
        initial={{ scale: 0.6, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ delay: 0.18, type: "spring", stiffness: 260, damping: 18 }}
      >
        <div className="flex items-center gap-3 rounded-3xl border-[4px] border-white/90 bg-white/25 px-7 py-4 backdrop-blur-sm">
          <motion.div
            animate={{ y: [0, -12, 0], rotate: [-5, 5, -5] }}
            transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
          >
            <Sticker id="lion" size={72} />
          </motion.div>
          <div className="text-left">
            <div className="font-display text-sm font-bold uppercase tracking-widest text-white/90">Think Leo presents</div>
            <div className="font-display text-4xl font-bold text-white text-outline-sm">LEO POP</div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── the egg curtain: a sunrise burst with a hatching egg + Leo cub ── */
function EggWipe() {
  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-[85] flex items-center justify-center"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.45, ease: "easeOut" } }}
    >
      <motion.div
        className="absolute inset-0"
        style={{ background: "linear-gradient(135deg, #ffb020, #ff5a8c 55%, #9b5de5)" }}
        initial={{ clipPath: "circle(0% at 50% 46%)" }}
        animate={{ clipPath: "circle(78% at 50% 46%)" }}
        transition={{ duration: 0.52, ease: [0.7, 0, 0.3, 1] }}
      />
      <motion.div
        className="relative flex flex-col items-center"
        initial={{ scale: 0.6, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ delay: 0.18, type: "spring", stiffness: 260, damping: 18 }}
      >
        <div className="flex items-center gap-3 rounded-3xl border-[4px] border-white/90 bg-white/25 px-7 py-4 backdrop-blur-sm">
          <motion.div
            className="flex h-[72px] w-[58px] items-center justify-center"
            style={{
              borderRadius: "50% 50% 50% 50% / 60% 60% 42% 42%",
              background: "radial-gradient(circle at 34% 26%, #fffbe8 8%, #ffd75e 70%)",
              border: "3px solid #e8a80c",
            }}
            animate={{ rotate: [-7, 7, -7] }}
            transition={{ duration: 0.7, repeat: Infinity, ease: "easeInOut" }}
          >
            <Sticker id="lion" size={44} />
          </motion.div>
          <div className="text-left">
            <div className="font-display text-sm font-bold uppercase tracking-widest text-white/90">Think Leo presents</div>
            <div className="font-display text-4xl font-bold text-white text-outline-sm">LEO EGGS</div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── the feed curtain: a night-sky burst with the rocket friend ── */
function FeedWipe() {
  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-[85] flex items-center justify-center"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.45, ease: "easeOut" } }}
    >
      <motion.div
        className="absolute inset-0"
        style={{ background: "linear-gradient(135deg, #9b5de5, #2ec4b6 60%, #ffb020)" }}
        initial={{ clipPath: "circle(0% at 50% 46%)" }}
        animate={{ clipPath: "circle(78% at 50% 46%)" }}
        transition={{ duration: 0.52, ease: [0.7, 0, 0.3, 1] }}
      />
      <motion.div
        className="relative flex flex-col items-center"
        initial={{ scale: 0.6, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ delay: 0.18, type: "spring", stiffness: 260, damping: 18 }}
      >
        <div className="flex items-center gap-3 rounded-3xl border-[4px] border-white/90 bg-white/25 px-7 py-4 backdrop-blur-sm">
          <motion.div
            animate={{ y: [0, -12, 0], rotate: [-6, 6, -6] }}
            transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
          >
            <Sticker id="rocket" size={72} />
          </motion.div>
          <div className="text-left">
            <div className="font-display text-sm font-bold uppercase tracking-widest text-white/90">Think Leo presents</div>
            <div className="font-display text-4xl font-bold text-white text-outline-sm">LEO FEED</div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
