"use client";

/**
 * Think Leo — AmbientCartoons
 * ───────────────────────────
 * A scattering of world-flavoured sticker cartoons that drift, bob and
 * rotate slowly behind the action. Every screen gets its own cast:
 * jungle buddies on level 3, fish on level 12, rockets on level 25…
 * Layout is generated from a seeded LCG so server and client agree
 * (no hydration mismatch) and every level keeps its own constellation.
 */

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Sticker, type StickerId } from "@/components/leo/stickers";

const POOLS: StickerId[][] = [
  ["monkey", "parrot", "butterfly", "flower", "elephant"],
  ["fish", "octopus", "crab", "dolphin", "shell"],
  ["star", "rocket", "ufo", "moon", "comet"],
  ["candy", "lollipop", "cupcake", "donut", "cookie"],
];

interface Sprite {
  id: number;
  sticker: StickerId;
  left: number; // %
  top: number; // %
  size: number; // px
  dur: number; // bob duration
  delay: number;
  drift: number; // vertical travel
  spin: number; // rotation amplitude
}

export function AmbientCartoons({
  world,
  count = 8,
  opacity = 0.16,
}: {
  world: number;
  count?: number;
  opacity?: number;
}) {
  const sprites = useMemo<Sprite[]>(() => {
    const pool = POOLS[world] ?? POOLS[0];
    let s = 42 + world * 977 + count * 131; // per-(world,count) constellation
    const rnd = () => {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      sticker: pool[Math.floor(rnd() * pool.length)],
      left: 3 + rnd() * 90,
      top: 5 + rnd() * 86,
      size: 28 + Math.floor(rnd() * 36),
      dur: 4.5 + rnd() * 4,
      delay: rnd() * 2.5,
      drift: 10 + rnd() * 22,
      spin: 5 + rnd() * 8,
    }));
  }, [world, count]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {sprites.map((sp) => (
        <motion.div
          key={sp.id}
          className="absolute"
          style={{ left: `${sp.left}%`, top: `${sp.top}%`, opacity }}
          animate={{ y: [0, -sp.drift, 0], rotate: [-sp.spin, sp.spin, -sp.spin] }}
          transition={{
            duration: sp.dur,
            delay: sp.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <Sticker id={sp.sticker} size={sp.size} />
        </motion.div>
      ))}
    </div>
  );
}
