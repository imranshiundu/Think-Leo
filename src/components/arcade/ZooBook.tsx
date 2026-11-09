"use client";

/**
 * Think Leo — Zoo Book (the Leo Pop collection)
 * ─────────────────────────────
 * The completion-drive engine: eleven creatures, discovered ones in full
 * colour with a fuse counter, undiscovered ones as dark silhouettes that
 * literally say "???". Filling the book is the long-game hook of the
 * arcade (docs/ALGORITHM.md §14.7). Golden Leo is the secret bonus row.
 */

import { Sticker } from "@/components/leo/stickers";
import { GOLDEN_TIER, LEO_NAMES, POP_CHAIN, ZOO_TARGET } from "@/lib/arcade";
import { useLeo } from "@/lib/store";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Crown, Sparkles, X } from "lucide-react";

export function ZooBook({ open, onClose }: { open: boolean; onClose: () => void }) {
  const disc = useLeo((s) => s.mergeDiscoveries);
  const found = Object.keys(disc).filter((k) => Number(k) < ZOO_TARGET).length;
  const golden = (disc[GOLDEN_TIER] ?? 0) > 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="zoo"
          className="fixed inset-0 z-[90] flex items-end justify-center bg-leo-ink/45 p-3 backdrop-blur-[2px] sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="leo-card max-h-[88vh] w-full max-w-md overflow-y-auto p-5 leo-scroll"
            initial={{ y: 60, scale: 0.96, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 40, scale: 0.97, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Zoo Book"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border-[2.5px] border-leo-sun bg-gradient-to-b from-leo-honey to-leo-sun text-white">
                <BookOpen width={20} height={20} />
              </span>
              <div className="flex-1">
                <h2 className="font-display text-xl font-bold leading-none text-leo-ink">Zoo Book</h2>
                <p className="text-[11px] text-leo-ink-soft">Merge two of a kind to meet the next friend</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close the Zoo Book"
                className="pill cursor-pointer px-2 py-1.5 hover:bg-leo-cream"
              >
                <X width={16} height={16} className="text-leo-ink" />
              </button>
            </div>

            {/* progress */}
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-[11px] font-bold text-leo-ink-soft">
                <span>{found} / {ZOO_TARGET} discovered</span>
                {found >= ZOO_TARGET && (
                  <span className="flex items-center gap-1 text-leo-sun-deep">
                    <Sparkles width={12} height={12} /> Zoo complete!
                  </span>
                )}
              </div>
              <div className="h-3 overflow-hidden rounded-full border-2 border-leo-line bg-leo-cream">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-leo-sun to-leo-berry"
                  initial={false}
                  animate={{ width: `${Math.round((found / ZOO_TARGET) * 100)}%` }}
                  transition={{ type: "spring", stiffness: 90, damping: 20 }}
                />
              </div>
            </div>

            {/* the chain, small → huge */}
            <div className="mt-4 grid grid-cols-3 gap-2.5">
              {POP_CHAIN.map((c) => {
                const count = disc[c.tier] ?? 0;
                const got = count > 0;
                return (
                  <motion.div
                    key={c.tier}
                    whileHover={{ y: -3 }}
                    className={`flex flex-col items-center gap-1 rounded-2xl border-[2.5px] p-2 text-center ${
                      got ? "border-leo-sun bg-white" : "border-leo-line bg-white/60"
                    } ${c.tier === 10 ? "col-span-3" : ""}`}
                    style={c.tier === 10 ? { background: "linear-gradient(120deg,#fff3c4,#ffe9f1)" } : undefined}
                  >
                    <span
                      className={`flex items-center justify-center rounded-full ${got ? "" : "opacity-90"}`}
                      style={{
                        width: c.tier === 10 ? 56 : 52,
                        height: c.tier === 10 ? 56 : 52,
                        background: got ? `radial-gradient(circle at 32% 28%, #ffffff 8%, ${c.bg} 70%)` : "#f3ead6",
                        border: `3px solid ${got ? c.edge : "#e2d4b4"}`,
                      }}
                    >
                      <span style={got ? undefined : { filter: "brightness(0) opacity(0.28)" }}>
                        <Sticker id={c.id} size={c.tier === 10 ? 40 : 38} />
                      </span>
                    </span>
                    <span className={`font-display text-[11px] font-bold leading-tight ${got ? "text-leo-ink" : "text-leo-ink-soft"}`}>
                      {got ? c.name : "???"}
                    </span>
                    {c.tier === 10 ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-leo-sun-deep">
                        <Crown width={11} height={11} />
                        {got ? `Found! Fused ×${count}` : "Fuse two LEOs to find the secret"}
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-leo-ink-soft">
                        {got ? `Fused ×${count}` : "Not yet met"}
                      </span>
                    )}
                  </motion.div>
                );
              })}
            </div>

            <p className="mt-4 rounded-2xl bg-leo-cream p-3 text-[11px] leading-relaxed text-leo-ink-soft">
              <b className="font-display text-leo-ink">{LEO_NAMES[9]}</b> is the king of the jar —
              and two LEOs fuse into a friend no one expects. Keep popping!
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
