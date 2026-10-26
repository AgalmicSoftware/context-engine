export type WorkerCapabilities = {
  legacy: boolean;
  unavailable?: boolean;
  features: string[];
  apiVersion?: number;
  bundle?: string | null;
  session?: {
    readiness: Record<string, string>;
    unavailable: Array<{ operation: string; reason: string }>;
  };
};

export const KNOWN_WORKER_FEATURES = [
  'envelope_export_identity_v1',
  'recovery_key_export',
  'response_upload_receipts',
  'results_analysis_retry_v1',
  'session_backup_v1',
  'upload_authority_stamps',
  'worker_groups',
] as const;

const cache = new Map<string, { until: number; value: Promise<WorkerCapabilities> }>();
const legacy = (): WorkerCapabilities => ({ legacy: true, features: [] });
const unavailable = (): WorkerCapabilities => ({ legacy: false, features: [], unavailable: true });

export const readWorkerCapabilities = async (
  workerUrl: string,
  slug: string,
  {
    fetchImpl = globalThis.fetch,
    now = Date.now,
    refreshUnavailable = false,
  }: { fetchImpl?: typeof fetch; now?: () => number; refreshUnavailable?: boolean } = {},
): Promise<WorkerCapabilities> => {
  let origin: string;
  try {
    const url = new URL(workerUrl);
    if (!['http:', 'https:'].includes(url.protocol)) return unavailable();
    origin = url.origin;
  } catch {
    return unavailable();
  }
  const key = JSON.stringify([origin, slug]);
  const cached = cache.get(key);
  if (cached && cached.until > now()) {
    const known = await cached.value;
    if (!refreshUnavailable || !known.session?.unavailable.length) return known;
    const newer = cache.get(key);
    if (newer && newer !== cached && newer.until > now()) return newer.value;
  }
  let cacheable = false;
  const value = (async (): Promise<WorkerCapabilities> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetchImpl(`${origin}/capabilities?slug=${encodeURIComponent(slug)}`, {
        method: 'GET',
        credentials: 'omit',
        cache: refreshUnavailable ? 'no-store' : 'default',
        signal: controller.signal,
      });
      if (response.status === 404) {
        cacheable = true;
        return legacy();
      }
      if (!response.ok) return unavailable();
      let body;
      try {
        body = await response.json();
      } catch (error) {
        if (!(error instanceof SyntaxError)) return unavailable();
        cacheable = true;
        return legacy();
      }
      if (
        body?.type !== 'ce_worker_capabilities' ||
        body.version !== 1 ||
        !Number.isSafeInteger(body.apiVersion) ||
        body.apiVersion < 1 ||
        !Array.isArray(body.features)
      )
        return unavailable();
      cacheable = true;
      return {
        legacy: false,
        apiVersion: body.apiVersion,
        bundle: typeof body.bundle === 'string' ? body.bundle : null,
        features: body.features.filter((item: unknown): item is string => typeof item === 'string'),
        ...(body.session && Array.isArray(body.session.unavailable)
          ? {
              session: {
                readiness: body.session.readiness || {},
                unavailable: body.session.unavailable.filter(
                  (item: { operation?: unknown; reason?: unknown } | null) =>
                    item && typeof item.operation === 'string' && typeof item.reason === 'string',
                ),
              },
            }
          : {}),
      };
    } catch {
      return unavailable();
    } finally {
      clearTimeout(timeout);
    }
  })();
  const entry = { until: Infinity, value };
  cache.set(key, entry);
  void value.then((result) => {
    if (cache.get(key) !== entry) return;
    if (!cacheable) cache.delete(key);
    else entry.until = now() + (result.session?.unavailable.length ? 30_000 : 5 * 60_000);
  });
  return value;
};

export const describeWorkerUnavailable = (reason: string): string => {
  const reasons: Record<string, string> = {
    coordinator_missing: 'The session Worker is missing its coordinator binding.',
    coordinator_unavailable: 'The session coordinator is unavailable. Try again after the operator restores it.',
    configAuthority_unavailable: 'The session configuration is temporarily unavailable.',
    configAuthority_seeding: 'The session configuration is still being prepared.',
    configAuthority_migration_required: 'The session configuration needs an operator migration.',
    storage_missing: 'The session Worker is missing its storage index.',
    kek_missing: 'The session Worker is missing its recovery key.',
    tokenHmac_missing: 'The session Worker is missing its sign-in key.',
  };
  return reasons[reason] || `The session Worker reports this operation unavailable (${reason}).`;
};
