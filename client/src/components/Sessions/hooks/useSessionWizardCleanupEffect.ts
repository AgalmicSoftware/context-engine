import { type MutableRefObject, useEffect } from 'react';

type TimerRef = MutableRefObject<ReturnType<typeof setTimeout> | null>;

export interface UseSessionWizardCleanupEffectOptions {
  isMountedRef: MutableRefObject<boolean>;
  sessionIdRotationTimerRef: TimerRef;
  adminUrlStatusTimerRef: TimerRef;
  sessionIdStatusTimerRef: TimerRef;
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
  sessionIdStatusTimerRef,
  jsonCopiedTimerRef,
}: UseSessionWizardCleanupEffectOptions) => {
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      clearTimerRef(sessionIdRotationTimerRef);
      clearTimerRef(adminUrlStatusTimerRef);
      clearTimerRef(sessionIdStatusTimerRef);
      clearTimerRef(jsonCopiedTimerRef);
    };
  }, [isMountedRef, sessionIdRotationTimerRef, adminUrlStatusTimerRef, sessionIdStatusTimerRef, jsonCopiedTimerRef]);
};

export default useSessionWizardCleanupEffect;
