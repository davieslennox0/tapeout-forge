// Every frame is a pure function of time: setT(t). The timings come from timeline.js, which tts.py builds from the
// real length of each spoken line, so captions, clicks, ticks and bars land when the voice says them.
const TOTAL = TL.total;
const SC = Object.fromEntries(TL.scenes.map(s => [s.id, s]));
const ease = x => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const step = (t, t0, d = .4) => ease((t - t0) / d);
const mix = (a, b, p) => a + (b - a) * p;
const $ = id => document.getElementById(id);
const ln = (sid, ev) => SC[sid].lines.find(l => l.ev === ev);
const fmt = n => Math.round(n).toLocaleString('en-US');

// ---- captions: the words appear as they are spoken
function reveal(id, sid, t) {
  let L = null;
  SC[sid].lines.forEach(l => { if (t >= l.a) L = l; });
  const el = $(id);
  if (!L) { el.textContent = ''; return; }
  const words = L.show.split(' ');
  const w = words.map(x => x.length + 1), total = w.reduce((a, b) => a + b, 0);
  const p = clamp((t - L.a) / (L.dur * 0.94));
  let acc = 0, n = 0;
  words.forEach((_, i) => { acc += w[i]; if (acc / total <= p + 0.001) n = i + 1; });
  el.textContent = words.slice(0, n).join(' ');
}

// ---- 2: NAND gate tiles (the standard symbol: a D shape with a bubble)
const NAND = '<svg width="74" height="44" viewBox="0 0 74 44" fill="none" stroke="#B7BEC4" stroke-width="2"><path d="M4 13h14M4 31h14M58 22h12"/><path d="M18 6h16a16 16 0 0 1 0 32H18z"/><circle cx="54" cy="22" r="4"/></svg>';
const EXTRA = [3, 5, 8, 10];
$('tiles').innerHTML = Array.from({length: 12}, (_, i) => `<div class="gate" id="g${i}">${NAND}${EXTRA.includes(i) ? '<small>extra</small>' : ''}</div>`).join('');

// ---- 5: truth table of the 3-input majority; both columns are the same function (the optimizer's checked result)
const MAJ = [0, 0, 0, 1, 0, 1, 1, 1];
$('ttbody').innerHTML = MAJ.map((v, i) => `<tr id="r${i}"><td>${i >> 2 & 1}</td><td>${i >> 1 & 1}</td><td>${i & 1}</td><td>${v}</td><td class="o"></td><td class="m tick"></td></tr>`).join('');

// ---- terminals: the command is typed, then the real output lines arrive
function termHTML(items) {
  return items.map((it, k) => `<div class="l cmd" id="${it.id}c"></div>` + it.out.map((o, j) =>
    `<div class="l${/verified: true|match: true|0 mismatches|never sent/.test(o) ? ' good' : ''}" id="${it.id}o${j}"></div>`).join('') + '<div class="l"></div>').join('');
}
function termSet(it, t) {   // it: {id, cmd, out, t0 (typing starts), t1 (typing ends), t2 (output done)}
  const c = $(it.id + 'c');
  const k = Math.floor(clamp((t - it.t0) / (it.t1 - it.t0)) * it.cmd.length);
  c.style.visibility = t >= it.t0 ? 'visible' : 'hidden';
  c.innerHTML = it.cmd.slice(0, k).replace(/&/g, '&amp;').replace(/</g, '&lt;') + (t < it.t1 + .15 && Math.floor(t * 3) % 2 == 0 ? '<span class="caret"></span>' : '');
  it.out.forEach((o, j) => { const e = $(it.id + 'o' + j); e.textContent = o;
    e.style.visibility = t >= it.t1 + .2 + (it.t2 - it.t1 - .2) * (j / it.out.length) ? 'visible' : 'hidden'; });
}
const V = Object.assign({id: 'v'}, TERMS.verify);
$('t5body').innerHTML = termHTML([V]);
const C = ['c1', 'c2', 'c3'].map(k => Object.assign({id: k}, TERMS[k]));
$('t8body').innerHTML = termHTML(C);

// ---- 6: the task bank as 100 dots
$('dots').innerHTML = Array.from({length: 100}, (_, i) => `<i id="d${i}"></i>`).join('');

// ---- 4: where the optimizer's controls sit in the screenshot (from capture.py), scaled to the 790px view
const K = 790 / RECTS.W;
const mid = r => [(r.x + r.w / 2) * K, (r.y + r.h / 2) * K];

const LABELS = {s2: 'The problem', s3: 'The product', s4: 'Step 1 of 3', s5: 'Step 2 of 3', s6: 'The evidence', s7: 'Step 3 of 3', s8: 'For developers', sc: 'Silicon path', s9: 'The fine print'};

function setT(t) {
  TL.scenes.forEach((s, i) => {
    const el = $(s.id), inn = step(t, s.a, .5), out = 1 - step(t, s.b - .45, .45);
    el.style.opacity = (i === 0 ? 1 : inn) * (i === TL.scenes.length - 1 ? 1 : out);
    el.style.transform = `translateY(${(1 - inn) * 14}px)`;
  });
  $('progress').firstElementChild.style.width = (t / TOTAL * 100) + '%';
  const cur = TL.scenes.find(s => t >= s.a && t < s.b) || TL.scenes[TL.scenes.length - 1];
  $('stepcount').textContent = LABELS[cur.id] || '';
  ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 'sc'].forEach(sid => reveal('cp_' + sid, sid, t));

  // 1 title: the gate is drawn stroke by stroke
  document.querySelectorAll('#biggate .dr').forEach((e, i) => { const L = e.getTotalLength(); e.style.strokeDasharray = L;
    e.style.strokeDashoffset = L * (1 - ease(clamp((t - .5 - i * .55) / .9))); });
  $('gatelab').style.opacity = step(t, 3.2, .5);

  // 2 the problem: gates arrive, the meter climbs and the extra ones glow, then the question and its tick
  const g2 = ln('s2', 'gates'), c2 = ln('s2', 'cost'), m2 = ln('s2', 'same');
  for (let i = 0; i < 12; i++) {
    const e = $('g' + i), on = step(t, g2.a + .2 + (g2.dur - .6) * i / 12, .3), x = EXTRA.includes(i);
    const hot = x ? step(t, c2.a + c2.dur * .55, .5) : 0, gone = x ? step(t, m2.a + .2, .7) : 0;
    e.style.opacity = on * (1 - .82 * gone);
    e.style.transform = `scale(${.8 + .2 * on})`;
    e.style.borderColor = hot > .5 ? '#E0904F' : '#3A4149';
    const s = e.querySelector('small'); if (s) s.style.opacity = hot;
  }
  $('costbox').style.opacity = step(t, c2.a, .4);
  const cp = ease(clamp((t - c2.a) / (c2.dur * .9))) * (1 - .34 * step(t, m2.a + .2, .7));
  $('meter').style.width = (cp * 100) + '%';
  $('costlab').textContent = t > m2.a + .9 ? '8 gates instead of 12' : t > c2.a ? 'grows with every gate' : '';
  $('samebox').style.opacity = step(t, m2.a + .1, .5);
  $('samecheck').style.transform = `scale(${step(t, m2.b - .5, .35)})`;

  // 3 the three steps light up as she names them
  const s3 = ln('s3', 'steps');
  [.52, .68, .82].forEach((f, i) => { const e = $('st' + (i + 1)), on = step(t, s3.a + s3.dur * f, .3);
    e.style.borderColor = on > .5 ? '#E0904F' : '#262B31'; e.style.transform = `translateY(${-10 * on}px)`; e.style.opacity = .55 + .45 * on; });

  // 4 optimize: pointer goes to the input, the objective, the button; the screenshots change when the real page did
  const o4 = ln('s4', 'open'), p4 = ln('s4', 'paste'), k4 = ln('s4', 'pick'), r4 = ln('s4', 'result');
  const tPick = k4.a + k4.dur * .3, tClick = k4.b - .25;
  $('im_b').style.opacity = step(t, tPick + .35, .25); $('im_c').style.opacity = step(t, tClick + .25, .45);
  const pts = [[o4.a, [640, 60]], [p4.a + .3, mid(RECTS.input)], [p4.b, mid(RECTS.input)], [tPick, mid(RECTS.obj)], [tClick - .7, mid(RECTS.obj)], [tClick - .1, mid(RECTS.run)], [r4.a + .4, mid(RECTS.run)], [r4.a + 1.6, mid(RECTS.out)]];
  let P = pts[0][1];
  for (let i = 0; i < pts.length - 1; i++) if (t >= pts[i][0]) { const p = ease((t - pts[i][0]) / (pts[i + 1][0] - pts[i][0])); P = [mix(pts[i][1][0], pts[i + 1][1][0], p), mix(pts[i][1][1], pts[i + 1][1][1], p)]; }
  const ptr = $('ptr4'); ptr.style.left = P[0] + 'px'; ptr.style.top = P[1] + 'px';
  ptr.style.opacity = step(t, p4.a, .3) * (1 - step(t, r4.a + 1.4, .4));
  ptr.style.transform = `scale(${1 + .9 * clamp(1 - Math.abs(t - tClick) / .22)})`;
  const ring = $('ring4'), rr = t < tPick - .2 ? RECTS.input : t < r4.a ? (t < tClick - .6 ? RECTS.obj : RECTS.run) : RECTS.out;
  ring.style.left = (rr.x * K - 5) + 'px'; ring.style.top = (rr.y * K - 5) + 'px'; ring.style.width = (rr.w * K + 10) + 'px'; ring.style.height = (rr.h * K + 10) + 'px';
  ring.style.opacity = step(t, p4.a + .3, .3) * (1 - step(t, tClick + .2, .3));
  const hC = $('im_c').naturalHeight / $('im_c').naturalWidth * 790, over = Math.max(0, hC - 538);
  const outTop = Math.max(0, Math.min(over, RECTS.out.y * K - 110));
  $('optwrap').style.transform = `translateY(${-outTop * step(t, r4.a + .3, 1.0)}px)`;

  // 5 prove: rows tick one by one, then the second tool runs, then the three numbers count up
  const a5 = ln('s5', 'rows'), b5 = ln('s5', 'second'), c5 = ln('s5', 'stats');
  let done = 0;
  MAJ.forEach((v, i) => { const on = t >= a5.a + a5.dur * (.42 + .5 * i / 8); if (on) done++;
    const r = $('r' + i); r.querySelector('.o').textContent = on ? v : ''; r.querySelector('.m').textContent = on ? '✓' : ''; });
  $('ttcount').textContent = done ? `${done} of 8 rows match` : '';
  const sw = step(t, b5.a - .1, .5);
  $('ttcard').style.opacity = 1 - sw; $('term5').style.opacity = sw; $('term5').style.transform = `translateY(${(1 - sw) * 18}px)`;
  V.t0 = b5.a + .3; V.t1 = b5.a + b5.dur * .45; V.t2 = b5.b; termSet(V, t);
  $('stats').style.opacity = step(t, c5.a - .1, .4);
  $('n1').textContent = fmt(22 * ease(clamp((t - c5.a) / (c5.dur * .2))));
  $('n2').textContent = fmt(25856 * ease(clamp((t - c5.a - c5.dur * .2) / (c5.dur * .5))));
  $('n3').style.opacity = step(t, c5.a + c5.dur * .78, .25);

  // 6 evidence: 46 of 100 tasks light up, split into beat / tied / lost, then the biggest win as two bars
  const a6 = ln('s6', 'replay'), b6 = ln('s6', 'bar'), c6 = ln('s6', 'gc');
  const lit = Math.floor(46 * clamp((t - a6.a - a6.dur * .5) / (a6.dur * .45)));
  const col = [b6.a + b6.dur * .30, b6.a + b6.dur * .58, b6.a + b6.dur * .80];
  for (let i = 0; i < 100; i++) { let c = '#262B31';
    if (i < lit) c = '#F2B07A';
    if (i < 22 && t > col[0]) c = '#6FCF97'; else if (i >= 22 && i < 33 && t > col[1]) c = '#8D969E'; else if (i >= 33 && i < 46 && t > col[2]) c = '#D9695F';
    $('d' + i).style.background = c; }
  $('banklab').textContent = lit >= 46 ? '46 with a complete spec · 54 left out' : '';
  [...$('legend').children].forEach((e, i) => e.style.opacity = step(t, col[i], .3));
  $('gcbox').style.opacity = step(t, c6.a, .4);
  const full = 718, rp = ease(clamp((t - c6.a - c6.dur * .22) / .8)), op = ease(clamp((t - c6.a - c6.dur * .52) / .6));
  $('refbar').style.width = Math.max(rp * full, 0) + 'px'; $('refbar').style.opacity = rp > .05 ? 1 : 0; $('refbar').style.color = rp > .6 ? '#E8EAEC' : 'transparent';
  $('ourbar').style.width = (op * full * 28672 / 496000) + 'px'; $('ourlab').style.opacity = op;
  $('x17').style.opacity = step(t, c6.a + c6.dur * .8, .3); $('x17').style.transform = `scale(${.8 + .2 * step(t, c6.a + c6.dur * .8, .3)})`;

  // 7 tape out: the gallery scrolls, the copy-to-wallet flow appears, then the registry
  const a7 = ln('s7', 'gallery'), w7 = ln('s7', 'wallet'), r7 = ln('s7', 'registry');
  const hG = $('im_gal').naturalHeight / $('im_gal').naturalWidth * 790;
  $('im_gal').style.transform = `translateY(${-Math.max(0, Math.min(hG - 538, 520)) * ease(clamp((t - a7.a - .3) / (w7.b - a7.a - .3)))}px)`;
  const reg = step(t, r7.a - .1, .5);
  $('im_reg').style.opacity = reg;
  const hR = $('im_reg').naturalHeight / $('im_reg').naturalWidth * 790;
  $('im_reg').style.transform = `translateY(${-Math.max(0, Math.min(hR - 538, 150)) * ease(clamp((t - r7.a - .4) / (r7.dur)))}px)`;
  $('flow').style.opacity = step(t, w7.a + .1, .4) * (1 - reg);
  $('flow').style.transform = `translateY(${(1 - step(t, w7.a + .1, .4)) * 16}px)`;
  $('url7').textContent = reg > .5 ? 'forgeout.xyz/#registry' : 'forgeout.xyz/#checked';

  // 8 developers: each command is typed as she names it
  C.forEach((it, i) => { const l = SC.s8.lines[i]; const lead = i === 0 ? l.dur * .5 : .1;
    it.t0 = l.a + lead; it.t1 = l.a + lead + Math.min(1.6, l.dur * .4); it.t2 = l.b - .1; termSet(it, t); });

  // silicon: the site's own section scrolls; the status ladder and the exact wording appear when she says them
  const e1 = ln('sc', 'exp'), e2 = ln('sc', 'ci'), e3 = ln('sc', 'lim');
  const hS = $('im_sil').naturalHeight / $('im_sil').naturalWidth * 790;
  $('im_sil').style.transform = `translateY(${-Math.max(0, Math.min(hS - 538, 330)) * ease(clamp((t - e1.a - 1) / (e2.b - e1.a - 1)))}px)`;
  $('ladder').style.opacity = 1; $('ld1').style.opacity = .45 + .55 * step(t, e2.a + e2.dur * .45, .4); $('ld1').style.borderColor = t > e2.a + e2.dur * .45 ? '#6FCF97' : '#3A4149'; $('ld1').style.color = t > e2.a + e2.dur * .45 ? '#6FCF97' : '#B7BEC4';
  $('silbox').style.opacity = step(t, e3.a + .2, .4); $('silbox').style.transform = `translateY(${(1 - step(t, e3.a + .2, .4)) * 16}px)`;

  // 9 outro: the three limits appear as she says them, then the address
  const a9 = ln('s9', 'bullets'), u9 = ln('s9', 'url');
  $('b1').style.opacity = step(t, a9.a + a9.dur * .22); $('b2').style.opacity = step(t, a9.a + a9.dur * .55); $('b3').style.opacity = step(t, a9.a + a9.dur * .80);
  $('url9').style.opacity = step(t, u9.a + u9.dur * .5); $('url9').style.transform = `translateY(${(1 - step(t, u9.a + u9.dur * .5)) * 12}px)`;
}
window.setT = setT;
Promise.all([...document.images].map(i => i.decode ? i.decode().catch(() => {}) : 0)).then(() => document.fonts.ready).then(() => { setT(0); window.ready = true; });
