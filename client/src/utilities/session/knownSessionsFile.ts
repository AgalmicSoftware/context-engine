import knownSessions from '../../../../known-sessions.json';

// One entry in the repo's known-sessions.json: a session the hosted site opens
// from a normal link, without `worker=`. It only says where the session's
// Worker is. The Worker's verified config supplies every setting, and the
// session opens only when that config carries this sessionId.
export type KnownSession = {
  worker: string;
  sessionId: string;
  name?: string;
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
