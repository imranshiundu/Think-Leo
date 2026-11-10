"use client";

/**
 * Think Leo — the LAPTOP-ONLY gate
 * ────────────────────────────────
 * Phones and tablets never see the game. Ever. They see this friendly
 * screen instead (rule + rationale in docs/ALGORITHM.md §9).
 */

import { Leo } from "@/components/leo/Leo";
import { Sticker } from "@/components/leo/stickers";
import { motion } from "framer-motion";
import { Brain, Flame, Laptop, MonitorSmartphone, Trophy, Volume2 } from "lucide-react";

export function PhoneGate({
  onRetry,
  deviceLine,
}: {
  onRetry: () => void;
  deviceLine: string;
}) {
  return (
    <div className="leo-bg fixed inset-0 z-[95] flex flex-col items-center justify-center overflow-y-auto px-6 py-10">
      <div className="flex w-full max-w-md flex-col items-center text-center">
        {/* laptop illustration with Leo inside */}
        <motion.div
          initial={{ scale: 0.7, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 170, damping: 16 }}
          className="anim-float relative"
        >
          <div className="mx-auto w-[290px] rounded-t-2xl border-[6px] border-b-0 border-[#8a6a4f] bg-gradient-to-b from-[#fff7e6] to-[#ffedda] p-3 shadow-[0_10px_0_-2px_rgba(93,74,55,0.35)]">
            <Leo mood="thinking" size={150} bubble="See you on the big screen!" />
          </div>
          <div className="mx-auto h-4 w-[360px] rounded-b-2xl border-[5px] border-t-[3px] border-[#8a6a4f] bg-[#a5846a]" />
        </motion.div>

        <motion.h1
          className="mt-7 font-display text-3xl font-bold leading-tight text-leo-ink"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          Think Leo lives on{" "}
          <span className="bg-gradient-to-r from-leo-sun-deep to-leo-berry bg-clip-text text-transparent">
            big screens!
          </span>
        </motion.h1>

        <motion.p
          className="mt-3 max-w-sm text-[15px] leading-relaxed text-leo-ink-soft"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          This brain gym is built for <b className="text-leo-ink">laptops and desktops</b> —
          big puzzles, big sounds, big roars. Grab a laptop, open{" "}
          <b className="text-leo-ink">Think Leo</b> there, and Leo will be waiting with a
          fresh quest!
        </motion.p>

        {/* proof we know exactly which device this is */}
        {deviceLine && (
          <motion.div
            className="pill mt-4 gap-2 px-4 py-2 text-sm"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <MonitorSmartphone width={16} height={16} className="shrink-0 text-leo-teal-deep" />
            <span className="text-leo-ink">
              We spotted: <b className="font-display">{deviceLine}</b>
            </span>
          </motion.div>
        )}

        <motion.div
          className="mt-5 flex flex-wrap justify-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55 }}
        >
          {[
            { icon: <Brain width={15} height={15} className="text-leo-grape" />, t: "Brain quests" },
            { icon: <Flame width={15} height={15} className="text-leo-sun-deep" />, t: "Daily streaks" },
            { icon: <Trophy width={15} height={15} className="text-leo-teal-deep" />, t: "Star levels" },
            { icon: <Volume2 width={15} height={15} className="text-leo-berry-deep" />, t: "Combo sounds" },
          ].map(({ icon, t }) => (
            <span key={t} className="pill px-3 py-1.5 text-sm text-leo-ink">
              {icon} {t}
            </span>
          ))}
        </motion.div>

        <motion.button
          type="button"
          onClick={onRetry}
          className="pill mt-6 cursor-pointer px-4 py-2 text-sm text-leo-ink hover:bg-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          <Laptop width={15} height={15} /> Wait — I <i>am</i> on a laptop. Let me in!
        </motion.button>

        <p className="mt-4 text-xs text-leo-ink-soft/80">
          Think Leo is a PWA — you can install it, but the game itself only runs on
          laptops &amp; desktops.
        </p>

        {/* a friendly sticker parade so even the gate feels alive */}
        <motion.div
          className="mt-6 flex items-center gap-2 opacity-80"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.8 }}
          transition={{ delay: 0.9 }}
        >
          <Sticker id="monkey" size={30} />
          <Sticker id="fish" size={30} />
          <Sticker id="rocket" size={30} />
          <Sticker id="cupcake" size={30} />
        </motion.div>
      </div>
    </div>
  );
}
