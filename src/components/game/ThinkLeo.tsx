"use client";

/**
 * Think Leo — app root & view state machine
 * ─────────────────────────────────────────
 * boot → (mobile? PhoneGate — forever) → splash → home ⇄ map ⇄ play
 * The whole experience is one route ("/") with client view switching,
 * which keeps the PWA instant and offline-friendly.
 */

import { Home } from "@/components/game/Home";
import { LevelMap } from "@/components/game/LevelMap";
import { LevelUpOverlay } from "@/components/game/LevelUp";
import { PhoneGate } from "@/components/game/PhoneGate";
import { Play } from "@/components/game/Play";
import { Splash } from "@/components/game/Splash";
import { AchievementToasts } from "@/components/game/bits";
import { detectDevice, watchDevice, type DeviceKind } from "@/lib/device";
import { deviceSummary, getDeviceInfo, recordDevice } from "@/lib/deviceInfo";
import { LEVELS_PER_WORLD, WORLDS } from "@/lib/game";
import { sfx } from "@/lib/sound";
import { useLeo } from "@/lib/store";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";

type View = "home" | "map" | "play";

export default function ThinkLeo() {
  const [device, setDevice] = useState<DeviceKind | null>(null);
  const [deviceLine, setDeviceLine] = useState("");
  const [view, setView] = useState<View>("home");
  const [focusWorld, setFocusWorld] = useState(0);
  const [levelIdx, setLevelIdx] = useState(1);
  const [splashDone, setSplashDone] = useState(false);
  const [gateAllow, setGateAllow] = useState(false); // "I AM on a laptop" escape hatch

  const hydrated = useLeo((s) => s._hydrated);
  const soundSfx = useLeo((s) => s.soundSfx);
  const soundMusic = useLeo((s) => s.soundMusic);
  const stars = useLeo((s) => s.stars);

  /* device gate — phones & tablets never pass. Details are recorded
     (locally + parents' dashboard) so every visit leaves a footprint. */
  useEffect(() => {
    const t = window.setTimeout(() => {
      const kind = detectDevice();
      setDevice(kind);
      setDeviceLine(deviceSummary(getDeviceInfo()));
      recordDevice();
    }, 0);
    const un = watchDevice(setDevice);
    return () => {
      window.clearTimeout(t);
      un();
    };
  }, []);

  /* "wait, I AM on a laptop" → re-run detection; also re-check on real focus */
  const retryDevice = useCallback(() => {
    setDevice(detectDevice());
  }, []);

  /* audio unlock on the first gesture (browser autoplay policy) */
  useEffect(() => {
    const h = () => sfx.unlock();
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

  /* splash plays in full once per session */
  const [quickSplash] = useState(
    () => typeof sessionStorage !== "undefined" && sessionStorage.getItem("tl-seen") === "1"
  );
  useEffect(() => {
    if (splashDone) sessionStorage.setItem("tl-seen", "1");
  }, [splashDone]);

  /* next unmastered level */
  const currentLevel = useMemo(() => {
    for (let i = 1; i <= WORLDS.length * LEVELS_PER_WORLD; i++) {
      if ((stars[i] ?? 0) === 0) return i;
    }
    return WORLDS.length * LEVELS_PER_WORLD;
  }, [stars]);

  if (device === "mobile" && !gateAllow) {
    return <PhoneGate onRetry={() => { setGateAllow(true); retryDevice(); }} deviceLine={deviceLine} />;
  }
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
            onDone={() => setSplashDone(true)}
          />
        )}
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
              setLevelIdx(currentLevel);
              setView("play");
            }}
            onMap={(w) => {
              sfx.click();
              setFocusWorld(w);
              setView("map");
            }}
          />
        )}

        {view === "map" && (
          <LevelMap
            startWorld={focusWorld}
            onBack={() => setView("home")}
            onPlay={(i) => {
              setLevelIdx(i);
              setView("play");
            }}
          />
        )}

        {view === "play" && (
          <Play
            key={levelIdx}
            levelIdx={levelIdx}
            hasNext={levelIdx < WORLDS.length * LEVELS_PER_WORLD}
            onExit={() => setView("map")}
            onNext={() => {
              setLevelIdx((l) => Math.min(WORLDS.length * LEVELS_PER_WORLD, l + 1));
              setView("play");
            }}
          />
        )}
      </motion.div>
    </>
  );
}
