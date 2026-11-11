import {
  hashInterviewQuestions,
  isSupportedInterviewPromptVersion,
  KICKOFF_CATALOG_VERSIONS,
  normalizeInterviewQuestions,
  type InterviewPrefillPacket,
  type InterviewQuestion,
} from './sessionInterview';

const stale = () =>
  new Error('This prefill link was created for an older or different question set. Ask the AI for a fresh link.');

/** The session lets no signed-out visitor list its questions, so a prompt for it needs its person's sign-in. */
export class InterviewCatalogSignInError extends Error {
  constructor() {
    super('This session’s questions need a sign-in. Use Log in at the top of the page, then copy the prompt.');
    this.name = 'InterviewCatalogSignInError';
  }
}

/** The signed-in person's catalog ticket, or '' when they have none. `fresh` skips one the Worker refused. */
export type InterviewCatalogTicketSource = (request: { fresh: boolean }) => Promise<string>;

const readRefusalReason = async (response: Response): Promise<string> => {
  try {
    const body = await response.clone().json();
    return typeof body?.reason === 'string' ? body.reason : '';
  } catch {
    return '';
  }
};

// Reads the catalog as the ticket's person when there is one. A held ticket the Worker no longer takes, as
// after signing out and back in, is swapped for a fresh one once.
const fetchInterviewCatalog = async (
  url: URL,
  {
    fetchImpl,
    signal,
    ticket,
  }: { fetchImpl: typeof fetch; signal: AbortSignal; ticket?: InterviewCatalogTicketSource },
) => {
  const read = async (fresh: boolean) => {
    const value = ticket ? await ticket({ fresh }) : '';
    const target = new URL(url);
    if (value) target.searchParams.set('ticket', value);
    const response = await fetchImpl(target.toString(), {
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal,
    });
    return { response, ticket: value };
  };
  const first = await read(false);
  const refused =
    first.ticket &&
    first.response.status === 401 &&
    (await readRefusalReason(first.response)) === 'catalog_ticket_invalid';
  return refused ? read(true) : first;
};

export const resolveInterviewPrefillQuestions = async ({
  packet,
  questions,
  sessionSlug,
  loadWorkerUrl,
  sessionUrl,
  fetchImpl = globalThis.fetch,
  signal,
  timeoutMs = 10_000,
  ticket,
}: {
  packet: InterviewPrefillPacket;
  questions: InterviewQuestion[];
  sessionSlug: string;
  loadWorkerUrl: () => Promise<string>;
  sessionUrl: string;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** A signed-in person's AI may have read questions a signed-out visitor can't. */
  ticket?: InterviewCatalogTicketSource;
}): Promise<InterviewQuestion[]> => {
  if (signal?.aborted) throw new Error('Catalog validation cancelled.');
  if (packet.sessionSlug.toLowerCase() !== sessionSlug.toLowerCase()) throw stale();
  const version = packet.promptVersion || 'ce-interview-brief-v1';
  if (!isSupportedInterviewPromptVersion(version)) throw stale();
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
        const { response } = await fetchInterviewCatalog(url, { fetchImpl, signal: controller.signal, ticket });
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
  if (!isSupportedInterviewPromptVersion(catalogVersion)) throw stale();
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
  responderContext: string,
): InterviewPrefillPacket => {
  const ids = new Set(questions.map(({ id }) => id));
  const summary = responderContext.trim();
  return {
    ...packet,
    // AI calls get only the context the responder reviewed and edited, never the imported name or facts.
    responderContext: summary ? { summary } : {},
    ...(packet.responses
      ? { responses: packet.responses.filter(({ questionId }) => ids.has(questionId.trim().toLowerCase())) }
      : {}),
  };
};

/** Checks the catalog a kickoff's AI will fetch, as the ticket's person when there is one, and resolves to the
 *  ticket that worked, or '' without one. */
export const verifyInterviewKickoffCatalog = async ({
  workerUrl,
  sessionSlug,
  sessionUrl,
  fetchImpl = globalThis.fetch,
  ticket,
}: {
  workerUrl: string;
  sessionSlug: string;
  sessionUrl: string;
  fetchImpl?: typeof fetch;
  ticket?: InterviewCatalogTicketSource;
}): Promise<string> => {
  const url = new URL(`${workerUrl.replace(/\/+$/, '')}/agent/interview-catalog`);
  url.searchParams.set('slug', sessionSlug);
  url.searchParams.set('sessionUrl', sessionUrl);
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const startTimer = () => {
    clearTimeout(timer);
    timer = setTimeout(() => controller.abort(), 10_000);
  };
  // Only the Worker's reply is timed: getting a ticket may wait for the person to sign in.
  const timedTicket: InterviewCatalogTicketSource | undefined =
    ticket &&
    (async (request) => {
      clearTimeout(timer);
      try {
        return await ticket(request);
      } finally {
        startTimer();
      }
    });
  startTimer();
  let catalog: Record<string, unknown>;
  let usedTicket = '';
  let signInNeeded = false;
  try {
    const read = await fetchInterviewCatalog(url, { fetchImpl, signal: controller.signal, ticket: timedTicket });
    if (!read.response.ok) {
      signInNeeded = !read.ticket && (await readRefusalReason(read.response)) === 'sign_in_required';
      throw new Error('Catalog unavailable');
    }
    usedTicket = read.ticket;
    catalog = await read.response.json();
  } catch {
    if (signInNeeded) throw new InterviewCatalogSignInError();
    throw new Error('Could not check this session’s Worker. Check your connection and try again.');
  } finally {
    clearTimeout(timer);
  }
  if (
    !catalog ||
    catalog.type !== 'context-engine.interview-question-catalog' ||
    catalog.version !== 1 ||
    catalog.sessionSlug !== sessionSlug ||
    !KICKOFF_CATALOG_VERSIONS.includes(String(catalog.prefillPromptVersion))
  ) {
    throw new Error(
      'This page and the session’s Worker use incompatible interview versions; ask the organizer to update them, then reload.',
    );
  }
  return usedTicket;
};
