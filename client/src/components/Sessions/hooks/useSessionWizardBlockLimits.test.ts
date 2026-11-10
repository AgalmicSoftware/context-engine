import { act, renderHook, waitFor } from '@testing-library/react';
import { useRef, useState } from 'react';
import useSessionWizardBlockLimits from './useSessionWizardBlockLimits.js';
import { buildSessionWizardCacheWritePayload } from '../sessionWizardDraftState';

type DraftState = {
  blockLimits?: {
    start?: unknown;
    end?: unknown;
    startDefault?: { chainId: number; blockNumber: number };
  } | null;
};

const renderLiveDraft = (
  initialDraft: DraftState,
  readLatestBlockNumber: (args: { chainId: number; rpcUrl: string }) => Promise<number>,
) =>
  renderHook(
    ({ chainId }) => {
      const [draft, setDraft] = useState(initialDraft);
      const updateDraftValueRef = useRef<null | ((path: string[], value: unknown) => void)>(null);
      const controls = useSessionWizardBlockLimits({
        registryChainId: chainId,
        draftBlockLimitStart: draft.blockLimits?.start,
        setDraft,
        updateDraftValueRef,
        readLatestBlockNumber,
      });
      return { draft, setDraft, ...controls };
    },
    { initialProps: { chainId: 11155420 } },
  );

const renderBlockLimits = (
  overrides: Partial<{
    registryChainId: unknown;
    draftBlockLimitStart: unknown;
    setDraft: jest.Mock;
    updateDraftValue: jest.Mock;
    enabled: boolean;
    readLatestBlockNumber: (args: { chainId: number; rpcUrl: string }) => Promise<number>;
  }> = {},
) => {
  const setDraft = overrides.setDraft || jest.fn();
  const updateDraftValue = overrides.updateDraftValue || jest.fn();
  const updateDraftValueRef = { current: updateDraftValue };

  return {
    setDraft,
    updateDraftValue,
    ...renderHook(() =>
      useSessionWizardBlockLimits<DraftState>({
        enabled: overrides.enabled ?? true,
        registryChainId: overrides.registryChainId ?? 0,
        draftBlockLimitStart: overrides.draftBlockLimitStart,
        setDraft,
        updateDraftValueRef,
        readLatestBlockNumber: overrides.readLatestBlockNumber,
      }),
    ),
  };
};

describe('useSessionWizardBlockLimits', () => {
  it('keeps a restored explicit start and end when the latest block resolves', async () => {
    const { result } = renderLiveDraft({ blockLimits: { start: 100, end: 200 } }, jest.fn().mockResolvedValue(500));
    await waitFor(() => expect(result.current.latestChainBlock).toBe(500));
    expect(result.current.draft.blockLimits).toEqual({ start: 100, end: 200 });
  });

  it('fills a blank start and retains its default provenance in the saved draft', async () => {
    const { result } = renderLiveDraft({ blockLimits: { start: null } }, jest.fn().mockResolvedValue(500));
    await waitFor(() => expect(result.current.draft.blockLimits?.start).toBe(500));
    const cached = buildSessionWizardCacheWritePayload({ draft: result.current.draft });
    expect(cached.draft.blockLimits).toEqual({ start: 500, startDefault: { chainId: 11155420, blockNumber: 500 } });
  });

  it('keeps a restored default on its chain and re-defaults only after the new chain head arrives', async () => {
    let resolveNewChain: (value: number) => void = () => undefined;
    const readLatest = jest
      .fn()
      .mockResolvedValueOnce(600)
      .mockImplementationOnce(
        () =>
          new Promise<number>((resolve) => {
            resolveNewChain = resolve;
          }),
      );
    const { result, rerender } = renderLiveDraft(
      {
        blockLimits: {
          start: 500,
          startDefault: { chainId: 11155420, blockNumber: 500 },
        },
      },
      readLatest,
    );
    await waitFor(() => expect(result.current.latestChainBlock).toBe(600));
    expect(result.current.draft.blockLimits?.start).toBe(500);
    rerender({ chainId: 84532 });
    expect(result.current.latestChainBlock).toBe(null);
    expect(result.current.draft.blockLimits?.start).toBe(500);
    await act(async () => resolveNewChain(700));
    await waitFor(() => expect(result.current.draft.blockLimits?.start).toBe(700));
    expect(result.current.draft.blockLimits?.startDefault).toEqual({ chainId: 84532, blockNumber: 700 });
  });

  it('initializes blank block helper state', () => {
    const { result } = renderBlockLimits();

    expect(result.current.latestChainBlock).toBe(null);
    expect(result.current.latestBlockStatus).toBe('');
    expect(result.current.blockLimitDuration).toBe('');
    expect(result.current.blockLimitUnit).toBe('hours');
  });

  it('does not invoke the block RPC port while chain capabilities are disabled', () => {
    const readLatestBlockNumber = jest.fn().mockResolvedValue(500);

    const { result } = renderBlockLimits({
      enabled: false,
      registryChainId: 11155420,
      readLatestBlockNumber,
    });

    expect(readLatestBlockNumber).not.toHaveBeenCalled();
    expect(result.current.latestChainBlock).toBe(null);
    expect(result.current.latestBlockStatus).toBe('');
  });

  it('invokes the block RPC port for a chain-capable mode', async () => {
    const readLatestBlockNumber = jest.fn().mockResolvedValue(500);

    const { result } = renderBlockLimits({
      enabled: true,
      registryChainId: 11155420,
      readLatestBlockNumber,
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(readLatestBlockNumber).toHaveBeenCalledWith({
      chainId: 11155420,
      rpcUrl: expect.any(String),
    });
    expect(result.current.latestChainBlock).toBe(500);
  });

  it('auto-fills the start block from the latest chain block', () => {
    const { result, setDraft } = renderBlockLimits();

    act(() => {
      result.current.setLatestChainBlock(500);
    });

    expect(setDraft).toHaveBeenCalledTimes(1);
    const updater = setDraft.mock.calls[0][0] as (draft: DraftState) => DraftState;
    expect(updater({ blockLimits: {} })).toEqual({
      blockLimits: { start: 500, startDefault: { chainId: 0, blockNumber: 500 } },
    });
  });

  it('does not auto-fill start after a manual start edit', () => {
    const { result, setDraft } = renderBlockLimits();

    act(() => {
      result.current.markBlockStartManual();
      result.current.setLatestChainBlock(500);
    });

    expect(setDraft).toHaveBeenCalledTimes(1);
    const updater = setDraft.mock.calls[0][0] as (draft: DraftState) => DraftState;
    expect(updater({ blockLimits: { start: 100, startDefault: { chainId: 0, blockNumber: 100 } } })).toEqual({
      blockLimits: { start: 100 },
    });
  });

  it('derives an end block from duration, unit, and draft start', () => {
    const { result, updateDraftValue } = renderBlockLimits({
      registryChainId: 999999,
      draftBlockLimitStart: 1000,
    });

    act(() => {
      result.current.setBlockLimitDuration('1');
    });

    expect(updateDraftValue).toHaveBeenCalledWith(['blockLimits', 'end'], 1300);
  });

  it('clears an auto-derived end block when duration is removed', () => {
    const { result, updateDraftValue } = renderBlockLimits({
      registryChainId: 999999,
      draftBlockLimitStart: 1000,
    });

    act(() => {
      result.current.setBlockLimitDuration('1');
    });
    act(() => {
      result.current.setBlockLimitDuration('');
    });

    expect(updateDraftValue).toHaveBeenLastCalledWith(['blockLimits', 'end'], null);
  });
});
