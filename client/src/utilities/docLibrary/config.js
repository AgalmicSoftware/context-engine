/** @file config.js */
import { toStr } from '../shared/primitives.js';

export const DEFAULT_ARWEAVE_GRAPHQL_URL = 'https://arweave.net/graphql';

export const resolveDocLibraryProvider = (sessionConfig) => {
  const cfg = sessionConfig && typeof sessionConfig === 'object' ? sessionConfig : {};
  const provider = toStr(cfg?.docLibrary?.provider || '').trim().toLowerCase();
  return provider || 'arweave';
};

export const resolveArweaveGraphqlUrl = (sessionConfig) => {
  const cfg = sessionConfig && typeof sessionConfig === 'object' ? sessionConfig : {};
  const raw = toStr(cfg?.docLibrary?.arweave?.graphqlUrl || '').trim();
  if (!raw) return DEFAULT_ARWEAVE_GRAPHQL_URL;
  try {
    const parsed = new URL(raw);
    if (!/^https?:$/.test(parsed.protocol)) return DEFAULT_ARWEAVE_GRAPHQL_URL;
    return parsed.toString();
  } catch (_) {
    return DEFAULT_ARWEAVE_GRAPHQL_URL;
  }
};
