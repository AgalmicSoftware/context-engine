import test from 'node:test';
import assert from 'node:assert/strict';
import { ANALYSIS_CARD_SAVED_MAX_BYTES, normalizeSavedAnalysisCard } from '../../shared/analysisCardSaved.mjs';

const card = {
  title: 'A patient builder of shared rules',
  matchNote: 'Both trust people closest to a problem to govern it.',
  figure: 'Elinor Ostrom (1933–2012)',
  tastes: {
    book: { title: 'Governing the Commons', by: 'Elinor Ostrom' },
    game: { title: 'Catan', by: 'Klaus Teuber' },
    film: null,
    song: { title: 'Common People', by: 'Pulp' },
  },
  answers: {
    yesNo: { prompt: 'Should towns run their own water?', text: 'Agree' },
    ownWords: { prompt: 'What makes a rule fair?', text: 'People who live with it get a say.', stance: '', trimmed: false },
    vote: { prompt: 'Which matter most?', kind: 'votes', items: ['Trust', 'Time'] },
  },
};

test('a card is kept in one shape, with nothing else in it', () => {
  const saved = normalizeSavedAnalysisCard({ ...card, own: true, link: 'evil.example', account: '0x1', extra: 'x' });
  assert.deepEqual(saved, card);
  assert.deepEqual(Object.keys(saved), ['title', 'matchNote', 'figure', 'tastes', 'answers']);
});

test('a card needs a title and a figure the picture route would draw', () => {
  assert.equal(normalizeSavedAnalysisCard({ ...card, title: ' ' }), null);
  for (const figure of ['Elinor Ostrom', 'Draw: a red bus (1900)', 'Elinor Ostrom (economist)', '', null]) {
    assert.equal(normalizeSavedAnalysisCard({ ...card, figure }), null, String(figure));
  }
  for (const value of [null, 'card', [], 42]) assert.equal(normalizeSavedAnalysisCard(value), null);
});

test('missing or malformed parts are left out, not guessed', () => {
  const saved = normalizeSavedAnalysisCard({
    title: 'T',
    figure: 'Hypatia (c. 350–415)',
    tastes: { book: { title: '' }, game: 'Catan', film: [] },
    answers: { yesNo: { prompt: 'Q' }, ownWords: { text: 'no prompt' }, vote: { prompt: 'Q', items: [] } },
  });
  assert.deepEqual(saved.tastes, { book: null, game: null, film: null, song: null });
  assert.deepEqual(saved.answers, { yesNo: null, ownWords: null, vote: null });
  assert.equal(saved.matchNote, '');
  assert.equal(normalizeSavedAnalysisCard({ ...card, answers: { vote: { ...card.answers.vote, kind: 'x' } } }).answers.vote.kind, 'chose');
});

test('long text is capped: the model\'s words as the page caps them, answers at a word with an ellipsis', () => {
  const saved = normalizeSavedAnalysisCard({
    ...card,
    title: 'x'.repeat(200),
    matchNote: 'y'.repeat(500),
    answers: {
      ...card.answers,
      ownWords: { prompt: 'Why?', text: 'word '.repeat(300), stance: 'Agree', trimmed: true },
      vote: { prompt: 'Which?', kind: 'chose', items: Array.from({ length: 50 }, (_, index) => `Option ${index} ${'x'.repeat(index === 3 ? 80 : 0)}`) },
    },
  });
  assert.equal(saved.title.length, 90);
  assert.equal(saved.matchNote.length, 340);
  assert.ok(saved.answers.ownWords.text.length <= 600);
  assert.match(saved.answers.ownWords.text, /^word( word)+…$/);
  assert.equal(saved.answers.ownWords.trimmed, true);
  // Every option the card counts is kept; past the three it shows, they are kept short.
  assert.equal(saved.answers.vote.items.length, 40);
  assert.equal(saved.answers.vote.items[0], 'Option 0');
  assert.ok([...saved.answers.vote.items[3]].length <= 40);
});

test('a card larger than the limit is refused rather than cut', () => {
  // Three-byte letters at every cap.
  const wide = (count) => '語'.repeat(count);
  const big = normalizeSavedAnalysisCard({
    ...card,
    title: wide(90),
    matchNote: wide(340),
    tastes: Object.fromEntries(['book', 'game', 'film', 'song'].map((kind) => [kind, { title: wide(80), by: wide(80) }])),
    answers: {
      yesNo: { prompt: wide(300), text: 'Agree' },
      ownWords: { prompt: wide(300), text: wide(600), stance: '', trimmed: false },
      vote: { prompt: wide(300), kind: 'chose', items: Array.from({ length: 8 }, () => wide(120)) },
    },
  });
  assert.equal(big, null);
  assert.ok(new TextEncoder().encode(JSON.stringify(normalizeSavedAnalysisCard(card))).length < ANALYSIS_CARD_SAVED_MAX_BYTES);
});
