import { act, renderHook } from '@testing-library/react';
import useSessionWizardBlockLimits from './useSessionWizardBlockLimits.js';

type DraftState = {
  blockLimits?: {
    start?: unknown;
    end?: unknown;
  } | null;
};

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
      blockLimits: { start: 500 },
    });
  });

  it('does not auto-fill start after a manual start edit', () => {
    const { result, setDraft } = renderBlockLimits();

    act(() => {
      result.current.markBlockStartManual();
      result.current.setLatestChainBlock(500);
    });

    expect(setDraft).not.toHaveBeenCalled();
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
