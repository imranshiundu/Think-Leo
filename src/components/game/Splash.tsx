"use client";

/**
 * Think Leo — Startup animation (v4, GSAP-choreographed)
 * ──────────────────────────────────────────────────────
 * This is what a kid sees in the second after tapping the Think Leo icon
 * on a phone — so it must feel like the app ICON came alive:
 *
 *   1. the app-icon card drops in with an elastic wobble
 *   2. the "Think Leo!" wordmark pops letter by letter
 *   3. a light shine sweeps across the wordmark
 *   4. the world cartoon parade marches across the bottom
 *   5. paw prints fill one by one — the "loading" beat (with tick sounds)
 *   6. star burst + fanfare → curtain lifts
 *
 * Tap anywhere to skip. Plays in full once per session (ThinkLeo root).
 * Timeline is built with GSAP; the curtain itself stays framer-motion
 * (ThinkLeo owns the exit). Audio cues ride the timeline via .call().
 */

import { motion } from "framer-motion";
import gsap from "gsap";
import { useEffect, useRef, useState } from "react";
import { Leo } from "@/components/leo/Leo";
import { StarPop } from "@/components/leo/badges";
import { Sticker, type StickerId } from "@/components/leo/stickers";
import { sfx } from "@/lib/sound";

/* the parade: one buddy from every world walks the stage */
const PARADE: StickerId[] = ["elephant", "monkey", "parrot", "dolphin", "rocket", "cupcake", "butterfly", "candy"];
const PAWS = 8;

export function Splash({ quick = false, onDone }: { quick?: boolean; onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    if (quick) {
      sfx.pop();
      const t = window.setTimeout(onDone, 750);
      return () => window.clearTimeout(t);
    }

    sfx.unlock(); // polite try — may be blocked before first gesture, that's fine
    sfx.whoosh();
    sfx.roar();

    const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
    const ticks: number[] = [];

    /* 1. the app icon drops in like it leapt off the home screen */
    tl.fromTo(
      ".splash-icon",
      { y: -220, scale: 0.35, opacity: 0, rotate: -18 },
      { y: 0, scale: 1, opacity: 1, rotate: 0, duration: 0.75, ease: "elastic.out(1, 0.55)" },
      0.1
    );
    /* 2. wordmark letters pop */
    tl.fromTo(
      ".splash-letter",
      { scale: 0, y: 26, opacity: 0 },
      { scale: 1, y: 0, opacity: 1, duration: 0.45, ease: "back.out(2.2)", stagger: 0.055 },
      0.55
    );
    /* 3. shine sweep across the wordmark */
    tl.fromTo(
      ".splash-shine",
      { xPercent: -140 },
      { xPercent: 240, duration: 0.6, ease: "power1.inOut" },
      1.15
    );
    /* 4. tagline + parade march in */
    tl.fromTo(".splash-tag", { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4 }, 1.15);
    tl.fromTo(
      ".splash-parader",
      { x: (i: number) => -window.innerWidth * 0.25 - i * 60 },
      {
        x: (i: number) => window.innerWidth * 0.75 + i * 60,
        duration: 2.6,
        ease: "none",
        stagger: 0.12,
      },
      1.0
    );
    /* bob the paraders while they march */
    tl.fromTo(
      ".splash-parader > span",
      { y: 0 },
      { y: -8, duration: 0.32, yoyo: true, repeat: 7, ease: "sine.inOut", stagger: 0.12 },
      1.0
    );
    /* 5. paw prints fill — the loading beat, one tick each */
    for (let p = 0; p < PAWS; p++) {
      tl.call(() => sfx.tick(p === PAWS - 1), undefined, 1.45 + p * 0.16);
      tl.fromTo(
        `.splash-paw-${p}`,
        { scale: 0, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.22, ease: "back.out(2.4)" },
        1.45 + p * 0.16
      );
    }
    /* 6. star burst + fanfare, then hand over to the curtain */
    tl.call(() => sfx.fanfare(), undefined, 2.75);
    tl.fromTo(
      ".splash-star",
      { scale: 0, rotate: -140 },
      { scale: 1, rotate: 0, duration: 0.45, ease: "back.out(2)" },
      2.75
    );
    ticks.push(
      window.setTimeout(() => {
        if (!doneRef.current) {
          doneRef.current = true;
          setLeaving(true);
        }
      }, 3050)
    );
    ticks.push(window.setTimeout(() => onDone(), 3700));

    return () => {
      tl.kill();
      ticks.forEach((t) => window.clearTimeout(t));
    };
  }, [quick, onDone]);

  return (
    <motion.div
      ref={rootRef}
      className="leo-bg fixed inset-0 z-[90] flex cursor-pointer flex-col items-center justify-center overflow-hidden"
      initial={{ y: 0 }}
      animate={leaving ? { y: "-102%" } : { y: 0 }}
      transition={leaving ? { duration: 0.62, ease: [0.7, 0, 0.3, 1] } : {}}
      onClick={() => {
        if (!doneRef.current) {
          doneRef.current = true;
          setLeaving(true);
          window.setTimeout(onDone, 620);
        }
      }}
      role="button"
      aria-label="Think Leo is starting — tap to skip"
    >
      {/* ── the app icon, alive ── */}
      <div className="splash-icon relative">
        <div
          className="flex h-[124px] w-[124px] items-center justify-center rounded-[30px] border-[4px] border-white shadow-[0_14px_0_rgba(214,178,110,0.35),0_22px_40px_-16px_rgba(140,100,40,0.5)]"
          style={{ background: "linear-gradient(145deg,#ffd34d 0%,#ffb020 55%,#ff9d2e 100%)" }}
        >
          <Leo mood="excited" size={104} />
        </div>
        {/* sheen dot on the icon's corner — reads as "app icon" */}
        <span className="pointer-events-none absolute left-3 top-2.5 h-6 w-9 rotate-[24deg] rounded-full bg-white/45 blur-[3px]" />
      </div>

      {/* ── wordmark — "Think " pops letter by letter, "Leo!" pops as ONE
             gradient word. (The old code swapped every "L" for the whole
             string "Leo!" while e, o, ! still rendered after it — the
             wordmark spelled "Think Leo!eo!", read as "Think Leo Leo".) ── */}
      <div className="relative mt-4 flex items-baseline overflow-hidden" aria-label="Think Leo!">
        {"Think ".split("").map((ch, i) => (
          <span
            key={`t-${i}`}
            className="splash-letter inline-block font-display text-6xl font-bold text-leo-ink"
            aria-hidden
          >
            {ch === " " ? "\u00A0" : ch}
          </span>
        ))}
        <span
          className="splash-letter inline-block bg-gradient-to-r from-leo-sun via-leo-berry to-leo-grape bg-clip-text font-display text-6xl font-bold text-transparent"
          aria-hidden
        >
          Leo!
        </span>
        <span className="splash-star pointer-events-none absolute -right-10 -top-5">
          <StarPop size={38} />
        </span>
        <span className="splash-shine pointer-events-none absolute inset-y-0 -left-8 w-14 rotate-[14deg] bg-white/55 blur-md" />
      </div>

      <p className="splash-tag mt-3 font-display text-base font-medium text-leo-ink-soft">
        Big brain adventures for little legends
      </p>

      {/* ── paw-print loading bar ── */}
      <div className="mt-5 flex items-center gap-2" aria-label="Loading">
        {Array.from({ length: PAWS }, (_, p) => (
          <Paw key={p} className={`splash-paw-${p}`} />
        ))}
      </div>

      {/* ── world parade marching across the bottom ── */}
      <div className="pointer-events-none absolute bottom-9 left-0 right-0 h-14 overflow-hidden" aria-hidden>
        {PARADE.map((id, i) => (
          <span key={`${id}-${i}`} className="splash-parader absolute bottom-0" style={{ left: 0 }}>
            <span className="inline-block">
              <Sticker id={id} size={44} />
            </span>
          </span>
        ))}
        <span className="absolute bottom-0 right-6 anim-wiggle">
          <Leo mood="happy" size={52} />
        </span>
      </div>
    </motion.div>
  );
}

function Paw({ className = "" }: { className?: string }) {
  return (
    <svg width="26" height="20" viewBox="0 0 26 20" className={className}>
      <g fill="#ffb020">
        <ellipse cx="13" cy="13" rx="6.4" ry="5.4" />
        <circle cx="5.6" cy="6.4" r="2.5" />
        <circle cx="10.6" cy="3.6" r="2.5" />
        <circle cx="15.6" cy="3.6" r="2.5" />
        <circle cx="20.6" cy="6.4" r="2.5" />
      </g>
    </svg>
  );
}

function SplashMark() {
  return null; // retired — the GSAP wordmark is the one true mark
}
