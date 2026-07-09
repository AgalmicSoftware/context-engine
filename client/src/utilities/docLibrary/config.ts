/** @file config.ts */
import { toStr } from '../shared/primitives.js';
import { STORAGE_BACKENDS, normalizeStorageBackend } from '../storage/storageRefs.js';

type SessionConfigLike =
  | {
      storageProfile?: { backend?: unknown } | null;
      storageBackend?: unknown;
      docLibrary?: {
        provider?: unknown;
        arweave?: {
          graphqlUrl?: unknown;
        } | null;
      } | null;
    }
  | null
  | undefined;

export const DEFAULT_ARWEAVE_GRAPHQL_URLS = Object.freeze([
  'https://permagate.io/graphql',
  'https://g8way.io/graphql',
  'https://arweave.net/graphql',
]) as readonly string[];

export const DEFAULT_ARWEAVE_GRAPHQL_URL = DEFAULT_ARWEAVE_GRAPHQL_URLS[0];

const normalizeGraphqlUrl = (raw: unknown = ''): string => {
  const value = toStr(raw).trim();
  if (!value) return '';
  try {
    const parsed = new URL(value);
    if (!/^https?:$/.test(parsed.protocol)) return '';
    return parsed.toString();
  } catch (_) {
    return '';
  }
};

export const resolveDocLibraryProvider = (sessionConfig: SessionConfigLike): string => {
  const cfg = sessionConfig && typeof sessionConfig === 'object' ? sessionConfig : {};
  const storageBackend = normalizeStorageBackend(cfg?.storageProfile?.backend || cfg?.storageBackend || '');
  if (storageBackend === STORAGE_BACKENDS.CLOUDFLARE) return STORAGE_BACKENDS.CLOUDFLARE;
  if (storageBackend === STORAGE_BACKENDS.LIT_ARWEAVE) return STORAGE_BACKENDS.LIT_ARWEAVE;
  const provider = toStr(cfg?.docLibrary?.provider || '')
    .trim()
    .toLowerCase();
  return provider || STORAGE_BACKENDS.ARWEAVE;
};

export const resolveArweaveGraphqlUrls = (sessionConfig: SessionConfigLike): string[] => {
  const cfg = sessionConfig && typeof sessionConfig === 'object' ? sessionConfig : {};
  const configured = normalizeGraphqlUrl(cfg?.docLibrary?.arweave?.graphqlUrl || '');
  const seen = new Set<string>();
  const urls: string[] = [];

  [configured, ...DEFAULT_ARWEAVE_GRAPHQL_URLS].forEach((entry) => {
    const normalized = normalizeGraphqlUrl(entry);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    urls.push(normalized);
  });

  return urls.length ? urls : [...DEFAULT_ARWEAVE_GRAPHQL_URLS];
};

export const resolveArweaveGraphqlUrl = (sessionConfig: SessionConfigLike): string =>
  resolveArweaveGraphqlUrls(sessionConfig)[0] || DEFAULT_ARWEAVE_GRAPHQL_URL;
