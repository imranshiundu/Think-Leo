/**
 * Think Leo — Device Detection & Recording
 * ────────────────────────────────────────
 * Every visit IS recorded — device kind, platform, screen, memory — locally
 * and to the parents' dashboard API (/api/device → SQLite). Laptops, phones
 * and tablets all play; these snapshots tell the team which devices the
 * family actually plays on.
 *
 * Privacy: this is anonymous hardware metadata (no IDs, no fingerprinting
 * for tracking, nothing shared). Stored on-device + our own database.
 */

import { detectDevice, type DeviceKind } from "./device";

export interface DeviceInfo {
  kind: DeviceKind;
  os: string;
  browser: string;
  formFactor: string; // "Laptop", "Desktop", "Phone", "Tablet"
  platform: string; // navigator.platform / userAgentData.platform
  screen: string; // "1920x1080"
  viewport: string; // "1512x820"
  pixelRatio: number;
  cpuCores: number | null;
  ramGB: number | null;
  touchPoints: number;
  language: string;
  timezone: string;
  online: boolean;
  standalone: boolean; // running as an installed PWA
  gpu: string;
  ua: string; // truncated
  at: string; // ISO date of this visit
}

function guessOS(ua: string): string {
  if (/Windows NT/i.test(ua)) return "Windows";
  if (/Android/i.test(ua)) return "Android";
  if (/iPhone|iPod/i.test(ua)) return "iOS";
  if (/iPad/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return "iPadOS";
  if (/Macintosh|Mac OS X/i.test(ua)) return "macOS";
  if (/CrOS/i.test(ua)) return "ChromeOS";
  if (/Linux/i.test(ua)) return "Linux";
  return "Unknown";
}

function guessBrowser(ua: string): string {
  if (/Edg\//i.test(ua)) return "Edge";
  if (/OPR\//i.test(ua)) return "Opera";
  if (/SamsungBrowser/i.test(ua)) return "Samsung Internet";
  if (/Firefox\//i.test(ua)) return "Firefox";
  if (/Chrome\//i.test(ua)) return "Chrome";
  if (/Safari\//i.test(ua)) return "Safari";
  return "Browser";
}

function guessGPU(): string {
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) return "unknown";
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const raw = ext
      ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL))
      : String(gl.getParameter(gl.RENDERER));
    return raw.slice(0, 80);
  } catch {
    return "unknown";
  }
}

function isStandalone(): boolean {
  return (
    (typeof window.matchMedia === "function" &&
      window.matchMedia("(display-mode: standalone)").matches) ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function formFactorOf(kind: DeviceKind, ua: string, touch: number): string {
  if (/Android|iPhone|iPod|Windows Phone/i.test(ua)) return "Phone";
  if (/iPad/i.test(ua) || (/Macintosh/i.test(ua) && touch > 1)) return "Tablet";
  if (kind === "mobile") return touch > 0 ? "Tablet" : "Mobile";
  // fine-pointer device: laptop vs desktop via no external keyboard hint —
  // treat small screens as laptops (they fold), big as desktops
  const min = Math.min(window.screen?.width ?? 1024, window.screen?.height ?? 768);
  return min <= 1000 ? "Laptop" : "Desktop";
}

/** Collect a full, anonymous hardware snapshot. Client-side only. */
export function getDeviceInfo(): DeviceInfo {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const kind = detectDevice();
  const touch = typeof navigator !== "undefined" ? navigator.maxTouchPoints || 0 : 0;
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    userAgentData?: { platform?: string };
  };
  return {
    kind,
    os: guessOS(ua),
    browser: guessBrowser(ua),
    formFactor: typeof window === "undefined" ? "Unknown" : formFactorOf(kind, ua, touch),
    platform:
      nav.userAgentData?.platform || (typeof navigator !== "undefined" ? navigator.platform : "") || "unknown",
    screen:
      typeof window !== "undefined" && window.screen
        ? `${window.screen.width}x${window.screen.height}`
        : "unknown",
    viewport:
      typeof window !== "undefined" ? `${window.innerWidth}x${window.innerHeight}` : "unknown",
    pixelRatio: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
    cpuCores: (nav as { hardwareConcurrency?: number }).hardwareConcurrency ?? null,
    ramGB: nav.deviceMemory ?? null,
    touchPoints: touch,
    language: typeof navigator !== "undefined" ? navigator.language || "unknown" : "unknown",
    timezone: typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "unknown",
    online: typeof navigator !== "undefined" ? navigator.onLine : true,
    standalone: typeof window !== "undefined" ? isStandalone() : false,
    gpu: typeof document !== "undefined" ? guessGPU() : "unknown",
    ua: ua.slice(0, 220),
    at: new Date().toISOString(),
  };
}

/** One-line human summary used by the gate screen and the footer. */
export function deviceSummary(d: DeviceInfo): string {
  return [d.formFactor, d.os, d.browser, d.screen].filter(Boolean).join(" · ");
}

const LS_LAST = "think-leo-device-last";
const LS_LOG = "think-leo-device-log";
const REPORT_EVERY_MS = 12 * 60 * 60 * 1000; // at most twice a day per device

/**
 * Record this visit: keep a local log (last 20) and send one report to
 * /api/device (fire-and-forget — the game never waits on the network).
 */
export function recordDevice(): DeviceInfo | null {
  if (typeof window === "undefined") return null;
  try {
    const info = getDeviceInfo();
    const lastRaw = localStorage.getItem(LS_LAST);
    const last = lastRaw ? (JSON.parse(lastRaw) as DeviceInfo) : null;
    const stale =
      !last ||
      last.ua !== info.ua ||
      last.screen !== info.screen ||
      Date.now() - new Date(last.at).getTime() > REPORT_EVERY_MS;

    // local log always refreshes (cheap, offline-friendly)
    let log: DeviceInfo[] = [];
    const rawLog = localStorage.getItem(LS_LOG);
    if (rawLog) {
      const parsed = JSON.parse(rawLog) as DeviceInfo[];
      if (Array.isArray(parsed)) log = parsed;
    }
    log = [info, ...log.filter((l) => l.ua !== info.ua)].slice(0, 20);
    localStorage.setItem(LS_LOG, JSON.stringify(log));
    localStorage.setItem(LS_LAST, JSON.stringify(info));

    if (stale) {
      fetch("/api/device", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(info),
        keepalive: true,
      }).catch(() => {
        /* offline: the local log already has it */
      });
    }
    return info;
  } catch {
    return null;
  }
}

/** The locally stored log (for a future parents' screen). */
export function localDeviceLog(): DeviceInfo[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_LOG);
    return raw ? (JSON.parse(raw) as DeviceInfo[]) : [];
  } catch {
    return [];
  }
}
