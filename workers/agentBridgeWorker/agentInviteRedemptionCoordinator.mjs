import { safeString } from './runtimePrimitives.mjs';

export const AGENT_INVITE_COORDINATOR_BINDING = 'AGENT_INVITE_COORDINATOR';
export const AGENT_INVITE_COORDINATOR_CLASS = 'AgentInviteRedemptionCoordinator';
export const AGENT_INVITE_COORDINATOR_MIGRATION_TAG = 'agent-invite-redemption-v1';

const STATE_KEY = 'invite-redemption';
const TOKEN_HASH_RE = /^[0-9a-f]{64}$/;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

async function requestBody(request) {
  return request.json().catch(() => null);
}

function normalizeRequestIdentity(body = {}) {
  const tokenHash = safeString(body?.tokenHash).toLowerCase();
  const reservationId = safeString(body?.reservationId).slice(0, 128);
  return TOKEN_HASH_RE.test(tokenHash) && reservationId
    ? { tokenHash, reservationId }
    : null;
}

export class AgentInviteRedemptionCoordinator {
  constructor(state) {
    this.state = state;
  }

  async fetch(request) {
    const path = new URL(request.url).pathname;
    const body = await requestBody(request);
    const identity = normalizeRequestIdentity(body);
    if (!identity) return json({ ok: false, reason: 'invite_reservation_invalid' }, 400);

    return this.state.storage.transaction(async (transaction) => {
      const current = await transaction.get(STATE_KEY);
      if (path === '/reserve') {
        if (current?.phase === 'redeemed') {
          return json({ ok: false, reason: 'invite_token_redeemed' }, 409);
        }
        if (current?.phase === 'pending') {
          if (current.reservationId === identity.reservationId) {
            return json({ ok: true, phase: 'pending', replayed: true });
          }
          return json({ ok: false, reason: 'invite_token_redemption_pending' }, 409);
        }
        const pending = {
          type: 'agent_invite_redemption',
          version: 1,
          phase: 'pending',
          ...identity,
          reservedAt: safeString(body?.createdAt) || new Date().toISOString(),
        };
        await transaction.put(STATE_KEY, pending);
        return json({ ok: true, phase: 'pending', replayed: false });
      }

      if (path === '/finalize') {
        if (current?.phase === 'redeemed') {
          return current.reservationId === identity.reservationId
            ? json({ ok: true, phase: 'redeemed', replayed: true })
            : json({ ok: false, reason: 'invite_token_redeemed' }, 409);
        }
        if (current?.phase !== 'pending' || current.reservationId !== identity.reservationId) {
          return json({ ok: false, reason: 'invite_reservation_not_owned' }, 409);
        }
        const redeemed = {
          ...current,
          phase: 'redeemed',
          principalId: safeString(body?.principalId),
          sessionSlug: safeString(body?.sessionSlug),
          credentialHash: safeString(body?.credentialHash),
          redeemedAt: safeString(body?.createdAt) || new Date().toISOString(),
        };
        await transaction.put(STATE_KEY, redeemed);
        return json({ ok: true, phase: 'redeemed', replayed: false });
      }

      if (path === '/release') {
        if (current?.phase === 'pending' && current.reservationId === identity.reservationId) {
          await transaction.delete(STATE_KEY);
          return json({ ok: true, released: true });
        }
        return json({ ok: true, released: false });
      }

      return json({ ok: false, reason: 'invite_coordinator_route_not_found' }, 404);
    });
  }
}

function coordinatorStub(env = {}, tokenHash = '') {
  const namespace = env?.[AGENT_INVITE_COORDINATOR_BINDING];
  if (!namespace) return null;
  if (typeof namespace.getByName === 'function') return namespace.getByName(tokenHash);
  if (typeof namespace.idFromName !== 'function' || typeof namespace.get !== 'function') return null;
  return namespace.get(namespace.idFromName(tokenHash));
}

async function callCoordinator({ env = {}, tokenHash = '', path = '', body = {} } = {}) {
  const normalizedHash = safeString(tokenHash).toLowerCase();
  const stub = TOKEN_HASH_RE.test(normalizedHash) ? coordinatorStub(env, normalizedHash) : null;
  if (!stub || typeof stub.fetch !== 'function') {
    return { ok: false, status: 503, reason: 'invite_coordinator_unavailable' };
  }
  try {
    const response = await stub.fetch(`https://agent-invite-coordinator.internal${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...body, tokenHash: normalizedHash }),
    });
    const payload = await response.json().catch(() => ({}));
    return {
      ...payload,
      ok: response.ok && payload?.ok === true,
      status: response.status,
    };
  } catch {
    return { ok: false, status: 503, reason: 'invite_coordinator_unavailable' };
  }
}

export function reserveAgentInviteRedemption(input = {}) {
  return callCoordinator({ ...input, path: '/reserve' });
}

export function finalizeAgentInviteRedemption(input = {}) {
  return callCoordinator({ ...input, path: '/finalize' });
}

export function releaseAgentInviteRedemption(input = {}) {
  return callCoordinator({ ...input, path: '/release' });
}
