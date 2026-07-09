import { renderHook } from '@testing-library/react';
import type { CollapsedSectionsState } from './useSessionWizardChromeState';
import useSessionWizardNormalModeSectionVisibility from './useSessionWizardNormalModeSectionVisibility.js';

const renderVisibility = ({ isNormalMode = true, showNormalModeWorkerStep = true } = {}) => {
  const setCollapsedSections = jest.fn();
  renderHook(() =>
    useSessionWizardNormalModeSectionVisibility({
      isNormalMode,
      showNormalModeWorkerStep,
      setCollapsedSections,
    }),
  );
  return { setCollapsedSections };
};

const applyUpdater = (setCollapsedSections: jest.Mock, prev: CollapsedSectionsState) =>
  setCollapsedSections.mock.calls[0][0](prev);

describe('useSessionWizardNormalModeSectionVisibility', () => {
  it('does nothing outside normal mode', () => {
    const { setCollapsedSections } = renderVisibility({ isNormalMode: false });

    expect(setCollapsedSections).not.toHaveBeenCalled();
  });

  it('preserves the first open visible section in normal mode', () => {
    const { setCollapsedSections } = renderVisibility();

    expect(
      applyUpdater(setCollapsedSections, {
        metadata: true,
        encryption: true,
        worker: false,
        publish: true,
      }),
    ).toEqual({
      metadata: true,
      encryption: true,
      worker: false,
      publish: true,
    });
  });

  it('closes the worker section when the worker step is hidden', () => {
    const { setCollapsedSections } = renderVisibility({
      showNormalModeWorkerStep: false,
    });

    expect(
      applyUpdater(setCollapsedSections, {
        metadata: true,
        encryption: true,
        worker: false,
        publish: true,
      }),
    ).toEqual({
      metadata: false,
      encryption: true,
      worker: true,
      publish: true,
    });
  });
});
