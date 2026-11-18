const TOOLTIPS_ENABLED_STORAGE_KEY = 'ce:tooltipsEnabled';

export const normalizeTooltipsEnabled = (value: unknown): boolean => (value === false ? false : true);

export const readStoredTooltipsEnabled = (): boolean => {
  try {
    const storedValue = localStorage.getItem(TOOLTIPS_ENABLED_STORAGE_KEY);
    return storedValue !== null ? normalizeTooltipsEnabled(JSON.parse(storedValue)) : true;
  } catch (_) {
    return true;
  }
};

export const persistTooltipsEnabled = (value: boolean): void => {
  try {
    localStorage.setItem(TOOLTIPS_ENABLED_STORAGE_KEY, JSON.stringify(normalizeTooltipsEnabled(value)));
  } catch (_) {}
};
