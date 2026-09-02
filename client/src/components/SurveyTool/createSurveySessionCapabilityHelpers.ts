import { canonicalizeSessionSlug as normalizeSessionSlug } from '../../utilities/session/sessionSlug.js';
import { getSessionConfigBySlug } from '../../utilities/web3/chainGateway.js';
import { mergeSessionContractMaps, resolveActiveSessionSlug } from '../../utilities/session/sessionNaming.js';
import {
  claimsWorkerCanonicalAuthority,
  resolveSessionCapabilityProjection,
} from '../../utilities/session/sessionCapabilityProjection';
import { getChainById } from '../../variables/chains.js';
import { buildCreateSurveyGateOptions } from './createQuestionsAndSurveysHelpers.js';

type UnknownRecord = Record<string, unknown>;

type SessionContracts = UnknownRecord & {
  sbtFactory?: {
    chainId?: unknown;
    [key: string]: unknown;
  };
  surveys?: {
    chainId?: unknown;
    [key: string]: unknown;
  };
};

type SessionRegistryConfig = UnknownRecord & {
  chainId?: unknown;
  registryChainId?: unknown;
};

export type CreateSurveyCapabilitySessionConfig = UnknownRecord & {
  __registry?: SessionRegistryConfig;
  contracts?: SessionContracts;
  networkChainId?: unknown;
  slug?: unknown;
};

export type CreateSurveyCapabilityProps = UnknownRecord & {
  activeSessionSlug?: unknown;
  contracts?: UnknownRecord;
  network?: (UnknownRecord & { chainId?: unknown; id?: unknown }) | null;
  networkChainId?: unknown;
  sessionSlug?: unknown;
};

export const resolveCreateSurveySessionConfig = ({
  propConfig,
  props,
}: {
  propConfig: CreateSurveyCapabilitySessionConfig;
  props: CreateSurveyCapabilityProps;
}): CreateSurveyCapabilitySessionConfig & {
  contracts: unknown;
  networkChainId: number | null;
  slug: string;
} => {
  const propsSlug = resolveActiveSessionSlug({
    activeSessionSlug: props.activeSessionSlug,
    sessionSlug: props.sessionSlug,
  });
  const slug = normalizeSessionSlug(propConfig.slug || propsSlug || '');
  const propProjection = resolveSessionCapabilityProjection(propConfig);
  if (claimsWorkerCanonicalAuthority(propConfig)) {
    return {
      ...propConfig,
      slug,
      contracts: mergeSessionContractMaps(propConfig.contracts),
      networkChainId:
        propProjection.profileValid && propProjection.isWorkerCanonical && propProjection.usesRpc
          ? propProjection.chainId
          : null,
    };
  }
  const canonicalConfig = (getSessionConfigBySlug(slug) || {}) as CreateSurveyCapabilitySessionConfig;
  const contractsFromProps = props.contracts && typeof props.contracts === 'object' ? props.contracts : {};
  const contracts = mergeSessionContractMaps(canonicalConfig.contracts, contractsFromProps, propConfig.contracts);
  const mergedConfig = { ...canonicalConfig, ...propConfig, slug, contracts };
  const projection = resolveSessionCapabilityProjection(mergedConfig);
  const networkChainId =
    projection.profileValid && !projection.usesRpc
      ? null
      : Number(
          propConfig.networkChainId ||
            propConfig.contracts?.surveys?.chainId ||
            propConfig.contracts?.sbtFactory?.chainId ||
            propConfig.__registry?.chainId ||
            propConfig.__registry?.registryChainId ||
            canonicalConfig.networkChainId ||
            canonicalConfig.contracts?.surveys?.chainId ||
            canonicalConfig.contracts?.sbtFactory?.chainId ||
            canonicalConfig.__registry?.chainId ||
            canonicalConfig.__registry?.registryChainId ||
            props.networkChainId ||
            props.network?.id ||
            props.network?.chainId ||
            0,
        ) || null;

  return { ...mergedConfig, networkChainId };
};

export const resolveCreateSurveySessionChainId = (
  sessionConfig: CreateSurveyCapabilitySessionConfig,
  props: CreateSurveyCapabilityProps,
): number | null => {
  const projection = resolveSessionCapabilityProjection(sessionConfig);
  if (claimsWorkerCanonicalAuthority(sessionConfig) && !projection.profileValid) return null;
  if (projection.profileValid) return projection.usesRpc ? projection.chainId : null;
  return (
    Number(
      sessionConfig.networkChainId ||
        sessionConfig.contracts?.surveys?.chainId ||
        sessionConfig.contracts?.sbtFactory?.chainId ||
        sessionConfig.__registry?.chainId ||
        sessionConfig.__registry?.registryChainId ||
        props.networkChainId ||
        props.network?.id ||
        props.network?.chainId ||
        0,
    ) || null
  );
};

export const resolveCreateSurveyTargetNetwork = (
  sessionConfig: CreateSurveyCapabilitySessionConfig,
  props: CreateSurveyCapabilityProps,
): unknown => {
  const projection = resolveSessionCapabilityProjection(sessionConfig);
  if (claimsWorkerCanonicalAuthority(sessionConfig) && !projection.profileValid) return null;
  if (projection.profileValid && !projection.usesRpc) return null;
  const chainId = resolveCreateSurveySessionChainId(sessionConfig, props);
  const propNetworkChainId = Number(props.network?.id || props.network?.chainId || 0) || null;
  if (!chainId || propNetworkChainId === chainId) return props.network || null;
  return getChainById(chainId) || props.network || null;
};

export const resolveCreateSurveyGateOptions = ({
  isStandaloneQuestion,
  sessionConfig,
  sessionLabel,
}: {
  isStandaloneQuestion: unknown;
  sessionConfig: unknown;
  sessionLabel: string;
}): unknown => {
  const projection = resolveSessionCapabilityProjection(sessionConfig);
  if (
    (claimsWorkerCanonicalAuthority(sessionConfig) && !projection.profileValid) ||
    (projection.profileValid && projection.isPureWorkerCanonical)
  ) {
    return { defaultGateId: '', gateMap: {}, gateOptions: [] };
  }
  return buildCreateSurveyGateOptions({
    cfg: sessionConfig,
    isStandaloneQuestion,
    sessionLabel,
  });
};
