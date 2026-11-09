/**
 * Live store reproduction: run the exact recordLevel → addXp sequence
 * from endRush and see whether stars survive. Run: bun scripts/store-debug.ts
 */
import { useLeo } from "../src/lib/store";

// silence persist's missing-localStorage warning in bun
console.log("--- initial state ---");
let s = useLeo.getState();
console.log("stars:", JSON.stringify(s.stars), "runs:", s.runs, "xp:", s.xp, "questProgress len:", s.questProgress.length);

console.log("\n--- simulate endRush: recordLevel(1, 2, 8739) then addXp(758) ---");
useLeo.getState().recordLevel(1, 2, 8739);
s = useLeo.getState();
console.log("after recordLevel → stars:", JSON.stringify(s.stars), "runs:", s.runs, "questProgress len:", s.questProgress.length);

useLeo.getState().addXp(758);
s = useLeo.getState();
console.log("after addXp      → stars:", JSON.stringify(s.stars), "runs:", s.runs, "xp:", s.xp, "streak:", s.streak);

console.log("\n--- simulate trackRush BEFORE recordLevel (as endRush does) ---");
useLeo.getState().trackRush(58);
s = useLeo.getState();
console.log("after trackRush  → stars:", JSON.stringify(s.stars), "rushQuest len:", s.questProgress.length);

console.log("\n--- board: questsForDay today ---");
const { questsForDay, dayKey } = await import("../src/lib/game");
const board = questsForDay(dayKey());
console.log("board length:", board.length, board.map((q) => q.id).join(", "));
