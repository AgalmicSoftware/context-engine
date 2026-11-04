/*
  Context Engine — shared kit for the motion loops
  ---------------------------------------------------------------------------
  Each film in films/ builds one SVG once, then sets every animated attribute
  as a pure function of time, so playback, seeking and offline frame capture all
  produce identical frames.

  - No Math.random, Date or CSS animation.
  - Fonts are shared with the product film and awaited first (motion.ready).
  - ?film=cities picks a film (default: readme).
  - ?capture=1 shows only the stage, without controls (used by render/).
  - ?t=7.5 opens paused at a given time; ?paused=1 opens paused at 0.

  The look follows the product film (media/product-film): its light palette,
  white cards, teal section badges, ring steppers and participant dots.
*/
(function () {
  'use strict';

  const W = 1920;
  const H = 1080;
  const FPS = 30;

  // The product film's palette (TH, STANCE, ANSWERS and QUAD_INK in its film.js),
  // with its translucent tints flattened over white.
  const C = {
    ink: '#202b3a',
    ink2: '#526174',
    soft: '#8b94a1',
    card: '#ffffff',
    hair: '#e9eaeb',
    hair2: '#d2d5d8',
    tile: '#f5f5f6',
    field: '#fcfcfe',
    footer: '#b8bbcd',
    axis: '#68788c',
    teal: '#0b9aa8',
    tealTint: '#e2f3f5',
    rec: '#e5394a',
    recTint: '#fce7e9',
    select: '#2fb36b',
    pos: '#1f9d55',
    posTint: '#e9f5ee',
    posPress: '#bfe3cd',
    neg: '#e0453a',
    negTint: '#fcecea',
    rowOn: '#8fceaa',
    rowOnFill: '#f1f9f4',
    agree: '#2e7d32',
    unsure: '#ffeb3b',
    unsureInk: '#23231f',
    disagree: '#c62828',
    stance: ['#2e9d4a', '#f0c419', '#e0453a'],
    answers: ['#0fa3b5', '#eea01f', '#ea573f', '#6c60e6'],
  };

  // The film's 24-unit icons.
  const ICON = {
    question:
      '<path d="M9.2 9.2a2.9 2.9 0 1 1 4 2.7c-.8.4-1.2.9-1.2 1.8v.6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="17.6" r="1.3" fill="currentColor"/>',
    chart: '<path d="M7.5 17v-5M12 17V7.5M16.5 17v-3" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
    person: '<circle cx="12" cy="8.5" r="3.8" fill="currentColor"/><path d="M5 19.5c.5-3.9 3.4-6.3 7-6.3s6.5 2.4 7 6.3z" fill="currentColor"/>',
    mic: '<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/></g>',
    comment:
      '<path fill="currentColor" d="M12 4C6.5 4 2 7.4 2 11.5c0 2 1.1 3.9 2.9 5.2L4 20.5l4.3-2.2c1.2.3 2.4.5 3.7.5 5.5 0 10-3.4 10-7.5S17.5 4 12 4z"/>',
    lockOpen:
      '<path fill="currentColor" d="M17 9V7a5 5 0 0 0-9.8-1.4l1.9.6A3 3 0 0 1 15 7v2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1z"/>',
    lock: '<path fill="currentColor" d="M17 9V7A5 5 0 0 0 7 7v2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1zM9 7a3 3 0 0 1 6 0v2H9z"/>',
    robot:
      '<path fill="currentColor" d="M11 2h2v3h4a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3h4V2zm-2.5 8a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm7 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM9 15.5h6v1.5H9zM1 10h2v5H1zm20 0h2v5h-2z"/>',
  };

  // Layout, on the 1920x1080 stage. The card's width and footer match the film's;
  // its top sits lower, leaving room for the section heading above it.
  const CARD = { x: 260, y: 190, w: 1400, h: 787, r: 39 };
  const QUESTION = { x: 340, y: 314, size: 72, leading: 88 };
  const ROWS = { x: 340, w: 1240, h: 136, r: 22, y: [368, 516, 664] };
  const QUAD = { cell: 32, pitch: 36, tileX: 1440, tile: 116 };

  // -------------------------------------------------------------------------
  // Utilities
  // -------------------------------------------------------------------------
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, p) => a + (b - a) * p;
  const P = (t, a, b) => clamp((t - a) / (b - a));
  const ease = {
    out: (p) => 1 - Math.pow(1 - p, 3),
    inOut: (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
    inOut2: (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2),
    back: (p) => 1 + 2.4 * Math.pow(p - 1, 3) + 1.4 * Math.pow(p - 1, 2),
  };
  // A short pulse: 0 -> 1 -> 0 over [a, a + len].
  const bump = (t, a, len) => Math.sin(Math.PI * P(t, a, a + len));

  const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  function mixColor(a, b, p) {
    const [A, B] = [hexRgb(a), hexRgb(b)];
    return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], p))).join(',')})`;
  }

  const n3 = (v) => Math.round(v * 1000) / 1000;

  // Rounded rectangle with per-corner radii, so a shape can morph between
  // stacked-bar segments, buttons and rows on the same path.
  function rrect(x, y, w, h, tl, tr = tl, br = tl, bl = tl) {
    const [X, Y, R, B] = [x, y, x + w, y + h].map(n3);
    const arc = (r, ex, ey) => `A${n3(r)} ${n3(r)} 0 0 1 ${n3(ex)} ${n3(ey)}`;
    return (
      `M${n3(X + tl)} ${Y}H${n3(R - tr)}${arc(tr, R, Y + tr)}V${n3(B - br)}${arc(br, R - br, B)}` +
      `H${n3(X + bl)}${arc(bl, X, B - bl)}V${n3(Y + tl)}${arc(tl, X + tl, Y)}Z`
    );
  }

  const NS = 'http://www.w3.org/2000/svg';
  function set(node, attrs) {
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    return node;
  }
  function el(parent, tag, attrs = {}, str) {
    const node = set(document.createElementNS(NS, tag), attrs);
    if (str !== undefined) node.textContent = str;
    parent.appendChild(node);
    return node;
  }
  const group = (parent, attrs) => el(parent, 'g', attrs);
  const text = (parent, x, y, size, weight, fill, str, anchor = 'start') =>
    el(parent, 'text', { x, y, 'font-size': size, 'font-weight': weight, fill, 'text-anchor': anchor }, str);
  function icon(parent, markup, x, y, size, color) {
    const node = el(parent, 'svg', { x, y, width: size, height: size, viewBox: '0 0 24 24', color });
    node.innerHTML = markup;
    return node;
  }
  // A stroke that draws on with draw(node, p). pathLength normalises the dash.
  const stroke = (parent, tag, attrs) =>
    el(parent, tag, { fill: 'none', pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-linecap': 'round', ...attrs });
  function draw(node, p) {
    // A zero-length round-capped dash would still paint a dot.
    node.setAttribute('stroke-opacity', p <= 0 ? 0 : 1);
    node.setAttribute('stroke-dashoffset', n3(1 - p));
  }

  // Position a group from scratch: opacity, offset and optional scale about (cx, cy).
  function place(node, { o = 1, x = 0, y = 0, s = 1, cx = 0, cy = 0 } = {}) {
    if (o <= 0) return void node.setAttribute('display', 'none');
    node.setAttribute('display', 'inline');
    node.setAttribute('opacity', n3(o));
    let tf = x || y ? `translate(${n3(x)} ${n3(y)})` : '';
    if (s !== 1) tf += ` translate(${n3(cx)} ${n3(cy)}) scale(${n3(s)}) translate(${n3(-cx)} ${n3(-cy)})`;
    if (tf) node.setAttribute('transform', tf);
    else node.removeAttribute('transform');
  }

  // A question rises into place and rises out, while the card stays put. The
  // next one starts only once the last is nearly gone (under 2% opacity), so
  // their text never reads together, yet the card is never left empty.
  function beat(t, [a, b], delay = 0) {
    const i = ease.out(P(t, a - 0.06 + delay, a + 0.26 + delay));
    const o = ease.inOut2(P(t, b - 0.26, b - 0.04));
    return { o: i * (1 - o), y: (1 - i) * 26 - o * 18 };
  }

  // The card, and the dots beside it, leave at `out` and come back at `back`.
  const shellAt = (t, out, back) => clamp(1 - P(t, out, out + 0.34) + P(t, back, back + 0.34));

  // -------------------------------------------------------------------------
  // Shared parts
  // -------------------------------------------------------------------------
  function questionText(parent, lines) {
    const g = group(parent);
    lines.forEach((line, i) =>
      text(g, QUESTION.x, QUESTION.y + i * QUESTION.leading, QUESTION.size, 600, C.ink, line),
    );
    return g;
  }

  // An outlined option row.
  const optionRow = (parent, y, h = ROWS.h) =>
    el(parent, 'rect', { x: ROWS.x, y, width: ROWS.w, height: h, rx: ROWS.r, 'stroke-width': 3 });
  function lightRow(node, on) {
    node.setAttribute('fill', mixColor(C.card, C.rowOnFill, on));
    node.setAttribute('stroke', mixColor(C.hair2, C.rowOn, on));
  }

  // Multiple choice: rows of [label, check time offset], checked in turn.
  function buildCheckRows(parent, rows) {
    return rows.map(([label, at], i) => {
      const y = ROWS.y[i];
      const x = 372;
      const size = 72;
      const top = y + (ROWS.h - size) / 2;
      const row = optionRow(parent, y);
      const box = group(parent);
      el(box, 'rect', { x: x + 2, y: top + 2, width: size - 4, height: size - 4, rx: 13, fill: C.card, stroke: C.hair2, 'stroke-width': 4 });
      const fill = el(box, 'rect', { x, y: top, width: size, height: size, rx: 15, fill: C.select, 'data-check': 1 });
      const tick = stroke(box, 'path', {
        d: `M${x + 19} ${top + 38}L${x + 31} ${top + 50}L${x + 54} ${top + 24}`,
        stroke: C.card,
        'stroke-width': 8,
        'stroke-linejoin': 'round',
      });
      text(parent, 476, y + ROWS.h / 2 + 20, 56, 500, C.ink, label);
      return { row, box, fill, tick, at, cx: x + size / 2, cy: top + size / 2 };
    });
  }
  function renderCheckRows(boxes, t, a) {
    boxes.forEach(({ row, box, fill, tick, at, cx, cy }) => {
      const on = ease.out(P(t, a + at, a + at + 0.12));
      lightRow(row, on);
      place(fill, { o: on });
      draw(tick, ease.out(P(t, a + at + 0.05, a + at + 0.24)));
      place(box, { s: 1 - 0.08 * bump(t, a + at, 0.22), cx, cy });
    });
  }

  // The film's participants: two columns either side of the card. `answered` lists
  // [column, row, time]; each lights its dot at that time, until `until`.
  function buildDots(root, answered = []) {
    const g = group(root);
    const lit = [];
    const all = [];
    [92, 172, W - 172, W - 92].forEach((x, c) => {
      for (let r = 0; r < 12; r += 1) {
        const cy = CARD.y + 28 + (r * (CARD.h - 56)) / 11;
        const fill = C.answers[(c * 3 + r * 5 + ((r * c) % 3)) % 4];
        const dot = el(g, 'circle', { cx: x, cy, r: 10, opacity: 0.28, fill });
        all.push({ dot, x, y: cy, fill, c, r });
        const hit = answered.find(([col, row]) => col === c && row === r);
        if (hit) lit.push({ dot, at: hit[2] });
      }
    });
    return { g, lit, all };
  }
  function renderDots({ g, lit }, t, o, until) {
    place(g, { o });
    lit.forEach(({ dot, at }) => {
      const on = t < until ? ease.out(P(t, at, at + 0.2)) : 0;
      dot.setAttribute('opacity', n3(lerp(0.28, 1, on)));
      dot.setAttribute('r', n3(10 + 2 * on + 6 * (t < until ? bump(t, at, 0.32) : 0)));
    });
  }

  function buildShell(root) {
    const defs = el(root, 'defs');
    const lift = el(defs, 'filter', { id: 'lift', x: '-5%', y: '-5%', width: '110%', height: '115%' });
    el(lift, 'feDropShadow', { dx: 0, dy: 14, stdDeviation: 17, 'flood-color': '#25295a', 'flood-opacity': 0.12 });
    return el(root, 'rect', {
      x: CARD.x,
      y: CARD.y,
      width: CARD.w,
      height: CARD.h,
      rx: CARD.r,
      fill: C.card,
      stroke: C.hair,
      'stroke-width': 1.5,
      filter: 'url(#lift)',
    });
  }
  const buildComment = (root) => icon(root, ICON.comment, 1416, 862, 62, C.footer);
  const buildCardLock = (root) => icon(root, ICON.lockOpen, 1520, 862, 62, C.footer);

  // "14 / 99 credits". The total is right-aligned so the rest never shifts.
  function buildCredits(root) {
    const g = group(root);
    const total = text(g, 406, 910, 50, 600, C.ink, '0', 'end');
    text(g, 420, 910, 50, 500, C.ink2, '/ 99 credits');
    return { g, total };
  }

  function buildSlider(parent, { x0, x1, y, low, high, lowX, highX, h = 20, knob = 34, suffix = '', tag = 120 }) {
    text(parent, lowX, y + 20, 56, 500, C.ink2, low, 'middle');
    text(parent, highX, y + 20, 56, 500, C.ink2, high, 'middle');
    el(parent, 'rect', { x: x0, y: y - h / 2, width: x1 - x0, height: h, rx: h / 2, fill: C.hair });
    const fill = el(parent, 'path', { fill: C.teal });
    const bubble = group(parent);
    el(bubble, 'rect', { x: -tag / 2, y: y - 154, width: tag, height: 92, rx: 16, fill: C.teal });
    el(bubble, 'path', { d: `M-16 ${y - 63}L0 ${y - 46}L16 ${y - 63}Z`, fill: C.teal });
    const value = set(text(bubble, 0, y - 88, 58, 600, C.card, '0', 'middle'), { 'data-value': 1 });
    const handle = el(parent, 'circle', { cy: y, r: knob, fill: C.card, stroke: C.teal, 'stroke-width': 7 });
    return { x0, x1, y, h, knob, suffix, fill, bubble, value, handle };
  }
  // `at` is the position along the track (0 to 1) and `shown` the number on the tag.
  function renderSlider(slider, at, shown, press) {
    const { x0, x1, y, h, knob, suffix } = slider;
    const x = lerp(x0, x1, at);
    slider.fill.setAttribute('d', rrect(x0, y - h / 2, Math.max(x - x0, h), h, h / 2));
    place(slider.bubble, { x });
    slider.value.textContent = `${Math.round(shown)}${suffix}`;
    slider.handle.setAttribute('cx', n3(x));
    slider.handle.setAttribute('r', n3(knob + 4 * press));
  }

  // Quadratic allocation: every credit spend, in order, as { row, n, at }. Cost is
  // the square of the allocation, so the total always equals the squares on screen.
  const quadSteps = (start, gap) =>
    [
      [0, 1],
      [0, 2],
      [0, 3],
      [1, 1],
      [1, 2],
      [2, 1],
    ].map(([row, n], i) => ({ row, n, at: start + i * gap }));
  function quadAt(steps, t) {
    const landed = steps.filter((step) => t >= step.at);
    const alloc = [0, 1, 2].map((row) => landed.filter((step) => step.row === row).length);
    return { alloc, total: alloc.reduce((sum, n) => sum + n * n, 0) };
  }
  function buildQuadRows(parent, labels) {
    const ring = (host, x, y, ink, tint) =>
      el(host, 'circle', { cx: x, cy: y, r: 44, fill: tint, stroke: ink, 'stroke-width': 4 });
    const glyph = (ink) => ({ stroke: ink, 'stroke-width': 6, 'stroke-linecap': 'round', fill: 'none' });
    return labels.map((label, i) => {
      const y = ROWS.y[i] + ROWS.h / 2;
      const size = 3 - i;
      const row = optionRow(parent, ROWS.y[i]);
      text(parent, 380, y + 20, 56, 500, C.ink, label);
      ring(parent, 930, y, C.neg, C.negTint);
      el(parent, 'path', { d: `M912 ${y}H948`, ...glyph(C.neg) });
      const value = set(text(parent, 1065, y + 21, 60, 700, C.ink, '0', 'middle'), { 'data-alloc': 1 });
      const plus = group(parent);
      const plusFace = ring(plus, 1200, y, C.pos, C.posTint);
      el(plus, 'path', { d: `M1182 ${y}H1218M1200 ${y - 18}V${y + 18}`, ...glyph(C.pos) });
      el(parent, 'rect', { x: QUAD.tileX, y: y - QUAD.tile / 2, width: QUAD.tile, height: QUAD.tile, rx: 12, fill: C.tile });
      const cells = [];
      for (let r = 0; r < size; r += 1) {
        for (let col = 0; col < size; col += 1) {
          cells.push({ r, col, node: el(parent, 'rect', { rx: 5, fill: C.pos, 'data-credit': 1 }) });
        }
      }
      return { row, value, plus, plusFace, cells, y };
    });
  }
  function renderQuadRows(rows, allSteps, t) {
    const { alloc } = quadAt(allSteps, t);
    rows.forEach((row, i) => {
      const n = alloc[i];
      const steps = allSteps.filter((step) => step.row === i);
      const last = steps[n - 1];
      row.value.textContent = n;
      lightRow(row.row, ease.out(P(t, steps[0].at, steps[0].at + 0.2)));
      // The grid stays centred in its tile, easing wider as each allocation lands.
      const span = n === 0 ? 1 : lerp(Math.max(n - 1, 1), n, ease.out(P(t, last.at, last.at + 0.16)));
      const midX = QUAD.tileX + QUAD.tile / 2;
      row.cells.forEach(({ r, col, node }) => {
        const need = Math.max(r, col);
        const landed = steps[need] && t >= steps[need].at;
        if (!landed) return void node.setAttribute('display', 'none');
        const delay = (r + col) * 0.008;
        const pop = ease.back(P(t, steps[need].at + delay, steps[need].at + delay + 0.14));
        const size = QUAD.cell * Math.max(pop, 0.01);
        const cx = midX + (col - (span - 1) / 2) * QUAD.pitch;
        const cy = row.y + (r - (span - 1) / 2) * QUAD.pitch;
        set(node, { display: 'inline', x: n3(cx - size / 2), y: n3(cy - size / 2), width: n3(size), height: n3(size) });
      });
      const press = steps.reduce((m, step) => Math.max(m, bump(t, step.at - 0.02, 0.18)), 0);
      row.plusFace.setAttribute('fill', mixColor(C.posTint, C.posPress, press));
      place(row.plus, { s: 1 + 0.1 * press, cx: 1200, cy: row.y });
    });
  }

  // The Opinion Map: a ring holding three groups, each with its members.
  function buildOpinionMap(root, { x: cx, y: cy, r, inner, orbit }, withMembers = true) {
    const k = inner / 92;
    const members = [
      [[-21, -28, 31], [35, -35, 12], [28, 19, 30], [-31, 31, 20]],
      [[-24, -31, 33], [33, -37, 12], [33, 17, 27], [-23, 40, 23]],
      [[17, -41, 24], [-30, 20, 33], [42, 12, 23]],
    ];
    const map = { g: group(root), groups: [], cx, cy };
    map.ring = stroke(map.g, 'circle', {
      cx,
      cy,
      r,
      stroke: C.answers[3],
      'stroke-width': 9,
      transform: `rotate(-90 ${cx} ${cy})`,
    });
    [-90, 150, 30].forEach((deg, i) => {
      const a = (deg * Math.PI) / 180;
      const x = cx + orbit * Math.cos(a);
      const y = cy + orbit * Math.sin(a);
      const g = group(map.g);
      el(g, 'circle', { cx: x, cy: y, r: inner, fill: C.card, stroke: C.answers[i], 'stroke-width': 7 });
      const pops = (withMembers ? members[i] : []).map(([dx, dy, size]) => ({
        node: el(g, 'circle', { cx: x + dx * k, cy: y + dy * k, r: size * k, fill: C.answers[i] }),
        x: x + dx * k,
        y: y + dy * k,
      }));
      map.groups.push({ g, x, y, pops });
    });
    return map;
  }
  // The ring draws, the groups settle into it, the members pop in. `a` is the scene start.
  function renderOpinionMap(map, t, a, o) {
    place(map.g, { o });
    draw(map.ring, ease.out(P(t, a - 0.1, a + 0.56)));
    map.groups.forEach(({ g, x, y, pops }, i) => {
      const at = a - 0.06 + i * 0.1;
      const settle = ease.back(P(t, at, at + 0.5));
      place(g, {
        o: P(t, at, at + 0.14),
        x: lerp((map.cx - x) * 0.5, 0, settle),
        y: lerp((map.cy - y) * 0.5, 0, settle),
        s: lerp(0.68, 1, settle),
        cx: x,
        cy: y,
      });
      pops.forEach((dot, k) => {
        const dotAt = at + 0.3 + k * 0.07;
        place(dot.node, { s: Math.max(ease.back(P(t, dotAt, dotAt + 0.24)), 0.001), cx: dot.x, cy: dot.y });
      });
    });
  }

  // A stacked agree / unsure / disagree bar. `shares` are fractions of width `w`.
  const buildBar = (root) => [0, 1, 2].map((i) => el(root, 'path', { fill: C.stance[i] }));
  function setBar(paths, x, y, w, h, r, shares) {
    let at = x;
    paths.forEach((path, i) => {
      const share = shares[i] * w;
      const left = i === 0 ? Math.min(r, share / 2) : 0;
      const right = i === 2 ? Math.min(r, share / 2) : 0;
      path.setAttribute('d', rrect(at, y, share + (i < 2 ? 1 : 0), h, left, right, right, left));
      at += share;
    });
  }

  // A large lock whose shackle closes. The icon spans cy - 92 to cy + 86.
  function buildLock(root, cx, cy, color = C.teal) {
    return {
      shackle: el(root, 'path', {
        d: `M${cx - 37} ${cy - 12}V${cy - 45}A37 37 0 0 1 ${cx + 37} ${cy - 45}V${cy - 12}`,
        fill: 'none',
        stroke: color,
        'stroke-width': 20,
      }),
      body: el(root, 'rect', { x: cx - 69, y: cy - 20, width: 138, height: 106, rx: 22, fill: color }),
      cx,
      cy: cy + 33,
    };
  }
  function renderLock(lock, close, pulse) {
    place(lock.shackle, { y: (1 - close) * -24 });
    place(lock.body, { s: 1 + 0.03 * pulse, cx: lock.cx, cy: lock.cy });
  }

  // A labelled time axis whose marker moves through `labels`; `at` runs 0 to labels.length - 1.
  function buildTimeline(root, x0, x1, y, labels) {
    const g = group(root);
    el(g, 'rect', { x: x0, y: y - 3, width: x1 - x0, height: 6, rx: 3, fill: C.hair2 });
    const tickX = (i) => lerp(x0, x1, i / (labels.length - 1));
    labels.forEach((label, i) => {
      el(g, 'circle', { cx: tickX(i), cy: y, r: 9, fill: C.hair2 });
      const anchor = i === 0 ? 'start' : i === labels.length - 1 ? 'end' : 'middle';
      text(g, tickX(i) + (i === 0 ? -9 : i === labels.length - 1 ? 9 : 0), y + 54, 38, 500, C.ink2, label, anchor);
    });
    const fill = el(g, 'rect', { x: x0, y: y - 3, height: 6, rx: 3, fill: C.teal });
    const marker = el(g, 'circle', { cy: y, r: 15, fill: C.teal });
    return { g, x0, x1, fill, marker, last: labels.length - 1 };
  }
  function renderTimeline(line, at, o) {
    place(line.g, { o });
    const x = lerp(line.x0, line.x1, at / line.last);
    line.fill.setAttribute('width', n3(x - line.x0));
    line.marker.setAttribute('cx', n3(x));
  }

  // -------------------------------------------------------------------------
  // The section heading: one badge, with one word at a time at exactly 0.5 opacity
  // -------------------------------------------------------------------------
  function buildHeading(root, steps) {
    const x = 306;
    const y = 116;
    el(root, 'circle', { cx: x, cy: y, r: 46, fill: 'none', stroke: C.teal, 'stroke-width': 6 });
    return steps.map(([name, glyph, start]) => ({
      start,
      glyph: icon(root, glyph, x - 33, y - 33, 66, C.teal),
      word: set(text(root, 376, y + 26, 74, 600, C.ink, name), { 'data-heading': 1 }),
    }));
  }
  function renderHeading(words, t) {
    words.forEach(({ start, glyph, word }, i) => {
      const next = words[(i + 1) % words.length].start;
      const here = P(t, start, start + 0.16);
      const gone = 1 - P(t, next - 0.16, next - 0.02);
      // Stacked words in one spot would collide, so one leaves before the next arrives.
      const o = start > next ? Math.max(gone, here) : Math.min(here, gone);
      place(word, { o: 0.5 * o });
      place(glyph, { o });
    });
  }

  // -------------------------------------------------------------------------
  // Boot, viewer, capture API
  // -------------------------------------------------------------------------
  const params = new URLSearchParams(window.location.search);
  const CAPTURE = params.has('capture');
  const filmName = params.get('film') || 'readme';
  let resolveReady;
  window.motion = { ready: new Promise((resolve) => (resolveReady = resolve)) };

  // A film registers itself: { duration, beats, headings, colors, seek, build, render, verify }.
  function film(def) {
    const { duration } = def;
    let headingWords;
    let playing = false;
    let now = Number(params.get('t')) || 0;
    let lastTick = 0;

    function renderAtTime(seconds) {
      const t = ((seconds % duration) + duration) % duration;
      renderHeading(headingWords, t);
      return { t, ...def.render(t) };
    }

    function showTime(t) {
      now = t;
      renderAtTime(t);
      document.getElementById('scrubber').value = t;
      document.getElementById('timecode').textContent = `${t.toFixed(2)} / ${duration} s`;
    }
    function tick(stamp) {
      if (!playing) return;
      showTime((now + (stamp - lastTick) / 1000) % duration);
      lastTick = stamp;
      requestAnimationFrame(tick);
    }
    function setPlaying(next) {
      playing = next;
      document.getElementById('toggle').textContent = next ? 'Pause' : 'Play';
      if (next) {
        lastTick = performance.now();
        requestAnimationFrame(tick);
      }
    }
    function wireViewer() {
      const scrubber = document.getElementById('scrubber');
      scrubber.max = duration;
      scrubber.addEventListener('input', () => {
        setPlaying(false);
        showTime(Number(scrubber.value));
      });
      document.getElementById('toggle').addEventListener('click', () => setPlaying(!playing));
      window.addEventListener('keydown', (event) => {
        if (event.code !== 'Space' || event.target === scrubber) return;
        event.preventDefault();
        setPlaying(!playing);
      });
    }

    async function boot() {
      document.body.classList.toggle('capture', CAPTURE);
      await Promise.all([400, 500, 600, 700].map((weight) => document.fonts.load(`${weight} 60px Poppins`)));
      await document.fonts.ready;
      const root = document.getElementById('stage');
      set(root, { viewBox: `0 0 ${W} ${H}` });
      def.build(root);
      headingWords = buildHeading(root, def.headings);
      renderAtTime(now);
      if (CAPTURE) return;
      wireViewer();
      showTime(now);
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!params.has('t') && !params.has('paused') && !reduceMotion) setPlaying(true);
    }

    // For capture tools: render t, then rebuild the stage's rendering from scratch,
    // so a frame is identical however it is reached.
    async function capture(t) {
      const out = renderAtTime(t);
      const root = document.getElementById('stage');
      const painted = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      root.style.display = 'none';
      await painted();
      root.style.display = '';
      await painted();
      return out;
    }

    Object.assign(window.motion, {
      name: filmName,
      duration,
      fps: FPS,
      width: W,
      height: H,
      beats: def.beats,
      seek: def.seek,
      // A moment in each heading's span when it should be fully at rest.
      headingRest: def.headings.map(([, , start], i) => {
        const next = def.headings[(i + 1) % def.headings.length][2];
        return start > next ? (next - 0.16) / 2 : (start + next) / 2;
      }),
      // Every solid colour in the design, for the GIF palette.
      colors: [...new Set([...Object.values(C).flat(), ...(def.colors || [])])],
      verify: def.verify || (() => []),
      renderAtTime,
      capture,
    });
    boot().then(resolveReady);
  }

  window.Kit = {
    W,
    H,
    C,
    ICON,
    CARD,
    QUESTION,
    ROWS,
    clamp,
    lerp,
    P,
    ease,
    bump,
    mixColor,
    n3,
    rrect,
    set,
    el,
    group,
    text,
    icon,
    stroke,
    draw,
    place,
    beat,
    shellAt,
    questionText,
    optionRow,
    lightRow,
    buildCheckRows,
    renderCheckRows,
    buildDots,
    renderDots,
    buildShell,
    buildComment,
    buildCardLock,
    buildCredits,
    buildSlider,
    renderSlider,
    quadSteps,
    quadAt,
    buildQuadRows,
    renderQuadRows,
    buildOpinionMap,
    renderOpinionMap,
    buildBar,
    setBar,
    buildLock,
    renderLock,
    buildTimeline,
    renderTimeline,
    film,
  };

  if (!/^[a-z-]+$/.test(filmName)) throw new Error(`bad film name: ${filmName}`);
  const script = document.createElement('script');
  script.src = `films/${filmName}.js`;
  document.head.appendChild(script);
})();
