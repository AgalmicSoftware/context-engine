import { mergeCompareVennWithEvidence, normalizeCompareBullets } from './aiCompareContracts';

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

  it('merges venn model counts while preserving fallback evidence for positive empty regions', () => {
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
          counts: { a: 2, ab: 1 },
          semantics: '',
          evidenceMap: { a: [] },
        },
        fallback,
      ),
    ).toEqual({
      counts: { a: 2, b: 0, c: 0, ab: 1, ac: 0, bc: 0, abc: 0 },
      semantics: 'fallback semantics',
      evidenceMap: {
        a: ['fallback a'],
        ab: ['fallback ab'],
      },
    });
  });

  it('rejects venn candidates without a counts record', () => {
    expect(mergeCompareVennWithEvidence({ evidenceMap: {} }, { counts: {}, evidenceMap: {} })).toBeNull();
  });
});
