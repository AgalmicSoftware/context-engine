import {
  AI_DAILY_LIMIT_MAX as WORKER_MAX,
  resolveAiDailyLimit,
  validAiDailyLimit,
} from '../../../../workers/sessionCorsWorker/aiRateLimitPolicy.js';
import { AI_DAILY_LIMIT_MAX, getAiDailyLimitInputError, withAiDailyLimit } from './aiDailyLimit';

// The client checks limits.aiPerWalletPerDay before saving; the Worker refuses
// what it would not count. A change on either side fails here.
describe('the AI daily limit, against the Worker that enforces it', () => {
  it('accepts exactly the numbers the Worker accepts', () => {
    expect(AI_DAILY_LIMIT_MAX).toBe(WORKER_MAX);
    [-1, 0, 1, 1.5, AI_DAILY_LIMIT_MAX, AI_DAILY_LIMIT_MAX + 1].forEach((value) => {
      expect([value, getAiDailyLimitInputError(String(value)) === '']).toEqual([
        value,
        validAiDailyLimit({ limits: { aiPerWalletPerDay: value } }),
      ]);
    });
  });

  it('bounds AI by the set limit, and by the daily request limit when blank or 0', () => {
    const limits = { perWalletPerDay: 300, aiPerWalletPerDay: 9 };
    expect(resolveAiDailyLimit({ limits: withAiDailyLimit(limits, '40') })).toBe(40);
    expect(resolveAiDailyLimit({ limits: withAiDailyLimit(limits, '') })).toBe(300);
    expect(resolveAiDailyLimit({ limits: withAiDailyLimit(limits, '0') })).toBe(300);
  });
});
