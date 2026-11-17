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
import {
  PRIVATE_SESSION_INVITE_INVALID,
  evaluatePrivateSessionAccess,
  isPrivateSession,
  privateSessionRefusal,
  projectPrivateSessionShell,
} from './privateSessionAccess.js';

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
  // A private session answers by who is asking and what invite they carry.
  vary.add('Authorization');
  vary.add('X-CE-Group-Invite');
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

// For a private session: whether the request sees the config, its shell, or
// a refusal when access can't be checked.
const readPrivateSessionAccess = async ({ request, env, slug, config, headers, deps }) => {
  if (!isPrivateSession(config)) return {};
  const requester = (await deps?.resolveOptionalRequester?.({ request, env, slug, config, headers })) || {};
  const questions = await evaluatePrivateSessionAccess({
    env, slug, config, request, requesterAddress: requester.address || '', authScopes: requester.scopes, part: 'questions',
  });
  if (!questions.ok) {
    return questions.status === 403
      ? { shell: questions.reason, signedIn: !!requester.address }
      : { refusal: privateSessionRefusal({ access: questions, json: deps?.json, headers }) };
  }
  // Every part follows one rule for now. When the context gets its own, the
  // context text is withheld here from those its rule refuses.
  return {};
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
  const access = await readPrivateSessionAccess({ request, env, slug, config, headers: read.headers, deps });
  if (access.refusal) return access.refusal;
  if (access.shell) {
    // What signing in and joining need, and why the rest is withheld.
    return deps?.json?.({
      ok: true,
      sessionSlug: slug,
      privateSession: access.shell === PRIVATE_SESSION_INVITE_INVALID ? 'invite_invalid' : 'invite_required',
      // Whether a sign-in counted, so a client whose bearer didn't can sign in again.
      signedIn: access.signedIn,
      config: projectPrivateSessionShell(projectPublicWorkerSessionConfig(config)),
    }, 200, read.headers);
  }

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
  if (isPrivateSession(read.config)) {
    const access = await evaluatePrivateSessionAccess({
      env, slug: read.slug, config: read.config, request, part: 'questions',
      resolveRequester: () => deps?.resolveOptionalRequester?.({ request, env, slug: read.slug, config: read.config, headers: read.headers }),
    });
    if (!access.ok) return privateSessionRefusal({ access, json: deps?.json, headers: read.headers });
  }
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
