"use client";

/**
 * Think Leo — UI kit: the candy-store primitives.
 * Chunky buttons (press-the-edge physics), stars, hearts, streak flame,
 * daily-goal ring, confetti bursts and the shared top bar.
 */

import { AnimatePresence, motion } from "framer-motion";
import { Flame, Heart, Music, Star, Volume2, VolumeX, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DAILY_GOAL_XP } from "@/lib/game";
import { useHearts } from "@/lib/store";

/* ── Chunky 3D button ──────────────────────────────────────────── */

type BtnColor = "leaf" | "sun" | "berry" | "grape" | "teal" | "cocoa";

export function ChunkyButton({
  color = "leaf",
  size = "md",
  className = "",
  children,
  onClick,
  disabled,
  ariaLabel,
}: {
  color?: BtnColor;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const pad =
    size === "xl"
      ? "px-12 py-4 text-2xl"
      : size === "lg"
        ? "px-8 py-3 text-xl"
        : size === "sm"
          ? "px-3 py-1.5 text-sm"
          : "px-5 py-2.5 text-base";
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className={`btn-chunky btn-${color} ${pad} ${className}`}
    >
      {children}
    </button>
  );
}

/* ── Stars ─────────────────────────────────────────────────────── */

export function StarRow({
  n,
  size = 18,
  animate = false,
}: {
  n: number;
  size?: number;
  animate?: boolean;
}) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${n} of 3 stars`}>
      {[0, 1, 2].map((i) => {
        const filled = i < n;
        const StarEl = (
          <Star
            width={size}
            height={size}
            className={filled ? "fill-leo-sun text-leo-sun-deep" : "fill-leo-sand text-leo-line"}
            strokeWidth={2.2}
          />
        );
        return animate ? (
          <motion.div
            key={i}
            initial={{ scale: 0, rotate: -40 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.25 + i * 0.35, type: "spring", stiffness: 300, damping: 12 }}
          >
            {StarEl}
          </motion.div>
        ) : (
          <div key={i}>{StarEl}</div>
        );
      })}
    </div>
  );
}

/* ── Hearts pill (reads the store, ticks regen) ────────────────── */

export function HeartPill({ compact = false }: { compact?: boolean }) {
  const { hearts, max, nextInMin } = useHearts();
  return (
    <div className="pill px-3 py-1" title={hearts < max ? `Next heart in ~${nextInMin} min` : "Hearts full!"}>
      <motion.span
        key={hearts}
        initial={{ scale: hearts < max ? 1.5 : 1 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 14 }}
      >
        <Heart width={16} height={16} className="fill-leo-berry text-leo-berry-deep" />
      </motion.span>
      <span className="text-sm text-leo-ink">
        {hearts}
        <span className="text-leo-ink-soft">/{max}</span>
      </span>
      {!compact && hearts < max && (
        <span className="text-[10px] text-leo-ink-soft">+{nextInMin}m</span>
      )}
    </div>
  );
}

/* ── Streak flame ──────────────────────────────────────────────── */

export function StreakFlame({ streak, size = 16 }: { streak: number; size?: number }) {
  return (
    <div className="pill px-3 py-1" title={`${streak}-day streak`}>
      <span className={streak > 0 ? "anim-flame" : "opacity-40"}>
        <Flame
          width={size}
          height={size}
          className={streak > 0 ? "fill-leo-sun text-leo-sun-deep" : "text-leo-ink-soft"}
        />
      </span>
      <span className="text-sm text-leo-ink">{streak}</span>
    </div>
  );
}

/* ── XP pill ───────────────────────────────────────────────────── */

export function XpPill({ xp }: { xp: number }) {
  return (
    <div className="pill px-3 py-1" title={`${xp} XP earned`}>
      <Zap width={16} height={16} className="fill-leo-sun text-leo-sun-deep" />
      <span className="text-sm text-leo-ink">{xp} XP</span>
    </div>
  );
}

/* ── Daily goal ring ───────────────────────────────────────────── */

export function DailyRing({ value, goal = DAILY_GOAL_XP, size = 92 }: { value: number; goal?: number; size?: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const frac = Math.min(1, value / goal);
  const done = value >= goal;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 92 92" className="-rotate-90">
        <circle cx="46" cy="46" r={r} fill="none" stroke="#F0E0BD" strokeWidth="10" />
        <motion.circle
          cx="46"
          cy="46"
          r={r}
          fill="none"
          stroke={done ? "#58cc02" : "#ffb020"}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          animate={{ strokeDashoffset: c * (1 - frac) }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {done ? (
          <span className="anim-pop text-2xl">🌟</span>
        ) : (
          <>
            <span className="font-display text-lg font-bold leading-none text-leo-ink">{value}</span>
            <span className="text-[10px] text-leo-ink-soft">/ {goal} XP</span>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Confetti burst ────────────────────────────────────────────── */

const CONFETTI_COLORS = ["#ffb020", "#58cc02", "#ff5a8c", "#9b5de5", "#2ec4b6", "#ffc93c"];

export function ConfettiBurst({ fireKey, count = 70 }: { fireKey: number; count?: number }) {
  const [alive, setAlive] = useState(false);
  useEffect(() => {
    if (fireKey <= 0) return;
    // async on/off so the burst mounts just after the trigger render
    const show = window.setTimeout(() => setAlive(true), 16);
    const hide = window.setTimeout(() => setAlive(false), 1950);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, [fireKey]);

  const pieces = useMemoPieces(fireKey, count);

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden>
      <AnimatePresence>
        {alive &&
          pieces.map((p) => (
            <motion.div
              key={`${fireKey}-${p.id}`}
              initial={{ x: p.x0, y: p.y0, rotate: p.rot, opacity: 1 }}
              animate={{ x: p.x0 + p.dx, y: p.y0 + p.drop, rotate: p.rot + p.spin, opacity: [1, 1, 0.9, 0] }}
              exit={{ opacity: 0 }}
              transition={{ duration: p.dur, ease: [0.15, 0.6, 0.7, 1], delay: p.delay }}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: p.w,
                height: p.h,
                borderRadius: p.round ? 99 : 3,
                background: p.color,
              }}
            />
          ))}
      </AnimatePresence>
    </div>
  );
}

function useMemoPieces(fireKey: number, count: number) {
  return useMemo(
    () =>
      Array.from({ length: count }, (_, id) => {
        const w0 = typeof window !== "undefined" ? window.innerWidth : 1200;
        const h0 = typeof window !== "undefined" ? window.innerHeight : 800;
        return {
          id,
          x0: Math.random() * w0,
          y0: -30 - Math.random() * 120,
          dx: (Math.random() - 0.5) * 240,
          drop: h0 + 90,
          rot: Math.random() * 360,
          spin: (Math.random() - 0.5) * 720,
          dur: 1.2 + Math.random() * 0.8,
          delay: Math.random() * 0.35,
          w: 7 + Math.random() * 8,
          h: 9 + Math.random() * 10,
          round: Math.random() < 0.4,
          color: CONFETTI_COLORS[id % CONFETTI_COLORS.length],
        };
      }),
    [fireKey, count]
  );
}

/* ── Sound toggles ─────────────────────────────────────────────── */

export function SoundToggles({
  sfxOn,
  musicOn,
  onSfx,
  onMusic,
}: {
  sfxOn: boolean;
  musicOn: boolean;
  onSfx: () => void;
  onMusic: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={onSfx}
        aria-label={sfxOn ? "Turn sound effects off" : "Turn sound effects on"}
        className="pill cursor-pointer px-2.5 py-1.5 hover:bg-leo-cream"
      >
        {sfxOn ? <Volume2 width={15} height={15} className="text-leo-ink" /> : <VolumeX width={15} height={15} className="text-leo-ink-soft" />}
      </button>
      <button
        type="button"
        onClick={onMusic}
        aria-label={musicOn ? "Turn music off" : "Turn music on"}
        className="pill cursor-pointer px-2.5 py-1.5 hover:bg-leo-cream"
      >
        <Music width={15} height={15} className={musicOn ? "text-leo-ink" : "text-leo-ink-soft"} />
      </button>
    </div>
  );
}

/* ── Question progress: little paw prints ──────────────────────── */

export function PawProgress({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1" aria-label={`Question ${current} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-2.5 rounded-full transition-all ${
            i < current ? "w-5 bg-leo-leaf" : i === current ? "w-5 bg-leo-sun" : "w-2.5 bg-leo-line"
          }`}
        />
      ))}
    </div>
  );
}
