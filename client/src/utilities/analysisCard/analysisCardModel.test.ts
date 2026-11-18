import { buildAnalysisCard, normalizeAnalysisCard } from './analysisCardModel';

const questions = [
  { id: 'q1', type: 'binary', prompt: 'Agencies should publish their AI audits.', answer: 'Agree' },
  {
    id: 'q2',
    type: 'binary',
    prompt: 'Cities should pause AI pilots.',
    answer: 'Disagree',
    additionalComment: 'Pauses punish the careful; “control” earns trust faster than delay.',
  },
  { id: 'q3', type: 'freeform', prompt: 'What would build trust?', answer: 'A named person who answers for it.' },
  { id: 'q4', type: 'multichoice', prompt: 'Where first?', answer: ['Scheduling', 'Translation'] },
  {
    id: 'q5',
    type: 'quadratic',
    prompt: 'Which projects?',
    options: ['An audit office', 'A citizens assembly', 'A public model'],
    voiceCredits: 99,
    answer: [3, -2, 3],
  },
  { id: 'q6', type: 'rating', prompt: 'How worried are you?', answer: 4 },
];

const analysis = (answers: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  historicalAlignment: { figure: 'Louis Brandeis (1856–1941)', reasoning: 'Why.' },
  card: {
    title: 'Accepts AI help, rejects automated enforcement.',
    matchNote: 'Defended privacy and challenged concentrated power through law.',
    tastes: {
      book: { title: 'The Franchise Affair', by: 'Josephine Tey, 1948', why: 'x' },
      game: { title: 'Return of the Obra Dinn', by: 'Lucas Pope, 2018', why: 'x' },
      film: { title: '', by: '', why: '' },
      song: { title: 'Fast Car', by: 'Tracy Chapman, 1988', why: 'x' },
    },
    answers,
    ...extra,
  },
});

describe('buildAnalysisCard', () => {
  it('shows the answers the analysis chose, in the words of the person', () => {
    const card = buildAnalysisCard(
      analysis({
        yesNo: { questionId: 'q2' },
        ownWords: { questionId: 'q2', quote: '"control" earns trust faster than delay.' },
        vote: { questionId: 'q5' },
      }),
      questions,
      { own: true, link: 'https://contextengine.sh/session/rxc-ra-2/', account: `0xCD96${'0'.repeat(32)}AB4B` },
    );

    expect(card).toMatchObject({
      own: true,
      link: 'contextengine.sh/session/rxc-ra-2',
      account: '0xcd96…ab4b',
      title: 'Accepts AI help, rejects automated enforcement',
      figure: 'Louis Brandeis (1856–1941)',
      figureName: 'Louis Brandeis',
      years: '1856–1941',
      tastes: {
        book: { title: 'The Franchise Affair', by: 'Josephine Tey, 1948' },
        film: null,
        song: { title: 'Fast Car', by: 'Tracy Chapman, 1988' },
      },
    });
    expect(card?.answers.yesNo).toEqual({ prompt: 'Cities should pause AI pilots.', text: 'Disagree' });
    // The quote matched the comment despite the different quote marks, and keeps the stance it was said with.
    expect(card?.answers.ownWords).toEqual({
      prompt: 'Cities should pause AI pilots.',
      text: '"control" earns trust faster than delay.',
      stance: 'Disagree',
      trimmed: true,
    });
    // A quadratic answer shows the options that got the most votes, not the numbers.
    expect(card?.answers.vote).toEqual({
      prompt: 'Which projects?',
      kind: 'votes',
      items: ['An audit office', 'A public model'],
    });
  });

  it('never shows words the person did not write, or an answer of the wrong kind', () => {
    const card = buildAnalysisCard(
      analysis({
        yesNo: { questionId: 'q3' },
        ownWords: { questionId: 'q3', quote: 'A named official must sign every decision.' },
        vote: { questionId: 'q6' },
      }),
      questions,
    );

    expect(card).toMatchObject({ own: false, link: 'contextengine.sh', account: '' });
    expect(card?.answers.yesNo).toEqual({ prompt: 'Agencies should publish their AI audits.', text: 'Agree' });
    // The invented quote is dropped for the person's whole answer to that question.
    expect(card?.answers.ownWords).toEqual({
      prompt: 'What would build trust?',
      text: 'A named person who answers for it.',
      stance: '',
      trimmed: false,
    });
    expect(card?.answers.vote).toEqual({ prompt: 'Where first?', kind: 'chose', items: ['Scheduling', 'Translation'] });
  });

  it.each([
    ['earns trust faster than delay', true],
    ['punish the careful', true],
    // Starting or ending inside a word could reverse what was said.
    ['unish the careful; “control”', false],
    ['earns trust faster than del', false],
    // Too short to stand for the answer.
    ['the careful', false],
  ])('shows the passage %p only as whole words of the comment: %p', (quote, shown) => {
    const card = buildAnalysisCard(
      analysis({ yesNo: { questionId: 'q1' }, ownWords: { questionId: 'q2', quote }, vote: { questionId: 'q4' } }),
      questions,
    );
    expect(card?.answers.ownWords?.trimmed).toBe(shown);
    expect(card?.answers.ownWords?.text).toBe(
      shown ? quote : 'Pauses punish the careful; “control” earns trust faster than delay.',
    );
  });

  it('does not let a quote start after a hyphen or apostrophe that joins a word', () => {
    const comment = 'This should be non-binding on members, and it isn’t anti-democratic to say so.';
    const shown = (quote: string) =>
      buildAnalysisCard(
        analysis({ yesNo: { questionId: '' }, ownWords: { questionId: 'q9', quote }, vote: { questionId: '' } }),
        [{ id: 'q9', type: 'freeform', prompt: 'What should the charter say?', answer: comment }],
      )?.answers.ownWords;

    expect(shown('binding on members')).toMatchObject({ text: comment, trimmed: false });
    expect(shown('democratic to say so')).toMatchObject({ text: comment, trimmed: false });
    expect(shown('non-binding on members')).toMatchObject({ text: 'non-binding on members', trimmed: true });
  });

  it('prints the site alone for a link too long to print, and never another site in its place', () => {
    const link = (value: string) => buildAnalysisCard(analysis({}), questions, { link: value })?.link;
    expect(link(`sessions.example.org/session/${'a'.repeat(90)}`)).toBe('sessions.example.org');
    expect(link('[::1]:3000/session/demo')).toBe('');
    expect(link('')).toBe('');
    // Read back from the cache, an unprintable link stays empty: it never turns into another site's name.
    const stored = buildAnalysisCard(analysis({}), questions, { link: '[::1]:3000/session/demo' });
    expect(normalizeAnalysisCard(JSON.parse(JSON.stringify(stored)))?.link).toBe('');
    expect(buildAnalysisCard(analysis({}), questions)?.link).toBe('contextengine.sh');
  });

  it('keeps what the model wrote to a length the card can set, and prints only a plain address', () => {
    const card = buildAnalysisCard(analysis({}, { title: 'word '.repeat(60), matchNote: 'x'.repeat(900) }), questions, {
      link: 'contextengine.sh/session/x?token=secret',
      account: 'not an address',
    });
    expect(card?.title.length).toBeLessThanOrEqual(90);
    expect(card?.matchNote).toHaveLength(340);
    expect(card?.link).toBe('contextengine.sh');
    expect(card?.account).toBe('');
  });

  it('leaves out a kind of answer the person never gave, and makes no card without a figure or title', () => {
    const card = buildAnalysisCard(
      analysis({ yesNo: { questionId: '' }, ownWords: { questionId: '', quote: '' }, vote: { questionId: '' } }),
      [questions[0]],
    );
    expect(card?.answers).toEqual({
      yesNo: { prompt: 'Agencies should publish their AI audits.', text: 'Agree' },
      ownWords: null,
      vote: null,
    });

    expect(buildAnalysisCard({ ...analysis({}), historicalAlignment: { figure: '' } }, questions)).toBeNull();
    expect(buildAnalysisCard(analysis({}, { title: ' ' }), questions)).toBeNull();
    expect(buildAnalysisCard({ historicalAlignment: { figure: 'Someone (1900–1950)' } }, questions)).toBeNull();
    expect(buildAnalysisCard(null, null)).toBeNull();
  });
});

describe('normalizeAnalysisCard', () => {
  it('reads a stored card back unchanged and drops malformed parts', () => {
    const card = buildAnalysisCard(
      analysis({ yesNo: { questionId: 'q1' }, ownWords: { questionId: 'q3', quote: '' }, vote: { questionId: 'q4' } }),
      questions,
      { own: true, link: 'localhost:3000/session/demo', account: `0x${'ab'.repeat(20)}` },
    );
    expect(card?.account).toBe('0xabab…abab');
    expect(normalizeAnalysisCard(JSON.parse(JSON.stringify(card)))).toEqual(card);

    const damaged = normalizeAnalysisCard({
      ...card,
      own: 'yes',
      tastes: { book: { title: 7 }, game: 'x' },
      answers: { yesNo: { prompt: 'Only a prompt' }, vote: { prompt: 'Where?', kind: 'other', items: ['A', 3, ''] } },
    });
    expect(damaged).toMatchObject({
      own: false,
      tastes: { book: { title: '7', by: '' }, game: null, film: null, song: null },
      answers: { yesNo: null, ownWords: null, vote: { prompt: 'Where?', kind: 'chose', items: ['A', '3'] } },
    });
    expect(normalizeAnalysisCard({ title: 'No figure' })).toBeNull();
    expect(normalizeAnalysisCard(undefined)).toBeNull();
  });
});
