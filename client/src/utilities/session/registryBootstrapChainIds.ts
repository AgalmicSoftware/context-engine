type SessionRegistryBootstrapScope = 'active' | 'all' | 'general' | 'list';

type SessionRegistryBootstrapOptions = {
  scope?: unknown;
  list?: unknown;
  activeChainId?: unknown;
  defaultChainId?: unknown;
  forceAllChains?: boolean;
};

const toPositiveChainId = (value: unknown): number => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
};

const normalizeScope = (value: unknown): SessionRegistryBootstrapScope => {
  const raw = String(value || '')
    .trim()
    .toLowerCase();
  if (raw === 'all' || raw === 'list' || raw === 'general') return raw;
  return 'active';
};

const normalizeListSlug = (value: unknown): string => {
  const raw = String(value == null ? '' : value)
    .trim()
    .toLowerCase();
  if (!raw || raw === 'general') return '';
  return raw;
};

const hasConcreteListTargets = (list: ReadonlyArray<unknown> = []): boolean =>
  (Array.isArray(list) ? list : []).some((slug) => normalizeListSlug(slug));

export const resolveSessionRegistryBootstrapChainIds = ({
  scope = 'active',
  list = [],
  activeChainId = null,
  defaultChainId = null,
  forceAllChains = false,
}: SessionRegistryBootstrapOptions = {}): number[] | undefined => {
  if (forceAllChains) return undefined;

  const normalizedScope = normalizeScope(scope);
  if (normalizedScope === 'all') return undefined;
  if (normalizedScope === 'list' && hasConcreteListTargets(Array.isArray(list) ? list : [])) {
    return undefined;
  }

  const resolvedChainId = toPositiveChainId(activeChainId) || toPositiveChainId(defaultChainId);
  return resolvedChainId ? [resolvedChainId] : undefined;
};

export default resolveSessionRegistryBootstrapChainIds;
