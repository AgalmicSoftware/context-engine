import { useEffect, useState } from 'react';
import { readSessionWizardTooltipsEnabled } from '../sessionWizardUiSupport';

type TooltipPreferenceStore =
  | {
      getState?: () => unknown;
      subscribe?: (listener: () => void) => (() => void) | void;
    }
  | null
  | undefined;

const useSessionWizardTooltipPreference = (tooltipPreferenceStore: TooltipPreferenceStore) => {
  const [sessionWizardTooltipsEnabled, setSessionWizardTooltipsEnabled] = useState(() =>
    readSessionWizardTooltipsEnabled(tooltipPreferenceStore),
  );

  useEffect(() => {
    setSessionWizardTooltipsEnabled(readSessionWizardTooltipsEnabled(tooltipPreferenceStore));
    if (typeof tooltipPreferenceStore?.subscribe !== 'function') return undefined;
    return tooltipPreferenceStore.subscribe(() => {
      const nextEnabled = readSessionWizardTooltipsEnabled(tooltipPreferenceStore);
      setSessionWizardTooltipsEnabled((current) => (current === nextEnabled ? current : nextEnabled));
    });
  }, [tooltipPreferenceStore]);

  return sessionWizardTooltipsEnabled;
};

export default useSessionWizardTooltipPreference;
