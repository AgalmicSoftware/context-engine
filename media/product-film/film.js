/*
  Context Engine — product film (12.5 s, graphics-first)
  ---------------------------------------------------------------------------
  One deterministic timeline drives every frame. renderAtTime(seconds) sets
  the whole composition from scratch for that instant, so playback, seeking,
  scrubbing and offline frame capture all produce identical frames.

  Words appear only on the brand card that opens and closes the loop, plus
  the "Question" and "Results" headings. Every other beat is told with product
  shapes, icons, colour and motion, so it still reads at link-preview size.
  The film is light, following the site's Minimal theme, and uses the vector
  Context Engine logo.

  - No Math.random, Date or CSS animation: layouts use a seeded PRNG.
  - Fonts are self-hosted and awaited before the first frame (film.ready).
  - ?capture=1 renders only the 1920x1080 stage at 1:1 (used by render/).
  - ?poster=1 renders the 1200x630 og:image composition.
  - ?t=7.5 opens paused at a given time.

  Copy and the illustrative dataset live in COPY / ANSWERS / GROUPS below.
*/
(function () {
  'use strict';

  const W = 1920;
  const H = 1080;
  const FPS = 30;
  const DURATION = 14.1;

  // -------------------------------------------------------------------------
  // Utilities
  // -------------------------------------------------------------------------
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, p) => a + (b - a) * p;
  const P = (t, a, b) => clamp((t - a) / (b - a));
  const ease = {
    out: (p) => 1 - Math.pow(1 - p, 3),
    in: (p) => p * p * p,
    inOut: (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
    inOut2: (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2),
    back: (p) => {
      const c1 = 1.4;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
    },
  };
  // Fade in over [a,b]; optional fade out over [c,d].
  const win = (t, a, b, c, d) => {
    const i = ease.out(P(t, a, b));
    if (c === undefined) return i;
    return Math.min(i, 1 - ease.inOut2(P(t, c, d)));
  };
  const mix = (A, B, p) => ({ x: lerp(A.x, B.x, p), y: lerp(A.y, B.y, p) });
  // A short "pulse" bump: 0 -> 1 -> 0 over [a, a+len].
  const bump = (t, a, len) => Math.sin(Math.PI * P(t, a, a + len));

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function mixColor(a, b, p) {
    const A = hexToRgb(a);
    const B = hexToRgb(b);
    const c = A.map((v, i) => Math.round(lerp(v, B[i], clamp(p))));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }

  const SVGNS = 'http://www.w3.org/2000/svg';
  function mk(tag, cls, parent, html) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (html !== undefined) el.innerHTML = html;
    if (parent) parent.appendChild(el);
    return el;
  }
  function sv(tag, attrs, parent) {
    const el = document.createElementNS(SVGNS, tag);
    if (attrs) for (const k in attrs) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  }
  // Invisible elements are taken out of rendering with display: none rather than
  // visibility: hidden, which keeps Chrome from giving each of them a compositor
  // layer. (film.capture() below makes captured frames independent of history.)
  function hideEl(el, hide) {
    if (hide === (el.__hidden === true)) return;
    if (hide) {
      el.__display = el.style.display;
      el.style.display = 'none';
    } else {
      el.style.display = el.__display || '';
    }
    el.__hidden = hide;
  }
  function setO(el, o) {
    const v = clamp(o);
    el.style.opacity = v.toFixed(3);
    hideEl(el, v <= 0.002);
  }
  function put(el, x, y, o = 1, s = 1) {
    el.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${s.toFixed(4)})`;
    setO(el, o);
  }
  function svgO(el, o) {
    const v = clamp(o);
    el.setAttribute('opacity', v.toFixed(3));
    hideEl(el, v <= 0.002);
  }
  function box(parent, x, y, w, h, style = {}) {
    const el = mk('div', 'abs', parent);
    Object.assign(el.style, { width: `${w}px`, height: `${h}px`, ...style });
    put(el, x, y);
    return el;
  }
  // A rounded "line of text" placeholder: the film shows writing, not words.
  function bar(parent, x, y, w, h = 22, color = 'rgba(223,225,241,0.85)') {
    return box(parent, x, y, w, h, { borderRadius: `${h / 2}px`, background: color, transformOrigin: '0 50%' });
  }
  function icon(parent, svg, x, y, size, color) {
    const el = mk('div', 'abs', parent, svg);
    Object.assign(el.style, { width: `${size}px`, height: `${size}px`, color });
    put(el, x, y);
    return el;
  }

  // -------------------------------------------------------------------------
  // Copy and illustrative data
  // -------------------------------------------------------------------------
  const COPY = {
    brand: 'Context Engine',
    tag: ['Discourse and Decision Tools', 'For Humans and Agents'],
    question: 'Question',
    results: 'Results',
  };

  // Light palette. Neutrals follow the site's Minimal theme; product surfaces
  // are simplified versions of the question card and report.
  const TH = {
    bg: '#f7f6f2',
    ink: '#202b3a', // titles and "written" lines (Minimal theme text)
    ink2: '#526174', // Minimal theme muted text
    line: 'rgba(32,43,58,.78)', // a line of text, drawn as a bar
    lineSoft: 'rgba(32,43,58,.34)',
    onFill: 'rgba(255,255,255,.92)', // a line of text on a coloured fill
    hair: 'rgba(32,43,58,.1)',
    hair2: 'rgba(32,43,58,.18)',
    tint: 'rgba(32,43,58,.045)',
    axis: '#68788c', // Minimal theme strong border
    card: '#ffffff',
    panel: '#f3f4f9',
    teal: '#0b9aa8',
    tealTint: 'rgba(11,154,168,.12)',
    select: '#2fb36b',
    robot: '#119c62',
    rec: '#e5394a',
    wave: '#c0369f',
    submit: '#2a63ca',
    footer: '#b8bbcd',
    amber: '#e0951b',
    shadow: '0 1px 2px rgba(37,41,90,.06), 0 8px 20px rgba(37,41,90,.1)',
  };

  // One colour per answer to the session's main question, used everywhere.
  const ANSWERS = [
    { key: 'privacy', color: '#0fa3b5' },
    { key: 'training', color: '#eea01f' },
    { key: 'jobs', color: '#ea573f' },
    { key: 'speed', color: '#6c60e6' },
  ];
  const STANCE = ['#2e9d4a', '#f0c419', '#e0453a']; // agree / unsure / disagree
  const QUAD_INK = { pos: '#1f9d55', neg: '#e0453a' }; // support / oppose
  // 48 participants in three opinion groups; pri = counts per answer, q3 = stance
  // on one representative statement. Totals: 17 / 14 / 11 / 6 and 27 / 9 / 12.
  const GROUPS = [
    { n: 19, pri: [13, 4, 1, 1], q3: [9, 4, 6], c: { x: -150, y: -178 }, rx: 245, ry: 92, rot: -5 },
    { n: 16, pri: [1, 6, 9, 0], q3: [14, 1, 1], c: { x: 268, y: 22 }, rx: 150, ry: 118, rot: -18 },
    { n: 13, pri: [3, 4, 1, 5], q3: [4, 4, 5], c: { x: -185, y: 168 }, rx: 172, ry: 104, rot: 8 },
  ];

  // The question card is laid out at 1000x624 and drawn 1.4x larger, centred,
  // so it fills most of the frame.
  const CARD = { w: 1000, h: 624, s: 1.4, cx: 960, cy: 540 };
  CARD.x = CARD.cx - CARD.w / 2;
  CARD.y = CARD.cy - CARD.h / 2;
  CARD.top = CARD.cy - (CARD.h * CARD.s) / 2;
  CARD.bottom = CARD.cy + (CARD.h * CARD.s) / 2;
  const cardPt = (lx, ly) => ({ x: CARD.cx + (lx - CARD.w / 2) * CARD.s, y: CARD.cy + (ly - CARD.h / 2) * CARD.s });

  // The Context Engine mark: the single-path vector logo every theme uses
  // (client/src/assets/img/context_engine_logo.svg on dev), drawn in ink like
  // the Minimal theme. Coordinates are in that SVG's user units.
  const LOGO = {
    box: { x: 99, y: 121, w: 991, h: 1046 },
    content: { x: 119.1, y: 140.8, w: 951.1, h: 1005.6 },
    center: { x: 639.2, y: 653.3 }, // roughly the centre of the C's arcs
    ink: '#202b3a',
    // The 48 round pads at the ends of the circuit traces: [x, y, r]. At rest,
    // each participant is one of them.
    pads: [
      [824.7, 221.8, 9.0], [825.2, 185.8, 9.5], [828.7, 521.3, 10.9], [850.2, 552.8, 10.4], [853.7, 155.8, 10.2], [863.2, 250.8, 7.4],
      [873.2, 463.8, 9.6], [873.7, 527.3, 9.5], [904.7, 526.8, 9.9], [907.7, 163.8, 9.0], [924.2, 252.3, 11.0], [933.2, 464.8, 10.2],
      [935.2, 527.3, 9.4], [963.2, 431.3, 9.7], [965.2, 223.8, 11.0], [967.7, 297.8, 9.3], [968.7, 527.3, 10.2], [972.2, 259.3, 11.2],
      [1005.7, 406.8, 10.3], [1013.2, 552.3, 10.1], [1026.7, 318.3, 11.0], [1026.7, 464.8, 10.2], [1028.2, 434.8, 7.9], [1057.2, 338.8, 11.3],
      [1059.2, 379.3, 10.5], [1059.2, 434.8, 11.5], [825.7, 1080.9, 9.9], [847.7, 799.9, 9.7], [848.7, 757.4, 11.0], [850.2, 1119.4, 10.2],
      [856.7, 1024.9, 10.2], [874.2, 781.9, 9.5], [874.2, 872.9, 10.2], [903.2, 816.4, 9.5], [923.2, 1028.4, 10.5], [932.7, 782.4, 10.1],
      [943.2, 1096.9, 10.0], [961.2, 842.9, 9.5], [963.2, 1043.4, 10.3], [964.2, 781.9, 10.2], [1001.2, 843.4, 9.9], [1004.7, 758.4, 10.4],
      [1024.7, 986.4, 10.4], [1025.7, 816.9, 10.2], [1025.7, 897.4, 9.7], [1054.2, 927.4, 11.6], [1056.7, 976.9, 11.5], [1057.2, 873.4, 10.6],
    ],
    d: 'M661 1145c-4-5-2-13 4-14 5-2 10 2 10 8 0 4-4 8-8 8-2 0-4-1-6-2m31 0c-3-1-5-5-5-8 0-6 8-10 13-7 1 2 12 2 71 2h69v7h-68l-68 1-3 2q-1.5 3-3 3h-2c-1 1-2 0-4 0m-86-4c-79-4-150-23-221-60-80-41-147-103-195-177a455 455 0 0 1-64-324c13-83 46-157 98-225 36-48 94-100 146-132 7-4 13-8 15-9 6-4 34-19 47-25 64-29 133-44 200-44h16v7h-6c-4 1-12 1-20 1-27 0-70 6-104 15-38 9-81 26-118 46-46 26-82 53-120 91-35 34-56 60-79 97-26 42-41 77-55 125-7 22-9 32-13 56-5 33-6 37-5 75 0 33 0 38 2 57 13 100 57 189 128 263 27 27 54 49 88 72 28 19 73 41 106 52 60 21 107 30 169 32h27v4c0 3 0 3-6 3-7 1-13 1-36 0m241-9c-3-2-6-6-6-9 0-1-11-1-68-1h-69l-3 2c-8 7-18-2-12-10 3-4 9-4 12-1 2 2 4 2 72 2 38 0 69 0 69-1 0-2 4-6 7-6 3-1 8 1 10 4 6 11-3 25-12 20m-185-6c-5-4-3-14 3-14 4 0 6 0 8 3 2 2 2 3 2 6-1 7-8 9-13 5m220-24c-10-12-19-24-21-27-2-2-8-9-14-16l-10-12h-66c-64 0-67 0-69 2s-5 4-7 4c-1 0-3-1-5-3-4-3-4-8 0-11 3-3 4-3 6-3 2 1 4 2 5 3s8 1 70 2h69l3 3c2 2 17 20 33 40 29 36 29 36 27 38l-2 2s-9-10-19-22m-262 20c-131-4-251-55-342-143-65-62-107-137-127-222-12-50-14-113-6-166 4-29 12-64 22-91 32-90 89-165 172-230 22-18 49-35 74-48 70-37 136-54 214-57h21v8h-11c-42 0-89 7-131 19-95 28-184 88-252 170-41 49-75 116-91 179-12 46-17 94-15 137a432 432 0 0 0 164 321c49 41 109 74 171 93 43 13 94 21 139 23 26 0 26 0 26 4 0 3 0 3-5 3-3 1-8 1-11 1s-8-1-12-1m320-13c-4-2-7-7-7-13l1-4-26-32-26-32h-8c-7 0-8 0-8 2 0 0-1 3-3 5-2 3-3 3-6 3-5 0-8-3-10-8-1-3-1-5 0-7 0-4 0-4-3-8l-4-5h-68c-66 0-68 0-70 2-1 1-3 2-4 3-8 3-15-8-9-14 3-3 8-3 11 0 3 2 4 2 72 2h69l5 6c4 5 5 5 8 5 4-1 8 1 10 4 2 2 3 3 4 3s2 0 2-1c0 0-6-7-12-15l-12-14H704l-2 2c-4 4-8 5-11 2-5-4-5-11 0-13 4-3 6-2 9 0s4 2 76 2h72l16 18 15 19h13c8 0 14 0 14-1 0 0-9-11-19-24l-20-24h-81c-81 0-82 0-84 2-1 1-3 2-5 3-8 3-14-7-7-13 3-4 7-4 10-1 3 2 4 2 107 2h103l24 31c14 17 25 32 25 33s0 2 3 1c13-1 16 22 4 26-3 1-4 1-7-1-5-3-7-11-5-18 2-3 2-3 0-6-2-2-12-16-25-31l-22-28h-32l20 25 20 25 2-2c4-4 11-4 15 1 2 3 3 8 2 13 0 2 0 4 16 23 9 12 16 21 16 22 0 0-1 2-2 3s-1 1-18-19c-15-19-17-21-18-20-6 4-15-3-15-12v-3h-23l23 30c18 21 25 29 25 28 4-3 12-1 14 5 3 7 1 14-5 17-4 2-4 2-7 1m-278-2c-5-4-3-14 3-14 4 0 6 0 8 3 6 7-3 17-11 11m28-1c-5-5-4-11 2-13 4-1 8 0 10 2 1 2 8 2 67 2h65v7H704l-3 2c-4 4-7 4-11 0m-76-3c-56-3-114-15-164-35-29-12-72-35-98-53-41-28-82-68-113-110-18-25-37-59-48-87-16-38-25-76-29-114-2-19-2-79 0-96 8-57 22-105 48-156 32-63 82-122 144-169 19-14 24-18 45-30 72-42 152-66 227-67 23 0 22-1 22 3v4l-24 1c-38 2-59 5-90 12-113 27-218 100-286 197-23 33-44 75-57 114-33 100-31 201 6 295 4 13 19 43 27 56 22 37 61 84 94 112 30 25 71 52 102 67 68 31 132 47 206 49h22v7h-6c-4 1-8 1-9 1-2 0-10-1-19-1m208-10c-1-1-3-4-4-5l-2-4H703l-1 2c-2 4-7 5-11 3-5-3-6-9-1-13 3-3 4-3 6-3 2 1 4 2 5 3s10 1 59 1h56l3-4c2-2 3-3 6-4 4 0 4 0 7 3 4 5 5 9 3 14-1 3-2 5-4 6-4 2-5 2-9 1m-161-5c-5-5-2-14 6-14 7 0 11 8 6 14q-6 4.5-12 0m-52-4c-23-2-48-5-72-10-52-11-109-33-153-61-55-34-99-76-135-129-13-17-31-50-39-69-12-30-21-63-26-96-4-24-4-37-4-68 1-30 3-50 8-73 14-71 43-136 86-190 84-105 203-170 334-181 6-1 18-1 26-1h14v8h-13c-43 0-92 9-135 23-70 24-127 59-179 111-58 56-95 120-117 196-30 105-18 219 34 308 7 13 16 27 20 32 22 30 32 42 53 63 33 32 64 54 108 77 9 5 17 9 40 18 10 5 36 14 49 17 40 11 76 17 118 18l22 1v7h-14c-7 0-19-1-25-1m54-13c-7-4-5-16 4-16 8 0 11 12 3 16-3 1-3 1-7 0m26-2c-5-5-1-14 6-14 2 0 4 1 5 1 1 2 11 2 68 2h66v7h-65l-65 1-3 2c-3 4-8 4-12 1m-87-5c-42-3-85-12-122-26-30-10-70-30-98-49-79-53-137-128-164-213-12-35-18-76-18-115 0-45 6-82 20-127 14-44 33-83 60-121 36-50 92-100 145-129 63-35 127-54 197-57 11-1 22-1 24 0 2 0 2 1 2 3v4h-18c-65 3-119 17-179 45-31 15-60 34-91 59-11 9-46 45-56 56-16 19-33 44-42 62-3 5-7 12-9 16-15 28-29 69-37 108-19 89-6 181 37 258 32 60 79 109 137 148 38 24 83 44 128 56 35 10 69 15 113 17h17v7h-15c-9 0-23-1-31-2m59-13c-5-6-1-15 7-15 2 0 7 6 7 9 0 7-9 10-14 6m-58-5c-35-3-75-11-107-22-62-21-120-57-165-101-20-20-35-39-48-59s-18-27-28-49c-23-47-34-93-35-149-1-48 5-83 20-131 20-61 57-120 105-166 22-22 35-32 61-49a418 418 0 0 1 229-73h13v7h-6c-4 1-10 1-15 1-26 0-68 7-101 16-51 15-106 44-147 77-63 52-107 116-132 191-22 67-26 133-10 201 19 89 76 169 156 224 68 47 150 73 231 76 24 0 24 0 24 4v3h-18c-10 0-22-1-27-1m370-25c-15-20-15-20-14-22l2-2c2 0 31 37 31 39 0 1-2 4-3 4 0 0-7-9-16-19m-310 13-3-3c-2-6 1-13 6-13 7 0 12 8 7 13-3 4-6 4-10 3m26-2c-3-4-3-8 1-12 2-2 4-3 4-3 3 0 8 3 8 4s26 1 70 1h69v7H704l-3 3q-6 4.5-12 0m-81-4c-65-5-129-25-184-58-50-30-93-69-124-115-23-33-40-72-50-112-4-13-6-26-8-44-2-17-2-23-2-47 1-29 2-41 7-64 8-45 28-93 52-132 31-48 70-88 119-121 61-41 137-65 211-68h19v3c0 5-1 5-15 5-6 0-18 1-27 2-68 6-129 28-187 67-67 44-119 110-148 186q-34.5 94.5-18 192c8 43 25 86 50 124 47 71 117 124 202 153 40 14 73 20 119 22l24 1v7h-14c-8 0-20-1-26-1m362-37-30-38H704l-2 2c-4 4-8 5-12 1-4-3-4-7-1-11 4-4 9-4 12-1 1 2 3 2 145 2h144l13 17 14 17 2-2c5-5 12-3 15 3 4 9-1 21-10 20-4-1-8-6-9-11 0-4-2-6-14-21l-14-16h-19c-10 0-19 0-19 1 0 0 13 16 28 35l27 35-2 2-1 2zm-309 22c-4-5-1-13 6-13 6 0 10 6 7 12-3 5-10 6-13 1m-55-4c-55-5-101-18-147-42-30-15-52-29-76-49-13-11-40-39-50-51-49-61-74-133-73-210 0-72 25-148 68-209 27-37 66-75 102-97 19-12 24-15 43-25 37-17 73-29 111-34 15-3 43-5 54-5h10v8h-10c-30 0-68 6-99 14-67 19-132 59-176 108-21 24-35 44-49 69-34 60-51 131-46 192 5 68 26 124 65 177 24 32 64 68 99 89 62 37 126 56 196 59l20 1v6h-19c-11 0-21 0-23-1m56-14c-6-4-2-14 5-14 3 0 5 2 7 5s1 5-1 8c-3 4-8 4-11 1m-48-4c-22-1-41-4-62-10-82-19-156-65-207-130-27-34-48-79-57-121-6-26-8-45-8-71 0-58 15-115 43-165 17-30 38-57 61-81 32-31 63-53 102-71 45-21 92-32 145-35h17v8h-9c-33 0-79 7-110 18-106 36-186 113-222 217-14 38-19 70-19 110 0 58 15 111 46 162 22 36 62 76 101 101 25 16 43 26 69 36 41 16 80 23 128 26h16v7h-15c-8 0-16 0-19-1m438-1c-3-2-6-7-6-10 0-2-1-4-4-7-2-2-11-12-20-21l-15-18H855c-135 0-152 0-153 2s-6 4-9 3c-3 0-6-5-6-8 0-1 1-3 3-5 3-4 7-4 10-1 3 2 4 2 156 2h153l11 12c6 7 14 16 19 21l8 10 2-3c3-3 10-4 14-2 9 7 6 26-5 27-2 0-5 0-6-2m-390-13c-2-2-4-7-3-9 2-6 9-8 14-4 5 6 1 14-6 14-2 0-4-1-5-1m-56-5c-23-2-55-9-76-16-49-16-86-37-126-71-51-43-88-106-99-169-4-25-4-32-4-58 0-21 0-28 2-41 7-51 25-96 54-139 23-36 49-62 85-88 46-32 100-53 158-60 10-1 36-3 43-2 5 0 5 0 5 3v4h-17c-68 3-124 21-179 58-25 16-55 43-73 66-39 48-65 114-70 174-2 17-1 53 1 67 8 50 24 89 54 130 28 40 69 74 118 99 24 11 42 18 74 27 19 5 48 9 74 10h18v7h-17c-9 0-21-1-25-1m57-13c-5-2-6-10-2-14 5-4 13-2 14 5 1 6-6 11-12 9m-43-5c-99-6-189-53-247-131-21-29-39-68-46-103-14-67-6-131 25-196 27-55 70-101 123-132 48-28 106-44 158-44h15v7h-18c-50 2-103 17-145 40-25 15-46 30-65 49-36 34-61 75-77 124-10 29-14 53-15 82-2 77 24 144 78 200 29 31 66 56 110 73 35 15 82 24 120 24h12v7l-8 1c-3 0-12-1-20-1m430-14c-3-2-5-4-6-7-1-2-2-3-11-3h-10v-3c0-2 0-3 3-3 1-1 6-1 10-1h7l3-5c4-4 4-4 8-4 7 0 12 5 12 14 0 10-10 17-16 12m-389-1c-5-5-1-15 6-15 3 0 8 5 8 8 0 8-8 12-14 7m-44-4c-42-3-88-16-127-36-13-7-32-20-46-30-12-9-34-30-44-43-17-20-33-48-42-72-6-14-13-39-15-55-15-94 26-198 101-260 15-13 17-15 30-23 47-30 99-46 154-48h20v3c0 4 0 4-4 4-2 0-11 0-20 1-52 3-97 17-140 42a286 286 0 0 0-128 176c-6 24-7 36-7 64 0 29 1 43 6 64 18 69 67 130 133 167 29 17 58 27 94 34 13 3 33 5 42 5 4 0 11 0 16 1 8 0 8 0 8 3 0 4-3 5-31 3m45-15c-3-3-4-8-1-12 1-2 2-2 6-2 6 1 9 4 8 9-2 6-8 9-13 5m28-1q-6-6 0-12c3-3 4-3 6-3 2 1 4 2 5 3 2 2 3 2 57 2h54l8-9 7-9h166l3-3c2-1 4-2 6-2 3 0 4 1 6 4 3 3 4 4 6 4s3-1 4-2c0-3 5-6 8-6s4 1 6 4c3 3 4 5 4 7 0 10-8 16-15 11-1-1-3-3-3-5-2-3-2-3-4-2-2 0-3 1-3 1 0 1-2 3-3 5-3 3-7 4-11 1-2-1-5-6-5-8s-8-2-81-2h-81l-9 9-8 10-54-1h-55l-3 2c-4 4-8 4-11 1m-79-3c-69-8-129-35-175-79-42-41-66-88-74-147-1-5-1-18-1-32 0-27 1-39 7-62 6-22 17-52 27-68 28-49 66-86 116-110 39-20 74-28 118-30h19v7h-15c-49 3-89 13-126 33-36 20-64 43-87 75-23 30-39 68-47 106-4 19-5 31-5 51s2 37 7 56c4 19 8 30 17 48 43 87 133 141 240 146h16v7h-15c-8 0-18-1-22-1m51-14c-2-1-4-6-4-9 2-4 4-6 8-6 3 0 5 1 6 2 2 2 4 2 38 2h29l51-62c38-47 50-62 49-63-1-3-1-12 0-15 2-4 6-6 11-6 3 0 4 0 6 4l4 4h68c60 0 68 0 69-1 0-3 5-6 8-6 7 0 12 8 10 16-2 9-11 12-17 6l-3-6v-2H860l-1 4c-2 5-6 8-11 8h-4l-26 32c-14 18-36 45-48 59-12 15-22 28-22 28h24l21-27c52-64 47-56 46-60-2-4-1-8 2-11 4-5 9-5 13-1 2 2 11-7 11-11 0-3 3-7 6-9s7-1 10 3 3 4 8 3c4 0 5-1 8-4 2-2 3-3 6-3 4 0 7 2 9 5 1 3 2 3 6 3 5 0 6 0 7-3s4-5 8-5c3 0 4 1 7 4 2 3 3 4 6 4 6 0 9-1 10-4 2-2 6-5 9-5 4 0 8 4 9 9 1 3 1 4 0 8-1 2-3 5-4 6-4 3-11 1-14-4-1-3-1-3-7-3h-6l-3 4c-3 4-3 4-7 4s-4 0-7-4c-4-5-4-5-8-5s-5 0-6 3q-3 6-9 6c-4 0-6-2-8-6-1-3-1-3-6-3-5 1-6 1-8 4-2 4-7 6-10 4-1-1-3-2-3-2-2 0-11 9-11 11 0 6-5 11-10 11-4-1 0-5-42 47l-25 31h21l23-29 23-29h12c6 0 13 0 14-1 4 0 8 2 9 5 1 2 2 2 36 2 33 0 35 0 36-2 4-6 11-7 15 0 1 2 1 2 12 2h11l2-3c3-4 4-4 7-4 4 0 5 0 7 4l3 3h9c9 0 10 0 10 2 1 2 1 2 9 2h8l3-4c3-3 3-4 7-4 10 0 14 16 6 23-5 4-13 1-15-5l-1-3h-11c-11 0-12 0-12-2-1-2-1-2-7-2h-6l-1 3c-2 4-6 7-9 7s-8-4-9-8c0-2-1-2-11-2-9 0-11 0-11 1s-1 3-2 5c-2 3-3 4-6 4-4 0-8-3-9-7l-1-3h-68l-1 3c-5 10-17 6-17-5v-4h-16l-24 29-23 29H676l-3 2c-3 3-7 4-11 2m-52-5c-30-3-64-13-93-26-26-13-46-27-66-47-37-36-59-77-68-127-2-11-2-16-2-39 0-22 0-27 2-38 15-85 66-153 144-188 33-16 71-24 107-24h14v7h-17c-33 2-55 6-84 16-55 20-103 62-130 113-14 26-23 52-28 84-2 13-2 45 0 58 4 26 10 47 21 70 12 24 25 42 44 60 27 28 60 48 97 61 27 8 51 13 80 14h17v7h-15c-8 0-18-1-23-1m443-12c-2-1-4-4-5-6l-1-3h-7c-5 0-6 0-7 2-4 7-10 7-14 1l-2-3H884l-1 3c-1 4-5 7-9 7-3 0-7-3-8-7l-2-3h-31v-7h31l3-3c2-2 4-4 6-5 3 0 8 2 9 5l2 3h133l3-3c4-4 7-4 11 0 2 3 3 3 9 4h7l2-3c6-10 19-5 19 7 0 5-2 8-5 11s-7 3-10 0m-183-58c-6-5-7-14-2-19 4-5 12-3 15 3 1 2 1 2 6 2s6 0 7-3 4-5 8-5c2 0 4 1 6 4l3 4h41l1-2c1-3 5-6 8-6 2 0 7 3 7 6 1 2 1 2 24 2h22l1-2c4-7 12-8 16-2 2 3 3 4 3 8 0 5-1 6-3 9-3 3-3 3-7 3-3 0-4-1-6-3-2-1-3-3-3-4-1-2-2-2-23-2-19 0-23 0-23 1 0 3-5 7-7 8-4 0-8-3-9-6l-1-3h-41l-2 3c-3 7-10 8-14 2l-2-4c0-1-3-1-6-1-5 0-5 0-6 2-1 6-9 9-13 5m-25-263c-4-3-6-11-4-16 1-3 1-3-3-8-3-5-5-6-6-5-2 2-5 1-8-1-5-3-7-11-5-18 1-1-7-11-29-38-16-19-35-42-42-50l-12-15h-60l-1 3c-2 4-7 5-12 4-8-4-6-16 4-16 2 0 4 0 5 1 0 1 25 1 63 1h56l21 26 22 27h31l3-3c2-2 3-2 6-2s4 0 6 3c3 4 3 4 9 4 5 0 6 0 7-2 3-7 11-8 15-2 3 4 3 4 8 4s5 0 6-3c3-6 11-7 15-1 3 4 3 4 8 4s6 0 8-4c2-2 3-3 6-4 4 0 8 2 9 6l1 2h45l3-4c3-3 4-4 7-4 6 0 10 5 10 12 0 8-4 13-10 13-4 0-8-4-9-8l-1-2h-45l-1 3c-2 6-9 8-14 3-1-1-2-3-3-4 0-2-1-2-6-2s-5 0-6 3c-4 8-14 8-17 0-1-3-2-3-7-3-4 0-5 0-5 2-1 4-5 7-9 7s-8-3-9-7c0-2-1-2-7-2-5 0-6 0-6 2-1 3-5 6-8 6-4 0-8-3-9-7l-1-3h-32l-22-27-21-26h-18c0 1 34 42 71 86 12 14 21 25 22 25 0 0 2-2 3-4 3-2 4-3 7-3s4 1 6 3c3 4 3 4 9 4s6 0 9-4c2-3 3-3 6-4 4 0 8 2 9 5s2 3 7 3c7 0 7 0 8-3 2-5 8-7 13-3 1 1 3 3 3 4 0 2 1 2 8 2h7l3-4c6-9 17-4 17 7 0 13-13 18-18 7l-2-3h-7c-6 0-8 0-8 1 0 2-4 7-7 7-3 1-8-1-9-5-1-3-1-3-8-3-5 0-6 0-6 1 0 3-5 7-8 8-3 0-7-2-9-6-1-3-2-3-7-3-6 0-6 0-10 4-3 4-3 4-7 4-3-1-4-1-6-4-1-3-3-4-4-4-2 0-7-6-50-57-11-14-27-33-36-43l-15-18h-9l-9 1 16 18 39 48 25 30 3-1c9-1 15 9 12 18-1 3 0 4 3 8 4 6 4 6 8 6s8 3 9 6l1 2h72c72 0 72 0 73-2 1-3 6-6 9-6 1 0 3 1 5 2 8 7 5 23-6 23-3 0-6-3-8-7l-1-3H861l-1 3c-2 6-10 9-15 5m23-55c-7-5-6-19 2-23s16 5 14 16c-2 6-4 8-9 9-3 0-5 0-7-2m189-60c-3-1-6-4-8-8-1-3-1-3-5-3s-4 0-4-3 0-3 4-3 4 0 6-4c3-5 6-7 11-7 13 2 13 26 0 28-1 1-3 1-4 0m-34-7c-3-4-3-4-8-4h-6v-3c0-3 0-3 6-3 5-1 7-1 8-3 2-4 6-5 9-3 4 3 5 5 4 10 0 5-3 8-7 9-3 0-3 0-6-3m-64-1c-3-1-5-6-5-8s-7-2-63-2h-63l-15-19-15-20h-94l-2 3c-4 4-9 4-12 0-4-4-4-7 0-11 3-4 8-4 11-1l2 3h98l7 9 7 9h181l1-3c2-5 10-8 14-4 10 7 4 25-7 23-3-1-6-4-7-7-1-2-4-2-89-2h-88l6 7 5 6h125l2-2c1-2 3-2 5-2 4 0 4 0 7 4l3 4h19v6l-10 1c-9 0-10 0-11 3-3 5-8 6-12 3m64-24c-1-2-3-5-4-7-1-7 4-15 11-15s12 10 8 19c-3 7-10 8-15 3m-362-20c-5-5-1-14 6-14s11 10 6 15c-4 3-9 3-12-1m394-6c-2-1-4-3-4-5-2-3-2-3-5-3s-3 0-3-3c0-4 0-4 3-4s4 0 5-3c5-11 19-6 19 6 0 6-2 11-6 13-4 1-6 1-9-1m-394-14c-3-3-3-9 0-12 8-6 18 2 14 11-3 5-10 6-14 1m31 1c-8-4-5-16 4-16 2 0 4 1 5 2s21 1 162 1h160l8-10c5-5 10-11 12-14 2-2 4-5 4-6 1-4 5-9 8-10h5c12 2 12 25 0 28-4 0-8-1-10-5l-2-3-12 14-11 13H704l-1 2c-1 1-3 3-5 4-4 1-3 1-6 0m-29-19c-3-2-5-7-4-10 2-6 10-8 14-4 3 4 3 10-1 13-2 2-6 3-9 1m29-1c-5-3-6-9-2-14 3-3 7-3 12 0 2 2 4 2 145 2h143l12-15c6-8 12-15 13-15s2-1 2-3c3-9 13-10 18-3 3 4 3 7 3 11-2 8-8 13-14 11-3-1-6-5-7-8 0-1-5 4-13 14l-12 14-143 1H705l-4 3c-3 3-5 4-9 2m-29-20c-5-2-6-11-1-14 9-5 18 7 11 14-3 2-6 3-10 0m27-1c-4-4-3-11 2-13 3-2 8-2 11 1 1 2 5 2 99 2h97l7-8c3-5 16-21 28-36 20-25 22-27 25-27 2 0 3 0 4-3 1-7 11-9 16-5 6 6 6 18 0 23-6 4-13 2-16-5q-1.5-3-3-3c-1 0-52 61-52 63 0 1 6 1 16 1h17l9-12c9-11 9-12 9-15-1-7 3-13 9-13 3 0 4 1 6 3 7 9 2 21-8 20l-3-1-10 13-10 12H704l-2 2c-3 4-9 4-12 1m280-4-2-3 14-18c8-9 19-24 25-32l12-14 2 2 2 3-26 32-25 32zm-307-14c-4-3-6-7-4-11s4-5 8-5c7 0 11 9 6 15-3 2-6 3-10 1m29 0c-1 0-3-2-3-3-6-8 5-17 12-11 3 2 5 2 74 2h93l19-24 20-24 2 2 2 2-21 26-21 26h-82c-82 0-83 0-85 2s-7 3-10 2m-29-20c-8-4-5-16 4-16 5 0 8 3 8 8 0 7-5 10-12 8m28 0c-2-1-4-6-3-9 0-3 4-7 8-7 1 0 3 1 5 3l3 2h142l12-16c12-14 16-20 11-15-3 2-7 3-9 1s-3-1-11 8l-8 9h-68l-69 1-3 2c-4 4-7 4-10 1-4-4-5-8-1-12 3-4 8-4 12-1l2 3h135l11-13c10-12 11-14 13-14 3 0 4 1 6 4s3 3 10 3h7l33-42 33-41 2 3 2 3-31 38-31 39h20l1-3c3-6 9-9 14-6 1 1 2 2 3 4l3 2 9-12c6-6 11-13 11-14 1-3 5-8 7-9 5-2 11 1 13 7 3 7 0 17-7 19-4 1-7 0-10-3l-3-3-4 5c-13 15-16 20-16 21 0 2-4 7-7 8-5 2-10-1-13-6l-1-3h-35l-15 20-16 19H705l-3 3c-3 2-7 3-11 1m-26-20c-5-2-8-7-5-12 3-8 15-5 15 4 0 4-1 6-4 8-3 1-4 1-6 0m25-21c-4-4-4-7 0-11s8-4 12-1l2 3h130l32-40 33-40v-4c0-5 1-6 3-8 7-8 18 1 14 12-2 5-5 7-10 7l-3-1-20 24c-12 14-27 32-34 41l-13 16H705l-3 2q-7.5 6-12 0m-26 1c-4-2-6-6-6-9 1-5 5-7 9-7 5 0 8 3 8 8 0 6-6 10-11 8m28-18c-3-2-5-6-4-10 1-6 9-8 14-3l3 2h111v-12l-3-1h-56l-53 1-2 2c-7 5-15 1-15-7 0-3 5-8 8-8q3 0 6 3l3 2h61c53 0 61 0 62 2 0 0 1 1 2 1s5 5 5 9c1 4-1 9-5 12l-3 3h-61c-53 0-62 0-63 1 0 1-5 4-6 4 0 0-2-1-4-1m-30-4c-4-3-4-7-2-11 2-3 7-5 11-3 3 1 5 7 4 10s-4 6-8 6c-2 0-4-1-5-2m-1-20c-5-5-2-15 6-15 5 0 8 3 8 9 0 7-8 11-14 6m30-16c-5-3-5-8-1-13 3-3 9-3 12 0l2 3h112v-10l1-2h-56c-56 0-57 0-60 2-6 5-13 1-13-7 0-4 4-8 7-8s6 2 8 4c1 2 4 2 63 2 34 0 62 0 62 1l2 2c5 4 6 13 3 18-4 5-3 5-68 5-59 0-61 0-63 2-4 3-7 3-11 1m-28-3c-9-5-3-19 7-16 4 1 5 4 5 8 0 7-6 10-12 8m-2-23c-4-4-4-5-1-10 5-8 18-2 15 8-2 6-10 7-14 2m186-11-3-4h-70c-49 0-72 0-73 1 0 1-1 2-3 2-5 2-12-4-11-10 2-7 10-9 15-3l3 2 70 1h69l2-4c1-2 3-4 5-5 6-3 13 3 13 12 0 7-4 12-10 12-3 0-4-1-7-4m-186-9c-3-3-3-9 0-12 9-7 19 5 12 12-2 2-3 3-6 3s-4-1-6-3',
  };
  // Place the mark by the left edge, vertical centre and height of its artwork.
  function logoPlacement(left, midY, height) {
    const s = height / LOGO.content.h;
    return { s, x: left - LOGO.content.x * s, y: midY - (LOGO.content.y + LOGO.content.h / 2) * s };
  }
  const logoPt = (L, x, y) => ({ x: L.x + x * L.s, y: L.y + y * L.s });
  // Right-aligned, 660 px tall: the right margin roughly matches the text's left margin.
  const LOGO_FILM = logoPlacement(1920 - 124 - (LOGO.content.w * 660) / LOGO.content.h, 540, 660);
  const C_CENTER = logoPt(LOGO_FILM, LOGO.center.x, LOGO.center.y);

  const DATA = buildData();

  function buildData() {
    const rng = mulberry32(20261024);
    const people = [];
    GROUPS.forEach((g, gi) => {
      g.pri.forEach((count, ai) => {
        for (let k = 0; k < count; k += 1) people.push({ grp: gi, pri: ai });
      });
    });
    const take = (gi, ai, skip = 0) => people.filter((p) => p.grp === gi && p.pri === ai)[skip];
    // The four participants whose responses we watch being made.
    const named = { typed: take(1, 2, 0), voice: take(1, 1, 0), ref: take(1, 2, 1), choice: take(0, 0, 0), quad: take(2, 3, 0) };
    Object.entries(named).forEach(([role, p]) => {
      p.role = role;
    });

    // Map layout (Participants Graph), map-space coordinates around 0,0
    const placed = [];
    const outliers = { '0-3-0': { x: 150, y: -118 }, '2-2-0': { x: -40, y: 262 }, '2-0-0': { x: -372, y: 258 } };
    const seen = {};
    people.forEach((p) => {
      const key = `${p.grp}-${p.pri}`;
      seen[key] = (seen[key] || 0) + 1;
      const o = outliers[`${key}-${seen[key] - 1}`];
      if (o) {
        p.map = { ...o };
        placed.push(p.map);
      }
    });
    GROUPS.forEach((g, gi) => {
      const rot = (g.rot * Math.PI) / 180;
      const members = people.filter((p) => p.grp === gi && !p.map).sort((a, b) => a.pri - b.pri);
      members.forEach((p) => {
        let best = null;
        for (let attempt = 0; attempt < 400; attempt += 1) {
          const ang = rng() * Math.PI * 2;
          const rad = Math.sqrt(rng());
          const bias = (p.pri - 1.5) * 0.34;
          const lx = Math.cos(ang) * rad * g.rx * 0.92 + bias * g.rx * 0.5;
          const ly = Math.sin(ang) * rad * g.ry * 0.92;
          const x = g.c.x + lx * Math.cos(rot) - ly * Math.sin(rot);
          const y = g.c.y + lx * Math.sin(rot) + ly * Math.cos(rot);
          const minD = placed.reduce((m, q) => Math.min(m, Math.hypot(q.x - x, q.y - y)), 1e9);
          if (minD > 37) {
            best = { x, y };
            break;
          }
          if (!best || minD > best.d) best = { x, y, d: minD };
        }
        p.map = { x: best.x, y: best.y };
        placed.push(p.map);
      });
    });

    // Distribution rows
    const rowCounts = [0, 0, 0, 0];
    people
      .slice()
      .sort((a, b) => a.grp - b.grp)
      .forEach((p) => {
        p.barIndex = rowCounts[p.pri];
        rowCounts[p.pri] += 1;
      });

    // At rest each participant is one pad of the logo's circuit traces.
    const pads = LOGO.pads.map(([x, y, r]) => ({ ...logoPt(LOGO_FILM, x, y), r: r * LOGO_FILM.s }));
    for (let k = pads.length - 1; k > 0; k -= 1) {
      const j = Math.floor(rng() * (k + 1));
      [pads[k], pads[j]] = [pads[j], pads[k]];
    }
    const padX = pads.map((q) => q.x);
    const padX0 = Math.min(...padX);
    const padX1 = Math.max(...padX);
    people.forEach((p, k) => {
      p.c = pads[k % pads.length];
      p.lightK = (p.c.x - padX0) / (padX1 - padX0); // pads light left to right
    });

    // While responses come in, participants wait in two columns of panels
    // either side of the card.
    const field = [];
    const rowStep = (CARD.bottom - CARD.top - 56) / 11;
    [0, 1].forEach((side) => {
      for (let r = 0; r < 12; r += 1) {
        for (let c = 0; c < 2; c += 1) {
          const x = side === 0 ? 92 + c * 80 : W - 172 + c * 80;
          field.push({ x, y: CARD.top + 28 + r * rowStep, inner: side === 0 ? c === 1 : c === 0, side });
        }
      }
    });
    const innerRight = field.filter((f) => f.inner && f.side === 1);
    const innerLeft = field.filter((f) => f.inner && f.side === 0);
    const reserve = { typed: innerRight[5], voice: innerLeft[5], ref: innerRight[6], choice: innerLeft[6], quad: innerRight[7] };
    Object.entries(reserve).forEach(([role, f]) => {
      named[role].field = { x: f.x, y: f.y };
      f.taken = true;
    });
    const freeField = field.filter((f) => !f.taken);
    for (let k = freeField.length - 1; k > 0; k -= 1) {
      const j = Math.floor(rng() * (k + 1));
      [freeField[k], freeField[j]] = [freeField[j], freeField[k]];
    }
    people.filter((p) => !p.field).forEach((p, k) => {
      p.field = { x: freeField[k].x, y: freeField[k].y };
    });

    people.forEach((p, k) => {
      p.k = k;
      p.seed = rng();
      p.twinkle = rng() * Math.PI * 2;
    });

    // Places on the political compass, counted per cluster
    const cCounts = [0, 0, 0, 0];
    people.forEach((p) => {
      const ci = p.grp === 2 ? 2 + (p.k % 2) : p.grp;
      p.cIndex = cCounts[ci];
      cCounts[ci] += 1;
    });
    return { people, named, rowCounts };
  }

  function hull(points, pad) {
    const pts = points.map((p) => [p.x, p.y]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower = [];
    for (const p of pts) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
      lower.push(p);
    }
    const upper = [];
    for (let i = pts.length - 1; i >= 0; i -= 1) {
      const p = pts[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
      upper.push(p);
    }
    const h = lower.slice(0, -1).concat(upper.slice(0, -1));
    const cx = h.reduce((s, p) => s + p[0], 0) / h.length;
    const cy = h.reduce((s, p) => s + p[1], 0) / h.length;
    return h.map(([x, y]) => {
      const d = Math.hypot(x - cx, y - cy) || 1;
      return { x: x + ((x - cx) / d) * pad, y: y + ((y - cy) / d) * pad };
    });
  }

  // -------------------------------------------------------------------------
  // Timeline
  // -------------------------------------------------------------------------
  const K = {
    // Open -> input: the logo's pads light up as participants and leave.
    light: [0.7, 1.15],
    textOut: [1.2, 1.6],
    logoOut: [1.35, 1.9],
    toField: [1.32, 2.0],
    cardIn: [1.85, 2.25],
    // Input vignettes
    type: [2.25, 3.05],
    typing: [2.35, 2.9],
    voice: [3.05, 3.85],
    wave: [3.1, 3.8],
    choose: [3.85, 4.51],
    binaryPick: 3.95,
    options: 4.09,
    optionPick: 4.23,
    // Quadratic allocation: each step adds one vote; n votes cost n x n credits.
    quad: [4.51, 5.71],
    quadSteps: [
      { row: 0, votes: 1, t: 4.68 },
      { row: 0, votes: 2, t: 4.81 },
      { row: 0, votes: 3, t: 4.94 },
      { row: 2, votes: -1, t: 5.11 },
      { row: 2, votes: -2, t: 5.23 },
      { row: 1, votes: 1, t: 5.37 },
    ],
    // typed, voice, choice, quadratic
    emit: [
      [2.9, 3.32],
      [3.78, 4.2],
      [4.27, 4.63],
      [5.49, 5.85],
    ],
    cardOut: [5.66, 5.96],
    lightAll: [5.66, 6.11],
    // Results
    toBars: [5.83, 6.43],
    toMap: [6.93, 7.58],
    hulls: [7.43, 7.88],
    stance: [7.83, 8.28],
    // Political compass: the graph gives way and every respondent takes a place on it
    compass: [8.4, 8.8],
    toCompass: [8.45, 9.15],
    toSummary: [10.08, 10.53],
    resp: [10.43, 10.58, 10.73],
    summary: [10.83, 11.13],
    refs: [11.03, 11.38],
    resOut: [11.6, 11.9],
    // Resolve: everyone returns to a pad, then the colours settle into the logo.
    toC: [11.65, 12.5],
    logoIn: [11.65, 12.5],
    textIn: [12.05, 12.65],
    settle: [13.05, 13.55],
  };
  // Between the opening and the ending: decides which of the two the brand card is doing.
  const MID = DURATION / 2;

  const SCENES = [
    { id: 'open', label: 'Open', start: 0 },
    { id: 'input', label: 'Input', start: K.textOut[0] + 0.2 },
    { id: 'results', label: 'Results', start: K.toBars[0] + 0.08 },
    { id: 'resolve', label: 'Resolve', start: K.toC[0] },
  ];
  SCENES.forEach((s, i) => {
    s.end = i + 1 < SCENES.length ? SCENES[i + 1].start : DURATION;
  });

  // -------------------------------------------------------------------------
  // Icons (inline SVG)
  // -------------------------------------------------------------------------
  const ICON = {
    keyboard:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M6 14h12"/></svg>',
    mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/></svg>',
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 5h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9l-4 3v-3H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/><path d="M19 9h1a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2v2.5L17 18h-4"/></svg>',
    megaphone:
      '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 10v4a1 1 0 0 0 1 1h2l1.5 5h2.5l-1.4-5H9l8 4V5L9 9H4a1 1 0 0 0-1 1zm16-1.5v7a3.5 3.5 0 0 0 0-7z"/></svg>',
    comment:
      '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4C6.5 4 2 7.4 2 11.5c0 2 1.1 3.9 2.9 5.2L4 20.5l4.3-2.2c1.2.3 2.4.5 3.7.5 5.5 0 10-3.4 10-7.5S17.5 4 12 4z"/></svg>',
    lockOpen:
      '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17 9V7a5 5 0 0 0-9.8-1.4l1.9.6A3 3 0 0 1 15 7v2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1z"/></svg>',
    robot:
      '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 2h2v3h4a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3h4V2zm-2.5 8a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm7 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM9 15.5h6v1.5H9zM1 10h2v5H1zm20 0h2v5h-2z"/></svg>',
    person:
      '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="7.5" r="4.5"/><path d="M3.5 21c.6-4.6 4-7.5 8.5-7.5s7.9 2.9 8.5 7.5z"/></svg>',
    check:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    neq: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M5 9h14M5 15h14M15 4.5 9 19.5"/></svg>',
    sparkle:
      '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 2l1.6 4.4L16 8l-4.4 1.6L10 14l-1.6-4.4L4 8l4.4-1.6zM18 12l.9 2.1L21 15l-2.1.9L18 18l-.9-2.1L15 15l2.1-.9zM5 15l.7 1.6L7.3 17.3l-1.6.7L5 19.6l-.7-1.6L2.7 17.3l1.6-.7z"/></svg>',
    question:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M9.2 9.2a2.9 2.9 0 1 1 4 2.7c-.8.4-1.2.9-1.2 1.8v.6"/><circle cx="12" cy="17.6" r="0.6" fill="currentColor"/></svg>',
    close:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M7.5 17v-5M12 17V7.5M16.5 17v-3"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"><path d="M12 5.5v13M5.5 12h13"/></svg>',
    dash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"><path d="M5.5 12h13"/></svg>',
    arrow:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h15M14 6.5l5.5 5.5-5.5 5.5"/></svg>',
    file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M6 2.5h8l4.5 4.5v14.5h-12.5z"/><path d="M14 2.5V7h4.5"/></svg>',
  };

  // The mark, with a reveal mask (a wedge around the C plus a wipe across the
  // traces) so it can draw on and off: setReveal(0) hides it, setReveal(1)
  // shows it whole.
  let logoSeq = 0;
  function buildLogo(svgParent, L) {
    logoSeq += 1;
    const id = `ce-logo-${logoSeq}`;
    const { x, y, w, h } = LOGO.box;
    const defs = sv('defs', {}, svgParent);
    const reveal = sv('mask', { id: `${id}-reveal`, maskUnits: 'userSpaceOnUse', x: x - 40, y: y - 40, width: w + 80, height: h + 80 }, defs);
    const wedge = sv('path', { fill: '#fff' }, reveal);
    // The trace wipe has a soft leading edge: white behind it, black ahead.
    const traceW = x + w + 40 - LOGO.center.x;
    const FEATHER = 70;
    const wipeGrad = sv('linearGradient', { id: `${id}-wipe`, gradientUnits: 'userSpaceOnUse', x1: 0, y1: 0, x2: 1, y2: 0 }, defs);
    sv('stop', { offset: 0, 'stop-color': '#fff' }, wipeGrad);
    sv('stop', { offset: 1, 'stop-color': '#000' }, wipeGrad);
    sv('rect', { fill: `url(#${id}-wipe)`, x: LOGO.center.x - 2, y: y - 40, width: traceW + 2, height: h + 80 }, reveal);
    const g = sv('g', { transform: `translate(${L.x.toFixed(2)} ${L.y.toFixed(2)}) scale(${L.s.toFixed(5)})` }, svgParent);
    const masked = sv('g', { mask: `url(#${id}-reveal)` }, g);
    sv('path', { d: LOGO.d, fill: LOGO.ink, 'fill-rule': 'evenodd' }, masked);
    const R0 = 760;
    function setReveal(p) {
      // Arcs grow from the left of the C towards both ends, then the traces run out.
      const arc = clamp(p / 0.62);
      const tr = clamp((p - 0.46) / 0.54);
      const { x: cx, y: cy } = LOGO.center;
      if (arc <= 0) {
        wedge.setAttribute('d', 'M0 0');
      } else {
        const th = (Math.PI / 2) * arc;
        const a0 = Math.PI - th;
        const a1 = Math.PI + th;
        const pt = (a) => `${(cx + R0 * Math.cos(a)).toFixed(2)} ${(cy + R0 * Math.sin(a)).toFixed(2)}`;
        wedge.setAttribute('d', `M${cx} ${cy}L${pt(a0)}A${R0} ${R0} 0 0 1 ${pt(a1)}Z`);
      }
      const edge = LOGO.center.x - 2 + tr * (traceW + FEATHER);
      wipeGrad.setAttribute('x1', (edge - FEATHER).toFixed(2));
      wipeGrad.setAttribute('x2', edge.toFixed(2));
    }
    setReveal(1);
    return { g, loaded: Promise.resolve(true), setReveal };
  }

  // -------------------------------------------------------------------------
  // Build
  // -------------------------------------------------------------------------
  const R = {};

  function build(stage) {
    stage.innerHTML = '';
    mk('div', 'bg-glow', stage);
    R.world = mk('div', 'layer', stage);
    R.world.style.transformOrigin = '0 0';
    R.cSvg = sv('svg', { class: 'svg-layer', width: W, height: H }, R.world);
    R.logo = buildLogo(R.cSvg, LOGO_FILM);
    buildCard(R.world);
    buildResults(R.world);
    buildBrand(R.world);
    R.dotSvg = sv('svg', { class: 'svg-layer', width: W, height: H }, R.world);
    R.dots = DATA.people.map((p) => ({ p, c: sv('circle', { r: 11, fill: ANSWERS[p.pri].color, stroke: '#ffffff', 'stroke-width': 0 }, R.dotSvg) }));
    R.rings = Object.values(DATA.named)
      .slice(0, 3)
      .map((p) => ({ p, c: sv('circle', { r: 26, fill: 'none', stroke: TH.ink, 'stroke-width': 2.4 }, R.dotSvg) }));
    return R.logo.loaded;
  }

  // --- Product card and its four input vignettes ------------------------------
  // Card-local layout (the card is drawn CARD.s times larger than this). The
  // "Question" heading sits at the top of every input type.
  const CL = {
    ta: { x: 178, y: 168, w: 782, h: 282, line0: 46, dy: 64, lh: 28, widths: [660, 580, 340] },
    mode: { x: 30, y: 243, s: 132 },
    bin: { x0: 80, y: 250, dx: 290, w: 260, h: 160 },
    quad: { x: 60, w: 880, meterY: 168, meterH: 16, rowY0: 204, dy: 114, rowH: 104, step: 64, minusX: 372, numX: 444, numW: 108, plusX: 560, sqX: 756, sq: 96, budget: 16, max: 4 },
    opt: { x0: 80, y0: 176, dx: 430, dy: 156, w: 410, h: 136 },
  };

  // A section heading: an outlined icon and one word, in card-local pixels.
  function heading(parent, word, svg) {
    const el = box(parent, 0, 0, CARD.w, 140);
    const ic = box(el, 56, 40, 88, 88, { borderRadius: '50%', border: `4px solid ${TH.teal}`, color: TH.teal, padding: '12px' });
    ic.innerHTML = svg;
    const label = mk('div', 'abs ce-q', el, word);
    Object.assign(label.style, { fontSize: '58px', lineHeight: '1' });
    put(label, 170, 46);
    return el;
  }

  function buildCard(parent) {
    const L = mk('div', 'layer', parent);
    R.cardLayer = L;
    R.card = box(L, CARD.x, CARD.y, CARD.w, CARD.h);
    R.card.className = 'abs ce-card';
    R.card.style.transformOrigin = '50% 50%';
    R.head = heading(R.card, COPY.question, ICON.question);

    // Footer icons
    R.foot = box(R.card, 56, CARD.h - 82, CARD.w - 112, 46);
    R.foot.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;color:${TH.footer}">
      <span style="width:44px;height:44px;display:block">${ICON.megaphone}</span>
      <span style="display:flex;gap:30px"><span style="width:44px;height:44px;display:block">${ICON.comment}</span><span style="width:44px;height:44px;display:block">${ICON.lockOpen}</span></span></div>`;

    // Type + voice share a textarea
    const { ta, mode } = CL;
    R.ff = box(R.card, 0, 0, CARD.w, CARD.h);
    R.ffIcon = box(R.ff, mode.x, mode.y, mode.s, mode.s, { borderRadius: '50%', display: 'grid', placeItems: 'center' });
    R.ffIconKb = mk('div', '', R.ffIcon, ICON.keyboard);
    R.ffIconMic = mk('div', '', R.ffIcon, ICON.mic);
    [R.ffIconKb, R.ffIconMic].forEach((el) => Object.assign(el.style, { position: 'absolute', inset: '22px' }));
    R.ffArea = box(R.ff, ta.x, ta.y, ta.w, ta.h, { border: `2px solid ${TH.hair2}`, borderRadius: '14px', background: '#fcfcfe' });
    R.lines = ta.widths.map((w, i) => ({ w, el: bar(R.ffArea, 32, ta.line0 + i * ta.dy, w, ta.lh, TH.line) }));
    R.caret = box(R.ffArea, 0, 0, 5, 46, { background: TH.teal, borderRadius: '2px' });
    R.waveSvg = sv('svg', { class: 'svg-layer', width: ta.w, height: ta.h }, R.ffArea);
    R.wave = [];
    const wr = mulberry32(99);
    for (let i = 0; i < 56; i += 1) {
      R.wave.push({ el: sv('rect', { x: 34 + i * 13.2, width: 7.5, rx: 3.75, fill: TH.wave }, R.waveSvg), a: 0.35 + wr() * 0.65, f: 6 + wr() * 9, ph: wr() * 6.28 });
    }

    // Structured choice: agree / unsure / disagree, then multiple choice
    const { bin, opt } = CL;
    R.ch = box(R.card, 0, 0, CARD.w, CARD.h);
    const binIcons = [ICON.check, ICON.dash, ICON.close];
    const binInk = ['#ffffff', '#23231f', '#ffffff'];
    R.binary = ['#2e7d32', '#ffeb3b', '#c62828'].map((c, i) => {
      const el = box(R.ch, bin.x0 + i * bin.dx, bin.y, bin.w, bin.h, { borderRadius: '18px', background: c, transformOrigin: '50% 50%' });
      icon(el, binIcons[i], (bin.w - 84) / 2, (bin.h - 84) / 2, 84, binInk[i]);
      return el;
    });
    R.opts = ANSWERS.map((a, i) => {
      const el = box(R.ch, opt.x0 + (i % 2) * opt.dx, opt.y0 + Math.floor(i / 2) * opt.dy, opt.w, opt.h, {
        borderRadius: '18px',
        background: '#ffffff',
        border: `2px solid ${TH.hair2}`,
        transformOrigin: '50% 50%',
      });
      const dot = box(el, 34, (opt.h - 40) / 2, 40, 40, { borderRadius: '50%', background: a.color });
      const lbl = bar(el, 96, (opt.h - 26) / 2, 196, 26, TH.lineSoft);
      const ck = icon(el, ICON.check, opt.w - 90, (opt.h - 60) / 2, 60, '#ffffff');
      return { el, dot, lbl, ck };
    });

    // Quadratic allocation: a credits meter, then options with - / + steppers whose
    // cost is drawn as an n x n block of credit squares (QuadraticAllocationInput).
    const qd = CL.quad;
    R.qd = box(R.card, 0, 0, CARD.w, CARD.h);
    R.qMeter = box(R.qd, qd.x, qd.meterY, qd.w, qd.meterH, { borderRadius: `${qd.meterH / 2}px`, background: TH.hair, overflow: 'hidden' });
    R.qSegs = [0, 1, 2].map(() => box(R.qMeter, 0, 0, 0, qd.meterH));
    R.qRows = [0, 1, 2].map((i) => {
      const row = box(R.qd, qd.x, qd.rowY0 + i * qd.dy, qd.w, qd.rowH, { borderRadius: '16px', border: `2px solid ${TH.hair2}` });
      bar(row, 30, (qd.rowH - 24) / 2, [250, 196, 228][i], 24, TH.line);
      const stepBtn = (x, svg, ink, bg) => {
        const el = box(row, x, (qd.rowH - qd.step) / 2, qd.step, qd.step, {
          borderRadius: '50%', color: ink, background: bg, boxShadow: `inset 0 0 0 3px ${ink}`, padding: '14px', transformOrigin: '50% 50%',
        });
        el.innerHTML = svg;
        return el;
      };
      const minus = stepBtn(qd.minusX, ICON.dash, QUAD_INK.neg, 'rgba(224,69,58,.1)');
      const plus = stepBtn(qd.plusX, ICON.plus, QUAD_INK.pos, 'rgba(31,157,85,.1)');
      const num = mk('div', 'abs ce-q', row, '0');
      Object.assign(num.style, { width: `${qd.numW}px`, textAlign: 'center', fontSize: '50px', fontWeight: '700', lineHeight: '1', transformOrigin: '50% 50%' });
      const sq = box(row, qd.sqX, (qd.rowH - qd.sq) / 2, qd.sq, qd.sq, { borderRadius: '10px', background: TH.tint });
      const cells = [];
      for (let k = 0; k < qd.max * qd.max; k += 1) {
        cells.push(box(sq, 0, 0, qd.sq / qd.max - 3, qd.sq / qd.max - 3, { borderRadius: '3px', transformOrigin: '50% 50%' }));
      }
      return { row, minus, plus, num, sq, cells };
    });
  }

  // --- Results: distribution, Participants Graph, grounded summary ------------
  const BARS = { x0: 520, step: 54, rows: [384, 498, 612, 726] };
  const MAP = { x: 950, y: 540, s: 1.15 }; // centred in the frame (no heading above it)
  const SUM = { x: 470, y: 600, s: 1.5 };
  // Political compass (as in the product's PoliticalCompassView): four tinted quadrants,
  // colours from the default theme's data series 7 / 1 / 4 / 5 mixed over white.
  const COMPASS = { x: 960, y: 540, half: 360, quads: ['#c7fad3', '#c6d7ff', '#fbcfd0', '#faedc7'] };
  // Where each opinion group sits on the compass (unit square, y down); group 2 splits.
  const COMPASS_AT = [[-0.5, -0.5], [0.5, 0.5], [0.5, -0.5], [-0.5, 0.5]];
  const compassPos = (p) => {
    const ci = p.grp === 2 ? 2 + (p.k % 2) : p.grp;
    const [ux, uy] = COMPASS_AT[ci];
    const j = p.cIndex;
    const a = j * 2.39996 + p.seed;
    const rr = Math.sqrt((j + 0.5) / 20) * 0.4;
    return { x: COMPASS.x + (ux + Math.cos(a) * rr) * COMPASS.half, y: COMPASS.y + (uy + Math.sin(a) * rr) * COMPASS.half };
  };

  function buildResults(parent) {
    const L = mk('div', 'layer', parent);
    R.res = L;
    // "Results" heading, in the place the question card's "Question" heading had
    R.resHead = heading(L, COPY.results, ICON.chart);
    R.resHead.style.transformOrigin = '0 0';
    // Faint tracks behind the distribution rows so lengths read as proportions
    R.tracks = BARS.rows.map((y) =>
      box(L, BARS.x0 - 30, y - 30, 16 * BARS.step + 60, 60, { borderRadius: '30px', background: TH.tint, border: `1px solid ${TH.hair}` }),
    );
    R.compassSvg = sv('svg', { class: 'svg-layer', width: W, height: H }, L);
    R.compass = sv('g', {}, R.compassSvg);
    {
      const { half, quads } = COMPASS;
      [[-half, -half], [0, -half], [-half, 0], [0, 0]].forEach(([qx, qy], i) => {
        sv('rect', { x: qx, y: qy, width: half, height: half, fill: quads[i] }, R.compass);
      });
      sv('line', { x1: -half, y1: 0, x2: half, y2: 0, stroke: TH.ink, 'stroke-width': 3 }, R.compass);
      sv('line', { x1: 0, y1: -half, x2: 0, y2: half, stroke: TH.ink, 'stroke-width': 3 }, R.compass);
      sv('rect', { x: -half, y: -half, width: half * 2, height: half * 2, fill: 'none', stroke: TH.ink, 'stroke-width': 3 }, R.compass);
    }
    R.mapSvg = sv('svg', { class: 'svg-layer', width: W, height: H }, L);
    R.mapFrame = sv('g', {}, R.mapSvg);
    [120, 235, 350].forEach((r) => {
      sv('circle', { cx: 0, cy: 0, r, fill: 'rgba(32,43,58,0.025)', stroke: TH.axis, 'stroke-opacity': 0.55, 'stroke-width': 1.8 }, R.mapFrame);
    });
    sv('line', { x1: -470, y1: 0, x2: 470, y2: 0, stroke: TH.axis, 'stroke-opacity': 0.8, 'stroke-width': 2 }, R.mapFrame);
    sv('line', { x1: 0, y1: -365, x2: 0, y2: 365, stroke: TH.axis, 'stroke-opacity': 0.8, 'stroke-width': 2 }, R.mapFrame);
    R.hulls = GROUPS.map((g, gi) => {
      const pts = DATA.people.filter((p) => p.grp === gi).map((p) => p.map);
      const h = hull(pts, 28);
      const d = `M${h.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('L')}Z`;
      const grp = sv('g', {}, R.mapSvg);
      const fill = sv('path', { d, fill: TH.ink, 'fill-opacity': 0.04 }, grp);
      const line = sv('path', { d, fill: 'none', stroke: TH.ink, 'stroke-opacity': 0.7, 'stroke-width': 1.6, 'stroke-linejoin': 'round', pathLength: 1 }, grp);
      const ys = h.map((p) => p.y);
      const xs = h.map((p) => p.x);
      return { grp, fill, line, top: Math.min(...ys), bottom: Math.max(...ys), left: Math.min(...xs), right: Math.max(...xs) };
    });
    // Stance on one representative statement, per group: green / yellow / red
    R.stance = GROUPS.map((g) => {
      const el = box(L, 0, 0, 210, 26, { borderRadius: '6px', overflow: 'hidden', display: 'flex', background: TH.hair });
      const total = g.q3.reduce((a, b) => a + b, 0);
      const segs = g.q3.map((v, j) => {
        const s = mk('i', '', el);
        Object.assign(s.style, { display: 'block', height: '100%', background: STANCE[j] });
        s.dataset.w = String((v / total) * 100);
        return s;
      });
      return { el, segs };
    });

    // Grounded summary: three representative responses feeding one AI summary
    R.sumSvg = sv('svg', { class: 'svg-layer', width: W, height: H }, L);
    const kinds = [ICON.keyboard, ICON.mic, ICON.check];
    R.resp = ['typed', 'voice', 'ref'].map((role, i) => {
      const p = DATA.named[role];
      const el = box(L, 0, 0, 400, 128, { borderRadius: '20px', border: `1px solid ${TH.hair}`, background: TH.card, boxShadow: TH.shadow });
      box(el, 28, 28, 22, 22, { borderRadius: '50%', background: ANSWERS[p.pri].color });
      icon(el, kinds[i], 340, 22, 36, TH.ink2);
      bar(el, 28, 70, 330, 18, TH.line);
      bar(el, 28, 98, 220, 18, TH.lineSoft);
      const line = sv('path', { fill: 'none', stroke: TH.ink, 'stroke-opacity': 0.32, 'stroke-width': 1.8, pathLength: 1 }, R.sumSvg);
      const ref = sv('path', { fill: 'none', stroke: TH.teal, 'stroke-opacity': 0.8, 'stroke-width': 2, pathLength: 1 }, R.sumSvg);
      return { el, p, y: 340 + i * 180, line, ref };
    });
    R.sum = box(L, 0, 0, 420, 470, {
      borderRadius: '24px',
      border: '2px solid rgba(11,154,168,.55)',
      background: TH.card,
      boxShadow: TH.shadow,
    });
    icon(R.sum, ICON.sparkle, 36, 34, 56, TH.teal);
    bar(R.sum, 36, 118, 300, 30, TH.ink);
    R.sumBars = [340, 320, 348, 210].map((w, i) => bar(R.sum, 36, 186 + i * 42, w, 18, TH.lineSoft));
    R.sumRefs = ['typed', 'voice', 'ref'].map((role, i) => {
      const p = DATA.named[role];
      return box(R.sum, 36 + i * 52, 396, 34, 34, { borderRadius: '50%', background: ANSWERS[p.pri].color, boxShadow: '0 0 0 3px #ffffff' });
    });
  }

  // --- Brand card (opens and closes the loop) ---------------------------------
  // The wordmark and title sit left of the logo, which is drawn by buildLogo. No URL:
  // link previews already show the domain.
  const BRAND = { x: 112, word: { y: 352, size: 100 }, tag: { y: 534, dy: 84, size: 64 } };

  function buildBrand(parent) {
    const L = mk('div', 'layer', parent);
    R.brand = L;
    R.brandWord = mk('div', 'abs end-title', L, COPY.brand);
    R.brandWord.style.fontSize = `${BRAND.word.size}px`;
    R.tag = COPY.tag.map((line) => {
      const el = mk('div', 'abs end-tag', L, line);
      el.style.fontSize = `${BRAND.tag.size}px`;
      return el;
    });
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  let lastSceneIndex = -1;
  const sceneAt = (t) => SCENES.reduce((idx, s, i) => (t >= s.start ? i : idx), 0);

  function renderAtTime(tIn) {
    let t = Number(tIn) || 0;
    t = ((t % DURATION) + DURATION) % DURATION;
    camera(t);
    renderBrand(t);
    renderLogo(t);
    renderCard(t);
    renderResults(t);
    renderDots(t);
    lastSceneIndex = sceneAt(t);
    return t;
  }

  function camera(t) {
    let s = 1;
    let fx = W / 2;
    let fy = H / 2;
    const [, , results, resolve] = SCENES.map((sc) => sc.start);
    if (t < K.textOut[0] + 0.5) {
      s = lerp(1, 1.02, ease.inOut2(P(t, 0, K.textOut[0] + 0.1)));
      s = lerp(s, 1, ease.inOut(P(t, K.textOut[0], K.textOut[0] + 0.5)));
      fx = C_CENTER.x;
      fy = C_CENTER.y;
    } else if (t < results) {
      s = 1 + 0.015 * ease.inOut2(P(t, K.cardIn[0] + 0.25, K.cardIn[0] + 1.45)) - 0.015 * ease.inOut2(P(t, K.cardOut[0] - 0.95, K.cardOut[0] + 0.15));
      fy = 520;
    } else if (t < resolve) {
      s = 1 + 0.05 * (1 - ease.out(P(t, K.toMap[0], K.toMap[0] + 1.2))) * P(t, K.toMap[0] - 0.2, K.toMap[0]);
      fx = MAP.x;
      fy = MAP.y;
    } else if (t > resolve) {
      s = lerp(1.03, 1, ease.out(P(t, resolve, resolve + 1.4)));
      fx = C_CENTER.x;
      fy = C_CENTER.y;
    }
    R.world.style.transform = `translate(${fx}px,${fy}px) scale(${s.toFixed(5)}) translate(${-fx}px,${-fy}px)`;
  }

  // Brand card visibility: full on frame 0, out as the story starts, back for the ending.
  const brandVis = (t) => (t < MID ? 1 - ease.inOut2(P(t, K.textOut[0], K.textOut[1])) : ease.out(P(t, K.textIn[0], K.textIn[1])));

  function renderBrand(t) {
    const v = brandVis(t);
    setO(R.brand, v > 0 ? 1 : 0);
    if (v <= 0) return;
    const stag = (i) => (t < MID ? v : ease.out(P(t, K.textIn[0] + i * 0.1, K.textIn[1] + i * 0.1)));
    const lift = (o) => (t < MID ? -(1 - o) * 30 : (1 - o) * 24);
    let o = stag(0);
    put(R.brandWord, BRAND.x - 4, BRAND.word.y + lift(o), o);
    o = stag(1);
    put(R.tag[0], BRAND.x, BRAND.tag.y + lift(o), o);
    o = stag(2);
    put(R.tag[1], BRAND.x, BRAND.tag.y + BRAND.tag.dy + lift(o), o);
  }

  // The logo draws off as the story starts and draws back on for the ending.
  function renderLogo(t) {
    const p = t < MID ? 1 - ease.inOut(P(t, K.logoOut[0], K.logoOut[1])) : ease.inOut(P(t, K.logoIn[0], K.logoIn[1]));
    svgO(R.logo.g, clamp(p * 1.8));
    if (p > 0) R.logo.setReveal(p);
  }

  // ---- Card ------------------------------------------------------------------
  function renderCard(t) {
    const active = t > K.cardIn[0] - 0.01 && t < K.cardOut[1] + 0.01;
    setO(R.cardLayer, active ? 1 : 0);
    if (!active) return;
    const cin = ease.out(P(t, K.cardIn[0], K.cardIn[1]));
    const cout = ease.inOut2(P(t, K.cardOut[0], K.cardOut[1]));
    put(R.card, CARD.x, CARD.y + (1 - cin) * 30, cin * (1 - cout), CARD.s * lerp(0.94, 1, cin) * lerp(1, 0.94, cout));
    setO(R.foot, (1 - win(t, K.quad[0], K.quad[0] + 0.12, K.quad[1], K.quad[1] + 0.1)));

    // Type and voice
    const ffO = win(t, K.type[0] - 0.4, K.type[0], K.voice[1] - 0.05, K.voice[1] + 0.08);
    setO(R.ff, ffO);
    if (ffO > 0) {
      const voice = t >= K.voice[0];
      setO(R.ffIconKb, voice ? 0 : 1);
      setO(R.ffIconMic, voice ? 1 : 0);
      const pulse = voice && t < K.wave[1] ? 0.5 + 0.5 * Math.sin(t * 14) : 0;
      R.ffIcon.style.background = voice ? 'rgba(229,57,74,.12)' : TH.tealTint;
      R.ffIcon.style.color = voice ? TH.rec : TH.teal;
      R.ffIcon.style.boxShadow = voice ? `0 0 0 ${(6 + 8 * pulse).toFixed(1)}px rgba(229,57,74,.1)` : 'none';
      // Speaking shows only the waveform (no transcript lines).
      const lineP = voice ? 0 : P(t, K.typing[0], K.typing[1]);
      const emitAt = voice ? K.emit[1][0] : K.emit[0][0];
      const clear = t > emitAt;
      const { ta } = CL;
      let caretX = 32;
      let caretY = ta.line0 - 9;
      R.lines.forEach((ln, i) => {
        const seg = clamp(lineP * 3 - i);
        ln.el.style.transform = `translate(32px, ${ta.line0 + i * ta.dy}px) scaleX(${(clear ? 0 : seg).toFixed(4)})`;
        ln.el.style.opacity = clear ? '0' : '1';
        if (seg > 0 && seg <= 1 && lineP * 3 >= i) {
          caretX = 32 + ln.w * seg + 8;
          caretY = ta.line0 - 9 + i * ta.dy;
        }
      });
      const caretOn = !voice && t > K.typing[0] - 0.15 && !clear && Math.floor(t * 4) % 2 === 0;
      put(R.caret, caretX, caretY, caretOn ? 1 : 0);
      const waveO = voice ? win(t, K.wave[0], K.wave[0] + 0.12, K.emit[1][0] - 0.06, K.emit[1][0] + 0.08) : 0;
      svgO(R.waveSvg, waveO);
      if (waveO > 0) {
        // the voice tails off, right to left, as the recording ends
        const fall = P(t, K.wave[1] - 0.25, K.wave[1]);
        R.wave.forEach((b, i) => {
          const decay = clamp(1 - (fall * R.wave.length * 1.1 - (R.wave.length - 1 - i)) / 8);
          const amp = b.a * (0.35 + 0.65 * Math.abs(Math.sin(t * b.f + b.ph))) * decay;
          const h = 6 + amp * 160;
          b.el.setAttribute('y', (CL.ta.h / 2 - h / 2).toFixed(1));
          b.el.setAttribute('height', h.toFixed(1));
          b.el.setAttribute('opacity', (0.3 + 0.7 * decay).toFixed(2));
        });
      }
    }

    // Structured choice
    const chO = win(t, K.choose[0], K.choose[0] + 0.12, K.choose[1], K.choose[1] + 0.1);
    setO(R.ch, chO);
    if (chO > 0) {
      const toOpts = ease.inOut(P(t, K.options - 0.08, K.options + 0.12));
      R.binary.forEach((el, i) => {
        const picked = t >= K.binaryPick;
        const s = i === 0 && picked ? 1 + 0.1 * bump(t, K.binaryPick, 0.2) : 1;
        el.style.transform = `translate(${CL.bin.x0 + i * CL.bin.dx}px, ${CL.bin.y}px) scale(${s.toFixed(3)})`;
        el.style.opacity = String((1 - toOpts) * (picked && i !== 0 ? 0.45 : 1));
        el.style.boxShadow = i === 0 && picked ? '0 0 0 6px #ffffff, 0 0 0 11px #2e7d32' : 'none';
      });
      R.opts.forEach((o, i) => {
        const picked = t >= K.optionPick && i === 0;
        const s = picked ? 1 + 0.06 * bump(t, K.optionPick, 0.2) : 1;
        o.el.style.transform = `translate(${CL.opt.x0 + (i % 2) * CL.opt.dx}px, ${CL.opt.y0 + Math.floor(i / 2) * CL.opt.dy}px) scale(${s.toFixed(3)})`;
        o.el.style.opacity = String(toOpts * (t >= K.optionPick && !picked ? 0.5 : 1));
        o.el.style.background = picked ? TH.select : '#ffffff';
        o.el.style.borderColor = picked ? TH.select : TH.hair2;
        o.lbl.style.background = picked ? TH.onFill : TH.lineSoft;
        o.dot.style.boxShadow = picked ? '0 0 0 4px #ffffff' : 'none';
        setO(o.ck, picked ? 1 : 0);
      });
    }

    // Quadratic allocation
    const qO = win(t, K.quad[0], K.quad[0] + 0.12, K.quad[1], K.quad[1] + 0.1);
    setO(R.qd, qO);
    if (qO > 0) renderQuad(t);
  }

  // Votes on each quadratic row at time t, and how far the latest step has animated.
  function quadState(row, t) {
    let prev = 0;
    let next = 0;
    let at = -1;
    K.quadSteps.forEach((st) => {
      if (st.row === row && t >= st.t) {
        prev = next;
        next = st.votes;
        at = st.t;
      }
    });
    const p = at < 0 ? 1 : ease.out(P(t, at, at + 0.14));
    return { prev, next, at, p };
  }

  function renderQuad(t) {
    const qd = CL.quad;
    let meterX = 0;
    R.qRows.forEach((r, i) => {
      const { prev, next, at, p } = quadState(i, t);
      const dir = Math.sign(next);
      const ink = dir > 0 ? QUAD_INK.pos : dir < 0 ? QUAD_INK.neg : TH.ink;
      r.row.style.borderColor = dir > 0 ? 'rgba(31,157,85,.5)' : dir < 0 ? 'rgba(224,69,58,.5)' : TH.hair2;
      r.row.style.background = dir > 0 ? 'rgba(31,157,85,.06)' : dir < 0 ? 'rgba(224,69,58,.06)' : '#ffffff';
      // Button press and vote count
      const press = at < 0 ? 0 : bump(t, at - 0.04, 0.2);
      const pressed = next > prev ? r.plus : r.minus;
      [r.plus, r.minus].forEach((b) => {
        const on = b === pressed ? press : 0;
        b.style.transform = `translate(${b === r.plus ? qd.plusX : qd.minusX}px, ${(qd.rowH - qd.step) / 2}px) scale(${(1 + 0.16 * on).toFixed(3)})`;
        b.style.filter = on > 0.05 ? `brightness(${(1 + 0.5 * on).toFixed(2)})` : 'none';
      });
      r.num.textContent = next > 0 ? `+${next}` : next < 0 ? `−${-next}` : '0';
      r.num.style.color = ink;
      put(r.num, qd.numX, (qd.rowH - 50) / 2 + 2, 1, 1 + 0.12 * press);
      // n votes cost n x n credits: the block grows from (n-1)^2 to n^2 squares.
      const n = Math.abs(next);
      const n0 = Math.abs(prev);
      const unit = qd.sq / qd.max;
      const size = lerp(n0, n, p) * unit;
      const ox = (qd.sq - size) / 2;
      r.cells.forEach((c, k) => {
        const cx = k % qd.max;
        const cy = Math.floor(k / qd.max);
        const inNew = cx < n && cy < n;
        const inOld = cx < n0 && cy < n0;
        let o = 0;
        let sc = 1;
        if (inNew && inOld) o = 1;
        else if (inNew) {
          o = p;
          sc = 0.3 + 0.7 * ease.back(p);
        }
        c.style.background = ink;
        put(c, ox + cx * unit + 1.5, ox + cy * unit + 1.5, o, sc);
      });
      // Credits meter: one segment per option, in option order
      const cost = lerp(prev * prev, next * next, p);
      const w = (cost / qd.budget) * qd.w;
      const seg = R.qSegs[i];
      seg.style.width = `${w.toFixed(2)}px`;
      seg.style.background = ink;
      put(seg, meterX, 0, w > 0.5 ? 1 : 0);
      if (w > 0.5) meterX += w + 4;
    });
  }

  // Where each watched response leaves the card.
  function emitSource(role) {
    const { ta, opt, quad } = CL;
    if (role === 'quad') return cardPt(quad.x + quad.sqX + quad.sq / 2, quad.rowY0 + quad.rowH / 2);
    if (role === 'typed' || role === 'voice') return cardPt(ta.x + 332, ta.y + 90);
    return cardPt(opt.x0 + 50, opt.y0 + 57);
  }
  const EMIT_INDEX = { typed: 0, voice: 1, choice: 2, quad: 3 };

  // ---- Results ---------------------------------------------------------------
  function groupXform(gi, t) {
    if (gi !== 1) return { x: MAP.x, y: MAP.y, s: MAP.s };
    const g = GROUPS[1];
    const sp = ease.inOut(P(t, K.toSummary[0], K.toSummary[1]));
    return { x: lerp(MAP.x, SUM.x - g.c.x * SUM.s, sp), y: lerp(MAP.y, SUM.y - g.c.y * SUM.s, sp), s: lerp(MAP.s, SUM.s, sp) };
  }
  const mapPos = (p, t) => {
    const g = groupXform(p.grp, t);
    return { x: g.x + p.map.x * g.s, y: g.y + p.map.y * g.s, s: g.s };
  };
  const barPos = (p) => ({ x: BARS.x0 + p.barIndex * BARS.step, y: BARS.rows[p.pri] });

  function renderResults(t) {
    const active = t > K.toBars[0] - 0.12 && t < K.resOut[1] + 0.05;
    setO(R.res, active ? 1 : 0);
    if (!active) return;
    const out = 1 - ease.inOut2(P(t, K.resOut[0], K.resOut[1]));
    // The heading takes over from the card's "Question" heading, in the same place.
    // "Results" heads the first results view only, then steps away for the graph.
    put(R.resHead, CARD.cx - (CARD.w * CARD.s) / 2, CARD.top, win(t, K.cardOut[0] + 0.1, K.cardOut[1] + 0.15, K.toMap[0] - 0.05, K.toMap[0] + 0.3), CARD.s);
    const trackO = win(t, K.toBars[0], K.toBars[0] + 0.4, K.toMap[0], K.toMap[0] + 0.35);
    R.tracks.forEach((el, i) => put(el, BARS.x0 - 30 - (1 - trackO) * 20, BARS.rows[i] - 30, trackO));
    // The graph (frame, hulls, stance bars) gives way to the compass; the summarised
    // group's outline comes back for the summary.
    const toCompass = ease.inOut2(P(t, K.compass[0], K.compass[0] + 0.35));
    const frameO = ease.out(P(t, K.toMap[0] + 0.15, K.toMap[1])) * (1 - toCompass);
    const ck = ease.out(P(t, K.compass[0], K.compass[1]));
    const cOut = 1 - ease.inOut2(P(t, K.toSummary[0], K.toSummary[0] + 0.35));
    R.compass.setAttribute('transform', `translate(${COMPASS.x} ${COMPASS.y}) scale(${(0.9 + 0.1 * ck).toFixed(4)})`);
    svgO(R.compass, ck * cOut);
    R.mapFrame.setAttribute('transform', `translate(${MAP.x} ${MAP.y}) scale(${MAP.s})`);
    svgO(R.mapFrame, frameO);

    const hullP = ease.inOut(P(t, K.hulls[0], K.hulls[1]));
    const toSum = ease.inOut2(P(t, K.toSummary[0], K.toSummary[0] + 0.4));
    GROUPS.forEach((g, gi) => {
      const h = R.hulls[gi];
      const gx = groupXform(gi, t);
      h.grp.setAttribute('transform', `translate(${gx.x} ${gx.y}) scale(${gx.s})`);
      h.line.setAttribute('stroke-dasharray', '1 1');
      h.line.setAttribute('stroke-dashoffset', (1 - hullP).toFixed(4));
      h.line.setAttribute('stroke-width', (1.8 / gx.s).toFixed(2));
      h.line.setAttribute('stroke', gi === 1 ? mixColor(TH.ink, TH.teal, toSum) : TH.ink);
      const back = ease.inOut2(P(t, K.toSummary[0] + 0.1, K.toSummary[0] + 0.45));
      const go = (gi === 1 ? Math.max(1 - toCompass, back) : 1 - toCompass) * out;
      svgO(h.grp, hullP > 0 ? go : 0);

      // Stance bar beside each group
      const st = R.stance[gi];
      let ax;
      let ay;
      if (gi === 0) {
        // Right-aligned above the group, clear of the "Results" heading
        ax = gx.x + h.right * gx.s - 210;
        ay = gx.y + h.top * gx.s - 52;
      } else if (gi === 1) {
        ax = gx.x + ((h.left + h.right) / 2) * gx.s - 105;
        ay = gx.y + h.bottom * gx.s + 26;
      } else {
        ax = gx.x + ((h.left + h.right) / 2) * gx.s - 105;
        ay = gx.y + h.bottom * gx.s + 26;
      }
      const sp = ease.out(P(t, K.stance[0] + gi * 0.1, K.stance[0] + gi * 0.1 + 0.35));
      st.segs.forEach((s) => {
        s.style.width = `${(Number(s.dataset.w) * sp).toFixed(2)}%`;
      });
      put(st.el, ax, ay, sp > 0 ? (1 - toCompass) * out : 0);
    });

    // Grounded summary
    const draw = (path, p) => {
      path.setAttribute('stroke-dasharray', '1 1');
      path.setAttribute('stroke-dashoffset', (1 - p).toFixed(4));
      svgO(path, p > 0 ? out : 0);
    };
    const cardX = 800;
    const sumX = 1340;
    const sumY = 296;
    R.resp.forEach((r, i) => {
      const a = K.resp[i];
      const o = win(t, a, a + 0.25) * out;
      put(r.el, cardX + (1 - o) * 24, r.y, o);
      const m = mapPos(r.p, t);
      const midY = r.y + 64;
      r.line.setAttribute('d', `M${m.x + 22} ${m.y}C${m.x + 150} ${m.y} ${cardX - 150} ${midY} ${cardX - 2} ${midY}`);
      draw(r.line, ease.inOut(P(t, a - 0.08, a + 0.25)));
      const refY = sumY + 396 + 17;
      const refX = sumX - 2;
      r.ref.setAttribute('d', `M${cardX + 402} ${midY}C${cardX + 460} ${midY} ${refX - 60} ${refY} ${refX} ${refY}`);
      draw(r.ref, ease.inOut(P(t, K.refs[0] + i * 0.06, K.refs[1] + i * 0.06)));
    });
    const so = win(t, K.summary[0], K.summary[1]) * out;
    put(R.sum, sumX, sumY + (1 - so) * 20, so);
    R.sumBars.forEach((b, i) => {
      const bp = ease.out(P(t, K.summary[0] + 0.08 + i * 0.06, K.summary[1] + 0.1 + i * 0.06));
      b.style.transform = `translate(36px, ${186 + i * 42}px) scaleX(${bp.toFixed(3)})`;
    });
    R.sumRefs.forEach((d, i) => setO(d, ease.out(P(t, K.refs[0] + 0.15 + i * 0.06, K.refs[1] + i * 0.06))));
  }

  // ---- Participant dots -------------------------------------------------------
  const fieldPos = (p) => ({ x: p.field.x, y: p.field.y });


  function renderDots(t) {
    R.dots.forEach((d) => {
      const p = d.p;
      const color = ANSWERS[p.pri].color;
      const stagger = (p.k % 16) * 0.016 + p.seed * 0.12;
      let pos;
      let r = 12;
      let o = 1;
      let fill = color;
      let stroke = 0;

      if (t < K.toBars[0]) {
        // Logo pad -> lit in its answer colour -> waiting field (dim) -> lit by a
        // submitted response
        const la = K.light[0] + p.lightK * (K.light[1] - K.light[0] - 0.15);
        const lit = ease.out(P(t, la, la + 0.15));
        const fp = ease.inOut(P(t, K.toField[0] + stagger, K.toField[1] + stagger));
        pos = mix(p.c, fieldPos(p, t), fp);
        r = lerp(p.c.r + 1 + 5 * bump(t, la, 0.32), 10, fp);
        o = lerp(lit, 0.28, fp);
        const emits = p.role && EMIT_INDEX[p.role] !== undefined;
        if (emits) {
          const [a, b] = K.emit[EMIT_INDEX[p.role]];
          if (t >= a) {
            const ep = ease.inOut(P(t, a, b));
            pos = mix(emitSource(p.role), fieldPos(p, t), ep);
            r = lerp(16, 12, ep);
            o = 1;
            fill = p.role === 'choice' ? color : mixColor(TH.ink, color, ep);
          }
        }
        if (!emits || t < K.emit[EMIT_INDEX[p.role]][0]) {
          const lit = ease.out(P(t, K.lightAll[0] + stagger * 0.5, K.lightAll[1] + stagger * 0.5));
          o = lerp(o, 1, lit);
          r = lerp(r, 12, lit);
        }
      } else if (t < K.toMap[0] + 0.9) {
        const a = K.toBars[0] + stagger * 0.6;
        const bp = ease.inOut(P(t, a, a + 0.5));
        pos = mix(fieldPos(p, K.toBars[0]), barPos(p), bp);
        r = lerp(12, 19, bp);
        if (t >= K.toMap[0]) {
          const a2 = K.toMap[0] + p.grp * 0.07 + p.seed * 0.15;
          const mp = ease.inOut(P(t, a2, a2 + 0.6));
          const m = mapPos(p, t);
          pos = mix(barPos(p), m, mp);
          r = lerp(19, 14, mp);
        }
      } else if (t < K.toC[0]) {
        // Graph -> political compass -> (the summarised group) summary
        const ca = K.toCompass[0] + p.grp * 0.06 + p.seed * 0.12;
        const cp = ease.inOut(P(t, ca, ca + 0.55));
        const sp = ease.inOut(P(t, K.toSummary[0], K.toSummary[1]));
        const onCompass = mix(mapPos(p, K.toCompass[0]), compassPos(p), cp);
        pos = p.grp === 1 ? mix(onCompass, mapPos(p, K.toSummary[1]), sp) : onCompass;
        r = p.grp === 1 ? lerp(14, 16, sp) : 14;
        if (p.grp !== 1) o = 1 - ease.inOut2(P(t, K.toSummary[0], K.toSummary[0] + 0.4));
        // a white edge keeps answer colours clear of the quadrant tints
        stroke = 3 * cp * (p.grp === 1 ? 1 - sp : 1);
      } else {
        // Everyone returns to the logo: the summarised group from the summary,
        // the others from the compass as they fade back in.
        const a = K.toC[0] + stagger * 1.2;
        const cp = ease.inOut(P(t, a, a + 0.75));
        pos = mix(p.grp === 1 ? mapPos(p, K.toC[0]) : compassPos(p), p.c, cp);
        r = lerp(p.grp === 1 ? 16 : 14, p.c.r + 1, cp);
        // Back on its pad, each colour settles into the logo, so the last frame is frame 0.
        const sa = K.settle[0] + p.lightK * (K.settle[1] - K.settle[0] - 0.3);
        o = (p.grp === 1 ? 1 : ease.out(P(t, a, a + 0.35))) * (1 - ease.inOut2(P(t, sa, sa + 0.3)));
      }
      d.c.setAttribute('cx', pos.x.toFixed(2));
      d.c.setAttribute('cy', pos.y.toFixed(2));
      d.c.setAttribute('r', Math.max(0.1, r).toFixed(2));
      d.c.setAttribute('fill', fill);
      d.c.setAttribute('stroke-width', stroke.toFixed(2));
      svgO(d.c, o);
    });
    R.rings.forEach((ring, i) => {
      const a = K.resp[i];
      const o = win(t, a - 0.1, a + 0.15, K.resOut[0] - 0.1, K.resOut[0] + 0.1);
      const m = mapPos(ring.p, t);
      ring.c.setAttribute('cx', m.x.toFixed(2));
      ring.c.setAttribute('cy', m.y.toFixed(2));
      svgO(ring.c, t > K.toSummary[0] && t < K.resOut[1] ? o : 0);
    });
  }

  // -------------------------------------------------------------------------
  // Poster (1200x630 og:image): the brand card, text kept large
  // -------------------------------------------------------------------------
  function buildPoster(stage) {
    stage.classList.add('poster');
    stage.innerHTML = '';
    mk('div', 'bg-glow', stage);
    const svg = sv('svg', { class: 'svg-layer', width: 1200, height: 630 }, stage);
    const h = 420;
    const logo = buildLogo(svg, logoPlacement(1200 - 64 - (LOGO.content.w * h) / LOGO.content.h, 315, h));
    const word = mk('div', 'abs end-title', stage, COPY.brand);
    word.style.fontSize = '70px';
    put(word, 54, 196);
    COPY.tag.forEach((line, i) => {
      const el = mk('div', 'abs end-tag', stage, line);
      el.style.fontSize = '42px';
      put(el, 58, 318 + i * 54);
    });
    return logo.loaded;
  }

  // -------------------------------------------------------------------------
  // Viewer: scaling, playback, controls
  // -------------------------------------------------------------------------
  const params = new URLSearchParams(location.search);
  const CAPTURE = params.has('capture');
  const POSTER = params.has('poster');
  const START_T = params.has('t') ? Number(params.get('t')) : 0;

  let current = 0;
  let playing = false;
  let lastWall = 0;

  function fit() {
    const frame = document.getElementById('stage-frame');
    const sizer = document.getElementById('stage-sizer');
    const stage = document.getElementById('stage');
    const sw = POSTER ? 1200 : W;
    const sh = POSTER ? 630 : H;
    if (CAPTURE) {
      frame.style.width = `${sw}px`;
      sizer.style.height = `${sh}px`;
      stage.style.transform = 'none';
      return;
    }
    const controlsH = document.getElementById('controls').offsetHeight + 150;
    const host = frame.parentElement;
    const cs = getComputedStyle(host);
    const avail = host.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const maxW = Math.min(avail, Math.max(320, window.innerHeight - controlsH) * (sw / sh));
    const width = Math.max(280, Math.min(maxW, sw));
    frame.style.width = `${width}px`;
    sizer.style.height = `${(width * sh) / sw}px`;
    stage.style.transform = `scale(${width / sw})`;
  }

  function fmt(t) {
    const m = Math.floor(t / 60);
    const s = t - m * 60;
    return `${String(m).padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`;
  }

  function show(t) {
    current = renderAtTime(t);
    const scrub = document.getElementById('scrubber');
    if (scrub && document.activeElement !== scrub) scrub.value = String(current);
    const tc = document.getElementById('timecode');
    if (tc) tc.innerHTML = `<b>${fmt(current)}</b> / ${fmt(DURATION)}`;
    document.querySelectorAll('#scene-nav button').forEach((b, i) => b.classList.toggle('is-current', i === lastSceneIndex));
  }

  function tick(now) {
    if (!playing) return;
    const dt = Math.min(0.1, (now - lastWall) / 1000);
    lastWall = now;
    show((current + dt) % DURATION);
    requestAnimationFrame(tick);
  }

  function setPlaying(on) {
    playing = on;
    const btn = document.getElementById('btn-play');
    if (btn) {
      btn.textContent = on ? 'Pause' : 'Play';
      btn.setAttribute('aria-label', on ? 'Pause' : 'Play');
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    if (on) {
      lastWall = performance.now();
      requestAnimationFrame(tick);
    }
  }

  function wireControls() {
    const nav = document.getElementById('scene-nav');
    SCENES.forEach((s, i) => {
      const b = mk('button', '', nav, `${i + 1} · ${s.label}`);
      b.type = 'button';
      b.addEventListener('click', () => show(s.start + 0.001));
    });
    document.getElementById('btn-play').addEventListener('click', () => setPlaying(!playing));
    document.getElementById('btn-restart').addEventListener('click', () => {
      show(0);
      setPlaying(true);
    });
    const scrub = document.getElementById('scrubber');
    scrub.max = String(DURATION);
    scrub.addEventListener('input', () => {
      setPlaying(false);
      show(Number(scrub.value));
    });
    window.addEventListener('keydown', (e) => {
      if (e.target && e.target.tagName === 'INPUT' && e.key !== ' ') return;
      if (e.key === ' ') {
        e.preventDefault();
        setPlaying(!playing);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        setPlaying(false);
        const step = e.shiftKey ? 1 / FPS : 1;
        show(clamp(current + (e.key === 'ArrowRight' ? step : -step), 0, DURATION - 1 / FPS));
      } else if (e.key === 'Home') {
        show(0);
      } else if (/^[1-9]$/.test(e.key) && Number(e.key) <= SCENES.length) {
        show(SCENES[Number(e.key) - 1].start + 0.001);
      }
    });
    window.addEventListener('resize', fit);
  }

  async function boot() {
    if (CAPTURE) document.body.classList.add('capture');
    const stage = document.getElementById('stage');
    await Promise.all(
      ['400 20px Poppins', '500 20px Poppins', '600 20px Poppins', '700 20px Poppins', '500 20px "JetBrains Mono"'].map((f) =>
        document.fonts.load(f),
      ),
    );
    await document.fonts.ready;
    const painted = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (POSTER) {
      await buildPoster(stage);
      fit();
      document.getElementById('controls').style.display = 'none';
      await painted();
      return;
    }
    await build(stage);
    fit();
    if (!CAPTURE) wireControls();
    show(START_T);
    await painted();
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Autoplay unless the viewer asked for a still frame or prefers reduced motion.
    if (!CAPTURE && !params.has('t') && !params.has('paused') && !reduceMotion) setPlaying(true);
  }

  // For capture tools: render t, then make the browser rebuild the stage's
  // rendering from scratch. Chrome reuses rasters from earlier frames for some
  // layers, so without this a few edge pixels could depend on which frames were
  // shown before; with it, a frame is identical however you reach it.
  async function capture(t) {
    const out = renderAtTime(t);
    const stage = document.getElementById('stage');
    const painted = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    stage.style.display = 'none';
    await painted();
    stage.style.display = '';
    await painted();
    return out;
  }

  const ready = boot();
  window.renderAtTime = (t) => renderAtTime(t);
  window.film = {
    duration: DURATION,
    fps: FPS,
    width: W,
    height: H,
    scenes: SCENES.map(({ id, label, start, end }) => ({ id, label, start, end })),
    ready,
    renderAtTime: (t) => renderAtTime(t),
    capture,
    play: () => setPlaying(true),
    pause: () => setPlaying(false),
    data: { answers: ANSWERS, groups: GROUPS.map(({ n, pri, q3 }) => ({ n, pri, q3 })) },
  };
})();
