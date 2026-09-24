// Field encryption is an explicit opt-in independent of whole-payload storage.
// Existing disabled sessions remain disabled; legacy envelopes remain readable.
export const resolveResponseFieldPolicy = (config, { workerAvailable = false } = {}) => {
  const profile = config?.sessionModeProfile;
  if (!profile) return { enabled: true, self: true, admin: false, session: false, centralized: false, privateSession: false };
  const mode = profile.encryption?.mode;
  const centralized = profile.authority?.mode === 'worker_canonical' &&
    profile.storage?.backend === 'cloudflare' && config?.storageProfile?.backend === 'cloudflare';
  const access = config?.storageProfile?.payloadAccessControl;
  const conditions = access?.accessConditions || access?.conditions ||
    config?.storageProfile?.cloudflare?.accessConditions || config?.storageProfile?.accessConditions;
  const privateSession = ['role_gate', 'group_gate', 'sbt_gate'].includes(access?.gate) ||
    (Array.isArray(conditions?.conditions) && conditions.conditions.length > 0);
  const optionalFields = centralized && config?.responseFieldEncryption?.mode === 'optional';
  const enabled = mode === 'worker_envelope' || mode === 'lit' || optionalFields;
  const worker = centralized && (optionalFields || (mode === 'worker_envelope' &&
    access?.encryption === 'worker_envelope')) &&
    (workerAvailable || config?.responseFieldEncryption?.version === 1);
  return { enabled, self: enabled, admin: worker, session: worker && privateSession, centralized, privateSession };
};

export const assertResponseFieldAudience = (config, audience, options) => {
  const policy = resolveResponseFieldPolicy(config, options);
  if (!policy.enabled) throw new Error('Response encryption is disabled for this session.');
  if (audience === 'self_admin' && !policy.admin) throw new Error('Me + admin encryption is unavailable for this session.');
  if (audience === 'session' && !policy.session) throw new Error('Session audience requires a private session with Worker encryption.');
  if (!['self', 'self_admin', 'session', 'gate'].includes(audience)) throw new Error('Unknown response encryption audience.');
  return policy;
};
