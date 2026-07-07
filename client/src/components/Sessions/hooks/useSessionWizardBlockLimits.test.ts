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
        registryChainId: overrides.registryChainId ?? 0,
        draftBlockLimitStart: overrides.draftBlockLimitStart,
        setDraft,
        updateDraftValueRef,
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

  it('auto-fills the start block from the latest chain block', () => {
    const { result, setDraft } = renderBlockLimits();

    act(() => {
      result.current.setLatestChainBlock(500);
    });

    expect(setDraft).toHaveBeenCalledTimes(1);
    const updater = setDraft.mock.calls[0][0];
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
