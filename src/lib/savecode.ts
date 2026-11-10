/**
 * Think Leo — the save code (v9)
 * ─────────────────────────────
 * A family's kid progress is trapped in one device's localStorage. The save
 * code is the escape hatch: Parent HQ exports a plain-text code, the new
 * device pastes it in (behind the hold gate) and the kid's stars, streak and
 * collections move with them.
 *
 * Format:  LEO1.<base64url(JSON)>.<fnv1a-8hex>
 *  · v1 payload = every DURABLE field of the save (see PAYLOAD_KEYS) —
 *    day-stamps ride along so claimed dailies don't re-mint on the new
 *    device; runtime-only fields (_hydrated, toasts) never travel.
 *  · checksum catches truncated copies and typos — a kid-proof "hmm, that
 *    didn't work" instead of a corrupted save.
 *  · whitespace/newlines are stripped on decode: parents paste line-wrapped
 *    codes from chat apps all the time.
 */

import type { LeoSave } from "./store";

const PREFIX = "LEO1";

/** Durable fields that travel with the code (keyed off LeoSave). */
const PAYLOAD_KEYS = [
  "xp",
  "weekXp",
  "leagueWeek",
  "hearts",
  "refills",
  "streak",
  "bestStreak",
  "lastPlayDay",
  "freezes",
  "todayXp",
  "today",
  "stars",
  "best",
  "done",
  "chests",
  "soundSfx",
  "soundMusic",
  "boostDay",
  "totalCorrect",
  "runs",
  "playDays",
  "questDay",
  "questProgress",
  "questClaimed",
  "questAllBonusDay",
  "ach",
  "seenPlayerLevel",
  "comebackDay",
  "mergeBest",
  "mergeDiscoveries",
  "mergeEggDay",
  "mergePlays",
  "totalMerges",
  "eggStars",
  "eggBag",
  "eggHatched",
  "eggPity",
  "eggNestAt",
  "eggRoyalDay",
  "feedPulls",
  "feedAlbum",
  "feedAffinity",
  "feedPity",
  "feedHeat",
  "feedBestHeat",
  "feedMegaDay",
  "feedPullDay",
  "skillStats",
  "playToday",
  "dailyCapMin",
] as const satisfies readonly (keyof LeoSave)[];

type SavePayload = Pick<LeoSave, (typeof PAYLOAD_KEYS)[number]>;

export function pickPayload(save: LeoSave): SavePayload {
  const out = {} as Record<string, unknown>;
  for (const k of PAYLOAD_KEYS) out[k] = save[k];
  return out as SavePayload;
}

/* ── checksum: FNV-1a 32-bit, hex ─────────────────────────────── */
function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/* ── base64url (unicode-safe, no deps) ────────────────────────── */
function b64urlEncode(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeSaveCode(save: LeoSave): string {
  const body = b64urlEncode(JSON.stringify(pickPayload(save)));
  return `${PREFIX}.${body}.${fnv1a(body)}`;
}

export type DecodeResult =
  | { ok: true; payload: SavePayload }
  | { ok: false; error: string };

export function decodeSaveCode(raw: string): DecodeResult {
  const code = raw.replace(/\s+/g, ""); // chat apps wrap long codes
  const parts = code.split(".");
  if (parts.length !== 3 || parts[0] !== PREFIX)
    return { ok: false, error: "That doesn't look like a Think Leo save code — it should start with LEO1." };
  const [, body, sum] = parts;
  if (fnv1a(body) !== sum)
    return { ok: false, error: "The code got scrambled on the way — copy the whole thing again, including LEO1 at the start." };
  let data: unknown;
  try {
    data = JSON.parse(b64urlDecode(body));
  } catch {
    return { ok: false, error: "The code is damaged and can't be read." };
  }
  const d = (data ?? {}) as Record<string, unknown>;
  // shape sanity — a bad paste of some OTHER app's text must never corrupt a save
  if (typeof d.xp !== "number" || typeof d.stars !== "object" || d.stars === null)
    return { ok: false, error: "This code isn't a Think Leo save." };
  return { ok: true, payload: data as SavePayload };
}
