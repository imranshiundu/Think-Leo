"use client";

/**
 * Think Leo — Sticker Library
 * ──────────────────────────
 * Every object in the game (counting tiles, odd-one families, world
 * emblems, quest art) is a hand-tuned parametric SVG — zero emojis, zero
 * raster images. One visual grammar everywhere:
 *
 *   · 48×48 viewBox, flat candy fills, 2px cocoa outline (#4A2F1B)
 *   · rounded joins, chunky silhouettes, kawaii faces on characters
 *   · palette locked to the Think Leo tokens (+ a few support tints)
 *
 * `Sticker` renders any catalog entry at any size; `StickerTile` adds the
 * wobbly white plate used by counting / odd-one puzzles.
 */

import { motion } from "framer-motion";

export type StickerId =
  // jungle
  | "monkey" | "parrot" | "elephant" | "butterfly" | "flower"
  // sea
  | "fish" | "octopus" | "crab" | "dolphin" | "shell"
  // space
  | "star" | "rocket" | "ufo" | "moon" | "comet"
  // candy
  | "candy" | "lollipop" | "cupcake" | "donut" | "cookie"
  // fruit
  | "apple" | "banana" | "grapes" | "strawberry"
  // veggies
  | "carrot" | "broccoli" | "corn" | "chili"
  // pets
  | "dog" | "cat" | "rabbit" | "mouse"
  // woodland (v4 — shadow-match cast)
  | "frog" | "fox" | "owl"
  // farm
  | "cow" | "pig" | "chicken" | "sheep"
  // bugs
  | "bee" | "ladybug" | "snail"
  // road
  | "car" | "bus" | "tractor"
  // leo pop (v5 — the merge chain finale)
  | "lion";

const OUT = "#4A2F1B";
const STROKE = { stroke: OUT, strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" } as const;

/* kawaii face helper — eyes + smile on any character */
function Face({ x = 24, y = 22, s = 1, blush = true }: { x?: number; y?: number; s?: number; blush?: boolean }) {
  return (
    <g>
      <circle cx={x - 4.4 * s} cy={y} r={1.7 * s} fill={OUT} />
      <circle cx={x + 4.4 * s} cy={y} r={1.7 * s} fill={OUT} />
      <circle cx={x - 3.6 * s} cy={y - 0.9 * s} r={0.6 * s} fill="#fff" />
      <circle cx={x + 5.2 * s} cy={y - 0.9 * s} r={0.6 * s} fill="#fff" />
      <path d={`M${x - 2.6 * s},${y + 3 * s} q${2.6 * s},${2.4 * s} ${5.2 * s},0`} fill="none" {...STROKE} strokeWidth={1.6} />
      {blush && (
        <>
          <ellipse cx={x - 8 * s} cy={y + 2.6 * s} rx={1.9 * s} ry={1.2 * s} fill="#FF8A80" opacity={0.55} />
          <ellipse cx={x + 8 * s} cy={y + 2.6 * s} rx={1.9 * s} ry={1.2 * s} fill="#FF8A80" opacity={0.55} />
        </>
      )}
    </g>
  );
}

/* ── jungle ─────────────────────────────────────────────────── */

const Monkey = () => (
  <g {...STROKE}>
    <path d="M33,38 q9,2 7,-8" fill="none" strokeWidth={2.4} />
    <ellipse cx="24" cy="39" rx="9" ry="6.5" fill="#A9744B" />
    <circle cx="10" cy="21" r="5.6" fill="#A9744B" />
    <circle cx="10" cy="21" r="2.6" fill="#E8B98B" strokeWidth={1.4} />
    <circle cx="38" cy="21" r="5.6" fill="#A9744B" />
    <circle cx="38" cy="21" r="2.6" fill="#E8B98B" strokeWidth={1.4} />
    <circle cx="24" cy="24" r="12.5" fill="#A9744B" />
    <ellipse cx="24" cy="28.5" rx="9" ry="7.5" fill="#F2D3AC" strokeWidth={1.4} />
    <circle cx="21" cy="26.5" r="1.5" fill={OUT} stroke="none" />
    <circle cx="27" cy="26.5" r="1.5" fill={OUT} stroke="none" />
    <path d="M22.4,31.5 q1.6,1.6 3.2,0" fill="none" strokeWidth={1.6} />
    <ellipse cx="24" cy="29.6" rx="1.3" ry="0.9" fill={OUT} stroke="none" />
  </g>
);

const Parrot = () => (
  <g {...STROKE}>
    <path d="M30,40 q8,-1 9,-7 q-6,1 -9,3" fill="#3F9A00" strokeWidth={1.8} />
    <path d="M20,8 q12,1 12,15 q0,14 -9,20 q-4,2 -7,-1 q-5,-6 -4,-17 q1,-15 8,-17z" fill="#58CC02" />
    <path d="M14,26 q-3,7 2,13 q3,-5 3,-11" fill="#FFC93C" strokeWidth={1.8} />
    <path d="M22,14 q8,2 8,10 q0,7 -5,11 q-4,-4 -4,-11 q0,-6 1,-10z" fill="#7ED957" strokeWidth={1.4} />
    <circle cx="21" cy="17" r="3.4" fill="#fff" strokeWidth={1.6} />
    <circle cx="21.8" cy="17.4" r="1.5" fill={OUT} stroke="none" />
    <path d="M26,14 q7,-1 7,4 q0,4 -6,4" fill="#FFB020" />
  </g>
);

const Elephant = () => (
  <g {...STROKE}>
    <circle cx="9" cy="22" r="7.5" fill="#A9B2E8" />
    <circle cx="9" cy="22" r="3.6" fill="#FFA7C4" strokeWidth={1.4} />
    <circle cx="39" cy="22" r="7.5" fill="#A9B2E8" />
    <circle cx="39" cy="22" r="3.6" fill="#FFA7C4" strokeWidth={1.4} />
    <circle cx="24" cy="22" r="13.5" fill="#A9B2E8" />
    <path d="M24,30 q-1,8 3,11 q4,3 6,-1" fill="none" strokeWidth={4.4} />
    <path d="M24,30 q-1,8 3,11 q4,3 6,-1" fill="none" stroke="#8E97D6" strokeWidth={2} />
    <Face x={23} y={19} s={0.95} />
  </g>
);

const Butterfly = () => (
  <g {...STROKE}>
    <path d="M22,22 C10,10 4,16 8,24 C4,30 12,38 22,27" fill="#9B5DE5" strokeWidth={1.8} />
    <path d="M26,22 C38,10 44,16 40,24 C44,30 36,38 26,27" fill="#9B5DE5" strokeWidth={1.8} />
    <path d="M22,23 C15,17 12,20 14,24 M26,23 C33,17 36,20 34,24" fill="#FFC93C" strokeWidth={1.4} />
    <ellipse cx="24" cy="26" rx="3.2" ry="9" fill={OUT} stroke="none" />
    <path d="M22,17 q-3,-5 -6,-6 M26,17 q3,-5 6,-6" fill="none" strokeWidth={1.6} />
    <circle cx="15.4" cy="10.4" r="1.5" fill="#FFC93C" />
    <circle cx="32.6" cy="10.4" r="1.5" fill="#FFC93C" />
  </g>
);

const Flower = () => (
  <g {...STROKE}>
    {[0, 72, 144, 216, 288].map((a) => {
      const r = (a * Math.PI) / 180;
      return (
        <ellipse
          key={a}
          cx={24 + Math.cos(r) * 9.5}
          cy={24 + Math.sin(r) * 9.5}
          rx="6.4"
          ry="6.9"
          fill="#FF8AB8"
          transform={`rotate(${a} ${24 + Math.cos(r) * 9.5} ${24 + Math.sin(r) * 9.5})`}
        />
      );
    })}
    <circle cx="24" cy="24" r="6.2" fill="#FFC93C" />
    <circle cx="22" cy="22.4" r="1.4" fill="#fff" stroke="none" />
  </g>
);

/* ── sea ────────────────────────────────────────────────────── */

const Fish = () => (
  <g {...STROKE}>
    <path d="M36,24 L45,15 L43,24 L45,33 Z" fill="#1E9E92" />
    <ellipse cx="24" cy="24" rx="14" ry="10.5" fill="#2EC4B6" />
    <path d="M24,13.5 q4,4 0,8" fill="#1E9E92" strokeWidth={1.4} />
    <circle cx="16" cy="21" r="3.1" fill="#fff" strokeWidth={1.6} />
    <circle cx="15" cy="21.4" r="1.4" fill={OUT} stroke="none" />
    <path d="M13,27 q2.5,2 5,0.6" fill="none" strokeWidth={1.6} />
    <circle cx="9" cy="12" r="1.6" fill="#BFEFEA" strokeWidth={1.4} />
    <circle cx="6" cy="7" r="1.1" fill="#BFEFEA" strokeWidth={1.2} />
  </g>
);

const Octopus = () => (
  <g {...STROKE}>
    {[
      "M13,32 q-4,6 1,9",
      "M19,34 q-1,7 4,8",
      "M29,34 q1,7 -4,8",
      "M35,32 q4,6 -1,9",
    ].map((d) => (
      <path key={d} d={d} fill="none" strokeWidth={4} stroke="#D63A6C" />
    ))}
    {["M13,32 q-4,6 1,9", "M19,34 q-1,7 4,8", "M29,34 q1,7 -4,8", "M35,32 q4,6 -1,9"].map((d) => (
      <path key={d} d={d} fill="none" strokeWidth={1.6} />
    ))}
    <path d="M10,26 a14,14 0 0 1 28,0 q-2,6 -14,6 q-12,0 -14,-6z" fill="#FF5A8C" />
    <Face x={24} y={21} s={1.05} />
  </g>
);

const Crab = () => (
  <g {...STROKE}>
    <circle cx="12" cy="14" r="3.4" fill="#F0564E" strokeWidth={1.6} />
    <circle cx="36" cy="14" r="3.4" fill="#F0564E" strokeWidth={1.6} />
    <path d="M13,16 L17,21 M35,16 L31,21" strokeWidth={2.2} />
    <path d="M8,9 q-4,-3 -1,-5 q3,-1 4,3 M16,9 q4,-3 1,-5 q-3,-1 -4,3" fill="#F0564E" strokeWidth={1.6} />
    <path d="M40,9 q4,-3 1,-5 q-3,-1 -4,3 M32,9 q-4,-3 -1,-5 q3,-1 4,3" fill="#F0564E" strokeWidth={1.6} />
    <path d="M10,36 q-4,1 -4,-2 M38,36 q4,1 4,-2 M13,39 q-3,3 -6,1 M35,39 q3,3 6,1" fill="none" strokeWidth={2} />
    <ellipse cx="24" cy="29" rx="12.5" ry="9.5" fill="#F0564E" />
    <Face x={24} y={27.5} s={0.9} />
  </g>
);

const Dolphin = () => (
  <g {...STROKE}>
    <path d="M40,14 q-2,6 -6,8" fill="none" strokeWidth={1.6} />
    <path d="M10,30 q0,-16 15,-17 q12,-1 15,7 q-6,2 -8,7 q8,3 9,9 q-14,6 -22,0 q-8,-5 -9,-6z" fill="#7FB8E8" />
    <path d="M22,13 q2,-6 8,-6 q-2,4 -3,7" fill="#5E9BD6" strokeWidth={1.6} />
    <path d="M18,34 q8,4 16,0 q-3,6 -8,6 q-6,0 -8,-6z" fill="#D6EBFA" strokeWidth={1.4} />
    <circle cx="21" cy="22" r="2.6" fill="#fff" strokeWidth={1.5} />
    <circle cx="20.4" cy="22.4" r="1.2" fill={OUT} stroke="none" />
    <path d="M15,28 q2.5,2 5,0.6" fill="none" strokeWidth={1.6} />
  </g>
);

const Shell = () => (
  <g {...STROKE}>
    <path d="M24,10 C13,10 7,20 8,30 q0,6 5,6 q4,0 5,-4 q1,4 6,4 q5,0 6,-4 q1,4 5,4 q5,0 5,-6 C41,20 35,10 24,10z" fill="#F6CFA0" />
    <path d="M24,10 L20,36 M24,10 L28,36 M24,10 L13,32 M24,10 L35,32" strokeWidth={1.4} stroke="#D9A76C" />
    <path d="M24,10 C13,10 7,20 8,30 q0,6 5,6 q4,0 5,-4 q1,4 6,4 q5,0 6,-4 q1,4 5,4 q5,0 5,-6 C41,20 35,10 24,10z" fill="none" />
  </g>
);

/* ── space ──────────────────────────────────────────────────── */

const Star = () => (
  <g {...STROKE}>
    <path
      d="M24,5 L29.6,17.4 L43,19 L33,28.4 L35.6,42 L24,35 L12.4,42 L15,28.4 L5,19 L18.4,17.4 Z"
      fill="#FFD23F"
    />
    <Face x={24} y={24} s={0.9} />
  </g>
);

const Rocket = () => (
  <g {...STROKE}>
    <path d="M24,4 q9,7 9,20 q0,7 -3,11 L18,35 q-3,-4 -3,-11 q0,-13 9,-20z" fill="#F4F6FB" />
    <path d="M24,4 q9,7 9,20 q0,7 -3,11 l-6,0 q0,-14 0,-31z" fill="#E3E7F2" strokeWidth={1.4} />
    <path d="M24,4 q4.5,3.5 6.5,9 l-13,0 q2,-5.5 6.5,-9z" fill="#FF5A8C" strokeWidth={1.6} />
    <circle cx="24" cy="21" r="4.6" fill="#9B5DE5" />
    <circle cx="24" cy="21" r="2.6" fill="#CBB2F2" strokeWidth={1.2} />
    <path d="M18,30 l-6,7 q6,2 8,-2 M30,30 l6,7 q-6,2 -8,-2" fill="#FF5A8C" strokeWidth={1.6} />
    <path d="M20,39 q4,7 8,0 q-4,3 -8,0z" fill="#FFB020" strokeWidth={1.6} />
  </g>
);

const Ufo = () => (
  <g {...STROKE}>
    <path d="M14,20 a10,10 0 0 1 20,0z" fill="#BFE8F7" />
    <ellipse cx="24" cy="25" rx="19" ry="8" fill="#9B5DE5" />
    <ellipse cx="24" cy="23" rx="19" ry="7" fill="#A76BF0" strokeWidth={1.6} />
    {[12, 19, 29, 36].map((x) => (
      <circle key={x} cx={x} cy={26} r="2" fill="#FFD23F" strokeWidth={1.2} />
    ))}
    <circle cx="20" cy="16" r="1.6" fill={OUT} stroke="none" />
    <circle cx="28" cy="16" r="1.6" fill={OUT} stroke="none" />
  </g>
);

const Moon = () => (
  <g {...STROKE}>
    <path d="M30,5 a19,19 0 1 0 13,33 a15,15 0 0 1 -13,-33z" fill="#FFD23F" />
    <circle cx="21" cy="20" r="1.6" fill={OUT} stroke="none" />
    <circle cx="14" cy="26" r="1.6" fill={OUT} stroke="none" />
    <path d="M15,32 q3,3 6,0.5" fill="none" strokeWidth={1.6} />
    <circle cx="33" cy="16" r="2.4" fill="#F2B33C" strokeWidth={1.2} />
    <circle cx="36" cy="27" r="1.6" fill="#F2B33C" strokeWidth={1.2} />
  </g>
);

const Comet = () => (
  <g {...STROKE}>
    <path d="M6,10 L26,20 M4,20 L24,25 M8,30 L25,30" stroke="#FFB020" strokeWidth={3.4} fill="none" />
    <circle cx="32" cy="26" r="10.5" fill="#FFC93C" />
    <Face x={32} y={25} s={0.8} />
  </g>
);

/* ── candy ──────────────────────────────────────────────────── */

const Candy = () => (
  <g {...STROKE}>
    <path d="M13,17 L5,11 L7,20 L5,29 L13,23" fill="#FF8AB8" />
    <path d="M35,17 L43,11 L41,20 L43,29 L35,23" fill="#FF8AB8" />
    <circle cx="24" cy="20" r="11" fill="#FF5A8C" />
    <path d="M17,13 q3,7 1,14 M24,9.3 v21 M31,13 q-3,7 -1,14" stroke="#FFD7E6" strokeWidth={2.6} fill="none" />
  </g>
);

const Lollipop = () => (
  <g {...STROKE}>
    <rect x="22.4" y="26" width="3.2" height="17" rx="1.6" fill="#E8B98B" strokeWidth={1.6} />
    <circle cx="24" cy="17" r="12" fill="#FF5A8C" />
    <path d="M24,17 a4.5,4.5 0 0 1 4.5,-4.5 a4.5,4.5 0 0 1 4.5,4.5 a9,9 0 0 1 -18,0 a13.5,13.5 0 0 1 13.5,-11.5"
      fill="none" stroke="#FFD7E6" strokeWidth={2.8} strokeLinecap="round" />
    <circle cx="24" cy="17" r="12" fill="none" />
  </g>
);

const Cupcake = () => (
  <g {...STROKE}>
    <path d="M12,25 L36,25 L33,42 L15,42 Z" fill="#FF8AB8" />
    <path d="M18,25 L19,42 M24,25 L24,42 M30,25 L29,42" stroke="#E85D9A" strokeWidth={1.6} />
    <path d="M11,25 q-2,-9 7,-9 q1,-7 8,-6 q6,-4 9,3 q7,1 5,8 q1,4 -4,4 L13,25 q-3,0 -2,0z" fill="#FFF3E0" />
    <circle cx="24" cy="9" r="3" fill="#D63A6C" strokeWidth={1.5} />
  </g>
);

const Donut = () => (
  <g {...STROKE}>
    <circle cx="24" cy="26" r="15" fill="#F2B33C" />
    <path d="M11,22 a14,12 0 0 1 26,0 q-3,-4 -6,0 q-3,4 -7,0 q-4,-4 -7,0 q-3,4 -6,0z" fill="#FF8AB8" />
    <path d="M11,22 a14,12 0 0 1 26,0" fill="none" strokeWidth={1.6} stroke="#E85D9A" />
    <circle cx="24" cy="27" r="4.6" fill="#FFF7E6" />
    <rect x="15" y="18" width="3.4" height="1.8" rx="0.9" fill="#58CC02" stroke="none" transform="rotate(-24 16.7 18.9)" />
    <rect x="29" y="17" width="3.4" height="1.8" rx="0.9" fill="#2EC4B6" stroke="none" transform="rotate(18 30.7 17.9)" />
    <rect x="33" y="26" width="3.4" height="1.8" rx="0.9" fill="#FFD23F" stroke="none" transform="rotate(-30 34.7 26.9)" />
  </g>
);

const Cookie = () => (
  <g {...STROKE}>
    <circle cx="24" cy="25" r="14.5" fill="#E0A860" />
    <circle cx="24" cy="25" r="14.5" fill="none" />
    <circle cx="19" cy="20" r="2.1" fill="#6B4226" stroke="none" />
    <circle cx="29" cy="23" r="2.3" fill="#6B4226" stroke="none" />
    <circle cx="22" cy="30" r="2.1" fill="#6B4226" stroke="none" />
    <circle cx="30.5" cy="30.5" r="1.6" fill="#6B4226" stroke="none" />
    <circle cx="16.5" cy="27" r="1.4" fill="#6B4226" stroke="none" />
  </g>
);

/* ── fruit & veg ────────────────────────────────────────────── */

const Apple = () => (
  <g {...STROKE}>
    <path d="M24,13 q10,-4 13,5 q3,10 -4,18 q-4,5 -9,3 q-5,2 -9,-3 q-7,-8 -4,-18 q3,-9 13,-5z" fill="#F0564E" />
    <path d="M24,13 q0,-5 3,-7" fill="none" strokeWidth={2.2} />
    <path d="M27,7 q6,-2 7,3 q-5,3 -7,-3z" fill="#58CC02" strokeWidth={1.6} />
    <ellipse cx="18" cy="21" rx="2.6" ry="4" fill="#FF9A94" stroke="none" opacity={0.8} />
  </g>
);

const Banana = () => (
  <g {...STROKE}>
    <path d="M9,14 q-2,16 12,22 q13,5 18,-4 q-4,1 -10,-2 q-12,-6 -14,-17 q-1,-4 -6,1z" fill="#FFD23F" />
    <path d="M9,14 l-2,-3 M39,32 l3,1" strokeWidth={2.4} />
    <path d="M14,18 q2,10 12,15" fill="none" stroke="#E8B23C" strokeWidth={1.6} />
  </g>
);

const Grapes = () => (
  <g {...STROKE}>
    <path d="M24,9 q0,-4 4,-5" fill="none" strokeWidth={2} />
    <path d="M26,6 q6,-3 8,2 q-5,4 -8,-2z" fill="#58CC02" strokeWidth={1.5} />
    {[
      [18, 18], [30, 18],
      [14, 26], [24, 25], [34, 26],
      [19, 33], [29, 33],
      [24, 39],
    ].map(([x, y], i) => (
      <circle key={i} cx={x} cy={y} r="5.2" fill="#9B5DE5" strokeWidth={1.6} />
    ))}
    <circle cx="16" cy="16" r="1.3" fill="#fff" stroke="none" opacity={0.7} />
  </g>
);

const Strawberry = () => (
  <g {...STROKE}>
    <path d="M24,12 C33,12 39,17 38,25 C37,33 30,41 24,43 C18,41 11,33 10,25 C9,17 15,12 24,12z" fill="#F0564E" />
    <path d="M16,11 q8,-5 16,0 q-3,4 -8,4 q-5,0 -8,-4z" fill="#58CC02" />
    <path d="M24,6 v5" strokeWidth={2} />
    {[
      [18, 22], [26, 20], [31, 26], [20, 30], [26, 33], [15, 27],
    ].map(([x, y], i) => (
      <path key={i} d={`M${x},${y} l1.4,2.4 h-2.8z`} fill="#FFD7A0" stroke="none" />
    ))}
  </g>
);

const Carrot = () => (
  <g {...STROKE}>
    <path d="M18,16 L30,16 L26,42 q-2,3 -4,0 Z" fill="#FF8A2A" />
    <path d="M20,24 h7 M21,32 h5" stroke="#E0701A" strokeWidth={1.5} />
    <path d="M24,15 q-1,-8 -8,-10 q6,-1 9,4 q1,-5 7,-6 q-4,3 -4,8 q3,-2 6,-1 q-5,2 -6,5z" fill="#58CC02" strokeWidth={1.5} />
  </g>
);

const Broccoli = () => (
  <g {...STROKE}>
    <path d="M20,30 h8 l-1,12 q-3,2 -6,0z" fill="#B8E986" strokeWidth={1.6} />
    <circle cx="15" cy="24" r="7" fill="#58CC02" />
    <circle cx="24" cy="18" r="8.5" fill="#58CC02" />
    <circle cx="33" cy="24" r="7" fill="#58CC02" />
    <circle cx="19" cy="17" r="1.5" fill="#3F9A00" stroke="none" />
    <circle cx="27" cy="15" r="1.5" fill="#3F9A00" stroke="none" />
    <circle cx="31" cy="22" r="1.5" fill="#3F9A00" stroke="none" />
    <circle cx="15" cy="27" r="1.5" fill="#3F9A00" stroke="none" />
  </g>
);

const Corn = () => (
  <g {...STROKE}>
    <path d="M24,8 C31,8 35,15 35,24 C35,33 30,40 24,42 C18,40 13,33 13,24 C13,15 17,8 24,8z" fill="#FFD23F" />
    <path d="M24,10 v30 M17,16 q7,3 14,0 M15,25 q9,3 18,0 M17,33 q7,3 14,0" stroke="#E8B23C" strokeWidth={1.5} fill="none" />
    <path d="M14,12 q-6,10 0,26 q-8,-4 -8,-14 q0,-9 8,-12z" fill="#7ED957" />
    <path d="M34,12 q6,10 0,26 q8,-4 8,-14 q0,-9 -8,-12z" fill="#7ED957" />
  </g>
);

const Chili = () => (
  <g {...STROKE}>
    <path d="M30,12 q10,3 6,14 q-4,12 -18,16 q-8,2 -11,-3 q10,0 16,-8 q5,-7 2,-13 q-2,-5 5,-6z" fill="#F0564E" />
    <path d="M30,12 q-4,-2 -7,1" fill="none" strokeWidth={2} />
    <path d="M24,8 q4,-4 9,-2 q-2,5 -7,5z" fill="#58CC02" strokeWidth={1.5} />
  </g>
);

/* ── pets ───────────────────────────────────────────────────── */

const Dog = () => (
  <g {...STROKE}>
    <path d="M11,16 q-5,2 -4,10 q1,7 7,6" fill="#E8B98B" strokeWidth={1.6} />
    <path d="M37,16 q5,2 4,10 q-1,7 -7,6" fill="#E8B98B" strokeWidth={1.6} />
    <circle cx="24" cy="24" r="13" fill="#E8B98B" />
    <ellipse cx="24" cy="30" rx="7.5" ry="5.5" fill="#F8E3C4" strokeWidth={1.4} />
    <ellipse cx="24" cy="28.5" rx="2.8" ry="2.1" fill={OUT} stroke="none" />
    <path d="M24,30.5 v2.5 M24,33 q-2.5,2.6 -5,0.6 M24,33 q2.5,2.6 5,0.6" fill="none" strokeWidth={1.5} />
    <circle cx="18.5" cy="21" r="1.7" fill={OUT} stroke="none" />
    <circle cx="29.5" cy="21" r="1.7" fill={OUT} stroke="none" />
    <ellipse cx="15.6" cy="25.4" rx="2" ry="1.3" fill="#FF8A80" opacity={0.5} stroke="none" />
    <ellipse cx="32.4" cy="25.4" rx="2" ry="1.3" fill="#FF8A80" opacity={0.5} stroke="none" />
  </g>
);

const Cat = () => (
  <g {...STROKE}>
    <path d="M11,15 L9,5 L19,10 M37,15 L39,5 L29,10" fill="#F2A65A" strokeWidth={1.8} />
    <circle cx="24" cy="24" r="13.5" fill="#F2A65A" />
    <path d="M24,28.5 l-2.4,2.2 q2.4,1.6 4.8,0z" fill={OUT} stroke="none" />
    <path d="M20,31 q4,2.6 8,0" fill="none" strokeWidth={1.5} />
    <circle cx="18.5" cy="21.5" r="1.7" fill={OUT} stroke="none" />
    <circle cx="29.5" cy="21.5" r="1.7" fill={OUT} stroke="none" />
    <path d="M8,24 h7 M8.6,28 l6.6,-1.6 M40,24 h-7 M39.4,28 l-6.6,-1.6" stroke={OUT} strokeWidth={1.3} />
  </g>
);

const Rabbit = () => (
  <g {...STROKE}>
    <ellipse cx="17" cy="9" rx="4.2" ry="9" fill="#F4F6FB" />
    <ellipse cx="31" cy="9" rx="4.2" ry="9" fill="#F4F6FB" />
    <ellipse cx="17" cy="10" rx="1.9" ry="5.6" fill="#FFB6C8" stroke="none" />
    <ellipse cx="31" cy="10" rx="1.9" ry="5.6" fill="#FFB6C8" stroke="none" />
    <circle cx="24" cy="26" r="12.5" fill="#F4F6FB" />
    <ellipse cx="24" cy="30" rx="2.6" ry="1.9" fill="#FF8A98" strokeWidth={1.4} />
    <path d="M24,32 v1.8 M24,33.8 q-2,2 -4,0.4 M24,33.8 q2,2 4,0.4" fill="none" strokeWidth={1.4} />
    <circle cx="18.5" cy="24" r="1.7" fill={OUT} stroke="none" />
    <circle cx="29.5" cy="24" r="1.7" fill={OUT} stroke="none" />
  </g>
);

const Mouse = () => (
  <g {...STROKE}>
    <circle cx="9" cy="16" r="6.4" fill="#B9C0E8" strokeWidth={1.6} />
    <circle cx="39" cy="16" r="6.4" fill="#B9C0E8" strokeWidth={1.6} />
    <circle cx="9" cy="16" r="3" fill="#FFB6C8" stroke="none" />
    <circle cx="39" cy="16" r="3" fill="#FFB6C8" stroke="none" />
    <circle cx="24" cy="26" r="12" fill="#B9C0E8" />
    <ellipse cx="24" cy="31.5" rx="2.2" ry="1.6" fill="#FF8A98" strokeWidth={1.3} />
    <circle cx="19" cy="23.5" r="1.6" fill={OUT} stroke="none" />
    <circle cx="29" cy="23.5" r="1.6" fill={OUT} stroke="none" />
    <path d="M36,34 q8,2 7,-6" fill="none" strokeWidth={1.8} />
  </g>
);

/* ── farm ───────────────────────────────────────────────────── */

const Cow = () => (
  <g {...STROKE}>
    <path d="M12,12 q-4,-6 2,-7 q4,-1 4,5 M36,12 q4,-6 -2,-7 q-4,-1 -4,5" fill="#F4F6FB" strokeWidth={1.6} />
    <circle cx="24" cy="24" r="13.5" fill="#F4F6FB" />
    <path d="M13,18 a13.5,13.5 0 0 1 9,-7.3 q6,4 2,9 q-6,3 -11,-1.7z" fill="#6B4A32" stroke="none" />
    <path d="M35,18 a13.5,13.5 0 0 0 -7,-7 q-3,5 2,8.6 q3,1.4 5,-1.6z" fill="#6B4A32" stroke="none" />
    <ellipse cx="24" cy="31" rx="8" ry="5.6" fill="#FFB6C8" strokeWidth={1.4} />
    <circle cx="21" cy="30.6" r="1.3" fill={OUT} stroke="none" />
    <circle cx="27" cy="30.6" r="1.3" fill={OUT} stroke="none" />
    <circle cx="17" cy="19.5" r="1.7" fill={OUT} stroke="none" />
    <circle cx="31" cy="19.5" r="1.7" fill={OUT} stroke="none" />
  </g>
);

const Pig = () => (
  <g {...STROKE}>
    <path d="M12,13 L8,6 L17,9 M36,13 L40,6 L31,9" fill="#FFA7C4" strokeWidth={1.7} />
    <circle cx="24" cy="24" r="13.5" fill="#FFA7C4" />
    <ellipse cx="24" cy="29" rx="6.4" ry="4.8" fill="#FF7BAA" strokeWidth={1.4} />
    <circle cx="21.8" cy="29" r="1.2" fill={OUT} stroke="none" />
    <circle cx="26.2" cy="29" r="1.2" fill={OUT} stroke="none" />
    <circle cx="18.5" cy="21.5" r="1.7" fill={OUT} stroke="none" />
    <circle cx="29.5" cy="21.5" r="1.7" fill={OUT} stroke="none" />
    <ellipse cx="15.4" cy="25.6" rx="2" ry="1.3" fill="#FF6E9E" opacity={0.6} stroke="none" />
    <ellipse cx="32.6" cy="25.6" rx="2" ry="1.3" fill="#FF6E9E" opacity={0.6} stroke="none" />
  </g>
);

const Chicken = () => (
  <g {...STROKE}>
    <circle cx="24" cy="14" r="6.5" fill="#F4F6FB" />
    <path d="M20,8 q1,-4 4,-3 q1,-3 4,-1 q-1,3 -4,3" fill="#F0564E" strokeWidth={1.4} />
    <circle cx="24" cy="28" r="12" fill="#F4F6FB" />
    <path d="M24,11.5 l3.4,1.8 -3.4,1.8z" fill="#FFB020" strokeWidth={1.3} />
    <circle cx="21.5" cy="13.5" r="1.4" fill={OUT} stroke="none" />
    <path d="M30,26 q6,1 5,7 q-1,5 -6,4" fill="#F2C89B" strokeWidth={1.5} />
    <path d="M20,40 v4 M28,40 v4" stroke="#FFB020" strokeWidth={2.4} />
  </g>
);

const Sheep = () => (
  <g {...STROKE}>
    {[
      [14, 16, 6], [24, 12, 7], [34, 16, 6], [11, 25, 5.6], [37, 25, 5.6], [16, 31, 6], [32, 31, 6], [24, 33, 7],
    ].map(([x, y, r], i) => (
      <circle key={i} cx={x} cy={y} r={r} fill="#F4F6FB" strokeWidth={1.5} />
    ))}
    <circle cx="24" cy="24" r="8.2" fill="#6B4A32" />
    <Face x={24} y={23} s={0.72} blush={false} />
  </g>
);

/* ── bugs ───────────────────────────────────────────────────── */

const Bee = () => (
  <g {...STROKE}>
    <ellipse cx="16" cy="14" rx="7" ry="5" fill="#CBE9F7" strokeWidth={1.5} transform="rotate(-28 16 14)" />
    <ellipse cx="32" cy="14" rx="7" ry="5" fill="#CBE9F7" strokeWidth={1.5} transform="rotate(28 32 14)" />
    <ellipse cx="24" cy="27" rx="12" ry="10" fill="#FFD23F" />
    <path d="M20,17.6 q-3,9.4 0,18.8 M28,17.6 q3,9.4 0,18.8" fill="none" strokeWidth={1.5} />
    <path d="M18.5,23 h-12 M18.5,31 h-12 M29.5,23 h12 M29.5,31 h12" fill="none" strokeWidth={2.6} stroke="#4A2F1B" />
    <path d="M36,27 l4,0" strokeWidth={2} />
    <circle cx="42.4" cy="27" r="1.2" fill={OUT} stroke="none" />
    <Face x={13.4} y={26} s={0.6} blush={false} />
  </g>
);

const Ladybug = () => (
  <g {...STROKE}>
    <circle cx="24" cy="13" r="5" fill={OUT} stroke="none" />
    <path d="M24,14 C34,14 39,21 38,29 C37,37 31,42 24,42 C17,42 11,37 10,29 C9,21 14,14 24,14z" fill="#F0564E" />
    <path d="M24,14 v28" strokeWidth={1.5} />
    <circle cx="17" cy="24" r="2.4" fill={OUT} stroke="none" />
    <circle cx="31" cy="24" r="2.4" fill={OUT} stroke="none" />
    <circle cx="19" cy="34" r="1.8" fill={OUT} stroke="none" />
    <circle cx="29" cy="34" r="1.8" fill={OUT} stroke="none" />
    <path d="M20,9 q-2,-4 -5,-4 M28,9 q2,-4 5,-4" fill="none" strokeWidth={1.5} />
  </g>
);

const Snail = () => (
  <g {...STROKE}>
    <path d="M6,38 q10,3 20,0 q6,-2 6,-8" fill="none" strokeWidth={5} stroke="#FFD1A1" />
    <path d="M6,38 q10,3 20,0 q6,-2 6,-8" fill="none" strokeWidth={1.5} />
    <circle cx="34" cy="22" r="11" fill="#FF8AB8" />
    <path d="M34,22 a11,11 0 0 1 -8,-10.5 M34,22 a6,6 0 0 1 5,6 M34,22 a3,3 0 0 0 -3,-4" fill="none" stroke="#E85D9A" strokeWidth={1.6} />
    <path d="M9,32 q-3,-6 0,-10 M13,33 q-1,-4 1,-7" fill="none" strokeWidth={1.5} />
    <circle cx="9" cy="20" r="1.4" fill={OUT} stroke="none" />
    <circle cx="14.4" cy="24" r="1.4" fill={OUT} stroke="none" />
  </g>
);

/* ── woodland (v4) ─────────────────────────────────────────── */

const Frog = () => (
  <g {...STROKE}>
    <circle cx="13" cy="15" r="6" fill="#7ED957" />
    <circle cx="35" cy="15" r="6" fill="#7ED957" />
    <circle cx="13" cy="15" r="2.4" fill={OUT} stroke="none" />
    <circle cx="35" cy="15" r="2.4" fill={OUT} stroke="none" />
    <circle cx="13" cy="14" r="0.9" fill="#fff" stroke="none" />
    <circle cx="35" cy="14" r="0.9" fill="#fff" stroke="none" />
    <ellipse cx="24" cy="26" rx="14" ry="11.5" fill="#7ED957" />
    <path d="M18,30 q6,5 12,0" fill="none" strokeWidth={1.8} />
    <circle cx="20.5" cy="29.4" r="1" fill={OUT} stroke="none" />
    <circle cx="27.5" cy="29.4" r="1" fill={OUT} stroke="none" />
    <ellipse cx="24" cy="23.5" rx="6.5" ry="3.4" fill="#D9F7C5" strokeWidth={1.4} />
    <circle cx="21.6" cy="23.5" r="1.1" fill={OUT} stroke="none" />
    <circle cx="26.4" cy="23.5" r="1.1" fill={OUT} stroke="none" />
    <path d="M12,35 q-4,3 -6,1 M36,35 q4,3 6,1" fill="none" strokeWidth={2.2} />
  </g>
);

const Fox = () => (
  <g {...STROKE}>
    <path d="M11,17 L8,6 L19,11 Z" fill="#FF9D5C" />
    <path d="M37,17 L40,6 L29,11 Z" fill="#FF9D5C" />
    <path d="M11.6,15.4 L10,9 L16.5,12 Z" fill="#FFE9C7" strokeWidth={1.2} />
    <path d="M36.4,15.4 L38,9 L31.5,12 Z" fill="#FFE9C7" strokeWidth={1.2} />
    <ellipse cx="24" cy="26" rx="15" ry="12" fill="#FF9D5C" />
    <path d="M13.5,20 Q24,15 34.5,20 L30,34 Q24,37 18,34 Z" fill="#FFE9C7" strokeWidth={1.4} />
    <circle cx="18.5" cy="23.5" r="1.6" fill={OUT} stroke="none" />
    <circle cx="29.5" cy="23.5" r="1.6" fill={OUT} stroke="none" />
    <circle cx="19.3" cy="22.9" r="0.55" fill="#fff" stroke="none" />
    <circle cx="30.3" cy="22.9" r="0.55" fill="#fff" stroke="none" />
    <ellipse cx="24" cy="30" rx="2.6" ry="1.9" fill="#4A2F1B" stroke="none" />
    <path d="M22.6,32.6 q1.4,1.3 2.8,0" fill="none" strokeWidth={1.4} />
  </g>
);

const Owl = () => (
  <g {...STROKE}>
    <path d="M10,14 L15,4 L20,11 Z" fill="#9B7653" />
    <path d="M38,14 L33,4 L28,11 Z" fill="#9B7653" />
    <ellipse cx="24" cy="25" rx="15.5" ry="15" fill="#9B7653" />
    <ellipse cx="24" cy="29" rx="10.5" ry="10" fill="#F2D3AC" strokeWidth={1.4} />
    <circle cx="18" cy="19" r="5.6" fill="#fff" />
    <circle cx="30" cy="19" r="5.6" fill="#fff" />
    <circle cx="18" cy="19.6" r="2.6" fill={OUT} stroke="none" />
    <circle cx="30" cy="19.6" r="2.6" fill={OUT} stroke="none" />
    <circle cx="18.9" cy="18.7" r="0.9" fill="#fff" stroke="none" />
    <circle cx="30.9" cy="18.7" r="0.9" fill="#fff" stroke="none" />
    <path d="M24,22.5 L21.8,26.5 L26.2,26.5 Z" fill="#FFB020" />
    <path d="M20,33 q2,-2 4,0 q2,-2 4,0" fill="none" strokeWidth={1.4} />
    <path d="M14,31 q-1.5,4 1,6 M34,31 q1.5,4 -1,6" fill="none" strokeWidth={2} />
  </g>
);

/* ── road ───────────────────────────────────────────────────── */

const Lion = () => (
  <g {...STROKE}>
    {Array.from({ length: 10 }, (_, i) => {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      return (
        <circle
          key={i}
          cx={24 + 12.8 * Math.cos(a)}
          cy={24 + 12.8 * Math.sin(a)}
          r={5.4}
          fill="#FFB020"
        />
      );
    })}
    <circle cx="24" cy="24" r="13.6" fill="#FFC93C" />
    <circle cx="24" cy="24" r="9.8" fill="#FFDE8A" strokeWidth={1.4} />
    <Face x={24} y={23} s={0.78} />
    <path d="M24,27.2 l-1.9,-2 h3.8z" fill={OUT} strokeWidth={1.1} />
  </g>
);

const Car = () => (
  <g {...STROKE}>
    <path d="M7,30 q0,-6 6,-7 l3,-6 q1,-3 5,-3 h8 q4,0 5,3 l3,6 q6,1 6,7 v3 q0,2 -2,2 H9 q-2,0 -2,-2z" fill="#F0564E" />
    <path d="M18,17 h5 v6 h-8z M26,17 h4 l3,6 h-7z" fill="#BFE8F7" strokeWidth={1.4} />
    <circle cx="15" cy="36" r="4.4" fill="#4A2F1B" />
    <circle cx="15" cy="36" r="1.8" fill="#B9C0E8" stroke="none" />
    <circle cx="33" cy="36" r="4.4" fill="#4A2F1B" />
    <circle cx="33" cy="36" r="1.8" fill="#B9C0E8" stroke="none" />
  </g>
);

const Bus = () => (
  <g {...STROKE}>
    <rect x="6" y="12" width="36" height="22" rx="5" fill="#FFB020" />
    <path d="M10,17 h6 v6 h-6z M19,17 h6 v6 h-6z M28,17 h6 v6 h-6z" fill="#BFE8F7" strokeWidth={1.4} />
    <rect x="6" y="27" width="36" height="3" fill="#E08C00" stroke="none" />
    <circle cx="15" cy="36" r="4.2" fill="#4A2F1B" />
    <circle cx="15" cy="36" r="1.7" fill="#B9C0E8" stroke="none" />
    <circle cx="33" cy="36" r="4.2" fill="#4A2F1B" />
    <circle cx="33" cy="36" r="1.7" fill="#B9C0E8" stroke="none" />
  </g>
);

const Tractor = () => (
  <g {...STROKE}>
    <rect x="20" y="16" width="18" height="12" rx="3" fill="#58CC02" />
    <path d="M24,16 v-5 h5 v5" fill="none" strokeWidth={3.4} stroke="#4A2F1B" />
    <path d="M8,28 h24 v-4 h8 v8 q0,3 -3,3 H11 q-3,0 -3,-3z" fill="#3F9A00" strokeWidth={1.6} />
    <circle cx="14" cy="35" r="7.5" fill="#FF8A2A" />
    <circle cx="14" cy="35" r="2.6" fill="#FFD7A0" strokeWidth={1.3} />
    <circle cx="34" cy="37" r="4.6" fill="#FF8A2A" strokeWidth={1.8} />
    <circle cx="34" cy="37" r="1.6" fill="#FFD7A0" stroke="none" />
  </g>
);

/* ── catalog ────────────────────────────────────────────────── */

const CATALOG: Record<StickerId, () => React.ReactElement> = {
  monkey: Monkey, parrot: Parrot, elephant: Elephant, butterfly: Butterfly, flower: Flower,
  fish: Fish, octopus: Octopus, crab: Crab, dolphin: Dolphin, shell: Shell,
  star: Star, rocket: Rocket, ufo: Ufo, moon: Moon, comet: Comet,
  candy: Candy, lollipop: Lollipop, cupcake: Cupcake, donut: Donut, cookie: Cookie,
  apple: Apple, banana: Banana, grapes: Grapes, strawberry: Strawberry,
  carrot: Carrot, broccoli: Broccoli, corn: Corn, chili: Chili,
  dog: Dog, cat: Cat, rabbit: Rabbit, mouse: Mouse,
  frog: Frog, fox: Fox, owl: Owl,
  cow: Cow, pig: Pig, chicken: Chicken, sheep: Sheep,
  bee: Bee, ladybug: Ladybug, snail: Snail,
  car: Car, bus: Bus, tractor: Tractor,
  lion: Lion,
};

export const STICKER_IDS = Object.keys(CATALOG) as StickerId[];

export function isStickerId(s: string): s is StickerId {
  return s in CATALOG;
}

export function Sticker({
  id,
  size = 40,
  className = "",
  title,
}: {
  id: StickerId;
  size?: number;
  className?: string;
  title?: string;
}) {
  const Art = CATALOG[id] ?? Star;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={className}
      role="img"
      aria-label={title ?? id}
    >
      <Art />
    </svg>
  );
}

/** Counting / odd-one tile: sticker on a wobbly white plate. */
export function StickerTile({
  id,
  size = 64,
  delay = 0,
  animateIn = true,
}: {
  id: StickerId;
  size?: number;
  delay?: number;
  animateIn?: boolean;
}) {
  return (
    <motion.span
      initial={animateIn ? { scale: 0, rotate: -14 } : false}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ delay, type: "spring", stiffness: 320, damping: 16 }}
      className="inline-flex items-center justify-center rounded-2xl border-[2.5px] border-leo-line bg-white shadow-[0_3px_0_rgba(214,178,110,0.3)]"
      style={{ width: size, height: size }}
    >
      <Sticker id={id} size={size * 0.72} />
    </motion.span>
  );
}
