import {
  projectPublicWorkerSessionConfig,
} from '../shared/workerSessionConfig.mjs';
import {
  validateWorkerConfigModeValues,
} from '../shared/workerConfigModeValidation.mjs';
import {
  isWorkerCanonicalSessionConfig,
} from './workerCanonicalAuthority.js';
import {
  validateInboundWorkerSessionSlug,
} from './sessionSlugResolution.js';
import { getStorageAuditBinding } from './storageKvBindings.js';
import { resolveResponseFieldPolicy } from '../../shared/encryption/responseFieldPolicy.mjs';

export { projectPublicWorkerSessionConfig };

const buildBootstrapHeaders = (headers) => {
  const next = new Headers(headers || {});
  const vary = new Set(
    (next.get('Vary') || '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
  vary.add('Origin');
  vary.add('X-Session-Slug');
  next.set('Vary', [...vary].join(', '));
  next.set('Cache-Control', 'no-store');
  return next;
};

const protectBootstrapResponse = (response, baseHeaders) => {
  if (!response) return response;
  const headers = buildBootstrapHeaders(response.headers || baseHeaders);
  if (response instanceof Response) {
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
  return { ...response, headers };
};

// The session a request names and its stored config, or the response that
// refuses the read. /session-config and /llms.txt read the same way.
const readWorkerSessionConfig = async ({ request, env, slugHint, headers, deps, constants } = {}) => {
  const refuse = (error, status) => ({ response: deps?.json?.({ error }, status, headers) });
  const slugResolution = deps?.resolveRequestSlugWithoutToken?.({ request, env, slugHint }) || {
    ok: false,
    error: 'Invalid session slug.',
  };
  if (!slugResolution.ok) return refuse(slugResolution.error, 400);
  if (!slugResolution.explicitSlugProvided) return refuse(constants?.missingSlugError, 400);

  const slug = slugResolution.slug;
  let querySlugRaw = null;
  try {
    querySlugRaw = new URL(request?.url || '').searchParams.get('slug');
  } catch {}
  if (querySlugRaw != null) {
    const querySlug = validateInboundWorkerSessionSlug(querySlugRaw);
    if (!querySlug.ok) return refuse(querySlug.error, 400);
    if (querySlug.slug !== slug) return refuse('Session config slug query does not match X-Session-Slug.', 400);
  }
  const config = await deps?.getSessionConfig?.(env, slug);
  // Do not expose chain-canonical config through a caller-selected worker.
  if (!config || !isWorkerCanonicalSessionConfig(config)) return refuse(constants?.sessionConfigNotFoundError, 404);
  // The public readback is the client's authority for capability projection.
  // Refuse contradictory profile/storage records instead of advertising one
  // policy while storage routes enforce another.
  const modeValidation = validateWorkerConfigModeValues(config);
  if (!modeValidation.ok) return refuse(constants?.sessionConfigNotFoundError, 404);
  const corsContext = await deps?.getCorsContext?.({ request, config });
  if (!corsContext?.ok) return { response: protectBootstrapResponse(corsContext?.response, headers) };
  return { slug, config, headers: buildBootstrapHeaders(corsContext.headers) };
};

export const dispatchSessionConfigBootstrapRequest = async ({
  request,
  env,
  slugHint,
  baseHeaders,
  deps,
  constants,
} = {}) => {
  const read = await readWorkerSessionConfig({
    request, env, slugHint, headers: buildBootstrapHeaders(baseHeaders), deps, constants,
  });
  if ('response' in read) return read.response;
  const { slug, config } = read;

  return deps?.json?.({
    ok: true,
    sessionSlug: slug,
    config: {
      ...projectPublicWorkerSessionConfig(config),
      // Runtime advertisement, never trust a persisted capability on an older Worker.
      responseFieldEncryption: {
        ...(config.responseFieldEncryption?.mode ? { mode: config.responseFieldEncryption.mode } : {}),
        version: resolveResponseFieldPolicy(config, { workerAvailable: true }).admin &&
          !!env?.CE_STORAGE_ENVELOPE_KEK &&
          typeof getStorageAuditBinding(env)?.put === 'function' ? 1 : 0,
      },
    },
  }, 200, read.headers);
};

// GET /llms.txt: the session's instructions for AI agents, from its public
// config. Admins write them, so they're sent as text that never runs as a page.
export const dispatchSessionAgentInstructionsRequest = async ({
  request,
  env,
  slugHint,
  baseHeaders,
  deps,
  constants,
} = {}) => {
  const read = await readWorkerSessionConfig({
    request, env, slugHint, headers: buildBootstrapHeaders(baseHeaders), deps, constants,
  });
  if ('response' in read) return read.response;
  const { agentInstructions } = projectPublicWorkerSessionConfig(read.config);
  if (typeof agentInstructions !== 'string' || !agentInstructions.trim()) {
    return deps?.json?.({ error: 'This session has no instructions for AI agents.' }, 404, read.headers);
  }
  const headers = new Headers(read.headers);
  headers.set('Content-Type', 'text/markdown; charset=utf-8');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Content-Security-Policy', "sandbox; default-src 'none'");
  return new Response(agentInstructions, { status: 200, headers });
};
