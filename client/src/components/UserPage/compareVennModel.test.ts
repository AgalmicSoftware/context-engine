import { buildCompareVennModel, buildCompareVennPromptMap } from './compareVennModel';

describe('compareVennModel', () => {
  it('builds deterministic exclusive membership regions for three subjects', () => {
    const model = buildCompareVennModel({
      dimension: 3,
      labels: ['Alpha', 'Beta', 'Gamma'],
      sets: [new Set(['a-only', 'ab', 'abc']), new Set(['b-only', 'ab', 'abc']), new Set(['c-only', 'abc'])],
      users: [
        { sbts: [{ name: 'a-only' }, { name: 'ab' }, { name: 'abc' }] },
        { sbts: [{ name: 'b-only' }, { name: 'ab' }, { name: 'abc' }] },
        { sbts: [{ name: 'c-only' }, { name: 'abc' }] },
      ],
    });

    expect(model?.mode).toBe('membership');
    expect(Object.fromEntries(model?.regions.map((region) => [region.key, region.count]) || [])).toEqual({
      a: 1,
      b: 1,
      c: 1,
      ab: 1,
      ac: 0,
      bc: 0,
      abc: 1,
    });
    expect(model?.regions.find((region) => region.key === 'abc')?.label).toBe('Alpha, Beta & Gamma');
  });

  it('keeps opinion counts primary and attaches only the relevant subject votes to question details', () => {
    const model = buildCompareVennModel({
      dimension: 2,
      labels: ['Alpha', 'Beta'],
      sets: [new Set(['builders']), new Set(['builders'])],
      users: [
        {
          questions: [{ id: 'question-one', type: 'binary', answer: 'agree', prompt: 'Build the park?' }],
          sbts: [{ name: 'Builders', image: 'https://arweave.net/builders' }],
        },
        {
          questions: [{ id: 'question-one', type: 'binary', answer: 'disagree', prompt: 'Build the park?' }],
          sbts: [{ name: 'builders' }],
        },
      ],
      preCounts: { a: 0, b: 0, ab: 1 },
      evidence: { ab: ['question-one (+)', 'Builders'] },
      semantics: 'Deterministic opinion overlap.',
    });

    const intersection = model?.regions.find((region) => region.key === 'ab');
    expect(model?.mode).toBe('opinion');
    expect(intersection?.count).toBe(1);
    expect(intersection?.items).toEqual([
      expect.objectContaining({
        type: 'question',
        id: 'question-one',
        prompt: 'Build the park?',
        votes: [1, -1],
      }),
      expect.objectContaining({
        type: 'membership',
        name: 'Builders',
        image: 'https://arweave.net/builders',
      }),
    ]);
  });

  it('fills missing user prompts from the already session-scoped cache values', () => {
    const promptMap = buildCompareVennPromptMap(
      [{ questions: [{ id: 'q-user', prompt: 'User prompt' }, { id: 'q-cache' }] }],
      [
        {
          11155420: {
            questions: {
              'q-cache': { id: 'q-cache', prompt: 'Cached session prompt' },
            },
          },
        },
      ],
    );

    expect(promptMap.get('q-user')).toBe('User prompt');
    expect(promptMap.get('q-cache')).toBe('Cached session prompt');
  });
});
