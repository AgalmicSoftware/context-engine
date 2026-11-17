import { buildTokenCacheEnvelope, clearAllTokenCaches, writeTokenCache } from './workerAuthTokenCache';
import { forgetGroupReadHeader, saveGroupReadHeader } from './workerGroupReadProof';

export const TEST_READ_PROOF = `rxc:0x${'ab'.repeat(65)}`;

/** Holds both of a private session's ways in for a test: a sign-in for the session and its invite proof. */
export const holdSignInAndProof = (workerUrl: string, sessionSlug: string, token = 'member-token') => {
  const address = '0x00000000000000000000000000000000000000aa';
  writeTokenCache(
    `ce:workerToken:v1:${workerUrl}:${sessionSlug}:${address}`,
    buildTokenCacheEnvelope({ token, exp: Math.floor(Date.now() / 1000) + 3600, workerUrl, sessionSlug, address }),
  );
  saveGroupReadHeader({ workerUrl, sessionSlug, sessionId: `0x${'2a'.repeat(16)}`, header: TEST_READ_PROOF });
  return () => {
    clearAllTokenCaches();
    forgetGroupReadHeader(workerUrl, sessionSlug);
  };
};
