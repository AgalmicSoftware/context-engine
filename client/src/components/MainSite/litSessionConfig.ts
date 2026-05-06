import {
  getDefaultSponsoredGate,
  getGateSbtAddresses,
  normalizeGateMode,
} from '../../utilities/web3/sponsoredAccess.js';
import {
  buildSbtAccessControlConditions,
  resolveLitChain,
} from '../../utilities/crypto/litProtocol.js';
import { toStr } from '../../utilities/shared/primitives';

type LitCredentialsLike = Record<string, unknown> & {
  litActionCid?: unknown;
  litApiBase?: unknown;
  litPkpId?: unknown;
};

type LitDeploymentLike = {
  network?: unknown;
  userMaxPrice?: unknown;
};

type MainSiteLitSessionConfigLike = Record<string, unknown> & {
  corsWorkerUrl?: unknown;
  lit?: LitDeploymentLike | null;
  litCredentials?: unknown;
  litUserMaxPrice?: unknown;
  networkChainId?: unknown;
};

export const resolveMainSiteLitSessionConfig = ({
  sessionConfig,
  networkChainIdFallback = null,
}: {
  sessionConfig?: MainSiteLitSessionConfigLike | null;
  networkChainIdFallback?: number | null;
} = {}) => {
  const cfg: MainSiteLitSessionConfigLike = sessionConfig || {};
  const litCredentials = (
    cfg?.litCredentials &&
    typeof cfg.litCredentials === 'object' &&
    !Array.isArray(cfg.litCredentials)
  ) ? cfg.litCredentials as LitCredentialsLike : null;
  const chipotleWorkerUrl = toStr(cfg?.corsWorkerUrl).trim();
  const hasCompleteLitCredentials = !!(
    litCredentials &&
    toStr(litCredentials?.litApiBase).trim() &&
    toStr(litCredentials?.litPkpId).trim() &&
    toStr(litCredentials?.litActionCid).trim()
  );
  const litConfig = cfg?.lit && typeof cfg.lit === 'object' && !Array.isArray(cfg.lit)
    ? cfg.lit as Record<string, unknown>
    : null;
  const litNetworkHint = toStr(litConfig?.network || (cfg as Record<string, unknown>)?.litNetwork).trim().toLowerCase();
  const gate = getDefaultSponsoredGate(cfg);
  const chainId = gate?.chainId || cfg?.networkChainId || networkChainIdFallback || null;
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
      litCredentials: litCredentials || {},
      sessionConfig: cfg,
    } : null,
  };
};
