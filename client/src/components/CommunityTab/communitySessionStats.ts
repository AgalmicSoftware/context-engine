import { resolveSessionCapabilityProjection } from '../../utilities/session/sessionCapabilityProjection';
import { parseSessionSlug } from '../../utilities/session/sessionSlug';
import { parseSessionWorkerDiscoveryOrigin } from '../../utilities/session/sessionWorkerDiscovery';
import { buildPublicRoute } from '../../utilities/ui/publicUrl';

type SessionRecord = Record<string, unknown>;
export type CommunitySessionKind = 'centralized' | 'decentralized' | 'unknown';
export type CommunitySessionEntry = {
  slug: string;
  name: string;
  kind: CommunitySessionKind;
  href: string;
  createdAt: number | null;
  lastActivityAt: number | null;
  adminAddresses: string[];
};

export type CommunitySessionFilters = {
  kind: '' | 'centralized' | 'decentralized';
  createdFrom: string;
  createdTo: string;
  activityFrom: string;
  activityTo: string;
  adminAddress: string;
};

export const createCommunitySessionFilters = (): CommunitySessionFilters => ({
  kind: '',
  createdFrom: '',
  createdTo: '',
  activityFrom: '',
  activityTo: '',
  adminAddress: '',
});

const asRecord = (value: unknown): SessionRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as SessionRecord) : {};

const timestampMs = (value: unknown): number | null => {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const numeric = Number(value);
  const ms = Number.isFinite(numeric) ? (numeric < 1e12 ? numeric * 1000 : numeric) : Date.parse(String(value));
  return Number.isFinite(ms) && ms > 0 && ms <= 8640000000000000 ? ms : null;
};

const sessionMetadata = (config: SessionRecord, kind: CommunitySessionKind) => {
  // Registry authority owns these fields. Worker cache read times are freshness
  // hints, not session activity, and must never make a dormant session look active.
  const source = kind === 'decentralized' ? asRecord(config.__registry) : config;
  const createdAt = timestampMs(source.createdAt);
  const activity = [source.lastActivityAt, source.updatedAt, source.createdAt]
    .map(timestampMs)
    .filter((value): value is number => value !== null);
  const addresses = [source.adminAddress, ...(Array.isArray(source.adminAddresses) ? source.adminAddresses : [])];
  return {
    createdAt,
    lastActivityAt: activity.length ? Math.max(...activity) : null,
    adminAddresses: [
      ...new Set(
        addresses
          .filter((value): value is string => typeof value === 'string' && /^0x[0-9a-f]{40}$/i.test(value.trim()))
          .map((value) => value.trim().toLowerCase()),
      ),
    ],
  };
};

const inDateRange = (timestamp: number | null, from: string, to: string) => {
  if (!from && !to) return true;
  if (timestamp === null) return false;
  // Date controls select local calendar days; constructing the next midnight
  // keeps the inclusive upper bound correct across daylight-saving transitions.
  const boundary = (date: string, nextDay = false) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NaN;
    const [year, month, day] = date.split('-').map(Number);
    return new Date(year, month - 1, day + (nextDay ? 1 : 0)).getTime();
  };
  return (!from || timestamp >= boundary(from)) && (!to || timestamp < boundary(to, true));
};

export const filterCommunitySessions = (sessions: CommunitySessionEntry[], filters: CommunitySessionFilters) => {
  const admin = filters.adminAddress.trim().toLowerCase();
  return sessions.filter(
    (session) =>
      (!filters.kind || session.kind === filters.kind) &&
      inDateRange(session.createdAt, filters.createdFrom, filters.createdTo) &&
      inDateRange(session.lastActivityAt, filters.activityFrom, filters.activityTo) &&
      (!admin || session.adminAddresses.some((address) => address.includes(admin))),
  );
};

export const classifyCommunitySession = (config: SessionRecord): CommunitySessionKind => {
  const projection = resolveSessionCapabilityProjection(config);
  const mode = asRecord(asRecord(config.sessionModeProfile).authority).mode;
  // Clean-route discovery hints have a partial profile until opened. Their
  // explicit authority can label a directory row without authorizing any action.
  if (projection.usesWorkerAuthority || mode === 'worker_canonical' || mode === 'worker_with_public_anchor') {
    return 'centralized';
  }
  if (projection.isRegistryCanonical || mode === 'evm_registry_canonical') return 'decentralized';
  return 'unknown';
};

export const buildCommunitySessionCatalog = ({
  entries = [],
  workerRecords = [],
}: {
  entries?: Array<[string, unknown]>;
  workerRecords?: unknown[];
}): CommunitySessionEntry[] => {
  const sessions = new Map<string, CommunitySessionEntry>();
  const add = (slugIn: unknown, value: unknown, workerOrigin?: unknown) => {
    const config = asRecord(value);
    if (!Object.keys(config).length || config.__unresolved) return;
    const parsed = parseSessionSlug(typeof config.slug === 'string' ? config.slug : slugIn);
    if (!parsed.ok || sessions.has(parsed.slug)) return;
    const kind = classifyCommunitySession(config);
    let workerQuery = '';
    if (kind === 'centralized') {
      try {
        const origin = parseSessionWorkerDiscoveryOrigin(workerOrigin || config.corsWorkerUrl);
        if (origin) workerQuery = `?worker=${encodeURIComponent(origin)}`;
      } catch (_) {
        // A missing discovery URL must not produce an unsafe or malformed link.
      }
    }
    sessions.set(parsed.slug, {
      slug: parsed.slug,
      name: String(config.sessionName || '').trim() || parsed.slug || 'General',
      kind,
      href: buildPublicRoute(`/session/${encodeURIComponent(parsed.slug || 'general')}${workerQuery}`),
      ...sessionMetadata(config, kind),
    });
  };

  // Configured/registry routes take precedence over stale local Worker hints,
  // matching the session route resolver's authority choice for a shared slug.
  entries.forEach(([slug, config]) => add(slug, config));
  workerRecords.forEach((value) => {
    const record = asRecord(value);
    if (record.authorityMode !== 'worker_canonical' || !record.canonicalConfig) return;
    add(record.slug, record.canonicalConfig, record.workerOrigin);
  });
  return [...sessions.values()].sort((a, b) => a.name.localeCompare(b.name) || a.slug.localeCompare(b.slug));
};

export const countCommunitySessions = (sessions: CommunitySessionEntry[]) => ({
  total: sessions.length,
  centralized: sessions.filter(({ kind }) => kind === 'centralized').length,
  decentralized: sessions.filter(({ kind }) => kind === 'decentralized').length,
  unknown: sessions.filter(({ kind }) => kind === 'unknown').length,
});
