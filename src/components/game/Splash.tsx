"use client";

/**
 * Think Leo — Startup animation
 * ─────────────────────────────
 * Leo roars in from below (with an actual synthesized roar), the wordmark
 * pops letter by letter, a star burst fires, sticker confetti drifts,
 * then the curtain lifts. Tap anywhere to skip. Only plays in full once
 * per browser session (see ThinkLeo root).
 */

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Leo } from "@/components/leo/Leo";
import { StarPop } from "@/components/leo/badges";
import { Sticker, type StickerId } from "@/components/leo/stickers";
import { sfx } from "@/lib/sound";

const WORD = "Think Leo!";
const DRIFTERS: StickerId[] = ["star", "lollipop", "rocket", "fish", "butterfly", "candy"];

export function Splash({ quick = false, onDone }: { quick?: boolean; onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (quick) {
      sfx.pop();
      const t = window.setTimeout(onDone, 750);
      return () => window.clearTimeout(t);
    }
    sfx.unlock(); // polite try — may be blocked before first gesture, that's fine
    sfx.whoosh();
    sfx.roar();
    const fan = window.setTimeout(() => sfx.fanfare(), 950);
    const out = window.setTimeout(() => setLeaving(true), 2500);
    const done = window.setTimeout(onDone, 3150);
    return () => {
      window.clearTimeout(fan);
      window.clearTimeout(out);
      window.clearTimeout(done);
    };
  }, [quick, onDone]);

  return (
    <motion.div
      className="leo-bg fixed inset-0 z-[90] flex cursor-pointer flex-col items-center justify-center overflow-hidden"
      initial={{ y: 0 }}
      animate={leaving ? { y: "-102%" } : { y: 0 }}
      transition={leaving ? { duration: 0.62, ease: [0.7, 0, 0.3, 1] } : {}}
      onClick={() => setLeaving(true)}
      role="button"
      aria-label="Think Leo is starting — tap to skip"
    >
      {/* drifting sticker confetti */}
      {DRIFTERS.map((id, i) => (
        <span
          key={id}
          className="anim-drift pointer-events-none absolute select-none opacity-60"
          style={{
            left: `${8 + i * 15}%`,
            top: `${12 + ((i * 23) % 70)}%`,
            animationDelay: `${i * 0.7}s`,
          }}
        >
          <Sticker id={id} size={40} />
        </span>
      ))}

      {quick ? (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
          <SplashMark />
        </motion.div>
      ) : (
        <>
          <motion.div
            initial={{ y: 260, scale: 0.4, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 160, damping: 15, delay: 0.15 }}
          >
            <Leo mood="excited" size={190} />
          </motion.div>

          <div className="relative mt-1 flex items-baseline">
            {WORD.split("").map((ch, i) => (
              <motion.span
                key={i}
                className="font-display text-6xl font-bold text-leo-ink"
                initial={{ scale: 0, y: 30, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                transition={{ delay: 0.65 + i * 0.07, type: "spring", stiffness: 420, damping: 17 }}
              >
                {ch === " " ? "\u00A0" : ch === "L" ? (
                  <span className="bg-gradient-to-r from-leo-sun via-leo-berry to-leo-grape bg-clip-text text-transparent">Leo!</span>
                ) : (
                  ch
                )}
              </motion.span>
            ))}
            {/* star burst at wordmark landing */}
            <motion.span
              className="absolute -right-9 -top-4"
              initial={{ scale: 0, rotate: -120 }}
              animate={{ scale: [0, 1.4, 1], rotate: 0 }}
              transition={{ delay: 1.15, duration: 0.5 }}
            >
              <StarPop size={34} />
            </motion.span>
          </div>

          <motion.p
            className="mt-3 font-display text-base font-medium text-leo-ink-soft"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.5 }}
          >
            Big brain adventures for little legends
          </motion.p>

          <motion.div
            className="absolute bottom-8 flex gap-1.5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.8 }}
          >
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="h-2.5 w-2.5 rounded-full bg-leo-sun"
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
              />
            ))}
          </motion.div>
        </>
      )}
    </motion.div>
  );
}

function SplashMark() {
  return (
    <div className="flex items-center gap-3">
      <Leo mood="happy" size={90} />
      <div className="font-display text-4xl font-bold">
        <span className="text-leo-ink">Think </span>
        <span className="bg-gradient-to-r from-leo-sun via-leo-berry to-leo-grape bg-clip-text text-transparent">
          Leo!
        </span>
      </div>
    </div>
  );
}
