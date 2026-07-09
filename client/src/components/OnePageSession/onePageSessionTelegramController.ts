import { resolveSessionBackendKind, type TelegramSessionMeta } from '../../utilities/session/sessionBackendKind';
import type { AgentClientLoginEnvelope } from '../../utilities/session/agentClientLogin';
import type { TelegramResultsDataset } from '../../utilities/session/telegramSessionBackend';

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

export type OnePageSessionTelegramAuthFailureState = {
  telegramAgentQuestions: [];
  telegramAgentQuestionsStatus: 'idle';
  telegramAgentResults: null;
  telegramAgentResultsStatus: 'idle';
  telegramClientEnvelope: null;
  telegramPolisDataset: null;
  telegramQuestionSubmitError: string;
};

export type OnePageSessionTelegramDataResetState = {
  telegramAgentAnswerState: null;
  telegramAgentQuestions: [];
  telegramAgentQuestionsStatus: 'idle';
  telegramAgentResults: null;
  telegramAgentResultsStatus: 'idle';
  telegramPolisDataset: null;
  telegramQuestionPileIndex: 0;
  telegramQuestionSubmitError: '';
  telegramSubmittedQuestionIds: [];
  telegramSubmittingQuestionId: '';
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

export const resolveTelegramAgentBridgeUrl = (sessionConfig: unknown = null): string => {
  const cfg = toRecord(sessionConfig);
  const telegram = toRecord(cfg.telegram);
  return toTrimmedString(
    cfg.agentBridgeUrl ||
      cfg.agentBridgeWorkerUrl ||
      cfg.telegramAgentBridgeUrl ||
      telegram.agentBridgeUrl ||
      telegram.workerUrl ||
      DEFAULT_AGENT_BRIDGE_URL,
  ).replace(/\/+$/g, '');
};

export const isOnePageTelegramBackendMode = ({
  sessionConfig,
  sessionSlug,
  telegramSessionMeta,
}: {
  sessionConfig: unknown;
  sessionSlug: unknown;
  telegramSessionMeta: TelegramSessionMeta | null;
}): boolean =>
  resolveSessionBackendKind({
    sessionConfig,
    probeResult: telegramSessionMeta,
    sessionSlug: normalizeOnePageSessionSlug(sessionSlug),
  }) === 'telegram';

export const buildTelegramAuthFailureState = (reason: unknown = ''): OnePageSessionTelegramAuthFailureState => ({
  telegramClientEnvelope: null,
  telegramAgentQuestionsStatus: 'idle',
  telegramAgentQuestions: [],
  telegramAgentResultsStatus: 'idle',
  telegramAgentResults: null,
  telegramPolisDataset: null,
  telegramQuestionSubmitError: String(reason || 'Telegram session expired. Paste a fresh agent token.'),
});

export const buildTelegramDataResetState = (): OnePageSessionTelegramDataResetState => ({
  telegramAgentQuestionsStatus: 'idle',
  telegramAgentQuestions: [],
  telegramAgentAnswerState: null,
  telegramQuestionPileIndex: 0,
  telegramSubmittingQuestionId: '',
  telegramSubmittedQuestionIds: [],
  telegramQuestionSubmitError: '',
  telegramAgentResultsStatus: 'idle',
  telegramAgentResults: null,
  telegramPolisDataset: null,
});

export const getAgentClientLoginEnvelopeMemoryKey = (sessionSlug: unknown): string =>
  normalizeOnePageSessionSlug(sessionSlug) || 'general';

export const clearTelegramEnvelopeMemoryCache = (
  sessionSlug: unknown,
  globalTarget: AgentClientLoginEnvelopeMemoryGlobal = globalThis as AgentClientLoginEnvelopeMemoryGlobal,
): void => {
  try {
    const cache = globalTarget.__CE_AGENT_CLIENT_LOGIN_ENVELOPES__;
    if (cache && typeof cache === 'object') {
      delete cache[getAgentClientLoginEnvelopeMemoryKey(sessionSlug)];
    }
  } catch (_) {}
};

export const cacheAgentClientLoginEnvelope = (
  envelope: AgentClientLoginEnvelope,
  globalTarget: AgentClientLoginEnvelopeMemoryGlobal = globalThis as AgentClientLoginEnvelopeMemoryGlobal,
): string => {
  const key = getAgentClientLoginEnvelopeMemoryKey(envelope.sessionSlug);
  if (
    !globalTarget.__CE_AGENT_CLIENT_LOGIN_ENVELOPES__ ||
    typeof globalTarget.__CE_AGENT_CLIENT_LOGIN_ENVELOPES__ !== 'object'
  ) {
    globalTarget.__CE_AGENT_CLIENT_LOGIN_ENVELOPES__ = {};
  }
  globalTarget.__CE_AGENT_CLIENT_LOGIN_ENVELOPES__[key] = envelope;
  return key;
};

export const resolveTelegramResultsAuthFailureReason = (result: TelegramResultsDataset): unknown | null => {
  const views = toRecord(result.views);
  for (const view of Object.values(views)) {
    const viewRecord = toRecord(view);
    if (viewRecord.status === 'auth') return viewRecord.reason;
  }
  return null;
};

const isAgentClientLoginEnvelope = (value: unknown): value is AgentClientLoginEnvelope => {
  const envelope = toRecord(value);
  const credential = toRecord(envelope.credential);
  return toTrimmedString(credential.token).length > 0;
};

export const resolveAgentClientLoginEnvelopeFromEvent = (
  event: CustomEvent<unknown>,
  currentSessionSlug: unknown,
): AgentClientLoginEnvelope | null => {
  const detail = toRecord(event?.detail);
  const envelope = detail.envelope;
  if (!isAgentClientLoginEnvelope(envelope)) return null;
  if (normalizeOnePageSessionSlug(envelope.sessionSlug) !== normalizeOnePageSessionSlug(currentSessionSlug))
    return null;
  return envelope;
};
