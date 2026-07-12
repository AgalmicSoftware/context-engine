import { queryKeys } from './queryKeys';

describe('queryKeys', () => {
  const appScope = { scope: 'ce-app', persist: false };

  it('builds stable tuples with fixed scope slots', () => {
    expect(Object.isFrozen(queryKeys)).toBe(true);
    expect(queryKeys.domain('sbt')).toEqual([appScope, 'sbt']);
    expect(queryKeys.entity('sbt', 'holders')).toEqual([appScope, 'sbt', 'holders']);
    expect(
      queryKeys.scoped('sbt', 'holders', {
        chainId: '11155420',
        sessionSlug: ' demo-session ',
        address: '0xAbCd',
        ids: ['token-1', 7, true, null],
      }),
    ).toEqual([appScope, 'sbt', 'holders', 11155420, 'demo-session', '0xabcd', 'token-1', 7, true, null]);
    expect(queryKeys.scoped('session', 'registry', {})).toEqual([
      appScope,
      'session',
      'registry',
      null,
      null,
      null,
    ]);
  });

  it('copies scalar inputs instead of retaining scope or ids identity', () => {
    const ids: Array<string | number> = ['question-1', 2];
    const scope = {
      chainId: 10,
      sessionSlug: 'alpha',
      address: '0xABC',
      ids,
    };
    const key = queryKeys.scoped('survey', 'questions', scope);

    scope.sessionSlug = 'beta';
    ids[0] = 'question-2';

    expect(key).toEqual([appScope, 'survey', 'questions', 10, 'alpha', '0xabc', 'question-1', 2]);
    expect(key.slice(1).every((part) => part === null || ['string', 'number', 'boolean'].includes(typeof part))).toBe(
      true,
    );
    expect(Object.isFrozen(key)).toBe(true);
  });

  it('opts every app query key family out of wagmi persistence', () => {
    const keys = [
      queryKeys.domain('sessions'),
      queryKeys.entity('sessions', 'registry'),
      queryKeys.scoped('sessions', 'registry', { chainId: 11155420 }),
    ];

    keys.forEach((key) => {
      expect(key[0]).toEqual(appScope);
      expect(key[0].persist).toBe(false);
    });
  });

  it('fails wagmi 0.9 dehydration eligibility for every app key family', () => {
    const shouldDehydrateQuery = (query: { cacheTime: number; queryKey: readonly any[] }) =>
      query.cacheTime !== 0 && query.queryKey[0].persist !== false;

    [queryKeys.domain('sessions'), queryKeys.entity('sessions', 'registry'), queryKeys.scoped('sessions', 'registry')]
      .map((queryKey) => ({ cacheTime: 24 * 60 * 60 * 1000, queryKey }))
      .forEach((query) => expect(shouldDehydrateQuery(query)).toBe(false));
  });

  it('rejects object-valued ids at runtime', () => {
    expect(() =>
      queryKeys.scoped('survey', 'questions', {
        ids: [{ unstable: true } as unknown as string],
      }),
    ).toThrow('Query key ids must be scalar values');
  });

  it('rejects non-finite numeric ids that would hash like null', () => {
    expect(() => queryKeys.scoped('survey', 'questions', { ids: [Number.NaN] })).toThrow(
      'Query key numeric ids must be finite',
    );
    expect(() => queryKeys.scoped('survey', 'questions', { ids: [Number.POSITIVE_INFINITY] })).toThrow(
      'Query key numeric ids must be finite',
    );
  });
});
