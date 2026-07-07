import {
  getDefaultSponsoredGate,
  getGateSbtAddresses,
  normalizeGateMode,
  resolveSponsoredGateForResource,
} from '../../utilities/web3/sponsoredAccess.js';
import { buildSbtAccessControlConditions, resolveLitChain } from '../../utilities/crypto/litProtocol.js';
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
  encryption?: unknown;
  lit?: LitDeploymentLike | null;
  litCredentials?: unknown;
  litUserMaxPrice?: unknown;
  networkChainId?: unknown;
  sponsored?: unknown;
};

type ResolveSessionConfigBySlug = (slug: string) => unknown;

const isSessionConfigRecord = (value: unknown): value is MainSiteLitSessionConfigLike =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const readRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const resolvePrimaryLitGate = (cfg: MainSiteLitSessionConfigLike = {}) => {
  const defaultGate = getDefaultSponsoredGate(cfg);
  const encryptionConfig = readRecord(cfg.encryption);
  const sponsoredConfig = readRecord(cfg.sponsored);
  const litConfig = readRecord(cfg.lit);
  const gateIds = [
    encryptionConfig.primaryGateId,
    encryptionConfig.defaultGateId,
    litConfig.defaultGateId,
    sponsoredConfig.defaultGateId,
    'questionResponses',
    'default',
  ]
    .map((value) => toStr(value).trim())
    .filter(Boolean);

  const candidates = [...gateIds.map((gateId) => resolveSponsoredGateForResource(cfg, gateId)), defaultGate].filter(
    Boolean,
  );

  return candidates.find((gate) => getGateSbtAddresses(gate).length > 0) || defaultGate || candidates[0] || null;
};

export const resolveMainSiteLitSessionConfigSource = ({
  slug = '',
  resolveRegistryConfigBySlug,
  resolveStaticConfigBySlug,
}: {
  slug?: string;
  resolveRegistryConfigBySlug?: ResolveSessionConfigBySlug | null;
  resolveStaticConfigBySlug?: ResolveSessionConfigBySlug | null;
} = {}): MainSiteLitSessionConfigLike => {
  const normalizedSlug = toStr(slug).trim();
  const registryConfig =
    typeof resolveRegistryConfigBySlug === 'function' ? resolveRegistryConfigBySlug(normalizedSlug) : null;
  if (isSessionConfigRecord(registryConfig)) return registryConfig;

  const staticConfig =
    typeof resolveStaticConfigBySlug === 'function' ? resolveStaticConfigBySlug(normalizedSlug) : null;
  return isSessionConfigRecord(staticConfig) ? staticConfig : {};
};

export const resolveMainSiteLitSessionConfig = ({
  sessionConfig,
  networkChainIdFallback = null,
}: {
  sessionConfig?: MainSiteLitSessionConfigLike | null;
  networkChainIdFallback?: number | null;
} = {}) => {
  const cfg: MainSiteLitSessionConfigLike = sessionConfig || {};
  const litCredentials =
    cfg?.litCredentials && typeof cfg.litCredentials === 'object' && !Array.isArray(cfg.litCredentials)
      ? (cfg.litCredentials as LitCredentialsLike)
      : null;
  const chipotleWorkerUrl = toStr(cfg?.corsWorkerUrl).trim();
  const hasChipotleRuntime = (
    chipotleWorkerUrl &&
    litCredentials &&
    toStr(litCredentials?.litApiBase).trim() &&
    toStr(litCredentials?.litPkpId).trim() &&
    toStr(litCredentials?.litActionCid).trim()
  );
  const litConfig =
    cfg?.lit && typeof cfg.lit === 'object' && !Array.isArray(cfg.lit) ? (cfg.lit as Record<string, unknown>) : null;
  const litNetworkHint = toStr(litConfig?.network || (cfg as Record<string, unknown>)?.litNetwork)
    .trim()
    .toLowerCase();
  const gate = resolvePrimaryLitGate(cfg);
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
    (hasCompleteLitCredentials || litNetworkHint === 'chipotle' || gateAddresses.length > 0)
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
    chipotle: hasChipotleRuntime
      ? {
          enabled: true,
          workerUrl: chipotleWorkerUrl,
          litCredentials: litCredentials || {},
          sessionConfig: cfg,
        }
      : null,
  };
};
