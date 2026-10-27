

async function canManageResponseExportAllowlist({ env }) { return env.AGENT_SERVICES.admin(); }

export { canManageResponseExportAllowlist };
