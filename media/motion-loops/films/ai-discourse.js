/*
  For AI Discourse (12 s): a yes-or-no question about a data center in your community
  opens into what it would actually change, and the answers become a public map whose
  disagreement stays legible over time. All data is illustrative.
*/
(function () {
  'use strict';

  const {
    C,
    ICON,
    lerp,
    P,
    ease,
    mixColor,
    rrect,
    el,
    group,
    text,
    place,
    beat,
    shellAt,
    questionText,
    buildDots,
    renderDots,
    buildShell,
    buildComment,
    buildCardLock,
    buildOpinionMap,
    renderOpinionMap,
    buildBar,
    setBar,
    buildTimeline,
    renderTimeline,
    film,
  } = window.Kit;

  const DURATION = 12;
  const BEATS = { slogans: [0, 2.4], issues: [2.4, 5.8], map: [5.8, 11.3], resolve: [11.3, DURATION] };

  const SLOGANS = [
    { label: 'Yes', x: 340, fill: C.answers[0] },
    { label: 'No', x: 975, fill: C.answers[2] },
  ];
  const SLOGAN = { y: 470, w: 605, h: 240, r: 25 };
  const ROW = { x: 340, w: 1240, h: 98, r: 22, y: [368, 478, 588, 698] };

  // One answer per issue, picked in turn: 0 better, 1 unsure, 2 worse.
  const ISSUES = [
    { label: 'Jobs', pick: 0, years: [[0.5, 0.2, 0.3], [0.42, 0.26, 0.32], [0.34, 0.24, 0.42]] },
    { label: 'Water use', pick: 2, years: [[0.22, 0.2, 0.58], [0.2, 0.16, 0.64], [0.16, 0.14, 0.7]] },
    { label: 'Power bills', pick: 1, years: [[0.35, 0.45, 0.2], [0.44, 0.34, 0.22], [0.55, 0.24, 0.21]] },
    { label: 'Local benefits', pick: 0, years: [[0.62, 0.24, 0.14], [0.66, 0.2, 0.14], [0.7, 0.18, 0.12]] },
  ];
  const pickAt = (i) => BEATS.issues[0] + 0.36 + i * 0.58;
  const STANCES = [
    { label: 'Better', fill: C.stance[0], ink: C.card },
    { label: 'Unsure', fill: C.stance[1], ink: C.unsureInk },
    { label: 'Worse', fill: C.stance[2], ink: C.card },
  ];
  const CHIP = { x: [930, 1140, 1350], w: 196, h: 62 };

  const MAP = { x: 500, y: 570, r: 215, inner: 92, orbit: 118 };
  const BARS = { label: 800, x: 1140, w: 520, h: 48, r: 12, y: [378, 478, 578, 678] };

  const ANSWERED = [
    [1, 4, pickAt(0)],
    [2, 2, pickAt(1)],
    [1, 8, pickAt(2)],
    [2, 9, pickAt(3)],
  ];

  const s = {};

  function build(root) {
    s.dots = buildDots(root, ANSWERED);
    s.shell = buildShell(root);
    s.comment = buildComment(root);
    s.lock = buildCardLock(root);

    s.q1 = questionText(root, ['Should a data center come', 'to your community?']);
    s.q2 = questionText(root, ['How would it affect each?']);

    // Each answer's face opens into two issue rows, on the same paths.
    s.rows = ISSUES.map((issue, i) => {
      const g = group(root);
      const face = el(g, 'path', { 'stroke-width': 3 });
      const content = group(g);
      const y = ROW.y[i];
      text(content, ROW.x + 40, y + ROW.h / 2 + 18, 52, 500, C.ink, issue.label);
      const chips = STANCES.map((stance, k) => {
        const rect = el(content, 'rect', { x: CHIP.x[k], y: y + (ROW.h - CHIP.h) / 2, width: CHIP.w, height: CHIP.h, rx: CHIP.h / 2 });
        const word = text(content, CHIP.x[k] + CHIP.w / 2, y + ROW.h / 2 + 13, 36, 600, C.ink2, stance.label, 'middle');
        return { rect, word };
      });
      return { g, face, content, chips };
    });
    s.captions = SLOGANS.map(({ label, x }) => text(root, x + SLOGAN.w / 2, SLOGAN.y + SLOGAN.h / 2 + 24, 68, 600, C.card, label, 'middle'));

    s.map = buildOpinionMap(root, MAP);
    s.mapLabel = text(root, MAP.x, 856, 54, 600, C.ink, 'Opinion Map', 'middle');
    s.bars = ISSUES.map((issue, i) => ({
      label: text(root, BARS.label, BARS.y[i] + 38, 44, 500, C.ink, issue.label),
      paths: buildBar(root),
    }));
    s.line = buildTimeline(root, BARS.label, BARS.x + BARS.w, 810, ['Year 1', 'Year 2', 'Year 3']);
  }

  const shell = (t) => shellAt(t, BEATS.map[0], BEATS.resolve[0] + 0.1);

  function renderQuestionCard(t) {
    const resolve = BEATS.resolve[0];
    const resolving = t >= resolve;
    const end = BEATS.issues[1];
    const copy = resolving ? ease.inOut2(P(t, resolve + 0.12, resolve + 0.52)) : 1;
    const opened = resolving ? 0 : ease.inOut(P(t, 1.5, 2.3));

    // The question that frames two sides gives way to the one that asks about each,
    // clearing its second line before the rising rows reach it.
    const swap = ease.inOut2(P(t, 1.6, 1.82));
    place(s.q1, { o: resolving ? copy : t < 1.9 ? 1 - swap : 0, y: resolving ? (1 - copy) * 16 : -swap * 18 });
    place(s.q2, resolving ? { o: 0 } : beat(t, [1.88, end]));

    const out = 1 - ease.inOut2(P(t, end - 0.24, end - 0.04));
    place(s.lock, { o: resolving ? copy : out });
    place(s.comment, { o: resolving ? copy : out });

    const leave = resolving ? 0 : ease.inOut2(P(t, end - 0.26, end - 0.04));
    ISSUES.forEach((issue, i) => {
      const row = s.rows[i];
      const from = SLOGANS[i < 2 ? 0 : 1];
      const face = {
        x: lerp(from.x, ROW.x, opened),
        y: lerp(SLOGAN.y, ROW.y[i], opened),
        w: lerp(SLOGAN.w, ROW.w, opened),
        h: lerp(SLOGAN.h, ROW.h, opened),
        r: lerp(SLOGAN.r, ROW.r, opened),
      };
      const picked = resolving ? 0 : ease.out(P(t, pickAt(i), pickAt(i) + 0.16));
      row.face.setAttribute('d', rrect(face.x, face.y, face.w, face.h, face.r));
      const rest = mixColor(C.card, C.rowOnFill, picked);
      row.face.setAttribute('fill', opened < 1 ? mixColor(from.fill, C.card, opened) : rest);
      row.face.setAttribute('stroke', opened < 1 ? mixColor(from.fill, C.hair2, opened) : mixColor(C.hair2, C.rowOn, picked));
      // Before it opens, each answer is one shape: a second copy under it would double its fade.
      const hidden = opened <= 0 && i % 2 === 1;
      place(row.g, { o: hidden ? 0 : (resolving ? copy : t < end ? 1 : 0) * (1 - leave), y: (resolving ? (1 - copy) * 16 : 0) - leave * 18 });
      place(row.content, { o: resolving ? 0 : P(t, 2.08, 2.34) });
      row.chips.forEach(({ rect, word }, k) => {
        const on = k === issue.pick ? picked : 0;
        rect.setAttribute('fill', mixColor(C.tile, STANCES[k].fill, on));
        word.setAttribute('fill', mixColor(C.ink2, STANCES[k].ink, on));
      });
    });
    s.captions.forEach((caption, i) => {
      const fade = resolving ? ease.out(P(t, resolve + 0.3, resolve + 0.52)) : 1 - P(t, 1.5, 1.72);
      place(caption, { o: fade, y: resolving ? (1 - copy) * 16 : 0 });
    });
  }

  function renderMap(t) {
    const [a] = BEATS.map;
    const resolve = BEATS.resolve[0];
    const live = t >= a - 0.1 && t < resolve + 0.3;
    const fade = live ? 1 - ease.inOut2(P(t, resolve, resolve + 0.24)) : 0;
    renderOpinionMap(s.map, t, a, fade);
    const label = ease.out(P(t, a + 0.3, a + 0.6));
    place(s.mapLabel, { o: label * fade, y: (1 - label) * 12 });

    // Disagreement stays legible as the marker moves through the years.
    const year = ease.inOut(P(t, a + 2.2, a + 2.8)) + ease.inOut(P(t, a + 3.3, a + 3.9));
    s.bars.forEach(({ label: name, paths }, i) => {
      const enter = ease.out(P(t, a + 0.1 + i * 0.1, a + 0.4 + i * 0.1));
      place(name, { o: enter * fade, y: (1 - enter) * 12 });
      const grow = ease.inOut2(P(t, a + 0.2 + i * 0.1, a + 0.95 + i * 0.1));
      const { years } = ISSUES[i];
      const low = Math.min(Math.floor(year), 1);
      const shares = years[low].map((v, k) => lerp(1 / 3, lerp(v, years[low + 1][k], year - low), grow) * grow);
      setBar(paths, BARS.x, BARS.y[i], BARS.w, BARS.h, BARS.r, shares);
      paths.forEach((path) => place(path, { o: grow > 0 ? fade : 0 }));
    });
    renderTimeline(s.line, year, ease.out(P(t, a + 1.0, a + 1.4)) * fade);
  }

  function render(t) {
    renderDots(s.dots, t, shell(t), BEATS.map[1]);
    place(s.shell, { o: shell(t) });
    renderQuestionCard(t);
    renderMap(t);
    return {};
  }

  film({
    duration: DURATION,
    beats: BEATS,
    headings: [
      ['AI Discourse', ICON.question, BEATS.resolve[0] + 0.16],
      ['Durable Public Map', ICON.chart, BEATS.map[0]],
    ],
    seek: [0.5, 1.8, 2.3, 3, 4, 5.6, 6.2, 7, 8.4, 9.3, 11.6],
    build,
    render,
  });
})();
