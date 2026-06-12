import { type Dispatch, type SetStateAction, useEffect } from 'react';
import type { CollapsedSectionsState } from './useSessionWizardChromeState';

export interface UseSessionWizardNormalModeSectionVisibilityOptions {
  isNormalMode: boolean;
  showNormalModeWorkerStep: boolean;
  setCollapsedSections: Dispatch<SetStateAction<CollapsedSectionsState>>;
}

const useSessionWizardNormalModeSectionVisibility = ({
  isNormalMode,
  showNormalModeWorkerStep,
  setCollapsedSections,
}: UseSessionWizardNormalModeSectionVisibilityOptions) => {
  useEffect(() => {
    if (!isNormalMode) return;
    const visibleSectionOrder = showNormalModeWorkerStep
      ? ['metadata', 'encryption', 'worker', 'publish']
      : ['metadata', 'encryption', 'publish'];
    setCollapsedSections((prev) => {
      const firstOpenSection = visibleSectionOrder.find((key) => prev[key] === false) || 'metadata';
      return {
        metadata: firstOpenSection !== 'metadata',
        encryption: firstOpenSection !== 'encryption',
        worker: showNormalModeWorkerStep ? firstOpenSection !== 'worker' : true,
        publish: firstOpenSection !== 'publish',
      };
    });
  }, [isNormalMode, showNormalModeWorkerStep, setCollapsedSections]);
};

export default useSessionWizardNormalModeSectionVisibility;
