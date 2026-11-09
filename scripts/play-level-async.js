/* Kick off the level auto-player inside the page without blocking CDP. */
(() => {
  window.__lvlLog = "running";
  (async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const log = [];
    const $ = (s) => document.querySelector(s);
    const opts = () => [...document.querySelectorAll(".answer-bubble")].map((b) => b.textContent.trim());
    const prompt = () => ($("h2.font-display") ? $("h2.font-display").textContent : "");
    const display = () => {
      const el = $(".text-5xl");
      return el ? el.textContent : "";
    };

    function solve() {
      const p = prompt();
      const o = opts();
      const d = display();
      const tileWrap = $(".mx-auto.flex.max-w-md.flex-wrap") || $(".flex-wrap");
      if (p.indexOf("How many") >= 0 && tileWrap) {
        const n = tileWrap.children.length;
        return o.findIndex((x) => x === String(n));
      }
      if (d) {
        const m = d.match(/(\d+)\s*([+\u2212\u00d7])\s*(\d+)\s*=\s*(\d+|\?)/);
        if (m) {
          const a = +m[1], op = m[2], b = +m[3];
          const real = op === "+" ? a + b : op === "\u2212" ? a - b : a * b;
          if (m[4] === "?") return o.findIndex((x) => x === String(real));
          return +m[4] === real ? 0 : 1;
        }
      }
      if (p.indexOf("BIGGER") >= 0 || p.indexOf("SMALLER") >= 0) {
        const n = o.map(Number);
        return p.indexOf("BIGGER") >= 0 ? (n[0] > n[1] ? 0 : 1) : n[0] < n[1] ? 0 : 1;
      }
      if (p.indexOf("comes next") >= 0) {
        const seqEls = [...document.querySelectorAll('span[class*="min-w-14"]')].map((e) => e.textContent.trim());
        const nums = seqEls.filter((s) => s !== "?").map(Number);
        if (nums.length >= 3) {
          const dd = nums[1] - nums[0];
          if (nums.every((n, i) => i === 0 || n - nums[i - 1] === dd))
            return o.findIndex((x) => x === String(nums[nums.length - 1] + dd));
          const rr = nums[1] / nums[0];
          if (nums.every((n, i) => i === 0 || n === nums[i - 1] * rr))
            return o.findIndex((x) => x === String(nums[nums.length - 1] * rr));
          if (nums.every((n, i) => i < 2 || n === nums[i - 1] + nums[i - 2]))
            return o.findIndex((x) => x === String(nums[nums.length - 1] + nums[nums.length - 2]));
        }
        return 0;
      }
      if (p.indexOf("MORE") >= 0) {
        const n = o.map(Number);
        return n[0] > n[1] ? 0 : 1;
      }
      if (p.indexOf("True") >= 0 || p.indexOf("trap") >= 0) {
        const d2 = display();
        const m = d2.match(/(\d+)\s*([+\u2212])\s*(\d+)\s*=\s*(-?\d+)/);
        if (m) {
          const real = m[2] === "+" ? +m[1] + +m[3] : +m[1] - +m[3];
          return +m[4] === real ? 0 : 1;
        }
      }
      return 0; // oddOne / unknown: guess
    }

    async function clickOpt(i) {
      const bubbles = document.querySelectorAll(".answer-bubble");
      if (i < 0 || i >= bubbles.length) return false;
      bubbles[i].dispatchEvent(new MouseEvent("click", { bubbles: true }));
      return true;
    }

    // ── 8 main questions ──
    for (let qi = 0; qi < 8; qi++) {
      await sleep(400);
      const p = prompt();
      const o = opts();
      if (!p) { log.push("Q" + qi + ": no prompt visible"); break; }
      if (o.length === 0) {
        log.push("Q" + qi + " MEMORY — answering after watch phase");
        // memory pads: wait for playback then tap the lit sequence? simpler: wait out the clock
        await sleep(15500);
        continue;
      }
      const pick = solve();
      log.push("Q" + qi + " [" + p.slice(0, 34) + "] pick=" + pick + " of " + o.join("|"));
      await clickOpt(pick);
      await sleep(2100);
    }

    // ── wait for RUSH to begin ──
    for (let i = 0; i < 30; i++) {
      if (document.body.textContent.indexOf("LEO RUSH") >= 0 || document.body.textContent.indexOf("\u00d72 RUSH") >= 0) break;
      await sleep(300);
    }
    await sleep(2200);
    log.push("RUSH started");

    // ── rush: answer as fast as possible for ~14s (beyond the 12s clock!) ──
    const t0 = performance.now();
    let rushClicks = 0;
    while (performance.now() - t0 < 14000) {
      const p = prompt();
      const o = opts();
      const tileWrap = $(".flex-wrap");
      let pick = 0;
      if (p.indexOf("How many") >= 0 && tileWrap) pick = o.findIndex((x) => x === String(tileWrap.children.length));
      else {
        const d = display();
        const m = d.match(/(\d+)\s*([+\u2212])\s*(\d+)\s*=/);
        if (m) {
          const val = m[2] === "+" ? +m[1] + +m[3] : +m[1] - +m[3];
          pick = o.findIndex((x) => x === String(val));
        }
      }
      if (await clickOpt(pick)) rushClicks++;
      await sleep(210);
    }
    log.push("RUSH clicks: " + rushClicks);

    // ── wait for results ──
    let seen = "TIMEOUT: results never appeared";
    for (let i = 0; i < 40; i++) {
      if (document.body.textContent.indexOf("Level complete") >= 0) { seen = "Level complete!"; break; }
      if (document.body.textContent.indexOf("So close") >= 0) { seen = "So close!"; break; }
      await sleep(300);
    }
    log.push("RESULTS: " + seen);
    await sleep(600);
    const res = document.querySelector(".leo-card.max-w-md");
    log.push("CARD: " + (res ? res.textContent.replace(/\s+/g, " ").slice(0, 320) : "NOT FOUND"));
    return log.join("\n");
  })().then((r) => { window.__lvlLog = r; }).catch((e) => { window.__lvlLog = "ERR " + (e && e.message); });
  return "started";
})()
