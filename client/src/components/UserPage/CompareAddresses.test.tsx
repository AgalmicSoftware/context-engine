/** @file CompareAddresses.test.tsx */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CompareAddress, {
  buildCompareClassName,
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
  resolveCompareVennNoteStyle,
  resolveCompareVennSbtImageStyle,
  resolveCompareVennSbtRowStyle,
  resolveCompareVennTooltipListStyle,
  resolveCompareVennTooltipStyle,
  resolveCompareVennWrapStyle,
  resolveCompareVisualSectionStyle,
} from './CompareAddresses';
import {
  buildCompareSbtImageMap,
  buildCompareSbtKeySets,
  buildNicknameByAddressMap,
} from './compareMembershipPresentation';
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
const buildSbtKeySets = buildCompareSbtKeySets as (entries: Array<Record<string, unknown>>) => Set<string>[];
const buildSbtImageMap = buildCompareSbtImageMap as (
  entries: Array<Record<string, unknown>>,
) => Map<string, { name: string; image: string | null }>;
const readObjectValues = readDgObjectValues as (namespace: string, sessionSlug?: string) => unknown[];

describe('CompareAddresses cache scan helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reads namespace values without cloning cache objects', () => {
    mockListNamespaceEntriesSync.mockReturnValue([
      { slug: 'edge', value: { a: 1 } },
      { slug: 'edge2', value: null },
      { slug: 'edge3', value: 'x' },
      { slug: 'edge4', value: { b: 2 } },
    ]);

    const result = readObjectValues('questionsCache');

    expect(cacheScripts.listNamespaceEntriesSync).toHaveBeenCalledWith('questionsCache', { cloneValues: false });
    expect(result).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it('reads only the resolved session cache when a session slug is supplied', () => {
    mockListNamespaceEntriesSync.mockReturnValue([
      { slug: 'edge', value: { id: 'edge' } },
      { slug: 'worker', value: { id: 'worker' } },
    ]);

    expect(readObjectValues('questionsCache', 'worker')).toEqual([{ id: 'worker' }]);
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

  it('keeps distinct locked-name SBTs separate in compare key sets', () => {
    const sets = buildSbtKeySets([
      {
        sbts: [
          {
            name: '[encrypted]',
            address: '0xSbt1',
          },
        ],
      },
      {
        sbts: [
          {
            name: '[encrypted]',
            address: '0xSbt2',
          },
        ],
      },
    ]);

    expect(sets.map((set) => Array.from(set))).toEqual([['0xsbt1'], ['0xsbt2']]);
  });

  it('keeps separate image map entries for different locked-name SBTs', () => {
    const map = buildSbtImageMap([
      {
        sbts: [
          {
            name: '[encrypted]',
            address: '0xSbt1',
            image: 'https://img.test/1.png',
          },
        ],
      },
      {
        sbts: [
          {
            name: '[encrypted]',
            address: '0xSbt2',
            image: 'https://img.test/2.png',
          },
        ],
      },
    ]);

    expect(Array.from(map.entries())).toEqual([
      ['0xsbt1', { name: '[encrypted]', image: 'https://img.test/1.png' }],
      ['0xsbt2', { name: '[encrypted]', image: 'https://img.test/2.png' }],
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

  it('resolves compare Venn tooltip styles consistently', () => {
    expect(resolveCompareVennWrapStyle()).toEqual({
      overflowX: 'auto',
      position: 'relative',
    });
    expect(resolveCompareVennTooltipStyle({ clientWidth: 500, x: 100, y: 20 })).toEqual({
      left: 80,
      top: 28,
    });
    expect(resolveCompareVennTooltipListStyle()).toEqual({
      listStyle: 'none',
      margin: 0,
      padding: 0,
    });
    expect(resolveCompareVennSbtRowStyle()).toEqual({
      alignItems: 'center',
      display: 'flex',
      gap: '8px',
    });
    expect(resolveCompareVennSbtImageStyle()).toEqual({
      borderRadius: '4px',
      flexShrink: 0,
    });
    expect(resolveCompareVennNoteStyle()).toEqual({
      fontSize: 12,
      marginTop: 4,
      opacity: 0.75,
    });
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
  const seedWorkerAnswers = () =>
    mockListNamespaceEntriesSync.mockImplementation((...args: unknown[]) =>
      args[0] === 'questionsCache'
        ? ['alpha', 'beta'].map((slug) => ({
            slug,
            value: {
              worker: {
                questions: { shared: { prompt: `${slug} shared question`, type: 'binary' } },
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

  it('compares Hosted answers and reruns the same participants when the session changes', async () => {
    seedWorkerAnswers();
    const view = (session: string) => (
      <MemoryRouter initialEntries={[comparisonPath]}>
        <CompareAddress activeSessionSlug={session} sessionCachesReady />
      </MemoryRouter>
    );
    const { rerender } = render(view('alpha'));
    await waitFor(() =>
      expect(mockRunCompareToolkit).toHaveBeenCalledWith('compare', expect.objectContaining({ sessionSlug: 'alpha' })),
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
      expect(mockRunCompareToolkit).toHaveBeenCalledWith('compare', expect.objectContaining({ sessionSlug: 'beta' })),
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
      expect(mockRunCompareToolkit).toHaveBeenCalledWith('compare', expect.objectContaining({ sessionSlug: 'alpha' })),
    );
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
    await waitFor(() => expect(mockRunCompareToolkit).toHaveBeenCalledWith('compare', expect.any(Object)));
  });
});
