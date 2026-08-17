import {
  mergeCompareVennWithEvidence,
  normalizeCompareBullets,
  readCompareToolkitTask,
  resolveCompareToolkitPayload,
} from './aiCompareContracts';

describe('aiCompareContracts', () => {
  it('normalizes compare bullets with fallback and max-item semantics', () => {
    const fallback = {
      agreements: ['fallback agree'],
      disagreements: ['fallback disagree'],
    };

    expect(
      normalizeCompareBullets(
        {
          agreements: Array.from({ length: 13 }, (_, index) => `agree ${index}`),
          disagreements: ['disagree'],
        },
        fallback,
      ),
    ).toEqual({
      agreements: Array.from({ length: 12 }, (_, index) => `agree ${index}`),
      disagreements: ['disagree'],
    });
    expect(normalizeCompareBullets({ agreements: [] }, fallback)).toEqual(fallback);
  });

  it('keeps deterministic venn counts and evidence while accepting descriptive AI semantics', () => {
    const fallback = {
      counts: { a: 1, b: 0, c: 0, ab: 1, ac: 0, bc: 0, abc: 0 },
      semantics: 'fallback semantics',
      evidenceMap: {
        a: ['fallback a'],
        ab: ['fallback ab'],
      },
    };

    expect(
      mergeCompareVennWithEvidence(
        {
          counts: { a: 999, ab: 999 },
          semantics: 'AI description only',
          evidenceMap: { a: ['AI-selected membership'] },
        },
        fallback,
      ),
    ).toEqual({
      counts: { a: 1, b: 0, c: 0, ab: 1, ac: 0, bc: 0, abc: 0 },
      semantics: 'AI description only',
      evidenceMap: {
        a: ['fallback a'],
        ab: ['fallback ab'],
      },
    });
  });

  it('rejects venn candidates without a counts record', () => {
    expect(mergeCompareVennWithEvidence({ evidenceMap: {} }, { counts: {}, evidenceMap: {} })).toBeNull();
  });

  it('normalizes compare toolkit tasks and payloads without changing fallbacks', () => {
    expect(readCompareToolkitTask('DRILLDOWN')).toBe('drilldown');
    expect(readCompareToolkitTask(null)).toBe('');
    expect(
      resolveCompareToolkitPayload({
        pointText: 42,
        type: 'disagreement',
        users: Array.from({ length: 12 }, (_, index) => ({ address: `0x${index}` })),
      }),
    ).toEqual({
      pointText: '42',
      type: 'disagreement',
      users: Array.from({ length: 10 }, (_, index) => ({ address: `0x${index}` })),
    });
    expect(resolveCompareToolkitPayload({ type: 'other', users: 'not-users' })).toEqual({
      pointText: '',
      type: 'agreement',
      users: [],
    });
  });
});
