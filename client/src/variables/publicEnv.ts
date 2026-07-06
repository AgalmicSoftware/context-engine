const readRawPublicEnv = (key: string): string => {
  try {
    if (typeof process !== 'undefined' && process?.env) {
      const value = process.env[key];
      if (typeof value === 'string' && value !== '') return value;
    }
  } catch (e) { void e; /* fallback: public env lookup. */ }

  return '';
};

export const readPublicEnv = (key: string, fallback = ''): string => {
  const value = readRawPublicEnv(key);
  return value !== '' ? value : fallback;
};

export const readPublicBoolEnv = (key: string, fallback = false): boolean => {
  const value = readRawPublicEnv(key);
  if (value !== '') {
    const normalized = value.trim().toLowerCase();
    if (normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on') {
      return true;
    }
    if (normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'off') {
      return false;
    }
  }

  return fallback;
};

export const readPublicIntEnv = (key: string, fallback = 0): number => {
  const value = readRawPublicEnv(key);
  if (value !== '') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }

  return fallback;
};

export const readPublicListEnv = (key: string, fallback: string[] = []): string[] => {
  const value = readRawPublicEnv(key);
  if (value !== '') {
    const trimmed = value.trim();
    const rawList = trimmed.startsWith('[')
      ? (() => {
          try {
            const parsed = JSON.parse(trimmed);
            return Array.isArray(parsed) ? parsed : null;
          } catch (e) { void e; /* fallback: CSV list parsing. */ }
          return null;
        })()
      : trimmed.split(',');

    if (Array.isArray(rawList)) {
      return rawList
        .map((entry) => String(entry == null ? '' : entry).trim())
        .filter((entry) => entry !== '');
    }
  }

  return Array.isArray(fallback) ? [...fallback] : [];
};
