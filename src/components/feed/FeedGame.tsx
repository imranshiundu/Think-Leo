"use client";

/**
 * Think Leo — LEO FEED: the infinite surprise feed
 * ────────────────────────────────────────────────
 * Game #3, and the one with Instagram in its DNA: an endless stream of
 * mystery cards, one flick away, each hiding a friend for the Wall of
 * Fame. No questions, no levels, no fail state, nothing to read —
 * the loop is pull → anticipation → reveal → "…next one could be the
 * golden one". The math lives in lib/feed.ts, the psychology essay in
 * docs/ALGORITHM.md §16.
 *
 * The reveal is a GSAP ritual (anticipation IS the product):
 *   · the card wobbles harder and harder, glowing in its rarity colour
 *   · higher rarity = longer, heavier shake (dopamine scales with it)
 *   · near-miss cards flash gold mid-shake — "SO CLOSE!"
 *   · the burst pays XP through the ONE economy pipe (streaks, quests,
 *     leagues all advance while the kid "just plays")
 *
 * three.js (FeedSky) drifts a real 3D galaxy behind the cards; the
 * feed itself is phone-first: one thumb, swipe up, everything huge.
 */

import { Leo } from "@/components/leo/Leo";
import { Sticker } from "@/components/leo/stickers";
import { ChunkyButton, ConfettiBurst } from "@/components/game/bits";
import { RARITY_META, type Rarity } from "@/lib/eggs";
import {
  FEED_FRIENDS,
  HEAT_MAX,
  PITY_MAX,
  rollFeedCard,
  type FeedFriend,
  type FeedPlan,
} from "@/lib/feed";
import { sfx } from "@/lib/sound";
import { useFeedMegaReady, useFeedWall, useLeo } from "@/lib/store";
import { AnimatePresence, motion } from "framer-motion";
import gsap from "gsap";
import {
  Album,
  ChevronUp,
  Flame,
  Gem,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";

/* three.js rides in its own lazy chunk — phones never wait for it */
const FeedSky = dynamic(
  () => import("./FeedSky").then((m) => m.FeedSky),
  { ssr: false }
);

type Phase = "mystery" | "shaking" | "revealed";

interface FeedCard {
  plan: FeedPlan;
  key: number;
  gift: boolean; // the free daily MEGA card
  heatFull: boolean; // a charged MEGA card from the heat meter
}

/** How long the unwrap ritual lasts — dopamine scales with rarity. */
const SHAKE_MS: Record<Rarity, number> = {
  common: 850,
  rare: 1150,
  epic: 1500,
  legend: 1900,
  mythic: 2400,
};

export function FeedGame({ onExit }: { onExit: () => void }) {
  const [card, setCard] = useState<FeedCard | null>(null);
  const [phase, setPhase] = useState<Phase>("mystery");
  const [pay, setPay] = useState<{ gainedSpark: number; xp: number } | null>(null);
  const [confettiKey, setConfettiKey] = useState(0);
  const [nearFlash, setNearFlash] = useState(false);
  const [wallOpen, setWallOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const keyRef = useRef(0);
  const timersRef = useRef<number[]>([]);

  const megaGiftReady = useFeedMegaReady();
  const wall = useFeedWall();
  const eggStars = useLeo((s) => s.eggStars);
  const streak = useLeo((s) => s.streak);
  const feedHeat = useLeo((s) => s.feedHeat);
  const feedPity = useLeo((s) => s.feedPity);
  const feedPulls = useLeo((s) => s.feedPulls);

  /* ── build the next card from the live store snapshot ─────────── */
  const deal = useCallback((gift: boolean) => {
    const s = useLeo.getState();
    const heatFull = s.feedHeat >= HEAT_MAX;
    const plan = rollFeedCard({
      pity: s.feedPity,
      forced: heatFull, // a full heat meter ALWAYS pays epic or better
      streak: s.streak, // streak luck bends the table toward shiny
      affinity: s.feedAffinity, // the feed learns what this kid loves
      album: s.feedAlbum,
    });
    keyRef.current += 1;
    setCard({ plan, key: keyRef.current, gift, heatFull });
    setPhase("mystery");
    setPay(null);
    setNearFlash(false);
  }, []);

  /* first card of the visit: the daily gift if it is waiting */
  useEffect(() => {
    if (!card) deal(megaGiftReady);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearTimers = () => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  };
  useEffect(() => clearTimers, []);

  /* ── THE UNWRAP — a GSAP ritual: wobble harder, glow, then burst ── */
  const unwrap = useCallback(() => {
    if (phase !== "mystery" || !card) return;
    setPhase("shaking");
    const meta = RARITY_META[card.plan.rarity];
    const ms = card.gift || card.heatFull ? 1700 : SHAKE_MS[card.plan.rarity];
    const el = cardRef.current;

    /* escalating heartbeat ticks — the sound of suspense */
    const ticks = Math.floor(ms / 240);
    for (let i = 0; i < ticks; i++) {
      timersRef.current.push(
        window.setTimeout(() => sfx.pad(i % 4), i * 240)
      );
    }
    /* near-miss: the gold flash lands mid-shake, at peak tension */
    if (card.plan.nearMiss) {
      timersRef.current.push(
        window.setTimeout(() => {
          setNearFlash(true);
          sfx.combo(2);
        }, Math.round(ms * 0.55))
      );
      timersRef.current.push(
        window.setTimeout(() => setNearFlash(false), Math.round(ms * 0.55) + 420)
      );
    }

    const resolve = () => {
      const s = useLeo.getState();
      if (card.gift) s.claimFeedMega(); // the daily gift stamps its day
      const payout = s.trackFeed(card.plan);
      setPay(payout);
      sfx.whoosh();
      switch (card.plan.rarity) {
        case "common": sfx.pop(); break;
        case "rare": sfx.found(2); break;
        case "epic": sfx.discover(); break;
        case "legend": sfx.fanfare(); break;
        case "mythic": sfx.goldenRoar(); break;
      }
      if (card.plan.rarity !== "common" || card.plan.isNew) {
        window.setTimeout(() => sfx.questDone(), 260);
      }
      if (card.plan.rarity === "epic" || card.plan.rarity === "legend" || card.plan.rarity === "mythic") {
        setConfettiKey((k) => k + 1);
      }
      setPhase("revealed");
    };

    if (!el || typeof window === "undefined") {
      timersRef.current.push(window.setTimeout(resolve, ms));
      return;
    }

    /* GSAP: the wobble grows, the glow breathes in the rarity colour */
    const glowEl = el.querySelector<HTMLElement>("[data-glow]");
    gsap.killTweensOf([el, glowEl]);
    gsap.set(el, { rotation: 0, scale: 1 });
    const tl = gsap.timeline({ onComplete: resolve });
    const steps = Math.max(5, Math.round(ms / 130));
    for (let i = 0; i < steps; i++) {
      const amp = 2 + (i / steps) * 9; // harder and harder…
      const dur = 0.13 - (i / steps) * 0.03; // …and faster and faster
      tl.to(el, { rotation: -amp, duration: dur, ease: "sine.inOut" });
      tl.to(el, { rotation: amp, duration: dur * 2, ease: "sine.inOut" });
    }
    tl.to(el, { rotation: 0, scale: 1.06, duration: 0.09, ease: "power2.in" });
    tl.to(el, { scale: 1, duration: 0.14, ease: "bounce.out" });
    if (glowEl) {
      gsap.fromTo(
        glowEl,
        { opacity: 0.12 },
        { opacity: 0.85, duration: ms / 1000, ease: "power1.in" }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, card]);

  /* ── NEXT: the card flies up, the feed never ends ─────────────── */
  const next = useCallback(() => {
    if (phase !== "revealed") return;
    sfx.tap();
    deal(false); // deal() checks heat for us — full meter = forced MEGA
  }, [phase, deal]);

  /* swipe up = next (the Instagram flick), with laptop love on keys */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter" || e.key === "ArrowUp") {
        e.preventDefault();
        if (phase === "mystery") unwrap();
        else if (phase === "revealed") next();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [phase, unwrap, next]);

  const meta = card ? RARITY_META[card.plan.rarity] : null;
  const isMegaCard = !!card && (card.gift || card.heatFull);

  return (
    <div
      className="relative h-screen w-full overflow-hidden"
      style={{ background: "linear-gradient(180deg, #f3e9ff 0%, #ffecf3 55%, #fff3d6 100%)" }}
    >
      <FeedSky className="pointer-events-none absolute inset-0 z-0" opacity={0.55} />

      <ConfettiBurst fireKey={confettiKey} count={90} />

      {/* ── top bar ── */}
      <div className="absolute inset-x-0 top-0 z-30 flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={() => {
            sfx.click();
            onExit();
          }}
          className="pill cursor-pointer px-3 py-1.5 font-display text-sm text-leo-ink hover:bg-leo-cream"
        >
          <X width={14} height={14} /> Home
        </button>
        <div className="pill gap-1.5 px-3 py-1 font-display text-sm font-bold text-leo-grape-deep">
          <Sparkles width={15} height={15} /> LEO FEED
        </div>
        <div className="ml-auto flex items-center gap-2">
          {streak > 0 && (
            <div className="pill gap-1 px-2.5 py-1 font-display text-sm font-bold text-leo-berry-deep">
              <Flame width={14} height={14} /> {streak}
            </div>
          )}
          <div className="pill gap-1 px-2.5 py-1 font-display text-sm font-bold text-leo-honey-deep">
            <Gem width={14} height={14} /> {eggStars}
          </div>
          <button
            type="button"
            onClick={() => {
              sfx.click();
              setWallOpen(true);
            }}
            className="pill cursor-pointer gap-1 px-2.5 py-1 font-display text-sm font-bold text-leo-ink hover:bg-leo-cream"
          >
            <Album width={15} height={15} />
            {wall.found}/{FEED_FRIENDS.length}
          </button>
        </div>
      </div>

      {/* ── THE CARD ── */}
      <AnimatePresence mode="wait">
        {card && (
          <motion.div
            key={card.key}
            className="absolute inset-x-0 top-[76px] bottom-[178px] z-20 flex items-center justify-center px-5"
            initial={{ y: 90, opacity: 0, scale: 0.94 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -130, opacity: 0, scale: 0.9, transition: { duration: 0.24 } }}
            transition={{ type: "spring", stiffness: 240, damping: 22 }}
            drag={phase === "revealed" ? "y" : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.5, bottom: 0 }}
            onDragEnd={(_, info) => {
              if (info.offset.y < -60 || info.velocity.y < -400) next();
            }}
          >
            <div
              ref={cardRef}
              onPointerDown={() => {
                if (phase === "mystery") unwrap();
              }}
              className="relative w-full max-w-sm cursor-pointer select-none"
            >
              {/* the glow that breathes in the rarity colour mid-shake */}
              <div
                data-glow
                className="pointer-events-none absolute -inset-5 rounded-[40px] opacity-0"
                style={{
                  background: `radial-gradient(closest-side, ${meta?.color}55, transparent 75%)`,
                }}
              />
              <div
                className="leo-card relative overflow-hidden rounded-[32px] p-5 text-center"
                style={{
                  borderWidth: 4,
                  borderColor: isMegaCard ? "#ffc93c" : meta && phase !== "mystery" ? meta.color : undefined,
                  background:
                    isMegaCard && phase === "mystery"
                      ? "linear-gradient(160deg, #fff7d6, #ffe9a8 60%, #ffd75e)"
                      : meta && phase !== "mystery"
                        ? meta.soft
                        : undefined,
                }}
              >
                {/* MEGA ribbon */}
                {isMegaCard && phase !== "revealed" && (
                  <motion.div
                    className="mx-auto mb-3 w-fit rounded-full bg-gradient-to-r from-leo-honey via-leo-berry to-leo-grape px-4 py-1 font-display text-sm font-bold text-white text-outline-sm"
                    animate={{ scale: [1, 1.08, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                  >
                    {card.gift ? "TODAY'S MEGA GIFT!" : "MEGA CARD!"}
                  </motion.div>
                )}

                {/* the mystery face */}
                {phase !== "revealed" ? (
                  <div className="flex min-h-[300px] flex-col items-center justify-center gap-4 py-4">
                    <motion.div
                      animate={
                        phase === "shaking"
                          ? undefined
                          : { y: [0, -8, 0], rotate: [-2.5, 2.5, -2.5] }
                      }
                      transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                      className="relative"
                    >
                      {/* the wrapped parcel: a sticker-safe box with a bow */}
                      <div
                        className="flex h-[168px] w-[168px] items-center justify-center rounded-[36px] border-[4px]"
                        style={{
                          borderColor: isMegaCard ? "#e8a80c" : "#e8a80c",
                          background: isMegaCard
                            ? "radial-gradient(circle at 34% 26%, #fffbe8 10%, #ffd75e 72%)"
                            : "radial-gradient(circle at 34% 26%, #fffbe8 10%, #ffb020 72%)",
                          boxShadow: "0 10px 0 rgba(0,0,0,0.12), inset 0 -8px 0 rgba(0,0,0,0.06)",
                        }}
                      >
                        <Sticker id="lion" size={84} />
                      </div>
                      {/* sparkle ring — the parcel is SOMETHING SPECIAL */}
                      <motion.div
                        className="pointer-events-none absolute inset-0"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
                      >
                        <Sparkles className="absolute -right-3 -top-3 text-leo-honey" width={26} height={26} />
                        <Sparkles className="absolute -bottom-3 -left-3 text-leo-berry" width={20} height={20} />
                      </motion.div>
                    </motion.div>

                    {nearFlash && (
                      <motion.div
                        initial={{ scale: 0.4, opacity: 0 }}
                        animate={{ scale: 1.15, opacity: 1 }}
                        className="rounded-2xl border-[3px] border-leo-honey bg-white px-4 py-1.5 font-display text-lg font-bold text-leo-honey-deep anim-heartbeat"
                      >
                        SO CLOSE!
                      </motion.div>
                    )}

                    <div className="font-display text-sm font-bold uppercase tracking-widest text-leo-ink-soft">
                      {phase === "shaking" ? "It's coming…" : "Tap to open!"}
                    </div>
                  </div>
                ) : (
                  /* the reveal — a friend, a banner, a caption, a payout */
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 16 }}
                    className="flex min-h-[300px] flex-col items-center justify-center gap-3 py-2"
                  >
                    <div
                      className="rounded-2xl px-4 py-1 font-display text-lg font-bold text-white text-outline-sm"
                      style={{ background: meta?.color }}
                    >
                      {meta?.label}
                    </div>
                    <motion.div
                      animate={{ y: [0, -7, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <Sticker id={card.plan.friend.id} size={124} />
                    </motion.div>
                    <div className="font-display text-3xl font-bold text-leo-ink">
                      {card.plan.friend.name}
                    </div>
                    <div className="font-display text-base font-semibold text-leo-ink-soft">
                      {card.plan.friend.line}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
                      <span className="pill gap-1 px-3 py-1 font-display text-sm font-bold text-leo-leaf-deep">
                        <Zap width={14} height={14} /> +{pay?.xp ?? 0} XP
                      </span>
                      {pay && pay.gainedSpark > 0 && (
                        <span className="pill gap-1 px-3 py-1 font-display text-sm font-bold text-leo-honey-deep">
                          <Gem width={14} height={14} /> +{pay.gainedSpark} Spark
                        </span>
                      )}
                      {card.plan.isNew && (
                        <span className="pill gap-1 bg-[#e9ffcf] px-3 py-1 font-display text-sm font-bold text-leo-leaf-deep">
                          NEW FRIEND!
                        </span>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* For You chip — the algorithm winks at the kid */}
                <div className="mt-3 flex items-center justify-center gap-1.5 font-display text-xs font-bold uppercase tracking-widest text-leo-ink-soft">
                  <Sparkles width={13} height={13} className="text-leo-grape" />
                  Leo picked this for you
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* next card peeking from the bottom — the feed never ends */}
      <div className="pointer-events-none absolute inset-x-0 bottom-[132px] z-10 flex justify-center">
        <div className="h-9 w-56 max-w-[70%] rounded-t-[26px] border-[3px] border-b-0 border-leo-line bg-white/70" />
      </div>

      {/* ── bottom console: heat, pity, PULL ── */}
      <div className="absolute inset-x-0 bottom-0 z-30 flex flex-col items-center gap-2.5 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        {/* heat meter — momentum you can SEE */}
        <div className="flex w-full max-w-sm items-center gap-2">
          <Flame
            width={18}
            height={18}
            className={feedHeat > 0 ? "text-leo-berry" : "text-leo-line"}
          />
          <div className="h-3.5 flex-1 overflow-hidden rounded-full border-2 border-leo-line bg-white">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-leo-sun via-leo-berry to-leo-grape"
              animate={{ width: `${(feedHeat / HEAT_MAX) * 100}%` }}
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
            />
          </div>
          <span className="font-display text-xs font-bold text-leo-ink-soft">
            {feedHeat >= HEAT_MAX ? "MEGA READY!" : `${feedHeat}/${HEAT_MAX}`}
          </span>
        </div>

        {/* pity dots — dry spells always end */}
        <div className="flex items-center gap-1.5">
          {Array.from({ length: PITY_MAX }, (_, i) => (
            <span
              key={i}
              className={`h-2 w-2 rounded-full ${
                feedPity >= PITY_MAX || i < feedPity
                  ? "bg-leo-grape"
                  : "bg-leo-line"
              }`}
            />
          ))}
        </div>

        {phase === "revealed" ? (
          <ChunkyButton color="grape" size="lg" onClick={next} className="w-full max-w-sm">
            <span className="inline-flex items-center gap-2 font-display text-lg">
              NEXT <ChevronUp width={20} height={20} className="anim-bob-x" />
            </span>
          </ChunkyButton>
        ) : (
          <ChunkyButton
            color={isMegaCard ? "sun" : "leaf"}
            size="lg"
            onClick={unwrap}
            disabled={phase !== "mystery"}
            className="w-full max-w-sm"
          >
            <span className="inline-flex items-center gap-2 font-display text-lg">
              <Sparkles width={19} height={19} />
              {phase === "shaking" ? "OPENING…" : isMegaCard ? "OPEN THE MEGA CARD" : "OPEN CARD"}
            </span>
          </ChunkyButton>
        )}
        <p className="font-display text-xs font-semibold text-leo-ink-soft">
          {feedPulls === 0
            ? "Every card hides a friend. Collect them all!"
            : `${feedPulls} {feedPulls === 1 ? "card" : "cards"} opened · the feed never ends`}
        </p>
      </div>

      {/* Leo hypes the good rarities */}
      <AnimatePresence>
        {phase === "revealed" && card && (card.plan.rarity === "legend" || card.plan.rarity === "mythic") && (
          <motion.div
            className="pointer-events-none absolute bottom-44 left-4 z-40 hidden sm:block"
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, opacity: 0 }}
          >
            <Leo mood="wow" size={120} bubble={card.plan.rarity === "mythic" ? "THE RAREST!!! ROAAAAR!" : "A LEGEND! Amazing!"} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Wall of Fame sheet ── */}
      <AnimatePresence>
        {wallOpen && (
          <motion.div
            className="absolute inset-0 z-50 flex flex-col bg-leo-cream"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
          >
            <div className="flex items-center gap-2 px-4 py-3">
              <button
                type="button"
                onClick={() => {
                  sfx.click();
                  setWallOpen(false);
                }}
                className="pill cursor-pointer px-3 py-1.5 font-display text-sm text-leo-ink hover:bg-white"
              >
                <X width={14} height={14} /> Back
              </button>
              <div className="font-display text-lg font-bold text-leo-ink">
                Wall of Fame · {wall.found}/{wall.target}
              </div>
            </div>
            <div className="grid flex-1 grid-cols-3 content-start gap-3 overflow-y-auto leo-scroll px-4 pb-10 sm:grid-cols-4">
              {FEED_FRIENDS.map((f: FeedFriend) => {
                const count = wall.album[f.uid] ?? 0;
                const owned = count > 0;
                const metaF = RARITY_META[f.rarity];
                return (
                  <div
                    key={f.uid}
                    className="leo-card flex flex-col items-center gap-1 rounded-2xl p-2.5 text-center"
                    style={{ background: owned ? metaF.soft : undefined, opacity: owned ? 1 : 0.75 }}
                  >
                    <span style={owned ? undefined : { filter: "brightness(0) opacity(0.25)" }}>
                      <Sticker id={f.id} size={44} />
                    </span>
                    <span className="font-display text-xs font-bold text-leo-ink">
                      {owned ? f.name : "???"}
                    </span>
                    <span
                      className="rounded-full px-2 py-0.5 font-display text-[10px] font-bold text-white"
                      style={{ background: metaF.color }}
                    >
                      {metaF.label}
                    </span>
                    {owned && (
                      <span className="font-display text-[10px] font-semibold text-leo-ink-soft">
                        ×{count}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
