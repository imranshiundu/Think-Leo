"use client";

/**
 * Think Leo — Level Map (Candy-Crush-style winding trail)
 * ─────────────────────────────────────────────────────────
 * A vertical dotted trail climbs through 4 worlds × 10 levels.
 * Bottom = level 1. The trail winds with a sine wave, nodes show stars,
 * locks and the current quest; world banners carry the reward chests.
 * Geometry documented in docs/ALGORITHM.md §3.
 */

import { Leo } from "@/components/leo/Leo";
import { ChestArt } from "@/components/leo/badges";
import { AmbientCartoons } from "@/components/game/ambient";
import { Sticker } from "@/components/leo/stickers";
import { HeartPill, SoundToggles, StreakFlame, StarRow } from "@/components/game/bits";
import { LEVELS_PER_WORLD, WORLDS, isUnlocked, worldOf } from "@/lib/game";
import { sfx } from "@/lib/sound";
import { useLeo } from "@/lib/store";
import { AnimatePresence, motion } from "framer-motion";
import { Lock, Star } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const GAP = 96;
const PAD_BOTTOM = 150;
const PAD_TOP = 170;
const CANVAS_W = 660;
const AMP = 165;
const TOTAL = WORLDS.length * LEVELS_PER_WORLD;

const H = PAD_BOTTOM + TOTAL * GAP + PAD_TOP;
const nodeX = (i: number) => CANVAS_W / 2 + Math.sin(i * 1.05) * AMP;
const nodeY = (i: number) => H - PAD_BOTTOM - (i - 1) * GAP;

export function LevelMap({
  startWorld,
  onBack,
  onPlay,
}: {
  startWorld: number;
  onBack: () => void;
  onPlay: (levelIdx: number) => void;
}) {
  const save = useLeo();
  const scroller = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<{ msg: string; key: number } | null>(null);
  const [shake, setShake] = useState(0);
  /* phones shrink the whole winding trail to fit — same map, same feel */
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => setScale(Math.min(1, window.innerWidth / (CANVAS_W + 24)));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const currentLevel = useMemo(() => {
    for (let i = 1; i <= TOTAL; i++) if ((save.stars[i] ?? 0) === 0) return i;
    return TOTAL;
  }, [save.stars]);

  const totalStars = Object.values(save.stars).reduce((a, b) => a + b, 0);

  /* land the view on the current quest */
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const focusWorld = Math.max(0, Math.min(WORLDS.length - 1, startWorld));
    const firstLockedInWorld = focusWorld * LEVELS_PER_WORLD + 1;
    const target =
      (save.stars[firstLockedInWorld] ?? 0) === 0 && firstLockedInWorld <= currentLevel
        ? firstLockedInWorld
        : currentLevel;
    el.scrollTo({ top: nodeY(target) * scale - el.clientHeight * 0.55, behavior: "instant" as ScrollBehavior });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const clickNode = (i: number) => {
    if (isUnlocked(i, save.stars)) {
      sfx.click();
      onPlay(i);
    } else {
      sfx.lockClick();
      setShake((s) => s + 1);
      setToast({ msg: `Earn a star on level ${i - 1} to unlock this one!`, key: Date.now() });
    }
  };

  const openChest = (w: number) => {
    const reached = (save.stars[(w + 1) * LEVELS_PER_WORLD] ?? 0) >= 1;
    if (!reached || save.chests[w]) {
      sfx.lockClick();
      return;
    }
    save.grantChest(w);
    sfx.chestOpen();
    setToast({ msg: "Chest opened: +2 heart refills and +40 XP!", key: Date.now() });
  };

  /* dotted trail through every node */
  const trail = useMemo(() => {
    let d = `M ${nodeX(1)},${nodeY(1)}`;
    for (let i = 2; i <= TOTAL; i++) d += ` L ${nodeX(i)},${nodeY(i)}`;
    return d;
  }, []);

  return (
    <div className="leo-bg h-screen w-full overflow-hidden">
      {/* ambient jungle/sea/space/candy buddies floating behind the map */}
      <AmbientCartoons world={Math.max(0, Math.min(WORLDS.length - 1, startWorld))} count={6} opacity={0.13} />
      {/* fixed HUD */}
      <div className="absolute inset-x-0 top-0 z-30 flex items-center gap-2 bg-gradient-to-b from-[#fff7e6] via-[#fff7e6ee] to-transparent px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="pill cursor-pointer px-3 py-1.5 font-display text-sm text-leo-ink hover:bg-leo-cream"
        >
          ← Home
        </button>
        <div className="pill gap-1.5 px-3 py-1 text-sm text-leo-ink">
          <Star width={14} height={14} className="fill-leo-sun text-leo-sun-deep" />
          {totalStars}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <HeartPill compact />
          <StreakFlame streak={save.streak} />
          <SoundToggles
            sfxOn={save.soundSfx}
            musicOn={save.soundMusic}
            onSfx={() => save.toggleSfx()}
            onMusic={() => save.toggleMusic()}
          />
        </div>
      </div>

      <div ref={scroller} className="leo-scroll h-full w-full overflow-y-auto">
        {/* scale wrapper: reserves the scaled height so scrolling stays exact */}
        <div style={{ height: H * scale, width: "100%" }}>
          <div
            className="relative mx-auto"
            style={{
              width: CANVAS_W,
              height: H,
              position: "relative",
              left: "50%",
              transform: `translateX(-50%) scale(${scale})`,
              transformOrigin: "top center",
            }}
          >
          {/* trail */}
          <svg
            className="pointer-events-none absolute inset-0"
            width={CANVAS_W}
            height={H}
            aria-hidden
          >
            <path
              d={trail}
              fill="none"
              stroke="rgba(255,255,255,0.95)"
              strokeWidth="11"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="1 20"
              className="trail-march"
            />
            <path
              d={trail}
              fill="none"
              stroke="rgba(214,178,110,0.5)"
              strokeWidth="13"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="1 20"
              opacity="0.4"
            />
          </svg>

          {/* world banners + chests */}
          {WORLDS.map((w, idx) => {
            const lastLevel = (idx + 1) * LEVELS_PER_WORLD;
            const reached = (save.stars[lastLevel] ?? 0) >= 1;
            const claimed = !!save.chests[w.id];
            const y = idx === 0 ? nodeY(1) - 78 : nodeY(idx * LEVELS_PER_WORLD) - GAP / 2 - 26;
            return (
              <div
                key={w.id}
                className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-3 rounded-2xl border-[3px] border-white/80 px-4 py-2 shadow-[0_5px_0_rgba(0,0,0,0.08)]"
                style={{ left: CANVAS_W / 2, top: y, background: `linear-gradient(120deg, ${w.wash[0]}, ${w.wash[1]})` }}
              >
                <Sticker id={w.emblem} size={30} title={`${w.name} world`} />
                <div>
                  <div className="font-display text-sm font-bold text-leo-ink">{w.name}</div>
                  <div className="text-[10px] text-leo-ink-soft">
                    Levels {idx * LEVELS_PER_WORLD + 1}–{lastLevel}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openChest(w.id)}
                  aria-label={claimed ? "Chest already opened" : reached ? "Open reward chest" : "Chest locked"}
                  className={`ml-1 flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border-[3px] ${
                    claimed
                      ? "border-leo-line bg-leo-sand opacity-70"
                      : reached
                        ? "anim-pulse-ring border-leo-sun bg-white"
                        : "border-leo-line bg-leo-sand opacity-60"
                  }`}
                >
                  <ChestArt state={claimed ? "open" : reached ? "ready" : "locked"} size={30} />
                </button>
              </div>
            );
          })}

          {/* level nodes — they pop in one by one, bottom to top */}
          {Array.from({ length: TOTAL }, (_, k) => {
            const i = k + 1;
            const w = worldOf(i);
            const stars = save.stars[i] ?? 0;
            const unlocked = isUnlocked(i, save.stars);
            const isCurrent = i === currentLevel;
            return (
              <motion.div
                key={i}
                className="absolute"
                style={{ left: nodeX(i), top: nodeY(i) }}
                initial={{ scale: 0, opacity: 0, x: "-50%", y: "-50%" }}
                animate={{ scale: 1, opacity: 1, x: "-50%", y: "-50%" }}
                transition={{ delay: Math.min(0.6, k * 0.035), type: "spring", stiffness: 260, damping: 17 }}
              >
                {isCurrent && (
                  <div className="pointer-events-none absolute -top-[74px] left-1/2 -translate-x-1/2">
                    <div className="anim-float">
                      <Leo mood="excited" size={78} />
                    </div>
                  </div>
                )}
                <motion.button
                  type="button"
                  key={shake && !unlocked ? `sh-${shake}-${i}` : `n-${i}`}
                  onClick={() => clickNode(i)}
                  whileHover={unlocked ? { scale: 1.08 } : { x: [0, -3, 3, -2, 2, 0] }}
                  whileTap={unlocked ? { scale: 0.94 } : {}}
                  aria-label={`Level ${i}${stars ? `, ${stars} stars` : unlocked ? ", your next quest" : ", locked"}`}
                  className={`relative flex h-[58px] w-[58px] cursor-pointer items-center justify-center rounded-full border-[3.5px] font-display text-xl font-bold shadow-[0_5px_0_rgba(0,0,0,0.18)] ${
                    isCurrent ? "anim-pulse-ring" : ""
                  } ${unlocked ? "text-white" : "bg-[#e8ddc4] text-[#b3a586] border-[#d3c39c]"}`}
                  style={
                    unlocked
                      ? { background: w.node, borderColor: "rgba(255,255,255,0.9)", ["--edge" as string]: w.edge, boxShadow: `0 5px 0 ${w.edge}` }
                      : undefined
                  }
                >
                  {unlocked ? i : <Lock width={20} height={20} />}
                  {stars > 0 && (
                    <div className="absolute -bottom-[26px] left-1/2 -translate-x-1/2">
                      <StarRow n={stars} size={13} />
                    </div>
                  )}
                </motion.button>
              </motion.div>
            );
          })}
          </div>
        </div>
      </div>

      {/* toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.key}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-2xl border-[3px] border-leo-line bg-white px-5 py-2.5 font-display text-sm font-semibold text-leo-ink shadow-lg"
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
