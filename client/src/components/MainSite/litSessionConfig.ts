import {
  getDefaultSponsoredGate,
  getGateSbtAddresses,
  normalizeGateMode,
  resolveSponsoredGateForResource,
} from '../../utilities/web3/sponsoredAccess.js';
import {
  buildSbtAccessControlConditions,
  resolveLitChain,
} from '../../utilities/crypto/litProtocol.js';
import { toStr } from '../../utilities/shared/primitives';

export const resolveMainSiteLitSessionConfig = ({
  sessionConfig,
  networkChainIdFallback = null,
}: {
  sessionConfig?: MainSiteLitSessionConfigLike | null;
  networkChainIdFallback?: number | null;
} = {}) => {
  const cfg: any = sessionConfig || {};
  const litCredentials = (
    cfg?.litCredentials &&
    typeof cfg.litCredentials === 'object' &&
    !Array.isArray(cfg.litCredentials)
  ) ? cfg.litCredentials : null;
  const chipotleWorkerUrl = toStr(cfg?.corsWorkerUrl).trim();
  const hasChipotleRuntime = (
    chipotleWorkerUrl &&
    litCredentials &&
    toStr(litCredentials?.litApiBase).trim() &&
    toStr(litCredentials?.litPkpId).trim() &&
    toStr(litCredentials?.litActionCid).trim()
  );
  const gate = getDefaultSponsoredGate(cfg);
  const chainId = gate?.chainId || cfg?.networkChainId || networkChainIdFallback || null;
  const litNetwork = hasChipotleRuntime ? 'chipotle' : '';
  const userMaxPrice = cfg?.lit?.userMaxPrice || cfg?.litUserMaxPrice || '';
  const litChain = resolveLitChain({
    chainId,
    litChain: gate?.litChain || gate?.chain,
  });
  const gateAddresses = getGateSbtAddresses(gate);
  const hasChipotleRuntime = !!(
    chipotleWorkerUrl &&
    (
      hasCompleteLitCredentials ||
      litNetworkHint === 'chipotle' ||
      gateAddresses.length > 0
    )
  );
  const litNetwork = hasChipotleRuntime ? 'chipotle' : '';
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
    chipotle: hasChipotleRuntime ? {
      enabled: true,
      workerUrl: chipotleWorkerUrl,
      litCredentials,
      sessionConfig: cfg,
    } : null,
  };
};
