import {
  COMPARE_GRAPHIC_FILENAME,
  resolveCompareSessionScope,
  resolveCompareRunLabel,
  runCompareSectionTasks,
  scanCompareAddressesSequentially,
  selectCompareCacheValues,
} from './compareSessionRuntime';

describe('compare session runtime', () => {
  it('prefers the resolved session prop and falls back to query or session pathname context', () => {
    expect(
      resolveCompareSessionScope({
        activeSessionSlug: 'Worker-Session',
        pathname: '/session/onchain-session',
        search: '?session=query-session',
      }),
    ).toEqual({ kind: 'session', slug: 'Worker-Session' });
    expect(resolveCompareSessionScope({ pathname: '/compare/a&b', search: '?session=CloudFlare' })).toEqual({
      kind: 'session',
      slug: 'CloudFlare',
    });
    expect(resolveCompareSessionScope({ pathname: '/session/OnChain', search: '' })).toEqual({
      kind: 'session',
      slug: 'OnChain',
    });
  });

  it('keeps an explicit comparison session instead of a stale global selection', () => {
    expect(
      resolveCompareSessionScope({
        activeSessionSlug: 'stale',
        pathname: '/compare',
        search: '?session=hosted-session',
      }),
    ).toEqual({ kind: 'session', slug: 'hosted-session' });
  });

  it('keeps General explicit and selects only its cache', () => {
    expect(resolveCompareSessionScope({ activeSessionSlug: '', pathname: '/session/alpha' })).toEqual({
      kind: 'session',
      slug: '',
    });
    const slug = resolveCompareSessionScope({
      activeSessionSlug: 'alpha',
      pathname: '/compare',
      search: '?session=general',
    });
    expect(slug).toEqual({ kind: 'session', slug: '' });
    expect(
      selectCompareCacheValues(
        [
          { slug: '', value: { id: 'general' } },
          { slug: 'alpha', value: { id: 'alpha' } },
        ],
        slug,
      ),
    ).toEqual([{ id: 'general' }]);
  });

  it('selects only the active session cache when a session is resolved', () => {
    const entries = [
      { slug: 'alpha', value: { id: 'alpha' } },
      { slug: 'beta', value: { id: 'beta' } },
      { slug: 'alpha', value: { id: 'alpha-second-entry' } },
      { slug: 'alpha', value: null },
    ];

    expect(selectCompareCacheValues(entries, { kind: 'session', slug: 'alpha' })).toEqual([
      { id: 'alpha' },
      { id: 'alpha-second-entry' },
    ]);
    expect(selectCompareCacheValues(entries, { kind: 'session', slug: '' })).toEqual([]);
  });

  it('awaits valid on-chain profile scans sequentially and leaves failed addresses retryable', async () => {
    const calls: string[] = [];
    const seen = new Set<string>();
    const scan = jest.fn(async (address: string) => {
      calls.push(`start:${address}`);
      await Promise.resolve();
      calls.push(`end:${address}`);
      if (address.endsWith('2')) throw new Error('temporary');
    });
    const addressA = `0x${'1'.repeat(40)}`;
    const addressB = `0x${'2'.repeat(40)}`;

    const failures = await scanCompareAddressesSequentially({
      addresses: [addressA, 'name.eth', addressB],
      sessionSlug: 'Worker-Session',
      scanSpecificUserProfile: scan,
      seen,
    });

    expect(calls).toEqual([`start:${addressA}`, `end:${addressA}`, `start:${addressB}`, `end:${addressB}`]);
    expect(failures).toEqual([{ address: addressB, error: expect.any(Error) }]);
    expect(seen.has(`Worker-Session:${addressA.toLowerCase()}`)).toBe(true);
    expect(seen.has(`Worker-Session:${addressB.toLowerCase()}`)).toBe(false);

    await scanCompareAddressesSequentially({
      addresses: [addressA],
      sessionSlug: 'Another-Session',
      scanSpecificUserProfile: scan,
      seen,
    });
    expect(scan).toHaveBeenCalledTimes(3);
  });

  it('starts independent comparison sections together and isolates failures', async () => {
    const started: string[] = [];
    const finishers: Array<() => void> = [];
    const task =
      (name: string, shouldFail = false) =>
      () =>
        new Promise<void>((resolve, reject) => {
          started.push(name);
          finishers.push(() => (shouldFail ? reject(new Error(name)) : resolve()));
        });

    const pending = runCompareSectionTasks([task('bullets'), task('compass', true), task('venn')]);

    expect(started).toEqual(['bullets', 'compass', 'venn']);
    finishers.forEach((finish) => finish());
    await expect(pending).resolves.toEqual([
      { status: 'fulfilled', value: undefined },
      { status: 'rejected', reason: expect.any(Error) },
      { status: 'fulfilled', value: undefined },
    ]);
  });

  it('uses honest loading copy and a descriptive export filename', () => {
    expect(resolveCompareRunLabel(false)).toBe('Loading session data…');
    expect(resolveCompareRunLabel(true)).toBe('Comparing');
    expect(COMPARE_GRAPHIC_FILENAME).toBe('contextEngine_comparisonGraphic.png');
  });
});
