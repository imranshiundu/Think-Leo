/**
 * Think Leo — Question Factory
 * ───────────────────────────
 * Every puzzle is GENERATED, never stored:
 *   seed = hash(levelIdx, attempt, questionIndex)  →  mulberry32 RNG
 * so a question set is reproducible inside one attempt, but every new
 * attempt feels fresh. Difficulty (1..6) scales numbers, rules and
 * distractors. See docs/ALGORITHM.md §4–5.
 *
 * All art is referenced by sticker id (see components/leo/stickers.tsx) —
 * the factory never ships emoji strings.
 */

import { clamp, questionTime, worldOf } from "./game";
import type { StickerId } from "@/components/leo/stickers";

export type QKind =
  | "count"
  | "addsub"
  | "compare"
  | "oddOne"
  | "sequence"
  | "multiply"
  | "truefalse"
  | "memory"
  // v4 — hands-on games ("kids get to DO something", not just numbers)
  | "tapTarget" // tap every monkey in a mixed crowd — reaction + scanning
  | "shadow" // match the animal to its silhouette — visual discrimination
  | "pattern" // colour+shape patterns — pre-math logic without digits
  | "feedLeo"; // drop exactly N snacks into Leo's bowl — counting you can feel

export interface Question {
  key: string;
  kind: QKind;
  prompt: string; // kid-facing instruction
  display?: string; // big centered formula, e.g. "7 + 5 = ?"
  tiles?: StickerId[]; // count grid / odd-one board / tapTarget crowd
  ask?: StickerId; // shadow: the animal to match
  seq?: (string | number)[]; // sequence tiles, "?" last
  seqTokens?: string[]; // pattern: "circle-red" tokens, "?" last
  pads?: number[]; // memory: pad indices (0..3) in order
  want?: number; // feedLeo: how many snacks Leo wants
  options: string[]; // numbers, "TRUE!"/"NOPE!", sticker ids or pattern tokens
  groupOptions?: [StickerId[], StickerId[]]; // compare options rendered as plates
  answer: number; // index into options (-1 for judge-yourself mini-games)
  time: number; // seconds on the clock
  diff: number;
  tip: string; // Leo's gentle hint when missed
}

/* ── deterministic RNG ─────────────────────────────────────────── */

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function rng(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash3(a: number, b: number, c: number): number {
  let h = 2166136261 ^ Math.imul(a + 1, 16777619);
  h = Math.imul(h ^ (b + 7), 2246822519);
  h = Math.imul(h ^ (c + 3), 3266489917);
  return h >>> 0;
}

type Rng = () => number;
const irnd = (rng: Rng, lo: number, hi: number) =>
  lo + Math.floor(rng() * (hi - lo + 1));
const oneOf = <T,>(rng: Rng, arr: readonly T[]): T =>
  arr[Math.floor(rng() * arr.length)];

function shuffled<T>(rng: Rng, arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Unique numeric near-miss distractors around `correct`. */
function nearMisses(
  rng: Rng,
  correct: number,
  n: number,
  span: number,
  min = 0
): number[] {
  const out = new Set<number>();
  let guard = 0;
  while (out.size < n && guard++ < 120) {
    const delta = irnd(rng, 1, span) * (rng() < 0.5 ? -1 : 1);
    const v = correct + delta;
    if (v >= min && v !== correct) out.add(v);
  }
  let bump = 1;
  while (out.size < n) out.add(correct + span + bump++);
  return [...out];
}

/** Build 4 options [..3 distractors, correct] shuffled; returns options + answer idx. */
function numOptions(
  rng: Rng,
  correct: number,
  span: number,
  min = 0
): { options: string[]; answer: number } {
  const all = shuffled(rng, [correct, ...nearMisses(rng, correct, 3, span, min)]);
  return { options: all.map(String), answer: all.indexOf(correct) };
}

/* ── world-flavoured sticker pools ──────────────────────────────── */

/** Also used for ambient cartoons & victory parades (see components/game/ambient.tsx). */
export const WORLD_TILES: StickerId[][] = [
  ["monkey", "parrot", "butterfly", "flower", "elephant"],
  ["fish", "octopus", "crab", "dolphin", "shell"],
  ["star", "rocket", "ufo", "moon", "comet"],
  ["candy", "lollipop", "cupcake", "donut", "cookie"],
];

/** Odd-one families: 4+ members, `similar` = look-alike category indexes. */
const ODD_GROUPS: { set: StickerId[]; similar: number[] }[] = [
  { set: ["apple", "banana", "grapes", "strawberry"], similar: [1] }, // fruit ~ veg
  { set: ["carrot", "broccoli", "corn", "chili"], similar: [0] },
  { set: ["dog", "cat", "rabbit", "mouse"], similar: [3] }, // pets ~ farm
  { set: ["cow", "pig", "chicken", "sheep"], similar: [2] },
  { set: ["fish", "octopus", "crab", "dolphin"], similar: [5] }, // sea ~ bugs
  { set: ["butterfly", "bee", "ladybug", "snail"], similar: [4] },
  { set: ["car", "bus", "tractor"], similar: [7] }, // road ~ space
  { set: ["rocket", "ufo", "moon", "comet"], similar: [6] },
];

/* ── generators ─────────────────────────────────────────────────── */

/** Every creature-ish sticker, for shadow matching. */
const ANIMALS: StickerId[] = [
  "monkey", "parrot", "elephant", "dog", "cat", "rabbit", "mouse",
  "cow", "pig", "chicken", "sheep", "frog", "fox", "owl",
];

function genCount(rng: Rng, diff: number, world: number): Partial<Question> {
  const pool = WORLD_TILES[world] ?? WORLD_TILES[0];
  const e = oneOf(rng, pool);
  const n = clamp(3 + irnd(rng, 0, 2 + diff * 2), 3, 16);
  const tiles = Array.from({ length: n }, () => e);
  const { options, answer } = numOptions(rng, n, Math.min(4, 1 + Math.ceil(diff / 2)), 1);
  return {
    prompt: "How many do you see?",
    tiles,
    options,
    answer,
    tip: "Touch each one and count out loud!",
  };
}

function genAddSub(rng: Rng, diff: number): Partial<Question> {
  let display: string;
  let correct: number;
  if (diff >= 5) {
    const a = irnd(rng, 12, 40);
    const b = irnd(rng, 5, 30);
    const c = irnd(rng, 3, 20);
    correct = a + b - c;
    display = `${a} + ${b} − ${c} = ?`;
  } else if (diff >= 3) {
    const a = irnd(rng, 10, diff >= 4 ? 99 : 50);
    const minus = rng() < 0.45;
    const b = irnd(rng, 2, minus ? a - 1 : diff >= 4 ? 40 : 20);
    correct = minus ? a - b : a + b;
    display = `${a} ${minus ? "−" : "+"} ${b} = ?`;
  } else {
    const a = irnd(rng, 1, diff === 1 ? 9 : 20);
    const minus = diff >= 2 && rng() < 0.4;
    const b = irnd(rng, 1, minus ? a : diff === 1 ? 9 : 20);
    correct = minus ? a - b : a + b;
    display = `${a} ${minus ? "−" : "+"} ${b} = ?`;
  }
  const { options, answer } = numOptions(rng, correct, diff <= 2 ? 3 : 6, 0);
  return {
    prompt: diff >= 5 ? "Three steps — take your time!" : "Quick maths!",
    display,
    options,
    answer,
    tip: "Start from the big number and count on!",
  };
}

function genCompare(rng: Rng, diff: number, world: number): Partial<Question> {
  if (diff === 1) {
    const pool = WORLD_TILES[world] ?? WORLD_TILES[0];
    const e1 = oneOf(rng, pool);
    const e2 = oneOf(rng, pool.filter((x) => x !== e1));
    let a = irnd(rng, 2, 6);
    let b = irnd(rng, 2, 6);
    if (a === b) b = a === 6 ? 5 : a + 1;
    const bigger = Math.max(a, b);
    const groups: [StickerId[], StickerId[]] = [
      Array.from({ length: a }, () => e1),
      Array.from({ length: b }, () => e2),
    ];
    return {
      prompt: "Which plate has MORE?",
      options: [String(Math.min(a, b)), String(bigger)],
      groupOptions: [groups[0], groups[1]],
      answer: a > b ? 0 : 1,
      tip: "Line them up in rows — the longer row wins!",
    };
  }
  const lo = diff === 2 ? 1 : 10;
  const hi = diff === 2 ? 40 : diff === 3 ? 99 : 999;
  let a = irnd(rng, lo, hi);
  let b = irnd(rng, lo, hi);
  if (a === b) b = a + irnd(rng, 1, 9);
  const wantBig = rng() < 0.6;
  const correct = wantBig ? Math.max(a, b) : Math.min(a, b);
  return {
    prompt: wantBig ? "Which number is BIGGER?" : "Which number is SMALLER?",
    options: [String(a), String(b)],
    answer: a === correct ? 0 : 1,
    tip: "Bigger numbers have more digits — peek at the front!",
  };
}

function genOddOne(rng: Rng, diff: number): Partial<Question> {
  const mainIdx = irnd(rng, 0, ODD_GROUPS.length - 1);
  const main = ODD_GROUPS[mainIdx];
  let intruderIdx: number;
  if (diff >= 3 && main.similar.length && rng() < 0.7) {
    // sneaky: intruder comes from a LOOK-ALIKE category
    intruderIdx = oneOf(rng, main.similar);
  } else {
    do {
      intruderIdx = irnd(rng, 0, ODD_GROUPS.length - 1);
    } while (intruderIdx === mainIdx || main.similar.includes(intruderIdx));
  }
  const three = shuffled(rng, main.set).slice(0, 3);
  const intruder = oneOf(rng, ODD_GROUPS[intruderIdx].set);
  const tiles = shuffled(rng, [...three, intruder]);
  return {
    prompt: "One doesn't belong. Tap it!",
    tiles,
    options: tiles, // options are sticker ids, rendered as art
    answer: tiles.indexOf(intruder),
    tip: "Three are a family — who's visiting from somewhere else?",
  };
}

function genSequence(rng: Rng, diff: number): Partial<Question> {
  let seq: number[];
  let correct: number;
  let tip = "Find the secret step between numbers!";
  const mode =
    diff <= 1
      ? "step1"
      : diff === 2
        ? oneOf(rng, ["step", "back"])
        : diff === 3
          ? oneOf(rng, ["double", "step10"])
          : diff === 4
            ? oneOf(rng, ["double", "zigzag", "fib"])
            : oneOf(rng, ["fib", "zigzag", "triple"]);

  if (mode === "step1") {
    const a = irnd(rng, 1, 9);
    const r = irnd(rng, 1, 3);
    seq = [a, a + r, a + 2 * r, a + 3 * r];
    correct = a + 4 * r;
    tip = "Count forward — the same hop each time!";
  } else if (mode === "step") {
    const a = irnd(rng, 2, 15);
    const r = irnd(rng, 2, 6);
    seq = [a, a + r, a + 2 * r, a + 3 * r];
    correct = a + 4 * r;
  } else if (mode === "back") {
    const a = irnd(rng, 30, 60);
    const r = irnd(rng, 2, 6);
    seq = [a, a - r, a - 2 * r, a - 3 * r];
    correct = a - 4 * r;
    tip = "Count backwards — the hops go down!";
  } else if (mode === "step10") {
    const a = irnd(rng, 5, 40);
    seq = [a, a + 10, a + 20, a + 30];
    correct = a + 40;
    tip = "Tens love round hops!";
  } else if (mode === "double") {
    const a = irnd(rng, 1, 6);
    seq = [a, a * 2, a * 4, a * 8];
    correct = a * 16;
    tip = "Each number doubles — magic ×2!";
  } else if (mode === "triple") {
    const a = irnd(rng, 1, 4);
    seq = [a, a * 3, a * 9, a * 27];
    correct = a * 81;
    tip = "Each number triples — ×3 power!";
  } else if (mode === "zigzag") {
    const a = irnd(rng, 4, 12);
    const up = irnd(rng, 3, 8);
    const dn = irnd(rng, 1, 3);
    seq = [a, a + up, a + up - dn, a + 2 * up - dn];
    correct = a + 3 * up - 2 * dn;
    tip = "Up, down, up — watch the two steps!";
  } else {
    // fib-ish: every term is the sum of the two before it
    const a = irnd(rng, 1, 5);
    const b = irnd(rng, 1, 6);
    seq = [a, b, a + b, a + 2 * b];
    correct = a + b + (a + 2 * b);
    tip = "Each number is the two before it added!";
  }
  const { options, answer } = numOptions(
    rng,
    correct,
    Math.max(2, Math.round(Math.abs(correct) * 0.15) + 2),
    0
  );
  return {
    prompt: "What comes next?",
    seq: [...seq, "?"],
    options,
    answer,
    tip,
  };
}

function genMultiply(rng: Rng, diff: number): Partial<Question> {
  const maxF = diff <= 1 ? 3 : diff === 2 ? 5 : diff === 3 ? 6 : diff === 4 ? 9 : 12;
  const minF = diff >= 5 ? 4 : 2;
  const a = irnd(rng, minF, maxF);
  const b = irnd(rng, 2, Math.min(maxF, diff >= 5 ? 12 : 10));
  const correct = a * b;
  const pool = [correct + a, correct - a, a * (b + 1), a * (b - 1), correct + b, correct - b, correct + 1, correct - 2];
  const distractors = shuffled(rng, pool.filter((v) => v > 0 && v !== correct)).slice(0, 3);
  const all = shuffled(rng, [correct, ...distractors]);
  return {
    prompt: "Times-table blast!",
    display: `${a} × ${b} = ?`,
    options: all.map(String),
    answer: all.indexOf(correct),
    tip: `Think of ${a} groups of ${b}. Skip-count: ${a}, ${a * 2}, ${a * 3}…`,
  };
}

function genTrueFalse(rng: Rng, diff: number): Partial<Question> {
  const hi = diff <= 2 ? 10 : diff <= 3 ? 20 : 50;
  const a = irnd(rng, 2, hi);
  const b = irnd(rng, 2, diff <= 2 ? 9 : hi);
  const minus = diff >= 3 && rng() < 0.4;
  const real = minus ? a - b : a + b;
  const shown = rng() < 0.5 ? real : real + (rng() < 0.5 ? -1 : 1) * irnd(rng, 1, diff >= 4 ? 5 : 3);
  const isTrue = shown === real;
  return {
    prompt: "True… or trap?",
    display: `${a} ${minus ? "−" : "+"} ${b} = ${shown}`,
    options: ["TRUE!", "NOPE!"],
    answer: isTrue ? 0 : 1,
    tip: "Work it out yourself, then judge the claim!",
  };
}

function genMemory(rng: Rng, diff: number): Partial<Question> {
  const len = clamp(2 + diff, 3, 6);
  const pads: number[] = [];
  for (let i = 0; i < len; i++) {
    let p = irnd(rng, 0, 3);
    if (pads.length >= 2 && pads[pads.length - 1] === p && pads[pads.length - 2] === p) {
      p = (p + 1) % 4;
    }
    pads.push(p);
  }
  return {
    prompt: `Watch the pads… then repeat the song! (${len})`,
    pads,
    options: [],
    answer: -1,
    time: 6 + len * 2.5,
    tip: "Say the colours out loud — ears help eyes!",
  };
}

/* ── v4 hands-on games ──────────────────────────────────────────── */

const PATTERN_SHAPES = ["circle", "square", "triangle", "star"] as const;
const PATTERN_COLORS = [
  ["red", "#ff5a8c"],
  ["green", "#58cc02"],
  ["purple", "#9b5de5"],
  ["gold", "#ffb020"],
  ["blue", "#2ec4b6"],
] as const;

function genTapTarget(rng: Rng, diff: number, world: number): Partial<Question> {
  const pool = WORLD_TILES[world] ?? WORLD_TILES[0];
  const decoyPool = WORLD_TILES[(world + 1) % WORLD_TILES.length];
  const target = oneOf(rng, pool);
  const howMany = clamp(3 + irnd(rng, 0, 1 + Math.floor(diff / 2)), 3, 6);
  const crowdSize = clamp(9 + diff * 2, 9, 16);
  const tiles: StickerId[] = [];
  for (let i = 0; i < howMany; i++) tiles.push(target);
  while (tiles.length < crowdSize) {
    const t = rng() < 0.72 ? oneOf(rng, pool.filter((x) => x !== target)) : oneOf(rng, decoyPool);
    tiles.push(t);
  }
  return {
    prompt: `Tap all the ${target}s!`,
    tiles: shuffled(rng, tiles),
    ask: target,
    options: [],
    answer: -1,
    time: 8 + crowdSize * 1.6,
    tip: "Scan row by row — like reading, but with eyes wide open!",
  };
}

function genShadow(rng: Rng, diff: number, world: number): Partial<Question> {
  const locals = WORLD_TILES[world] ?? WORLD_TILES[0];
  const ask = oneOf(rng, ANIMALS);
  const decoys = shuffled(
    rng,
    ANIMALS.filter((a) => a !== ask).concat(locals.filter((l) => l !== ask))
  ).slice(0, Math.min(3, 2 + Math.floor(diff / 2)));
  const all = shuffled(rng, [ask, ...decoys]);
  return {
    prompt: "Whose shadow is this? Tap the match!",
    ask,
    options: all,
    answer: all.indexOf(ask),
    time: questionTime(diff),
    tip: "Look at the ears and the tail — shadows can't hide those!",
  };
}

function tokenOf(shape: string, color: string): string {
  return `${shape}-${color}`;
}

function genPattern(rng: Rng, diff: number): Partial<Question> {
  const [c1n, c1] = oneOf(rng, PATTERN_COLORS);
  let c2n = c1n,
    c2 = c1;
  while (c2n === c1n) {
    [c2n, c2] = oneOf(rng, PATTERN_COLORS);
  }
  const [c3n, c3] = oneOf(rng, PATTERN_COLORS.filter(([n]) => n !== c1n && n !== c2n));
  const s1 = oneOf(rng, PATTERN_SHAPES);
  let s2 = s1;
  while (s2 === s1) s2 = oneOf(rng, PATTERN_SHAPES);

  let unit: string[];
  let tip: string;
  if (diff <= 1) {
    unit = [tokenOf(s1, c1), tokenOf(s2, c2)];
    tip = "Two friends take turns — A, B, A, B…";
  } else if (diff === 2) {
    unit =
      rng() < 0.5
        ? [tokenOf(s1, c1), tokenOf(s1, c1), tokenOf(s2, c2)]
        : [tokenOf(s1, c1), tokenOf(s2, c2), tokenOf(s2, c2)];
    tip = "Someone loves to go twice — watch who!";
  } else if (diff === 3) {
    unit = [tokenOf(s1, c1), tokenOf(s2, c2), tokenOf(s1, c3)];
    tip = "Three friends in a circle — sing the pattern!";
  } else {
    unit = [tokenOf(s1, c1), tokenOf(s1, c1), tokenOf(s2, c2), tokenOf(s2, c2)];
    tip = "Two of each, in pairs — A, A, B, B…";
  }
  // units shown: enough to make the repeat obvious, never overwhelming
  const repeats = diff >= 3 ? 2 : 3;
  const shown: string[] = [];
  for (let r = 0; r < repeats; r++) shown.push(...unit);
  const correct = unit[0];
  const near1 = tokenOf(s1, c2n === c1n ? c3 : c2n); // same shape, wrong colour
  const near2 = tokenOf(s2 === s1 ? "triangle" : s1, c1n); // same colour, wrong shape
  const decoys = [near1, near2, tokenOf("square", c3n)].filter((t) => t !== correct);
  const uniq = [...new Set(decoys)].slice(0, 3);
  const all = shuffled(rng, [correct, ...uniq]);
  return {
    prompt: "What comes next in the pattern?",
    seqTokens: [...shown, "?"],
    options: all,
    answer: all.indexOf(correct),
    time: questionTime(diff),
    tip,
  };
}

function genFeedLeo(rng: Rng, diff: number, world: number): Partial<Question> {
  const snacks: StickerId[] =
    world === 3
      ? ["candy", "lollipop", "cupcake", "donut", "cookie"]
      : ["apple", "banana", "grapes", "strawberry"];
  const snack = oneOf(rng, snacks);
  const want = clamp(3 + irnd(rng, 0, diff + 1), 3, 9);
  return {
    prompt: `Leo wants ${want} ${snack}s. Feed him, then tap DONE!`,
    ask: snack,
    want,
    options: [],
    answer: -1,
    time: 9 + want * 2.6,
    tip: "Drop one snack at a time and count out loud!",
  };
}

/* ── assembly ───────────────────────────────────────────────────── */

const POOLS: QKind[][] = [
  // Jungle Jam: gentle numbers + hands-on fun
  ["count", "addsub", "oddOne", "sequence", "truefalse", "compare", "tapTarget", "shadow", "pattern", "feedLeo"],
  // Coral Cove
  ["addsub", "compare", "sequence", "oddOne", "truefalse", "count", "shadow", "pattern", "feedLeo", "tapTarget"],
  // Space Hop
  ["multiply", "sequence", "memory", "truefalse", "oddOne", "compare", "pattern", "tapTarget"],
  // Candy Peak: the big championship mix
  ["multiply", "memory", "sequence", "truefalse", "addsub", "oddOne", "feedLeo", "shadow", "tapTarget", "pattern"],
];

/** Deterministic per level: which 8 mini-games does this level hold? */
export function buildPlan(levelIdx: number): QKind[] {
  const pool = POOLS[worldOf(levelIdx).id];
  const rng = mulberry32(levelIdx * 7919 + 13);
  const plan: QKind[] = [];
  while (plan.length < 8) {
    const k = oneOf(rng, pool);
    if (k === "memory" && plan.includes("memory")) continue; // max one memory
    if (plan[plan.length - 1] === k) continue; // no back-to-back repeats
    plan.push(k);
  }
  if (levelIdx <= 2) plan[0] = "count"; // gentle onboarding
  return plan;
}

export function makeQuestion(
  kind: QKind,
  diff: number,
  levelIdx: number,
  qIndex: number,
  attempt: number
): Question {
  const rng = mulberry32(hash3(levelIdx * 31 + diff, attempt, qIndex));
  const world = worldOf(levelIdx).id;
  let body: Partial<Question>;
  switch (kind) {
    case "count": body = genCount(rng, diff, world); break;
    case "addsub": body = genAddSub(rng, diff); break;
    case "compare": body = genCompare(rng, diff, world); break;
    case "oddOne": body = genOddOne(rng, diff); break;
    case "sequence": body = genSequence(rng, diff); break;
    case "multiply": body = genMultiply(rng, diff); break;
    case "truefalse": body = genTrueFalse(rng, diff); break;
    case "memory": body = genMemory(rng, diff); break;
    case "tapTarget": body = genTapTarget(rng, diff, world); break;
    case "shadow": body = genShadow(rng, diff, world); break;
    case "pattern": body = genPattern(rng, diff); break;
    case "feedLeo": body = genFeedLeo(rng, diff, world); break;
  }
  return {
    key: `L${levelIdx}A${attempt}Q${qIndex}`,
    kind,
    time: body.time ?? questionTime(diff),
    diff,
    prompt: "",
    options: [],
    answer: 0,
    ...body,
  } as Question;
}

/** Rapid-fire question for the LEO RUSH finale. */
export function makeRushQuestion(diff: number, i: number, attempt: number): Question {
  const rng = mulberry32(hash3(999 + diff, attempt, i));
  const kind: QKind = rng() < 0.55 ? "addsub" : "count";
  const d = Math.max(1, diff - 2); // rush stays snappy
  const body = kind === "addsub" ? genAddSub(rng, d) : genCount(rng, d, i % 4);
  return {
    key: `RUSH${attempt}${i}`,
    kind,
    time: 5,
    diff: d,
    prompt: "",
    options: [],
    answer: 0,
    ...body,
  } as Question;
}

/** Parse a pattern token like "circle-red" into its parts. */
export function parseToken(token: string): { shape: string; color: string; hex: string } | null {
  const [shape, color] = token.split("-");
  const hit = PATTERN_COLORS.find(([n]) => n === color);
  if (!shape || !hit) return null;
  return { shape, color, hex: hit[1] };
}
