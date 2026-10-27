import { resolveCanonicalWorkerSessionIdHex } from '../sessionConfigMutation.js';
export const AGENT_INVITE_JOURNAL_PREFIX = 'ce-agent-invite:';
const reply = (body, status = 200) => Response.json(body, { status });

export const dispatchAgentInviteJournal = (coordinator, operation, payload) => coordinator.serializeSessionConfigOperation(async () => {
  if (!['reserve', 'finalize', 'release'].includes(operation) || !/^[a-f0-9]{64}$/.test(payload?.tokenHash || '') ||
      typeof payload?.reservationId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(payload.reservationId)) {
    return reply({ ok: false, reason: 'invite_reservation_invalid' }, 400);
  }
  const authority = await coordinator.readSessionConfigAuthority(payload.slug);
  const sessionId = resolveCanonicalWorkerSessionIdHex(authority?.config);
  if (!sessionId || sessionId !== payload.sessionId ||
      operation === 'reserve' && (authority.revision !== payload.revision || authority.config.sessionModeProfile?.surfaces?.agentHttp !== true)) {
    return reply({ ok: false, reason: 'invite_authority_changed' }, 409);
  }
  const key = `${AGENT_INVITE_JOURNAL_PREFIX}${sessionId}:${payload.tokenHash}`;
  // One existing coordinator serves the session: each invite needs its own key.
  // Never release a pending journal when issuance may have succeeded remotely.
  return coordinator.state.storage.transaction(async transaction => {
    const current = await transaction.get(key);
    const owned = current?.reservationId === payload.reservationId;
    if (operation === 'reserve') {
      if (current?.phase === 'redeemed') return reply({ ok: false, reason: 'invite_token_redeemed' }, 409);
      if (current?.phase === 'pending') return owned
        ? reply({ ok: true, phase: 'pending', replayed: true })
        : reply({ ok: false, reason: 'invite_token_redemption_pending' }, 409);
      if (current != null) return reply({ ok: false, reason: 'invite_journal_invalid' }, 503);
      await transaction.put(key, { version: 1, phase: 'pending', sessionId, tokenHash: payload.tokenHash,
        reservationId: payload.reservationId, reservedAt: new Date(coordinator.now()).toISOString() });
      return reply({ ok: true, phase: 'pending', replayed: false });
    }
    if (operation === 'finalize') {
      if (current?.phase === 'redeemed') return owned ? reply({ ok: true, phase: 'redeemed', replayed: true }) : reply({ ok: false, reason: 'invite_token_redeemed' }, 409);
      if (!owned || current.phase !== 'pending') return reply({ ok: false, reason: 'invite_reservation_not_owned' }, 409);
      if (!/^[a-f0-9]{64}$/.test(payload.credentialHash || '') || typeof payload.principalId !== 'string' || payload.principalId.length > 160) return reply({ ok: false, reason: 'invite_reservation_invalid' }, 400);
      await transaction.put(key, { ...current, phase: 'redeemed', principalId: payload.principalId,
        credentialHash: payload.credentialHash, redeemedAt: new Date(coordinator.now()).toISOString() });
      return reply({ ok: true, phase: 'redeemed', replayed: false });
    }
    if (owned && current.phase === 'pending') { await transaction.delete(key); return reply({ ok: true, released: true }); }
    return reply({ ok: true, released: false });
  });
});
