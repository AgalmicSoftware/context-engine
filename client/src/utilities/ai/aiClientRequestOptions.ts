import { resolveSessionConfigAliases } from '../session/sessionNaming.js';
import type { SessionConfig, UnknownRecord } from '../session/sessionTypes.js';

const AI_REQUEST_OPTION_KEYS = [
  'sessionSlug',
  'sessionConfig',
  'context',
  'workerUrl',
  'preferLocal',
  'provider',
  'model',
  'apiKey',
  'rpcUrl',
  'max_tokens',
  'maxTokens',
  'max_completion_tokens',
  'max_output_tokens',
  'response_format',
  'temperature',
  'endpoint',
  'reasoning_effort',
  'reasoningEffort',
  'taskType',
  'messages',
] as const;

export type AiClientOptionRecord = UnknownRecord & {
  apiKey?: unknown;
  arweaveJwk?: unknown;
  context?: unknown;
  maxUploadBytes?: unknown;
  model?: unknown;
  preferLocal?: unknown;
  provider?: unknown;
  rpcUrl?: unknown;
  signal?: unknown;
  sessionConfig?: SessionConfig | null | unknown;
  sessionSelection?: unknown;
  sessionSlug?: unknown;
  sessionTitle?: unknown;
  style?: unknown;
  taskType?: unknown;
  thinking?: unknown;
  throwOnError?: unknown;
  workerUrl?: unknown;
};

export type AiClientProviderLike = string | UnknownRecord | null | undefined;

export type AiClientContext = UnknownRecord & {
  account?: string;
  chainId?: number | string | null;
  lit?: UnknownRecord | null;
  providerLike?: AiClientProviderLike;
};

export type AiSessionSelection = UnknownRecord & {
  gateStatus?: unknown;
  reason?: unknown;
};

export type AiSessionOptions = {
  context: AiClientContext | undefined;
  sessionConfig: SessionConfig | null;
  sessionSlug: string;
};

const asOptionRecord = (input: unknown = {}): AiClientOptionRecord =>
  input && typeof input === 'object' && !Array.isArray(input) ? (input as AiClientOptionRecord) : {};

const readAiClientContext = (input: unknown): AiClientContext | undefined =>
  input && typeof input === 'object' && !Array.isArray(input) ? (input as AiClientContext) : undefined;

const readPreferLocal = (input: unknown): boolean | undefined => (typeof input === 'boolean' ? input : undefined);

export const normalizeAiClientOptions = (input: unknown = {}): AiClientOptionRecord => asOptionRecord(input);

export const readAiOptionThinking = (input: unknown = {}): boolean => !!asOptionRecord(input).thinking;

export const readAiOptionThrowOnError = (input: unknown = {}): boolean => !!asOptionRecord(input).throwOnError;

export const readAiOptionTaskType = (input: unknown = {}, fallback: unknown = ''): unknown =>
  asOptionRecord(input).taskType || fallback;

export const readAiOptionWorkerUrl = (input: unknown = {}): unknown => asOptionRecord(input).workerUrl;

export const withAiTaskTypeFallback = (input: unknown = {}, fallback: unknown): AiClientOptionRecord => {
  const opts = asOptionRecord(input);
  return {
    ...opts,
    taskType: opts.taskType || fallback,
  };
};

export const readAiErrorMessage = (input: unknown, fallback: string): string => {
  const message = asOptionRecord(input).message;
  return String(message || fallback);
};

export const resolveTranscriptionUploadOptions = (
  input: unknown = {},
  { defaultMaxUploadBytes }: { defaultMaxUploadBytes: number },
): {
  maxUploadBytes: number;
  signal: AbortSignal | undefined;
} => {
  const opts = asOptionRecord(input);
  const maxUploadBytes = Number.isFinite(opts.maxUploadBytes)
    ? Math.max(1024, Math.floor(Number(opts.maxUploadBytes)))
    : defaultMaxUploadBytes;
  return {
    maxUploadBytes,
    signal: opts.signal == null ? undefined : (opts.signal as AbortSignal),
  };
};

export const resolveAudioSummaryOptions = (
  input: unknown = {},
): {
  aiCallOptions: AiClientOptionRecord;
  sessionTitle: string;
  style: string;
} => {
  const opts = asOptionRecord(input);
  const { sessionTitle: _sessionTitle, style: _style, ...aiCallOptions } = opts;
  const style = typeof opts.style === 'string' && opts.style.trim() ? opts.style.trim() : 'reading-group';
  const sessionTitle =
    typeof opts.sessionTitle === 'string' && opts.sessionTitle.trim() ? opts.sessionTitle.trim() : '';
  return {
    aiCallOptions,
    sessionTitle,
    style,
  };
};

export const readArweaveJwkOption = (
  input: unknown = {},
): {
  arweaveJwk: unknown;
  hasArweaveJwk: boolean;
} => {
  const arweaveJwk = asOptionRecord(input).arweaveJwk;
  return {
    arweaveJwk,
    hasArweaveJwk: !!arweaveJwk,
  };
};

export const resolveAiSessionOptions = (input: unknown = {}): AiSessionOptions => {
  const opts = asOptionRecord(input);
  const aliases = resolveSessionConfigAliases(opts);
  return {
    context: readAiClientContext(opts.context),
    sessionConfig: aliases.sessionConfig,
    sessionSlug: aliases.sessionSlug,
  };
};

export const resolveAiSessionSlug = (input: unknown = {}): string => resolveAiSessionOptions(input).sessionSlug;

export const resolveAiSessionSelection = (input: unknown = {}): AiSessionSelection | null => {
  const sessionSelection = asOptionRecord(input).sessionSelection;
  return sessionSelection && typeof sessionSelection === 'object' && !Array.isArray(sessionSelection)
    ? (sessionSelection as AiSessionSelection)
    : null;
};

export const buildAiConfigRequest = (
  input: unknown = {},
  { thinking = false }: { thinking?: unknown } = {},
): {
  context: AiClientContext | undefined;
  model: unknown;
  preferLocal: boolean | undefined;
  provider: unknown;
  sessionSlug: string;
  thinking: boolean;
} => {
  const opts = asOptionRecord(input);
  return {
    context: readAiClientContext(opts.context),
    model: opts.model,
    preferLocal: readPreferLocal(opts.preferLocal),
    provider: opts.provider,
    sessionSlug: resolveAiSessionSlug(opts),
    thinking: !!thinking,
  };
};

export const buildTranscriptionConfigRequest = (
  input: unknown = {},
): {
  apiKey: unknown;
  context: AiClientContext | undefined;
  model: unknown;
  preferLocal: boolean | undefined;
  provider: unknown;
  rpcUrl: unknown;
  sessionSlug: string;
} => {
  const opts = asOptionRecord(input);
  return {
    apiKey: opts.apiKey,
    context: readAiClientContext(opts.context),
    model: opts.model,
    preferLocal: readPreferLocal(opts.preferLocal),
    provider: opts.provider,
    rpcUrl: opts.rpcUrl,
    sessionSlug: resolveAiSessionSlug(opts),
  };
};

export const buildArweaveKeyRequest = (
  input: unknown = {},
): {
  context: AiClientContext | undefined;
  preferLocal: boolean | undefined;
  sessionConfig: SessionConfig | null;
  sessionSlug: string;
} => {
  const opts = asOptionRecord(input);
  const { context, sessionConfig, sessionSlug } = resolveAiSessionOptions(opts);
  return {
    context,
    preferLocal: readPreferLocal(opts.preferLocal),
    sessionConfig,
    sessionSlug,
  };
};

export const inferAiTaskType = (prompt: unknown = '', opts: Record<string, unknown> = {}): string | null => {
  const explicit = String(opts?.taskType || '')
    .trim()
    .toLowerCase();
  if (explicit) return explicit;

  const promptText = String(prompt || '');
  // Older question-generation flows still call `callAI` directly, so fall back
  // to the seed-generation prompt signature when no explicit task type is passed.
  if (/numberOfSeedStatementsOrPrompts:/i.test(promptText) && /"surveyTitle"\s*:/i.test(promptText)) {
    return 'generate';
  }
  return null;
};

export const pickAiRequestOpts = (input: unknown = {}): Record<string, unknown> => {
  const src = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const out: Record<string, unknown> = {};
  const copy = (key: (typeof AI_REQUEST_OPTION_KEYS)[number]) => {
    if (Object.prototype.hasOwnProperty.call(src, key) && src[key] !== undefined) {
      out[key] = src[key];
    }
  };
  AI_REQUEST_OPTION_KEYS.forEach(copy);
  return out;
};
