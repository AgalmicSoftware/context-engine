// A private session: one whose access rule names Worker groups. Its questions,
// context and results show only to admins, to signed-in members of a named
// group, and to a visitor whose request carries a read invite for one, signed
// in or not. Every check reads the rule and the groups afresh, so a narrowing
// takes effect on the next request. Sessions whose rule names no group are
// unaffected.
import { WORKER_GROUP_READ_INVITE_HEADER } from '../../shared/workerGroupJoin.mjs';
import { WORKER_SUPPORT_FIELDS } from '../../shared/workerSessionPublicConfig.mjs';
import {
  STORAGE_GROUP_READ_INVITE,
  createRequesterAccessChecks,
  resolvePayloadAccessControl,
} from './storageRouteExecution.js';

// The parts a rule can cover, by the storage resource that holds each.
export const PRIVATE_SESSION_PARTS = Object.freeze({
  questions: 'questions',
  context: 'docsContext',
  results: 'responses',
});

// The rule a part follows. Every part follows the session's rule for now; a
// part's own rule, when sessions can set one, is read here and nowhere else.
export const resolvePrivateSessionPartRule = (config, _part) => resolvePayloadAccessControl(config).conditions;

const namesWorkerGroup = (rule) => !!rule?.conditions?.some((condition) => condition?.kind === 'worker_group');

export const isPrivateSession = (config) =>
  Object.keys(PRIVATE_SESSION_PARTS).some((part) => namesWorkerGroup(resolvePrivateSessionPartRule(config, part)));

export const readGroupReadInviteHeader = (request) => request?.headers?.get?.(WORKER_GROUP_READ_INVITE_HEADER) || '';

export const PRIVATE_SESSION_INVITE_REQUIRED = 'private_session_invite_required';
export const PRIVATE_SESSION_INVITE_INVALID = 'private_session_invite_invalid';
export const PRIVATE_SESSION_UNAVAILABLE = 'private_session_unavailable';

/**
 * Whether a request may see one part of a session: `{ ok: true }` for a session that isn't private or a request its
 * rule admits; otherwise `{ ok: false, status, reason }`. A request with an invite that doesn't hold is told apart from
 * one without; an invite is never needed by someone the rule admits without it.
 */
export const evaluatePrivateSessionAccess = async ({
  env,
  slug,
  config,
  request,
  requesterAddress = '',
  authScopes,
  part = 'questions',
  deps,
} = {}) => {
  const rule = resolvePrivateSessionPartRule(config, part);
  if (!namesWorkerGroup(rule)) return { ok: true, private: false };
  const header = readGroupReadInviteHeader(request);
  const checks = createRequesterAccessChecks({
    env,
    config,
    slug,
    requesterAddress,
    authScopes,
    deps: { ...(deps || {}), [STORAGE_GROUP_READ_INVITE]: header },
  });
  // A check that throws refuses: the route's own error handling answers it.
  const result = await checks.admits(rule);
  if (result?.ok) return { ok: true, private: true };
  if (result?.outcome === 'unavailable') {
    return { ok: false, private: true, status: 503, reason: PRIVATE_SESSION_UNAVAILABLE, retryable: true };
  }
  return {
    ok: false,
    private: true,
    status: 403,
    // Header values arrive trimmed, so a blank one is no header.
    reason: header ? PRIVATE_SESSION_INVITE_INVALID : PRIVATE_SESSION_INVITE_REQUIRED,
  };
};

const REFUSAL_TEXT = Object.freeze({
  [PRIVATE_SESSION_INVITE_REQUIRED]: 'This session is private. Open it from your group invite link.',
  [PRIVATE_SESSION_INVITE_INVALID]: 'This invite link no longer opens this session.',
  [PRIVATE_SESSION_UNAVAILABLE]: 'Access to this session could not be checked just now. Try again.',
});

/** The refusal a route sends for a failed `evaluatePrivateSessionAccess`; it never echoes the invite. */
export const privateSessionRefusal = ({ access, json, headers }) => json(
  {
    error: REFUSAL_TEXT[access.reason] || REFUSAL_TEXT[PRIVATE_SESSION_INVITE_REQUIRED],
    reason: access.reason,
    ...(access.retryable ? { retryable: true } : {}),
  },
  access.status || 403,
  headers,
);

// What a visitor the rule doesn't admit may see of a private session: what
// signing in and joining need, and nothing about its content or its people.
const SHELL_FIELDS = Object.freeze([
  'slug',
  'sessionId',
  'sessionIdHex',
  'configRevision',
  'authzEpoch',
  'corsWorkerUrl',
  'allowOrigins',
  'appearance',
  'sessionModeProfile',
  'storageProfile',
  'workerAuthority',
  ...WORKER_SUPPORT_FIELDS,
]);

/** A public config cut down to the private-session shell. */
export const projectPrivateSessionShell = (publicConfig) => Object.fromEntries(
  SHELL_FIELDS.filter((key) => Object.prototype.hasOwnProperty.call(publicConfig || {}, key))
    .map((key) => [key, publicConfig[key]]),
);
