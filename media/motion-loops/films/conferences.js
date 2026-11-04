/*
  For Events (12 s): everyone in the room answers, the participants gather into an
  opinion map, and the map keeps growing from one gathering to the next. All data
  is illustrative.
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
    el,
    group,
    text,
    place,
    shellAt,
    questionText,
    buildDots,
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
  const BEATS = { ask: [0, 3.2], map: [3.2, 11.3], resolve: [11.3, DURATION] };

  const BUTTONS = { x: 340, gap: 29, w: 394, y: 500, h: 180, r: 25 };
  const FACES = [
    ['Agree', C.agree, C.card],
    ['Unsure', C.unsure, C.unsureInk],
    ['Disagree', C.disagree, C.card],
  ];
  const MAP = { x: 500, y: 570, r: 235, inner: 100, orbit: 128 };
  const BARS = { x: 900, w: 760, h: 52, r: 13, y: [340, 490, 640] };
  // Where the room lands on three kinds of question, at each gathering.
  const ROWS = [
    { label: 'Consensus', days: [[0.82, 0.12, 0.06], [0.8, 0.14, 0.06], [0.84, 0.1, 0.06]] },
    { label: 'Subgroup differences', days: [[0.46, 0.1, 0.44], [0.5, 0.08, 0.42], [0.52, 0.1, 0.38]] },
    { label: 'Unresolved questions', days: [[0.2, 0.62, 0.18], [0.26, 0.5, 0.24], [0.3, 0.42, 0.28]] },
  ];

  const answerAt = (i) => 1.0 + ((i * 29) % 48) * 0.04;
  const flyAt = (i) => BEATS.map[0] - 0.04 + ((i * 11) % 48) * 0.012;
  const dayAt = (t) => ease.inOut(P(t, BEATS.map[0] + 3, BEATS.map[0] + 3.6)) + ease.inOut(P(t, BEATS.map[0] + 4.3, BEATS.map[0] + 4.9));

  // Members fill each group of the map from the centre outward.
  function memberAt(map, g, j) {
    const rr = Math.sqrt((j + 0.5) / 24) * 80;
    const angle = j * 2.39996;
    return { x: map.groups[g].x + rr * Math.cos(angle), y: map.groups[g].y + rr * Math.sin(angle) };
  }

  const s = {};

  function build(root) {
    // The map and the people sit under the card, so it covers them as it fades back in
    // and the returning dots never cross the question's text.
    s.map = buildOpinionMap(root, MAP, false);
    s.rows = ROWS.map(({ label }, i) => ({
      label: text(root, BARS.x, BARS.y[i] - 16, 46, 600, C.ink, label),
      paths: buildBar(root),
    }));
    s.line = buildTimeline(root, BARS.x, BARS.x + BARS.w, 808, ['Day 1', 'Day 2', 'Next gathering']);

    // The film's participants wait beside the card, then fly into the map's groups.
    s.dots = buildDots(root);
    s.dots.all.forEach((d, i) => {
      d.group = i % 3;
      d.home = memberAt(s.map, d.group, Math.floor(i / 3));
    });
    // Later gatherings add more people to each group.
    s.extras = Array.from({ length: 24 }, (_, i) => {
      const g = i % 3;
      const at = memberAt(s.map, g, 16 + Math.floor(i / 3));
      return { node: el(root, 'circle', { cx: at.x, cy: at.y, r: 9, fill: C.answers[g] }), x: at.x, y: at.y, day: i < 12 ? 1 : 2 };
    });

    s.shell = buildShell(root);
    s.comment = buildComment(root);
    s.lock = buildCardLock(root);
    s.q = questionText(root, ['Should this community', 'meet more often?']);
    s.buttons = FACES.map(([label, fill, ink], i) => {
      const x = BUTTONS.x + i * (BUTTONS.w + BUTTONS.gap);
      const g = group(root);
      el(g, 'path', { d: rrect(x, BUTTONS.y, BUTTONS.w, BUTTONS.h, BUTTONS.r), fill });
      text(g, x + BUTTONS.w / 2, BUTTONS.y + BUTTONS.h / 2 + 21, 60, 600, ink, label, 'middle');
      return { g, x };
    });
    s.ring = el(root, 'rect', {
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

  const shell = (t) => shellAt(t, BEATS.map[0], BEATS.resolve[0] + 0.1);

  function renderAsk(t) {
    const resolve = BEATS.resolve[0];
    const resolving = t >= resolve;
    const end = BEATS.ask[1];
    const back = ease.inOut2(P(t, resolve + 0.12, resolve + 0.52));
    const leave = resolving ? 0 : ease.inOut2(P(t, end - 0.26, end - 0.04));
    const pose = resolving ? { o: back, y: (1 - back) * 16 } : { o: 1 - leave, y: -leave * 18 };
    place(s.q, pose);
    place(s.lock, { o: pose.o });
    place(s.comment, { o: pose.o });
    const press = resolving ? 0 : ease.out(P(t, 0.6, 0.78));
    const sink = resolving ? 0 : bump(t, 0.6, 0.22);
    s.buttons.forEach(({ g, x }, i) => {
      place(g, {
        o: pose.o * (i === 0 ? 1 : lerp(1, 0.4, press)),
        y: pose.y,
        s: i === 0 ? 1 - 0.035 * sink : 1,
        cx: x + BUTTONS.w / 2,
        cy: BUTTONS.y + BUTTONS.h / 2,
      });
    });
    place(s.ring, { o: pose.o * press, y: pose.y });
  }

  function renderPeople(t) {
    const resolve = BEATS.resolve[0];
    const home = 1 - ease.inOut(P(t, resolve, resolve + 0.46));
    s.dots.all.forEach((d, i) => {
      const fly = ease.inOut(P(t, flyAt(i), flyAt(i) + 0.9)) * home;
      // Lights up as this person answers; the wave clears as they return for the loop.
      const answered = ease.out(P(t, answerAt(i), answerAt(i) + 0.2)) * home;
      d.dot.setAttribute('cx', n3(lerp(d.x, d.home.x, fly)));
      d.dot.setAttribute('cy', n3(lerp(d.y, d.home.y, fly)));
      d.dot.setAttribute('r', n3(lerp(10 + 2 * answered + 5 * bump(t, answerAt(i), 0.3), 9, fly)));
      d.dot.setAttribute('opacity', n3(lerp(0.28, 1, answered)));
      d.dot.setAttribute('fill', mixColor(d.fill, C.answers[d.group], fly));
    });
    const day = dayAt(t);
    const fade = 1 - ease.inOut2(P(t, resolve, resolve + 0.24));
    s.extras.forEach(({ node, x, y, day: joins }, i) => {
      const pop = ease.back(P(day, joins - 1 + (i % 12) * 0.04, joins - 1 + (i % 12) * 0.04 + 0.4));
      place(node, { o: pop > 0 ? fade : 0, s: Math.max(pop, 0.001), cx: x, cy: y });
    });
  }

  function renderMap(t) {
    const [a] = BEATS.map;
    const resolve = BEATS.resolve[0];
    const live = t >= a - 0.1 && t < resolve + 0.3;
    const fade = live ? 1 - ease.inOut2(P(t, resolve, resolve + 0.24)) : 0;
    renderOpinionMap(s.map, t, a, fade);
    const day = dayAt(t);
    const low = Math.min(Math.floor(day), 1);
    s.rows.forEach(({ label, paths }, i) => {
      const enter = ease.out(P(t, a + 0.7 + i * 0.25, a + 1 + i * 0.25));
      place(label, { o: enter * fade, y: (1 - enter) * 12 });
      const grow = ease.inOut2(P(t, a + 0.8 + i * 0.25, a + 1.5 + i * 0.25));
      const { days } = ROWS[i];
      const shares = days[low].map((v, k) => lerp(1 / 3, lerp(v, days[low + 1][k], day - low), grow) * grow);
      setBar(paths, BARS.x, BARS.y[i], BARS.w, BARS.h, BARS.r, shares);
      paths.forEach((path) => place(path, { o: grow > 0 ? fade : 0 }));
    });
    renderTimeline(s.line, day, ease.out(P(t, a + 2.2, a + 2.6)) * fade);
  }

  function render(t) {
    place(s.shell, { o: shell(t) });
    renderAsk(t);
    renderMap(t);
    renderPeople(t);
    return {};
  }

  film({
    duration: DURATION,
    beats: BEATS,
    headings: [
      ['Events', ICON.question, BEATS.resolve[0] + 0.16],
      ['Persistent Opinion Map', ICON.chart, BEATS.map[0]],
    ],
    seek: [0.3, 1, 2, 3, 3.6, 4.2, 5.3, 6.5, 7.8, 9, 11.5],
    build,
    render,
  });
})();
