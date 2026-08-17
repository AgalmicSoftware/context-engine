import {
  buildCompareSubjectsRoutePath,
  compareSubjectsNeedSessionCaches,
  normalizeCompareSubjects,
  resolveCompareRouteSubjects,
  selectScannableCompareSubjectAddresses,
} from './compareSubjectContract';

describe('compare subject route contract', () => {
  const addressA = `0x${'A'.repeat(40)}`;
  const addressB = `0x${'b'.repeat(40)}`;

  it('normalizes explicit wallet, Worker, and simulated subject tokens', () => {
    expect(
      resolveCompareRouteSubjects({
        search: `?subject=${encodeURIComponent(`wallet:${addressA}`)}&subject=${encodeURIComponent('worker:telegram:123')}&subject=${encodeURIComponent('sim:Franklin')}&subject=${encodeURIComponent('unknown:value')}`,
      }),
    ).toEqual([
      {
        kind: 'wallet',
        id: addressA.toLowerCase(),
        key: `wallet:${addressA.toLowerCase()}`,
        token: `wallet:${addressA.toLowerCase()}`,
      },
      {
        kind: 'worker',
        id: 'telegram:123',
        key: 'worker:telegram:123',
        token: 'worker:telegram:123',
      },
      {
        kind: 'sim',
        id: 'Franklin',
        key: 'sim:franklin',
        token: 'sim:Franklin',
      },
    ]);
  });

  it('retains legacy address values as wallet subjects and deduplicates canonical identity', () => {
    expect(
      resolveCompareRouteSubjects({
        pathname: `/compare/${addressA}&${addressA.toLowerCase()}&name.eth`,
      }),
    ).toEqual([
      expect.objectContaining({ token: `wallet:${addressA.toLowerCase()}` }),
      expect.objectContaining({ token: 'wallet:name.eth' }),
    ]);
  });

  it('prefers repeated canonical query subjects over the legacy address path', () => {
    const search = `?subject=${encodeURIComponent('sim:Franklin')}&subject=${encodeURIComponent(`wallet:${addressA}`)}`;
    expect(
      resolveCompareRouteSubjects({ pathname: `/compare/${addressB}`, search }).map((subject) => subject.token),
    ).toEqual(['sim:Franklin', `wallet:${addressA.toLowerCase()}`]);
  });

  it('keeps the legacy address path as a backward-compatible entrypoint', () => {
    expect(
      resolveCompareRouteSubjects({ pathname: `/compare/${addressA}&${addressB}` }).map((subject) => subject.token),
    ).toEqual([`wallet:${addressA.toLowerCase()}`, `wallet:${addressB.toLowerCase()}`]);
  });

  it('serializes canonical subjects as repeated query parameters while preserving safe state and session', () => {
    expect(
      buildCompareSubjectsRoutePath({
        search: '?agent=1&subject=sim%3AOld',
        sessionSlug: 'Worker-Session',
        subjects: [`wallet:${addressA}`, 'sim:Franklin'],
      }),
    ).toBe(
      `/compare?agent=1&subject=${encodeURIComponent(`wallet:${addressA.toLowerCase()}`)}&subject=${encodeURIComponent('sim:Franklin')}&session=Worker-Session`,
    );
  });

  it('only waits for caches or deep-scans subjects that need session-backed evidence', () => {
    const subjects = normalizeCompareSubjects([
      'sim:Franklin',
      `wallet:${addressA}`,
      `worker:evm_address:${addressB}`,
      'worker:telegram:123',
    ]);

    expect(compareSubjectsNeedSessionCaches(normalizeCompareSubjects(['sim:Franklin', 'sim:FDR']))).toBe(false);
    expect(compareSubjectsNeedSessionCaches(subjects)).toBe(true);
    expect(selectScannableCompareSubjectAddresses(subjects)).toEqual([addressA.toLowerCase(), addressB.toLowerCase()]);
  });
});
