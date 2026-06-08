export type SbtListRegistryRetrySnapshot = {
  registryEntryCount?: unknown;
  registryHydrated?: unknown;
};

export type SbtListRegistryRetryPlan = {
  delayMs: number | null;
  nextAttempt: number;
  pending: boolean;
  shouldSchedule: boolean;
};

type ResolveSbtListRegistryRetryPlanArgs = {
  attempt?: unknown;
  delayStepMs?: unknown;
  maxAttempts?: unknown;
  maxDelayMs?: unknown;
  shouldExpectRegistryUniverse?: unknown;
  snapshot?: SbtListRegistryRetrySnapshot | null;
};

const normalizePositiveInteger = (value: unknown, fallback: number): number => {
  const numeric = Number(value || 0);
  if (Number.isFinite(numeric) && numeric > 0) {
    return Math.max(1, Math.floor(numeric));
  }
  return fallback;
};

export const resolveSbtListRegistryRetryPlan = ({
  attempt = 0,
  delayStepMs = 1500,
  maxAttempts = 4,
  maxDelayMs = 8000,
  shouldExpectRegistryUniverse = false,
  snapshot = null,
}: ResolveSbtListRegistryRetryPlanArgs = {}): SbtListRegistryRetryPlan => {
  const currentAttempt = Math.max(0, Math.floor(Number(attempt || 0)));
  const normalizedMaxAttempts = normalizePositiveInteger(maxAttempts, 4);
  const normalizedDelayStepMs = normalizePositiveInteger(delayStepMs, 1500);
  const normalizedMaxDelayMs = normalizePositiveInteger(maxDelayMs, 8000);
  const pending = !!(
    shouldExpectRegistryUniverse &&
    Number(snapshot?.registryEntryCount || 0) <= 0 &&
    !snapshot?.registryHydrated
  );

  if (!pending || currentAttempt >= normalizedMaxAttempts) {
    return {
      delayMs: null,
      nextAttempt: currentAttempt,
      pending,
      shouldSchedule: false,
    };
  }

  const nextAttempt = currentAttempt + 1;
  return {
    delayMs: Math.min(normalizedMaxDelayMs, nextAttempt * normalizedDelayStepMs),
    nextAttempt,
    pending,
    shouldSchedule: true,
  };
};
