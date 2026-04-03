import {
  getDefaultSponsoredGate,
  getGateSbtAddresses,
  normalizeGateMode,
} from '../../utilities/web3/sponsoredAccess.js';
import {
  buildSbtAccessControlConditions,
  resolveLitChain,
} from '../../utilities/crypto/litProtocol.js';

export const resolveMainSiteLitSessionConfig = ({
  sessionConfig,
  networkChainIdFallback = null,
} = {}) => {
  const cfg = sessionConfig || {};
  const gate = getDefaultSponsoredGate(cfg);
  const chainId = gate?.chainId || cfg?.networkChainId || networkChainIdFallback || null;
  const litNetwork = cfg?.lit?.network || cfg?.litNetwork || 'naga-dev';
  const userMaxPrice = cfg?.lit?.userMaxPrice || cfg?.litUserMaxPrice || '';
  const litChain = resolveLitChain({
    chainId,
    litChain: gate?.litChain || gate?.chain,
  });
  const gateAddresses = getGateSbtAddresses(gate);
  const accessControlConditions = gateAddresses.length
    ? buildSbtAccessControlConditions({
        sbtAddresses: gateAddresses,
        chainId,
        litChain,
        mode: normalizeGateMode(gate),
      })
    : null;

  return {
    gate,
    chainId,
    litNetwork,
    userMaxPrice,
    litChain,
    gateAddresses,
    accessControlConditions,
  };
};
