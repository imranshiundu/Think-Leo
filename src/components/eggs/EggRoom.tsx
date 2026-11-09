"use client";

/**
 * Think Leo — LEO'S ROOM (the egg game care surface)
 * ──────────────────────────────────────────────────
 * The INVESTMENT phase made physical: every friend a kid has hatched
 * lives here, bobbing on the shelf. Tap a friend and it hops, purrs
 * and bursts little hearts — a 3-second ritual that builds ownership
 * ("MY room, MY friends"). Stage 2 friends wear the golden frame.
 * Empty rooms invite back to the nest. Docs: ALGORITHM.md §15.
 */

import { CRITTERS_BY_UID, GROW_COPIES, RARITY_META, type EggCritter } from "@/lib/eggs";
import { buzz } from "@/lib/arcade";
import { pick } from "@/lib/game";
import { sfx } from "@/lib/sound";
import { useEggCollection } from "@/lib/store";
import { AnimatePresence, motion } from "framer-motion";
import { Crown, Egg, Heart } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Sticker } from "@/components/leo/stickers";
import { Leo } from "@/components/leo/Leo";

interface Floater {
  id: number;
  x: number; // px offset from the card center
}

const PET_LINES = [
  "Purr… that is the spot!",
  "Boing! Again, again!",
  "Happy wiggles activated!",
  "Best friend detected!",
];

export function EggRoom() {
  const { bag } = useEggCollection();
  const owned = Object.entries(bag);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [hopped, setHopped] = useState<string | null>(null);
  const [line, setLine] = useState<string | null>(null);
  const nextId = useRef(1);

  const pet = useCallback((uid: string) => {
    const id = nextId.current++;
    setFloaters((f) => [...f.slice(-14), { id, x: Math.round((Math.random() - 0.5) * 90) }]);
    setHopped(uid);
    setLine(pick(PET_LINES));
    window.setTimeout(() => setFloaters((f) => f.filter((x) => x.id !== id)), 950);
    window.setTimeout(() => setHopped((h) => (h === uid ? null : h)), 620);
    sfx.boing();
    window.setTimeout(() => sfx.munch(), 140);
    buzz(14);
  }, []);

  if (owned.length === 0) {
    return (
      <div className="mt-3">
        <div className="leo-card flex flex-col items-center gap-2 p-6 text-center">
          <Leo mood="sad" size={110} bubble="The room is empty… for now!" />
          <p className="text-sm leading-relaxed text-leo-ink-soft">
            Every egg you crack brings a friend to live in this room. Go say hello to the nest!
          </p>
          <span className="pill mt-1 gap-1 px-3 py-1 font-display text-xs font-bold text-leo-ink">
            <Egg width={13} height={13} className="text-leo-sun-deep" /> crack an egg to begin
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <div className="leo-card flex items-center justify-between gap-2 p-4">
        <div>
          <h2 className="font-display text-lg font-bold text-leo-ink">Leo&apos;s Room</h2>
          <p className="text-xs text-leo-ink-soft">
            {owned.length} friend{owned.length === 1 ? "" : "s"} live here — tap them!
          </p>
        </div>
        <Heart width={26} height={26} className="fill-leo-berry/20 text-leo-berry" />
      </div>

      <div className="relative mt-3 grid grid-cols-3 gap-2">
        {/* floating hearts from petting */}
        <div className="pointer-events-none absolute inset-0 z-10">
          <AnimatePresence>
            {floaters.map((f) => (
              <motion.span
                key={f.id}
                initial={{ opacity: 0, y: 0, scale: 0.5 }}
                animate={{ opacity: [0, 1, 1, 0], y: -64, scale: [0.6, 1.1, 1, 0.8] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.9, ease: "easeOut" }}
                className="absolute bottom-1/2 left-1/2"
                style={{ marginLeft: f.x }}
              >
                <Heart width={20} height={20} className="fill-leo-berry text-leo-berry" />
              </motion.span>
            ))}
          </AnimatePresence>
        </div>

        {owned.map(([uid, entry], i) => {
          const meta = RARITY_META[(critterOf(uid)?.rarity ?? "common") as keyof typeof RARITY_META];
          return (
            <motion.button
              key={uid}
              type="button"
              onClick={() => pet(uid)}
              animate={hopped === uid ? { y: [0, -14, 0], rotate: [0, -6, 6, 0] } : { y: [0, -4, 0] }}
              transition={
                hopped === uid
                  ? { duration: 0.5 }
                  : { duration: 2.2 + (i % 3) * 0.4, repeat: Infinity, ease: "easeInOut", delay: i * 0.25 }
              }
              whileTap={{ scale: 0.92 }}
              className={`leo-card relative flex flex-col items-center gap-1 p-2.5 text-center ${
                entry.evolved ? "border-leo-sun bg-gradient-to-b from-white to-[#fff3c4]" : ""
              }`}
              style={{ background: entry.evolved ? undefined : meta.soft }}
              aria-label={`Pet ${critterOf(uid)?.name ?? "friend"}`}
            >
              {entry.evolved && (
                <Crown width={14} height={14} className="absolute right-1.5 top-1.5 text-leo-sun-deep" fill="#FFD75E" />
              )}
              <Sticker id={(critterOf(uid)?.id ?? "bee") as never} size={46} />
              <span className="font-display text-[11px] font-bold text-leo-ink">
                {critterOf(uid)?.name ?? uid}
              </span>
              {entry.count > 1 && (
                <span className="absolute bottom-1 right-1.5 font-display text-[9px] font-bold text-leo-ink-soft">
                  ×{entry.count}
                </span>
              )}
              {!entry.evolved && entry.count >= GROW_COPIES && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border-2 border-leo-sun bg-white px-1.5 py-0.5 font-display text-[8px] font-bold text-leo-sun-deep">
                  CAN GROW!
                </span>
              )}
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence>
        {line && (
          <motion.p
            key={line + String(floaters.length)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3 text-center font-display text-sm font-bold text-leo-berry-deep"
          >
            {line}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

/* local lookup — keeps this file independent from the album's sort */
function critterOf(uid: string): EggCritter | undefined {
  return CRITTERS_BY_UID[uid];
}
