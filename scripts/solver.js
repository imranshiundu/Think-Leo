(() => {
  const card = document.querySelector('.leo-card');
  if (!card) return 'NO CARD';
  const h2 = card.querySelector('h2') ? card.querySelector('h2').textContent : '';
  const btns = Array.from(card.querySelectorAll('.answer-bubble'));
  if (!btns.length) {
    for (let k = 0; k < 6; k++) {
      setTimeout(() => { const p = document.querySelector('[aria-label="Memory pad 1"]'); if (p) p.click(); }, 900 + k * 420);
    }
    return 'MEMORY: scheduled pad clicks';
  }
  const texts = btns.map(function (b) { return b.textContent.trim(); });
  let disp = '';
  const divs = Array.from(card.querySelectorAll('div'));
  for (const d of divs) { if (String(d.className).indexOf('text-5xl') >= 0) { disp = d.textContent.trim(); break; } }
  function num(s) { return parseInt(s.replace(/[^0-9-]/g, ''), 10); }
  let idx = -1;
  let m = disp.match(/^(\d+)\s*([+−])\s*(\d+)\s*=\s*\?$/);
  let m5 = disp.match(/^(\d+)\s*([+−])\s*(\d+)\s*([+−])\s*(\d+)\s*=\s*\?$/);
  let tf = disp.match(/^(\d+)\s*([+−])\s*(\d+)\s*=\s*(-?\d+)$/);
  let mm = disp.match(/^(\d+)\s*×\s*(\d+)\s*=\s*\?$/);
  if (m) { const r = m[2] === '+' ? +m[1] + +m[3] : +m[1] - +m[3]; idx = texts.indexOf(String(r)); }
  else if (m5) { let r = +m5[1]; r = m5[2] === '+' ? r + +m5[3] : r - +m5[3]; r = m5[4] === '+' ? r + +m5[5] : r - +m5[5]; idx = texts.indexOf(String(r)); }
  else if (mm) { idx = texts.indexOf(String(+mm[1] * +mm[2])); }
  else if (tf) { const r = tf[2] === '+' ? +tf[1] + +tf[3] : +tf[1] - +tf[3]; idx = (r === +tf[4]) ? 0 : 1; }
  else if (h2.indexOf('How many') >= 0) {
    for (const d of divs) { if (String(d.className).indexOf('text-4xl') >= 0) { idx = texts.indexOf(String(d.children.length)); break; } }
  } else if (h2.indexOf('MORE') >= 0 || h2.indexOf('BIGGER') >= 0 || h2.indexOf('SMALLER') >= 0) {
    if (btns.length === 2) {
      const nums = btns.map(num);
      if (h2.indexOf('MORE') >= 0 && h2.indexOf('plate') >= 0) {
        const counts = btns.map(function (b) {
          const cl = b.querySelector('span span');
          return cl ? cl.children.length : 0;
        });
        idx = counts[0] === counts[1] ? -1 : (counts[0] > counts[1] ? 0 : 1);
      } else if (h2.indexOf('BIGGER') >= 0) { idx = nums[0] === nums[1] ? -1 : (nums[0] > nums[1] ? 0 : 1); }
      else { idx = nums[0] === nums[1] ? -1 : (nums[0] < nums[1] ? 0 : 1); }
    }
  } else if (h2.indexOf('comes next') >= 0) {
    const tiles = Array.from(card.querySelectorAll('span')).filter(function (s) { return String(s.className).indexOf('min-w-14') >= 0; }).map(function (s) { return s.textContent.trim(); });
    const ns = tiles.filter(function (t) { return t !== '?'; }).map(num);
    if (ns.length >= 4) {
      let r = null;
      const d1 = ns[1] - ns[0], d2 = ns[2] - ns[1], d3 = ns[3] - ns[2];
      if (d1 === d2 && d2 === d3) r = ns[3] + d1;
      else if (ns[1] === 2 * ns[0] && ns[2] === 2 * ns[1] && ns[3] === 2 * ns[2]) r = ns[3] * 2;
      else if (ns[1] === 3 * ns[0] && ns[2] === 3 * ns[1] && ns[3] === 3 * ns[2]) r = ns[3] * 3;
      else if (ns[2] === ns[0] + ns[1] && ns[3] === ns[1] + ns[2]) r = ns[2] + ns[3];
      if (r !== null) idx = texts.indexOf(String(r));
    }
  }
  if (idx < 0) idx = Math.floor(Math.random() * btns.length);
  btns[idx].click();
  return 'PROMPT:' + h2 + ' | DISP:' + disp + ' | PICKED ' + idx + ' (' + texts[idx] + ')';
})()
