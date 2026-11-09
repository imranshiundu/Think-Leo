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
  | "memory";

export interface Question {
  key: string;
  kind: QKind;
  prompt: string; // kid-facing instruction
  display?: string; // big centered formula, e.g. "7 + 5 = ?"
  tiles?: StickerId[]; // count grid / odd-one board
  groups?: [StickerId[], StickerId[]]; // compare: two sticker plates
  seq?: (string | number)[]; // sequence tiles, "?" last
  pads?: number[]; // memory: pad indices (0..3) in order
  options: string[]; // numbers, "TRUE!"/"NOPE!", or sticker ids (oddOne)
  groupOptions?: [StickerId[], StickerId[]]; // compare options rendered as plates
  answer: number; // index into options
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

/* ── assembly ───────────────────────────────────────────────────── */

const POOLS: QKind[][] = [
  ["count", "addsub", "oddOne", "sequence", "truefalse", "compare"],
  ["addsub", "compare", "sequence", "oddOne", "truefalse", "count"],
  ["multiply", "sequence", "memory", "truefalse", "oddOne", "compare"],
  ["multiply", "memory", "sequence", "truefalse", "addsub", "oddOne"],
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
