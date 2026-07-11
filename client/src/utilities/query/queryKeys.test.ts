import { queryKeys } from './queryKeys';

describe('queryKeys', () => {
  it('builds stable tuples with fixed scope slots', () => {
    expect(queryKeys.domain('sbt')).toEqual(['sbt']);
    expect(queryKeys.entity('sbt', 'holders')).toEqual(['sbt', 'holders']);
    expect(
      queryKeys.scoped('sbt', 'holders', {
        chainId: '11155420',
        sessionSlug: ' demo-session ',
        address: '0xAbCd',
        ids: ['token-1', 7, true, null],
      }),
    ).toEqual(['sbt', 'holders', 11155420, 'demo-session', '0xabcd', 'token-1', 7, true, null]);
    expect(queryKeys.scoped('session', 'registry', {})).toEqual(['session', 'registry', null, null, null]);
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

    expect(key).toEqual(['survey', 'questions', 10, 'alpha', '0xabc', 'question-1', 2]);
    expect(key.every((part) => part === null || ['string', 'number', 'boolean'].includes(typeof part))).toBe(true);
    expect(Object.isFrozen(key)).toBe(true);
  });

  it('rejects object-valued ids at runtime', () => {
    expect(() =>
      queryKeys.scoped('survey', 'questions', {
        ids: [{ unstable: true } as unknown as string],
      }),
    ).toThrow('Query key ids must be scalar values');
  });
});
