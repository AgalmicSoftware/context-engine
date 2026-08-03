import {
  COMPARE_GRAPHIC_FILENAME,
  buildCompareRoutePath,
  resolveCompareSessionSlug,
  resolveCompareRunLabel,
  runCompareSectionTasks,
  scanCompareAddressesSequentially,
  selectCompareCacheValues,
} from './compareSessionRuntime';

describe('compare session runtime', () => {
  it('prefers the resolved session prop and falls back to query or session pathname context', () => {
    expect(
      resolveCompareSessionSlug({
        activeSessionSlug: 'Worker-Session',
        pathname: '/session/onchain-session',
        search: '?session=query-session',
      }),
    ).toBe('Worker-Session');
    expect(resolveCompareSessionSlug({ pathname: '/compare/a&b', search: '?session=CloudFlare' })).toBe('CloudFlare');
    expect(resolveCompareSessionSlug({ pathname: '/session/OnChain', search: '' })).toBe('OnChain');
  });

  it('keeps the active session and existing safe query state in comparison URLs', () => {
    expect(
      buildCompareRoutePath({
        addresses: ['0xabc', '0xdef'],
        sessionSlug: 'Worker-Session',
        search: '?agent=1',
      }),
    ).toBe('/compare/0xabc&0xdef?agent=1&session=Worker-Session');
  });

  it('selects only the active session cache when a session is resolved', () => {
    const entries = [
      { slug: 'alpha', value: { id: 'alpha' } },
      { slug: 'beta', value: { id: 'beta' } },
      { slug: 'alpha', value: { id: 'alpha-second-entry' } },
      { slug: 'alpha', value: null },
    ];

    expect(selectCompareCacheValues(entries, 'alpha')).toEqual([{ id: 'alpha' }, { id: 'alpha-second-entry' }]);
    expect(selectCompareCacheValues(entries, '')).toEqual([
      { id: 'alpha' },
      { id: 'beta' },
      { id: 'alpha-second-entry' },
    ]);
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
