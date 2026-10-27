import { readCurrentSessionConfig } from '../sessionConfigAuthority.js';
import { validateInboundWorkerSessionSlug } from '../sessionSlugResolution.js';
import { createAgentEnvironment, authorityError, validateCredentialAuthority, validateMemberSource } from './authority.mjs';
import { loadAgentCredentialHash } from './agentCredentials.mjs';
import { createAgentServices } from './services.mjs';
import { processAgentSubmitQueueBatch, AGENT_SUBMIT_QUEUE_MESSAGE_TYPE } from './agentSubmitQueue.mjs';

export const dispatchSessionAgentQueue = async ({ batch, env, deps }) => {
  const results = [];
  for (const message of batch.messages || []) {
    const record = message.body?.record;
    if (message.body?.type !== AGENT_SUBMIT_QUEUE_MESSAGE_TYPE || !record ||
        !validateInboundWorkerSessionSlug(record.sessionSlug).ok || !record.sessionSlug || !/^0x[0-9a-f]{32}$/.test(record.sessionId || '')) {
      message.ack?.(); results.push({ ok: false, reason: 'unsupported_queue_message' }); continue;
    }
    try {
      const { config, revision } = await (deps.readCurrentSessionConfig || readCurrentSessionConfig)({ env, slug: record.sessionSlug });
      const origin = new URL(config.corsWorkerUrl).origin;
      const agentEnv = createAgentEnvironment({ env, config, revision, slug: record.sessionSlug, origin, now: deps.now, persistenceOnly: true, fetchImpl: deps.fetch });
      const ctx = agentEnv.AGENT_CONTEXT;
      if (ctx.sessionId !== record.sessionId || origin !== record.workerOrigin) { message.ack?.(); results.push({ ok: false, reason: 'queue_session_mismatch' }); continue; }
      const services = createAgentServices({ env, agentEnv, deps });
      agentEnv.AGENT_SERVICES = { ...services, async authorizeSubmit(source) {
        const loaded = await loadAgentCredentialHash({ env: agentEnv, tokenHash: source.sourceCredentialHash, now: new Date(ctx.now()).toISOString() });
        if (!loaded.ok) throw authorityError('queued_agent_credential_inactive', 401);
        const delegated = loaded.record;
        await validateCredentialAuthority({ env: agentEnv, record: delegated,
          validateSourceJwt: payload => validateMemberSource({ env, context: ctx, payload, deps }) });
        if (!delegated.scopes.includes('draft_answers') || delegated.scopes.includes('agent_autofill') ||
            delegated.principal.principalId !== source.principalId || delegated.accountAddress.toLowerCase() !== source.accountAddress.toLowerCase() ||
            config.sessionModeProfile?.authority?.mode === 'worker_canonical' ||
            config.agentHttp?.managedAccountSubmitAllowed !== true || config.agentHttp?.asyncSubmitEnabled !== true) throw authorityError('queued_agent_grant_denied');
        ctx.auth = { ok: true, authMode: 'agent_credential', delegation: delegated, address: delegated.accountAddress };
        ctx.address = delegated.accountAddress;
        await services.current();
        if (!(ctx.scopes.storage || ctx.scopes.arweave)) throw authorityError('queued_agent_submit_scope_denied');
      } };
      const result = await processAgentSubmitQueueBatch({ ...batch, messages: [message] }, agentEnv);
      results.push(...result.results);
    } catch {
      // A missing authority store is retryable, never evidence that a queued
      // operation did not already execute. Leave the original generation intact.
      message.retry?.({ delaySeconds: 60 }); results.push({ ok: false, retryable: true, reason: 'queue_authority_unavailable' });
    }
  }
  return { ok: results.every(result => result.ok !== false), results };
};
