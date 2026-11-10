"use client";

/**
 * Think Leo — Play screen: the adrenaline engine
 * ──────────────────────────────────────────────
 * Phase machine:
 *   intro → play ⇄ reveal → (last round) rushIntro → rush → results
 *                          └─ hearts hit 0 → out
 * Juice: combo meter with escalating sounds, countdown ring + heartbeat
 * pulse, danger vignette, screen shake, Leo reactions, score count-up,
 * level-up & league-up banners and the ×2 LEO RUSH finale
 * (Candy-Crush "Sugar Crush" moment). Math in docs/ALGORITHM.md §4–6.
 */

import { AmbientCartoons } from "@/components/game/ambient";
import { SpaceSky } from "@/components/game/SpaceSky";
import { Leo } from "@/components/leo/Leo";
import { ChestArt } from "@/components/leo/badges";
import { Sticker, StickerTile, isStickerId, type StickerId } from "@/components/leo/stickers";
import {
  ChunkyButton,
  ConfettiBurst,
  HandIcon,
  HeartPill,
  KindChip,
  PawProgress,
  ScoreCountUp,
  StarRow,
  TimerIcon,
} from "@/components/game/bits";
import {
  GENTLE_LEVELS,
  MAX_HEARTS,
  ROUND_COUNT,
  RUSH_SECONDS,
  chestAfterLevel,
  clamp,
  dayKey,
  leagueOf,
  playerLevelFromXp,
  questionPoints,
  starsFor,
  worldOf,
  xpForRun,
  type Mood,
} from "@/lib/game";
import { buildPlan, makeQuestion, makeRushQuestion, WORLD_TILES, type Question } from "@/lib/questions";
import { sfx } from "@/lib/sound";
import { useLeo, useQuests } from "@/lib/store";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, EyeOff, Medal, PartyPopper, Play as PlayIcon, RotateCcw, Sparkles, Target, Ticket, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Phase = "intro" | "play" | "reveal" | "rushIntro" | "rush" | "out" | "results";

interface Results {
  stars: number;
  xp: number;
  accuracy: number;
  total: number;
  isBest: boolean;
  chest: boolean;
  practice: boolean;
  levelUpTo: number | null;
  leagueUpTo: string | null;
  rushHits: number;
}

const PRAISE = ["Roarrsome!", "Big brain move!", "Yes! Keep going!", "Pawsome!"];
const UNSTOPPABLE = ["UNSTOPPABLE!", "MEGA COMBO!", "ON FIRE!", "LEO-LEVEL THINKING!"];
const OOPS = ["Almost!", "So close!", "No worries —"];
const NO_HEARTS = [
  "Hearts refill over time — brains need naps too!",
  "Out of hearts? Stretch, sip water, come back roaring!",
];

const PAD_COLORS = ["#58cc02", "#ff5a8c", "#9b5de5", "#ffb020"];

const KIND_LABEL: Record<string, string> = {
  count: "Count",
  addsub: "Maths",
  compare: "Compare",
  oddOne: "Odd one",
  sequence: "Sequence",
  multiply: "Tables",
  truefalse: "True/trap",
  memory: "Memory",
  tapTarget: "Tap it!",
  shadow: "Shadow",
  feedLeo: "Feed Leo",
};

export function Play({
  levelIdx,
  onExit,
  onNext,
  hasNext,
}: {
  levelIdx: number;
  onExit: () => void;
  onNext: () => void;
  hasNext: boolean;
}) {
  const world = worldOf(levelIdx);
  const plan = useMemo(() => buildPlan(levelIdx), [levelIdx]);
  const attemptRef = useRef(1);

  /* snapshot for level-up / league-up detection */
  const xpBeforeRef = useRef(0);
  const leagueBeforeRef = useRef("");
  useEffect(() => {
    const s = useLeo.getState();
    xpBeforeRef.current = s.xp;
    leagueBeforeRef.current = leagueOf(s.weekXp).name;
  }, []);

  /* ── run state ── */
  const [phase, setPhase] = useState<Phase>("intro");
  const [qi, setQi] = useState(0);
  const [boost, setBoost] = useState(0); // adaptive difficulty offset (-1..+2)
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [rightStreak, setRightStreak] = useState(0);
  const [wrongStreak, setWrongStreak] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [revealOk, setRevealOk] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [leoMood, setLeoMood] = useState<Mood>("idle");
  const [bubble, setBubble] = useState<string | null>(null);
  const [confettiKey, setConfettiKey] = useState(0);
  /**
   * Practice mode (v4): entered from the out-of-hearts screen — hearts are
   * frozen, XP is halved, and the level ALWAYS ends with a results screen.
   * No kid is ever hard-stuck by the heart economy again.
   */
  const [practice, setPractice] = useState(false);
  /* floating "+120" score pops and combo banners (the candy layer) */
  const [pops, setPops] = useState<{ id: number; pts: number }[]>([]);
  const [banner, setBanner] = useState<{ id: number; text: string } | null>(null);
  const [timeUp, setTimeUp] = useState(false); // the big visible "time's up!" beat

  /* rush state */
  const [rushQs, setRushQs] = useState<Question[]>([]);
  const [rushIdx, setRushIdx] = useState(0);
  const [rushCombo, setRushCombo] = useState(0);
  const [rushScore, setRushScore] = useState(0);
  const [rushHits, setRushHits] = useState(0);
  const [rushLeft, setRushLeft] = useState(RUSH_SECONDS);

  const [results, setResults] = useState<Results | null>(null);
  const recordedRef = useRef(false);

  const diff = clamp(
    Math.max(1, Math.min(6, 1 + Math.floor((levelIdx - 1) / 8) + boost)),
    1,
    6
  );
  const q = useMemo(
    () =>
      phase === "play" || phase === "reveal"
        ? makeQuestion(plan[qi], diff, levelIdx, qi, attemptRef.current)
        : null,
    [phase, qi, diff, levelIdx, plan]
  );

  const resetRun = useCallback(
    (fresh: boolean, asPractice = false) => {
      if (fresh) attemptRef.current += 1;
      recordedRef.current = false;
      setPractice(asPractice);
      setPhase("intro");
      setQi(0);
      setBoost(0);
      setCombo(0);
      setMaxCombo(0);
      setScore(0);
      setCorrectCount(0);
      setAnsweredCount(0);
      setRightStreak(0);
      setWrongStreak(0);
      setPicked(null);
      setRushQs([]);
      setRushIdx(0);
      setRushCombo(0);
      setRushScore(0);
      setRushHits(0);
      setResults(null);
      setLeoMood("idle");
      setBubble(null);
    },
    []
  );

  /* keyboard answering (laptop love) */
  const answerRef = useRef<(i: number) => void>(() => {});
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (phase === "play" && n >= 1 && n <= 4) answerRef.current(n - 1);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [phase]);

  /* music per screen */
  useEffect(() => {
    sfx.startMusic("play");
    return () => {
      sfx.startMusic("home");
    };
  }, []);

  /* ── answer handling ─────────────────────────────────────────── */

  const advance = useCallback(
    (ok: boolean) => {
      const heartsNow = useLeo.getState().hearts;
      if (!ok && heartsNow <= 0 && !practice) {
        setLeoMood("sad");
        setBubble(NO_HEARTS[Math.floor(Math.random() * NO_HEARTS.length)]);
        setPhase("out");
        sfx.sadTrombone();
        return;
      }
      if (qi >= ROUND_COUNT - 1) {
        setLeoMood("wow");
        setBubble("LEO RUSH! Everything ×2 — GO GO GO!");
        setPhase("rushIntro");
        sfx.whoosh();
        sfx.rushGo();
        window.setTimeout(() => {
          try {
            // 200 rapid-fire questions: even the fastest kid cannot outrun the clock
            setRushQs(Array.from({ length: 200 }, (_, i) => makeRushQuestion(diff, i, attemptRef.current)));
            setRushIdx(0);
            setRushLeft(RUSH_SECONDS);
            setPhase("rush");
          } catch {
            // audio/animation can never strand a level — jump straight to results
            setPhase("results");
          }
        }, 1700);
      } else {
        setQi((n) => n + 1);
        setPicked(null);
        setLeoMood("idle");
        setBubble(null);
        setPhase("play");
      }
    },
    [qi, diff, practice]
  );

  const handleAnswer = useCallback(
    (idx: number | null) => {
      if (!q || phase !== "play") return;
      const fracLeft = clamp(timeLeftRef.current / q.time, 0, 1);
      const ok = idx !== null && idx === q.answer;
      setPicked(idx);
      setRevealOk(ok);
      setAnsweredCount((a) => a + 1);
      setPhase("reveal");
      const store = useLeo.getState();

      if (ok) {
        const pts = questionPoints(combo + 1, fracLeft);
        setScore((s) => s + pts);
        setCorrectCount((c) => c + 1);
        const nc = combo + 1;
        setCombo(nc);
        setMaxCombo((m) => Math.max(m, nc));
        setRightStreak((r) => {
          const nr = r + 1;
          if (nr % 3 === 0) setBoost((b) => Math.min(2, b + 1)); // Flow Ranger: heat up
          return nr;
        });
        setWrongStreak(0);
        store.trackAnswer(true);
        store.trackSkill(q.kind, true); // Parent HQ: which skills the kid nails
        store.trackCombo(nc);
        sfx.correct();
        if (nc >= 3) window.setTimeout(() => sfx.combo(nc), 140);
        setLeoMood(nc >= 5 ? "excited" : "happy");
        setBubble(nc >= 5 ? UNSTOPPABLE[nc % UNSTOPPABLE.length] : PRAISE[nc % PRAISE.length]);
        /* juice: floating "+points" and milestone banners */
        const popId = Date.now() + Math.random();
        setPops((p) => [...p, { id: popId, pts }]);
        window.setTimeout(() => setPops((p) => p.filter((x) => x.id !== popId)), 950);
        if (nc === 5 || nc === 8 || nc === 10) {
          const bid = Date.now() + Math.random();
          setBanner({ id: bid, text: UNSTOPPABLE[nc % UNSTOPPABLE.length] });
          window.setTimeout(() => setBanner((b) => (b && b.id === bid ? null : b)), 1200);
        }
      } else {
        // v4 kindness: running out of TIME on the learning levels (1-2)
        // never costs a heart — young kids are slow readers, not wrong.
        const gentleTimeout = idx === null && levelIdx <= GENTLE_LEVELS;
        if (!practice && !gentleTimeout) store.loseHeart();
        store.trackAnswer(false);
        store.trackSkill(q.kind, false); // Parent HQ: which skills need gentler levels
        setCombo(0);
        setWrongStreak((w) => {
          const nw = w + 1;
          if (nw % 2 === 0) setBoost((b) => Math.max(-1, b - 1)); // Flow Ranger: cool down
          return nw;
        });
        setRightStreak(0);
        if (idx === null) sfx.timeUp(); // the clock's own voice — distinct from a wrong answer
        else sfx.wrong();
        if (!practice && !gentleTimeout) window.setTimeout(() => sfx.heartLost(), 240);
        if (idx === null) setTimeUp(true); // a bubble a pre-reader can't READ is not a moment (docs/KID-TEST.md #6)
        setShakeKey((k) => k + 1);
        setLeoMood("sad");
        setBubble(
          idx === null
            ? gentleTimeout
              ? "Time's up — no heart lost! Try the next one:"
              : "Time's up! Here's the trick:"
            : `${OOPS[Math.floor(Math.random() * OOPS.length)]} ${q.tip}`
        );
      }

      window.setTimeout(() => advance(ok), ok ? 900 : 1600);
    },
    [q, phase, combo, advance]
  );

  answerRef.current = (i: number) => {
    if (!q || phase !== "play") return;
    if (q.kind === "memory") return;
    if (q.options.length && i < q.options.length) handleAnswer(i);
  };

  /* countdown ring */
  const timeLeftRef = useRef(0);
  const [timeLeft, setTimeLeft] = useState(10);
  useEffect(() => {
    if (phase !== "play" || !q) return;
    setTimeUp(false); // fresh round: clear the previous "time's up!" stamp
    const total = q.time;
    setTimeLeft(total);
    timeLeftRef.current = total;
    const start = performance.now();
    let lastTick = Math.ceil(total);
    const id = window.setInterval(() => {
      const left = total - (performance.now() - start) / 1000;
      timeLeftRef.current = Math.max(0, left);
      setTimeLeft(Math.max(0, left));
      const whole = Math.ceil(left);
      if (whole !== lastTick && whole <= 5 && whole > 0) sfx.tick();
      lastTick = whole;
      if (left <= 0) {
        window.clearInterval(id);
        handleAnswer(null);
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [phase, qi, q, handleAnswer]);

  /* ── LEO RUSH ────────────────────────────────────────────────── */

  const endRush = useCallback(() => {
    const s = useLeo.getState();
    const total = score + rushScore;
    const accuracy = answeredCount > 0 ? correctCount / answeredCount : 0;
    const stars = starsFor(accuracy);
    const rawXp = stars > 0 ? xpForRun(total, stars) : 0;
    // practice runs pay half XP — the level still ENDS, stars still land,
    // but the honest way to earn big is with hearts on the line
    const xp = practice ? Math.ceil(rawXp / 2) : rawXp;
    const isBest = stars > 0 && !practice && total > (s.best[levelIdx] ?? 0);
    // ANY finished run counts today as played — streaks record on effort,
    // not only on wins (a kid who tried and missed must keep their flame).
    s.noteActivity();
    if (!recordedRef.current) {
      recordedRef.current = true;
      if (rushHits > 0) s.trackRush(rushHits);
      // v4: EVERY finished run is recorded — the `done` flag it sets opens
      // the next level, so a level can never fail to end in progress.
      s.recordLevel(levelIdx, stars, total);
      if (xp > 0) s.addXp(xp);
    }
    const chest = stars > 0 && !practice && chestAfterLevel(levelIdx);
    if (chest) s.grantChest(world.id);

    const sAfter = useLeo.getState();
    const lvlUp = playerLevelFromXp(sAfter.xp) > playerLevelFromXp(xpBeforeRef.current)
      ? playerLevelFromXp(sAfter.xp)
      : null;
    const leagueUp = leagueOf(sAfter.weekXp).name !== leagueBeforeRef.current
      ? leagueOf(sAfter.weekXp).name
      : null;

    setResults({ stars, xp, accuracy, total, isBest, chest, practice, levelUpTo: lvlUp, leagueUpTo: leagueUp, rushHits });
    setPhase("results");
    if (stars > 0) {
      sfx.fanfare();
      if (leagueUp) window.setTimeout(() => sfx.leagueUp(), 700);
      setConfettiKey((k) => k + 1);
      setLeoMood(stars === 3 ? "cheer" : "celebrate");
      setBubble(stars === 3 ? "PERFECT RUN! I'm roaring the roof off!" : "Level crushed! More stars next time?");
      for (let i = 0; i < stars; i++) window.setTimeout(() => sfx.star(i), 600 + i * 380);
    } else {
      sfx.sadTrombone();
      setLeoMood("sad");
      setBubble("So close! One more try — I'll cheer for you!");
    }
  }, [score, rushScore, answeredCount, correctCount, rushHits, levelIdx, world.id, practice]);

  /* ── THE RUSH CLOCK ────────────────────────────────────────────
     endRush is rebuilt on every rush hit (its deps include rushScore
     and rushHits), so this effect MUST NOT depend on it — otherwise
     every correct tap would restart the 12 seconds and the level
     would never, ever end. We call the latest endRush through a ref
     and key the interval on the phase alone. */
  const endRushRef = useRef(endRush);
  endRushRef.current = endRush;
  useEffect(() => {
    if (phase !== "rush") return;
    const start = performance.now();
    const id = window.setInterval(() => {
      const left = RUSH_SECONDS - (performance.now() - start) / 1000;
      setRushLeft(Math.max(0, left));
      if (left <= 0) {
        window.clearInterval(id);
        endRushRef.current();
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [phase]);

  const rushAnswer = useCallback(
    (idx: number | null) => {
      if (idx === null) return; // no timeout penalty inside the rush
      const rq = rushQs[rushIdx];
      if (!rq) return;
      const ok = idx === rq.answer;
      if (ok) {
        setRushScore((s) => s + 120);
        setRushHits((h) => h + 1);
        setRushCombo((c) => {
          const nc = c + 1;
          sfx.combo(nc + 2);
          return nc;
        });
      } else {
        setRushCombo(0);
        sfx.tap();
      }
      if (rushIdx < rushQs.length - 1) setRushIdx((i) => i + 1);
    },
    [rushQs, rushIdx]
  );

  const hearts = useLeo((s) => s.hearts);
  const refills = useLeo((s) => s.refills);
  const doRefill = useLeo((s) => s.useRefill);
  const doBoost = useLeo((s) => s.claimBoost);
  const canBoost = useLeo((s) => s.boostDay !== dayKey() && s.hearts < MAX_HEARTS);

  /* ── render ──────────────────────────────────────────────────── */

  const qTimeTotal = q?.time ?? 10;
  const danger = phase === "play" && timeLeft <= 3.5;
  const hotCombo = combo >= 5 || (phase === "rush" && rushCombo >= 4);
  const rushQ = phase === "rush" ? rushQs[rushIdx] : null;
  const parade = WORLD_TILES[world.id] ?? WORLD_TILES[0];

  /* heartbeat under danger */
  useEffect(() => {
    if (!danger) return;
    sfx.pulse();
    const id = window.setInterval(() => sfx.pulse(), 1100);
    return () => window.clearInterval(id);
  }, [danger]);

  /* music mood follows the phase: rush gets its own driving loop */
  useEffect(() => {
    if (phase === "rush") sfx.startMusic("rush");
    else if (phase === "results" || phase === "out") sfx.startMusic("home");
  }, [phase]);

  return (
    <div
      className="relative h-screen w-full overflow-hidden"
      style={{ background: `linear-gradient(180deg, ${world.wash[0]}, ${world.wash[1]})` }}
    >
      <QuestWatch />
      {/* living background: world-flavoured cartoons drifting behind the action */}
      {world.id === 2 ? (
        /* Space Hop gets a lazy-loaded 3D sky (three.js) behind everything */
        <SpaceSky className="pointer-events-none absolute inset-0 z-0" opacity={0.55} />
      ) : null}
      <AmbientCartoons world={world.id} count={8} opacity={0.15} />
      {/* heartbeat vignette */}
      {danger && (
        <div
          className="pointer-events-none absolute inset-0 z-10"
          style={{ boxShadow: "inset 0 0 90px rgba(255,60,90,0.45)" }}
        />
      )}
      {hotCombo && <div className="combo-hot pointer-events-none absolute inset-0 z-10" />}
      {/* LEO RUSH: racing light-streaks + pulsing aura */}
      {phase === "rush" && (
        <>
          <div className="rush-lines pointer-events-none absolute inset-0 z-10" />
          <div className="rush-aura pointer-events-none absolute inset-0 z-10" />
        </>
      )}

      <ConfettiBurst fireKey={confettiKey} />

      {/* floating +points */}
      <div className="pointer-events-none absolute inset-x-0 top-16 z-30 flex justify-center">
        <AnimatePresence>
          {pops.map((p) => (
            <motion.span
              key={p.id}
              initial={{ y: 18, opacity: 0, scale: 0.5 }}
              animate={{ y: -44, opacity: [0, 1, 1, 0], scale: [0.5, 1.25, 1, 0.9] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9, ease: "easeOut" }}
              className="font-display text-3xl font-bold text-leo-leaf-deep drop-shadow-[0_2px_0_rgba(255,255,255,0.9)]"
            >
              +{p.pts}
            </motion.span>
          ))}
        </AnimatePresence>
      </div>

      {/* combo milestone banner sweeping across the screen */}
      <AnimatePresence>
        {banner && (
          <motion.div
            key={banner.id}
            initial={{ x: "-120%", rotate: -3 }}
            animate={{ x: "0%", rotate: -3 }}
            exit={{ x: "130%", rotate: -3 }}
            transition={{ type: "spring", stiffness: 210, damping: 20 }}
            className="pointer-events-none absolute left-0 top-1/3 z-40"
          >
            <div className="rounded-r-2xl border-[3px] border-white bg-gradient-to-r from-leo-sun via-leo-berry to-leo-grape px-6 py-2 shadow-[0_6px_0_rgba(0,0,0,0.15)]">
              <span className="font-display text-2xl font-bold text-white text-outline-sm">{banner.text}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TIME'S UP! — a stamp a pre-reader FEELS: big, wobbly, unmissable */}
      <AnimatePresence>
        {timeUp && (
          <motion.div
            key="timeup"
            initial={{ scale: 2.2, opacity: 0, rotate: 10 }}
            animate={{ scale: 1, opacity: 1, rotate: -6 }}
            exit={{ scale: 0.7, opacity: 0, rotate: -12 }}
            transition={{ type: "spring", stiffness: 320, damping: 15 }}
            className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center"
          >
            <div className="rounded-3xl border-[5px] border-leo-berry bg-white/95 px-8 py-4 shadow-[0_10px_0_rgba(0,0,0,0.12)]">
              <span className="font-display text-4xl font-black tracking-wide text-leo-berry">
                TIME&apos;S UP!
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HUD */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={onExit}
          className="pill cursor-pointer px-3 py-1.5 font-display text-sm text-leo-ink hover:bg-leo-cream"
        >
          <X width={14} height={14} /> Map
        </button>
        <div className="pill gap-1.5 px-3 py-1 font-display text-sm text-leo-ink">
          <Sticker id={world.emblem} size={18} />
          Lv {levelIdx}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <AnimatePresence mode="popLayout">
            {combo >= 2 && (phase === "play" || phase === "reveal") && (
              <motion.div
                key={combo}
                initial={{ scale: 0.4, rotate: -8, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                className="pill px-3 py-1"
                style={{ background: "#fff3c4", borderColor: "#ffb020" }}
              >
                <span className="font-display text-sm font-bold text-leo-sun-deep">×{combo} COMBO</span>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="pill px-3 py-1 font-display text-sm font-bold text-leo-ink">
            {score + rushScore} <span className="font-normal text-leo-ink-soft">pts</span>
          </div>
          <HeartPill compact />
        </div>
      </div>

      {/* phases */}
      <AnimatePresence mode="wait">
        {phase === "intro" && (
          <IntroCard
            key="intro"
            levelIdx={levelIdx}
            plan={plan}
            hearts={hearts}
            refills={refills}
            practice={practice}
            canBoost={canBoost}
            onStart={() => {
              sfx.click();
              setLeoMood("excited");
              setBubble(practice ? "Practice time — no hearts needed!" : "8 puzzles. Beat the clock. ROAR!");
              window.setTimeout(() => setBubble(null), 1600);
              setPhase("play");
            }}
            onRefill={() => {
              if (doRefill()) {
                sfx.flame();
                setPractice(false);
                setBubble("Hearts full — LET'S GO!");
              }
            }}
            onBoost={() => {
              if (doBoost()) {
                sfx.flame();
                setPractice(false);
                setBubble("Leo's boost — hearts FULL! ROAR!");
              }
            }}
            onPractice={() => {
              sfx.click();
              resetRun(false, true);
            }}
            onExit={onExit}
          />
        )}

        {(phase === "play" || phase === "reveal") && q && (
          <motion.section
            key={`q-${qi}-${shakeKey}`}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="absolute inset-0 z-[15] flex flex-col items-center justify-center px-6 pt-14"
          >
            {/* progress + timer */}
            <div className="mb-3 flex w-full max-w-2xl items-center justify-between">
              <PawProgress current={qi} total={ROUND_COUNT} />
              <TimerRing left={timeLeft} total={qTimeTotal} />
            </div>

            {/* Leo + question card */}
            <div className="flex w-full max-w-2xl items-end gap-2 sm:gap-3">
              <div className="hidden shrink-0 sm:block">
                <Leo mood={leoMood} size={130} bubble={bubble} />
              </div>
              {/* pocket Leo keeps the mascot on phones too */}
              <div className="shrink-0 sm:hidden">
                <Leo mood={leoMood} size={64} />
              </div>
              <div className={`leo-card w-full p-4 sm:p-5 ${shakeKey % 2 === 1 && phase === "reveal" && !revealOk ? "anim-shake" : ""}`}>
                <h2 className="text-center font-display text-lg font-bold text-leo-ink sm:text-xl">{q.prompt}</h2>
                <div className="mt-3 sm:mt-4">
                  <QuestionStage q={q} reveal={phase === "reveal"} picked={picked} onAnswer={handleAnswer} />
                </div>
              </div>
            </div>

            {/* compact Leo line */}
            <p className="mt-3 font-display text-sm font-semibold text-leo-ink md:hidden">
              {bubble ?? ""}
            </p>
          </motion.section>
        )}

        {phase === "rushIntro" && (
          <motion.div
            key="rushintro"
            className="absolute inset-0 z-[25] flex flex-col items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 0.2, rotate: -14 }}
              animate={{ scale: [0.2, 1.25, 1], rotate: [-14, 4, 0] }}
              transition={{ duration: 0.7 }}
              className="font-display text-7xl font-bold"
            >
              <span className="bg-gradient-to-r from-leo-sun via-leo-berry to-leo-grape bg-clip-text text-transparent">
                LEO RUSH!
              </span>
            </motion.div>
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-2 font-display text-xl text-leo-ink"
            >
              Everything ×2 · no hearts lost · GO!
            </motion.div>
            <div className="mt-4">
              <Leo mood="excited" size={150} />
            </div>
          </motion.div>
        )}

        {phase === "rush" && rushQ && (
          <motion.section
            key={`rush-${rushIdx}`}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.06 }}
            transition={{ duration: 0.12 }}
            className="absolute inset-0 z-[15] flex flex-col items-center justify-center px-6 pt-10"
          >
            <div className="mb-2 flex w-full max-w-xl items-center justify-between">
              <span className="pill px-3 py-1 font-display text-sm font-bold text-leo-berry-deep">
                ×2 RUSH
              </span>
              <span
                className={`pill gap-1.5 px-3 py-1 font-display text-lg font-bold ${
                  rushLeft <= 4 ? "text-leo-berry-deep anim-heartbeat" : "text-leo-ink"
                }`}
              >
                <TimerIcon size={15} />
                {rushLeft.toFixed(1)}s
              </span>
              {rushCombo >= 2 && (
                <span className="pill px-3 py-1 font-display text-sm font-bold text-leo-sun-deep">
                  streak {rushCombo}
                </span>
              )}
            </div>
            <div className="leo-card w-full max-w-xl p-5">
              <h2 className="text-center font-display text-xl font-bold text-leo-ink">{rushQ.prompt}</h2>
              <div className="mt-4">
                <QuestionStage q={rushQ} reveal={false} picked={null} onAnswer={rushAnswer} rushMode />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <Leo mood="excited" size={92} />
              <div className="font-display text-3xl font-bold text-leo-ink">{rushScore}</div>
            </div>
          </motion.section>
        )}

        {phase === "out" && (
          <motion.div
            key="out"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute inset-0 z-[25] flex flex-col items-center justify-center overflow-y-auto leo-scroll px-6 py-6"
          >
            <Leo mood="sad" size={170} bubble={bubble} />
            <div className="leo-card mt-6 w-full max-w-md p-6 text-center">
              <h2 className="font-display text-2xl font-bold text-leo-ink">Out of hearts!</h2>
              <p className="mt-2 text-sm leading-relaxed text-leo-ink-soft">
                You can wait for hearts — or keep going right now: practice runs
                have no hearts to lose, and Leo gives one free boost every day.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <ChunkyButton color="leaf" size="lg" onClick={() => { sfx.click(); resetRun(false, true); }}>
                  <span className="inline-flex items-center gap-1.5">
                    <PlayIcon width={18} height={18} className="fill-white" /> Keep playing
                  </span>
                </ChunkyButton>
                {canBoost && (
                  <ChunkyButton color="sun" onClick={() => { if (doBoost()) { sfx.flame(); setPhase("intro"); } }}>
                    <span className="inline-flex items-center gap-1.5">
                      <Sparkles width={17} height={17} /> Leo's boost (free today)
                    </span>
                  </ChunkyButton>
                )}
                {refills > 0 && (
                  <ChunkyButton color="grape" onClick={() => { doRefill(); sfx.flame(); setPhase("intro"); }}>
                    <span className="inline-flex items-center gap-1.5">
                      <Ticket width={17} height={17} /> Use refill ({refills})
                    </span>
                  </ChunkyButton>
                )}
                <ChunkyButton color="cocoa" onClick={onExit}>
                  Back to map
                </ChunkyButton>
              </div>
            </div>
          </motion.div>
        )}

        {phase === "results" && results && (
          <motion.div
            key="results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-[25] flex flex-col items-center justify-center overflow-y-auto bg-black/25 px-6 py-6 backdrop-blur-[2px] leo-scroll"
          >
            <motion.div
              initial={{ scale: 0.7, y: 40 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 18 }}
              className="leo-card w-full max-w-md p-7 text-center"
            >
              <div className="flex justify-center">
                <Leo mood={leoMood} size={150} bubble={bubble} />
              </div>
              <h2 className="mt-2 font-display text-3xl font-bold text-leo-ink">
                {results.stars > 0 ? "Level complete!" : "Level finished!"}
              </h2>
              <div className="mt-3 flex justify-center">
                <StarRow n={results.stars} size={44} animate />
              </div>
              {results.practice && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="pill mx-auto mt-2 px-3 py-1 text-xs text-leo-teal-deep">
                  <Sparkles width={13} height={13} /> Practice run · hearts frozen · half XP
                </motion.div>
              )}
              <div className="mt-4 grid grid-cols-3 gap-2">
                <Stat label="Score" value={<ScoreCountUp to={results.total} />} />
                <Stat label="Accuracy" value={`${Math.round(results.accuracy * 100)}%`} />
                <Stat label="XP" value={`+${results.xp}`} />
              </div>

              {/* star slam: one shockwave ring per earned star, timed with the chimes */}
              <div className="pointer-events-none relative mx-auto mt-3 h-0 w-0">
                {Array.from({ length: results.stars }, (_, i) => (
                  <span
                    key={i}
                    className="anim-ring absolute -left-8 -top-8 h-16 w-16 rounded-full border-4 border-leo-sun"
                    style={{ animationDelay: `${0.62 + i * 0.38}s` }}
                  />
                ))}
              </div>

              {/* the world's cartoon crowd cheers the result */}
              {results.stars > 0 && (
                <div className="mt-4 flex items-end justify-center gap-1.5" aria-hidden>
                  {parade.map((s, i) => (
                    <motion.span
                      key={`${s}-${i}`}
                      initial={{ y: 26, opacity: 0, scale: 0.6 }}
                      animate={{ y: [0, -8, 0], opacity: 1, scale: 1 }}
                      transition={{
                        y: { duration: 0.62, repeat: Infinity, ease: "easeInOut", delay: i * 0.09 },
                        opacity: { delay: 0.35 + i * 0.1 },
                        scale: { delay: 0.35 + i * 0.1, type: "spring", stiffness: 300, damping: 14 },
                      }}
                    >
                      <Sticker id={s} size={34} />
                    </motion.span>
                  ))}
                  <motion.span
                    initial={{ scale: 0, rotate: -30 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.9, type: "spring", stiffness: 280, damping: 12 }}
                  >
                    <Leo mood="celebrate" size={44} />
                  </motion.span>
                </div>
              )}

              {results.rushHits >= 8 && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.7 }} className="pill mx-auto mt-3 gap-1.5 px-3 py-1 text-sm text-leo-berry-deep">
                  <PartyPopper width={15} height={15} /> {results.rushHits} Rush hits!
                </motion.div>
              )}
              {results.isBest && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.9 }} className="pill mx-auto mt-3 gap-1.5 px-3 py-1 text-sm text-leo-sun-deep">
                  <Medal width={15} height={15} /> New best score!
                </motion.div>
              )}
              {results.stars === 0 && !results.practice && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.75 }} className="pill mx-auto mt-3 px-3 py-1 text-sm text-leo-leaf-deep">
                  Level opened up — keep going!
                </motion.div>
              )}
              {results.chest && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.15 }} className="pill mx-auto mt-2 gap-1.5 px-3 py-1 text-sm text-leo-ink">
                  <ChestArt state="open" size={20} /> World chest: +3 refills, +40 XP
                </motion.div>
              )}
              {results.leagueUpTo && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.35 }} className="pill mx-auto mt-2 gap-1.5 px-3 py-1 text-sm text-leo-grape">
                  <ChestArt state="ready" size={18} /> Welcome to the {results.leagueUpTo} league!
                </motion.div>
              )}
              {results.levelUpTo && (
                <motion.div
                  initial={{ scale: 0, rotate: -6 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 1.5, type: "spring", stiffness: 260, damping: 14 }}
                  className="mx-auto mt-3 rounded-2xl border-[3px] border-leo-leaf-deep bg-gradient-to-r from-leo-leaf to-leo-teal px-5 py-2 font-display text-xl font-bold text-white shadow-[0_5px_0_rgba(63,154,0,0.6)]"
                >
                  PLAYER LEVEL {results.levelUpTo}!
                </motion.div>
              )}

              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {hasNext && results.stars > 0 && (
                  <ChunkyButton color="leaf" size="lg" onClick={onNext}>
                    <span className="inline-flex items-center gap-1.5">Next level</span>
                  </ChunkyButton>
                )}
                {hasNext && results.stars === 0 && (
                  <ChunkyButton color="leaf" size="lg" onClick={onNext}>
                    <span className="inline-flex items-center gap-1.5">Level {levelIdx + 1}</span>
                  </ChunkyButton>
                )}
                <ChunkyButton color="sun" onClick={() => resetRun(true)}>
                  <span className="inline-flex items-center gap-1.5">
                    <RotateCcw width={17} height={17} /> Replay
                  </span>
                </ChunkyButton>
                <ChunkyButton color="cocoa" onClick={onExit}>
                  Map
                </ChunkyButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── pieces ────────────────────────────────────────────────────── */

/** Pops "Quest complete!" the moment a daily quest fills up mid-run. */
function QuestWatch() {
  const { board, progress, claimed } = useQuests();
  const seen = useRef<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ label: string; key: number } | null>(null);

  useEffect(() => {
    board.forEach((q, i) => {
      const done = (progress[i] ?? 0) >= q.target && !claimed[i];
      if (done && !seen.current[q.id]) {
        seen.current[q.id] = true;
        setToast({ label: q.label, key: Date.now() });
        sfx.questDone();
        window.setTimeout(() => setToast(null), 2800);
      }
      if (!done) seen.current[q.id] = false;
    });
  }, [board, progress, claimed]);

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.key}
          initial={{ y: -60, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="absolute left-1/2 top-16 z-[30] -translate-x-1/2"
        >
          <div className="flex items-center gap-2 rounded-2xl border-[3px] border-leo-sun bg-white px-4 py-2 shadow-[0_6px_0_rgba(214,178,110,0.4)]">
            <PartyPopper width={16} height={16} className="text-leo-sun-deep" />
            <span className="font-display text-sm font-bold text-leo-ink">Quest complete!</span>
            <span className="text-xs text-leo-ink-soft">{toast.label}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border-[2.5px] border-leo-line bg-leo-cream px-2 py-2">
      <div className="font-display text-lg font-bold leading-none text-leo-ink">{value}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wide text-leo-ink-soft">{label}</div>
    </div>
  );
}

function TimerRing({ left, total }: { left: number; total: number }) {
  /* kid-tested: a 28 px ring with a 14 px digit is invisible to a pre-reader
     (docs/KID-TEST.md) — the clock is now a fist-sized dial a thumb can read */
  const r = 26;
  const c = 2 * Math.PI * r;
  const frac = clamp(left / total, 0, 1);
  const low = left <= 5;
  return (
    <div className={`relative h-16 w-16 shrink-0 ${low ? "anim-heartbeat" : ""}`}>
      <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
        <circle cx="32" cy="32" r={r} fill="#fff" stroke="#F0E0BD" strokeWidth="7" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke={low ? "#ff5a8c" : "#58cc02"}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
        />
      </svg>
      <span className={`absolute inset-0 flex items-center justify-center font-display text-2xl font-black ${low ? "text-leo-berry-deep" : "text-leo-ink"}`}>
        {Math.ceil(left)}
      </span>
    </div>
  );
}

function IntroCard({
  levelIdx,
  plan,
  hearts,
  refills,
  practice,
  canBoost,
  onStart,
  onRefill,
  onBoost,
  onPractice,
  onExit,
}: {
  levelIdx: number;
  plan: string[];
  hearts: number;
  refills: number;
  practice: boolean;
  canBoost: boolean;
  onStart: () => void;
  onRefill: () => void;
  onBoost: () => void;
  onPractice: () => void;
  onExit: () => void;
}) {
  const world = worldOf(levelIdx);
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className="absolute inset-0 z-[20] flex flex-col items-center justify-center overflow-y-auto leo-scroll px-6 py-6"
    >
      <Leo mood="excited" size={150} bubble="Ready to think fast?" />
      <div className="leo-card mt-4 w-full max-w-md p-6 text-center">
        <div className="flex items-center justify-center gap-2 font-display text-sm font-semibold uppercase tracking-widest text-leo-ink-soft">
          <Sticker id={world.emblem} size={22} />
          {world.name}
        </div>
        <h1 className="font-display text-4xl font-bold text-leo-ink">Level {levelIdx}</h1>
        {practice && (
          <div className="pill mx-auto mt-2 px-3 py-1 text-xs text-leo-teal-deep">
            <Sparkles width={13} height={13} /> Practice · no hearts needed · half XP
          </div>
        )}
        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
          {plan.map((k, i) => (
            <KindChip key={i} icon={k as keyof typeof KIND_LABEL} label={KIND_LABEL[k]} />
          ))}
        </div>
        <p className="mt-3 text-sm leading-relaxed text-leo-ink-soft">
          {ROUND_COUNT} puzzles · answer fast for combo multipliers · keep {hearts > 0 ? "your hearts" : "a heart"} to reach the{" "}
          <b className="text-leo-ink">LEO RUSH</b> ×2 finale!
        </p>
        {hearts === 0 && !practice ? (
          <div className="mt-4">
            <p className="mb-2 font-display text-base font-bold text-leo-berry-deep">No hearts left!</p>
            <div className="flex flex-wrap justify-center gap-2">
              <ChunkyButton color="leaf" onClick={onPractice} ariaLabel="Keep playing in practice mode">
                <span className="inline-flex items-center gap-1.5">
                  <PlayIcon width={17} height={17} className="fill-white" /> Keep playing
                </span>
              </ChunkyButton>
              {canBoost && (
                <ChunkyButton color="sun" onClick={onBoost} ariaLabel="Use Leo's free daily heart boost">
                  <span className="inline-flex items-center gap-1.5">
                    <Sparkles width={17} height={17} /> Leo's boost
                  </span>
                </ChunkyButton>
              )}
              <ChunkyButton color="grape" onClick={onRefill} disabled={refills <= 0}>
                <span className="inline-flex items-center gap-1.5">
                  <Ticket width={17} height={17} /> Use refill ({refills})
                </span>
              </ChunkyButton>
              <ChunkyButton color="cocoa" onClick={onExit}>
                Back to map
              </ChunkyButton>
            </div>
          </div>
        ) : (
          <div className="mt-5">
            <ChunkyButton color="leaf" size="xl" onClick={onStart} ariaLabel="Start the level">
              <span className="inline-flex items-center gap-2">
                <PlayIcon width={22} height={22} className="fill-white" /> {practice ? "PRACTICE" : "START"}
              </span>
            </ChunkyButton>
            {hearts > 0 && hearts < MAX_HEARTS && canBoost && (
              <div className="mt-3">
                <ChunkyButton color="sun" size="sm" onClick={onBoost} ariaLabel="Top hearts up with Leo's free daily boost">
                  <span className="inline-flex items-center gap-1.5">
                    <Sparkles width={15} height={15} /> Leo's boost (free today)
                  </span>
                </ChunkyButton>
              </div>
            )}
            {/* every intro is escapable — a kid who tapped the wrong level
                is never trapped inside the curtain */}
            <button
              type="button"
              onClick={onExit}
              className="mt-3 block w-full cursor-pointer font-display text-sm font-bold text-leo-ink-soft underline decoration-leo-line decoration-2 underline-offset-4 hover:text-leo-ink"
            >
              Back to map
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ── question stage ────────────────────────────────────────────── */

function QuestionStage({
  q,
  reveal,
  picked,
  onAnswer,
  rushMode = false,
}: {
  q: Question;
  reveal: boolean;
  picked: number | null;
  onAnswer: (i: number | null) => void;
  rushMode?: boolean;
}) {
  const bigDisplay = q.display ?? null;

  return (
    <div>
      {bigDisplay && (
        <div className="py-2 text-center font-display text-5xl font-bold tracking-wide text-leo-ink">
          {bigDisplay}
        </div>
      )}

      {q.kind === "count" && q.tiles && (
        <div className="mx-auto flex max-w-md flex-wrap justify-center gap-1.5 py-2">
          {q.tiles.map((t, i) => (
            <StickerTile key={i} id={t} size={54} delay={i * 0.03} />
          ))}
        </div>
      )}

      {q.kind === "sequence" && q.seq && (
        <div className="flex flex-wrap justify-center gap-2 py-2">
          {q.seq.map((s, i) => (
            <span
              key={i}
              className={`flex h-14 min-w-14 items-center justify-center rounded-xl border-[3px] px-2 font-display text-2xl font-bold ${
                s === "?" ? "border-leo-sun bg-leo-cream text-leo-sun-deep" : "border-leo-line bg-white text-leo-ink"
              }`}
            >
              {s}
            </span>
          ))}
        </div>
      )}

      {q.kind === "tapTarget" && q.tiles && q.ask && (
        <TapTargetGame
          tiles={q.tiles}
          target={q.ask}
          disabled={reveal}
          onResult={(ok) => onAnswer(ok ? q.answer : q.answer + 1)}
        />
      )}

      {q.kind === "shadow" && q.ask && (
        <div className="flex justify-center py-2">
          <div className="flex items-center justify-center rounded-2xl bg-leo-sand px-8 py-3 shadow-inner">
            <span style={{ filter: "brightness(0) opacity(0.82)" }}>
              <Sticker id={q.ask} size={84} />
            </span>
          </div>
        </div>
      )}

      {/* feed Leo: drop exactly N snacks, then tap DONE (v4 hands-on game).
          NOTE: this must key on "feedLeo" — an earlier build conditioned on
          "shadow", which starved feed-Leo rounds of their board entirely and
          bolted a snack bowl onto every shadow round. */}
      {q.kind === "feedLeo" && q.ask && (
        <FeedLeoGame
          snack={q.ask}
          want={q.want ?? 3}
          disabled={reveal}
          onResult={(ok) => onAnswer(ok ? q.answer : q.answer + 1)}
        />
      )}

      {q.kind === "memory" && q.pads && (
        <MemoryPads pads={q.pads} onResult={(ok) => onAnswer(ok ? q.answer : (q.answer + 1) % 4)} disabled={reveal} />
      )}

      {/* options */}
      {q.kind !== "memory" && q.kind !== "tapTarget" && q.kind !== "feedLeo" && q.options.length > 0 && (
        <div
          className={`mt-3 grid gap-2.5 ${
            q.options.length <= 2
              ? "grid-cols-2"
              : q.kind === "oddOne"
                ? "grid-cols-4"
                : q.options.every((o) => o.length <= 3)
                  ? "grid-cols-4"
                  : "grid-cols-2"
          }`}
        >
          {q.options.map((opt, i) => {
            const isCorrect = reveal && i === q.answer;
            const isWrongPick = reveal && picked === i && i !== q.answer;
            const plate = q.groupOptions?.[i];
            const isArt = (q.kind === "oddOne" || q.kind === "shadow") && isStickerId(opt);
            return (
              <motion.button
                key={i}
                type="button"
                disabled={reveal}
                onClick={() => onAnswer(i)}
                data-state={isCorrect ? "correct" : isWrongPick ? "wrong" : undefined}
                whileHover={!reveal ? { y: -3 } : undefined}
                whileTap={!reveal ? { scale: 0.96 } : undefined}
                className={`answer-bubble flex min-h-[64px] cursor-pointer items-center justify-center px-3 py-3 ${
                  isArt
                    ? ""
                    : q.kind === "truefalse"
                      ? "font-display text-2xl font-bold"
                      : "font-display text-2xl font-bold text-leo-ink"
                } ${q.kind === "truefalse" ? (i === 0 ? "bg-[#e9ffcf]" : "bg-[#ffe4ec]") : ""}`}
              >
                {plate ? (
                  <span className="flex flex-col items-center gap-1">
                    <span className="flex max-w-[200px] flex-wrap justify-center gap-0.5">
                      {plate.map((t, j) => (
                        <Sticker key={j} id={t} size={24} />
                      ))}
                    </span>
                    <span className="font-display text-lg font-bold text-leo-ink">{opt}</span>
                  </span>
                ) : isArt ? (
                  /* kid-tested: answers must be COLOURED animals — matching a black
                     shadow to MORE black shadows is abstract shape algebra for a
                     pre-reader (docs/KID-TEST.md #5). The question keeps its
                     silhouette; the answers show the real animal. */
                  <Sticker id={opt as StickerId} size={q.kind === "shadow" ? 60 : 52} />
                ) : (
                  opt
                )}
              </motion.button>
            );
          })}
        </div>
      )}

      {rushMode && null}
    </div>
  );
}

/* ── memory mini-game (Simon-style) ────────────────────────────── */

function MemoryPads({
  pads,
  onResult,
  disabled,
}: {
  pads: number[];
  onResult: (ok: boolean) => void;
  disabled: boolean;
}) {
  const [showIdx, setShowIdx] = useState(-1); // which pad is lit during playback
  const [watching, setWatching] = useState(true);
  const [inputStep, setInputStep] = useState(0);
  const [flash, setFlash] = useState<"ok" | "bad" | null>(null);
  const done = useRef(false);

  useEffect(() => {
    if (!watching) return;
    const timers: number[] = [];
    pads.forEach((p, i) => {
      timers.push(window.setTimeout(() => { setShowIdx(p); sfx.pad(p); }, 500 + i * 700));
      timers.push(window.setTimeout(() => setShowIdx(-1), 500 + i * 700 + 430));
    });
    timers.push(window.setTimeout(() => setWatching(false), 500 + pads.length * 700 + 250));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [pads, watching]);

  const press = (i: number) => {
    if (watching || disabled || done.current || flash) return;
    sfx.pad(i);
    if (pads[inputStep] === i) {
      if (inputStep + 1 === pads.length) {
        done.current = true;
        setFlash("ok");
        sfx.correct();
        window.setTimeout(() => onResult(true), 550);
      } else {
        setInputStep((s) => s + 1);
      }
    } else {
      done.current = true;
      setFlash("bad");
      sfx.wrong();
      window.setTimeout(() => onResult(false), 650);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3 py-1">
      <span className={`flex items-center gap-1.5 font-display text-sm font-bold ${watching ? "text-leo-grape" : "text-leo-leaf-deep"}`}>
        {watching ? (
          <>
            <Eye width={15} height={15} /> WATCH…
          </>
        ) : flash === "ok" ? (
          <>
            <PartyPopper width={15} height={15} /> PERFECT!
          </>
        ) : flash === "bad" ? (
          <>
            <EyeOff width={15} height={15} /> Oops…
          </>
        ) : (
          <>
            <HandIcon size={15} /> YOUR TURN — repeat it!
          </>
        )}
      </span>
      <div className="grid grid-cols-2 gap-3">
        {PAD_COLORS.map((color, i) => {
          const lit = showIdx === i;
          return (
            <motion.button
              key={i}
              type="button"
              aria-label={`Memory pad ${i + 1}`}
              onClick={() => press(i)}
              animate={{
                scale: lit ? 1.09 : 1,
                filter: lit ? "brightness(1.35)" : "brightness(1)",
              }}
              transition={{ duration: 0.12 }}
              className="h-24 w-24 cursor-pointer rounded-2xl border-[3.5px] border-white/90 shadow-[0_6px_0_rgba(0,0,0,0.16)]"
              style={{ background: color, opacity: flash === "bad" && pads[inputStep] !== i ? 0.9 : 1 }}
            />
          );
        })}
      </div>
    </div>
  );
}

/* ── v4 hands-on mini-games ────────────────────────────────────── */

/** Tap-the-target: pop every target in a mixed crowd. Wrong taps just boing. */
function TapTargetGame({
  tiles,
  target,
  disabled,
  onResult,
}: {
  tiles: StickerId[];
  target: StickerId;
  disabled: boolean;
  onResult: (ok: boolean) => void;
}) {
  const total = tiles.filter((t) => t === target).length;
  const [found, setFound] = useState<number[]>([]);
  const [miss, setMiss] = useState<number | null>(null);
  const doneRef = useRef(false);

  const tap = (i: number) => {
    if (disabled || doneRef.current || found.includes(i)) return;
    if (tiles[i] === target) {
      const nf = [...found, i];
      setFound(nf);
      sfx.found(nf.length - 1);
      if (nf.length === total) {
        doneRef.current = true;
        window.setTimeout(() => sfx.correct(), 120);
        window.setTimeout(() => onResult(true), 650);
      }
    } else {
      setMiss(i);
      sfx.boing();
      window.setTimeout(() => setMiss((m) => (m === i ? null : m)), 480);
    }
  };

  return (
    <div className="py-1">
      <div className="mb-2 flex justify-center">
        <span className="pill gap-1.5 px-3 py-1 text-sm font-bold text-leo-leaf-deep">
          <Target width={14} height={14} />
          {found.length} / {total} found
        </span>
      </div>
      <div className="mx-auto flex max-w-md flex-wrap justify-center gap-1.5">
        {tiles.map((t, i) => {
          const isFound = found.includes(i);
          return (
            <motion.button
              key={i}
              type="button"
              aria-hidden={isFound}
              tabIndex={-1}
              onClick={() => tap(i)}
              animate={
                isFound
                  ? { scale: 0, opacity: 0, rotate: 40 }
                  : miss === i
                    ? { x: [0, -5, 5, -3, 0] }
                    : { scale: 1, opacity: 1, rotate: 0 }
              }
              transition={{ duration: 0.28 }}
              whileHover={!isFound ? { scale: 1.1 } : undefined}
              whileTap={!isFound ? { scale: 0.9 } : undefined}
              className={`flex h-[52px] w-[52px] cursor-pointer items-center justify-center rounded-xl border-[2.5px] ${
                isFound ? "border-leo-leaf bg-[#e9ffcf]" : "border-transparent bg-white/70"
              }`}
            >
              <Sticker id={t} size={42} />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

/** Feed Leo: drop snacks one by one, count out loud, tap DONE when it matches. */
function FeedLeoGame({
  snack,
  want,
  disabled,
  onResult,
}: {
  snack: StickerId;
  want: number;
  disabled: boolean;
  onResult: (ok: boolean) => void;
}) {
  const [bowl, setBowl] = useState(0);
  const [done, setDone] = useState(false);
  const perfect = bowl === want;
  const CAP = want + 4; // room to overshoot, so kids can fix their count

  const drop = () => {
    if (disabled || done || bowl >= CAP) return;
    setBowl((b) => b + 1);
    sfx.munch();
  };
  const takeBack = () => {
    if (disabled || done) return;
    setBowl((b) => Math.max(0, b - 1));
    sfx.pop();
  };
  const finish = () => {
    if (disabled || done) return;
    setDone(true);
    const ok = bowl === want;
    window.setTimeout(() => (ok ? sfx.correct() : sfx.wrong()), 80);
    window.setTimeout(() => onResult(ok), 600);
  };

  return (
    <div className="flex flex-col items-center gap-2 py-1">
      <div className="flex items-end justify-center gap-3">
        <div className="shrink-0">
          <Leo mood={perfect ? "happy" : "thinking"} size={96} />
        </div>
        {/* Leo's bowl */}
        <div className="relative flex flex-col items-center">
          <motion.div
            key={bowl}
            initial={{ scale: perfect ? [1, 1.12, 1] : 1 }}
            animate={{ scale: 1 }}
            className="relative h-[86px] w-[168px]"
          >
            {/* bowl */}
            <svg viewBox="0 0 168 86" className="absolute inset-0">
              <ellipse cx="84" cy="76" rx="70" ry="8" fill="rgba(74,47,27,0.10)" />
              <path d="M22,34 Q22,72 84,72 Q146,72 146,34 Z" fill="#2ec4b6" stroke="#1e9e92" strokeWidth="3.5" strokeLinejoin="round" />
              <ellipse cx="84" cy="34" rx="62" ry="13" fill="#bff2ec" stroke="#1e9e92" strokeWidth="3.5" />
              <path d="M30,60 Q84,84 138,60" fill="none" stroke="#1e9e92" strokeWidth="2.5" opacity="0.6" />
            </svg>
            {/* dropped snacks */}
            {Array.from({ length: bowl }, (_, i) => (
              <motion.button
                key={`${bowl}-${i}`}
                type="button"
                aria-label="Take one snack back"
                onClick={takeBack}
                initial={{ y: -34, opacity: 0, scale: 0.5 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 320, damping: 18 }}
                className="absolute cursor-pointer"
                style={{ left: 30 + (i % 6) * 19, top: 18 + Math.floor(i / 6) * 17 }}
              >
                <Sticker id={snack} size={22} />
              </motion.button>
            ))}
          </motion.div>
          <span
            className={`pill mt-1 px-3 py-0.5 font-display text-sm font-bold ${
              perfect ? "text-leo-leaf-deep" : bowl > want ? "text-leo-berry-deep" : "text-leo-ink"
            }`}
          >
            {bowl} in the bowl · Leo wants {want}
          </span>
        </div>
      </div>

      {/* snack pile */}
      <motion.button
        type="button"
        onClick={drop}
        disabled={disabled || done || bowl >= CAP}
        whileTap={{ scale: 0.92 }}
        animate={disabled ? {} : { y: [0, -3, 0] }}
        transition={{ y: { duration: 1.4, repeat: Infinity, ease: "easeInOut" } }}
        className="flex cursor-pointer items-center gap-2 rounded-2xl border-[3px] border-leo-line bg-white px-5 py-2.5 shadow-[0_5px_0_rgba(214,178,110,0.35)] disabled:opacity-50"
        aria-label={`Drop one ${snack} into the bowl`}
      >
        <Sticker id={snack} size={34} />
        <span className="font-display text-sm font-bold text-leo-ink">Tap to drop</span>
      </motion.button>

      <ChunkyButton
        color={perfect ? "leaf" : "cocoa"}
        size="lg"
        onClick={finish}
        disabled={disabled || done}
        ariaLabel="Done feeding Leo"
      >
        DONE!
      </ChunkyButton>
    </div>
  );
}
