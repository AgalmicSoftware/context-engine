/*
  For Companies (11.4 s): a forecast with its confidence and assumption is recorded and
  sealed with a timestamp. Once the outcome is known, the good predictors on the topic
  are identified without revealing who they are or what they forecast. This shows a
  prospective direction: evaluation while still encrypted is on the roadmap. All data
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
    el,
    group,
    text,
    icon,
    place,
    questionText,
    optionRow,
    lightRow,
    buildShell,
    buildComment,
    buildCardLock,
    buildSlider,
    renderSlider,
    buildTimeline,
    renderTimeline,
    film,
  } = window.Kit;

  const DURATION = 11.4;
  const BEATS = { predict: [0, 3.8], seal: [3.8, 6.6], score: [6.6, 10.6], resolve: [10.6, DURATION] };

  const ANSWER = 'Supplier ships on time';
  const CHOICE = { y: 366, h: 104, w: 605, r: 20, x: [340, 975] };
  const SLIDER = { x0: 490, x1: 1420, y: 634, low: '0%', high: '100%', lowX: 392, highX: 1502, suffix: '%', tag: 160 };
  const FIELD = { x: 340, y: 700, w: 1240, h: 116, r: 18 };

  const ROW = { y: [366, 474, 582, 690], h: 96 };
  // Forecasts other than your own are never shown; each row is only a sealed entry.
  const FORECASTS = [
    { mask: 540, stamp: 'Mar 12, 09:41', top: false },
    { mask: 500, stamp: 'Mar 12, 11:05', top: true },
    { mask: 520, stamp: 'Mar 13, 08:30', top: false },
    { mask: 470, stamp: 'Mar 14, 16:22', top: true },
  ];
  const OWN = `Yes · 70% · ${ANSWER}`;
  const PILL = { x: 1010, w: 440, h: 58 };
  const scoreAt = (i) => BEATS.score[0] + 0.6 + i * 0.4;

  const s = {};

  function buildPredict(root) {
    const c = group(root);
    const faces = ['Yes', 'No'].map((label, i) => ({
      rect: el(c, 'rect', { x: CHOICE.x[i], y: CHOICE.y, width: CHOICE.w, height: CHOICE.h, rx: CHOICE.r, 'stroke-width': 3 }),
      word: text(c, CHOICE.x[i] + CHOICE.w / 2, CHOICE.y + CHOICE.h / 2 + 20, 56, 600, C.ink, label, 'middle'),
    }));
    const slider = buildSlider(c, SLIDER);
    el(c, 'rect', { x: FIELD.x, y: FIELD.y, width: FIELD.w, height: FIELD.h, rx: FIELD.r, fill: C.field, stroke: C.hair2, 'stroke-width': 3 });
    const baseline = FIELD.y + FIELD.h / 2 + 16;
    const placeholder = text(c, FIELD.x + 40, baseline, 46, 400, C.soft, 'Assumptions…');
    const typed = text(c, FIELD.x + 40, baseline, 46, 400, C.ink, '');
    const caret = el(c, 'rect', { y: baseline - 40, width: 5, height: 54, rx: 2, fill: C.teal });
    s.predict = { c, faces, slider, placeholder, typed, caret };
  }

  function buildLedger(root) {
    s.ledger = FORECASTS.map((forecast, i) => {
      const y = ROW.y[i];
      const mid = y + ROW.h / 2;
      const g = group(root);
      const row = optionRow(g, y, ROW.h);
      const avatar = el(g, 'circle', { cx: 392, cy: mid, r: 24 });
      const words = i === 0 ? text(g, 438, mid + 14, 40, 500, C.ink, OWN) : null;
      const mask = el(g, 'rect', { x: 438, y: mid - 17, height: 34, rx: 17, fill: C.hair2 });
      const stamp = text(g, 1450, mid + 13, 34, 500, C.ink2, forecast.stamp, 'end');
      icon(g, ICON.lock, 1486, mid - 26, 52, C.ink2);
      const pill = group(g);
      el(pill, 'rect', { x: PILL.x, y: mid - PILL.h / 2, width: PILL.w, height: PILL.h, rx: PILL.h / 2, fill: C.pos });
      text(pill, PILL.x + PILL.w / 2, mid + 12, 32, 600, C.card, 'Top predictor on launches', 'middle');
      return { g, row, avatar, words, mask, stamp, pill };
    });
    s.sealedNote = group(root);
    icon(s.sealedNote, ICON.lock, 340, 862, 50, C.ink2);
    text(s.sealedNote, 402, 900, 42, 500, C.ink2, 'Sealed until the outcome is known');
    s.line = buildTimeline(root, 1200, 1570, 870, ['Mar', 'Jun', 'Sep']);
    s.outcome = group(root);
    el(s.outcome, 'path', { d: 'M344 888L358 902L386 870', fill: 'none', stroke: C.pos, 'stroke-width': 9, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    text(s.outcome, 402, 900, 42, 600, C.ink, 'Outcome: launched in Q3');
    s.found = group(root);
    icon(s.found, ICON.lock, 340, 862, 50, C.pos);
    text(s.found, 402, 900, 42, 600, C.ink, 'Good predictors found. Identities stay sealed.');
  }

  function build(root) {
    s.shell = buildShell(root);
    s.comment = buildComment(root);
    s.cardLock = buildCardLock(root);
    s.q = questionText(root, ['Will we launch by Q3?']);
    buildPredict(root);
    buildLedger(root);
  }

  function renderPredict(t) {
    const resolve = BEATS.resolve[0];
    const resolving = t >= resolve;
    const back = ease.inOut2(P(t, resolve + 0.12, resolve + 0.52));
    const leave = resolving ? 0 : ease.inOut2(P(t, BEATS.predict[1] - 0.26, BEATS.predict[1] - 0.04));
    const c = resolving ? { o: back, y: (1 - back) * 16 } : { o: 1 - leave, y: -leave * 18 };
    place(s.predict.c, c);
    place(s.comment, { o: c.o });
    place(s.cardLock, { o: c.o });
    if (c.o <= 0) return;
    // Everything resets for the loop: the same card as frame 0, with nothing answered.
    const T = resolving ? 0 : t;
    const { faces, slider, placeholder, typed, caret } = s.predict;
    const yes = ease.out(P(T, 0.5, 0.68));
    faces[0].rect.setAttribute('fill', mixColor(C.card, C.teal, yes));
    faces[0].rect.setAttribute('stroke', mixColor(C.hair2, C.teal, yes));
    faces[0].word.setAttribute('fill', mixColor(C.ink, C.card, yes));
    faces[1].rect.setAttribute('fill', C.card);
    faces[1].rect.setAttribute('stroke', C.hair2);
    faces[1].word.setAttribute('fill', mixColor(C.ink, C.soft, yes));
    const value = 70 * ease.inOut(P(T, 1.0, 1.62));
    renderSlider(slider, value / 100, value, bump(T, 1.0, 0.62));
    typed.textContent = ANSWER.slice(0, Math.round(ANSWER.length * P(T, 2.0, 2.8)));
    placeholder.setAttribute('opacity', n3(1 - P(T, 1.94, 2.02)));
    place(caret, { o: P(T, 1.94, 2.0) });
    caret.setAttribute('x', n3(FIELD.x + 40 + typed.getComputedTextLength() + 4));
  }

  function renderLedger(t) {
    const [a] = BEATS.seal;
    const [score] = BEATS.score;
    const resolve = BEATS.resolve[0];
    const fade = 1 - ease.inOut2(P(t, resolve, resolve + 0.24));
    const live = t >= a - 0.06 && t < resolve + 0.3;
    s.ledger.forEach(({ g, row, avatar, words, mask, stamp, pill }, i) => {
      const at = i === 0 ? a - 0.06 : a + 0.5 + i * 0.18;
      const enter = ease.out(P(t, at, at + 0.32));
      place(g, { o: live ? enter * fade : 0, y: (1 - enter) * 20 });
      // Your own entry is visible only until it is sealed; nobody's is ever opened again.
      const sealed = i === 0 ? ease.inOut(P(t, a + 0.5, a + 0.9)) : 1;
      mask.setAttribute('width', n3(Math.max(FORECASTS[i].mask * sealed, 0.01)));
      place(mask, { o: sealed > 0.01 ? 1 : 0 });
      if (words) words.setAttribute('opacity', n3(1 - P(sealed, 0.3, 0.9)));
      avatar.setAttribute('fill', mixColor(C.answers[0], C.hair2, sealed));
      // Each sealed entry is scored in turn; only the good predictors are marked.
      const check = bump(t, scoreAt(i), 0.36);
      const won = FORECASTS[i].top ? ease.out(P(t, scoreAt(i) + 0.18, scoreAt(i) + 0.4)) : 0;
      lightRow(row, Math.max(won, 0.7 * check));
      place(stamp, { o: 1 - won });
      place(pill, { o: won, s: lerp(0.9, 1, won), cx: PILL.x + PILL.w / 2, cy: ROW.y[i] + ROW.h / 2 });
    });
    const note = ease.out(P(t, a + 0.8, a + 1.1)) * (1 - ease.inOut2(P(t, score - 0.1, score + 0.06)));
    place(s.sealedNote, { o: note });
    renderTimeline(s.line, 2 * ease.inOut(P(t, a + 1.2, a + 2.5)), note);
    const foundAt = scoreAt(3) + 0.5;
    const done = ease.out(P(t, score + 0.08, score + 0.34)) * (1 - ease.inOut2(P(t, foundAt - 0.14, foundAt)));
    place(s.outcome, { o: live ? done * fade : 0, y: (1 - done) * 12 });
    const found = ease.out(P(t, foundAt + 0.02, foundAt + 0.3));
    place(s.found, { o: live ? found * fade : 0, y: (1 - found) * 12 });
  }

  function render(t) {
    renderPredict(t);
    renderLedger(t);
    return {};
  }

  film({
    duration: DURATION,
    beats: BEATS,
    headings: [
      ['Companies', ICON.question, BEATS.resolve[0] + 0.16],
      ['Private Forecasting', ICON.lock, BEATS.seal[0]],
    ],
    seek: [0.3, 1.3, 2.5, 3.3, 4, 4.9, 5.8, 6.9, 7.5, 8.3, 11],
    build,
    render,
  });
})();
