import { act, renderHook } from '@testing-library/react';
import useSessionWizardChromeState from './useSessionWizardChromeState.js';

describe('useSessionWizardChromeState', () => {
  it('initializes normal-mode sections with metadata open', () => {
    const { result } = renderHook(() =>
      useSessionWizardChromeState({
        wizardMode: 'normal',
        hasSponsoredBundleLink: false,
      }),
    );

    expect(result.current.collapsedSections).toEqual({
      metadata: false,
      encryption: true,
      worker: true,
      publish: true,
    });
  });

  it('keeps encryption open initially in advanced mode', () => {
    const { result } = renderHook(() =>
      useSessionWizardChromeState({
        wizardMode: 'advanced',
        hasSponsoredBundleLink: false,
      }),
    );

    expect(result.current.collapsedSections.encryption).toBe(false);
  });

  it('normalizes normal-mode sections to a single open section', () => {
    const { result, rerender } = renderHook(
      ({ wizardMode }) =>
        useSessionWizardChromeState({
          wizardMode,
          hasSponsoredBundleLink: false,
        }),
      { initialProps: { wizardMode: 'advanced' } },
    );

    act(() => {
      result.current.setCollapsedSections({
        metadata: true,
        encryption: false,
        worker: false,
        publish: true,
      });
    });

    rerender({ wizardMode: 'normal' });

    expect(result.current.collapsedSections).toEqual({
      metadata: true,
      encryption: false,
      worker: true,
      publish: true,
    });
  });

  it('closes sponsored display settings when the link disappears', () => {
    const { result, rerender } = renderHook(
      ({ hasSponsoredBundleLink }) =>
        useSessionWizardChromeState({
          wizardMode: 'normal',
          hasSponsoredBundleLink,
        }),
      { initialProps: { hasSponsoredBundleLink: true } },
    );

    act(() => {
      result.current.setWizardDisplaySettingsOpen(true);
    });

    expect(result.current.wizardDisplaySettingsOpen).toBe(true);

    rerender({ hasSponsoredBundleLink: false });

    expect(result.current.wizardDisplaySettingsOpen).toBe(false);
  });

  it('exposes passive metadata and preview UI setters', () => {
    const { result } = renderHook(() =>
      useSessionWizardChromeState({
        wizardMode: 'normal',
        hasSponsoredBundleLink: true,
      }),
    );

    act(() => {
      result.current.setMoreOptionsOpen(true);
      result.current.setShowJsonPreview(true);
      result.current.setShowPromptPreview(true);
      result.current.setMetadataObjectCollapsed((prev) => ({
        ...prev,
        contracts: false,
      }));
    });

    expect(result.current.moreOptionsOpen).toBe(true);
    expect(result.current.showJsonPreview).toBe(true);
    expect(result.current.showPromptPreview).toBe(true);
    expect(result.current.metadataObjectCollapsed.contracts).toBe(false);
  });
});
