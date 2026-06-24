import { type Dispatch, type SetStateAction, useEffect } from 'react';

export interface UseSessionWizardPublishElapsedOptions {
  publishBusy: boolean;
  publishStep: number;
  setPublishStepElapsedMs: Dispatch<SetStateAction<number>>;
}

const useSessionWizardPublishElapsed = ({
  publishBusy,
  publishStep,
  setPublishStepElapsedMs,
}: UseSessionWizardPublishElapsedOptions) => {
  useEffect(() => {
    if (!publishBusy || publishStep <= 0) {
      setPublishStepElapsedMs(0);
      return undefined;
    }
    setPublishStepElapsedMs(0);
    const startedAt = Date.now();
    const timer = setInterval(() => {
      setPublishStepElapsedMs(Date.now() - startedAt);
    }, 120);
    return () => clearInterval(timer);
  }, [publishBusy, publishStep, setPublishStepElapsedMs]);
};

export default useSessionWizardPublishElapsed;
