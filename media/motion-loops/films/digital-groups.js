/*
  For Groups (12 s): members answer, their preferences train a model that represents
  the group, and the group keeps its data attributable, licensable and revocable.
  This film shows a prospective direction, not a shipped feature. All data is
  illustrative.
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
    icon,
    stroke,
    draw,
    place,
    shellAt,
    questionText,
    buildCheckRows,
    renderCheckRows,
    buildDots,
    buildShell,
    buildComment,
    buildCardLock,
    film,
  } = window.Kit;

  const DURATION = 12;
  const BEATS = { ask: [0, 3.0], train: [3.0, 6.6], own: [6.6, 11.3], resolve: [11.3, DURATION] };

  const NODE = { size: 300, y: 500, x0: 960, x1: 500 };
  const RIGHTS = ['Attributable', 'Licensable', 'Revocable'];
  const TOGGLE = { x: 1520, w: 124, h: 68, y: [356, 516, 676] };
  const rightOn = (i) => BEATS.own[0] + 0.5 + i * 0.35;
  const revokeAt = BEATS.own[0] + 2.1;
  const restoreAt = BEATS.own[0] + 3.2;

  const flyAt = (i) => BEATS.train[0] + 0.1 + ((i * 11) % 48) * 0.045;

  const s = {};

  function build(root) {
    s.shell = buildShell(root);
    s.comment = buildComment(root);
    s.lock = buildCardLock(root);
    s.q = questionText(root, ['What should our group prioritize?']);
    s.c = group(root);
    s.boxes = buildCheckRows(s.c, [
      ['Open research', 0.5],
      ['Fair credit', 0.82],
      ['Member privacy', 1.14],
    ]);

    // The model: its outline fills as preferences arrive.
    s.node = group(root);
    const half = NODE.size / 2;
    el(s.node, 'rect', { x: -half, y: -half, width: NODE.size, height: NODE.size, rx: 44, fill: C.card, stroke: C.hair2, 'stroke-width': 8 });
    s.progress = stroke(s.node, 'rect', { x: -half, y: -half, width: NODE.size, height: NODE.size, rx: 44, stroke: C.teal, 'stroke-width': 8 });
    s.robot = icon(s.node, ICON.robot, -90, -90, 180, C.teal);
    s.revokedIcon = icon(s.node, ICON.lock, -90, -90, 180, C.ink2);
    s.modelLabel = text(s.node, 0, half + 88, 62, 600, C.ink, 'Group model', 'middle');
    s.revokedLabel = text(s.node, 0, half + 88, 62, 600, C.ink2, 'Access revoked', 'middle');

    s.rights = RIGHTS.map((label, i) => {
      const y = TOGGLE.y[i];
      const g = group(root);
      text(g, 860, y + TOGGLE.h / 2 + 24, 68, 600, C.ink, label);
      const track = el(g, 'path', { d: rrect(TOGGLE.x, y, TOGGLE.w, TOGGLE.h, TOGGLE.h / 2) });
      const knob = el(g, 'circle', { cy: y + TOGGLE.h / 2, r: 26, fill: C.card });
      return { g, track, knob };
    });

    s.dots = buildDots(root);
  }

  const shell = (t) => shellAt(t, BEATS.train[0], BEATS.resolve[0] + 0.1);

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
    place(s.comment, { o: pose.o });
    // Everything resets for the loop: frame 0 has nothing checked.
    renderCheckRows(s.boxes, resolving ? 0 : t, 0);
  }

  function renderPeople(t) {
    const [a] = BEATS.train;
    const resolve = BEATS.resolve[0];
    const resolving = t >= resolve;
    place(s.dots.g, { o: resolving ? P(t, resolve + 0.1, resolve + 0.44) : 1 });
    s.dots.all.forEach((d, i) => {
      // Each member lights up in the card's wave, then flies in to the model and is absorbed.
      const T = resolving ? 0 : t;
      const lit = ease.out(P(T, 0.5 + ((i * 7) % 48) * 0.04, 0.7 + ((i * 7) % 48) * 0.04));
      const fly = ease.inOut(P(T, flyAt(i), flyAt(i) + 0.8));
      d.dot.setAttribute('cx', n3(lerp(d.x, NODE.x0, fly)));
      d.dot.setAttribute('cy', n3(lerp(d.y, NODE.y, fly)));
      d.dot.setAttribute('r', n3(lerp(10 + 2 * lit, 7, fly)));
      d.dot.setAttribute('opacity', n3(T >= a && fly >= 1 ? 0 : lerp(0.28, 1, lit)));
    });
  }

  function renderModel(t) {
    const [a] = BEATS.train;
    const [own] = BEATS.own;
    const resolve = BEATS.resolve[0];
    const live = t >= a - 0.06 && t < resolve + 0.3;
    const fade = live ? 1 - ease.inOut2(P(t, resolve, resolve + 0.24)) : 0;
    const enter = ease.out(P(t, a - 0.06, a + 0.3));
    const x = lerp(NODE.x0, NODE.x1, ease.inOut(P(t, own, own + 0.6)));
    place(s.node, { o: enter * fade, x, y: NODE.y + (1 - enter) * 20 });
    draw(s.progress, ease.inOut2(P(t, a + 0.3, a + 3.0)));

    // Revoking the toggle shuts the model off; restoring it brings the model back.
    const revoked = ease.out(P(t, revokeAt, revokeAt + 0.24)) * (1 - ease.out(P(t, restoreAt, restoreAt + 0.24)));
    place(s.robot, { o: 1 - revoked });
    place(s.revokedIcon, { o: revoked });
    place(s.modelLabel, { o: P(t, a + 0.1, a + 0.4) * (1 - revoked) });
    place(s.revokedLabel, { o: revoked });

    s.rights.forEach(({ g, track, knob }, i) => {
      const at = rightOn(i);
      const rise = ease.out(P(t, at - 0.2, at + 0.1));
      place(g, { o: live ? rise * fade : 0, y: (1 - rise) * 16 });
      const on = ease.inOut2(P(t, at, at + 0.2)) * (i === 2 ? 1 - revoked : 1);
      track.setAttribute('fill', mixColor(C.hair2, C.teal, on));
      knob.setAttribute('cx', n3(lerp(TOGGLE.x + 34, TOGGLE.x + TOGGLE.w - 34, on)));
    });
  }

  function render(t) {
    place(s.shell, { o: shell(t) });
    renderAsk(t);
    renderModel(t);
    renderPeople(t);
    return {};
  }

  film({
    duration: DURATION,
    beats: BEATS,
    headings: [
      ['Groups', ICON.question, BEATS.resolve[0] + 0.16],
      ['Representative Models', ICON.robot, BEATS.train[0]],
    ],
    seek: [0.3, 0.7, 1.3, 2.5, 3.4, 4.6, 6.2, 7, 7.9, 9, 11.6],
    build,
    render,
  });
})();
