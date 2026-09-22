import {
  hashInterviewQuestions,
  normalizeInterviewQuestions,
  type InterviewPrefillPacket,
  type InterviewQuestion,
} from './sessionInterview';

const stale = () =>
  new Error('This prefill link was created for an older or different question set. Ask the AI for a fresh link.');

export const resolveInterviewPrefillQuestions = async ({
  packet,
  questions,
  sessionSlug,
  loadWorkerUrl,
  sessionUrl,
  fetchImpl = globalThis.fetch,
  signal,
  timeoutMs = 10_000,
}: {
  packet: InterviewPrefillPacket;
  questions: InterviewQuestion[];
  sessionSlug: string;
  loadWorkerUrl: () => Promise<string>;
  sessionUrl: string;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<InterviewQuestion[]> => {
  if (signal?.aborted) throw new Error('Catalog validation cancelled.');
  if (packet.sessionSlug.toLowerCase() !== sessionSlug.toLowerCase()) throw stale();
  const version = packet.promptVersion || 'ce-interview-brief-v1';
  if (!/^ce-interview-brief-v[1-5]$/.test(version)) throw stale();
  const localHash = await hashInterviewQuestions(questions, version);
  if (signal?.aborted) throw new Error('Catalog validation cancelled.');
  if (localHash === packet.questionSetHash) return questions;
  // The Worker may expose a bounded public subset in a different storage order.
  // A local mismatch is repairable only against that session's current catalog,
  // never by taking an arbitrary prefix or trusting question IDs from the packet.
  let raw: unknown;
  const controller = new AbortController();
  let rejectAbort: (reason: Error) => void = () => {};
  const cancelled = new Promise<never>((_resolve, reject) => {
    rejectAbort = reject;
  });
  const abort = () => {
    controller.abort();
    rejectAbort(new Error('Catalog validation interrupted; retry when ready.'));
  };
  const timer = setTimeout(abort, timeoutMs);
  signal?.addEventListener('abort', abort, { once: true });
  try {
    raw = await Promise.race([
      cancelled,
      (async () => {
        const base = (await loadWorkerUrl()).replace(/\/+$/, '').replace(/\/ai$/i, '');
        if (controller.signal.aborted) throw stale();
        const url = new URL(`${base}/agent/interview-catalog`);
        if (!['https:', 'http:'].includes(url.protocol)) throw stale();
        url.searchParams.set('slug', sessionSlug);
        url.searchParams.set('sessionUrl', sessionUrl);
        const response = await fetchImpl(url.toString(), {
          cache: 'no-store',
          credentials: 'omit',
          signal: controller.signal,
        });
        if (!response.ok) throw stale();
        return response.json();
      })(),
    ]);
  } catch {
    throw new Error(`${stale().message} If the catalog could not load, check your connection and retry.`);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw stale();
  const catalog = raw as Record<string, unknown>;
  if (
    catalog.type !== 'context-engine.interview-question-catalog' ||
    catalog.version !== 1 ||
    catalog.sessionSlug !== sessionSlug ||
    !Array.isArray(catalog.questions) ||
    !catalog.questions.length ||
    catalog.questions.length > 100
  )
    throw stale();
  const publicQuestions = normalizeInterviewQuestions(catalog.questions);
  if (publicQuestions.length !== catalog.questions.length) throw stale();
  const catalogVersion = String(catalog.prefillPromptVersion || '');
  if (!/^ce-interview-brief-v[1-5]$/.test(catalogVersion)) throw stale();
  if ((await hashInterviewQuestions(publicQuestions, catalogVersion)) !== catalog.questionSetHash) throw stale();
  if ((await hashInterviewQuestions(publicQuestions, version)) !== packet.questionSetHash) throw stale();
  const localById = new Map(questions.map((question) => [question.id, question]));
  // Preserve the local selection contract for v1–v4, which did not hash it.
  const selected = publicQuestions.map((question) => localById.get(question.id));
  if (selected.some((question) => !question)) throw stale();
  const matching = selected as InterviewQuestion[];
  if ((await hashInterviewQuestions(matching, version)) !== packet.questionSetHash) throw stale();
  // A legacy packet omits selection mode, but a current Worker catalog still binds it.
  if ((await hashInterviewQuestions(matching, catalogVersion)) !== catalog.questionSetHash) throw stale();
  return matching;
};

export const scopeInterviewPrefillToQuestions = (
  packet: InterviewPrefillPacket,
  questions: InterviewQuestion[],
): InterviewPrefillPacket => {
  const ids = new Set(questions.map(({ id }) => id));
  return {
    ...packet,
    ...(packet.responses
      ? { responses: packet.responses.filter(({ questionId }) => ids.has(questionId.trim().toLowerCase())) }
      : {}),
  };
};
