export const coerceSbtPageStringArrayValue = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map((entry: unknown) => String(entry));
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.map((entry: unknown) => String(entry));
      } catch (_) {}
    }
    return [trimmed];
  }
  return [];
};

export const getErrorMessage = (error: unknown, fallback = 'Unknown error'): string => {
  const message =
    error !== null && (typeof error === 'object' || typeof error === 'function') && 'message' in error
      ? error.message
      : undefined;
  return error instanceof Error && error.message ? error.message : String(message || error || fallback);
};

export const resolveSbtPageCopyableErrorText = (error: unknown): string =>
  typeof error === 'string' && error ? error : getErrorMessage(error, '');

export const coerceSbtPageEpochSeconds = (value: unknown): number => {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n > 1e12 ? Math.floor(n / 1000) : n;
};
