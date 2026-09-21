import { canonicalizeSessionSlug } from '../../utilities/session/canonicalSessionContext';
import { resolveSessionCapabilityProjection } from '../../utilities/session/sessionCapabilityProjection';
import { resolveWorkerCanonicalSessionIdHex } from '../../utilities/session/sessionWorkerDiscovery';
import { getUsableSessionWorkerUrl } from '../../utilities/session/sessionWorkerAvailability';

// This validation is needed by the lazy invitation UI, not early URL capture.
export const resolveWorkerGroupAutoJoinContext = (sessionConfig: unknown, sessionSlug: string) => {
  const config = (sessionConfig || {}) as Record<string, unknown>;
  const slug = canonicalizeSessionSlug(sessionSlug);
  const projection = resolveSessionCapabilityProjection(config);
  const sessionId = resolveWorkerCanonicalSessionIdHex(config);
  const workerUrl = getUsableSessionWorkerUrl({ slug, sessionConfig, requireExactWorkerSession: true });
  if (
    !slug ||
    canonicalizeSessionSlug(config.slug) !== slug ||
    !sessionId ||
    !workerUrl ||
    projection.source !== 'profile' ||
    !projection.profileValid ||
    !projection.isWorkerCanonical
  )
    return null;
  return { sessionSlug: slug, sessionId, workerUrl, chainId: projection.hasOnChainComponent ? projection.chainId : 1 };
};
