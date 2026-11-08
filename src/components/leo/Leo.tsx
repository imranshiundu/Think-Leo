"use client";

/**
 * Think Leo — the mascot
 * ──────────────────────
 * Leo is 100% parametric SVG (no images): the mane is a ring of circles,
 * every mood is a tiny configuration, and framer-motion drives the body.
 * Design notes in docs/ALGORITHM.md §10.
 *
 *   mood        eyes              mouth     paws     body motion
 *   ──────────  ───────────────   ────────  ───────  ─────────────────
 *   idle        open              smile     down     gentle float + blink
 *   happy       open              open      up       endless bounce
 *   excited     wide              open      up       endless bounce
 *   sad         open + downturn   frown     down     slow droop sway
 *   thinking    pupil up-right    flat      chin     held still, brow raised
 *   celebrate   STARS             open      up       dance + sparkles
 *   sleep       closed            flat      down     slow breathe
 */

import { AnimatePresence, motion } from "framer-motion";
import type { Mood } from "@/lib/game";
import { Sparkle } from "@/components/leo/badges";

interface Look {
  eyes: "open" | "happy" | "closed" | "star" | "wide";
  pupil: [number, number];
  brow?: "sad" | "think";
  mouth: "smile" | "open" | "frown" | "flat" | "ooh";
  paws: "down" | "up" | "chin";
  bob: "idle" | "bounce" | "dance" | "droop" | "still" | "sleep";
}

const LOOKS: Record<Mood, Look> = {
  idle:      { eyes: "open",   pupil: [0, 0],    mouth: "smile", paws: "down", bob: "idle" },
  happy:     { eyes: "open",   pupil: [0, -1],   mouth: "open",  paws: "up",   bob: "bounce" },
  excited:   { eyes: "wide",   pupil: [0, -1],   mouth: "open",  paws: "up",   bob: "bounce" },
  sad:       { eyes: "open",   pupil: [0, 3],    mouth: "frown", paws: "down", brow: "sad",   bob: "droop" },
  thinking:  { eyes: "open",   pupil: [2.5, -3], mouth: "flat",  paws: "chin", brow: "think", bob: "still" },
  celebrate: { eyes: "star",   pupil: [0, 0],    mouth: "open",  paws: "up",   bob: "dance" },
  sleep:     { eyes: "closed", pupil: [0, 0],    mouth: "flat",  paws: "down", bob: "sleep" },
};

/* mane geometry — computed once, identical on server & client */
const MANE = (() => {
  const cx = 130, cy = 104, r = 58, bumps = 12, br = 18;
  const arr: { x: number; y: number }[] = [];
  for (let i = 0; i < bumps; i++) {
    const a = (i / bumps) * Math.PI * 2 - Math.PI / 2;
    arr.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return { cx, cy, r, br, arr };
})();

function starPath(cx: number, cy: number, ro: number, ri: number): string {
  let d = "";
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? ro : ri;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    d += `${i === 0 ? "M" : "L"}${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }
  return d + "Z";
}

const BOB_VARIANTS: Record<Look["bob"], object> = {
  idle: { y: [0, -4, 0], transition: { duration: 2.8, repeat: Infinity, ease: "easeInOut" } },
  bounce: { y: [0, -18, 0], scaleY: [1, 1.05, 0.94, 1], transition: { duration: 0.62, repeat: Infinity, ease: "easeOut" } },
  dance: {
    y: [0, -11, 0], rotate: [-4, 4, -4],
    transition: { duration: 0.85, repeat: Infinity, ease: "easeInOut" },
  },
  droop: { rotate: [0, -1.6, 0], transition: { duration: 3.4, repeat: Infinity, ease: "easeInOut" } },
  still: {},
  sleep: { scaleY: [1, 1.04, 1], transition: { duration: 3.4, repeat: Infinity, ease: "easeInOut" } },
};

export interface LeoProps {
  mood?: Mood;
  size?: number;
  className?: string;
  bubble?: string | null;
}

export function Leo({ mood = "idle", size = 200, className = "", bubble = null }: LeoProps) {
  const look = LOOKS[mood] ?? LOOKS.idle;
  const sparkle = mood === "celebrate" || mood === "excited";

  return (
    <div className={`relative inline-block ${className}`} style={{ width: size }}>
      <AnimatePresence>
        {bubble && (
          <motion.div
            key={bubble}
            initial={{ scale: 0.4, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 22 }}
            className="absolute -top-3 left-1/2 z-20 w-max max-w-[240px] -translate-x-1/2"
          >
            <div className="relative rounded-2xl border-[3px] border-leo-line bg-white px-4 py-2 text-center font-display text-[15px] font-semibold leading-snug text-leo-ink shadow-[0_4px_0_rgba(214,178,110,0.35)]">
              {bubble}
              <div className="absolute -bottom-[9px] left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-b-[3px] border-r-[3px] border-leo-line bg-white" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {sparkle && (
        <>
          <span className="anim-drift absolute -left-3 top-6" style={{ animationDelay: "0s" }}>
            <Sparkle size={20} />
          </span>
          <span className="anim-drift absolute -right-4 top-14" style={{ animationDelay: "1.2s" }}>
            <Sparkle size={16} color="#FFB020" />
          </span>
          <span className="anim-drift absolute right-2 top-0" style={{ animationDelay: "2.1s" }}>
            <Sparkle size={14} color="#FF8AB8" />
          </span>
        </>
      )}

      <motion.div animate={BOB_VARIANTS[look.bob]} style={{ transformOrigin: "50% 95%" }}>
        <svg
          width={size}
          height={size * 0.97}
          viewBox="0 0 260 252"
          role="img"
          aria-label={`Leo the lion looks ${mood}`}
        >
          {/* ground shadow */}
          <ellipse cx="130" cy="245" rx="54" ry="7" fill="rgba(74,47,27,0.10)" />

          {/* tail */}
          <motion.g
            style={{ transformBox: "fill-box", transformOrigin: "0% 100%" }}
            animate={{ rotate: [-3, 6, -3] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          >
            <path
              d="M186,206 C216,204 230,184 222,162"
              stroke="#F0A830"
              strokeWidth="10"
              fill="none"
              strokeLinecap="round"
            />
            <circle cx="221" cy="156" r="10.5" fill="#C4622D" />
          </motion.g>

          {/* body */}
          <ellipse cx="130" cy="206" rx="46" ry="38" fill="#FFB84D" />
          <ellipse cx="130" cy="214" rx="28" ry="24" fill="#FFE9C7" />
          {/* feet */}
          <ellipse cx="106" cy="240" rx="15" ry="9" fill="#F0A830" />
          <ellipse cx="154" cy="240" rx="15" ry="9" fill="#F0A830" />

          {/* mane */}
          <g fill="#C4622D">
            <circle cx={MANE.cx} cy={MANE.cy} r={MANE.r} />
            {MANE.arr.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={MANE.br} />
            ))}
          </g>

          {/* ears */}
          <g>
            <circle cx="94" cy="44" r="13" fill="#FFC93C" />
            <circle cx="94" cy="44" r="6.5" fill="#FFD9A0" />
            <circle cx="166" cy="44" r="13" fill="#FFC93C" />
            <circle cx="166" cy="44" r="6.5" fill="#FFD9A0" />
          </g>

          {/* face */}
          <circle cx="130" cy="110" r="52" fill="#FFC93C" />
          <circle cx="96" cy="130" r="7.5" fill="#FF9D5C" opacity={mood === "sad" ? 0.3 : 0.5} />
          <circle cx="164" cy="130" r="7.5" fill="#FF9D5C" opacity={mood === "sad" ? 0.3 : 0.5} />

          {/* muzzle + nose */}
          <ellipse cx="130" cy="136" rx="23" ry="15" fill="#FFE9C7" />
          <path
            d="M130,126.5 c6.5,0 11,3.8 11,7.6 c0,5.6 -5,9 -11,9 c-6,0 -11,-3.4 -11,-9 c0,-3.8 4.5,-7.6 11,-7.6 z"
            fill="#7A4526"
          />

          {/* mouth */}
          {look.mouth === "smile" && (
            <path d="M118,145 Q130,156 142,145" stroke="#7A4526" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          )}
          {look.mouth === "open" && (
            <g>
              <path d="M115,144 Q130,167 145,144 Q130,151 115,144 Z" fill="#7A3B1E" />
              <ellipse cx="130" cy="157" rx="6" ry="3.5" fill="#FF8A80" />
            </g>
          )}
          {look.mouth === "frown" && (
            <path d="M119,152 Q130,143 141,152" stroke="#7A4526" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          )}
          {look.mouth === "flat" && (
            <path d="M122,150 L138,150" stroke="#7A4526" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          )}
          {look.mouth === "ooh" && <circle cx="130" cy="150" r="5.5" fill="#7A3B1E" />}

          {/* eyes */}
          {(look.eyes === "open" || look.eyes === "wide") && (
            <BlinkGroup>
              <g>
                <ellipse cx="110" cy="103" rx={look.eyes === "wide" ? 11.5 : 10.5} ry={look.eyes === "wide" ? 14.5 : 13} fill="#fff" />
                <ellipse cx="150" cy="103" rx={look.eyes === "wide" ? 11.5 : 10.5} ry={look.eyes === "wide" ? 14.5 : 13} fill="#fff" />
                <circle cx={110 + look.pupil[0]} cy={103 + look.pupil[1]} r="5.4" fill="#4A2F1B" />
                <circle cx={150 + look.pupil[0]} cy={103 + look.pupil[1]} r="5.4" fill="#4A2F1B" />
                <circle cx={112 + look.pupil[0]} cy={100.5 + look.pupil[1]} r="1.9" fill="#fff" />
                <circle cx={152 + look.pupil[0]} cy={100.5 + look.pupil[1]} r="1.9" fill="#fff" />
              </g>
            </BlinkGroup>
          )}
          {look.eyes === "happy" && (
            <g stroke="#4A2F1B" strokeWidth="4" fill="none" strokeLinecap="round">
              <path d="M100,105 Q110,94 120,105" />
              <path d="M140,105 Q150,94 160,105" />
            </g>
          )}
          {look.eyes === "closed" && (
            <g stroke="#4A2F1B" strokeWidth="4" fill="none" strokeLinecap="round">
              <path d="M100,103 Q110,111 120,103" />
              <path d="M140,103 Q150,111 160,103" />
            </g>
          )}
          {look.eyes === "star" && (
            <g>
              <path d={starPath(110, 103, 10.5, 4.6)} fill="#FFD966" stroke="#4A2F1B" strokeWidth="1.6" />
              <path d={starPath(150, 103, 10.5, 4.6)} fill="#FFD966" stroke="#4A2F1B" strokeWidth="1.6" />
              <circle cx="107" cy="100" r="1.7" fill="#fff" />
              <circle cx="147" cy="100" r="1.7" fill="#fff" />
            </g>
          )}

          {/* brows */}
          {look.brow === "sad" && (
            <g stroke="#7A4526" strokeWidth="4" fill="none" strokeLinecap="round">
              <path d="M100,84 L114,88" />
              <path d="M160,84 L146,88" />
            </g>
          )}
          {look.brow === "think" && (
            <g stroke="#7A4526" strokeWidth="4" fill="none" strokeLinecap="round">
              <path d="M100,80 Q108,74 118,79" />
              <path d="M142,85 Q150,84 158,86" />
            </g>
          )}

          {/* paws */}
          {look.paws === "down" && (
            <g fill="#FFB84D">
              <circle cx="100" cy="226" r="12" />
              <circle cx="160" cy="226" r="12" />
            </g>
          )}
          {look.paws === "up" && (
            <motion.g
              fill="#FFB84D"
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 0.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <circle cx="86" cy="178" r="12.5" />
              <circle cx="174" cy="178" r="12.5" />
            </motion.g>
          )}
          {look.paws === "chin" && (
            <g fill="#FFB84D">
              <circle cx="117" cy="152" r="10" />
              <circle cx="160" cy="226" r="12" />
            </g>
          )}

          {/* sleep zzz */}
          {mood === "sleep" && (
            <g fill="#8A6A4F" fontFamily="var(--font-fredoka)">
              <text x="196" y="70" fontSize="20" fontWeight="700">z</text>
              <text x="212" y="52" fontSize="14" fontWeight="700">z</text>
              <text x="224" y="38" fontSize="10" fontWeight="700">z</text>
            </g>
          )}
        </svg>
      </motion.div>
    </div>
  );
}

function BlinkGroup({ children }: { children: React.ReactNode }) {
  return (
    <motion.g
      style={{ transformBox: "fill-box", transformOrigin: "50% 50%" }}
      animate={{ scaleY: [1, 1, 0.12, 1, 1] }}
      transition={{ duration: 4.2, times: [0, 0.44, 0.48, 0.52, 1], repeat: Infinity, ease: "easeInOut" }}
    >
      {children}
    </motion.g>
  );
}

/** Compact wordmark used on splash, home and the top bar. */
export function Logo({
  leoSize = 76,
  textClass = "text-3xl",
  showTag = false,
}: {
  leoSize?: number;
  textClass?: string;
  showTag?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="anim-wiggle">
        <Leo mood="happy" size={leoSize} />
      </div>
      <div className="-rotate-2">
        <div className={`font-display font-bold leading-[0.95] ${textClass}`}>
          <span className="text-leo-ink">Think </span>
          <span className="bg-gradient-to-r from-leo-sun via-leo-berry to-leo-grape bg-clip-text text-transparent">
            Leo!
          </span>
        </div>
        {showTag && (
          <div className="mt-1 font-display text-xs font-medium text-leo-ink-soft">
            Big brain adventures for little legends
          </div>
        )}
      </div>
    </div>
  );
}

export default Leo;
