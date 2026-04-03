import { trimIfString } from './stringCoercion.js';

export const parseArweaveJwkInput = (input) => {
  if (!input) return null;
  if (typeof input === 'object') return input;
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  const candidates = [trimmed];
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    candidates.push(trimmed.slice(1, -1));
  }
  const collapsed = trimmed.replace(/[\r\n\t]/g, '');
  if (collapsed !== trimmed) candidates.push(collapsed);
  if (trimmed.includes('\\"') || trimmed.includes('\\n') || trimmed.includes('\\r')) {
    candidates.push(
      trimmed
        .replace(/\\r/g, '')
        .replace(/\\n/g, '')
        .replace(/\\t/g, '')
        .replace(/\\"/g, '"')
    );
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      // Keep trying alternate candidate forms.
    }
  }
  return null;
};

export const resolveArweaveUploadJwk = ({ providedJwk = null, secrets = {} } = {}) => {
  const hasProvidedJwk = !!providedJwk;
  const hasWorkerJwk = !!secrets?.arweaveJwk;
  const jwkCandidateRaw = providedJwk ?? secrets?.arweaveJwk ?? '';
  const jwkCandidate = trimIfString(jwkCandidateRaw);

  if (!jwkCandidate) {
    return {
      ok: false,
      error: 'Arweave key not configured in worker.',
      jwk: null,
      source: '',
      hasProvidedJwk,
      hasWorkerJwk,
    };
  }

  const jwk = parseArweaveJwkInput(jwkCandidate);
  if (!jwk) {
    return {
      ok: false,
      error: 'Invalid arweaveJwk (must be JSON)',
      jwk: null,
      source: hasProvidedJwk ? 'request' : 'worker',
      hasProvidedJwk,
      hasWorkerJwk,
    };
  }

  return {
    ok: true,
    error: '',
    jwk,
    source: hasProvidedJwk ? 'request' : 'worker',
    hasProvidedJwk,
    hasWorkerJwk,
  };
};
