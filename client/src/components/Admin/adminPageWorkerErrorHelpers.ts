import { toStr } from '../../utilities/shared/primitives.js';

export const addSessionConfigHint = (message: unknown): string => {
  const raw = toStr(message).trim();
  if (!raw)
    return 'Worker canonical config is missing. Return to /new with this Worker URL to complete signed setup, then retry.';
  if (!raw.toLowerCase().includes('session config not found')) return raw;
  return `${raw} Return to /new with this Worker URL to complete signed setup, then verify the Worker URL and selected session slug match.`;
};

export const shouldSeedWorkerConfigFromError = (message: unknown): boolean => {
  const raw = toStr(message).toLowerCase();
  if (!raw) return false;
  if (raw.includes('session config not found')) return true;
  return false;
};

export type HealthAuthMismatchStateArgs = {
  unauthStatus?: unknown;
  unauthError?: unknown;
  authError?: unknown;
};

export type HealthAuthMismatchState = {
  healthLabel: string;
  statusMessage: string;
};

export const buildHealthAuthMismatchState = ({
  unauthStatus,
  unauthError = '',
  authError = '',
}: HealthAuthMismatchStateArgs = {}): HealthAuthMismatchState | null => {
  const status = Number(unauthStatus || 0) || 0;
  const authMsg = toStr(authError).toLowerCase();
  const unsupportedAuthRoute =
    status > 0 &&
    (status === 401 || status === 403) &&
    (authMsg.includes('worker login failed (404)') || authMsg.includes('worker auth login route not supported'));
  if (!unsupportedAuthRoute) return null;
  const detail = toStr(unauthError).trim();
  const suffix = detail ? `: ${detail}` : '';
  return {
    healthLabel: `Auth required${suffix}; /auth/login unsupported (404)`,
    statusMessage: 'Health endpoint is gated, but this worker URL does not expose /auth/login.',
  };
};
