import {
  createOutboundUrlSafetyHelpersWithWorkerDeps,
  PUBLIC_HTTPS_ARTIFACT_POLICY,
} from '../sessionCorsWorker/outboundUrlSafetyBinding.js';
import { readBodyText } from './bodyByteLimit.mjs';

export const MAX_ARTIFACT_BYTES = 10 * 1024 * 1024;
export const MAX_MANIFEST_BYTES = 1024 * 1024;

export const fetchArtifactText = async (url, {
  fetchImpl = globalThis.fetch,
  maxBytes = MAX_ARTIFACT_BYTES,
  accept = 'application/javascript',
} = {}) => {
  const { safeFetch } = createOutboundUrlSafetyHelpersWithWorkerDeps({ deps: { fetch: fetchImpl } });
  // No RequestInit.cache: Workers at compatibility date 2024-09-02 throw on it.
  // Release artifacts are immutable per URL, so caching cannot serve stale bytes.
  const response = await safeFetch(url, {
    method: 'GET', headers: { Accept: accept },
    outboundUrlPolicy: PUBLIC_HTTPS_ARTIFACT_POLICY,
  });
  if (!response.ok) {
    await response.body?.cancel?.();
    const error = new Error(response.error || `Artifact fetch failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return readBodyText(response, maxBytes);
};
