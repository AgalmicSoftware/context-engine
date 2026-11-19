// The analysis card saved on a person's page, as the Session Worker keeps it: one per person per session, saved by
// that person's own Analyze and shown to every signed-in visitor without pressing anything. Each person's card is
// asked for once per visit and sign-in, and shared by the page's section and its Analyze window; a save or
// withdrawal updates both at once.
import {
  ANALYSIS_CARD_FEATURE,
  analysisCardOn,
  normalizeSavedAnalysisCard,
  type SavedAnalysisCard,
} from '@ce-shared/analysisCardSaved.mjs';

import { resolveAiSessionOptions } from '../ai/aiClientRequestOptions';
import { resolveAiWorkerEndpoint } from '../ai/aiClientWorkerTransport';
import { getCorsProxyUrlOrThrow } from '../worker/corsProxy.js';
import { fetchWorkerWithAuth } from '../worker/workerAuth.js';
import { readWorkerCapabilities } from '../worker/workerCapabilities';
import { defaultStrictAllowDemoFallback } from '../worker/workerSessionResolution.js';

export type SavedAnalysisCardState =
  { status: 'ready'; card: SavedAnalysisCard; savedAt: number } | { status: 'withdrawn' } | { status: 'none' };

// What a read can also say: the session has turned the card off since this page loaded it.
export type SavedAnalysisCardRead = SavedAnalysisCardState | { status: 'off' };

const known = new Map<string, Promise<SavedAnalysisCardRead | null>>();
const listeners = new Set<() => void>();

// A read, and a save or withdrawal, give up after this long (finding the Worker and a silent sign-in included), so
// the page never waits on a Worker that does not answer.
export const SAVED_CARD_READ_TIMEOUT_MS = 8_000;
export const SAVED_CARD_SAVE_TIMEOUT_MS = 15_000;

// Runs the whole request under one clock: past it the request is cancelled and the caller gets an error.
const bounded = <T>(work: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> => {
  const timeout = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      timeout.abort();
      reject(new Error('saved_card_timeout'));
    }, ms);
  });
  return Promise.race([work(timeout.signal), expired]).finally(() => clearTimeout(timer));
};

const lower = (value: unknown): string =>
  String(value || '')
    .trim()
    .toLowerCase();

// What one sign-in was allowed to read is never shown after another one, or after signing out.
const keyOf = (opts: unknown, account: unknown): string => {
  const { context, sessionSlug } = resolveAiSessionOptions(opts);
  return [sessionSlug, lower(context?.account), lower(account)].join('\n');
};

const stateOf = (value: unknown): SavedAnalysisCardState | null => {
  const data = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  if (data.published === false) return { status: 'withdrawn' };
  if (data.published === null) return { status: 'none' };
  const card = data.published === true ? normalizeSavedAnalysisCard(data.card) : null;
  const savedAt = Number(data.savedAt);
  return card && Number.isFinite(savedAt) ? { status: 'ready', card, savedAt } : null;
};

const askWorker = async (
  path: string,
  body: unknown,
  opts: unknown,
  { requireAccount = '', signal }: { requireAccount?: string; signal?: AbortSignal } = {},
): Promise<SavedAnalysisCardState> => {
  const { context, sessionConfig, sessionSlug } = resolveAiSessionOptions(opts);
  const allowDemoFallback = defaultStrictAllowDemoFallback();
  const corsWorkerUrl = await getCorsProxyUrlOrThrow({ sessionSlug, sessionConfig, context, allowDemoFallback });
  const { baseUrl } = resolveAiWorkerEndpoint(corsWorkerUrl);
  const response = await fetchWorkerWithAuth(
    `${baseUrl}${path}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal },
    // Asked for by the page, not the person: a lapsed sign-in shows no saved card, it never raises a sign-in prompt.
    {
      sessionSlug,
      sessionConfig,
      context,
      workerUrl: baseUrl,
      allowDemoFallback,
      prompt: false,
      ...(requireAccount ? { requireAccount } : {}),
    },
  );
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(typeof data.error === 'string' && data.error ? data.error : `saved_card_${response.status}`);
  }
  const state = stateOf(data);
  if (!state) throw new Error('saved_card_unreadable');
  return state;
};

/**
 * A person's saved card in the session the options name, or null when it cannot be read (signed out, an older
 * Worker, a network failure, no answer in time). A read that fails is asked again the next time. `off` is the
 * Worker saying an admin turned the card off: the page's own copy of the session may be older than that, so the
 * page asks here before it pays for a card. It is asked again the next time too, as the card may be back on.
 * `fresh` asks the Worker whatever this visit remembers: the remembered answer may itself be from before the
 * card was turned off. What comes back replaces it, for the page's section too.
 */
export const readSavedAnalysisCard = (
  account: string,
  opts: unknown,
  { fresh = false }: { fresh?: boolean } = {},
): Promise<SavedAnalysisCardRead | null> => {
  const key = keyOf(opts, account);
  const kept = known.get(key);
  if (kept && !fresh) return kept;
  const read = bounded(
    (signal) => askWorker('/analysis-card/published', { account }, opts, { signal }),
    SAVED_CARD_READ_TIMEOUT_MS,
  ).catch((error: unknown): SavedAnalysisCardRead | null =>
    error instanceof Error && error.message === 'analysis_card_off' ? { status: 'off' } : null,
  );
  known.set(key, read);
  void read.then((state) => {
    if ((!state || state.status === 'off') && known.get(key) === read) known.delete(key);
  });
  return read;
};

/**
 * Save the signed-in person's own card on their page (published: true, with the card), or withdraw it. The Worker
 * files it under the signed-in address, so the request is refused unless that is still the account named here.
 * Throws when the Worker refuses, cannot be reached or does not answer in time; a save that timed out may still
 * have been made, and doing it again is harmless.
 */
export const publishSavedAnalysisCard = async (
  account: string,
  published: boolean,
  card: unknown,
  opts: unknown,
): Promise<SavedAnalysisCardState> => {
  const saved = published ? normalizeSavedAnalysisCard(card) : null;
  if (published && !saved) throw new Error('invalid_card');
  const body = saved ? { published, card: saved } : { published };
  const state = await bounded(
    (signal) => askWorker('/analysis-card/publish', body, opts, { requireAccount: account, signal }),
    SAVED_CARD_SAVE_TIMEOUT_MS,
  );
  known.set(keyOf(opts, account), Promise.resolve(state));
  listeners.forEach((listener) => listener());
  return state;
};

/**
 * Whether the page may make and show the card in the session the options name: the session has not turned it off,
 * and its Session Worker has it. A Worker from before the card has neither its picture nor its saved card, so there
 * the page shows nothing of it, setting or not. False too when the Worker can't be found or asked.
 */
export const analysisCardAvailableFor = async (opts: unknown): Promise<boolean> => {
  const { context, sessionConfig, sessionSlug } = resolveAiSessionOptions(opts);
  if (!analysisCardOn(sessionConfig)) return false;
  try {
    const allowDemoFallback = defaultStrictAllowDemoFallback();
    const corsWorkerUrl = await getCorsProxyUrlOrThrow({ sessionSlug, sessionConfig, context, allowDemoFallback });
    const { features } = await readWorkerCapabilities(resolveAiWorkerEndpoint(corsWorkerUrl).baseUrl, sessionSlug);
    return features.includes(ANALYSIS_CARD_FEATURE);
  } catch {
    return false;
  }
};

export const subscribeSavedAnalysisCards = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

// "18 Nov 2026", in the reader's own language.
export const formatSavedAnalysisCardDate = (savedAt: number): string =>
  new Date(savedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
