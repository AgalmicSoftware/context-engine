/** @file CompareAddresses.test.tsx */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CompareAddress, {
  buildCompareClassName,
  describeCompareAiFailure,
  buildCompareProfileHref,
  readDgObjectValues,
  resolveCompareAddressBlockieStyle,
  resolveCompareAddressPillContentStyle,
  resolveCompareBookmarksHeaderStyle,
  resolveCompareBookmarksListStyle,
  resolveCompareClickableResultItemStyle,
  resolveCompareCompassLegendStyle,
  resolveCompareCompassLegendSwatchStyle,
  resolveCompareCompassScrollStyle,
  resolveCompareDrillBodyStyle,
  resolveCompareErrorStyle,
  resolveCompareLoadingTextStyle,
  resolveCompareUnsureHeaderStyle,
  resolveCompareUnsureMoreStyle,
  resolveCompareUnsurePanelStyle,
  resolveCompareVisualSectionStyle,
} from './CompareAddresses';
import { buildNicknameByAddressMap } from './compareMembershipPresentation';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import { runCompareToolkit } from '../../utilities/ai/aiClient.js';

jest.mock('../../utilities/cache/cacheScripts.js', () => ({
  listNamespaceEntriesSync: jest.fn(() => []),
  subscribeCacheUpdates: jest.fn(() => () => {}),
}));
jest.mock('../../utilities/ai/aiClient.js', () => ({
  runCompareToolkit: jest.fn(async (operation: string) =>
    operation === 'compare' ? { agreements: ['Shared view'], disagreements: [] } : null,
  ),
}));

const mockListNamespaceEntriesSync = cacheScripts.listNamespaceEntriesSync as jest.Mock;
const mockRunCompareToolkit = runCompareToolkit as jest.Mock;
const buildNicknameMap = buildNicknameByAddressMap as (entries: Array<Record<string, unknown>>) => Map<string, string>;
const readObjectValues = readDgObjectValues;

describe('CompareAddresses cache scan helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reads namespace values without cloning cache objects', () => {
    mockListNamespaceEntriesSync.mockReturnValue([
      { slug: 'edge', value: { a: 1 } },
      { slug: 'edge2', value: null },
      { slug: 'edge3', value: 'x' },
      { slug: 'edge', value: { b: 2 } },
    ]);

    const result = readObjectValues('questionsCache', { kind: 'session', slug: 'edge' });

    expect(cacheScripts.listNamespaceEntriesSync).toHaveBeenCalledWith('questionsCache', { cloneValues: false });
    expect(result).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it('reads only the resolved session cache when a session slug is supplied', () => {
    mockListNamespaceEntriesSync.mockReturnValue([
      { slug: 'edge', value: { id: 'edge' } },
      { slug: 'worker', value: { id: 'worker' } },
    ]);

    expect(readObjectValues('questionsCache', { kind: 'session', slug: 'worker' })).toEqual([{ id: 'worker' }]);
  });

  it('builds compare profile links under the configured PUBLIC_URL base path', () => {
    const previousPublicUrl = process.env.PUBLIC_URL;
    process.env.PUBLIC_URL = '/ce';
    try {
      expect(buildCompareProfileHref('0xabc')).toBe('/ce/u/0xabc');
      expect(buildCompareProfileHref('0xabc', 'worker-session')).toBe('/ce/u/0xabc?session=worker-session');
      expect(buildCompareProfileHref('')).toBe('');
    } finally {
      if (previousPublicUrl === undefined) {
        delete process.env.PUBLIC_URL;
      } else {
        process.env.PUBLIC_URL = previousPublicUrl;
      }
    }
  });

  it('builds nickname maps from already-hydrated bookmarks state', () => {
    const map = buildNicknameMap([
      {
        addressLower: '0xabc',
        label: 'Alice',
        nickname: 'Alice',
      },
      {
        addressLower: '0xabc',
        label: 'Ignored duplicate',
        nickname: 'ShouldNotReplace',
      },
      {
        addressLower: '0xdef',
        label: 'Short 0xdef',
      },
      {
        addressLower: '0x123',
        label: 'Bob',
        nickname: 'Bob',
      },
    ]);

    expect(Array.from(map.entries())).toEqual([
      ['0xabc', 'Alice'],
      ['0x123', 'Bob'],
    ]);
  });

  it('resolves compare address pill styles consistently', () => {
    expect(resolveCompareAddressPillContentStyle()).toEqual({
      alignItems: 'center',
      display: 'inline-flex',
      gap: 8,
    });
    expect(resolveCompareAddressBlockieStyle()).toEqual({
      borderRadius: 3,
    });
  });

  it('builds compare class names without empty classes', () => {
    expect(buildCompareClassName('base', '', null, 'active')).toBe('base active');
    expect(buildCompareClassName(undefined, 'only')).toBe('only');
  });

  it('resolves compare unsure-overlap styles consistently', () => {
    expect(resolveCompareUnsurePanelStyle()).toEqual({
      marginTop: 8,
    });
    expect(resolveCompareUnsureHeaderStyle()).toEqual({
      fontWeight: 700,
      marginBottom: 6,
    });
    expect(resolveCompareUnsureMoreStyle()).toEqual({
      fontSize: 12,
      marginTop: 6,
      opacity: 0.8,
    });
  });

  it('resolves compare bookmark row styles consistently', () => {
    expect(resolveCompareBookmarksHeaderStyle()).toEqual({
      color: 'var(--ce-panel-text)',
      fontWeight: '600',
      marginBottom: '10px',
    });
    expect(resolveCompareBookmarksListStyle()).toEqual({
      display: 'flex',
      flexWrap: 'wrap',
      gap: 10,
    });
  });

  it('resolves compare result area styles consistently', () => {
    expect(resolveCompareErrorStyle()).toEqual({ marginTop: 8 });
    expect(resolveCompareVisualSectionStyle()).toEqual({ padding: '6px 0' });
    expect(resolveCompareLoadingTextStyle()).toEqual({ marginLeft: 6 });
    expect(resolveCompareClickableResultItemStyle()).toEqual({ cursor: 'pointer' });
    expect(resolveCompareDrillBodyStyle()).toEqual({ marginTop: 6 });
  });

  it('resolves compare compass styles consistently', () => {
    expect(resolveCompareCompassLegendStyle()).toEqual({
      display: 'flex',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 8,
    });
    expect(resolveCompareCompassLegendSwatchStyle('red')).toEqual({
      background: 'red',
      borderRadius: 5,
      display: 'inline-block',
      height: 10,
      marginRight: 6,
      width: 10,
    });
    expect(resolveCompareCompassScrollStyle()).toEqual({
      overflowX: 'auto',
    });
  });
});

describe('CompareAddresses subject routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListNamespaceEntriesSync.mockReturnValue([]);
    mockRunCompareToolkit.mockImplementation(async (...args: unknown[]) =>
      args[0] === 'compare' ? { agreements: ['Shared view'], disagreements: [] } : null,
    );
  });

  const walletA = `0x${'1'.repeat(40)}`;
  const walletB = `0x${'2'.repeat(40)}`;
  const comparisonPath = `/compare?subject=wallet:${walletA}&subject=wallet:${walletB}`;
  const seedWorkerAnswers = (slugs = ['alpha', 'beta']) =>
    mockListNamespaceEntriesSync.mockImplementation((...args: unknown[]) =>
      args[0] === 'questionsCache'
        ? slugs.map((slug) => ({
            slug,
            value: {
              worker: {
                questions: { shared: { prompt: `${slug || 'General'} shared question`, type: 'binary' } },
                questionResponses: {
                  shared: {
                    [walletA]: JSON.stringify({ answer: { value: 'Agree' } }),
                    [walletB]: JSON.stringify({ answer: { value: 'Disagree' } }),
                  },
                },
              },
            },
          }))
        : [],
    );

  it.each([true, false])('General compares only General answers with explicit AI scope (query=%s)', async (query) => {
    seedWorkerAnswers(['', 'alpha']);
    render(
      <MemoryRouter initialEntries={[comparisonPath + (query ? '&session=general' : '')]}>
        <CompareAddress activeSessionSlug={query ? 'alpha' : ''} sessionCachesReady />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(mockRunCompareToolkit).toHaveBeenCalledWith('compare', expect.objectContaining({ sessionSlug: '' }), {
        throwOnError: true,
      }),
    );
    const payload = mockRunCompareToolkit.mock.calls.find(([task]) => task === 'compare')?.[1];
    expect(payload).toEqual(
      expect.objectContaining({
        users: [walletA, walletB].map(() =>
          expect.objectContaining({
            questions: [expect.objectContaining({ prompt: 'General shared question' })],
            provenance: expect.objectContaining({ sessionSlug: '' }),
          }),
        ),
      }),
    );
  });

  it('labels malformed AI results as local fallbacks, not model output', async () => {
    seedWorkerAnswers();
    mockRunCompareToolkit.mockImplementation(async () => ({ generation: { model: 'example', source: 'reported' } }));
    render(
      <MemoryRouter initialEntries={[comparisonPath]}>
        <CompareAddress activeSessionSlug="alpha" sessionCachesReady />
      </MemoryRouter>,
    );
    expect(
      await screen.findByText('Local comparison · AI summary unavailable: The AI reply could not be read.'),
    ).toBeVisible();
    expect(await screen.findByText('Statistical axes')).toBeVisible();
    expect(screen.queryByText('Model: example')).not.toBeInTheDocument();
  });

  it('sends the session settings the page holds with both AI requests', async () => {
    seedWorkerAnswers();
    // Settings name their session as they were stored; the comparison's own name is tidied.
    const sessionConfig = { slug: ' alpha ', corsWorkerUrl: 'https://alpha.example.workers.dev' };
    render(
      <MemoryRouter initialEntries={[comparisonPath]}>
        <CompareAddress activeSessionSlug="alpha" sessionConfig={sessionConfig} sessionCachesReady />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(mockRunCompareToolkit.mock.calls.map(([task]) => task).sort()).toEqual(['axes', 'compare']),
    );
    mockRunCompareToolkit.mock.calls.forEach(([, payload]) =>
      expect(payload).toEqual(expect.objectContaining({ sessionSlug: 'alpha', sessionConfig })),
    );
  });

  it('keeps settings for another session out of the AI requests', async () => {
    seedWorkerAnswers();
    render(
      <MemoryRouter initialEntries={[`${comparisonPath}&session=beta`]}>
        <CompareAddress activeSessionSlug="alpha" sessionConfig={{ slug: 'alpha' }} sessionCachesReady />
      </MemoryRouter>,
    );
    await waitFor(() => expect(mockRunCompareToolkit).toHaveBeenCalledTimes(2));
    mockRunCompareToolkit.mock.calls.forEach(([, payload]) => {
      expect(payload).toEqual(expect.objectContaining({ sessionSlug: 'beta' }));
      expect(payload).not.toHaveProperty('sessionConfig');
    });
  });

  it('sends no settings that name no session, on the general session', async () => {
    seedWorkerAnswers(['']);
    render(
      <MemoryRouter initialEntries={[comparisonPath]}>
        <CompareAddress
          activeSessionSlug=""
          sessionConfig={{ corsWorkerUrl: 'https://x.example' }}
          sessionCachesReady
        />
      </MemoryRouter>,
    );
    await waitFor(() => expect(mockRunCompareToolkit).toHaveBeenCalled());
    mockRunCompareToolkit.mock.calls.forEach(([, payload]) => expect(payload).not.toHaveProperty('sessionConfig'));
  });

  it('ignores a failure from a comparison that was replaced while it ran', async () => {
    seedWorkerAnswers();
    let failFirst: (error: Error) => void = () => {};
    mockRunCompareToolkit.mockImplementation((task: unknown) =>
      task === 'compare' ? new Promise((_resolve, reject) => (failFirst = reject)) : Promise.resolve(null),
    );
    const view = (session: string) => (
      <MemoryRouter initialEntries={[comparisonPath]}>
        <CompareAddress activeSessionSlug={session} sessionCachesReady />
      </MemoryRouter>
    );
    const { rerender } = render(view('alpha'));
    await waitFor(() =>
      expect(mockRunCompareToolkit).toHaveBeenCalledWith('compare', expect.anything(), expect.anything()),
    );
    const failAlpha = failFirst;
    mockRunCompareToolkit.mockImplementation(async (task: unknown) =>
      task === 'compare' ? { agreements: ['Shared view'], disagreements: [] } : null,
    );
    rerender(view('beta'));
    expect(await screen.findByText('Shared view')).toBeVisible();
    await act(async () => failAlpha(new Error('Failed to fetch')));
    expect(screen.getByText('Local comparison · AI summary unavailable')).toBeVisible();
    expect(screen.getByText('Shared view')).toBeVisible();
  });

  it.each([
    ['Worker URL is not configured.', 'This page has no AI service for this session.'],
    ['Failed to fetch', 'Unable to reach the AI service. Check your connection or AI settings, then try again.'],
    ['The AI request was refused.', 'The AI request was refused.'],
  ])('says why the AI summary is missing when the request fails with "%s"', async (failure, reason) => {
    seedWorkerAnswers();
    mockRunCompareToolkit.mockImplementation(async (...args: unknown[]) => {
      const [task, , opts] = args as [unknown, unknown, { throwOnError?: boolean } | undefined];
      // Only a caller that asks for the failure gets it; the map falls back without one.
      if (task === 'compare' && opts?.throwOnError) throw new Error(failure);
      return null;
    });
    render(
      <MemoryRouter initialEntries={[comparisonPath]}>
        <CompareAddress activeSessionSlug="alpha" sessionCachesReady />
      </MemoryRouter>,
    );
    expect(await screen.findByText(`Local comparison · AI summary unavailable: ${reason}`)).toBeVisible();
    expect(describeCompareAiFailure(new Error(failure))).toBe(reason);
  });

  it('drops an earlier failure when the participants are compared again', async () => {
    seedWorkerAnswers();
    mockRunCompareToolkit.mockImplementation(async () => {
      throw new Error('Failed to fetch');
    });
    const view = (session: string) => (
      <MemoryRouter initialEntries={[comparisonPath]}>
        <CompareAddress activeSessionSlug={session} sessionCachesReady />
      </MemoryRouter>
    );
    const { rerender } = render(view('alpha'));
    expect(await screen.findByText(/AI summary unavailable: Unable to reach the AI service/)).toBeVisible();
    // This reply names no model, so the note stays; the earlier run's reason must not.
    mockRunCompareToolkit.mockImplementation(async (task: unknown) =>
      task === 'compare' ? { agreements: ['Shared view'], disagreements: [] } : null,
    );
    rerender(view('beta'));
    expect(await screen.findByText('Shared view')).toBeVisible();
    expect(screen.getByText('Local comparison · AI summary unavailable')).toBeVisible();
  });

  it('compares Hosted answers and reruns the same participants when the session changes', async () => {
    seedWorkerAnswers();
    const view = (session: string) => (
      <MemoryRouter initialEntries={[comparisonPath]}>
        <CompareAddress activeSessionSlug={session} sessionCachesReady />
      </MemoryRouter>
    );
    const { rerender } = render(view('alpha'));
    await waitFor(() =>
      expect(mockRunCompareToolkit).toHaveBeenCalledWith('compare', expect.objectContaining({ sessionSlug: 'alpha' }), {
        throwOnError: true,
      }),
    );
    const firstPayload = mockRunCompareToolkit.mock.calls.find(([task]) => task === 'compare')?.[1];
    expect(firstPayload).toEqual(
      expect.objectContaining({
        users: expect.arrayContaining([
          expect.objectContaining({
            questions: expect.arrayContaining([expect.objectContaining({ prompt: 'alpha shared question' })]),
          }),
        ]),
      }),
    );
    mockRunCompareToolkit.mockClear();
    rerender(view('beta'));
    await waitFor(() =>
      expect(mockRunCompareToolkit).toHaveBeenCalledWith('compare', expect.objectContaining({ sessionSlug: 'beta' }), {
        throwOnError: true,
      }),
    );
    expect(mockRunCompareToolkit.mock.calls.find(([task]) => task === 'compare')?.[1]).toEqual(
      expect.objectContaining({
        users: expect.arrayContaining([
          expect.objectContaining({
            questions: expect.arrayContaining([expect.objectContaining({ prompt: 'beta shared question' })]),
          }),
        ]),
      }),
    );
  });

  it('shows a retryable load failure instead of an endless comparison spinner', async () => {
    const loadSessionData = jest.fn().mockRejectedValue(new Error('Session data unavailable.'));
    render(
      <MemoryRouter initialEntries={[comparisonPath]}>
        <CompareAddress activeSessionSlug="alpha" sessionCachesReady={false} loadSessionData={loadSessionData} />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Session data unavailable.');
    expect(screen.getByTestId('ce-compare-run')).not.toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Retry loading session data' }));
    await waitFor(() => expect(loadSessionData).toHaveBeenCalledTimes(2));
    expect(mockRunCompareToolkit).not.toHaveBeenCalled();
  });

  it('waits for complete Hosted hydration before comparing and can retry a previous error', async () => {
    seedWorkerAnswers();
    const loadSessionData = jest.fn().mockResolvedValue(undefined);
    const view = (ready: boolean, error?: string) => (
      <MemoryRouter initialEntries={[comparisonPath]}>
        <CompareAddress
          activeSessionSlug="alpha"
          sessionCachesReady={ready}
          sessionCacheError={error}
          loadSessionData={loadSessionData}
        />
      </MemoryRouter>
    );
    const { rerender } = render(view(false, 'Previous request failed.'));
    await waitFor(() => expect(loadSessionData).toHaveBeenCalledTimes(1));
    expect(mockRunCompareToolkit).not.toHaveBeenCalled();
    rerender(view(false));
    expect(mockRunCompareToolkit).not.toHaveBeenCalled();
    rerender(view(true));
    await waitFor(() =>
      expect(mockRunCompareToolkit).toHaveBeenCalledWith('compare', expect.objectContaining({ sessionSlug: 'alpha' }), {
        throwOnError: true,
      }),
    );
    fireEvent.click(screen.getByText('Change participants'));
    expect(screen.getAllByRole('button', { name: 'Clear this subject' })).toHaveLength(2);
    fireEvent.click(screen.getAllByRole('button', { name: 'Clear this subject' })[0]);
    expect(screen.getByRole('textbox', { name: 'Comparison subject 1' })).toHaveValue('');
  });

  it('ends a stalled cache wait without treating incomplete data as ready', async () => {
    jest.useFakeTimers();
    try {
      render(
        <MemoryRouter initialEntries={[comparisonPath]}>
          <CompareAddress activeSessionSlug="alpha" sessionCachesReady={false} />
        </MemoryRouter>,
      );
      await act(async () => {
        jest.advanceTimersByTime(30000);
      });
      expect(screen.getByRole('alert')).toHaveTextContent('Session data is taking too long to load');
      expect(screen.getByTestId('ce-compare-run')).not.toBeDisabled();
      expect(mockRunCompareToolkit).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('counts loading seconds, hides false empty results, and retains retry when caches finish late', async () => {
    jest.useFakeTimers();
    try {
      const view = (ready: boolean) => (
        <MemoryRouter initialEntries={[comparisonPath]}>
          <CompareAddress activeSessionSlug="alpha" sessionCachesReady={ready} />
        </MemoryRouter>
      );
      const { rerender } = render(view(false));
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });
      expect(screen.getByTestId('ce-compare-run')).toHaveTextContent('2s');
      expect(screen.getByText(/Loading chart/)).toHaveTextContent('2s');
      expect(screen.getByText(/Loading summary/)).toHaveTextContent('2s');
      await act(async () => {
        jest.advanceTimersByTime(28000);
      });
      rerender(view(true));
      expect(screen.getByRole('button', { name: 'Retry loading session data' })).toBeEnabled();
      expect(screen.getByText(/No clear similarities/)).not.toBeVisible();
      expect(screen.getByText(/no shared canonical question IDs/)).not.toBeVisible();
      expect(mockRunCompareToolkit).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: 'Retry loading session data' }));
      expect(screen.getByTestId('ce-compare-run')).toHaveTextContent('0s');
    } finally {
      jest.useRealTimers();
    }
  });

  it('runs a simulated-only route without waiting for session caches', async () => {
    render(
      <MemoryRouter
        initialEntries={[
          `/compare?subject=${encodeURIComponent('sim:Franklin')}&subject=${encodeURIComponent('sim:FDR')}`,
        ]}
      >
        <Routes>
          <Route path="/compare" element={<CompareAddress sessionCachesReady={false} />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByLabelText('Benjamin Franklin, shipped simulation')).toBeInTheDocument();
    expect(screen.getByLabelText('Franklin D. Roosevelt, shipped simulation')).toBeInTheDocument();
    await waitFor(() =>
      expect(mockRunCompareToolkit).toHaveBeenCalledWith('compare', expect.any(Object), { throwOnError: true }),
    );
  });
});
