"use client";

/**
 * Think Leo — PLAYER LEVEL UP moment (global overlay, §13.3)
 * Watches `levelUpPulse` from the store: whenever XP pushes the kid to a
 * new player level, the whole screen celebrates — wherever they are.
 */

import { Leo } from "@/components/leo/Leo";
import { ConfettiBurst } from "@/components/game/bits";
import { playerLevelFromXp } from "@/lib/game";
import { sfx } from "@/lib/sound";
import { useLeo } from "@/lib/store";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

export function LevelUpOverlay() {
  const pulse = useLeo((s) => s.levelUpPulse);
  const [show, setShow] = useState<number | null>(null);
  const prev = useRef(pulse);

  useEffect(() => {
    if (pulse > prev.current) {
      prev.current = pulse;
      const lvl = playerLevelFromXp(useLeo.getState().xp);
      const t = window.setTimeout(() => {
        setShow(lvl);
        sfx.levelUp();
      }, 30);
      const out = window.setTimeout(() => setShow(null), 2830);
      return () => {
        window.clearTimeout(t);
        window.clearTimeout(out);
      };
    }
    prev.current = pulse;
  }, [pulse]);

  return (
    <>
      <ConfettiBurst fireKey={show ? 999 + show : 0} count={90} />
      <AnimatePresence>
        {show && (
          <motion.div
            key="levelup"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.3, rotate: -8, y: 60 }}
              animate={{ scale: 1, rotate: 0, y: 0 }}
              exit={{ scale: 0.7, opacity: 0 }}
              transition={{ type: "spring", stiffness: 240, damping: 16 }}
              className="rounded-[2rem] border-[4px] border-leo-sun-deep bg-white/95 px-10 py-6 text-center shadow-[0_14px_0_rgba(214,178,110,0.5)]"
            >
              <div className="flex justify-center">
                <Leo mood="celebrate" size={130} />
              </div>
              <div className="mt-1 font-display text-4xl font-bold">
                <span className="bg-gradient-to-r from-leo-sun via-leo-berry to-leo-grape bg-clip-text text-transparent">
                  PLAYER LEVEL {show}!
                </span>
              </div>
              <div className="mt-1 font-display text-sm font-semibold text-leo-ink-soft">
                Your brain is growing. Keep roaring!
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
