import { toStr } from '../../utilities/shared/primitives.js';

// limits.aiPerWalletPerDay: how many signed-in AI requests one address may make
// in 24 hours. Blank or 0 leaves AI on limits.perWalletPerDay. The Worker
// refuses anything above its maximum; aiDailyLimit.test.ts holds the two in step.
export const AI_DAILY_LIMIT_MAX = 100_000;

export const AI_DAILY_LIMIT_LABEL = 'AI requests per person a day';

export const AI_DAILY_LIMIT_HELP =
  'How many AI requests one signed-in person can make in 24 hours, counted together: drafting and interview ' +
  'replies, Session Agent questions, and agents’ AI calls. Saving or reading answers, transcription and voice ' +
  'interview connections aren’t counted. Leave blank for the same limit as other signed-in requests, or none if ' +
  'that isn’t set.';

/** '' when the input is blank or a whole number from 0 to the maximum. */
export const getAiDailyLimitInputError = (value: unknown): string => {
  const raw = toStr(value).trim();
  if (raw === '') return '';
  const limit = Number(raw);
  return Number.isInteger(limit) && limit >= 0 && limit <= AI_DAILY_LIMIT_MAX
    ? ''
    : `Use a whole number from 0 to ${AI_DAILY_LIMIT_MAX.toLocaleString('en-US')}, or leave it blank.`;
};

/** The stored limit as the field shows it: '' when it is unset or 0. */
export const formatAiDailyLimit = (limits: unknown): string => {
  const value =
    limits && typeof limits === 'object' ? (limits as Record<string, unknown>).aiPerWalletPerDay : undefined;
  return Number.isInteger(value) && (value as number) > 0 ? String(value) : '';
};
