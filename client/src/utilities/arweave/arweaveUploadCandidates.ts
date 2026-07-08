import { resolveCorsProxyUrl } from '../worker/corsProxy.js';
import { defaultStrictAllowDemoFallback } from '../worker/workerSessionResolution.js';
import { readSessionScanSlugs } from '../session/sessionScanScope.js';
import { readSponsoredBootstrapFundingContext } from '../session/sponsoredBootstrapFunding.js';
import { getSharedFallbackWorkerUrl } from '../session/sessionWorkerAvailability.js';
import {
  classifyUploadGateStatus,
  getUploadCandidateReasonPriority,
  hasSponsoredArweaveKey,
  normalizeUploadSessionSlug,
  normalizeWorkerBaseUrl,
} from './arweaveUploadFallbackPolicy';

type UnknownRecord = Record<string, unknown>;

type UploadCandidateSource = {
  explicitWorkerUrl: string;
  reason: string;
  slug: string;
};

export type ArweaveUploadCandidate = {
  allowsArweaveUpload: boolean;
  gateStatus: string;
  hasSponsoredArweaveKey: boolean;
  order: number;
  preferenceRank: number;
  reason: string;
  sessionSlug: string;
  workerUrl: string;
};

const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' ? (value as UnknownRecord) : {};

const readScopeUploadSlugs = (): string[] => {
  try {
    const slugs = readSessionScanSlugs();
    return Array.isArray(slugs) ? slugs : [];
  } catch {
    return [];
  }
};

const readSponsoredUploadContext = (selectedSessionSlug = '') => {
  try {
    const context = asRecord(readSponsoredBootstrapFundingContext());
    if (!Object.keys(context).length) return null;
    const selectedSlug = normalizeUploadSessionSlug(selectedSessionSlug);
    const targetSlug = normalizeUploadSessionSlug(context.targetSessionSlug || '');
    if (targetSlug && selectedSlug && targetSlug !== selectedSlug) return null;
    const sessionSlug = normalizeUploadSessionSlug(context.sessionSlug || '');
    const workerUrl = normalizeWorkerBaseUrl(context.workerUrl || '');
    if (!sessionSlug && !workerUrl) return null;
    return {
      sessionSlug,
      workerUrl,
      targetSessionSlug: targetSlug,
    };
  } catch {
    return null;
  }
};

const compareUploadCandidates = (a: ArweaveUploadCandidate, b: ArweaveUploadCandidate): number => {
  const reasonPriorityA = getUploadCandidateReasonPriority(a.reason);
  const reasonPriorityB = getUploadCandidateReasonPriority(b.reason);
  if (reasonPriorityA !== reasonPriorityB) return reasonPriorityA - reasonPriorityB;
  if (a.preferenceRank !== b.preferenceRank) return a.preferenceRank - b.preferenceRank;
  if (a.hasSponsoredArweaveKey !== b.hasSponsoredArweaveKey) {
    return a.hasSponsoredArweaveKey ? -1 : 1;
  }
  return a.order - b.order;
};

export const buildUploadSessionCandidates = async ({
  selectedSessionSlug = '',
  initialWorkerUrl = '',
  context = null,
}: {
  context?: unknown;
  initialWorkerUrl?: unknown;
  selectedSessionSlug?: unknown;
} = {}): Promise<ArweaveUploadCandidate[]> => {
  const selectedSlug = normalizeUploadSessionSlug(selectedSessionSlug);
  const normalizedInitialWorker = normalizeWorkerBaseUrl(initialWorkerUrl || '');
  const scopedSlugs = readScopeUploadSlugs();
  const sponsoredContext = readSponsoredUploadContext(selectedSlug);
  const sharedFallbackWorkerUrl = normalizeWorkerBaseUrl(getSharedFallbackWorkerUrl() || '');
  const orderedSources: UploadCandidateSource[] = [];
  const seenSourceKeys = new Set<string>();
  const pushSource = ({ slug = '', reason = 'scope-list', explicitWorkerUrl = '' } = {}) => {
    const normalizedSlug = normalizeUploadSessionSlug(slug || '');
    const normalizedWorkerUrl = normalizeWorkerBaseUrl(explicitWorkerUrl || '');
    const sourceKey = `${normalizedSlug}|${normalizedWorkerUrl}`;
    if (seenSourceKeys.has(sourceKey)) return;
    seenSourceKeys.add(sourceKey);
    orderedSources.push({
      slug: normalizedSlug,
      reason,
      explicitWorkerUrl: normalizedWorkerUrl,
    });
  };
  pushSource({
    slug: selectedSlug,
    reason: 'selected-session',
    explicitWorkerUrl: normalizedInitialWorker,
  });
  if (sponsoredContext) {
    pushSource({
      slug: sponsoredContext.sessionSlug,
      reason: 'sponsored-referrer',
      explicitWorkerUrl: sponsoredContext.workerUrl,
    });
  }
  if (sharedFallbackWorkerUrl) {
    pushSource({
      slug: '',
      reason: 'shared-fallback',
      explicitWorkerUrl: sharedFallbackWorkerUrl,
    });
  }
  scopedSlugs.forEach((slug) => pushSource({ slug, reason: 'scope-list' }));
  if (!orderedSources.length) pushSource({ slug: '', reason: 'selected-session' });

  const candidates: ArweaveUploadCandidate[] = [];
  for (let index = 0; index < orderedSources.length; index += 1) {
    const source = orderedSources[index];
    const slug = source.slug;
    let resolved: UnknownRecord | null = null;
    if (!source.explicitWorkerUrl) {
      try {
        resolved = asRecord(
          await resolveCorsProxyUrl({
            sessionSlug: slug,
            context,
            allowDemoFallback: defaultStrictAllowDemoFallback(),
          }),
        );
      } catch {
        resolved = null;
      }
    }
    const workerUrl = source.explicitWorkerUrl ? source.explicitWorkerUrl : normalizeWorkerBaseUrl(resolved?.url || '');
    if (!workerUrl) continue;
    const resolvedSessionConfig = resolved?.session || resolved?.group || null;
    const gateSummary = classifyUploadGateStatus(resolvedSessionConfig, 'arweave');
    candidates.push({
      sessionSlug: slug,
      workerUrl,
      reason: source.reason || (index === 0 ? 'selected-session' : 'scope-list'),
      gateStatus: gateSummary.gateStatus,
      preferenceRank: gateSummary.preferenceRank,
      allowsArweaveUpload: gateSummary.allowsArweaveUpload,
      hasSponsoredArweaveKey: hasSponsoredArweaveKey(resolvedSessionConfig),
      order: index,
    });
  }

  if (candidates.length <= 1) return candidates;
  const [first, ...rest] = candidates;
  rest.sort(compareUploadCandidates);
  return [first, ...rest];
};
