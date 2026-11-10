"use client";

/**
 * Think Leo — Parent HQ (v8)
 * ───────────────────────────
 * The grown-up side of the door. Kids own the game; this room belongs to the
 * adult who holds the phone — so its ENTRANCE is gated: the grown-up must
 * PRESS AND HOLD the paw for ~2.5 s (a 4-year-old taps; holding is hard).
 *
 * Three jobs, zero jargon:
 *  1. TODAY — minutes played against the family window, XP, streak, levels.
 *  2. SKILLS — per-puzzle mastery bars from the Flow Ranger data
 *     (`skillStats`), so a parent sees "counting: strong, tables: wobbly".
 *  3. CONTROLS — the daily play window (nap screen when it runs out),
 *     grown-up extensions, sound toggles, and a hold-gated reset.
 */

import { Leo } from "@/components/leo/Leo";
import { sfx } from "@/lib/sound";
import { useLeo } from "@/lib/store";
import { AnimatePresence, motion } from "framer-motion";
import { RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/* ── skill labels (matches questions.ts QKind) ─────────────────── */
const SKILL_LABELS: Record<string, string> = {
  count: "Counting",
  addsub: "Add & subtract",
  compare: "More or less",
  oddOne: "Odd one out",
  sequence: "What comes next",
  truefalse: "True or trap",
  multiply: "Times tables",
  memory: "Memory",
  tapTarget: "Tap & scan",
  shadow: "Shadow match",
  feedLeo: "Feed Leo (counting)",
};

const CAP_OPTIONS = [15, 30, 60, 0]; // 0 = open-ended (a conscious family choice)

/* ── the hold-to-confirm paw button (the parent gate) ──────────── */
export function HoldButton({
  label,
  hint,
  seconds = 2.5,
  onDone,
  className = "",
}: {
  label: string;
  hint?: string;
  seconds?: number;
  onDone: () => void;
  className?: string;
}) {
  const [progress, setProgress] = useState(0); // 0..1
  const raf = useRef<number>(0);
  const holding = useRef(false);
  const last = useRef(0);

  const tick = (t: number) => {
    if (!holding.current) return;
    const dt = (t - last.current) / 1000;
    last.current = t;
    setProgress((p) => {
      const np = Math.min(1, p + dt / seconds);
      if (np >= 1) {
        holding.current = false;
        sfx.click();
        onDone();
        return 0;
      }
      raf.current = requestAnimationFrame(tick);
      return np;
    });
  };

  const start = () => {
    holding.current = true;
    last.current = performance.now();
    raf.current = requestAnimationFrame(tick);
  };
  const stop = () => {
    holding.current = false;
    cancelAnimationFrame(raf.current);
    setProgress(0);
  };
  useEffect(() => () => stop(), []);

  return (
    <button
      type="button"
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={label}
      className={`relative cursor-pointer select-none overflow-hidden rounded-2xl border-[3px] border-leo-line bg-white px-5 py-3 font-display text-sm font-bold text-leo-ink shadow-[0_5px_0_rgba(214,178,110,0.35)] ${className}`}
    >
      <span
        className="absolute inset-y-0 left-0 bg-leo-sun/40 transition-none"
        style={{ width: `${progress * 100}%` }}
        aria-hidden
      />
      <span className="relative">{label}</span>
      {hint && <span className="relative block text-[10px] font-semibold text-leo-ink-soft">{hint}</span>}
    </button>
  );
}

/* ── Parent HQ modal ───────────────────────────────────────────── */
export function ParentHQ({ open, onClose }: { open: boolean; onClose: () => void }) {
  const save = useLeo();
  const [confirmReset, setConfirmReset] = useState(false);
  if (!open) return null;

  const minutes = save.playMinutesToday();
  const cap = save.dailyCapMin;
  const capLabel = cap === 0 ? "Open-ended" : `${cap} min a day`;
  const skills = Object.entries(save.skillStats).filter(([, s]) => s.n > 0);
  const todayXp = save.todayXp;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
        className="leo-scroll max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl border-[3px] border-white bg-[#fffaf0] p-5 shadow-2xl sm:rounded-3xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl font-black text-leo-ink">Parent HQ</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Parent HQ"
            className="pill cursor-pointer p-2"
          >
            <X width={18} height={18} />
          </button>
        </div>

        {/* 1 — TODAY */}
        <div className="mb-5 rounded-2xl border-[3px] border-leo-line bg-white p-4">
          <div className="mb-2 font-display text-sm font-black uppercase tracking-wide text-leo-ink-soft">
            Today
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Stat
              big={`${minutes} min`}
              small={cap === 0 ? "played today" : `of the ${capLabel} window`}
            />
            <Stat big={`${todayXp} XP`} small="earned today" />
            <Stat big={`${save.streak} day${save.streak === 1 ? "" : "s"}`} small="current streak" />
            <Stat big={`${save.runs}`} small="levels finished, all time" />
          </div>
          {/* the window meter */}
          {cap > 0 && (
            <div className="mt-3">
              <div className="h-3 w-full overflow-hidden rounded-full bg-leo-sand">
                <div
                  className={`h-full rounded-full ${minutes >= cap ? "bg-leo-berry" : "bg-leo-leaf"}`}
                  style={{ width: `${Math.min(100, (minutes / cap) * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] font-semibold text-leo-ink-soft">
                {minutes >= cap
                  ? "Window used — Leo is resting until tomorrow (or extend below)."
                  : `${Math.max(0, cap - minutes)} min left in today's window.`}
              </p>
            </div>
          )}
        </div>

        {/* 2 — SKILLS */}
        <div className="mb-5 rounded-2xl border-[3px] border-leo-line bg-white p-4">
          <div className="mb-2 font-display text-sm font-black uppercase tracking-wide text-leo-ink-soft">
            Skills so far
          </div>
          {skills.length === 0 ? (
            <p className="text-sm text-leo-ink-soft">
              Play a level and each puzzle type will report how it's going.
            </p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {skills
                .sort((a, b) => b[1].ok / b[1].n - a[1].ok / a[1].n)
                .map(([kind, s]) => {
                  const pct = Math.round((s.ok / s.n) * 100);
                  return (
                    <div key={kind}>
                      <div className="mb-0.5 flex items-baseline justify-between">
                        <span className="font-display text-sm font-bold text-leo-ink">
                          {SKILL_LABELS[kind] ?? kind}
                        </span>
                        <span className="text-[11px] font-semibold text-leo-ink-soft">
                          {pct}% · {s.n} tried
                        </span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-leo-sand">
                        <div
                          className={`h-full rounded-full ${pct >= 70 ? "bg-leo-leaf" : pct >= 40 ? "bg-leo-sun" : "bg-leo-berry"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
          <p className="mt-2 text-[11px] text-leo-ink-soft">
            The difficulty (Flow Ranger) already breathes with these numbers — green
            skills get braver, berry skills get gentler.
          </p>
        </div>

        {/* 3 — CONTROLS */}
        <div className="mb-4 rounded-2xl border-[3px] border-leo-line bg-white p-4">
          <div className="mb-2 font-display text-sm font-black uppercase tracking-wide text-leo-ink-soft">
            Daily play window
          </div>
          <div className="grid grid-cols-4 gap-2">
            {CAP_OPTIONS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  sfx.click();
                  save.setDailyCap(c);
                }}
                aria-label={c === 0 ? "Open-ended play window" : `${c} minutes per day`}
                className={`cursor-pointer rounded-xl border-[3px] px-1 py-2 font-display text-sm font-bold ${
                  save.dailyCapMin === c
                    ? "border-leo-leaf-deep bg-[#e9ffcf] text-leo-leaf-deep"
                    : "border-leo-line bg-white text-leo-ink"
                }`}
              >
                {c === 0 ? "Open" : `${c}m`}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-leo-ink-soft">
            When the window is used up, Leo takes a nap and the game rests. A new day
            refills it. Extensions below are for today only.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <HoldButton
              label="Add 15 minutes today"
              hint="press and hold"
              onDone={() => save.extendPlay(15)}
            />
            <button
              type="button"
              onClick={() => {
                save.toggleSfx();
                sfx.click();
              }}
              className="cursor-pointer rounded-2xl border-[3px] border-leo-line bg-white px-4 py-3 font-display text-sm font-bold text-leo-ink"
            >
              Sound: {save.soundSfx ? "on" : "off"}
            </button>
            <button
              type="button"
              onClick={() => {
                save.toggleMusic();
                sfx.click();
              }}
              className="cursor-pointer rounded-2xl border-[3px] border-leo-line bg-white px-4 py-3 font-display text-sm font-bold text-leo-ink"
            >
              Music: {save.soundMusic ? "on" : "off"}
            </button>
          </div>
        </div>

        {/* danger zone — double-gated */}
        <div className="rounded-2xl border-[3px] border-dashed border-leo-line bg-white/60 p-4">
          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="mx-auto flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-leo-ink-soft hover:bg-leo-sand"
            >
              <RotateCcw width={14} height={14} /> Start over from Level 1
            </button>
          ) : (
            <div className="text-center">
              <p className="mb-2 text-xs font-bold text-leo-ink">
                This erases every star, streak and friend. Really?
              </p>
              <HoldButton
                label="Hold to erase everything"
                hint="press and hold 3 seconds"
                seconds={3}
                className="mx-auto"
                onDone={() => {
                  save.reset();
                  setConfirmReset(false);
                  onClose();
                }}
              />
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-[10px] leading-relaxed text-leo-ink-soft">
          Everything stays on this device. No accounts, no ads, no chat, no purchases.
        </p>
      </motion.div>
    </motion.div>
  );
}

function Stat({ big, small }: { big: string; small: string }) {
  return (
    <div className="rounded-xl bg-leo-sand/70 px-3 py-2">
      <div className="font-display text-lg font-black text-leo-ink">{big}</div>
      <div className="text-[11px] font-semibold text-leo-ink-soft">{small}</div>
    </div>
  );
}

/* ── Nap screen: the window is used up ────────────────────────── */
export function NapScreen({ onExtend }: { onExtend: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-[#2b2440f2] px-6 text-center"
    >
      <div className="anim-float">
        <Leo mood="sleep" size={130} />
      </div>
      <h2 className="mt-4 font-display text-3xl font-black text-white">Leo is napping</h2>
      <p className="mt-2 max-w-xs font-display text-sm font-semibold text-white/80">
        Today's thinking time is used up. Rest those eyes — Leo saves every star and
        will be right here tomorrow, ready for more.
      </p>
      <div className="mt-6 rounded-2xl bg-white/10 px-4 py-3">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-white/60">
          Grown-ups only
        </p>
        <HoldButton
          label="Add 15 more minutes today"
          hint="press and hold"
          onDone={onExtend}
          className="!bg-white"
        />
      </div>
      <p className="mt-6 text-[10px] text-white/40">
        The daily window lives in Parent HQ on the home screen.
      </p>
    </motion.div>
  );
}

/* convenience: how long until the window resets (for later use) */
export function minutesLeftInWindow(): number {
  const s = useLeo.getState();
  if (s.dailyCapMin === 0) return Infinity;
  return Math.max(0, s.dailyCapMin + s.playToday.bonus / 60000 - s.playMinutesToday());
}
