const isObj = (value) => !!value && typeof value === 'object' && !Array.isArray(value);

const isNonNegativeInteger = (value) => Number.isInteger(value) && value >= 0;

// Anonymous routes have no daily IP budget unless the session sets one; the per-wallet
// budget no longer doubles as one, which throttled whole venues sharing an address.
export const resolveAnonymousIpDailyLimit = (config = {}) => {
  const limits = isObj(config?.limits) ? config.limits : {};
  return isNonNegativeInteger(limits.perAnonymousIpPerDay) ? limits.perAnonymousIpPerDay : 0;
};
