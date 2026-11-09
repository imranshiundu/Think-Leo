/** Pinpoint where stars get dropped. Run: bun scripts/store-debug2.ts */
import { useLeo } from "../src/lib/store";

// A: direct setState
useLeo.setState({ stars: { 1: 2 } });
console.log("A direct setState →", JSON.stringify(useLeo.getState().stars));

// B: recordLevel only
useLeo.getState().recordLevel(3, 3, 500);
console.log("B recordLevel     →", JSON.stringify(useLeo.getState().stars), "runs:", useLeo.getState().runs);

// C: inspect what recordLevel's set object contained by spying on set
const api = (useLeo as unknown as { setState: (p: object) => void });
void api;
console.log("C state keys count:", Object.keys(useLeo.getState()).length);
console.log("C has tickHearts:", typeof useLeo.getState().tickHearts === "function");
