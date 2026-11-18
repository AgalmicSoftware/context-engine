// The analysis card saved on a person's page, as the Session Worker keeps it: one per person per session, saved by
// that person's own Analyze and shown to every signed-in visitor without pressing anything. Each person's card is
// asked for once per visit and shared by the page's section and its Analyze window; a save or withdrawal updates
// both at once.
import { normalizeSavedAnalysisCard, type SavedAnalysisCard } from '@ce-shared/analysisCardSaved.mjs';

import { resolveAiSessionOptions } from '../ai/aiClientRequestOptions';
import { resolveAiWorkerEndpoint } from '../ai/aiClientWorkerTransport';
import { getCorsProxyUrlOrThrow } from '../worker/corsProxy.js';
import { fetchWorkerWithAuth } from '../worker/workerAuth.js';
import { defaultStrictAllowDemoFallback } from '../worker/workerSessionResolution.js';

export type SavedAnalysisCardState =
  { status: 'ready'; card: SavedAnalysisCard; savedAt: number } | { status: 'withdrawn' } | { status: 'none' };

const known = new Map<string, Promise<SavedAnalysisCardState | null>>();
const listeners = new Set<() => void>();

const keyOf = (opts: unknown, account: unknown): string =>
  `${resolveAiSessionOptions(opts).sessionSlug}\n${String(account || '')
    .trim()
    .toLowerCase()}`;

const stateOf = (value: unknown): SavedAnalysisCardState | null => {
  const data = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  if (data.published === false) return { status: 'withdrawn' };
  if (data.published === null) return { status: 'none' };
  const card = data.published === true ? normalizeSavedAnalysisCard(data.card) : null;
  const savedAt = Number(data.savedAt);
  return card && Number.isFinite(savedAt) ? { status: 'ready', card, savedAt } : null;
};

const askWorker = async (path: string, body: unknown, opts: unknown): Promise<SavedAnalysisCardState> => {
  const { context, sessionConfig, sessionSlug } = resolveAiSessionOptions(opts);
  const allowDemoFallback = defaultStrictAllowDemoFallback();
  const corsWorkerUrl = await getCorsProxyUrlOrThrow({ sessionSlug, sessionConfig, context, allowDemoFallback });
  const { baseUrl } = resolveAiWorkerEndpoint(corsWorkerUrl);
  const response = await fetchWorkerWithAuth(
    `${baseUrl}${path}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    // Asked for by the page, not the person: a lapsed sign-in shows no saved card, it never raises a sign-in prompt.
    { sessionSlug, sessionConfig, context, workerUrl: baseUrl, allowDemoFallback, prompt: false },
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
 * Worker, a network failure). A read that fails is asked again the next time.
 */
export const readSavedAnalysisCard = (account: string, opts: unknown): Promise<SavedAnalysisCardState | null> => {
  const key = keyOf(opts, account);
  const kept = known.get(key);
  if (kept) return kept;
  const read = askWorker('/analysis-card/published', { account }, opts).catch(() => null);
  known.set(key, read);
  void read.then((state) => {
    if (!state && known.get(key) === read) known.delete(key);
  });
  return read;
};

/**
 * Save the signed-in person's own card on their page (published: true, with the card), or withdraw it. The Worker
 * files it under the signed-in address whatever account is named here; the account only keeps this visit's copy
 * in step. Throws when the Worker refuses or cannot be reached.
 */
export const publishSavedAnalysisCard = async (
  account: string,
  published: boolean,
  card: unknown,
  opts: unknown,
): Promise<SavedAnalysisCardState> => {
  const saved = published ? normalizeSavedAnalysisCard(card) : null;
  if (published && !saved) throw new Error('invalid_card');
  const state = await askWorker('/analysis-card/publish', saved ? { published, card: saved } : { published }, opts);
  known.set(keyOf(opts, account), Promise.resolve(state));
  listeners.forEach((listener) => listener());
  return state;
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
