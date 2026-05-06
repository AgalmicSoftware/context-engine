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

export function manageAutoHashPersistence(deps: AutoHashPersistenceDeps): void {
  try {
    if (typeof window === 'undefined') return;

    const key = `dg:autoHash:${deps.getActiveSlug()}`;
    const currentSearch = deps.getLocationSearch();

    if (hasAutoFlag(currentSearch)) {
      deps.sessionStorageSet(key, currentSearch.replace(/^\?/, ''));
      return;
    }

    if (currentSearch) return;

    const saved = deps.sessionStorageGet(key);
    if (!saved || !hasAutoFlag(saved)) return;

    const clean = saved.replace(/^[?#]/, '');
    deps.log('[MainSite] Restoring persisted auto-query:', clean);
    deps.replaceState(`${deps.getLocationPathname()}${clean ? `?${clean}` : ''}`);
  } catch (error) {
    deps.warn('[MainSite] manageAutoHashPersistence error:', error);
  }
}
