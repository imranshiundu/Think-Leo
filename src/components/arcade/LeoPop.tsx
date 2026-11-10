"use client";

/**
 * Think Leo — LEO POP (the arcade)
 * ────────────────────────────────
 * A physics merge toy: drag to aim, release to drop, two of a kind fuse
 * into the next creature, and the chain ends with LEO. Golden eggs are
 * the slot machine (variable rewards), chains are the dopamine ladder,
 * the Zoo Book is the collection. No maths, no quizzes — pure pop.
 *
 * Stack:
 *   · matter-js  — the jar physics (circles, walls, fusion on contact)
 *   · GSAP       — pop bursts, floating scores, chain banners, shake
 *   · three.js   — PopSky candy bubbles behind the glass
 *   · store v5   — XP → the ONE economy; Zoo Book; daily egg
 * Numbers & schedules: src/lib/arcade.ts, docs/ALGORITHM.md §14.
 */

import { ZooBook } from "@/components/arcade/ZooBook";
import { PopSky } from "@/components/arcade/PopSky";
import { Leo } from "@/components/leo/Leo";
import { Sticker, type StickerId } from "@/components/leo/stickers";
import { ChunkyButton, ConfettiBurst, ScoreCountUp, SoundToggles } from "@/components/game/bits";
import {
  buzz,
  CHAIN_WINDOW_MS,
  DAILY_EGG_XP,
  DROP_COOLDOWN_MS,
  DROP_Y,
  EGG_CHANCE,
  EGG_PITY,
  EGG_R,
  GOLDEN_BLAST_SCORE,
  GOLDEN_TIER,
  JAR_FALLBACK,
  LEO_TIER,
  LINE_Y,
  OVERFLOW_MS,
  POP_CHAIN,
  POP_CHAIN_WORDS,
  POP_NEAR_MISS,
  POP_OVER_LINES,
  PARTY_SCORE,
  mergePoints,
  radiusFor,
  rollDrop,
  rollEgg,
  xpForMergeRun,
} from "@/lib/arcade";
import { clamp, pick, type Mood } from "@/lib/game";
import { sfx } from "@/lib/sound";
import { useLeo, useMergeEggReady } from "@/lib/store";
import { AnimatePresence, motion } from "framer-motion";
import gsap from "gsap";
import Matter from "matter-js";
import { createRoot } from "react-dom/client";
import {
  ArrowDown,
  Crown,
  Hand,
  Home,
  Move,
  RotateCcw,
  Sparkles,
  Star,
  Trophy,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type Phase = "intro" | "playing" | "over";
type Piece = number | "egg";

interface RunResult {
  score: number;
  isBest: boolean;
  prevBest: number;
  discoveries: number[]; // tiers discovered this run
  biggest: number; // biggest tier reached this run
  xp: number;
}

/* ════════════════ small shared UI: a creature ball ══════════════ */

export function PopBall({ tier, size, egg = false }: { tier: number; size: number; egg?: boolean }) {
  const c = POP_CHAIN[tier];
  return (
    <span
      className="relative flex items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        background: egg
          ? "radial-gradient(circle at 32% 26%, #fffbe8 6%, #ffd75e 58%, #f0a90a 100%)"
          : `radial-gradient(circle at 32% 28%, #ffffff 8%, ${c.bg} 62%)`,
        border: `3px solid ${egg ? "#e8a80c" : c.edge}`,
        boxShadow:
          tier >= LEO_TIER && !egg
            ? "0 0 0 4px rgba(255,215,94,0.35), inset 0 -6px 10px rgba(140,90,0,0.18)"
            : "inset 0 -5px 9px rgba(74,47,27,0.10)",
      }}
    >
      {egg ? (
        <Star width={size * 0.44} height={size * 0.44} className="fill-white text-white drop-shadow" />
      ) : (
        <Sticker id={c.id} size={size * 0.78} />
      )}
    </span>
  );
}

/* ════════════════════════ the game screen ═══════════════════════ */

export function LeoPop({ onExit }: { onExit: () => void }) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [score, setScore] = useState(0);
  const [chain, setChain] = useState<{ n: number; key: number } | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [zooOpen, setZooOpen] = useState(false);
  const [confettiKey, setConfettiKey] = useState(0);
  const [danger, setDanger] = useState(false);
  const [leoMood, setLeoMood] = useState<Mood>("idle");
  const [bubble, setBubble] = useState<string | null>(null);
  const [held, setHeld] = useState<Piece>(0); // what the claw holds
  const [nextUp, setNextUp] = useState<Piece>(1); // what comes after
  const [aimX, setAimX] = useState<number | null>(null);

  const eggReady = useMergeEggReady(); // guaranteed daily egg still waiting?

  /* ── refs: the physics world + DOM ball registry ── */
  const jarRef = useRef<HTMLDivElement>(null);
  const ballsElRef = useRef<HTMLDivElement>(null);
  const fxRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const ballsRef = useRef<Map<number, { body: Matter.Body; tier: number; el: HTMLDivElement; egg?: boolean }>>(new Map());
  const rafRef = useRef(0);
  const loopRef = useRef<((t: number) => void) | null>(null);
  const lastFrameRef = useRef(0);
  const lastDropRef = useRef(0);
  const chainRef = useRef({ at: -1e9, n: 0 });
  const overflowAtRef = useRef<number | null>(null);
  const dangerRef = useRef(false);
  const dangerPulseRef = useRef(0);
  const overRef = useRef(false);
  const timeoutsRef = useRef<number[]>([]);
  const pendingMergesRef = useRef<[Matter.Body, Matter.Body][]>([]);
  const dropsSinceEggRef = useRef(0);
  const currentRef = useRef<Piece>(0);
  const nextRef = useRef<Piece>(1);
  const runDiscoveriesRef = useRef<number[]>([]);
  const runBiggestRef = useRef(0);
  const draggingRef = useRef(false);
  const scoreRef = useRef(0);

  /* the jar's inner width as STATE — measured on mount/resize (refs must not
     be read during render, and ball/preview sizing depends on it) */
  const [jarW, setJarW] = useState(JAR_FALLBACK.w);
  useEffect(() => {
    const measure = () => {
      if (jarRef.current) setJarW(jarRef.current.clientWidth || JAR_FALLBACK.w);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  /* physics walls, kept in refs so a mid-run resize / orientation flip can
     rebuild them — walls were baked once at run start and balls ESCAPED the
     rotated jar (the manifest allows "any" orientation, so this happens). */
  const wallsRef = useRef<Matter.Body[]>([]);
  const buildWalls = useCallback((w: number, h: number) => {
    const engine = engineRef.current;
    if (!engine) return;
    if (wallsRef.current.length) Matter.World.remove(engine.world, wallsRef.current);
    const wallOpts: Matter.IChamferableBodyDefinition = { isStatic: true, restitution: 0.05, friction: 0.6 };
    wallsRef.current = [
      Matter.Bodies.rectangle(w / 2, h + 40, w * 2, 80, wallOpts), // floor
      Matter.Bodies.rectangle(-32, h / 2, 80, h * 3, wallOpts), // left lip
      Matter.Bodies.rectangle(w + 32, h / 2, 80, h * 3, wallOpts), // right lip
    ];
    Matter.World.add(engine.world, wallsRef.current);
  }, []);

  /* rebuild the walls whenever the jar is re-measured mid-run */
  useEffect(() => {
    if (engineRef.current && phase === "playing") {
      buildWalls(jarW, jarRef.current?.clientHeight ?? JAR_FALLBACK.h);
    }
  }, [jarW, phase, buildWalls]);

  const save = useLeo();
  // destructured once: zustand actions are stable, and the React Compiler
  // wants plain identifiers (not save.x) in memoization deps
  const { trackMerge, recordMergeRun, addXp, claimMergeEgg, seeCreature, mergeBest, soundSfx, soundMusic, toggleSfx, toggleMusic } = save;

  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timeoutsRef.current = timeoutsRef.current.filter((t) => t !== id);
      fn();
    }, ms);
    timeoutsRef.current.push(id);
  }, []);

  const setLeoMoment = useCallback(
    (mood: Mood, line?: string, ms = 1500) => {
      setLeoMood(mood);
      if (line) setBubble(line);
      later(() => {
        setLeoMood("idle");
        setBubble(null);
      }, ms);
    },
    [later]
  );

  /* ── spawning ── the single factory for every creature in the jar ── */

  const spawnBall = useCallback(
    (tier: number, x: number, y: number, velocity?: { x: number; y: number }, asEgg = false) => {
      const engine = engineRef.current;
      const jarW = jarRef.current?.clientWidth ?? JAR_FALLBACK.w;
      if (!engine) return;
      const r = asEgg ? EGG_R : radiusFor(tier, jarW);
      const body = Matter.Bodies.circle(clamp(x, r + 4, jarW - r - 4), Math.max(y, DROP_Y), r, {
        restitution: 0.24,
        friction: 0.38,
        frictionStatic: 0.7,
      });
      body.plugin = { tier: asEgg ? undefined : tier, egg: asEgg, born: performance.now() };
      if (velocity) Matter.Body.setVelocity(body, velocity);
      Matter.World.add(engine.world, body);

      const el = document.createElement("div");
      el.style.cssText = `position:absolute;left:0;top:0;width:${r * 2}px;height:${r * 2}px;border-radius:99px;will-change:transform;`;
      const inner = document.createElement("div");
      inner.style.cssText = `position:absolute;inset:0;border-radius:99px;${
        asEgg
          ? "background:radial-gradient(circle at 32% 26%,#fffbe8 6%,#ffd75e 58%,#f0a90a 100%);border:3px solid #e8a80c;box-shadow:inset 0 -5px 9px rgba(140,90,0,0.25);"
          : `background:radial-gradient(circle at 32% 28%,#ffffff 8%,${POP_CHAIN[tier].bg} 62%);border:3px solid ${POP_CHAIN[tier].edge};box-shadow:inset 0 -5px 9px rgba(74,47,27,0.10);`
      }`;
      el.appendChild(inner);
      const stickerHost = document.createElement("div");
      stickerHost.style.cssText = `position:absolute;inset:0;display:flex;align-items:center;justify-content:center;`;
      if (asEgg) {
        stickerHost.innerHTML = `<svg width="${r}" height="${r}" viewBox="0 0 24 24" fill="#ffffff"><path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17l-6.1 3.6 1.4-6.8L2.2 9.1l6.9-.8z"/></svg>`;
      } else {
        const holder = document.createElement("div");
        holder.dataset.popSticker = String(tier);
        stickerHost.appendChild(holder);
      }
      el.appendChild(stickerHost);
      ballsElRef.current?.appendChild(el);
      ballsRef.current.set(body.id, { body, tier: asEgg ? -1 : tier, el, egg: asEgg });

      // Sticker art is rendered by React into the placeholder (reuses the
      // parametric SVG library inside the imperative physics DOM)
      if (!asEgg) {
        const host = el.querySelector("[data-pop-sticker]");
        if (host) createRoot(host).render(<Sticker id={POP_CHAIN[tier].id} size={r * 1.5} />);
      }
      return body;
    },
    []
  );

  /* ── GSAP juice ───────────────────────────────────────────────── */

  const shakeJar = useCallback((power = 6) => {
    const el = jarRef.current;
    if (!el) return;
    gsap.fromTo(el, { x: 0 }, { x: power, duration: 0.045, repeat: 5, yoyo: true, ease: "none", clearProps: "x" });
  }, []);

  const popBurst = useCallback((x: number, y: number, tier: number) => {
    const layer = fxRef.current;
    if (!layer) return;
    const c = POP_CHAIN[tier];
    const host = document.createElement("div");
    host.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:0;height:0;pointer-events:none;`;
    const ring = document.createElement("div");
    ring.style.cssText = `position:absolute;left:-14px;top:-14px;width:28px;height:28px;border-radius:99px;border:4px solid ${c.edge};`;
    host.appendChild(ring);
    const dots: HTMLDivElement[] = [];
    for (let i = 0; i < 7; i++) {
      const d = document.createElement("div");
      const s = 5 + Math.random() * 6;
      d.style.cssText = `position:absolute;left:${-s / 2}px;top:${-s / 2}px;width:${s}px;height:${s}px;border-radius:${Math.random() < 0.5 ? "99px" : "3px"};background:${i % 2 ? c.edge : c.bg};`;
      host.appendChild(d);
      dots.push(d);
    }
    layer.appendChild(host);
    const tl = gsap.timeline({ onComplete: () => host.remove() });
    tl.fromTo(ring, { scale: 0.4, opacity: 0.95 }, { scale: 2.6, opacity: 0, duration: 0.42, ease: "power2.out" });
    dots.forEach((d) => {
      const a = Math.random() * Math.PI * 2;
      const dist = 26 + Math.random() * 34;
      tl.fromTo(
        d,
        { x: 0, y: 0, opacity: 1, scale: 1 },
        { x: Math.cos(a) * dist, y: Math.sin(a) * dist + 14, opacity: 0, scale: 0.4, duration: 0.5 + Math.random() * 0.2, ease: "power1.out" },
        0
      );
    });
  }, []);

  const scoreFloat = useCallback((x: number, y: number, pts: number, big = false) => {
    const layer = fxRef.current;
    if (!layer) return;
    const el = document.createElement("div");
    el.textContent = `+${pts}`;
    el.style.cssText = `position:absolute;left:${x}px;top:${y}px;transform:translate(-50%,-50%);font-family:var(--font-fredoka),sans-serif;font-weight:700;font-size:${big ? 30 : 21}px;color:#fff;-webkit-text-stroke:1.5px rgba(74,47,27,0.85);paint-order:stroke fill;pointer-events:none;white-space:nowrap;`;
    layer.appendChild(el);
    gsap
      .timeline({ onComplete: () => el.remove() })
      .fromTo(el, { y: 0, scale: 0.5, opacity: 0 }, { y: -52, scale: 1, opacity: 1, duration: 0.22, ease: "back.out(2.2)" })
      .to(el, { opacity: 0, y: -70, duration: 0.35, delay: 0.18 });
  }, []);

  const newBadge = useCallback((x: number, y: number) => {
    const layer = fxRef.current;
    if (!layer) return;
    const el = document.createElement("div");
    el.textContent = "NEW!";
    el.style.cssText = `position:absolute;left:${x}px;top:${y}px;transform:translate(-50%,-50%);font-family:var(--font-fredoka),sans-serif;font-weight:700;font-size:15px;color:#58cc02;-webkit-text-stroke:1.4px rgba(255,255,255,0.95);paint-order:stroke fill;pointer-events:none;`;
    layer.appendChild(el);
    gsap
      .timeline({ onComplete: () => el.remove() })
      .fromTo(el, { scale: 0.2, opacity: 0 }, { scale: 1.15, opacity: 1, duration: 0.28, ease: "back.out(2.6)" })
      .to(el, { y: -30, opacity: 0, duration: 0.5, delay: 0.35 });
  }, []);

  const chainBanner = useCallback((n: number) => {
    const layer = fxRef.current;
    if (!layer) return;
    const el = document.createElement("div");
    const word = POP_CHAIN_WORDS[Math.min(POP_CHAIN_WORDS.length - 1, Math.floor((n - 2) / 2))];
    el.textContent = `×${n} ${word}`;
    el.style.cssText = `position:absolute;left:50%;top:26%;transform:translate(-50%,-50%);font-family:var(--font-fredoka),sans-serif;font-weight:700;font-size:30px;color:#ffb020;-webkit-text-stroke:2px rgba(74,47,27,0.9);paint-order:stroke fill;pointer-events:none;white-space:nowrap;`;
    layer.appendChild(el);
    gsap
      .timeline({ onComplete: () => el.remove() })
      .fromTo(el, { scale: 0.3, opacity: 0, rotate: -6 }, { scale: 1, opacity: 1, rotate: 0, duration: 0.3, ease: "back.out(2.4)" })
      .to(el, { opacity: 0, y: -18, duration: 0.3, delay: 0.4 });
  }, []);

  /* ── the fusion core ─────────────────────────────────────────── */

  const doFuse = useCallback(
    (a: Matter.Body, b: Matter.Body) => {
      const engine = engineRef.current;
      const reg = ballsRef.current;
      const ra = reg.get(a.id);
      const rb = reg.get(b.id);
      if (!engine || !ra || !rb) return;
      const tier = ra.tier;
      const x = (a.position.x + b.position.x) / 2;
      const y = (a.position.y + b.position.y) / 2;

      // retire both
      Matter.World.remove(engine.world, a);
      Matter.World.remove(engine.world, b);
      ra.el.remove();
      rb.el.remove();
      reg.delete(a.id);
      reg.delete(b.id);

      // the chain clock — cascades inside the window climb the ladder
      const now = performance.now();
      chainRef.current = {
        at: now,
        n: now - chainRef.current.at < CHAIN_WINDOW_MS ? chainRef.current.n + 1 : 1,
      };
      const n = chainRef.current.n;
      setChain({ n, key: now });

      if (tier === LEO_TIER) {
        // TWO LEOs — the golden jackpot: both vanish in a roar of confetti
        const pts = Math.round(GOLDEN_BLAST_SCORE * (1 + 0.5 * (n - 1)));
        scoreRef.current += pts;
        setScore(scoreRef.current);
        scoreFloat(x, y, pts, true);
        popBurst(x, y, GOLDEN_TIER);
        sfx.goldenRoar();
        shakeJar(10);
        setConfettiKey((k) => k + 1);
        setLeoMoment("cheer", "GOLDEN LEO!", 2000);
        trackMerge(GOLDEN_TIER, n);
        runBiggestRef.current = Math.max(runBiggestRef.current, GOLDEN_TIER);
        return;
      }

      const created = tier + 1;
      const jarW = jarRef.current?.clientWidth ?? JAR_FALLBACK.w;
      const r = radiusFor(created, jarW);
      const nx = clamp(x, r + 4, jarW - r - 4);
      const ny = Math.max(y, r + 4);
      spawnBall(created, nx, ny, {
        x: (a.velocity.x + b.velocity.x) * 0.2,
        y: Math.min(-1, (a.velocity.y + b.velocity.y) * 0.2),
      });

      const pts = mergePoints(created, n);
      scoreRef.current += pts;
      setScore(scoreRef.current);
      scoreFloat(nx, ny, pts, created >= LEO_TIER);
      popBurst(nx, ny, created);
      sfx.mergePop(created, n);
      shakeJar(created >= 7 ? 7 : 3);
      if (n >= 2) chainBanner(n);
      if (created >= LEO_TIER) {
        sfx.goldenRoar();
        setConfettiKey((k) => k + 1);
        setLeoMoment("cheer", "YOU MADE LEO!", 2200);
        shakeJar(10);
      } else if (n >= 3) {
        setLeoMoment("excited");
      }
      const isNew = trackMerge(created, n);
      if (isNew) {
        sfx.discover();
        newBadge(nx, ny - 30);
        if (!runDiscoveriesRef.current.includes(created)) runDiscoveriesRef.current.push(created);
      }
      runBiggestRef.current = Math.max(runBiggestRef.current, created);
    },
     
    [popBurst, scoreFloat, newBadge, chainBanner, shakeJar, setLeoMoment, trackMerge]
  );

  /* ── golden eggs: the variable-reward machine ─────────────────── */

  const resolveEgg = useCallback(
    (x: number, y: number) => {
      const outcome = rollEgg();
      sfx.eggBurst();
      popBurst(x, y, 1);
      buzz([18, 40, 18]);

      if (outcome === "party") {
        scoreRef.current += PARTY_SCORE;
        setScore(scoreRef.current);
        scoreFloat(x, y, PARTY_SCORE, true);
        setConfettiKey((k) => k + 1);
        setLeoMoment("happy");
      } else if (outcome === "gift") {
        const tier = 4 + Math.floor(Math.random() * 4); // tiers 4-7
        const jarW = jarRef.current?.clientWidth ?? JAR_FALLBACK.w;
        const r = radiusFor(tier, jarW);
        const nx = clamp(x, r + 4, jarW - r - 4);
        const ny = Math.max(y, r + 4);
        spawnBall(tier, nx, ny, { x: 0, y: -2 });
        sfx.mergePop(tier, 1);
        // hatching is a MEETING, not a fusion — Zoo Book without merge count
        const isNew = seeCreature(tier);
        if (isNew) {
          sfx.discover();
          newBadge(nx, ny - 30);
          if (!runDiscoveriesRef.current.includes(tier)) runDiscoveriesRef.current.push(tier);
        }
        runBiggestRef.current = Math.max(runBiggestRef.current, tier);
        setLeoMoment("wow");
      } else if (outcome === "twins") {
        const jarW = jarRef.current?.clientWidth ?? JAR_FALLBACK.w;
        const r = radiusFor(2, jarW);
        [-1, 1].forEach((s) => {
          const nx = clamp(x + s * (r + 6), r + 4, jarW - r - 4);
          spawnBall(2, nx, Math.max(y, r + 4), { x: s * 1.6, y: -2.4 });
        });
        sfx.mergePop(2, 2);
        seeCreature(2);
        setLeoMoment("happy");
      } else {
        // popcorn: one whole tier pops — the relief bomb
        const tiers = new Set<number>();
        ballsRef.current.forEach((b) => {
          if (!b.egg && b.tier >= 1 && b.tier <= 4) tiers.add(b.tier);
        });
        const list = [...tiers];
        if (list.length === 0) {
          // nothing to pop → it becomes a party instead (never a dud)
          scoreRef.current += PARTY_SCORE;
          setScore(scoreRef.current);
          scoreFloat(x, y, PARTY_SCORE, true);
          setConfettiKey((k) => k + 1);
          return;
        }
        const target = pick(list);
        const victims = [...ballsRef.current.values()].filter((b) => b.tier === target);
        victims.forEach((v, i) => {
          later(() => {
            const engine = engineRef.current;
            if (!engine || overRef.current) return;
            const px = v.body.position.x;
            const py = v.body.position.y;
            Matter.World.remove(engine.world, v.body);
            v.el.remove();
            ballsRef.current.delete(v.body.id);
            popBurst(px, py, target);
            sfx.miniPop(i);
            const pts = 3 + target * 2;
            scoreRef.current += pts;
            setScore(scoreRef.current);
            scoreFloat(px, py, pts);
            shakeJar(3);
          }, i * 70);
        });
        setLeoMoment("wow");
      }
    },
     
    [popBurst, scoreFloat, newBadge, setLeoMoment, shakeJar, seeCreature, later]
  );

  /* ── the dropper: current piece + next-piece queue ────────────── */

  const rollNext = useCallback((): Piece => {
    const forced = dropsSinceEggRef.current >= EGG_PITY;
    const lucky = !forced && dropsSinceEggRef.current >= 4 && Math.random() < EGG_CHANCE;
    if (forced || lucky) {
      dropsSinceEggRef.current = 0;
      return "egg";
    }
    return rollDrop();
  }, []);

  /* ── the physics loop ─────────────────────────────────────────── */

  const cleanupWorld = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    loopRef.current = null;
    timeoutsRef.current.forEach((t) => window.clearTimeout(t));
    timeoutsRef.current = [];
    if (engineRef.current) {
      Matter.Events.off(engineRef.current, "collisionStart");
      Matter.World.clear(engineRef.current.world, false);
      Matter.Engine.clear(engineRef.current);
      engineRef.current = null;
    }
    wallsRef.current = [];
    ballsRef.current.forEach((b) => b.el.remove());
    ballsRef.current.clear();
    pendingMergesRef.current = [];
  }, []);

  const endRun = useCallback(() => {
    if (overRef.current) return;
    overRef.current = true;
    cancelAnimationFrame(rafRef.current);
    sfx.arcadeOver();
    buzz([60, 50, 60]);
    setLeoMoment("sad", undefined, 2400);

    const finalScore = scoreRef.current;
    const prevBest = mergeBest;
    const isBest = finalScore > prevBest && finalScore > 0;
    recordMergeRun(finalScore);
    const xp = xpForMergeRun(finalScore, runDiscoveriesRef.current.length);
    addXp(xp);

    setResult({
      score: finalScore,
      isBest,
      prevBest,
      discoveries: [...runDiscoveriesRef.current],
      biggest: runBiggestRef.current,
      xp,
    });
    setPhase("over");
    if (isBest) setConfettiKey((k) => k + 1);
     
  }, [mergeBest, recordMergeRun, addXp, setLeoMoment]);

  const startRun = useCallback(() => {
    cleanupWorld(); // defensive: replay after game over starts fresh

    const jar = jarRef.current;
    const jarW = jar?.clientWidth ?? JAR_FALLBACK.w;
    const jarH = jar?.clientHeight ?? JAR_FALLBACK.h;

    const engine = Matter.Engine.create();
    engine.gravity.y = 1.12;
    engineRef.current = engine;
    overRef.current = false;

    buildWalls(jarW, jarH);

    Matter.Events.on(engine, "collisionStart", (evt) => {
      for (const pair of evt.pairs) {
        const a = pair.bodyA;
        const b = pair.bodyB;
        const ra = ballsRef.current.get(a.id);
        const rb = ballsRef.current.get(b.id);
        // the egg cracks on first real contact
        const egg = ra?.egg ? ra : rb?.egg ? rb : null;
        if (egg && egg.body.plugin && !egg.body.plugin.cracked) {
          egg.body.plugin.cracked = true;
          sfx.eggCrack();
          gsap.to(egg.el.firstElementChild, { rotation: "+=12", yoyo: true, repeat: 3, duration: 0.09 });
          later(() => {
            if (overRef.current || !engineRef.current) return;
            const x = egg.body.position.x;
            const y = egg.body.position.y;
            Matter.World.remove(engineRef.current.world, egg.body);
            egg.el.remove();
            ballsRef.current.delete(egg.body.id);
            resolveEgg(x, y);
          }, 360);
          continue;
        }
        if (ra && rb && !ra.egg && !rb.egg && ra.tier === rb.tier && ra.tier < GOLDEN_TIER) {
          if (a.plugin.dead || b.plugin.dead) continue;
          a.plugin.dead = true;
          b.plugin.dead = true;
          pendingMergesRef.current.push([a, b]);
        }
      }
    });

    // reset run state
    chainRef.current = { at: -1e9, n: 0 };
    overflowAtRef.current = null;
    dangerRef.current = false;
    setDanger(false);
    dropsSinceEggRef.current = 0;
    runDiscoveriesRef.current = [];
    runBiggestRef.current = 0;
    scoreRef.current = 0;
    setScore(0);
    setResult(null);
    setChain(null);

    // deal the first hand — the daily egg leads when it is waiting
    const first: Piece = eggReady ? "egg" : rollDrop();
    currentRef.current = first;
    nextRef.current = rollNext();
    setHeld(first);
    setNextUp(nextRef.current);

    // the loop
    lastFrameRef.current = performance.now();
    const loop = (t: number) => {
      rafRef.current = requestAnimationFrame(loop);
      const dt = Math.min(33, t - lastFrameRef.current);
      lastFrameRef.current = t;
      Matter.Engine.update(engine, dt);

      // fusions (deferred out of the collision event)
      if (pendingMergesRef.current.length) {
        const list = pendingMergesRef.current.splice(0);
        list.forEach(([a, b]) => doFuse(a, b));
      }

      // sync DOM
      ballsRef.current.forEach((b) => {
        const r = (b.body.circleRadius ?? 20) as number;
        const { x, y } = b.body.position;
        b.el.style.transform = `translate3d(${x - r}px,${y - r}px,0) rotate(${b.body.angle}rad)`;
      });

      // overflow + danger (skip freshly dropped balls still falling in)
      let anyAbove = false;
      let anyNear = false;
      ballsRef.current.forEach((b) => {
        if (b.egg) return;
        const born = (b.body.plugin?.born ?? 0) as number;
        if (t - born < 1100) return;
        const r = (b.body.circleRadius ?? 20) as number;
        const top = b.body.position.y - r;
        if (top < LINE_Y) anyAbove = true;
        if (top < LINE_Y + 64) anyNear = true;
      });
      if (anyAbove) {
        if (overflowAtRef.current === null) overflowAtRef.current = t;
        else if (t - overflowAtRef.current > OVERFLOW_MS) endRun();
      } else {
        overflowAtRef.current = null;
      }
      if (anyNear !== dangerRef.current) {
        dangerRef.current = anyNear;
        setDanger(anyNear);
      }
      if (anyNear && t - dangerPulseRef.current > 950) {
        dangerPulseRef.current = t;
        sfx.pulse();
      }
    };
    loopRef.current = loop;
    rafRef.current = requestAnimationFrame(loop);
  }, [cleanupWorld, doFuse, resolveEgg, later, endRun, rollNext, eggReady, buildWalls]);

  /* ── lifecycle ────────────────────────────────────────────────── */

  useEffect(() => {
    return cleanupWorld;
  }, [cleanupWorld]);

  /* pause the world when the tab hides (battery manners) */
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) {
        cancelAnimationFrame(rafRef.current);
      } else if (phase === "playing" && !overRef.current && loopRef.current) {
        lastFrameRef.current = performance.now();
        rafRef.current = requestAnimationFrame(loopRef.current);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [phase]);

  /* arcade music: Sneaky Snitch owns this room */
  useEffect(() => {
    if (soundMusic) sfx.startMusic("rush");
     
  }, [soundMusic]);

  /* ── aiming & dropping ────────────────────────────────────────── */

  const aimFromEvent = useCallback((e: React.PointerEvent) => {
    const jar = jarRef.current;
    if (!jar) return null;
    const rect = jar.getBoundingClientRect();
    const scale = rect.width / (jar.clientWidth || 1);
    const x = (e.clientX - rect.left) / scale;
    return clamp(x, 14, jar.clientWidth - 14);
  }, []);

  const dropHeld = useCallback(() => {
    if (overRef.current || phase !== "playing") return;
    const now = performance.now();
    if (now - lastDropRef.current < DROP_COOLDOWN_MS) return;
    if (aimX === null) return;
    lastDropRef.current = now;

    const piece = currentRef.current;
    if (piece === "egg") {
      spawnBall(0, aimX, DROP_Y, undefined, true);
      // only the DAILY egg pays XP — later eggs are pure gameplay fun
      if (claimMergeEgg()) addXp(DAILY_EGG_XP);
      setLeoMoment("wow", "A golden egg!");
    } else {
      spawnBall(piece, aimX, DROP_Y);
      sfx.dropBall(piece);
      dropsSinceEggRef.current += 1;
      // meeting a creature for the first time counts as a discovery
      if (seeCreature(piece)) {
        sfx.discover();
        newBadge(aimX, DROP_Y + radiusFor(piece, jarW) + 24);
        if (!runDiscoveriesRef.current.includes(piece)) runDiscoveriesRef.current.push(piece);
      }
    }

    // advance the queue
    currentRef.current = nextRef.current;
    nextRef.current = rollNext();
    setHeld(currentRef.current);
    setNextUp(nextRef.current);
     
  }, [phase, aimX, jarW, spawnBall, claimMergeEgg, addXp, seeCreature, setLeoMoment, rollNext]);

  /* ── render ───────────────────────────────────────────────────── */

  const heldSize = held === "egg" ? EGG_R * 2 : radiusFor(held as number, jarW) * 2;

  return (
    <div className="leo-bg fixed inset-0 overflow-hidden">
      <PopSky className="pointer-events-none absolute inset-0 z-0" opacity={0.32} />
      <ConfettiBurst fireKey={confettiKey} count={90} />
      <ZooBook open={zooOpen} onClose={() => setZooOpen(false)} />

      {/* ── HUD ── */}
      <div className="absolute inset-x-0 top-0 z-30 flex items-center gap-2 bg-gradient-to-b from-[#fff7e6] via-[#fff7e6ee] to-transparent px-3 py-3">
        <button
          type="button"
          onClick={() => {
            sfx.click();
            cleanupWorld();
            onExit();
          }}
          className="pill min-h-[44px] cursor-pointer px-3 py-1.5 font-display text-sm text-leo-ink hover:bg-leo-cream"
        >
          <Home width={14} height={14} className="mr-1 inline" /> Home
        </button>
        <div className="pill px-3 py-1 font-display text-base tabular-nums text-leo-ink" title="Score">
          <Zap width={14} height={14} className="fill-leo-sun text-leo-sun-deep" />
          {score}
        </div>
        <div className="pill px-3 py-1 text-sm text-leo-ink" title="Best score">
          <Trophy width={14} height={14} className="text-leo-sun-deep" />
          {mergeBest}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              sfx.click();
              setZooOpen(true);
            }}
            aria-label="Open the Zoo Book"
            className="pill min-h-[44px] cursor-pointer px-2.5 hover:bg-leo-cream"
          >
            <Sticker id="lion" size={16} />
            <span className="text-xs font-bold text-leo-ink">Zoo</span>
          </button>
          <SoundToggles
            sfxOn={soundSfx}
            musicOn={soundMusic}
            onSfx={() => toggleSfx()}
            onMusic={() => toggleMusic()}
          />
        </div>
      </div>

      {/* ── the jar ── */}
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-end pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-16">
        <div
          ref={jarRef}
          className={`relative h-[clamp(250px,52dvh,440px)] w-[min(92vw,400px)] rounded-t-[26px] rounded-b-[34px] border-[6px] border-b-[9px] border-white/75 bg-white/35 shadow-[inset_0_10px_30px_rgba(74,47,27,0.10),0_18px_40px_-18px_rgba(140,100,40,0.45)] backdrop-blur-[2px] ${
            danger ? "combo-hot" : ""
          }`}
          style={{ touchAction: "none" }}
          onPointerDown={(e) => {
            if (phase !== "playing") return;
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
              /* synthetic pointer events (automation/testing) can't capture — drop still works */
            }
            draggingRef.current = true;
            setAimX(aimFromEvent(e));
          }}
          onPointerMove={(e) => {
            if (!draggingRef.current || phase !== "playing") return;
            setAimX(aimFromEvent(e));
          }}
          onPointerUp={() => {
            draggingRef.current = false;
            dropHeld();
          }}
          onPointerCancel={() => {
            draggingRef.current = false;
          }}
          role="application"
          aria-label="The Leo Pop jar. Drag to aim, release to drop."
        >
          {/* balls live here (physics-synced DOM) */}
          <div ref={ballsElRef} className="absolute inset-0 overflow-hidden rounded-t-[20px] rounded-b-[28px]" />

          {/* overflow line */}
          <div
            className={`pointer-events-none absolute inset-x-0 z-10 flex items-center gap-1.5 px-3 ${danger ? "anim-heartbeat" : ""}`}
            style={{ top: LINE_Y }}
            aria-hidden
          >
            <div className={`h-[3px] flex-1 rounded-full ${danger ? "bg-leo-berry" : "bg-leo-berry/30"}`} />
            <span className={`font-display text-[10px] font-bold uppercase tracking-widest ${danger ? "text-leo-berry" : "text-leo-berry/45"}`}>
              danger
            </span>
            <div className={`h-[3px] flex-1 rounded-full ${danger ? "bg-leo-berry" : "bg-leo-berry/30"}`} />
          </div>

          {/* GSAP fx layer */}
          <div ref={fxRef} className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-t-[20px] rounded-b-[28px]" />

          {/* the held creature + drop guide */}
          {phase === "playing" && (
            <div
              className="pointer-events-none absolute z-30 flex flex-col items-center"
              style={{ left: aimX ?? "50%", top: DROP_Y, transform: "translate(-50%,-50%)" }}
            >
              {aimX !== null && (
                <div
                  className="absolute left-1/2 top-full w-0 border-l-[3px] border-r-[3px] border-t-[3px] border-l-transparent border-r-transparent border-t-leo-ink/15"
                  style={{ height: 46 }}
                />
              )}
              <div className="anim-float" style={{ animationDuration: "2.2s" }}>
                <PopBall tier={held === "egg" ? 1 : held} size={heldSize} egg={held === "egg"} />
              </div>
            </div>
          )}

          {/* NEXT preview */}
          {phase === "playing" && (
            <div className="absolute -top-1 right-2 z-30 flex flex-col items-center" style={{ transform: "translateY(-110%)" }}>
              <span className="font-display text-[9px] font-bold uppercase tracking-widest text-leo-ink-soft">next</span>
              <div className="pill px-1.5 py-1">
                <PopBall tier={nextUp === "egg" ? 1 : nextUp} size={34} egg={nextUp === "egg"} />
              </div>
            </div>
          )}
        </div>

        {/* ── bottom deck: Leo + hint ── */}
        <div className="z-20 mt-2 flex w-[min(92vw,400px)] items-end justify-between gap-2">
          <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="shrink-0">
            <Leo mood={leoMood} size={64} bubble={bubble ?? undefined} />
          </motion.div>
          <p className="mb-1 text-right text-[11px] font-semibold leading-tight text-leo-ink-soft">
            {phase === "playing"
              ? "Drag to aim, release to drop. Two of a kind fuse!"
              : phase === "over"
                ? "Tap PLAY AGAIN for one more run!"
                : "Ready to pop?"}
          </p>
        </div>
      </div>

      {/* ── intro ── */}
      <AnimatePresence>
        {phase === "intro" && (
          <motion.div
            key="intro"
            className="absolute inset-0 z-40 flex items-center justify-center bg-leo-cream/70 p-4 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="leo-card max-h-[92dvh] w-full max-w-sm overflow-y-auto p-6 text-center leo-scroll"
              initial={{ scale: 0.9, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 240, damping: 20 }}
            >
              <div className="flex items-center justify-center gap-2">
                <motion.div animate={{ y: [0, -8, 0], rotate: [-4, 4, -4] }} transition={{ duration: 2.4, repeat: Infinity }}>
                  <PopBall tier={0} size={40} />
                </motion.div>
                <span className="font-display text-3xl font-bold text-leo-ink">
                  LEO <span className="bg-gradient-to-r from-leo-berry to-leo-sun bg-clip-text text-transparent">POP</span>
                </span>
                <motion.div animate={{ y: [0, -8, 0], rotate: [4, -4, 4] }} transition={{ duration: 2.4, repeat: Infinity, delay: 0.4 }}>
                  <PopBall tier={LEO_TIER} size={40} />
                </motion.div>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-leo-ink-soft">
                Drop friends into the jar. Two of a kind fuse into a bigger one — all the way up to{" "}
                <b className="text-leo-ink">LEO</b> himself!
              </p>

              {/* the mechanic in one row */}
              <div className="mt-3 flex items-center justify-center gap-1.5">
                <PopBall tier={0} size={38} />
                <PopBall tier={0} size={38} />
                <span className="font-display text-lg font-bold text-leo-ink-soft">=</span>
                <motion.div animate={{ scale: [1, 1.14, 1] }} transition={{ duration: 1.6, repeat: Infinity }}>
                  <PopBall tier={1} size={44} />
                </motion.div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-[10px] font-semibold text-leo-ink-soft">
                <div className="flex flex-col items-center gap-1 rounded-2xl border-[2.5px] border-leo-line bg-white p-2">
                  <Move width={16} height={16} className="text-leo-teal-deep" /> Drag to aim
                </div>
                <div className="flex flex-col items-center gap-1 rounded-2xl border-[2.5px] border-leo-line bg-white p-2">
                  <ArrowDown width={16} height={16} className="text-leo-leaf-deep" /> Release to drop
                </div>
                <div className="flex flex-col items-center gap-1 rounded-2xl border-[2.5px] border-leo-line bg-white p-2">
                  <Sparkles width={16} height={16} className="text-leo-sun-deep" /> Fuse & score
                </div>
              </div>

              {eggReady && (
                <div className="anim-pulse-ring mt-4 flex items-center justify-center gap-2 rounded-2xl border-[2.5px] border-leo-sun bg-[#fff3c4] px-3 py-2">
                  <PopBall tier={1} size={26} egg />
                  <span className="font-display text-xs font-bold text-leo-ink">
                    Today&apos;s golden egg drops first — open it!
                  </span>
                </div>
              )}

              <div className="mt-4 flex items-center justify-center gap-2">
                {mergeBest > 0 && (
                  <span className="pill px-3 py-1 text-xs text-leo-ink">
                    <Trophy width={13} height={13} className="text-leo-sun-deep" /> Best {mergeBest}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    sfx.click();
                    setZooOpen(true);
                  }}
                  className="pill cursor-pointer px-3 py-1 text-xs text-leo-ink hover:bg-leo-cream"
                >
                  <Sticker id="lion" size={14} /> Zoo Book
                </button>
              </div>

              <div className="mt-5">
                <ChunkyButton
                  color="berry"
                  size="xl"
                  onClick={() => {
                    sfx.click();
                    sfx.whoosh();
                    setPhase("playing");
                    requestAnimationFrame(() => startRun());
                  }}
                  ariaLabel="Start Leo Pop"
                >
                  <span className="inline-flex items-center gap-2">
                    <Hand width={22} height={22} className="fill-white" /> POP!
                  </span>
                </ChunkyButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── results ── */}
      <AnimatePresence>
        {phase === "over" && result && (
          <motion.div
            key="over"
            className="absolute inset-0 z-40 flex items-center justify-center bg-leo-cream/70 p-4 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="leo-card max-h-[92dvh] w-full max-w-sm overflow-y-auto p-6 text-center leo-scroll"
              initial={{ scale: 0.9, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 240, damping: 20 }}
            >
              <div className="flex items-center justify-center gap-3">
                <Leo mood={result.isBest ? "celebrate" : "happy"} size={92} />
                <div className="text-left">
                  <h2 className="font-display text-2xl font-bold leading-none text-leo-ink">Jar full!</h2>
                  <p className="mt-1 text-xs text-leo-ink-soft">{pick(POP_OVER_LINES)}</p>
                </div>
              </div>

              <div className="mt-4 font-display text-6xl font-bold tabular-nums text-leo-ink">
                <ScoreCountUp to={result.score} />
              </div>

              {result.isBest ? (
                <motion.div
                  initial={{ scale: 0, rotate: -8 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.5, type: "spring", stiffness: 300, damping: 12 }}
                  className="anim-pulse-ring mx-auto mt-2 flex w-fit items-center gap-1.5 rounded-full border-[2.5px] border-leo-sun bg-[#fff3c4] px-4 py-1.5 font-display text-sm font-bold text-leo-ink"
                >
                  <Crown width={15} height={15} className="text-leo-sun-deep" /> NEW BEST!
                </motion.div>
              ) : result.score > 0 && result.prevBest > 0 && result.score >= result.prevBest * 0.8 ? (
                <p className="mt-2 font-display text-sm font-bold text-leo-berry-deep">{POP_NEAR_MISS(result.prevBest)}</p>
              ) : (
                <p className="mt-2 text-xs text-leo-ink-soft">Best: {result.prevBest}</p>
              )}

              {/* what this run earned */}
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <span className="pill px-3 py-1 text-xs text-leo-ink">
                  <Zap width={13} height={13} className="fill-leo-sun text-leo-sun-deep" /> +{result.xp} XP earned
                </span>
                {result.biggest > 0 && (
                  <span className="pill px-3 py-1 text-xs text-leo-ink">
                    Biggest: <b className="ml-1">{POP_CHAIN[result.biggest].name}</b>
                  </span>
                )}
              </div>

              {result.discoveries.length > 0 && (
                <div className="mt-3 rounded-2xl border-[2.5px] border-leo-leaf bg-[#e9ffcf] p-2.5">
                  <div className="font-display text-[11px] font-bold uppercase tracking-widest text-leo-leaf-deep">
                    New in the Zoo Book
                  </div>
                  <div className="mt-1.5 flex items-center justify-center gap-2">
                    {result.discoveries.map((t) => (
                      <motion.div key={t} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 14 }}>
                        <PopBall tier={t} size={40} />
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-5 flex flex-col gap-2">
                <ChunkyButton
                  color="leaf"
                  size="lg"
                  onClick={() => {
                    sfx.click();
                    sfx.whoosh();
                    setPhase("playing");
                    requestAnimationFrame(() => startRun());
                  }}
                  ariaLabel="Play again"
                >
                  <span className="inline-flex items-center gap-2">
                    <RotateCcw width={20} height={20} className="fill-white" /> PLAY AGAIN
                  </span>
                </ChunkyButton>
                <div className="flex justify-center gap-2">
                  <ChunkyButton color="sun" size="sm" onClick={() => setZooOpen(true)} ariaLabel="Open the Zoo Book">
                    Zoo Book
                  </ChunkyButton>
                  <ChunkyButton
                    color="cocoa"
                    size="sm"
                    onClick={() => {
                      sfx.click();
                      cleanupWorld();
                      onExit();
                    }}
                    ariaLabel="Go home"
                  >
                    Home
                  </ChunkyButton>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
