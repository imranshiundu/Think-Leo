"use client";

/**
 * Think Leo — the FRIENDS ALBUM (Leo Eggs collection book)
 * ────────────────────────────────────────────────────────
 * Collection completion is the quiet engine of the egg game: every
 * undiscovered slot shows a DARK SILHOUETTE with its rarity chip, so
 * kids can see exactly what they are missing — including the legendary
 * cub and the mythic star that "fell out of the night sky".
 * Undiscovered slots nag. That is the point (docs/ALGORITHM.md §15).
 */

import { COLLECTION_TARGET, CRITTERS, RARITY_ORDER, RARITY_META, GROW_COPIES, GROW_SPEND } from "@/lib/eggs";
import { ChunkyButton } from "@/components/game/bits";
import { sfx } from "@/lib/sound";
import { useEggCollection, useLeo } from "@/lib/store";
import { AnimatePresence, motion } from "framer-motion";
import { Crown, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { Sticker } from "@/components/leo/stickers";

export function EggAlbum() {
  const { found, bag } = useEggCollection();
  const [openUid, setOpenUid] = useState<string | null>(null);

  const ordered = [...CRITTERS].sort(
    (a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity) || a.name.localeCompare(b.name)
  );

  return (
    <div className="mt-3">
      <div className="leo-card flex items-center gap-3 p-4">
        <div className="flex-1">
          <h2 className="font-display text-lg font-bold text-leo-ink">Friends Album</h2>
          <p className="text-xs text-leo-ink-soft">
            {found === COLLECTION_TARGET
              ? "EVERY friend discovered — the nest is complete!"
              : `${found} of ${COLLECTION_TARGET} friends discovered`}
          </p>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-leo-sand">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${(found / COLLECTION_TARGET) * 100}%`,
                background: "linear-gradient(90deg,#2ec4b6,#9b5de5,#ff5a8c)",
              }}
            />
          </div>
        </div>
        <Sparkles width={34} height={34} className="shrink-0 text-leo-sun" />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {ordered.map((c) => {
          const entry = bag[c.uid];
          const known = !!entry;
          const meta = RARITY_META[c.rarity];
          return (
            <motion.button
              key={c.uid}
              type="button"
              whileTap={{ scale: 0.94 }}
              onClick={() => {
                sfx.pop();
                setOpenUid(c.uid);
              }}
              className="leo-card relative flex flex-col items-center gap-1 p-2.5 text-center"
              style={{ background: known ? meta.soft : undefined }}
              aria-label={known ? `${c.name} the ${c.species}` : "Unknown friend"}
            >
              {known && entry.evolved && (
                <Crown width={14} height={14} className="absolute right-1.5 top-1.5 text-leo-sun-deep" fill="#FFD75E" />
              )}
              <span style={known ? undefined : { filter: "brightness(0) opacity(0.32)" }}>
                <Sticker id={c.id} size={44} />
              </span>
              <span className={`font-display text-[11px] font-bold ${known ? "text-leo-ink" : "text-leo-ink-soft"}`}>
                {known ? c.name : "???"}
              </span>
              <span
                className="rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white"
                style={{ background: meta.color }}
              >
                {c.rarity}
              </span>
              {known && entry.count > 1 && (
                <span className="absolute bottom-1 right-1.5 font-display text-[9px] font-bold text-leo-ink-soft">
                  ×{entry.count}
                </span>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* detail sheet */}
      <AnimatePresence>
        {openUid && <AlbumSheet uid={openUid} onClose={() => setOpenUid(null)} />}
      </AnimatePresence>
    </div>
  );
}

function AlbumSheet({ uid, onClose }: { uid: string; onClose: () => void }) {
  const bag = useLeo((s) => s.eggBag);
  const entry = bag[uid];
  const critter = CRITTERS.find((c) => c.uid === uid);
  if (!critter || !entry) return null;
  const meta = RARITY_META[critter.rarity];
  const canGrow = !entry.evolved && entry.count >= GROW_COPIES;

  const grow = () => {
    const s = useLeo.getState();
    if (s.evolveCritter(uid)) {
      sfx.fanfare();
      sfx.pop();
    } else {
      sfx.lockClick();
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-[80] flex items-end justify-center px-4 pb-6 sm:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <div className="absolute inset-0" style={{ background: "rgba(38,20,48,0.5)", backdropFilter: "blur(3px)" }} />
      <motion.div
        className="relative w-full max-w-sm rounded-[28px] border-[4px] bg-white p-5 text-center"
        style={{ borderColor: meta.color }}
        initial={{ y: 80, scale: 0.9, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: "spring", stiffness: 280, damping: 24 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-leo-sand text-leo-ink"
        >
          <X width={16} height={16} />
        </button>
        <div className={entry.evolved ? "rounded-3xl border-[3px] border-leo-sun bg-gradient-to-b from-white to-[#fff3c4] p-2" : "p-2"}>
          <span className="inline-block anim-bob">
            <Sticker id={critter.id} size={96} />
          </span>
        </div>
        <h3 className="mt-1 font-display text-xl font-bold text-leo-ink">
          {critter.name} the {critter.species}
        </h3>
        <span
          className="mt-1 inline-block rounded-full px-3 py-0.5 font-display text-xs font-bold uppercase tracking-wide text-white"
          style={{ background: meta.color }}
        >
          {meta.label}
        </span>
        <p className="mt-2 text-sm text-leo-ink-soft">{critter.home}</p>
        <div className="mt-2 flex items-center justify-center gap-2 text-xs font-semibold text-leo-ink-soft">
          <span>Hatched ×{entry.count}</span>
          {entry.evolved && (
            <span className="pill px-2 py-0.5 text-[11px] font-bold text-leo-sun-deep">
              <Crown width={11} height={11} className="mr-0.5 inline fill-leo-sun text-leo-sun-deep" />
              Stage 2 — all grown up!
            </span>
          )}
        </div>
        {canGrow ? (
          <div className="mt-4">
            <ChunkyButton color="berry" size="lg" onClick={grow} ariaLabel="Grow this friend to Stage 2">
              <span className="inline-flex items-center gap-1.5">
                <Crown width={16} height={16} />
                GROW to Stage 2 (feed {GROW_SPEND} extra)
              </span>
            </ChunkyButton>
          </div>
        ) : !entry.evolved ? (
          <p className="mt-4 rounded-2xl bg-leo-sand px-3 py-2 text-xs font-semibold text-leo-ink-soft">
            Hatch <b className="text-leo-ink">{Math.max(0, GROW_COPIES - entry.count)}</b> more{" "}
            {critter.name}s to grow it to Stage 2
          </p>
        ) : null}
      </motion.div>
    </motion.div>
  );
}
