"use client";

/**
 * Think Leo — LEO EGGS (the surprise-egg arcade)
 * ──────────────────────────────────────────────
 * The flagship pure-fun game, built on the psychology that keeps kids
 * (and everyone else) glued to a feed — documented in docs/ALGORITHM.md §15:
 *
 *   TRIGGER    the Home card glows when the nest egg is ready; the
 *              Royal Egg is free every morning.
 *   ACTION     pick an egg, then PRESS AND HOLD — the egg shakes,
 *              fissures spread, gold light teases. One thumb, zero skill.
 *   VARIABLE   the reveal: rarity rolled on a slot-machine table, a
 *              near-miss gold tease, a 1.4-second silhouette suspense,
 *              then the burst. Never a miss — dupes pay stars.
 *   INVESTMENT the album fills, friends grow to Stage 2, the nest keeps
 *              incubating after the app closes, streak days make eggs
 *              luckier — every crack makes the next one more wanted.
 *
 * Stack: three.js egg (Egg3D), GSAP reveal timeline, framer-motion UI,
 * ONE economy (store v6): XP → daily ring/league/streak, stars → eggs.
 */

import { EggAlbum } from "@/components/eggs/EggAlbum";
import { EggRoom } from "@/components/eggs/EggRoom";
import { Egg3D } from "@/components/eggs/Egg3D";
import { Leo } from "@/components/leo/Leo";
import { Sticker } from "@/components/leo/stickers";
import { ChunkyButton, ConfettiBurst } from "@/components/game/bits";
import {
  COLLECTION_TARGET,
  EGG_DISCOVERY_STARS,
  EGG_KINDS,
  EGG_KIND_LIST,
  EGG_NEW_LINES,
  EGG_PRAISE,
  EGG_TEASE_LINES,
  PITY_AT,
  RARITY_META,
  SPARK_REST_MS,
  planEgg,
  streakLuck,
  type EggKind,
  type EggPlan,
} from "@/lib/eggs";
import { clamp, dayKey, pick } from "@/lib/game";
import { buzz } from "@/lib/arcade";
import { sfx } from "@/lib/sound";
import { useEggCollection, useEggNest, useLeo } from "@/lib/store";
import { AnimatePresence, motion } from "framer-motion";
import gsap from "gsap";
import {
  ArrowLeft,
  BookOpen,
  Crown,
  Egg as EggIcon,
  Hand,
  Heart,
  Lock,
  Sparkles,
  Star,
  Timer,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Phase = "choose" | "hold" | "reveal";
type Tab = "nest" | "album" | "room";

/** ms from first touch to burst — long enough to ache, short enough to hold */
const HOLD_MS = 1900;

interface Payout {
  gainedStars: number;
  xp: number;
}

export function EggGame({ onExit }: { onExit: () => void }) {
  /* subscribed store reads (render) — handlers use useLeo.getState() */
  const streak = useLeo((s) => s.streak);
  const soundMusic = useLeo((s) => s.soundMusic);
  const eggStars = useLeo((s) => s.eggStars);
  const eggPity = useLeo((s) => s.eggPity);
  const eggRoyalDay = useLeo((s) => s.eggRoyalDay);

  const [tab, setTab] = useState<Tab>("nest");
  const [phase, setPhase] = useState<Phase>("choose");
  const [kind, setKind] = useState<EggKind>("spark");
  const [crack, setCrack] = useState(0);
  const [holding, setHolding] = useState(false);
  const [burstKey, setBurstKey] = useState(0);
  const [wasNest, setWasNest] = useState(false);
  const [payout, setPayout] = useState<Payout | null>(null);
  const [, forceTick] = useState(0); // spark-warming ticker

  const planRef = useRef<EggPlan | null>(null);
  const milestoneRef = useRef(0);
  const crackRef = useRef(0);
  const firedRef = useRef(false);
  const lastSparkAt = useRef(0);

  const nest = useEggNest();
  const collection = useEggCollection();

  /* music: the calm "play" track fits the anticipation (ThinkLeo's own
     effect brings the home track back the moment this screen unmounts) */
  useEffect(() => {
    if (soundMusic) sfx.startMusic("play");
  }, [soundMusic]);

  const today = dayKey();
  const royalFree = eggRoyalDay !== today;
  const sparkCooling = Date.now() - lastSparkAt.current < SPARK_REST_MS;

  /* keep the "warming…" label alive while the spark egg rests */
  useEffect(() => {
    if (phase !== "choose" || Date.now() - lastSparkAt.current < SPARK_REST_MS) return;
    const id = window.setInterval(() => forceTick((n) => n + 1), 300);
    return () => window.clearInterval(id);
  }, [phase]);

  /* ── picking an egg ─────────────────────────────────────────── */
  const chooseEgg = useCallback((k: EggKind) => {
    const s = useLeo.getState();
    if (k === "spark" && Date.now() - lastSparkAt.current < SPARK_REST_MS) {
      sfx.lockClick();
      return;
    }
    const freeRoyal = s.eggRoyalDay !== dayKey();
    if (k === "rainbow" && !s.spendEggStars(EGG_KINDS.rainbow.cost)) {
      sfx.lockClick();
      return;
    }
    if (k === "royal" && !freeRoyal && !s.spendEggStars(EGG_KINDS.royal.cost)) {
      sfx.lockClick();
      return;
    }
    // roll ONCE, here — tease included; pity and streak luck apply
    planRef.current = planEgg(k, s.streak, s.eggPity, (uid) => !!s.eggBag[uid]);
    if (k === "spark") lastSparkAt.current = Date.now();
    firedRef.current = false;
    milestoneRef.current = 0;
    crackRef.current = 0;
    setPayout(null);
    setKind(k);
    setCrack(0);
    setPhase("hold");
    sfx.whoosh();
  }, []);

  /* ── the hold: one thumb, zero skill, rising tension ────────── */
  useEffect(() => {
    if (phase !== "hold" || !holding) return;
    let last = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const dt = now - last;
      last = now;
      // computed OUTSIDE the state updater: sounds and haptics inside an
      // updater run twice under StrictMode and violate render purity
      const next = Math.min(1, crackRef.current + dt / HOLD_MS);
      crackRef.current = next;
      setCrack(next);
      // shell ticks: the egg talks back as fissures spread
      const stage = next > 0.8 ? 3 : next > 0.5 ? 2 : next > 0.22 ? 1 : 0;
      if (stage > milestoneRef.current) {
        milestoneRef.current = stage;
        sfx.eggCrack();
        buzz(12);
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [phase, holding]);

  /* crack == 1 → burst → resolve into the economy → reveal */
  useEffect(() => {
    if (phase !== "hold" || crack < 1 || firedRef.current) return;
    firedRef.current = true;
    setHolding(false);
    setBurstKey((k) => k + 1);
    sfx.eggBurst();
    const plan = planRef.current;
    if (plan) {
      if (plan.rarity === "legend" || plan.rarity === "mythic") buzz([40, 60, 90]);
      const s = useLeo.getState();
      // a free daily Royal is claimed exactly when its egg actually hatches
      if (plan.kind === "royal" && s.eggRoyalDay !== dayKey()) s.claimRoyalEgg();
      setPayout(s.trackEgg(plan, { nest: wasNest }));
    }
    window.setTimeout(() => setPhase("reveal"), 520);
  }, [phase, crack, wasNest]);

  /* reveal exit paths — the nest flag always resets after its egg hatched */
  const backToChoose = useCallback(() => {
    setWasNest(false);
    setPhase("choose");
  }, []);

  const another = useCallback(() => {
    const s = useLeo.getState();
    const k = planRef.current?.kind ?? "spark";
    const freeRoyal = s.eggRoyalDay !== dayKey();
    const canChain =
      k === "spark" ||
      (k === "rainbow" && s.eggStars >= EGG_KINDS.rainbow.cost) ||
      (k === "royal" && (freeRoyal || s.eggStars >= EGG_KINDS.royal.cost));
    setWasNest(false);
    if (canChain) {
      setPhase("choose");
      // the 4s reveal already served the spark rest — chaining is the point
      if (k === "spark") lastSparkAt.current = 0;
      window.setTimeout(() => chooseEgg(k), 60);
    } else {
      sfx.click();
      setPhase("choose");
    }
  }, [chooseEgg]);

  const plan = planRef.current;
  const tease = !!(plan?.teased && crack > 0.45 && phase === "hold");

  const leoLine =
    phase === "hold"
      ? "Keep holding… keep holding!"
      : nest.ready
        ? "The nest egg is ready! Tap it!"
        : sparkCooling
          ? "Shhh… the next egg is warming."
          : "Pick an egg — press and HOLD!";

  return (
    <div
      className="fixed inset-0 overflow-y-auto leo-scroll"
      style={{ background: "linear-gradient(165deg,#fff7e0 0%,#ffeef6 55%,#f3e9ff 100%)" }}
    >
      {phase === "reveal" && plan && (
        <ConfettiBurst
          key={`conf-${burstKey}`}
          fireKey={RARITY_META[plan.rarity].wobble >= 7 ? 1 : 0}
          count={plan.rarity === "mythic" ? 130 : 80}
        />
      )}

      <div className="mx-auto flex w-full max-w-lg flex-col px-4 pb-32 pt-3">
        {/* ── top bar ── */}
        <header className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              sfx.click();
              onExit();
            }}
            aria-label="Back home"
            className="leo-card flex h-11 w-11 items-center justify-center p-0"
          >
            <ArrowLeft width={20} height={20} className="text-leo-ink" />
          </button>
          <div className="font-display text-xl font-bold text-leo-ink">
            LEO <span className="bg-gradient-to-r from-leo-berry to-leo-grape bg-clip-text text-transparent">EGGS</span>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="pill gap-1 px-3 py-1.5 font-display text-sm font-bold text-leo-ink" title="Egg stars — duplicate friends pay in">
              <Star width={14} height={14} className="fill-leo-sun text-leo-sun-deep" />
              {eggStars}
            </span>
            <span
              className="pill hidden gap-1 px-3 py-1.5 font-display text-sm font-bold text-leo-ink min-[420px]:flex"
              title="Friends discovered"
            >
              <BookOpen width={14} height={14} className="text-leo-teal-deep" />
              {collection.found}/{COLLECTION_TARGET}
            </span>
          </div>
        </header>

        {/* ── NEST TAB ── */}
        {tab === "nest" && (
          <>
            <div className="mt-3 flex items-end justify-between gap-2">
              <div className="anim-bob shrink-0">
                <Leo mood={phase === "hold" ? "excited" : nest.ready ? "wow" : "happy"} size={92} bubble={leoLine} />
              </div>
              {/* nest card — the real-time comeback engine */}
              <div
                className={`leo-card relative flex flex-1 items-center gap-3 p-3 ${nest.ready ? "anim-pulse-ring border-leo-sun" : ""}`}
                style={{ background: nest.ready ? "linear-gradient(120deg,#fff3c4,#ffe9f1)" : undefined }}
              >
                <NestEgg pct={nest.pct} ready={nest.ready} />
                <div className="min-w-0 flex-1">
                  <div className="font-display text-sm font-bold text-leo-ink">The Nest</div>
                  <div className="text-[11px] leading-tight text-leo-ink-soft">
                    {nest.ready ? "A free egg is ready!" : `Warming… about ${nest.minsLeft} min left`}
                  </div>
                  {!nest.ready && (
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-leo-sand">
                      <div
                        className="h-full rounded-full bg-leo-sun transition-all"
                        style={{ width: `${Math.round(nest.pct * 100)}%` }}
                      />
                    </div>
                  )}
                </div>
                <ChunkyButton
                  color="sun"
                  size="sm"
                  disabled={!nest.ready || phase !== "choose"}
                  onClick={() => {
                    if (!nest.ready) {
                      sfx.lockClick();
                      return;
                    }
                    setWasNest(true);
                    chooseEgg("spark");
                  }}
                  ariaLabel={nest.ready ? "Crack the free nest egg" : "The nest egg is still warming"}
                >
                  <span className="inline-flex items-center gap-1">
                    {nest.ready ? "CRACK" : <Timer width={16} height={16} />}
                  </span>
                </ChunkyButton>
              </div>
            </div>

            {nest.ready && (
              <button
                type="button"
                onClick={() => {
                  setWasNest(true);
                  chooseEgg("spark");
                }}
                className="mt-2 w-full rounded-2xl border-[2.5px] border-dashed border-leo-sun bg-white/70 px-3 py-2 text-center font-display text-xs font-bold text-leo-sun-deep"
              >
                Free nest egg waiting — crack it before it cools!
              </button>
            )}

            {/* ── the stage: idle egg always spinning & touchable ── */}
            <div className="relative mt-3 flex h-[230px] items-center justify-center overflow-hidden rounded-3xl border-[3px] border-leo-line bg-white/45">
              <Sparkles width={70} height={70} className="pointer-events-none absolute -left-2 -top-2 text-leo-sun opacity-20" />
              <Sparkles width={54} height={54} className="pointer-events-none absolute -right-1 bottom-4 text-leo-berry opacity-15" />
              <div className="h-full w-full" style={{ touchAction: "none" }}>
                <Egg3D kind={kind} crack={0} holding={false} tease={false} burstKey={0} className="h-full w-full" />
              </div>
              <span className="pointer-events-none absolute bottom-2 rounded-full bg-white/80 px-2.5 py-0.5 font-display text-[10px] font-bold text-leo-ink-soft">
                drag the egg — it spins
              </span>
            </div>

            {/* ── egg chooser ── */}
            <div className="mt-3 grid grid-cols-3 gap-2">
              {EGG_KIND_LIST.map((k) => {
                const meta = EGG_KINDS[k];
                const cooling = k === "spark" && sparkCooling;
                const freeRoyal = eggRoyalDay !== dayKey();
                const tooPoor =
                  k !== "spark" && eggStars < meta.cost && !(k === "royal" && freeRoyal);
                return (
                  <motion.button
                    key={k}
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    onClick={() => chooseEgg(k)}
                    className={`leo-card relative flex flex-col items-center gap-1.5 p-3 text-center ${cooling ? "opacity-80" : ""}`}
                    aria-label={`Pick the ${meta.name}${meta.cost ? `, costs ${meta.cost} stars` : ", free"}`}
                  >
                    {k === "royal" && freeRoyal && (
                      <span className="anim-pulse-ring absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border-2 border-leo-sun bg-white px-2 py-0.5 font-display text-[11px] font-bold text-leo-sun-deep">
                        FREE today
                      </span>
                    )}
                    <CssEgg kind={k} size={54} />
                    <span className="font-display text-xs font-bold text-leo-ink">{meta.name}</span>
                    <span className="text-[11px] leading-tight text-leo-ink-soft">{meta.blurb}</span>
                    <span className={`pill px-2 py-0.5 font-display text-[11px] font-bold ${tooPoor ? "text-leo-ink-soft" : "text-leo-ink"}`}>
                      {k === "spark" ? (
                        cooling ? "warming…" : "FREE"
                      ) : (
                        <>
                          <Star width={11} height={11} className="fill-leo-sun text-leo-sun-deep" />
                          {meta.cost}
                        </>
                      )}
                    </span>
                    {tooPoor && <Lock width={13} height={13} className="absolute right-2 top-2 text-leo-ink-soft" />}
                  </motion.button>
                );
              })}
            </div>

            {/* odds + luck, always honest and always visible */}
            <div className="leo-card mt-3 flex items-center gap-3 p-3">
              <PityMeter pity={eggPity} />
              <div className="min-w-0 flex-1 text-[11px] leading-snug text-leo-ink-soft">
                <b className="text-leo-ink">Nest luck:</b> a {streak}-day streak adds{" "}
                <b className="text-leo-ink">+{Math.round(streakLuck(streak) * 100)}%</b> rare-or-better luck to every egg.
              </div>
            </div>
          </>
        )}

        {/* ── ALBUM TAB ── */}
        {tab === "album" && <EggAlbum />}

        {/* ── ROOM TAB ── */}
        {tab === "room" && <EggRoom />}
      </div>

      {/* ── HOLD & REVEAL: full-screen immersion, tab bar hidden ── */}
      <AnimatePresence>
        {tab === "nest" && phase === "hold" && (
          <motion.div
            key="hold"
            className="fixed inset-0 z-[70] flex flex-col items-center justify-center px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0" style={{ background: "linear-gradient(165deg,#fff7e0 0%,#ffeef6 55%,#f3e9ff 100%)", touchAction: "none" }} />
            <p className="relative font-display text-lg font-bold text-leo-ink">
              {EGG_KINDS[kind].name} — press and HOLD
            </p>
            <div className="relative mt-2 h-[44dvh] w-full max-w-sm" style={{ touchAction: "none" }}>
              <Egg3D
                kind={kind}
                crack={crack}
                holding={holding}
                tease={tease}
                burstKey={burstKey}
                className="h-full w-full"
              />
            </div>
            {plan?.teased && crack > 0.45 && (
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative font-display text-sm font-bold text-leo-sun-deep"
              >
                It glows GOLD…!
              </motion.p>
            )}
            <div className="relative mt-2 w-full max-w-sm">
              <HoldPad holding={holding} crack={crack} onStart={() => setHolding(true)} onEnd={() => setHolding(false)} />
            </div>
          </motion.div>
        )}
        {tab === "nest" && phase === "reveal" && plan && (
          <RevealOverlay
            key={`rv-${burstKey}`}
            plan={plan}
            payout={payout}
            wasNest={wasNest}
            onAnother={another}
            onDone={backToChoose}
          />
        )}
      </AnimatePresence>

      {/* ── bottom tab bar (hidden while cracking — pure immersion) ── */}
      {!(tab === "nest" && phase !== "choose") && (
        <nav className="fixed inset-x-0 bottom-0 z-[60] border-t-[3px] border-leo-line bg-white/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur">
          <div className="mx-auto flex w-full max-w-lg">
            <TabBtn
              active={tab === "nest"}
              onClick={() => {
                sfx.click();
                setTab("nest");
              }}
              icon={<EggIcon width={20} height={20} />}
              label="Nest"
              dot={nest.ready || royalFree}
            />
            <TabBtn
              active={tab === "album"}
              onClick={() => {
                sfx.click();
                setTab("album");
              }}
              icon={<BookOpen width={20} height={20} />}
              label="Album"
              dot={false}
            />
            <TabBtn
              active={tab === "room"}
              onClick={() => {
                sfx.click();
                setTab("room");
              }}
              icon={<Heart width={20} height={20} />}
              label="Room"
              dot={false}
            />
          </div>
        </nav>
      )}
    </div>
  );
}

/* ── hold pad: the whole bottom half is the button (small thumbs win) ── */
function HoldPad({
  holding,
  crack,
  onStart,
  onEnd,
}: {
  holding: boolean;
  crack: number;
  onStart: () => void;
  onEnd: () => void;
}) {
  return (
    <div>
      <div className="mb-2 h-3.5 overflow-hidden rounded-full border-[3px] border-leo-line bg-white">
        <div
          className="h-full rounded-full transition-[width] duration-75"
          style={{
            width: `${Math.round(clamp(crack, 0, 1) * 100)}%`,
            background: "linear-gradient(90deg,#ffd34d,#ff5a8c)",
          }}
        />
      </div>
      <button
        type="button"
        aria-label={holding ? "Keep holding the egg" : "Press and hold to crack the egg"}
        onPointerDown={onStart}
        onPointerUp={onEnd}
        onPointerCancel={onEnd}
        className={`flex w-full select-none items-center justify-center gap-2 rounded-3xl border-[3px] border-leo-line py-4 font-display text-xl font-bold text-white shadow-[0_6px_0_rgba(74,47,27,0.25)] ${
          holding ? "bg-leo-berry" : "bg-leo-sun"
        }`}
        style={{ touchAction: "none" }}
      >
        <Hand width={22} height={22} className={holding ? "anim-wiggle" : ""} />
        {holding ? "KEEP HOLDING…" : "HOLD TO CRACK"}
      </button>
    </div>
  );
}

/* ── the reveal: silhouette suspense → rarity burst → the friend ── */
function RevealOverlay({
  plan,
  payout,
  wasNest,
  onAnother,
  onDone,
}: {
  plan: EggPlan;
  payout: Payout | null;
  wasNest: boolean;
  onAnother: () => void;
  onDone: () => void;
}) {
  const [unveiled, setUnveiled] = useState(false);
  const [ready, setReady] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const meta = RARITY_META[plan.rarity];
  const big = plan.rarity === "legend" || plan.rarity === "mythic";
  const praise = useMemo(() => pick(EGG_PRAISE[plan.rarity]), [plan.rarity]);
  const newLine = useMemo(() => pick(EGG_NEW_LINES), []);
  const teaseLine = useMemo(() => pick(EGG_TEASE_LINES), []);

  useEffect(() => {
    const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
    tl.fromTo(".rv-backdrop", { opacity: 0 }, { opacity: 1, duration: 0.22 }, 0);
    tl.fromTo(
      ".rv-card",
      { scale: 0.55, opacity: 0, y: 34 },
      { scale: 1, opacity: 1, y: 0, duration: 0.5, ease: "back.out(1.7)" },
      0.12
    );
    // suspense: three rising ticks while the silhouette waits
    tl.call(() => sfx.star(0), undefined, 0.4);
    tl.call(() => sfx.star(1), undefined, 0.85);
    tl.call(() => sfx.star(2), undefined, 1.25);
    // THE moment: unmask + rarity-specific fanfare + haptic
    tl.call(() => {
      setUnveiled(true);
      if (big) {
        sfx.goldenRoar();
        buzz([50, 70, 110]);
      } else if (plan.rarity === "epic") {
        sfx.fanfare();
        buzz([35, 40, 35]);
      } else if (plan.rarity === "rare") {
        sfx.fanfare();
      } else {
        sfx.correct();
      }
    }, undefined, 1.55);
    tl.fromTo(
      ".rv-flash",
      { scale: 0.2, opacity: 0.95 },
      { scale: 2.8, opacity: 0, duration: 0.75, ease: "power2.out" },
      1.55
    );
    tl.fromTo(".rv-name", { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: "back.out(2)" }, 1.62);
    tl.fromTo(".rv-praise", { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: "back.out(2.2)" }, 1.72);
    tl.fromTo(
      ".rv-pill",
      { scale: 0, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.32, ease: "back.out(2.4)", stagger: 0.09 },
      1.85
    );
    tl.call(() => setReady(true), undefined, 2.15);
    if (big && rootRef.current) {
      tl.fromTo(rootRef.current, { x: 0 }, { x: 9, duration: 0.055, repeat: 11, yoyo: true, ease: "none" }, 1.55);
    }
    return () => {
      tl.kill();
    };
     
  }, []);

  const anotherLabel =
    plan.kind === "spark" ? "CRACK ANOTHER" : plan.kind === "rainbow" ? "ANOTHER RAINBOW" : "ANOTHER ROYAL";

  return (
    <motion.div
      ref={rootRef}
      className="fixed inset-0 z-[75] flex items-center justify-center px-5 py-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={() => {
        if (ready) onAnother();
      }}
    >
      <div
        className="rv-backdrop absolute inset-0"
        style={{ background: "rgba(38,20,48,0.55)", backdropFilter: "blur(3px)" }}
      />
      {/* rarity flash */}
      <div
        className="rv-flash pointer-events-none absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: `radial-gradient(circle, ${meta.color} 0%, transparent 68%)`, opacity: 0 }}
      />
      <div
        className="rv-card relative max-h-full w-full max-w-sm overflow-y-auto rounded-[28px] border-[4px] bg-white p-5 text-center shadow-[0_18px_0_rgba(74,47,27,0.18)]"
        style={{ borderColor: meta.color }}
      >
        {plan.isNew && (
          <motion.span
            initial={{ scale: 0, rotate: -12 }}
            animate={unveiled ? { scale: 1, rotate: -6 } : {}}
            transition={{ type: "spring", stiffness: 300, damping: 12, delay: 0.05 }}
            className="absolute -top-4 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full border-[3px] border-leo-sun bg-white px-3 py-1 font-display text-xs font-bold text-leo-sun-deep shadow-md"
          >
            NEW FRIEND!
          </motion.span>
        )}
        <div className="relative mx-auto flex h-36 items-center justify-center">
          <span style={unveiled ? undefined : { filter: "brightness(0) opacity(0.9)" }}>
            <Sticker id={plan.critter.id} size={118} />
          </span>
          {unveiled && (
            <motion.span
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.35, type: "spring", stiffness: 260, damping: 14 }}
              className="absolute -right-1 -top-1"
            >
              <Sparkles width={30} height={30} style={{ color: meta.color }} />
            </motion.span>
          )}
        </div>
        <div
          className="rv-name mx-auto mt-1 w-fit rounded-full px-4 py-1 font-display text-lg font-bold text-white"
          style={{ background: meta.color }}
        >
          {meta.label}
        </div>
        <h3 className="mt-2 font-display text-2xl font-bold text-leo-ink">
          {plan.critter.name} the {plan.critter.species}
        </h3>
        <p className="rv-praise mt-0.5 text-sm font-medium text-leo-ink-soft">
          {plan.isNew ? newLine : plan.rarity === "common" ? praise : plan.teased ? `${praise} ${teaseLine}` : praise}
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
          <span className="rv-pill pill px-3 py-1 font-display text-xs font-bold text-leo-ink">
            <Star width={12} height={12} className="fill-leo-sun text-leo-sun-deep" />+
            {plan.isNew ? EGG_DISCOVERY_STARS : (payout?.gainedStars ?? plan.dupeStars)} stars
          </span>
          <span className="rv-pill pill px-3 py-1 font-display text-xs font-bold text-leo-ink">
            <Sparkles width={12} height={12} className="text-leo-berry-deep" />+{payout?.xp ?? meta.xp} XP
          </span>
          {wasNest && (
            <span className="rv-pill pill px-3 py-1 font-display text-xs font-bold text-leo-ink">
              <EggIcon width={12} height={12} className="text-leo-sun-deep" /> nest egg
            </span>
          )}
        </div>

        <div className="mt-4">
          {ready ? (
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ repeat: Infinity, duration: 1.1 }}
            >
              <ChunkyButton color={big ? "sun" : "berry"} size="lg" onClick={onAnother} ariaLabel="Crack another egg">
                {anotherLabel}
              </ChunkyButton>
            </motion.div>
          ) : (
            <span className="font-display text-sm font-bold text-leo-ink-soft">…something is waking up</span>
          )}
          {ready && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                sfx.click();
                onDone();
              }}
              className="mt-2 block w-full text-center text-[11px] font-semibold text-leo-ink-soft underline underline-offset-2"
            >
              back to the nest
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ── nest egg art: a CSS egg that wiggles when ready ───────────── */
function NestEgg({ pct, ready }: { pct: number; ready: boolean }) {
  return (
    <motion.div
      className="relative h-12 w-10 shrink-0"
      animate={ready ? { rotate: [-6, 6, -6] } : { rotate: 0 }}
      transition={ready ? { duration: 0.7, repeat: Infinity } : {}}
    >
      <div
        className="h-full w-full rounded-[50%_50%_50%_50%/60%_60%_42%_42%] border-[3px] border-leo-line"
        style={{ background: "radial-gradient(circle at 34% 26%, #fffbe8 8%, #ffd9a0 70%)" }}
      >
        {!ready && (
          <div
            className="absolute inset-x-0 bottom-0 overflow-hidden rounded-[50%_50%_50%_50%/60%_60%_42%_42%] bg-white/55"
            style={{ height: `${(1 - pct) * 100}%` }}
          />
        )}
      </div>
    </motion.div>
  );
}

/* ── CSS egg for the chooser cards ─────────────────────────────── */
export function CssEgg({ kind, size }: { kind: EggKind; size: number }) {
  const meta = EGG_KINDS[kind];
  return (
    <div
      className="relative"
      style={{
        width: size * 0.8,
        height: size,
        borderRadius: "50% 50% 50% 50% / 60% 60% 42% 42%",
        background: `radial-gradient(circle at 34% 26%, #ffffff 6%, ${meta.shell[0]} 40%, ${meta.shell[1]} 100%)`,
        border: `3px solid ${meta.spots}`,
        boxShadow: "inset 0 -5px 9px rgba(74,47,27,0.10)",
      }}
    >
      {kind === "royal" && (
        <Crown width={16} height={16} className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-leo-sun-deep" fill="#FFD75E" />
      )}
      {kind === "rainbow" && (
        <span className="absolute left-1/2 top-[38%] h-[3px] w-[70%] -translate-x-1/2 rotate-[-14deg] rounded-full bg-leo-berry/70" />
      )}
    </div>
  );
}

/* ── pity meter: hope, made visible ────────────────────────────── */
function PityMeter({ pity }: { pity: number }) {
  const shown = Math.min(pity, PITY_AT);
  const left = PITY_AT - shown;
  return (
    <div
      className="flex shrink-0 flex-col items-center gap-1"
      title={`Rare-or-better guaranteed within ${left + 1} Spark eggs`}
    >
      <div className="flex gap-0.5">
        {Array.from({ length: PITY_AT + 1 }, (_, i) => (
          <span
            key={i}
            className={`h-2.5 w-2.5 rounded-full border-2 ${i < shown ? "border-leo-sun bg-leo-sun" : "border-leo-line bg-white"}`}
          />
        ))}
      </div>
      <span className="font-display text-[9px] font-bold text-leo-ink-soft">
        {left === 0 ? "RARE GUARANTEED!" : `${left + 1} to lucky`}
      </span>
    </div>
  );
}

/* ── bottom tab button ─────────────────────────────────────────── */
function TabBtn({
  active,
  onClick,
  icon,
  label,
  dot,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  dot: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex flex-1 flex-col items-center gap-0.5 py-1.5 font-display text-[11px] font-bold ${
        active ? "text-leo-berry" : "text-leo-ink-soft"
      }`}
    >
      <span className="relative">
        {icon}
        {dot && <span className="absolute -right-1.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-leo-berry" />}
      </span>
      {label}
      {active && <span className="absolute inset-x-5 top-0 h-[3px] rounded-full bg-leo-berry" />}
    </button>
  );
}
