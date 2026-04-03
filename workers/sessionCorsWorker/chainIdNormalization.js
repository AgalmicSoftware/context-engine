export const toChainId = (value) => {
  try {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  } catch {
    return 0;
  }
};
