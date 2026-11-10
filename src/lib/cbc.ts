/**
 * Think Leo — CBC curriculum strands (v9)
 * ───────────────────────────────────────
 * Parent HQ groups the per-skill mastery bars under the strands of Kenya's
 * CBC **Mathematical Activities** (KICD PP2 Mathematical Activities design,
 * 2024 rationalization — the four official strands: Pre-Number Activities,
 * Numbers, Measurement, Geometry). This tells a parent not just "counting:
 * 82%" but "the Numbers strand is strong".
 *
 * Mapping rules (honest, no stretching):
 *  · odd-one-out IS sorting & grouping; shadow match and memory ARE matching
 *    & pairing; sequences ARE ordering & patterns; tap-the-target is grouping
 *    by category → all Pre-Number Activities.
 *  · count / feed-Leo are counting concrete objects; add-subtract is the
 *    strand's "putting together / taking away"; compare is number value;
 *    truefalse is number statements; multiply is the Grade 2–3 tables.
 *  · Measurement and Geometry have no puzzle kinds YET — they are listed as
 *    "coming" so parents see the full strand map, not a silent gap.
 */

export interface CbcStrand {
  id: string;
  name: string;
  substrands: string;
  kinds: string[]; // QKind ids that feed this strand
  coming?: boolean; // strand mapped but no question kinds yet
}

export const CBC_STRANDS: CbcStrand[] = [
  {
    id: "preNumber",
    name: "Pre-Number Activities",
    substrands: "sorting & grouping · matching & pairing · ordering · patterns",
    kinds: ["oddOne", "shadow", "memory", "sequence", "tapTarget"],
  },
  {
    id: "numbers",
    name: "Numbers",
    substrands: "counting · putting together & taking away · number value · tables",
    kinds: ["count", "addsub", "compare", "truefalse", "multiply", "feedLeo"],
  },
  {
    id: "measurement",
    name: "Measurement",
    substrands: "mass · capacity · time · money · area",
    kinds: [],
    coming: true,
  },
  {
    id: "geometry",
    name: "Geometry",
    substrands: "lines · shapes",
    kinds: [],
    coming: true,
  },
];

/** strandId -> the skills a kid has actually tried, in.Parent-HQ order. */
export function skillsByStrand(
  skillStats: Record<string, { ok: number; n: number }>
): { strand: CbcStrand; kinds: [string, { ok: number; n: number }][] }[] {
  return CBC_STRANDS.map((strand) => ({
    strand,
    kinds: Object.entries(skillStats)
      .filter(([kind, s]) => s.n > 0 && strand.kinds.includes(kind))
      .sort((a, b) => b[1].ok / b[1].n - a[1].ok / a[1].n),
  }));
}
