"use client";

/**
 * Think Leo — Badges & reward art
 * ───────────────────────────────
 * League medals, the world chest, and small celebratory marks — all SVG,
 * matching the sticker grammar (flat fills, cocoa outline, round joins).
 */

import { motion } from "framer-motion";

const OUT = "#4A2F1B";
const STROKE = { stroke: OUT, strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" } as const;

/* ── league badges ──────────────────────────────────────────── */

function Ribbon({ c1, c2 }: { c1: string; c2: string }) {
  return (
    <g {...STROKE}>
      <path d="M15,26 L10,42 L17,39 L21,45 L25,30" fill={c2} strokeWidth={1.6} />
      <path d="M33,26 L38,42 L31,39 L27,45 L23,30" fill={c2} strokeWidth={1.6} />
      <circle cx="24" cy="17" r="13" fill={c1} />
      <circle cx="24" cy="17" r="8.6" fill="#fff" opacity={0.28} stroke="none" />
      <circle cx="24" cy="17" r="13" fill="none" />
    </g>
  );
}

export type BadgeId = "sprout" | "bronze" | "silver" | "gold" | "gem" | "trophy";

const BADGES: Record<BadgeId, () => React.ReactElement> = {
  sprout: () => (
    <g {...STROKE}>
      <path d="M24,44 v-14" strokeWidth={3.4} />
      <path d="M24,32 q-1,-12 -12,-13 q0,11 12,13z" fill="#58CC02" />
      <path d="M24,30 q1,-10 11,-11 q-1,10 -11,11z" fill="#7ED957" />
      <path d="M17,44 h14" strokeWidth={3} />
    </g>
  ),
  bronze: () => (
    <g {...STROKE}>
      <Ribbon c1="#C47A3D" c2="#8F5726" />
      <text x="24" y="22.5" textAnchor="middle" fontSize="13" fontWeight="800" fill="#fff" stroke="none" fontFamily="inherit">3</text>
    </g>
  ),
  silver: () => (
    <g {...STROKE}>
      <Ribbon c1="#9AA7B5" c2="#6E7A88" />
      <text x="24" y="22.5" textAnchor="middle" fontSize="13" fontWeight="800" fill="#fff" stroke="none" fontFamily="inherit">2</text>
    </g>
  ),
  gold: () => (
    <g {...STROKE}>
      <Ribbon c1="#FFC93C" c2="#D99A00" />
      <path d="M24,9 l2.2,4.6 5,0.7 -3.6,3.6 0.9,5 -4.5,-2.4 -4.5,2.4 0.9,-5 -3.6,-3.6 5,-0.7z" fill="#fff" opacity={0.85} stroke="none" />
    </g>
  ),
  gem: () => (
    <g {...STROKE}>
      <path d="M14,10 h20 l8,10 -18,22 L6,20z" fill="#2EC4B6" />
      <path d="M14,10 l4,10 -6,0 M34,10 l-4,10 6,0 M18,20 l6,22 6,-22 M6,20 h36" stroke="#1E9E92" strokeWidth={1.6} fill="none" />
      <path d="M14,10 h20 l8,10 -18,22 L6,20z" fill="none" />
    </g>
  ),
  trophy: () => (
    <g {...STROKE}>
      <path d="M14,8 h20 v10 q0,10 -10,10 q-10,0 -10,-10z" fill="#FFC93C" />
      <path d="M14,10 q-7,0 -7,6 q0,6 8,6 M34,10 q7,0 7,6 q0,6 -8,6" fill="none" strokeWidth={2.2} />
      <path d="M24,28 v6 M17,40 q7,-3 14,0 l1,4 h-16z" fill="#D99A00" />
      <path d="M20,13 h8" stroke="#fff" strokeWidth={2} opacity={0.8} />
    </g>
  ),
};

export function LeagueBadge({ id, size = 24, className = "" }: { id: BadgeId; size?: number; className?: string }) {
  const Art = BADGES[id] ?? BADGES.sprout;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} role="img" aria-label={`${id} league badge`}>
      <Art />
    </svg>
  );
}

/* ── world chest (locked / ready / open) ────────────────────── */

export function ChestArt({ state, size = 40 }: { state: "locked" | "ready" | "open"; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label={`Treasure chest ${state}`}>
      {state === "open" ? (
        <g {...STROKE}>
          <path d="M8,20 L8,12 Q8,5 24,5 Q40,5 40,12 L40,20" fill="#B4763B" />
          <path d="M8,20 L40,20 L40,16 L8,16z" fill="#8F5726" strokeWidth={1.5} />
          <path d="M8,22 h32 v16 q0,3 -3,3 H11 q-3,0 -3,-3z" fill="#C98A4B" />
          <rect x="21" y="24" width="6" height="9" rx="1.6" fill="#FFC93C" strokeWidth={1.6} />
          <motion.g initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}>
            <path d="M16,4 l1.6,3.4 3.4,1.6 -3.4,1.6 -1.6,3.4 -1.6,-3.4 -3.4,-1.6 3.4,-1.6z" fill="#FFD23F" stroke={OUT} strokeWidth={1.2} />
            <path d="M31,8 l1.2,2.6 2.6,1.2 -2.6,1.2 -1.2,2.6 -1.2,-2.6 -2.6,-1.2 2.6,-1.2z" fill="#FF8AB8" stroke={OUT} strokeWidth={1.2} />
          </motion.g>
        </g>
      ) : (
        <g {...STROKE}>
          <path d="M8,18 Q8,6 24,6 Q40,6 40,18 L40,24 L8,24z" fill="#B4763B" />
          <rect x="8" y="22" width="32" height="18" rx="3" fill="#C98A4B" />
          <rect x="21" y="19" width="6" height="10" rx="1.8" fill={state === "ready" ? "#FFC93C" : "#8F8F8F"} strokeWidth={1.6} />
          <circle cx="24" cy="23.4" r="1.4" fill={OUT} stroke="none" />
          <path d="M12,8 q-3,4 -3,9 M36,8 q3,4 3,9" fill="none" stroke="#8F5726" strokeWidth={1.6} />
          {state === "ready" && (
            <motion.path
              d="M24,2 l1.4,3 3,1.4 -3,1.4 -1.4,3 -1.4,-3 -3,-1.4 3,-1.4z"
              fill="#FFD23F"
              stroke={OUT}
              strokeWidth={1.2}
              animate={{ scale: [1, 1.25, 1], rotate: [0, 18, 0] }}
              transition={{ duration: 1.6, repeat: Infinity }}
              style={{ transformOrigin: "24px 6px" }}
            />
          )}
        </g>
      )}
    </svg>
  );
}

/* ── sparkles (replaces emoji ✨⭐ in the mascot layer) ─────── */

export function Sparkle({ size = 18, color = "#FFD23F", className = "", style }: { size?: number; color?: string; className?: string; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style} aria-hidden>
      <path d="M12,2 C12.8,7.2 14.8,9.2 20,10 C14.8,10.8 12.8,12.8 12,18 C11.2,12.8 9.2,10.8 4,10 C9.2,9.2 11.2,7.2 12,2z" fill={color} />
    </svg>
  );
}

export function StarPop({ size = 26, className = "", style }: { size?: number; className?: string; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} style={style} aria-hidden>
      <g {...STROKE}>
        <path d="M24,6 L29,17.4 L41,19 L32,27.6 L34.4,40 L24,33.6 L13.6,40 L16,27.6 L7,19 L19,17.4 Z" fill="#FFD23F" />
      </g>
    </svg>
  );
}
