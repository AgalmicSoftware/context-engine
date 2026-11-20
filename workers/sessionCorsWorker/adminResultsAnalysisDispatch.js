import { resolveAuthenticatedRouteContext } from './authenticatedRouteContextResolution.js';
import { readSessionDiagnosticsAuthority, readUploadReceiptDiagnostics } from './sessionDiagnostics.js';
import {
  ABUSE_COUNTER_TYPES,
  recordAbuseEvent,
} from './abuseObservability.js';
import {
  readResultsAnalysisAdminStatus,
} from './resultsAnalysisGeneration.js';
import { canBuildResults } from './resultsBuild.js';
import { callSessionFeedbackStore } from './sessionFeedbackRoute.js';
import { callSessionAgentHistoryStore } from './sessionAgentRoute.js';
import { countResultsScanRows } from './resultsScanRowCount.js';
import { STORED_VERSIONS_FIELD } from '../../shared/sessionDiagnostics.mjs';

const toTrimmedString = (value, deps) => {
  if (typeof deps?.toStr === 'function') return deps.toStr(value).trim();
  return value == null ? '' : String(value).trim();
};

const recordAuthFailure = async ({ env, deps } = {}) => {
  try {
    await (deps?.recordAbuseEvent || recordAbuseEvent)({
      env,
      type: ABUSE_COUNTER_TYPES.AUTH_FAILURE,
      now: deps?.now,
    });
  } catch {
    // Results-analysis auth telemetry must not alter the original failure response.
  }
};

const withPrivateNoStoreHeaders = (headers = {}) => {
  const next = new Headers(headers || {});
  next.set('Cache-Control', 'private, no-store');
  return next;
};

const readStatusSessionSlug = (request) => {
  try {
    const params = new URL(request?.url || 'https://worker.invalid/').searchParams;
    return toTrimmedString(params.get('sessionSlug') || params.get('slug'));
  } catch {
    return '';
  }
};

const requestWithQuerySlugHeader = (request) => {
  const slug = readStatusSessionSlug(request);
  if (!slug || request?.headers?.get?.('x-session-slug')) return request;
  const headers = new Headers(request.headers || {});
  headers.set('x-session-slug', slug);
  return new Request(request, { headers });
};

const readIncludeDraft = (request) => {
  try {
    const value = new URL(request?.url || 'https://worker.invalid/').searchParams.get('includeDraft');
    return value == null || value === '' ? true : value !== 'false' && value !== '0';
  } catch {
    return true;
  }
};

// The two lists only a session's admins read, each a page at a time from its own store.
const ADMIN_LISTS = {
  feedback: {
    call: (deps) => deps?.callSessionFeedbackStore || callSessionFeedbackStore,
    refused: 'Only the session’s admins can read feedback.',
    badPage: 'That page of feedback can’t be read.',
    down: 'Feedback couldn’t be reached just now. Try again shortly.',
    downReason: 'feedback_unavailable',
  },
  chats: {
    call: (deps) => deps?.callSessionAgentHistoryStore || callSessionAgentHistoryStore,
    refused: 'Only the session’s admins can read stored chats.',
    badPage: 'That page of stored chats can’t be read.',
    down: 'Stored chats couldn’t be reached just now. Try again shortly.',
    downReason: 'session_agent_chats_unavailable',
  },
};

export const dispatchAdminResultsAnalysisStatusRequest = async ({
  request,
  env,
  baseHeaders,
  slug,
  deps,
  diagnostics = false,
  // Feedback and stored chats are read with the sign-in token, so paging spends no sign-in nonces.
  feedback = false,
  chats = false,
} = {}) => {
  const list = feedback ? ADMIN_LISTS.feedback : chats ? ADMIN_LISTS.chats : null;
  request = requestWithQuerySlugHeader(request);
  const auth = await deps?.requireAuth?.({
    request,
    env,
    baseHeaders,
    slugHint: slug,
  });
  if (!auth?.ok) return auth?.response;
  // These lists are for the session's admins only: an agent key, even one
  // minted for an admin, does not read them.
  if (list && (auth.payload?.agentSource || auth.payload?.via)) {
    return deps?.json?.({ error: list.refused }, 403, withPrivateNoStoreHeaders(baseHeaders));
  }
  // A sign-in from an agent's link or an attached passkey reads nothing that is for admins.
  if (auth.payload?.via) {
    return deps?.json?.({ error: 'Sign in as an admin to read this.' }, 403, withPrivateNoStoreHeaders(baseHeaders));
  }

  const targetSlug = auth.slug || slug;
  let snapshot;
  if (diagnostics) {
    try {
      snapshot = await readSessionDiagnosticsAuthority({ env, slug: targetSlug });
    } catch {
      return deps?.json?.({ error: 'Session diagnostics are unavailable; retry.' }, 503, withPrivateNoStoreHeaders(baseHeaders));
    }
  }
  const context = await resolveAuthenticatedRouteContext({
    request, env, auth, baseHeaders,
    deps: { ...deps, SESSION_CONFIG_NOT_FOUND_ERROR: 'Session config not found.',
      ...(diagnostics ? { readCurrentSessionConfig: async () => ({ config: snapshot.config, revision: snapshot.revision }) } : {}),
    },
  });
  if (!context.ok) return context.response;
  const config = context.config;
  const headers = withPrivateNoStoreHeaders(context.headers);

  const address = toTrimmedString(auth.payload?.sub, deps).toLowerCase();
  // Results admins also read AI Views status; diagnostics and the lists stay with admins.
  const isAdmin = diagnostics || list
    ? await deps?.validateAdmin?.({ env, slug: targetSlug, address, config, body: {} })
    : await canBuildResults({ env, slug: targetSlug, config, address, validateAdmin: deps?.validateAdmin });
  if (!isAdmin) {
    await recordAuthFailure({ env, deps });
    return deps?.json?.({ error: list ? list.refused : 'Admin authorization failed.' }, 403, headers);
  }

  if (list) {
    const params = new URL(request.url).searchParams;
    const result = await list.call(deps)(env, targetSlug, 'list', {
      cursor: params.get('cursor'),
      ...(params.has('limit') ? { limit: params.get('limit') } : {}),
    });
    if (result?.ok) return deps?.json?.(result.body, 200, headers);
    return result?.status === 400
      ? deps?.json?.({ error: list.badPage, reason: result.body?.reason }, 400, headers)
      : deps?.json?.({ error: list.down, reason: list.downReason }, 503, headers);
  }

  if (diagnostics) {
    try {
      const cursor = new URL(request.url).searchParams.get('cursor') || '';
      const uploadReceipts = await readUploadReceiptDiagnostics({ env, slug: targetSlug, cursor });
      // Counted on the first page only; null when the count can't be read.
      const storedVersions = cursor ? undefined
        : await (deps?.countResultsScanRows || countResultsScanRows)({ env, slug: targetSlug, config }).catch(() => null);
      return deps?.json?.({
        ok: true, type: 'ce_session_diagnostics', version: 1,
        observedAtMs: typeof deps?.now === 'function' ? deps.now() : Date.now(),
        uploadReceipts, analysis: snapshot.analysis, configProjection: snapshot.configProjection,
        ...(storedVersions === undefined ? {} : { [STORED_VERSIONS_FIELD]: storedVersions }),
      }, 200, headers);
    } catch (error) {
      return deps?.json?.({ error: error?.status === 400 ? 'Invalid diagnostics cursor.' : 'Session diagnostics are unavailable; retry.' }, error?.status === 400 ? 400 : 503, headers);
    }
  }

  const body = await (deps?.readResultsAnalysisAdminStatus || readResultsAnalysisAdminStatus)({
    env,
    slug: targetSlug,
    config,
    includeDraft: readIncludeDraft(request),
    deps,
  });
  return deps?.json?.(body, 200, headers);
};
