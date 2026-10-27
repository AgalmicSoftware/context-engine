import { recoveryKeyFingerprint } from '../shared/recoveryKey.mjs';
import { getDefaultWorkerSessionSlug, normalizeWorkerSessionSlug } from './sessionSlugResolution.js';

export const exportCoordinatorRecoveryKey = async (coordinator, payload) => {
  const headers = { 'Cache-Control': 'no-store' };
  const reply = (body, status) => Response.json(body, { status, headers });
  try {
    const authority = await coordinator.assertSessionAuthority(payload);
    if (!authority) return reply({ error: 'Session config is not initialized.' }, 409);
    const pinnedSlug = getDefaultWorkerSessionSlug(coordinator.env);
    if (!pinnedSlug || pinnedSlug !== normalizeWorkerSessionSlug(authority.slug)) {
      return reply({ error: 'The deployment operator holds the recovery key for this Worker.',
        reason: 'recovery_key_deployment_scoped' }, 403);
    }
    if (payload?.confirm !== 'export-recovery-key') return reply({ error: 'Confirm export-recovery-key in the signed payload.' }, 400);
    const rawKey = String(coordinator.env.CE_STORAGE_ENVELOPE_KEK || '').trim();
    const recoveryKey = /^[a-f0-9]{64}$/i.test(rawKey) ? rawKey.toLowerCase() : rawKey;
    if (!recoveryKey) return reply({ error: 'Recovery key is not configured.' }, 503);
    const fingerprint = await recoveryKeyFingerprint(recoveryKey);
    const now = Number(coordinator.now()) || Date.now();
    const day = Math.floor(now / 86_400_000);
    // One counter per config coordinator survives restarts and serializes admins.
    // It contains only a UTC day and count, never a response or key material.
    const count = await coordinator.state.storage.transaction(async (transaction) => {
      const previous = await transaction.get('recovery-key-export-counter');
      const used = previous?.day === day ? previous.count : 0;
      if (used >= 3) return 0;
      await transaction.put('recovery-key-export-counter', { day, count: used + 1 });
      return used + 1;
    });
    if (!count) return reply({ error: 'Recovery key export is limited to three times per UTC day.', reason: 'recovery_key_export_limit' }, 429);
    const audit = coordinator.env.CE_STORAGE_AUDIT_KV;
    if (audit) {
      await audit.put(`ce-recovery-key-audit:${authority.slug}:${day}:${count}`, JSON.stringify({
        action: 'export-recovery-key', sessionSlug: authority.slug,
        adminAddress: payload.expectedAuthority.actor, timestamp: new Date(now).toISOString(),
      }));
    }
    return reply({ ok: true, recoveryKey, fingerprint }, 200);
  } catch (error) {
    return reply({ error: error.status === 409 ? error.message : 'Recovery key export is unavailable; retry.' }, error.status || 503);
  }
};
