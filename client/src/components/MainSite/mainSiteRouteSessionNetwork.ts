import type { AppShell } from './AppShell';

export const hasRouteCacheInitializationError = (host: AppShell): boolean =>
  !!(host.state.surveyCacheInitializationError || host.state.questionCacheInitializationError);

export const readRouteLocationSearch = () => {
  const searchStr = (typeof window !== 'undefined' ? window.location.search : '') || '';
  const hashStr = (typeof window !== 'undefined' ? window.location.hash : '') || '';
  return { searchStr, hashStr, searchParams: new URLSearchParams(searchStr) };
};

export const hasRouteSessionRegistryIdentity = (sessionConfig: unknown): boolean => {
  if (!sessionConfig || typeof sessionConfig !== 'object') return false;
  const cfg = sessionConfig as Record<string, unknown>;
  const registry =
    cfg.__registry && typeof cfg.__registry === 'object' ? (cfg.__registry as Record<string, unknown>) : {};
  return !!(
    cfg.sessionId ||
    cfg.sessionIdHex ||
    cfg.metadataURI ||
    registry.sessionId ||
    registry.sessionIdHex ||
    registry.metadataURI
  );
};

export const resolveRequestedRouteChainId = (value: string): number | null => {
  const tokens = value ? value.match(/\d+/g) : null;
  return tokens?.length ? Number(tokens[tokens.length - 1]) : null;
};

export const resolveRoutePathParts = (fullPath: string): readonly [string, string[], string] => {
  const pathWithoutQuery = String(fullPath || '').split('?')[0] || '';
  const pathSegments = pathWithoutQuery.split('/').filter(Boolean);
  return [
    pathWithoutQuery,
    pathSegments,
    String(pathSegments[0] || '')
      .trim()
      .toLowerCase(),
  ];
};

export const resolveRouteNetwork = (host: AppShell, sessionSlug: string, pathWithoutQuery: string) => {
  const connectedNetwork = pathWithoutQuery.startsWith('/session/') ? null : host.props.network || null;
  const chainId =
    host.getDisplaySessionChainId(sessionSlug) ||
    Number(connectedNetwork?.id || connectedNetwork?.chainId || 0) ||
    null;
  return [chainId, host.getDisplaySessionNetwork(sessionSlug) || connectedNetwork] as const;
};
