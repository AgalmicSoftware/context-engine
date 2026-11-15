const isObj = (value) => !!value && typeof value === 'object' && !Array.isArray(value);

export const AI_DAILY_LIMIT_MAX = 100_000;

// Signed-in AI calls (the /ai route, the Session Agent and Agent HTTP's AI)
// share one count per person per day. A positive limits.aiPerWalletPerDay sets
// it, so a bound on AI spend never stops answers or reads; otherwise AI calls
// keep the general limits.perWalletPerDay, as before.
export const resolveAiDailyLimit = (config = {}) => {
  const limits = isObj(config?.limits) ? config.limits : {};
  const ai = limits.aiPerWalletPerDay;
  return Number.isInteger(ai) && ai > 0 ? ai : (limits.perWalletPerDay || 0);
};

export const validAiDailyLimit = (config = {}) => {
  const ai = isObj(config?.limits) ? config.limits.aiPerWalletPerDay : undefined;
  return ai === undefined || ai === null ||
    (Number.isInteger(ai) && ai >= 0 && ai <= AI_DAILY_LIMIT_MAX);
};
