/**
 * Think Leo — Device Gate
 * ───────────────────────
 * THINK LEO IS A LAPTOP / DESKTOP EXPERIENCE.
 * The game (the "emulator") must never run on phones or tablets.
 *
 * Detection strategy (documented in docs/ALGORITHM.md §9):
 *  1. Classic mobile User-Agents (Android, iPhone, iPod, Windows Phone…)
 *  2. iPadOS 13+ spoofs a Macintosh UA — exposed by maxTouchPoints > 1
 *  3. Touch-first devices: primary pointer is `coarse` (finger), no `fine`
 *     pointer (mouse / trackpad). A laptop with a touchscreen still reports
 *     a FINE primary pointer, so it passes. A phone reports coarse.
 *  4. Tiny touch screens (min(w,h) < 700px) with no fine pointer.
 *
 * Rule of thumb: we require a real pointing device (mouse/trackpad) as the
 * PRIMARY pointer. That is the physical signature of a laptop.
 */

export type DeviceKind = "laptop" | "mobile";

export function detectDevice(): DeviceKind {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return "laptop"; // SSR default; re-checked after mount
  }
  const ua = navigator.userAgent || "";

  const mobileUA =
    /Android|iPhone|iPod|Windows Phone|IEMobile|BlackBerry|Opera Mini|webOS|Symbian/i.test(
      ua
    ) || /iPad/i.test(ua);

  // iPadOS 13+ pretends to be a Mac, but multi-touch gives it away.
  const iPadOS = /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1;

  let coarse = false;
  let fine = false;
  try {
    coarse = window.matchMedia("(pointer: coarse)").matches;
    fine = window.matchMedia("(pointer: fine)").matches;
  } catch {
    /* very old browsers: fall through to UA-only decision */
  }

  const smallTouch =
    Math.min(window.screen?.width ?? 1024, window.screen?.height ?? 768) < 700;

  const isPhoneOrTablet =
    mobileUA || iPadOS || (coarse && !fine) || (coarse && smallTouch);

  return isPhoneOrTablet ? "mobile" : "laptop";
}

/** Subscribe to device changes (rotation, docked tablets…). */
export function watchDevice(cb: (d: DeviceKind) => void): () => void {
  const handler = () => cb(detectDevice());
  window.addEventListener("resize", handler);
  window.addEventListener("orientationchange", handler);
  return () => {
    window.removeEventListener("resize", handler);
    window.removeEventListener("orientationchange", handler);
  };
}
