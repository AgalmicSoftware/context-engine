import knownSessions from '../../../../known-sessions.json';

// One entry in the repo's known-sessions.json: a session the hosted site opens
// from a normal link, without `worker=`. It only says where the session's
// Worker is. The Worker's verified config supplies every setting, and the
// session opens only when that config carries this sessionId. `title` is only
// the session's label in the site's session lists (see sessionListing.ts).
// `interviewCatalog` is the whole address of the session's question catalog,
// for an AI that may fetch only an address it was shown word for word.
export type KnownSession = {
  worker: string;
  sessionId: string;
  name?: string;
  title?: string;
  interviewCatalog?: string;
};

export const KNOWN_SESSIONS: Readonly<Record<string, KnownSession>> = knownSessions;

// Each entry as the bundled clean-route config the session routes read.
export const KNOWN_SESSION_CONFIGS: Readonly<Record<string, Record<string, unknown>>> = Object.fromEntries(
  Object.entries(KNOWN_SESSIONS).map(([slug, { worker, sessionId, name }]) => [
    slug,
    {
      slug,
      sessionId,
      ...(name ? { sessionName: name } : {}),
      corsWorkerUrl: worker,
      workerCanonicalCleanRoute: true,
      sessionModeProfile: {
        profileVersion: 1,
        preset: 'custom',
        authority: { mode: 'worker_canonical' },
        evm: { registryChainId: null },
      },
    },
  ]),
);

// Some chat AIs refuse a Worker's own host, so the site passes each listed catalog through at an
// address of its own (client/public/_redirects, written by scripts/sync-known-session-catalogs.js).
// For the listed catalog (the session's own Worker and its hosted page), this returns the two
// addresses to try, in the generator's order: the site's, then the Worker's own, written out whole.
// The Worker keeps only the page's origin and path, plus src= and joinGroup=, so another query (such
// as worker=) asks for the same catalog; src= or joinGroup= asks for another. Otherwise it returns [].
export const knownSessionQuestionsAddresses = ({
  workerUrl,
  sessionSlug,
  sessionUrl,
}: {
  workerUrl: string;
  sessionSlug: string;
  sessionUrl: string;
}): string[] => {
  const entry = Object.prototype.hasOwnProperty.call(KNOWN_SESSIONS, sessionSlug) ? KNOWN_SESSIONS[sessionSlug] : null;
  if (!entry?.interviewCatalog || entry.worker !== workerUrl.replace(/\/+$/, '')) return [];
  let page: URL;
  try {
    page = new URL(sessionUrl);
  } catch {
    return [];
  }
  if (page.searchParams.has('src') || page.searchParams.has('joinGroup')) return [];
  const hosted = `https://contextengine.sh/session/${sessionSlug}`;
  return `${page.origin}${page.pathname.replace(/\/+$/, '')}` === hosted
    ? [`https://contextengine.sh/questions/${sessionSlug}`, entry.interviewCatalog]
    : [];
};
