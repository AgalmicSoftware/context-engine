import { sessionSupportsOnChainSbt } from './onePageSessionSbtGroupRuntime';

type AutoMintRuntimeState = {
  autoMintTargets?: unknown[];
  autoMintStatuses?: Record<string, unknown>;
  autoMintCountdown?: number | null;
  autoMintingMode?: boolean;
  needsLoginForAutoMint?: boolean;
};

type OnePageSessionAutoMintRuntimeHost = {
  _autoMintCountdownTimer?: ReturnType<typeof setInterval> | null;
  _autoMintLegacyCredentialQuery?: string;
  _autoMintParseSourceSig?: string;
  _autoMintParseCachedTargets?: unknown[];
  state: AutoMintRuntimeState;
  setState: (patch: Partial<AutoMintRuntimeState>) => void;
  getAutoHashStorageKey: () => string;
  resolveCurrentSessionConfig: () => unknown;
  parseAutoMintFragment: () => unknown[];
  primeAutoMintTargets: (targets: unknown[]) => void;
  clearUnsupportedAutoMintState: (updateState?: boolean) => void;
};

type AutoMintFallbackHandler = (error: unknown) => void;

const isAutoMintCredentialKey = (key: string): boolean => /^(gp|inv|password)\d*$/.test(key.toLowerCase());

export const sanitizeSbtAutoMintQueryForStorage = (raw: unknown = ''): string => {
  const cleaned = String(raw || '').replace(/^[?#]/, '');
  if (!cleaned) return '';
  try {
    const params = new URLSearchParams(cleaned);
    Array.from(params.keys()).forEach((key) => {
      if (isAutoMintCredentialKey(key)) params.delete(key);
    });
    return params.toString();
  } catch (_) {
    return '';
  }
};

export const hasSbtAutoMintCredential = (raw: unknown = ''): boolean => {
  const cleaned = String(raw || '').replace(/^[?#]/, '');
  if (!cleaned) return false;
  try {
    const params = new URLSearchParams(cleaned);
    return Array.from(params.keys()).some(isAutoMintCredentialKey);
  } catch (_) {
    return false;
  }
};

export const buildSbtAutoMintCredentialCleanPath = (hrefRaw: unknown = ''): string | null => {
  try {
    const url = new URL(String(hrefRaw || ''));
    if (!hasSbtAutoMintCredential(url.search)) return null;
    Array.from(url.searchParams.keys()).forEach((key) => {
      if (isAutoMintCredentialKey(key)) url.searchParams.delete(key);
    });
    const query = url.searchParams.toString();
    return `${url.pathname}${query ? `?${query}` : ''}${url.hash || ''}`;
  } catch (_) {
    return null;
  }
};

export const clearUnsupportedSbtAutoMintState = (
  host: OnePageSessionAutoMintRuntimeHost,
  updateState = true,
  onFallback?: AutoMintFallbackHandler,
): void => {
  if (host._autoMintCountdownTimer) {
    clearInterval(host._autoMintCountdownTimer);
    host._autoMintCountdownTimer = null;
  }
  host._autoMintLegacyCredentialQuery = '';
  host._autoMintParseSourceSig = '';
  host._autoMintParseCachedTargets = [];
  try {
    sessionStorage.removeItem(host.getAutoHashStorageKey());
    const cleanPath =
      typeof window !== 'undefined' ? buildSbtAutoMintCredentialCleanPath(window.location.href || '') : null;
    if (cleanPath && window.history?.replaceState) {
      window.history.replaceState(null, '', cleanPath);
    }
  } catch (error) {
    onFallback?.(error);
  }
  if (
    updateState &&
    ((host.state.autoMintTargets || []).length > 0 ||
      Object.keys(host.state.autoMintStatuses || {}).length > 0 ||
      host.state.autoMintCountdown !== null ||
      host.state.autoMintingMode ||
      host.state.needsLoginForAutoMint)
  ) {
    host.setState({
      autoMintTargets: [],
      autoMintStatuses: {},
      autoMintCountdown: null,
      autoMintingMode: false,
      needsLoginForAutoMint: false,
    });
  }
};

export const initializeSbtAutoMintRuntime = (
  host: OnePageSessionAutoMintRuntimeHost,
  onFallback?: AutoMintFallbackHandler,
): void => {
  if (!sessionSupportsOnChainSbt(host.resolveCurrentSessionConfig())) {
    host.clearUnsupportedAutoMintState(false);
    return;
  }
  try {
    const currentSearch = typeof window !== 'undefined' ? window.location.search || '' : '';
    const params = new URLSearchParams(currentSearch.replace(/^\?/, ''));
    const hasAutoFlag =
      params.get('auto') === '1' ||
      Array.from(params.keys()).some((key) => /^auto\d+$/.test(key) && params.get(key) === '1');
    if (currentSearch && hasAutoFlag) {
      const safeQuery = sanitizeSbtAutoMintQueryForStorage(currentSearch);
      if (safeQuery) sessionStorage.setItem(host.getAutoHashStorageKey(), safeQuery);
    }
    if (hasSbtAutoMintCredential(currentSearch)) {
      host._autoMintLegacyCredentialQuery = currentSearch;
    }
  } catch (error) {
    onFallback?.(error);
  }
  const targets = host.parseAutoMintFragment();
  if (targets.length > 0) host.primeAutoMintTargets(targets);
  try {
    const cleanPath =
      typeof window !== 'undefined' ? buildSbtAutoMintCredentialCleanPath(window.location.href || '') : null;
    if (cleanPath && window.history?.replaceState) {
      window.history.replaceState(null, '', cleanPath);
    }
  } catch (error) {
    onFallback?.(error);
  }
};
