import { agentStoragePrefix } from './storage.mjs';
export const stripAgentAdmissionFromBackup = config => {
  if (!config?.agentHttp || typeof config.agentHttp !== 'object') return config;
  const agentHttp = { ...config.agentHttp };
  delete agentHttp.invites;
  return { ...config, agentHttp };
};

export const assertAgentBackupTargetEmpty = async ({ kv, storage, sessionId }) => {
  const unavailable = () => { throw Object.assign(new Error('Agent restore target could not be checked.'), { status: 503 }); };
  const occupied = () => { throw Object.assign(new Error('Restore requires an empty target session.'), { status: 409, reason: 'backup_target_not_empty' }); };
  if (!kv?.list || !storage?.list) unavailable();
  const prefix = agentStoragePrefix(sessionId);
  const rows = await kv.list({ prefix, limit: 1 });
  if (!Array.isArray(rows?.keys) || typeof rows.list_complete !== 'boolean' ||
      rows.keys.some(row => typeof row?.name !== 'string' || !row.name.startsWith(prefix))) unavailable();
  if (rows.keys.length) occupied();
  if (rows.list_complete !== true) unavailable();
  // Admission and submission journals survive partial KV projection and must
  // also prevent reuse of a target after its config has been cleared.
  for (const journalPrefix of ['ce-agent-invite:', 'ce-agent-submit:', 'ce-agent-wrapped:']) {
    const journals = await storage.list({ prefix: journalPrefix, limit: 1 });
    if (!(journals instanceof Map)) unavailable();
    if (journals.size) occupied();
  }
};
