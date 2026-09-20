const isObj = (value) => !!value && typeof value === 'object' && !Array.isArray(value);

const isNonNegativeInteger = (value) => Number.isInteger(value) && value >= 0;

export const resolveAnonymousIpDailyLimit = (config = {}) => {
  const limits = isObj(config?.limits) ? config.limits : {};
  if (Object.prototype.hasOwnProperty.call(limits, 'perAnonymousIpPerDay')) {
    const explicitLimit = limits.perAnonymousIpPerDay;
    if (isNonNegativeInteger(explicitLimit)) return explicitLimit;
  }
  return limits.perWalletPerDay || 0;
};
