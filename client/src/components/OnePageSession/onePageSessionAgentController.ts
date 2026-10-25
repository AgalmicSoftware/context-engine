import { resolveSessionBackendKind, type AgentSessionMeta } from '../../utilities/session/sessionBackendKind';
import {
  agentClientLoginEnvelopeMatchesIdentity,
  isAgentClientLoginEnvelopeExpired,
  type AgentClientLoginEnvelope,
  type AgentClientLoginIdentityTarget,
} from '../../utilities/session/agentClientLogin';
import { resolveWorkerCanonicalSessionIdHex } from '../../utilities/session/sessionWorkerDiscovery.js';
import { normalizeWorkerUrl } from '../../utilities/worker/workerUrl.js';
import type { AgentResultsDataset } from '../../utilities/session/agentSessionBackend';

export const DEFAULT_AGENT_BRIDGE_URL = 'https://ce-agent-bridge-worker.agalmic.workers.dev';

export type UnknownRecord = Record<string, unknown>;

export type OnePageSessionPropsLike = UnknownRecord & {
  autoFeatureSBTsBySessionSlug?: unknown;
  autoFeatureSBTsWithFeaturedSbtTags?: unknown;
  contracts?: unknown;
  questionsGenPrompt?: unknown;
  sessionConfig?: unknown;
  sessionName?: unknown;
  slug?: unknown;
};

export type OnePageSessionConfigRequest = {
  autoFeatureSBTsBySessionSlug: unknown;
  autoFeatureSBTsWithFeaturedSbtTags: unknown;
  contracts: unknown;
  incomingSessionConfig: unknown;
  questionsGenPrompt: unknown;
  sessionName: unknown;
  slug: string;
};

export type OnePageSessionAgentAuthFailureState = {
  agentQuestions: [];
  agentQuestionsStatus: 'idle';
  agentResults: null;
  agentResultsStatus: 'idle';
  agentClientEnvelope: null;
  agentPolisDataset: null;
  agentQuestionSubmitError: string;
};

export type OnePageSessionAgentDataResetState = {
  agentAnswerState: null;
  agentQuestions: [];
  agentQuestionsStatus: 'idle';
  agentResults: null;
  agentResultsStatus: 'idle';
  agentPolisDataset: null;
  agentQuestionPileIndex: 0;
  agentQuestionSubmitError: '';
  agentSubmittedQuestionIds: [];
  agentSubmittingQuestionId: '';
};

export type AgentClientLoginEnvelopeMemoryGlobal = {
  __CE_AGENT_CLIENT_LOGIN_ENVELOPES__?: Record<string, unknown>;
};

export const normalizeOnePageSessionSlug = (value: unknown = ''): string => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  return normalized === 'general' ? '' : normalized;
};

const isRecord = (value: unknown): value is UnknownRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const toRecord = (value: unknown): UnknownRecord => (isRecord(value) ? value : {});

const toTrimmedString = (value: unknown): string => String(value ?? '').trim();

export const resolveCurrentSessionSlugForProps = (
  propsIn: OnePageSessionPropsLike,
  resolveEffectiveSlug: (props: OnePageSessionPropsLike) => unknown,
): string => {
  const propsRecord = toRecord(propsIn);
  const sessionConfig = toRecord(propsRecord.sessionConfig);
  return normalizeOnePageSessionSlug(resolveEffectiveSlug(propsIn) || sessionConfig.slug || propsRecord.slug || '');
};

export const buildCurrentSessionConfigRequest = (
  propsIn: OnePageSessionPropsLike,
  resolveEffectiveSlug: (props: OnePageSessionPropsLike) => unknown,
): OnePageSessionConfigRequest => ({
  slug: resolveCurrentSessionSlugForProps(propsIn, resolveEffectiveSlug),
  sessionName: propsIn.sessionName,
  questionsGenPrompt: propsIn.questionsGenPrompt,
  autoFeatureSBTsBySessionSlug: propsIn.autoFeatureSBTsBySessionSlug,
  autoFeatureSBTsWithFeaturedSbtTags: propsIn.autoFeatureSBTsWithFeaturedSbtTags,
  incomingSessionConfig: propsIn.sessionConfig,
  contracts: propsIn.contracts,
});

export const resolveSessionAgentBridgeUrl = (sessionConfig: unknown = null): string => {
  const cfg = toRecord(sessionConfig);
  // Old deployments published these bridge URL aliases. Preserve them on reads.
  const legacySurfaceConfig = toRecord(cfg.telegram);
  return toTrimmedString(
    cfg.agentBridgeUrl ||
      cfg.agentBridgeWorkerUrl ||
      cfg.telegramAgentBridgeUrl ||
      legacySurfaceConfig.agentBridgeUrl ||
      legacySurfaceConfig.workerUrl ||
      DEFAULT_AGENT_BRIDGE_URL,
  ).replace(/\/+$/g, '');
};

export const resolveAgentClientLoginIdentityTarget = ({
  sessionConfig,
  sessionSlug,
}: {
  sessionConfig: unknown;
  sessionSlug: unknown;
}): AgentClientLoginIdentityTarget => {
  const cfg = toRecord(sessionConfig);
  return {
    sessionSlug: normalizeOnePageSessionSlug(sessionSlug || cfg.slug),
    sessionId: resolveWorkerCanonicalSessionIdHex(cfg),
    workerUrl: normalizeWorkerUrl(toTrimmedString(cfg.sessionWorkerUrl || cfg.workerUrl || cfg.corsWorkerUrl)),
    agentBridgeUrl: resolveSessionAgentBridgeUrl(cfg),
  };
};

export const isOnePageAgentBackendMode = ({
  sessionConfig,
  sessionSlug,
  agentSessionMeta,
}: {
  sessionConfig: unknown;
  sessionSlug: unknown;
  agentSessionMeta: AgentSessionMeta | null;
}): boolean =>
  resolveSessionBackendKind({
    sessionConfig,
    probeResult: agentSessionMeta,
    sessionSlug: normalizeOnePageSessionSlug(sessionSlug),
  }) === 'agent';

export const isOnePageAgentShellMode = ({
  sessionConfig,
  sessionSlug,
  agentSessionMeta,
  agentClientEnvelope,
  provider,
}: {
  sessionConfig: unknown;
  sessionSlug: unknown;
  agentSessionMeta: AgentSessionMeta | null;
  agentClientEnvelope: AgentClientLoginEnvelope | null;
  provider: unknown;
}): boolean => {
  if (!isOnePageAgentBackendMode({ sessionConfig, sessionSlug, agentSessionMeta })) return false;
  const config = toRecord(sessionConfig);
  // HTTP enables another login method; only profile-less legacy sessions force the agent shell.
  if (!Object.hasOwn(config, 'sessionModeProfile') && !Object.hasOwn(config, 'authority')) return true;
  return (
    provider === 'agent_token' &&
    isAgentClientLoginEnvelope(agentClientEnvelope) &&
    !isAgentClientLoginEnvelopeExpired(agentClientEnvelope) &&
    agentClientLoginEnvelopeMatchesIdentity(
      agentClientEnvelope,
      resolveAgentClientLoginIdentityTarget({ sessionConfig, sessionSlug }),
    )
  );
};

export const buildAgentAuthFailureState = (reason: unknown = ''): OnePageSessionAgentAuthFailureState => ({
  agentClientEnvelope: null,
  agentQuestionsStatus: 'idle',
  agentQuestions: [],
  agentResultsStatus: 'idle',
  agentResults: null,
  agentPolisDataset: null,
  agentQuestionSubmitError: String(reason || 'Agent session expired. Paste a fresh agent token.'),
});

export const buildAgentDataResetState = (): OnePageSessionAgentDataResetState => ({
  agentQuestionsStatus: 'idle',
  agentQuestions: [],
  agentAnswerState: null,
  agentQuestionPileIndex: 0,
  agentSubmittingQuestionId: '',
  agentSubmittedQuestionIds: [],
  agentQuestionSubmitError: '',
  agentResultsStatus: 'idle',
  agentResults: null,
  agentPolisDataset: null,
});

export const getAgentClientLoginEnvelopeMemoryKey = (target: unknown | AgentClientLoginIdentityTarget): string => {
  const source = isRecord(target) ? target : { sessionSlug: target };
  return [
    normalizeOnePageSessionSlug(source.sessionSlug) || 'general',
    resolveWorkerCanonicalSessionIdHex({ sessionId: source.sessionId }) || 'no-session-id',
    normalizeWorkerUrl(toTrimmedString(source.workerUrl)) || 'no-worker-origin',
    normalizeWorkerUrl(toTrimmedString(source.agentBridgeUrl)) || 'no-bridge-origin',
  ].join('\n');
};

export const clearAgentEnvelopeMemoryCache = (
  sessionSlug: unknown,
  globalTarget: AgentClientLoginEnvelopeMemoryGlobal = globalThis as AgentClientLoginEnvelopeMemoryGlobal,
): void => {
  try {
    const cache = globalTarget.__CE_AGENT_CLIENT_LOGIN_ENVELOPES__;
    if (cache && typeof cache === 'object') {
      const normalizedSlug = normalizeOnePageSessionSlug(sessionSlug);
      Object.entries(cache).forEach(([key, value]) => {
        if (normalizeOnePageSessionSlug(toRecord(value).sessionSlug) === normalizedSlug) {
          delete cache[key];
        }
      });
    }
  } catch (_) {}
};

export const cacheAgentClientLoginEnvelope = (
  envelope: AgentClientLoginEnvelope,
  globalTarget: AgentClientLoginEnvelopeMemoryGlobal = globalThis as AgentClientLoginEnvelopeMemoryGlobal,
): string => {
  const key = getAgentClientLoginEnvelopeMemoryKey({
    sessionSlug: envelope.sessionSlug,
    sessionId: envelope.sessionId,
    workerUrl: envelope.workerUrl,
    agentBridgeUrl: envelope.agentBridgeUrl,
  });
  if (
    !globalTarget.__CE_AGENT_CLIENT_LOGIN_ENVELOPES__ ||
    typeof globalTarget.__CE_AGENT_CLIENT_LOGIN_ENVELOPES__ !== 'object'
  ) {
    globalTarget.__CE_AGENT_CLIENT_LOGIN_ENVELOPES__ = {};
  }
  globalTarget.__CE_AGENT_CLIENT_LOGIN_ENVELOPES__[key] = envelope;
  return key;
};

export const resolveAgentResultsAuthFailureReason = (result: AgentResultsDataset): unknown | null => {
  const views = toRecord(result.views);
  for (const view of Object.values(views)) {
    const viewRecord = toRecord(view);
    if (viewRecord.status === 'auth') return viewRecord.reason;
  }
  return null;
};

const isAgentClientLoginEnvelope = (value: unknown): value is AgentClientLoginEnvelope => {
  const envelope = toRecord(value);
  const bridgeCredential = toRecord(envelope.bridgeCredential);
  const workerCredential = toRecord(envelope.workerCredential);
  return toTrimmedString(bridgeCredential.token).length > 0 && toTrimmedString(workerCredential.token).length > 0;
};

export const resolveAgentClientLoginEnvelopeFromEvent = (
  event: CustomEvent<unknown>,
  target: unknown | AgentClientLoginIdentityTarget,
): AgentClientLoginEnvelope | null => {
  const detail = toRecord(event?.detail);
  const envelope = detail.envelope;
  if (!isAgentClientLoginEnvelope(envelope)) return null;
  if (!agentClientLoginEnvelopeMatchesIdentity(envelope, target)) return null;
  return envelope;
};
