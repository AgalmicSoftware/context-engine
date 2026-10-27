const invoke = ({ env, tokenHash, body }, operation) => env.AGENT_SERVICES.invite(operation, { ...body, tokenHash });
export const reserveAgentInviteRedemption = input => invoke(input, 'reserve');
export const finalizeAgentInviteRedemption = input => invoke(input, 'finalize');
export const releaseAgentInviteRedemption = input => invoke(input, 'release');
