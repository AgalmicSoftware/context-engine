export interface AutoHashPersistenceDeps {
  getActiveSlug: () => string;
  getLocationSearch: () => string;
  getLocationPathname: () => string;
  sessionStorageGet: (key: string) => string | null;
  sessionStorageSet: (key: string, value: string) => void;
  replaceState: (url: string) => void;
  log: (message: string, ...args: unknown[]) => void;
  warn: (message: string, error: unknown) => void;
}

export function hasAutoFlag(raw: string | null | undefined): boolean {
  const cleaned = String(raw || '').replace(/^[?#]/, '');
  if (!cleaned) return false;

  const params = new URLSearchParams(cleaned);
  if (params.get('auto') === '1') return true;

  for (const key of params.keys()) {
    if (/^auto\d+$/.test(key) && params.get(key) === '1') {
      return true;
    }
  }

  return false;
}

export function sanitizeAutoQueryForPersistence(raw: string | null | undefined): string {
  const cleaned = String(raw || '').replace(/^[?#]/, '');
  if (!cleaned) return '';
  try {
    const params = new URLSearchParams(cleaned);
    Array.from(params.keys()).forEach((key) => {
      const normalizedKey = key.toLowerCase();
      if (
        normalizedKey === 'gp' ||
        normalizedKey === 'inv' ||
        normalizedKey === 'password' ||
        /^(gp|inv|password)\d+$/.test(normalizedKey)
      ) {
        params.delete(key);
      }
    });
    return params.toString();
  } catch (_) {
    return '';
  }
}

export function manageAutoHashPersistence(deps: AutoHashPersistenceDeps): void {
  try {
    if (typeof window === 'undefined') return;

    const key = `dg:autoHash:${deps.getActiveSlug()}`;
    const currentSearch = deps.getLocationSearch();

    if (hasAutoFlag(currentSearch)) {
      const safeQuery = sanitizeAutoQueryForPersistence(currentSearch);
      if (safeQuery) deps.sessionStorageSet(key, safeQuery);
      return;
    }

    if (currentSearch) return;

    const saved = deps.sessionStorageGet(key);
    if (!saved || !hasAutoFlag(saved)) return;

    const safeQuery = sanitizeAutoQueryForPersistence(saved);
    if (!safeQuery || !hasAutoFlag(safeQuery)) return;
    if (safeQuery !== saved.replace(/^[?#]/, '')) {
      deps.sessionStorageSet(key, safeQuery);
    }
    deps.log('[MainSite] Restoring persisted auto-query:', safeQuery);
    deps.replaceState(`${deps.getLocationPathname()}?${safeQuery}`);
  } catch (error) {
    deps.warn('[MainSite] manageAutoHashPersistence error:', error);
  }
}
