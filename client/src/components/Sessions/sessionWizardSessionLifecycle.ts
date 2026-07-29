import { toStr } from '../../utilities/shared/primitives.js';

export const normalizeSessionWizardEndsAt = (
  value: unknown,
  { nowMs = Date.now() }: { nowMs?: number } = {},
): string => {
  const raw = toStr(value).trim();
  if (!raw) return '';
  const timestamp = new Date(raw).getTime();
  if (!Number.isFinite(timestamp)) {
    throw new Error('Session end time must be a valid date and time.');
  }
  if (timestamp <= nowMs) {
    throw new Error('Session end time must be in the future.');
  }
  return new Date(timestamp).toISOString();
};
