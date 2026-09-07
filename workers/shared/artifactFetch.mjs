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
  const response = await safeFetch(url, {
    method: 'GET', headers: { Accept: accept }, cache: 'no-store',
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
