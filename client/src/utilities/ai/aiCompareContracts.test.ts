import { normalizeCompareBullets, readCompareToolkitTask, resolveCompareToolkitPayload } from './aiCompareContracts';

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

  it('normalizes compare toolkit tasks and bounds payload users', () => {
    expect(readCompareToolkitTask('AXES')).toBe('axes');
    expect(readCompareToolkitTask(null)).toBe('');
    expect(
      resolveCompareToolkitPayload({
        users: Array.from({ length: 12 }, (_, index) => ({ address: `0x${index}` })),
      }),
    ).toEqual({
      users: Array.from({ length: 10 }, (_, index) => ({ address: `0x${index}` })),
    });
    expect(resolveCompareToolkitPayload({ users: 'not-users' })).toEqual({ users: [] });
  });
});
