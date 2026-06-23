import { act, renderHook } from '@testing-library/react';
import useSessionWizardTooltipPreference from './useSessionWizardTooltipPreference.js';

const createPreferenceStore = (tooltipsEnabled: boolean) => {
  let state = { sessionState: { tooltipsEnabled } };
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    subscribe: jest.fn((listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
    setTooltipsEnabled: (nextEnabled: boolean) => {
      state = { sessionState: { tooltipsEnabled: nextEnabled } };
      listeners.forEach((listener) => listener());
    },
  };
};

describe('useSessionWizardTooltipPreference', () => {
  it('defaults tooltips to enabled without a store', () => {
    const { result } = renderHook(() => useSessionWizardTooltipPreference(null));

    expect(result.current).toBe(true);
  });

  it('reads the store preference and updates through subscription notifications', () => {
    const store = createPreferenceStore(false);
    const { result, unmount } = renderHook(() => useSessionWizardTooltipPreference(store));

    expect(result.current).toBe(false);
    expect(store.subscribe).toHaveBeenCalledTimes(1);

    act(() => {
      store.setTooltipsEnabled(true);
    });

    expect(result.current).toBe(true);

    unmount();
    act(() => {
      store.setTooltipsEnabled(false);
    });
    expect(result.current).toBe(true);
  });
});
