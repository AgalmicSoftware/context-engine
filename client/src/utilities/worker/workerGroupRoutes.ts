import { canonicalizeSessionSlug } from '../session/canonicalSessionContext.js';
import { buildPublicRoute } from '../ui/publicUrl.js';

const WORKER_GROUP_HASH_PREFIX = '#group-';

const normalizeListRoot = (rootPath: unknown): string => {
  const normalized = String(rootPath || '/groups')
    .trim()
    .replace(/\/+$/, '');
  return normalized === '/sbts' ? '/sbts' : '/groups';
};

export const buildWorkerGroupsPath = ({
  groupId = '',
  rootPath = '/groups',
  sessionSlug,
}: {
  groupId?: unknown;
  rootPath?: unknown;
  sessionSlug: unknown;
}): string => {
  const slug = canonicalizeSessionSlug(sessionSlug);
  const path = buildPublicRoute(normalizeListRoot(rootPath));
  if (!slug) return path;

  const params = new URLSearchParams();
  params.set('sessionName', slug);
  const normalizedGroupId = String(groupId || '').trim();
  const hash = normalizedGroupId ? `${WORKER_GROUP_HASH_PREFIX}${encodeURIComponent(normalizedGroupId)}` : '';
  return `${path}?${params.toString()}${hash}`;
};

export const readWorkerGroupIdFromHash = (hash: unknown): string => {
  const normalizedHash = String(hash || '').trim();
  if (!normalizedHash.startsWith(WORKER_GROUP_HASH_PREFIX)) return '';
  try {
    return decodeURIComponent(normalizedHash.slice(WORKER_GROUP_HASH_PREFIX.length)).trim();
  } catch {
    return '';
  }
};
