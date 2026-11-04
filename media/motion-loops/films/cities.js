/*
  For Cities (12 s): residents weigh priorities with quadratic credits, and the
  answers become a standing record that can be filtered by constituency. All data
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
    mixColor,
    n3,
    rrect,
    el,
    group,
    text,
    place,
    shellAt,
    questionText,
    buildShell,
    buildCardLock,
    buildCredits,
    quadSteps,
    quadAt,
    buildQuadRows,
    renderQuadRows,
    film,
  } = window.Kit;

  const DURATION = 12;
  const BEATS = { ask: [0, 3.2], record: [3.2, 11.3], resolve: [11.3, DURATION] };

  const OPTIONS = ['Transit', 'Housing', 'Parks'];
  const STEPS = quadSteps(0.8, 0.18);

  // Share of credits by option, for each constituency filter in turn.
  const FILTERS = [
    { label: 'Everyone', shares: [0.46, 0.34, 0.2], member: () => true },
    { label: 'Renters', shares: [0.52, 0.4, 0.08], member: (i) => (i * 7) % 3 === 0 },
    { label: 'Owners', shares: [0.3, 0.28, 0.42], member: (i) => (i * 7) % 3 === 1 },
    { label: 'Seniors', shares: [0.58, 0.16, 0.26], member: (i) => (i * 5) % 4 === 0 },
  ];
  const switchAt = (i) => BEATS.record[0] + 0.1 + i * 1.5;

  const CHIP = { x: 260, gap: 20, w: 335, y: 270, h: 84 };
  const BAR = { label: 260, x: 560, w: 1000, h: 72, r: 18, y: [406, 530, 654] };
  const PEOPLE = { x: 262, pitch: 29, y: 820, r: 10, count: 48 };

  const s = {};

  function build(root) {
    s.shell = buildShell(root);
    s.lock = buildCardLock(root);
    s.credits = buildCredits(root);
    s.q = questionText(root, ['What should the city fund first?']);
    s.c = group(root);
    s.rows = buildQuadRows(s.c, OPTIONS);

    s.chips = FILTERS.map(({ label }, i) => {
      const x = CHIP.x + i * (CHIP.w + CHIP.gap);
      const g = group(root);
      const rect = el(g, 'rect', { x, y: CHIP.y, width: CHIP.w, height: CHIP.h, rx: CHIP.h / 2 });
      const word = text(g, x + CHIP.w / 2, CHIP.y + CHIP.h / 2 + 18, 50, 600, C.ink2, label, 'middle');
      return { g, rect, word };
    });
    s.bars = OPTIONS.map((label, i) => {
      const g = group(root);
      text(g, BAR.label, BAR.y[i] + 53, 58, 600, C.ink, label);
      el(g, 'rect', { x: BAR.x, y: BAR.y[i], width: BAR.w, height: BAR.h, rx: BAR.r, fill: C.tile });
      const fill = el(g, 'path', { fill: C.answers[i] });
      const value = text(g, 0, BAR.y[i] + 52, 50, 600, C.ink, '0%');
      return { g, fill, value };
    });
    s.people = group(root);
    s.dots = Array.from({ length: PEOPLE.count }, (_, i) =>
      el(s.people, 'circle', { cx: PEOPLE.x + i * PEOPLE.pitch, cy: PEOPLE.y, r: PEOPLE.r, fill: C.answers[(i * 5 + i * i) % 4] }),
    );
  }

  const shell = (t) => shellAt(t, BEATS.record[0], BEATS.resolve[0] + 0.1);

  function renderAsk(t) {
    const resolve = BEATS.resolve[0];
    const resolving = t >= resolve;
    const end = BEATS.ask[1];
    const back = ease.inOut2(P(t, resolve + 0.12, resolve + 0.52));
    const leave = resolving ? 0 : ease.inOut2(P(t, end - 0.26, end - 0.04));
    const pose = resolving ? { o: back, y: (1 - back) * 16 } : { o: 1 - leave, y: -leave * 18 };
    place(s.q, pose);
    place(s.c, pose);
    place(s.lock, { o: pose.o });
    place(s.credits.g, { o: pose.o });
    // Everything resets for the loop: frame 0 has nothing allocated.
    const T = resolving ? 0 : t;
    if (pose.o > 0) renderQuadRows(s.rows, STEPS, T);
    s.credits.total.textContent = quadAt(STEPS, T).total;
  }

  function renderRecord(t) {
    const [a] = BEATS.record;
    const resolve = BEATS.resolve[0];
    const live = t >= a - 0.06 && t < resolve + 0.3;
    const fade = live ? 1 - ease.inOut2(P(t, resolve, resolve + 0.24)) : 0;

    // How far along the filters we are: 0 Everyone, 1 Renters, 2 Owners, 3 Seniors.
    const at = FILTERS.reduce((sum, _, i) => (i ? sum + ease.inOut(P(t, switchAt(i), switchAt(i) + 0.42)) : sum), 0);
    const low = Math.min(Math.floor(at), FILTERS.length - 2);
    const mix = at - low;

    s.chips.forEach(({ g, rect, word }, i) => {
      const enter = ease.out(P(t, a - 0.06 + i * 0.06, a + 0.26 + i * 0.06));
      const on = 1 - Math.min(Math.abs(at - i), 1);
      place(g, { o: enter * fade, y: (1 - enter) * 16 });
      rect.setAttribute('fill', mixColor(C.tile, C.teal, on));
      word.setAttribute('fill', mixColor(C.ink2, C.card, on));
    });

    s.bars.forEach(({ g, fill, value }, i) => {
      const enter = ease.out(P(t, a + 0.1 + i * 0.08, a + 0.42 + i * 0.08));
      place(g, { o: enter * fade, y: (1 - enter) * 16 });
      const grow = ease.inOut2(P(t, a + 0.16 + i * 0.08, a + 0.86 + i * 0.08));
      const share = lerp(FILTERS[low].shares[i], FILTERS[low + 1].shares[i], mix) * grow;
      const width = Math.max(share * BAR.w, BAR.r * 2);
      fill.setAttribute('d', rrect(BAR.x, BAR.y[i], width, BAR.h, BAR.r));
      value.setAttribute('x', n3(BAR.x + width + 20));
      value.textContent = `${Math.round(share * 100)}%`;
    });

    place(s.people, { o: ease.out(P(t, a + 0.4, a + 0.8)) * fade });
    s.dots.forEach((dot, i) => {
      const state = (k) => (FILTERS[k].member(i) ? 1 : 0.16);
      dot.setAttribute('opacity', n3(lerp(state(low), state(low + 1), mix)));
    });
  }

  function render(t) {
    place(s.shell, { o: shell(t) });
    renderAsk(t);
    renderRecord(t);
    return {};
  }

  film({
    duration: DURATION,
    beats: BEATS,
    headings: [
      ['Cities', ICON.question, BEATS.resolve[0] + 0.16],
      ['Standing Public Record', ICON.chart, BEATS.record[0]],
    ],
    seek: [0.3, 1, 1.5, 2.5, 3.4, 4, 5.1, 6.5, 8, 10, 11.7],
    build,
    render,
  });
})();
