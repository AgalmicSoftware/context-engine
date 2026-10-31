import { act, renderHook } from '@testing-library/react';
import useSessionWizardChromeState from './useSessionWizardChromeState.js';

describe('useSessionWizardChromeState', () => {
  it('starts with the prompt preview hidden and every metadata object collapsed', () => {
    const { result } = renderHook(() => useSessionWizardChromeState());

    expect(result.current.showPromptPreview).toBe(false);
    expect(result.current.metadataObjectCollapsed).toEqual({
      appearance: true,
      contracts: true,
      faucet: true,
      ai: true,
      lit: true,
      storageProfile: true,
    });
  });

  it('exposes the prompt preview and metadata object setters', () => {
    const { result } = renderHook(() => useSessionWizardChromeState());

    act(() => {
      result.current.setShowPromptPreview(true);
      result.current.setMetadataObjectCollapsed((prev) => ({
        ...prev,
        contracts: false,
      }));
    });

    expect(result.current.showPromptPreview).toBe(true);
    expect(result.current.metadataObjectCollapsed.contracts).toBe(false);
    expect(result.current.metadataObjectCollapsed.ai).toBe(true);
  });
});
