"use client";

/**
 * Think Leo — UI kit: the candy-store primitives.
 * Chunky buttons (press-the-edge physics), stars, hearts, streak flame,
 * daily-goal ring, confetti bursts, quest board widgets, achievement
 * toasts and the score count-up. Every glyph is an SVG icon or sticker —
 * never an emoji.
 */

import { AnimatePresence, motion } from "framer-motion";
import {
  Brain,
  Crown,
  Flame,
  Gem,
  Gift,
  Hand,
  Heart,
  Map,
  Medal,
  Music,
  Plus,
  Rocket,
  Scale,
  Search,
  Sparkles,
  Star,
  Target,
  Timer,
  Trophy,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { LeagueBadge, type BadgeId } from "@/components/leo/badges";
import { DAILY_GOAL_XP, leagueOf, playerLevelFromXp, xpToNext, type QuestDef } from "@/lib/game";
import { useHearts, useLeo } from "@/lib/store";

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
      ? "px-10 py-4 text-2xl"
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

/* ── Streak flame + weekly strip ───────────────────────────────── */

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

/** Last-7-day play strip — the streak made visible (§13.4). */
export function StreakStrip({ playDays, streak }: { playDays: string[]; streak: number }) {
  const days = useMemo(() => {
    const out: { key: string; label: string; played: boolean }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      out.push({
        key,
        label: ["S", "M", "T", "W", "T", "F", "S"][d.getDay()],
        played: playDays.includes(key),
      });
    }
    return out;
  }, [playDays]);

  return (
    <div className="flex items-center gap-1.5" aria-label="Your last 7 days">
      {days.map((d, i) => (
        <div key={d.key} className="flex flex-col items-center gap-0.5">
          <motion.span
            initial={false}
            animate={d.played ? { scale: [1, 1.25, 1] } : {}}
            className={`flex h-7 w-7 items-center justify-center rounded-full border-[2.5px] ${
              d.played
                ? i === 6
                  ? "border-leo-sun-deep bg-leo-sun"
                  : "border-leo-leaf-deep bg-leo-leaf"
                : "border-leo-line bg-white"
            }`}
          >
            {d.played ? (
              <Flame width={13} height={13} className="fill-white text-white" />
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-leo-line" />
            )}
          </motion.span>
          <span className="text-[9px] font-bold text-leo-ink-soft">{d.label}</span>
        </div>
      ))}
      <span className="ml-1 hidden font-display text-xs font-semibold text-leo-ink-soft sm:block">
        {streak > 0 ? `${streak}-day streak` : "Start today"}
      </span>
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

/* ── Player-level progress bar ("so close" effect) ─────────────── */

export function LevelProgress({ xp, className = "" }: { xp: number; className?: string }) {
  const info = useMemo(() => {
    const lvl = playerLevelFromXp(xp);
    let rest = xp;
    for (let l = 1; l < lvl; l++) rest -= xpToNext(l);
    const need = xpToNext(lvl);
    return { lvl, rest, need, pct: Math.min(100, Math.round((rest / need) * 100)) };
  }, [xp]);

  return (
    <div className={className}>
      <div className="mb-1 flex items-center justify-between font-display text-[11px] font-semibold text-leo-ink-soft">
        <span>Player level {info.lvl}</span>
        <span>{info.rest} / {info.need} XP</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full border-2 border-leo-line bg-white">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-leo-sun to-leo-leaf"
          initial={false}
          animate={{ width: `${info.pct}%` }}
          transition={{ type: "spring", stiffness: 90, damping: 20 }}
        />
      </div>
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
          <Sparkles width={26} height={26} className="anim-pop fill-leo-sun text-leo-sun-deep" />
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

/* ── Question progress: actual paw prints ──────────────────────── */

export function PawProgress({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`Question ${current + 1} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <svg
          key={i}
          width={i === current ? 22 : 18}
          height={16}
          viewBox="0 0 22 16"
          className={i < current ? "opacity-100" : i === current ? "opacity-100" : "opacity-45"}
        >
          {i < current ? (
            <g fill="#58cc02">
              <ellipse cx="11" cy="10.5" rx="5" ry="4.2" />
              <circle cx="5.4" cy="5.4" r="2" />
              <circle cx="9" cy="3.4" r="2" />
              <circle cx="13" cy="3.4" r="2" />
              <circle cx="16.6" cy="5.4" r="2" />
            </g>
          ) : i === current ? (
            <g fill="#ffb020">
              <ellipse cx="11" cy="10.5" rx="5" ry="4.2" />
              <circle cx="5.4" cy="5.4" r="2" />
              <circle cx="9" cy="3.4" r="2" />
              <circle cx="13" cy="3.4" r="2" />
              <circle cx="16.6" cy="5.4" r="2" />
            </g>
          ) : (
            <g fill="#F0E0BD">
              <ellipse cx="11" cy="10.5" rx="5" ry="4.2" />
              <circle cx="5.4" cy="5.4" r="2" />
              <circle cx="9" cy="3.4" r="2" />
              <circle cx="13" cy="3.4" r="2" />
              <circle cx="16.6" cy="5.4" r="2" />
            </g>
          )}
        </svg>
      ))}
    </div>
  );
}

/* ── Mini-game type icons (used on intro cards & quest art) ────── */

const KIND_ICONS = {
  count: Target,
  addsub: Plus,
  compare: Scale,
  oddOne: Search,
  sequence: PuzzleIcon,
  multiply: X,
  truefalse: Target,
  memory: Music,
} as const;

function PuzzleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M19.4 14a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.01a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.01a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z" />
    </svg>
  );
}

export function KindChip({ icon, label }: { icon: string; label?: string }) {
  const Icon = KIND_ICONS[icon as keyof typeof KIND_ICONS] ?? Target;
  return (
    <span className="pill px-2.5 py-0.5 text-[11px] text-leo-ink-soft">
      <Icon width={12} height={12} />
      {label}
    </span>
  );
}

/* ── Quest board widgets (§13.1) ───────────────────────────────── */

const QUEST_ICONS = { zap: Zap, brain: Brain, map: Map, star: Star, rocket: Rocket, flame: Flame } as const;

export function QuestRow({
  quest,
  progress,
  claimed,
  onClaim,
}: {
  quest: QuestDef;
  progress: number;
  claimed: boolean;
  onClaim: () => void;
}) {
  const Icon = QUEST_ICONS[quest.icon];
  const done = progress >= quest.target;
  const frac = Math.min(1, progress / quest.target);
  return (
    <motion.div
      layout
      className={`flex items-center gap-3 rounded-2xl border-[2.5px] px-3 py-2.5 ${
        claimed ? "border-leo-leaf bg-[#e9ffcf]" : done ? "border-leo-sun bg-[#fff3c4]" : "border-leo-line bg-white"
      }`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-[2.5px] ${
          claimed ? "border-leo-leaf-deep bg-leo-leaf text-white" : done ? "border-leo-sun-deep bg-leo-sun text-white" : "border-leo-line bg-leo-cream text-leo-ink-soft"
        }`}
      >
        <Icon width={20} height={20} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-display text-sm font-semibold text-leo-ink">{quest.label}</span>
          <span className="shrink-0 text-[11px] font-bold text-leo-ink-soft">
            {Math.min(progress, quest.target)}/{quest.target}
          </span>
        </div>
        <div className="mt-1 h-2.5 overflow-hidden rounded-full border-2 border-leo-line bg-leo-cream">
          <motion.div
            className={`h-full rounded-full ${claimed ? "bg-leo-leaf" : done ? "bg-leo-sun" : "bg-leo-teal"}`}
            initial={false}
            animate={{ width: `${Math.round(frac * 100)}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
          />
        </div>
      </div>
      {claimed ? (
        <span className="pill px-2 py-1 text-[11px] font-bold text-leo-leaf-deep">+{quest.rewardXp} XP</span>
      ) : done ? (
        <ChunkyButton color="sun" size="sm" onClick={onClaim} ariaLabel={`Claim ${quest.label} reward`}>
          Claim
        </ChunkyButton>
      ) : (
        <span className="hidden text-[11px] font-semibold text-leo-ink-soft sm:block">+{quest.rewardXp} XP</span>
      )}
    </motion.div>
  );
}

/** League chip with progress toward the next tier. */
export function LeagueProgress({ weekXp, compact = false }: { weekXp: number; compact?: boolean }) {
  const league = leagueOf(weekXp);
  const next = league.next;
  const frac = next ? Math.min(1, (weekXp - league.min) / (next.min - league.min)) : 1;
  return (
    <div className={`pill gap-2 px-3 py-1.5 ${compact ? "" : "w-full"}`}>
      <LeagueBadge id={league.badge as BadgeId} size={compact ? 20 : 26} />
      <div className={compact ? "" : "min-w-0 flex-1"}>
        <div className={`font-display text-sm font-bold text-leo-ink ${compact ? "" : "leading-none"}`}>
          {league.name}
          {next && !compact && <span className="ml-1 text-[10px] font-semibold text-leo-ink-soft">league</span>}
        </div>
        {next && !compact && (
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-leo-sand">
            <motion.div
              className="h-full rounded-full"
              style={{ background: next.color }}
              initial={false}
              animate={{ width: `${Math.round(frac * 100)}%` }}
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
            />
          </div>
        )}
      </div>
      {next && (
        <span className={`text-[10px] font-semibold text-leo-ink-soft ${compact ? "" : "shrink-0"}`}>
          {next ? `${Math.max(0, next.min - weekXp)} XP to ${next.name}` : "Top tier!"}
        </span>
      )}
      {!next && !compact && <Trophy width={14} height={14} className="text-leo-grape" />}
    </div>
  );
}

/* ── Achievement toasts (§13.2) ────────────────────────────────── */

const ACH_ICONS = { star: Star, flame: Flame, zap: Zap, rocket: Rocket, crown: Crown, map: Map, brain: Brain, trophy: Trophy, gem: Gem, medal: Medal } as const;

export function AchievementToasts() {
  const pending = useLeo((s) => s.pendingAch);
  const dismiss = useLeo((s) => s.dismissAch);
  const current = pending[0] ?? null;

  useEffect(() => {
    if (!current) return;
    const t = window.setTimeout(dismiss, 4200);
    return () => window.clearTimeout(t);
  }, [current, dismiss]);

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[80] flex w-[300px] flex-col gap-2">
      <AnimatePresence>
        {current && (
          <motion.div
            key={current.id}
            initial={{ x: 340, opacity: 0, rotate: 4 }}
            animate={{ x: 0, opacity: 1, rotate: 0 }}
            exit={{ x: 340, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="pointer-events-auto flex items-center gap-3 rounded-2xl border-[3px] border-leo-sun bg-white p-3 shadow-[0_8px_0_rgba(214,178,110,0.4)]"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-[3px] border-leo-sun-deep bg-gradient-to-b from-leo-honey to-leo-sun text-white">
              {(() => {
                const Icon = ACH_ICONS[current.icon] ?? Medal;
                return <Icon width={24} height={24} className="drop-shadow" />;
              })()}
            </span>
            <div className="min-w-0">
              <div className="font-display text-[10px] font-bold uppercase tracking-widest text-leo-sun-deep">
                Badge unlocked
              </div>
              <div className="truncate font-display text-base font-bold leading-tight text-leo-ink">{current.name}</div>
              <div className="truncate text-[11px] text-leo-ink-soft">{current.desc} · +{current.xp} XP</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Score count-up (results juice) ────────────────────────────── */

export function ScoreCountUp({ to, duration = 900 }: { to: number; duration?: number }) {
  const [n, setN] = useState(0);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    const start = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(to * eased));
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [to, duration]);
  return <span className="tabular-nums">{n}</span>;
}

/* ── Small shared bits ─────────────────────────────────────────── */

export function TimerIcon({ size = 15, className = "" }: { size?: number; className?: string }) {
  return <Timer width={size} height={size} className={className} />;
}

export function HandIcon({ size = 15, className = "" }: { size?: number; className?: string }) {
  return <Hand width={size} height={size} className={className} />;
}

export function GiftIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return <Gift width={size} height={size} className={className} />;
}
