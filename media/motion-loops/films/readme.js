/*
  README feature loop (15.4 s): five question types, Groups and Results, with real
  words so it reads at README size.
*/
(function () {
  'use strict';

  const {
    C,
    ICON,
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
    film,
  } = window.Kit;

  const DURATION = 15.4; // A whole number of frames at 20, 25 and 30 fps.

  // The editable rhythm: [start, end] of each scene, in seconds.
  const BEATS = {
    agree: [0, 2.0],
    free: [2.0, 3.85],
    rate: [3.85, 5.25],
    multi: [5.25, 6.75],
    quad: [6.75, 8.75],
    groups: [8.75, 11.6],
    results: [11.6, 14.7],
    resolve: [14.7, DURATION],
  };

  // Matrix cells run from the origin: teal through green and amber to coral.
  const HEAT = ['#0fa3b5', '#2fb3a3', '#7cc27f', '#d9c24a', '#eea01f', '#ec7b2f', '#ea573f'];
  const ANSWER = 'Who is affected most?';

  const BUTTONS = { x: 340, gap: 29, w: 394, y: 566, h: 180, r: 25, size: 60 };
  const SLIDER = { x0: 440, x1: 1480, y: 590, low: '0', high: '10', lowX: 384, highX: 1530 };
  const FIELD = { x: 520, y: 368, w: 1060, h: 432, r: 20 };
  const BARS = { x: 760, w: 450, h: 62, r: 14, rows: [456, 559, 662] };
  const BAR_SHARES = [
    [0.5, 0.295, 0.205],
    [0.605, 0.197, 0.198],
    [0.267, 0.361, 0.372],
  ];
  const OPINION_MAP = { x: 485, y: 590, r: 215, inner: 92, orbit: 118 };
  const MATRIX = { x: 1282, y: 375, cell: 84, pitch: 92, ox: 1262, oy: 755 };
  const LABEL_Y = 880;

  const QUAD_STEPS = quadSteps(BEATS.quad[0] + 0.28, 0.16);

  // The participant each answer lights: [column, row, time], as in the film.
  const ANSWERED = [
    [1, 5, 0.74],
    [2, 3, BEATS.free[0] + 1.02],
    [1, 8, BEATS.rate[0] + 0.82],
    [2, 7, BEATS.multi[0] + 0.74],
    [1, 2, QUAD_STEPS[5].at],
  ];

  const s = {};

  function buildCard(root) {
    s.shell = buildShell(root);
    s.comment = buildComment(root);
    s.lock = buildCardLock(root);
    s.credits = buildCredits(root);
  }

  function buildAgree(root) {
    s.agree = {
      q: questionText(root, ['Humans and agents need', 'better tools for debate,', 'negotiation, and sensemaking']),
      buttons: [],
    };
    const faces = [
      ['Agree', C.agree, C.card],
      ['Unsure', C.unsure, C.unsureInk],
      ['Disagree', C.disagree, C.card],
    ];
    faces.forEach(([label, fill, ink], i) => {
      const x = BUTTONS.x + i * (BUTTONS.w + BUTTONS.gap);
      const g = group(root);
      const face = el(g, 'path', { fill });
      const caption = text(g, x + BUTTONS.w / 2, BUTTONS.y + BUTTONS.h / 2 + 21, BUTTONS.size, 600, ink, label, 'middle');
      s.agree.buttons.push({ g, face, caption, x, fill });
    });
    const tx = BUTTONS.x + BUTTONS.w - 74;
    const ty = BUTTONS.y + BUTTONS.h / 2;
    s.agree.tick = stroke(root, 'path', {
      d: `M${tx} ${ty + 1}L${tx + 13} ${ty + 14}L${tx + 38} ${ty - 14}`,
      stroke: C.card,
      'stroke-width': 8,
      'stroke-linejoin': 'round',
    });
    s.agree.ring = el(root, 'rect', {
      x: BUTTONS.x - 9,
      y: BUTTONS.y - 9,
      width: BUTTONS.w + 18,
      height: BUTTONS.h + 18,
      rx: BUTTONS.r + 8,
      fill: 'none',
      stroke: C.ink,
      'stroke-width': 5,
    });
  }

  function buildFree(root) {
    const scene = { q: questionText(root, ['What should we consider?']), c: group(root) };
    const { c } = scene;
    const cx = 418;
    const cy = FIELD.y + FIELD.h / 2;
    scene.disc = el(c, 'circle', { cx, cy });
    scene.mic = icon(c, ICON.mic, cx - 50, cy - 50, 100, C.teal);
    el(c, 'rect', {
      x: FIELD.x,
      y: FIELD.y,
      width: FIELD.w,
      height: FIELD.h,
      rx: FIELD.r,
      fill: C.field,
      stroke: C.hair2,
      'stroke-width': 3,
    });
    scene.placeholder = text(c, 560, 448, 50, 400, C.soft, 'Share your perspective…');
    scene.typed = text(c, 560, 448, 50, 400, C.ink, '');
    scene.caret = el(c, 'rect', { y: 406, width: 5, height: 58, rx: 2, fill: C.teal });
    s.free = scene;
  }

  function buildRate(root) {
    const scene = { q: questionText(root, ['How confident are you?']), c: group(root) };
    scene.slider = buildSlider(scene.c, SLIDER);
    s.rate = scene;
  }

  function buildMulti(root) {
    const scene = { q: questionText(root, ['What matters most?']), c: group(root) };
    scene.boxes = buildCheckRows(scene.c, [
      ['Speed', 0.24],
      ['Cost', 0.46],
      ['Quality', 0.68],
    ]);
    s.multi = scene;
  }

  function buildQuad(root) {
    const scene = { q: questionText(root, ['How would you prioritize?']), c: group(root) };
    scene.rows = buildQuadRows(scene.c, ['Research', 'Discussion', 'Action']);
    s.quad = scene;
  }

  function buildGroups(root) {
    const cx = 340;
    const cys = [400, 610, 820];
    const label = (cy, str) => text(root, 480, cy + 24, 68, 600, C.ink, str);

    const row0 = group(root);
    const lock = buildLock(row0, cx, cys[0]);

    const row1 = group(root);
    const bars = [
      [cys[1] - 63, 76],
      [cys[1] - 13, 50],
      [cys[1] + 37, 26],
    ].map(([y, half]) => ({ half, node: el(row1, 'rect', { y, height: 26, rx: 13, fill: C.teal }) }));

    const row2 = group(root);
    const badge = stroke(row2, 'rect', {
      x: cx - 79,
      y: cys[2] - 71,
      width: 158,
      height: 142,
      rx: 20,
      stroke: C.teal,
      'stroke-width': 8,
    });
    const person = group(row2, { fill: C.teal });
    el(person, 'circle', { cx, cy: cys[2] - 23, r: 26 });
    el(person, 'path', { d: `M${cx - 42} ${cys[2] + 47}V${cys[2] + 39}A42 30 0 0 1 ${cx + 42} ${cys[2] + 39}V${cys[2] + 47}Z` });

    const rows = [
      { icon: row0, label: label(cys[0], 'Private Access & Data') },
      { icon: row1, label: label(cys[1], 'Result Filtering') },
      { icon: row2, label: label(cys[2], 'Centralized / Decentralized Option') },
    ];
    s.groups = { rows, lock, bars, badge, person, cx, personY: cys[2] + 12 };
  }

  function buildResults(root) {
    const opinionMap = buildOpinionMap(root, OPINION_MAP);
    const caption = (x, str) => text(root, x, LABEL_Y, 58, 600, C.ink, str, 'middle');
    opinionMap.label = caption(OPINION_MAP.x, 'Opinion Map');

    const breakdown = {
      rows: BARS.rows.map(() => buildBar(root)),
      label: caption(BARS.x + BARS.w / 2, 'Breakdown'),
    };

    const matrix = { g: group(root), cells: [], dots: [] };
    const axis = { stroke: C.axis, 'stroke-width': 5 };
    matrix.up = stroke(matrix.g, 'path', { d: `M${MATRIX.ox} ${MATRIX.oy}V366`, ...axis });
    matrix.right = stroke(matrix.g, 'path', { d: `M${MATRIX.ox} ${MATRIX.oy}H1664`, ...axis });
    matrix.heads = group(matrix.g, { fill: C.axis });
    el(matrix.heads, 'path', { d: `M${MATRIX.ox} 340L${MATRIX.ox + 16} 370L${MATRIX.ox - 16} 370Z` });
    el(matrix.heads, 'path', { d: `M1690 ${MATRIX.oy}L1660 ${MATRIX.oy - 16}L1660 ${MATRIX.oy + 16}Z` });
    for (let r = 0; r < 4; r += 1) {
      for (let col = 0; col < 4; col += 1) {
        const x = MATRIX.x + col * MATRIX.pitch;
        const y = MATRIX.y + r * MATRIX.pitch;
        const rank = col + (3 - r);
        const node = el(matrix.g, 'rect', { x, y, width: MATRIX.cell, height: MATRIX.cell, rx: 12 });
        // Cells resolve outward from the origin, bottom-left.
        matrix.cells.push({ node, fill: HEAT[rank], cx: x + MATRIX.cell / 2, cy: y + MATRIX.cell / 2, rank });
      }
    }
    [[1, 0], [2, 1], [2, 2], [2, 3]].forEach(([r, col]) => {
      const cx = MATRIX.x + col * MATRIX.pitch + MATRIX.cell / 2;
      const cy = MATRIX.y + r * MATRIX.pitch + MATRIX.cell / 2;
      matrix.dots.push({ node: el(matrix.g, 'circle', { cx, cy, r: 11, fill: C.card }), cx, cy });
    });
    matrix.label = caption(MATRIX.x + (3 * MATRIX.pitch + MATRIX.cell) / 2, 'Analysis');

    s.results = { opinionMap, breakdown, matrix };
  }

  function build(root) {
    s.dots = buildDots(root, ANSWERED);
    buildCard(root);
    buildFree(root);
    buildRate(root);
    buildMulti(root);
    buildQuad(root);
    buildGroups(root);
    buildResults(root);
    buildAgree(root);
  }

  // The card and the dots beside it leave after Groups has arrived on the card,
  // and return as the loop closes.
  const shell = (t) => shellAt(t, BEATS.groups[0], BEATS.resolve[0] + 0.1);

  function renderCard(t) {
    const end = BEATS.quad[1];
    const resolve = BEATS.resolve[0];
    place(s.shell, { o: shell(t) });
    const out = 1 - ease.inOut2(P(t, end - 0.24, end - 0.04));
    const back = ease.out(P(t, resolve + 0.24, resolve + 0.52));
    place(s.lock, { o: Math.max(out, back) });
    const quadIn = BEATS.quad[0];
    place(s.comment, { o: Math.max(1 - P(t, quadIn - 0.2, quadIn), back) });
    place(s.credits.g, { o: P(t, quadIn - 0.04, quadIn + 0.18) * out });
    s.credits.total.textContent = quadAt(QUAD_STEPS, t).total;
  }

  function renderAgree(t) {
    const [, end] = BEATS.agree;
    const resolve = BEATS.resolve[0];
    const resolving = t >= resolve;
    const visible = t < end || resolving;
    const { q, buttons, ring, tick } = s.agree;

    // The buttons grow out of Breakdown's middle bar as the loop closes.
    const morph = resolving ? ease.inOut(P(t, resolve + 0.02, resolve + 0.55)) : 1;
    const leave = resolving ? 0 : ease.inOut2(P(t, end - 0.26, end - 0.04));
    const copy = resolving ? ease.out(P(t, resolve + 0.22, resolve + 0.52)) : 1 - leave;
    const caption = resolving ? ease.out(P(t, resolve + 0.34, resolve + 0.54)) : 1;
    const rise = -leave * 18;

    place(q, { o: visible ? copy : 0, y: rise + (1 - copy) * (resolving ? 16 : 0) });

    const press = resolving ? 0 : ease.out(P(t, 0.74, 0.92));
    const sink = resolving ? 0 : bump(t, 0.74, 0.22);
    const y0 = BARS.rows[1];
    let barX = BARS.x;
    buttons.forEach((b, i) => {
      const share = BAR_SHARES[1][i] * BARS.w;
      const r = (side) => lerp(side ? BARS.r : 0, BUTTONS.r, morph);
      const left = r(i === 0);
      const right = r(i === 2);
      const face = {
        x: lerp(barX, b.x, morph),
        y: lerp(y0, BUTTONS.y, morph),
        w: lerp(share + (i < 2 ? 1 : 0), BUTTONS.w, morph),
        h: lerp(BARS.h, BUTTONS.h, morph),
      };
      b.face.setAttribute('d', rrect(face.x, face.y, face.w, face.h, left, right, right, left));
      b.face.setAttribute('fill', mixColor(C.stance[i], b.fill, morph));
      // Captions travel with their faces while the buttons take shape.
      place(b.caption, {
        o: caption,
        x: face.x + face.w / 2 - (b.x + BUTTONS.w / 2),
        y: face.y + face.h / 2 - (BUTTONS.y + BUTTONS.h / 2),
      });
      barX += share;
      const selected = i === 0;
      place(b.g, {
        o: visible ? (selected ? 1 : lerp(1, 0.4, press)) * (1 - leave) : 0,
        y: rise,
        s: selected ? 1 - 0.035 * sink : 1,
        cx: b.x + BUTTONS.w / 2,
        cy: BUTTONS.y + BUTTONS.h / 2,
      });
    });
    place(ring, { o: visible ? press * (1 - leave) : 0, y: rise });
    place(tick, { o: visible ? 1 - leave : 0, y: rise });
    draw(tick, !visible || resolving ? 0 : ease.out(P(t, 0.8, 0.98)));
  }

  function renderFree(t) {
    const scene = s.free;
    const [a] = BEATS.free;
    place(scene.q, beat(t, BEATS.free));
    const c = beat(t, BEATS.free, 0.04);
    place(scene.c, c);
    if (c.o <= 0) return;
    const count = Math.round(ANSWER.length * P(t, a + 0.36, a + 1.02));
    scene.typed.textContent = ANSWER.slice(0, count);
    scene.placeholder.setAttribute('opacity', n3(1 - P(t, a + 0.3, a + 0.38)));
    place(scene.caret, { o: P(t, a + 0.3, a + 0.36) });
    scene.caret.setAttribute('x', n3(560 + scene.typed.getComputedTextLength() + 4));
    // The microphone records while the words arrive.
    const listen = P(t, a + 0.24, a + 0.4) * (1 - P(t, a + 1.02, a + 1.24));
    const level = 0.5 + 0.5 * Math.sin(t * 19) * Math.sin(t * 7.3 + 1);
    scene.disc.setAttribute('r', n3(74 + 7 * level * listen));
    scene.disc.setAttribute('fill', mixColor(C.tealTint, C.recTint, listen));
    scene.mic.setAttribute('color', mixColor(C.teal, C.rec, listen));
  }

  function renderRate(t) {
    const scene = s.rate;
    const [a] = BEATS.rate;
    place(scene.q, beat(t, BEATS.rate));
    const c = beat(t, BEATS.rate, 0.04);
    place(scene.c, c);
    if (c.o <= 0) return;
    const value = 7 * ease.inOut(P(t, a + 0.24, a + 0.82));
    renderSlider(scene.slider, value / 10, value, bump(t, a + 0.24, 0.58));
  }

  function renderMulti(t) {
    const scene = s.multi;
    place(scene.q, beat(t, BEATS.multi));
    place(scene.c, beat(t, BEATS.multi, 0.04));
    renderCheckRows(scene.boxes, t, BEATS.multi[0]);
  }

  function renderQuad(t) {
    const scene = s.quad;
    place(scene.q, beat(t, BEATS.quad));
    const c = beat(t, BEATS.quad, 0.04);
    place(scene.c, c);
    if (c.o > 0) renderQuadRows(scene.rows, QUAD_STEPS, t);
  }

  function renderGroups(t) {
    const [a, b] = BEATS.groups;
    const { rows, lock, bars, badge, person, cx, personY } = s.groups;
    const starts = [0, 1, 2].map((i) => a - 0.06 + i * 0.22);
    rows.forEach((row, i) => {
      const enter = ease.out(P(t, starts[i], starts[i] + 0.36));
      const leave = ease.inOut2(P(t, b - 0.32 + i * 0.02, b - 0.1 + i * 0.02));
      const pose = { o: enter * (1 - leave), y: (1 - enter) * 26 - leave * 16 };
      place(row.icon, pose);
      place(row.label, pose);
    });
    // Access: the shackle closes. Filtering: the bars narrow. Membership: the holder appears.
    renderLock(lock, ease.inOut(P(t, starts[0] + 0.26, starts[0] + 0.52)), bump(t, starts[0] + 0.48, 0.2));
    bars.forEach((bar, i) => {
      const narrow = ease.inOut(P(t, starts[1] + 0.2 + i * 0.05, starts[1] + 0.56 + i * 0.05));
      const half = lerp(bars[0].half, bar.half, narrow);
      set(bar.node, { x: n3(cx - half), width: n3(half * 2) });
    });
    draw(badge, ease.inOut2(P(t, starts[2], starts[2] + 0.46)));
    const pop = ease.back(P(t, starts[2] + 0.26, starts[2] + 0.54));
    place(person, { o: P(t, starts[2] + 0.26, starts[2] + 0.34), s: lerp(0.72, 1, pop), cx, cy: personY });
  }

  function renderResults(t) {
    const [a] = BEATS.results;
    const resolve = BEATS.resolve[0];
    const live = t >= a - 0.1 && t < resolve + 0.3;
    const { opinionMap, breakdown, matrix } = s.results;
    const fade = 1 - ease.inOut2(P(t, resolve, resolve + 0.24));
    const label = (node, at) => {
      const p = ease.out(P(t, a + at, a + at + 0.3));
      place(node, { o: live ? p * fade : 0, y: (1 - p) * 12 });
    };
    label(opinionMap.label, 0.2);
    label(breakdown.label, 0.5);
    label(matrix.label, 1.05);

    renderOpinionMap(opinionMap, t, a, live ? fade : 0);

    // Breakdown: stacked bars grow left to right while their shares settle.
    breakdown.rows.forEach((paths, r) => {
      const grow = ease.inOut2(P(t, a + 0.02 + r * 0.1, a + 0.92 + r * 0.1));
      // The middle bar hands over to the Agree buttons as the loop closes.
      const hidden = !live || (r === 1 && t >= resolve);
      setBar(paths, BARS.x, BARS.rows[r], BARS.w, BARS.h, BARS.r, BAR_SHARES[r].map((v) => lerp(1 / 3, v, grow) * grow));
      paths.forEach((path) => place(path, { o: hidden || grow <= 0 ? 0 : r === 1 ? 1 : fade }));
    });

    // Analysis: axes draw, cells resolve from the origin, the plotted points land.
    place(matrix.g, { o: live ? fade : 0 });
    draw(matrix.up, ease.inOut2(P(t, a + 0.5, a + 0.95)));
    draw(matrix.right, ease.inOut2(P(t, a + 0.5, a + 0.95)));
    place(matrix.heads, { o: P(t, a + 0.85, a + 0.97) });
    matrix.cells.forEach(({ node, fill, cx, cy, rank }) => {
      const at = a + 0.75 + rank * 0.07;
      const p = ease.out(P(t, at, at + 0.28));
      node.setAttribute('fill', mixColor(C.tile, fill, p));
      place(node, { o: P(t, at, at + 0.08), s: lerp(0.84, 1, p), cx, cy });
    });
    matrix.dots.forEach(({ node, cx, cy }, i) => {
      const at = a + 1.55 + i * 0.07;
      place(node, { s: Math.max(ease.back(P(t, at, at + 0.22)), 0.001), cx, cy });
    });
  }

  function render(t) {
    renderDots(s.dots, t, shell(t), BEATS.groups[1]);
    renderCard(t);
    renderAgree(t);
    renderFree(t);
    renderRate(t);
    renderMulti(t);
    renderQuad(t);
    renderGroups(t);
    renderResults(t);
    return quadAt(QUAD_STEPS, t);
  }

  // Checks what a viewer would otherwise have to catch by eye, against the DOM.
  function verify() {
    const { duration, fps, beats, renderAtTime } = window.motion;
    const found = [];
    const settled = (scene) => beats[scene][1] - 0.3;
    const isShown = (n) => {
      for (let p = n; p && p.id !== 'stage'; p = p.parentNode) if (p.getAttribute('display') === 'none') return false;
      return true;
    };
    const squares = [...document.querySelectorAll('#stage rect[data-credit]')];
    const credit = [...document.querySelectorAll('#stage text')].find((n) => n.getAttribute('text-anchor') === 'end');
    const allocText = () => [...document.querySelectorAll('[data-alloc]')].map((n) => n.textContent).join();
    for (let i = 0; i < Math.round(duration * fps); i += 1) {
      const time = i / fps;
      const { alloc, total } = renderAtTime(time);
      // Re-derive the cost here, so a change to the formula in the kit cannot pass.
      if (total !== alloc.reduce((sum, n) => sum + n * n, 0)) found.push(`t=${time}: total ${total} != squares of ${alloc}`);
      if (Number(credit.textContent) !== total) found.push(`t=${time}: footer ${credit.textContent} != ${total}`);
      if (time > beats.quad[0] && time < beats.quad[1] - 0.1) {
        const shownCells = squares.filter(isShown).length;
        if (shownCells !== total) found.push(`t=${time}: ${shownCells} squares shown for total ${total}`);
        if (allocText() !== String(alloc)) found.push(`t=${time}: rows show ${allocText()} for ${alloc}`);
      }
    }
    renderAtTime(settled('quad'));
    if (allocText() !== '3,2,1' || credit.textContent !== '14') found.push(`quadratic ends at ${allocText()} = ${credit.textContent}`);
    renderAtTime(settled('rate'));
    const rating = document.querySelector('[data-value]').textContent;
    if (rating !== '7') found.push(`rating ends at ${rating}`);
    renderAtTime(settled('multi'));
    const checks = [...document.querySelectorAll('[data-check]')].map((n) => isShown(n) && n.getAttribute('opacity') === '1');
    if (String(checks) !== 'true,true,true') found.push(`checkboxes end at ${checks}`);
    return found;
  }

  film({
    duration: DURATION,
    beats: BEATS,
    headings: [
      ['Questions', ICON.question, BEATS.resolve[0] + 0.16],
      ['Groups', ICON.person, BEATS.groups[0]],
      ['Results', ICON.chart, BEATS.results[0]],
    ],
    colors: HEAT,
    seek: [0.9, 1.95, 3, 4.3, 5.9, 7.5, 8.7, 9.3, 10.6, 11.7, 13, 15],
    build,
    render,
    verify,
  });
})();
