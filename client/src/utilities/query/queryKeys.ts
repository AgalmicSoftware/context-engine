export type QueryKeyScalar = string | number | boolean | null;

export type QueryKeyScope = {
  chainId?: number | string | null;
  sessionSlug?: string | null;
  address?: string | null;
  ids?: readonly QueryKeyScalar[];
};

export type ScopedQueryKey = readonly [
  domain: string,
  entity: string,
  chainId: number | null,
  sessionSlug: string | null,
  address: string | null,
  ...ids: QueryKeyScalar[],
];

const normalizeRequiredPart = (value: string, label: string): string => {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(`Query key ${label} must not be empty`);
  return normalized;
};

const normalizeChainId = (value: QueryKeyScope['chainId']): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < 0) {
    throw new Error('Query key chainId must be a non-negative safe integer');
  }
  return normalized;
};

const normalizeOptionalText = (value: string | null | undefined): string | null => {
  const normalized = String(value || '').trim();
  return normalized || null;
};

const normalizeIds = (ids: readonly QueryKeyScalar[] = []): QueryKeyScalar[] =>
  ids.map((value) => {
    if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return value;
    throw new Error('Query key ids must be scalar values');
  });

export const queryKeys = {
  domain: (domain: string): readonly [string] => Object.freeze([normalizeRequiredPart(domain, 'domain')]),
  entity: (domain: string, entity: string): readonly [string, string] =>
    Object.freeze([normalizeRequiredPart(domain, 'domain'), normalizeRequiredPart(entity, 'entity')]),
  scoped: (domain: string, entity: string, scope: QueryKeyScope = {}): ScopedQueryKey =>
    Object.freeze([
      normalizeRequiredPart(domain, 'domain'),
      normalizeRequiredPart(entity, 'entity'),
      normalizeChainId(scope.chainId),
      normalizeOptionalText(scope.sessionSlug),
      normalizeOptionalText(scope.address)?.toLowerCase() || null,
      ...normalizeIds(scope.ids),
    ]) as ScopedQueryKey,
};
