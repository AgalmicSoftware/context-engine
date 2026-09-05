import { normalizeTagList } from '../../utilities/defaultTags.js';
import { normalizeSessionSlug } from '../../utilities/session/sessionNaming.js';
import { getDemoSessionConfigBySlug, getSessionConfigBySlug } from '../../domains/sessions/sessionConfig.js';
import { resolveSessionCapabilityProjection } from '../../utilities/session/sessionCapabilityProjection';
import { sessionModeAllowsAnonymousWorkerGroupDiscovery } from '../../utilities/session/sessionModeProfile';
import { resolveWorkerCanonicalSessionIdHex } from '../../utilities/session/sessionWorkerDiscovery';
import { getUsableSessionWorkerUrl } from '../../utilities/session/sessionWorkerAvailability';
import {
  getWorkerSessionToken,
  loadPublicWorkerGroups,
  loadWorkerGroupOverview,
  type WorkerGroup,
  type WorkerGroupOverview,
} from '../../domains/worker/workerGroupPorts';
import { workerGroupNavigationPort } from '../../domains/worker/workerGroupNavigationPort';

type NetworkLike = {
  id?: number | string | null;
  chainId?: number | string | null;
  [key: string]: unknown;
} | null;

export type TagPageGroupSummary = {
  kind: 'sbt' | 'worker';
  address: string;
  href: string;
  name: string;
  image: string;
  tags: string[];
  sessionSlug: string;
  networkId: string;
};

export type TagPageWorkerGroupPorts = {
  getSessionConfig: (slug: string, configsBySlug: Record<string, unknown>) => unknown;
  getWorkerSessionToken: typeof getWorkerSessionToken;
  loadPublicWorkerGroups: (args: {
    workerUrl: unknown;
    sessionId: unknown;
    sessionSlug: unknown;
  }) => Promise<WorkerGroup[]>;
  loadWorkerGroupOverview: (args: {
    workerUrl: unknown;
    credentialToken: unknown;
    sessionId: unknown;
    sessionSlug: unknown;
  }) => Promise<WorkerGroupOverview>;
};

const dedupeSessionSlugs = (values: unknown[] | unknown = []): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  (Array.isArray(values) ? values : [values]).forEach((value) => {
    const normalized = normalizeSessionSlug(value);
    if (normalized == null || seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  });
  return out;
};

export const resolveTagPageWorkerSessionConfig = (
  slug: string,
  configsBySlug: Record<string, unknown> = {},
): unknown => {
  const registeredConfig = configsBySlug[slug] || getSessionConfigBySlug(slug);
  if (registeredConfig) return registeredConfig;
  // Regression guard: a direct tag URL can load before the registry snapshot
  // contains a known demo Worker, so opt into that exact tracked fallback.
  return getDemoSessionConfigBySlug(slug, { allowDemoFallback: true });
};

export const defaultTagPageWorkerGroupPorts: TagPageWorkerGroupPorts = {
  getSessionConfig: resolveTagPageWorkerSessionConfig,
  getWorkerSessionToken,
  loadPublicWorkerGroups,
  loadWorkerGroupOverview,
};

export const loadTagPageWorkerGroupData = async (
  {
    account,
    network,
    provider,
    selectedTags,
    sessionConfigsBySlug = {},
    sessionSlugs,
  }: {
    account?: unknown;
    network?: NetworkLike;
    provider?: unknown;
    selectedTags?: string[];
    sessionConfigsBySlug?: Record<string, unknown>;
    sessionSlugs?: string[];
  },
  ports: TagPageWorkerGroupPorts = defaultTagPageWorkerGroupPorts,
): Promise<TagPageGroupSummary[]> => {
  const normalizedSelectedTags = normalizeTagList(selectedTags);
  if (!normalizedSelectedTags.length) return [];
  const normalizedAccount = String(account || '').trim();

  const perSession = await Promise.all(
    dedupeSessionSlugs(sessionSlugs).map(async (sessionSlug) => {
      const sessionConfig = ports.getSessionConfig(sessionSlug, sessionConfigsBySlug);
      const projection = resolveSessionCapabilityProjection(sessionConfig);
      if (!projection.profileValid || !projection.isWorkerCanonical || !projection.usesWorkerGroups) return [];
      if (
        !normalizedAccount &&
        !sessionModeAllowsAnonymousWorkerGroupDiscovery(
          (sessionConfig as { sessionModeProfile?: unknown } | null)?.sessionModeProfile,
        )
      ) {
        return [];
      }

      const workerUrl = getUsableSessionWorkerUrl({
        slug: sessionSlug,
        sessionConfig,
        requireExactWorkerSession: true,
      });
      const sessionId = resolveWorkerCanonicalSessionIdHex(sessionConfig);
      if (!workerUrl || !sessionId) return [];

      try {
        let groups: WorkerGroup[];
        // Regression guard: mirror the native Groups visibility boundary—public
        // catalog when anonymous, account-authorized overview when signed in.
        if (normalizedAccount) {
          const credentialToken = await ports.getWorkerSessionToken({
            sessionSlug,
            sessionConfig,
            workerUrl,
            context: {
              account: normalizedAccount,
              providerLike: provider,
              chainId: network?.chainId || network?.id || projection.chainId || 1,
            },
          });
          const overview = await ports.loadWorkerGroupOverview({
            workerUrl,
            credentialToken,
            sessionId,
            sessionSlug,
          });
          groups = [...(overview.groups || []), ...(overview.memberships || []).map(({ group }) => group)];
        } else {
          groups = await ports.loadPublicWorkerGroups({ workerUrl, sessionId, sessionSlug });
        }

        const seen = new Set<string>();
        return groups.flatMap((group) => {
          const groupId = String(group?.groupId || '').trim();
          if (!groupId || seen.has(groupId)) return [];
          seen.add(groupId);
          const tags = Array.isArray(group?.tags)
            ? group.tags.map((tag) => String(tag || '').trim()).filter(Boolean)
            : [];
          const normalizedGroupTags = normalizeTagList(tags);
          if (!normalizedSelectedTags.every((tag) => normalizedGroupTags.includes(tag))) return [];
          return [
            {
              kind: 'worker' as const,
              address: groupId,
              href: workerGroupNavigationPort.buildPath({ groupId, sessionSlug }),
              name: String(group?.label || '').trim() || groupId,
              image: String(group?.imageUrl || '').trim(),
              tags,
              sessionSlug,
              networkId: 'worker',
            },
          ];
        });
      } catch {
        return [];
      }
    }),
  );

  return perSession.flat().sort((left, right) => {
    const nameCompare = left.name.localeCompare(right.name);
    return nameCompare !== 0 ? nameCompare : left.address.localeCompare(right.address);
  });
};
