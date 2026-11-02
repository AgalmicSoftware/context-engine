import { getDecryptCacheGeneration } from '../crypto/cryptography.js';
import { stampDecryptedSurvey } from './decryptedQuestionReader';

type CacheRecord = Record<string, unknown>;
type DecryptContext = { account?: unknown; providerLike?: unknown; litOpts?: unknown };

export type MaskedSurveyRefreshDeps = {
  /** The surveys cached in the session's chain node, or null when there are none. */
  readSurveys: (slug: string) => { networkID: string; surveys: CacheRecord } | null;
  buildDecryptContext: (slug: string) => DecryptContext | null | undefined;
  decryptSurvey: (survey: CacheRecord, slug: string, opts: { decryptContext: DecryptContext }) => Promise<unknown>;
  /** Applies `update` to the chain node's surveys within one atomic cache write. */
  saveSurveys: (slug: string, networkID: string, update: (surveys: CacheRecord) => void) => Promise<unknown>;
  onSaved: () => void;
  logWarn: (message: string, error: unknown) => void;
};

const SURVEYS_PER_RUN = 8;
const BATCH_SIZE = 4;
const RETRY_AFTER_MS = 30000;
const NEXT_RUN_DELAY_MS = 150;

const asRecord = (value: unknown): CacheRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as CacheRecord) : {};

/** A survey whose title or document links are still behind their envelopes. */
const isMaskedSurveyPayload = (survey: unknown): boolean => {
  const record = asRecord(survey);
  const titleLocked =
    !!(record.titleEncrypted || record.encryptedTitle) && String(record.title ?? '').trim() === '[encrypted]';
  const linksLocked =
    !!(record.documentURLsEncrypted || record.docUrlsEncrypted) &&
    !(Array.isArray(record.documentURLs) && record.documentURLs.length);
  return titleLocked || linksLocked;
};

/**
 * Decrypts locked survey titles and document links for the current reader, a few
 * per run, and saves them stamped with that reader. Runs for one session never
 * overlap: a request during a run, or work left over, starts one more run after it.
 */
export const createMaskedSurveyRefresh = (deps: MaskedSurveyRefreshDeps) => {
  const running = new Map<string, Promise<void>>();
  const queued = new Map<string, boolean>();
  const attemptedAt = new Map<string, number>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let destroyed = false;

  const runOnce = async (slug: string, force: boolean): Promise<void> => {
    const node = deps.readSurveys(slug);
    const context = deps.buildDecryptContext(slug);
    const reader = String(context?.account || '')
      .trim()
      .toLowerCase();
    const canDecrypt = !!context?.providerLike || typeof asRecord(context?.litOpts).getKey === 'function';
    if (!node || !context || !reader || !canDecrypt) return;
    // Account changes move the decrypt generation (see AppShell); such a run saves nothing.
    const generation = getDecryptCacheGeneration();
    const now = Date.now();
    attemptedAt.forEach((at, key) => {
      if (now - at >= RETRY_AFTER_MS) attemptedAt.delete(key);
    });
    const attemptKey = (sid: string) => `${reader}|${slug}|${sid}`;
    const due = Object.keys(node.surveys).filter(
      (sid) => isMaskedSurveyPayload(node.surveys[sid]) && (force || !attemptedAt.has(attemptKey(sid))),
    );
    const batch = due.slice(0, SURVEYS_PER_RUN);
    const decrypted = new Map<string, CacheRecord>();
    for (let i = 0; i < batch.length; i += BATCH_SIZE) {
      await Promise.all(
        batch.slice(i, i + BATCH_SIZE).map(async (sid) => {
          attemptedAt.set(attemptKey(sid), Date.now());
          const survey = { ...asRecord(node.surveys[sid]) };
          try {
            await deps.decryptSurvey(survey, slug, { decryptContext: context });
          } catch (error) {
            deps.logWarn(`Failed to decrypt cached survey ${sid}:`, error);
          }
          if (survey.titleDecrypted || survey.documentURLsDecrypted) {
            decrypted.set(sid, stampDecryptedSurvey(survey, reader));
          }
        }),
      );
    }
    if (decrypted.size && generation === getDecryptCacheGeneration()) {
      await deps.saveSurveys(slug, node.networkID, (surveys) => {
        if (generation !== getDecryptCacheGeneration()) return;
        decrypted.forEach((survey, sid) => {
          if (isMaskedSurveyPayload(surveys[sid])) surveys[sid] = { ...asRecord(surveys[sid]), ...survey };
        });
      });
      deps.onSaved();
    }
    if (due.length > batch.length && !queued.has(slug)) queued.set(slug, false);
  };

  const refresh = async (slug: string, { force = false }: { force?: boolean } = {}): Promise<void> => {
    const current = running.get(slug);
    if (current) {
      queued.set(slug, force || queued.get(slug) === true);
      return current;
    }
    const run = runOnce(slug, force).catch((error) =>
      deps.logWarn(`Survey decrypt refresh failed for ${slug}:`, error),
    );
    running.set(slug, run);
    try {
      await run;
    } finally {
      running.delete(slug);
      if (queued.has(slug) && !destroyed) {
        const nextForce = queued.get(slug) === true;
        queued.delete(slug);
        const timer = setTimeout(() => {
          timers.delete(timer);
          void refresh(slug, { force: nextForce });
        }, NEXT_RUN_DELAY_MS);
        timers.add(timer);
      }
    }
  };

  const destroy = (): void => {
    destroyed = true;
    timers.forEach((timer) => clearTimeout(timer));
    timers.clear();
    queued.clear();
    attemptedAt.clear();
  };

  return { refresh, destroy };
};
