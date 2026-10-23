const NETWORKS = Object.freeze({ 11155420: 'OP Sepolia', 84532: 'Base Sepolia' });

export const describeTestEthOffer = ({ config, resourcePresence } = {}) => {
  const mode = config?.sessionModeProfile?.authority?.mode;
  const hosted = mode === 'worker_canonical';
  const rawChain = hosted
    ? config?.networkChainId
    : config?.networkChainId ?? config?.registryChainId ?? config?.sessionModeProfile?.evm?.registryChainId;
  const chainId = typeof rawChain === 'string' || typeof rawChain === 'number' ? Number(rawChain) : null;
  const network = NETWORKS[chainId] || null;
  const result = {
    offered: false,
    audience: hosted ? 'participants' : 'gas-gate',
    chainId: Number.isSafeInteger(chainId) && chainId > 0 ? chainId : null,
    network,
    amountEth: hosted ? '0.0002' : null,
    maxBalanceEth: hosted ? '0.001' : null,
  };
  if (!config || (mode && !['worker_canonical', 'evm_registry_canonical'].includes(mode))) {
    return { ...result, reason: 'Session config is unavailable or unsupported.' };
  }
  if (!network) return { ...result, reason: 'No supported test network is configured.' };
  if (hosted && !(Array.isArray(config.workerAuthority?.participantScopes) && config.workerAuthority.participantScopes.some((scope) => scope === 'faucet_self' || scope === 'faucet'))) {
    return { ...result, reason: 'Participants are not offered test ETH.' };
  }
  if (resourcePresence?.txGas !== true) return { ...result, reason: 'A configured faucet has not been confirmed.' };
  return { ...result, offered: true };
};
