import { buildReportAnswerQuestions } from './polisReportAnswers';

const row = (type: string, value: unknown, responder = 'person-a', extra = {}) => ({
  responder,
  response: JSON.stringify({ type, prompt: 'Question', answer: { value }, ...extra }),
});

describe('Polis answer summaries', () => {
  it('counts zero ratings and neutral allocations but excludes empty, encrypted, invalid and out-of-session answers', () => {
    const result = buildReportAnswerQuestions(
      {
        rating: [
          row('rating', 0),
          row('rating', ''),
          row('rating', 11),
          row('rating', 4, 'person-b', { answer: { encrypted: true, value: '*' } }),
          row('rating', 5, 'person-c', { sessionSlug: 'other', sessionSlugExplicit: true }),
        ],
        quadratic: [row('quadratic', [0, 0]), row('quadratic', [10, 0], 'person-b')],
        text: [row('freeform', '   ')],
        invalid: [row('quadratic', [3])],
      },
      { quadratic: { type: 'quadratic', options: ['Garden', 'Bus'] } },
      { sessionSlug: 'current' },
    );
    expect(result.map((q) => [q.id, q.count])).toEqual([
      ['quadratic', 1],
      ['rating', 1],
    ]);
    expect(result[1].average).toBe(0);
    expect(result[0].options.map((option) => option.net)).toEqual([0, 0]);
  });

  it('uses canonical labels and custom budgets, sums signed votes, and counts multi-select respondents once', () => {
    const result = buildReportAnswerQuestions(
      {
        quadratic: [row('quadratic', [12, -5]), row('quadratic', [-2, 3], 'person-b')],
        multi: [row('multichoice', ['bus', 'Bus', 'Garden']), row('multichoice', 'Garden', 'person-b')],
        rating: [row('rating', 2), row('rating', 8, 'person-b'), row('rating', 8, 'PERSON-B')],
      },
      {
        quadratic: { type: 'quadratic', prompt: 'Canonical prompt', voiceCredits: 200, options: ['Garden', 'Bus'] },
        multi: { type: 'multichoice', options: ['Bus', 'Garden', 'Lighting'] },
      },
    );
    expect(result.find((q) => q.id === 'quadratic')).toMatchObject({
      count: 2,
      prompt: 'Canonical prompt',
      options: [
        { label: 'Garden', positive: 12, negative: -2, net: 10 },
        { label: 'Bus', positive: 3, negative: -5, net: -2 },
      ],
    });
    expect(result.find((q) => q.id === 'multi')).toMatchObject({
      count: 2,
      options: [{ count: 1 }, { count: 2 }, { count: 0 }],
    });
    expect(result.find((q) => q.id === 'rating')).toMatchObject({ count: 2, average: 5 });
  });

  it('sorts by valid response count and keeps simulated responses out of real reports', () => {
    const data = {
      a: [row('rating', 3)],
      b: [row('rating', 2), row('rating', 4, 'b')],
      c: [row('freeform', 'Demo text', 'c', { source: 'demo-polis-data' })],
    };
    expect(buildReportAnswerQuestions(data).map((q) => q.id)).toEqual(['b', 'a']);
    expect(buildReportAnswerQuestions(data, {}, { allowDemo: true }).map((q) => q.id)).toEqual(['b', 'a', 'c']);
  });
});
