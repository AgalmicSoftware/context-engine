import { type MutableRefObject, useEffect } from 'react';

type TimerRef = MutableRefObject<ReturnType<typeof setTimeout> | null>;

export interface UseSessionWizardCleanupEffectOptions {
  isMountedRef: MutableRefObject<boolean>;
  sessionIdRotationTimerRef: TimerRef;
  adminUrlStatusTimerRef: TimerRef;
  jsonCopiedTimerRef: TimerRef;
}

const clearTimerRef = (timerRef: TimerRef) => {
  if (timerRef.current) {
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }
};

const useSessionWizardCleanupEffect = ({
  isMountedRef,
  sessionIdRotationTimerRef,
  adminUrlStatusTimerRef,
  jsonCopiedTimerRef,
}: UseSessionWizardCleanupEffectOptions) => {
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      clearTimerRef(sessionIdRotationTimerRef);
      clearTimerRef(adminUrlStatusTimerRef);
      clearTimerRef(jsonCopiedTimerRef);
    };
  }, [isMountedRef, sessionIdRotationTimerRef, adminUrlStatusTimerRef, jsonCopiedTimerRef]);
};

export default useSessionWizardCleanupEffect;
