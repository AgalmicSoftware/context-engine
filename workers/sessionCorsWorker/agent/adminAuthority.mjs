export async function loadAgentAdminStatus({ env, context }) {
  const manager = await env.AGENT_SERVICES.admin();
  return { ok: true, sessionSlug: context.session.sessionSlug, accountAddress: manager.accountAddress,
    admin: manager.ok, reason: manager.ok ? 'admin_allowed' : 'session_admin_required',
    capabilities: { canManageSponsoredQuestions: manager.ok, canManageResponseExportAllowlist: manager.ok } };
}
export async function requireQuestionQueueAdmin({ env, context, allowDelegatedAdmin = false }) {
  if (context.authMode !== 'session_admin' && !(allowDelegatedAdmin && context.authMode === 'agent_credential')) {
    return { ok: false, status: 403, reason: 'session_admin_required' };
  }
  const manager = await env.AGENT_SERVICES.admin();
  return manager.ok ? { ok: true, manager } : { ok: false, status: 403, reason: 'session_admin_required' };
}
