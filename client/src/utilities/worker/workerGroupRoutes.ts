import { canonicalizeSessionSlug } from '../session/canonicalSessionContext.js';
import { buildPublicRoute, stripPublicUrlBasePath } from '../ui/publicUrl.js';

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
  const normalizedGroupId = String(groupId || '').trim();
  const path = normalizedGroupId
    ? buildPublicRoute(`/group/${encodeURIComponent(normalizedGroupId)}`)
    : buildPublicRoute(normalizeListRoot(rootPath));
  if (!slug) return path;

  const params = new URLSearchParams();
  params.set('sessionName', slug);
  return `${path}?${params.toString()}`;
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

export const readWorkerGroupIdFromPath = (path: unknown): string => {
  const parts = stripPublicUrlBasePath(String(path || ''))
    .split('?')[0]
    .split('#')[0]
    .split('/')
    .filter(Boolean);
  if (String(parts[0] || '').toLowerCase() !== 'group' || !parts[1] || parts.length !== 2) return '';
  try {
    return decodeURIComponent(parts[1]).trim();
  } catch {
    return '';
  }
};
