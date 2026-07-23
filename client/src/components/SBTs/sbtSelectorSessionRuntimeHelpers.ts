import { normalizeSessionSlug } from '../../utilities/web3/chainGateway.js';
import { resolveSessionCapabilityProjection } from '../../utilities/session/sessionCapabilityProjection';
import { normalizeDiscoverySlugs } from './sbtSelectorScopeHelpers';

export type SbtLookupKeyArgs = {
  address?: unknown;
  chainId?: unknown;
};

export type SbtSelectorLogContextArgs = {
  effectiveSessionSlug?: unknown;
  extra?: Record<string, unknown>;
  id?: unknown;
  label?: unknown;
};

export type SbtSelectorSessionConfigSigLike = Record<string, unknown> & {
  __registry?: Record<string, unknown>;
  blockLimits?: Record<string, unknown>;
  contracts?: {
    sbtFactory?: Record<string, unknown>;
  };
  networkChainId?: unknown;
  slug?: unknown;
};

export type SbtOptionsRequestSignatureArgs = {
  cacheRevision?: unknown;
  featuredEntries?: unknown;
  ignoredFromConfig?: unknown;
  sessionConfigSig?: unknown;
  slug?: unknown;
  targetSlugChainSig?: unknown;
};

export type ResolveSbtSelectorSessionNetworkIdArgs = {
  defaultFallbackChainId?: unknown;
  directChainId?: unknown;
  displayLookupSessionConfig?: unknown;
  getNormalizedNetworkChainValue?: ((network: unknown) => number | null) | null;
  getSessionChainId?: ((slug: unknown) => unknown) | null;
  network?: unknown;
  propsSessionConfig?: unknown;
  shouldUsePropsSessionConfig?: unknown;
  slug?: unknown;
};

export type BuildSbtSelectorMetadataLookupConfigArgs = {
  baseConfig?: unknown;
  chainId?: unknown;
  propsConfig?: unknown;
  sessionSlug?: unknown;
  shouldUsePropsConfig?: unknown;
};

export type BuildSbtSelectorDiscoverySessionRefArgs = {
  metadataLookupConfig?: unknown;
  sessionSlug?: unknown;
};

export type ResolveSbtSelectorSessionLabelArgs = {
  sessionConfig?: unknown;
  sessionSlug?: unknown;
};

export type ResolveSbtSelectorSessionChainId = (slug: string) => unknown;

export type ShouldDiscoverSbtForSessionConfigArgs = {
  sessionConfig?: unknown;
  sessionSlug?: unknown;
};

type SbtSelectorFeaturedSignatureEntry = Record<string, unknown> & {
  address?: unknown;
  slug?: unknown;
};

const isSbtSelectorRuntimeRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object';

export const normalizeAddressListForSig = (addresses: unknown): string[] =>
  Array.from(
    new Set(
      (Array.isArray(addresses) ? addresses : [])
        .map((value) =>
          String(value || '')
            .trim()
            .toLowerCase(),
        )
        .filter(Boolean),
    ),
  ).sort();

export const normalizeSessionSlugListForSig = (slugs: unknown): string[] =>
  Array.from(
    new Set(
      (Array.isArray(slugs) ? slugs : [])
        .map((value) => normalizeSessionSlug(value || ''))
        .filter((value): value is string => value != null),
    ),
  );

export const buildSessionSlugSignature = (slugs: unknown): string => normalizeSessionSlugListForSig(slugs).join(',');

export const buildSharedLightUniverseKickoffSignature = (slugs: unknown = []): string => {
  const normalized = normalizeDiscoverySlugs(slugs, { allowEmpty: true })
    .slice()
    .sort((left: string, right: string) => String(left || '').localeCompare(String(right || '')));
  return `${normalized.length}:${normalized.join(',')}`;
};

export const buildSbtSelectorLogContext = ({
  effectiveSessionSlug = '',
  extra = {},
  id = '',
  label = '',
}: SbtSelectorLogContextArgs = {}): Record<string, unknown> => ({
  selectorId: String(id || label || '').trim() || 'unnamed-selector',
  effectiveSessionSlug: normalizeSessionSlug(effectiveSessionSlug),
  ...extra,
});

export const buildTargetSlugChainSignature = (
  targetSlugs: unknown = [],
  resolveSessionChainId: ResolveSbtSelectorSessionChainId = () => 0,
): string =>
  normalizeDiscoverySlugs(targetSlugs, { allowEmpty: true })
    .map((targetSlug: string) => `${targetSlug}:${Number(resolveSessionChainId(targetSlug) || 0)}`)
    .join('|');

export const normalizeChainValue = (value: unknown): number | null => {
  const parsed = Number(value || 0);
  return parsed || null;
};

export const buildSbtLookupKey = ({ address, chainId }: SbtLookupKeyArgs = {}): string => {
  const lowerAddress = String(address || '')
    .trim()
    .toLowerCase();
  if (!lowerAddress) return '';
  const normalizedChainId = normalizeChainValue(chainId);
  return normalizedChainId ? `${normalizedChainId}:${lowerAddress}` : lowerAddress;
};

export const getNormalizedNetworkChainValue = (network: unknown): number | null => {
  const record = network && typeof network === 'object' ? (network as Record<string, unknown>) : {};
  return normalizeChainValue(record.id || record.chainId || 0);
};

export const shouldDiscoverSbtForSessionConfig = ({
  sessionConfig = null,
  sessionSlug = '',
}: ShouldDiscoverSbtForSessionConfigArgs = {}): boolean => {
  const config = isSbtSelectorRuntimeRecord(sessionConfig) ? sessionConfig : {};
  const projection = resolveSessionCapabilityProjection(config);
  if (projection.source === 'legacy_registry' || projection.isRegistryCanonical || projection.usesOnChainSbt) {
    return true;
  }
  // The empty global scope remains an explicit on-chain tool. A concrete
  // session must prove SBT capability instead of inheriting a wallet/default
  // network or cached registry universe.
  return !normalizeSessionSlug(sessionSlug || '') && Object.keys(config).length === 0;
};

export const resolveSbtSelectorSessionNetworkId = ({
  defaultFallbackChainId = null,
  directChainId = null,
  displayLookupSessionConfig = null,
  getNormalizedNetworkChainValue: getNormalizedNetworkChainValueFn = getNormalizedNetworkChainValue,
  getSessionChainId: getSessionChainIdFn = null,
  network = null,
  propsSessionConfig = null,
  shouldUsePropsSessionConfig = false,
  slug = '',
}: ResolveSbtSelectorSessionNetworkIdArgs = {}): number | null => {
  const sessionConfig =
    shouldUsePropsSessionConfig && isSbtSelectorRuntimeRecord(propsSessionConfig) ? propsSessionConfig : null;
  const displayLookupCfg = isSbtSelectorRuntimeRecord(displayLookupSessionConfig) ? displayLookupSessionConfig : {};
  const capabilityConfig = sessionConfig || displayLookupCfg;
  if (!shouldDiscoverSbtForSessionConfig({ sessionConfig: capabilityConfig, sessionSlug: slug })) return null;

  const projection = resolveSessionCapabilityProjection(capabilityConfig);
  if (projection.source === 'profile') {
    const profile =
      isSbtSelectorRuntimeRecord(capabilityConfig.sessionModeProfile) &&
      isSbtSelectorRuntimeRecord(capabilityConfig.sessionModeProfile.evm)
        ? capabilityConfig.sessionModeProfile
        : capabilityConfig;
    const evm = isSbtSelectorRuntimeRecord(profile.evm) ? profile.evm : {};
    return normalizeChainValue(evm.registryChainId);
  }

  const sessionConfigChainId = normalizeChainValue(sessionConfig?.networkChainId);
  if (sessionConfigChainId) return sessionConfigChainId;

  const registryChainId = normalizeChainValue(
    typeof getSessionChainIdFn === 'function' ? getSessionChainIdFn(slug) : null,
  );
  if (registryChainId) return registryChainId;

  const displayContracts = isSbtSelectorRuntimeRecord(displayLookupCfg.contracts) ? displayLookupCfg.contracts : {};
  const displaySbtFactory = isSbtSelectorRuntimeRecord(displayContracts.sbtFactory) ? displayContracts.sbtFactory : {};
  const displaySurveys = isSbtSelectorRuntimeRecord(displayContracts.surveys) ? displayContracts.surveys : {};
  const displayRegistry = isSbtSelectorRuntimeRecord(displayLookupCfg.__registry) ? displayLookupCfg.__registry : {};
  const displayLookupChainId = normalizeChainValue(
    displayLookupCfg.networkChainId ||
      displayRegistry.chainId ||
      displaySbtFactory.chainId ||
      displaySurveys.chainId ||
      0,
  );
  if (displayLookupChainId) return displayLookupChainId;

  const directOverride = normalizeChainValue(directChainId);
  if (directOverride) return directOverride;
  const walletChainId =
    typeof getNormalizedNetworkChainValueFn === 'function'
      ? getNormalizedNetworkChainValueFn(network)
      : getNormalizedNetworkChainValue(network);
  if (walletChainId) return walletChainId;
  return normalizeChainValue(defaultFallbackChainId);
};

export const buildSbtSelectorMetadataLookupConfig = ({
  baseConfig = {},
  chainId = null,
  propsConfig = {},
  sessionSlug = '',
  shouldUsePropsConfig = false,
}: BuildSbtSelectorMetadataLookupConfigArgs = {}): Record<string, unknown> => {
  const baseCfg = isSbtSelectorRuntimeRecord(baseConfig) ? baseConfig : {};
  const propsCfg = shouldUsePropsConfig && isSbtSelectorRuntimeRecord(propsConfig) ? propsConfig : {};
  const mergedContracts = {
    ...(isSbtSelectorRuntimeRecord(baseCfg.contracts) ? baseCfg.contracts : {}),
    ...(isSbtSelectorRuntimeRecord(propsCfg.contracts) ? propsCfg.contracts : {}),
  };
  const resolvedChainId = Number(chainId || baseCfg.networkChainId || 0) || null;
  const next: Record<string, unknown> = {
    ...baseCfg,
    ...propsCfg,
    slug: sessionSlug ?? '',
    contracts: mergedContracts,
  };
  if (resolvedChainId) {
    next.networkChainId = resolvedChainId;
    if (!isSbtSelectorRuntimeRecord(next.__registry)) {
      next.__registry = { chainId: resolvedChainId };
    } else if (!Number(next.__registry.chainId || 0)) {
      next.__registry = { ...next.__registry, chainId: resolvedChainId };
    }
  }
  return next;
};

export const buildSbtSelectorDiscoverySessionRef = ({
  metadataLookupConfig = {},
  sessionSlug = '',
}: BuildSbtSelectorDiscoverySessionRefArgs = {}): Record<string, unknown> => ({
  ...(isSbtSelectorRuntimeRecord(metadataLookupConfig) ? metadataLookupConfig : {}),
  slug: sessionSlug ?? '',
});

export const resolveSbtSelectorSessionLabel = ({
  sessionConfig = null,
  sessionSlug = '',
}: ResolveSbtSelectorSessionLabelArgs = {}): string => {
  const cfg = isSbtSelectorRuntimeRecord(sessionConfig) ? sessionConfig : {};
  const sessionName = String(cfg.sessionName || '');
  const slugText = String(sessionSlug || '');
  if (!slugText) return sessionName || 'General';
  if (sessionName && sessionName !== slugText) return `${sessionName} (${slugText})`;
  return sessionName || slugText;
};

export const buildFeaturedEntrySignature = (entries: unknown): string =>
  (Array.isArray(entries) ? entries : [])
    .map((entry) => {
      const record = isSbtSelectorRuntimeRecord(entry) ? (entry as SbtSelectorFeaturedSignatureEntry) : {};
      const slug = normalizeSessionSlug(record.slug || '');
      const address = String(record.address || '')
        .trim()
        .toLowerCase();
      return `${slug}:${address}`;
    })
    .filter((value) => value !== ':')
    .join(',');

export const buildSessionConfigSig = (sessionConfig: unknown): string => {
  const config = isSbtSelectorRuntimeRecord(sessionConfig) ? (sessionConfig as SbtSelectorSessionConfigSigLike) : null;
  if (!config) return '';
  const slug = String(config.slug || '');
  const factoryAddress = String(config.contracts?.sbtFactory?.address || '')
    .trim()
    .toLowerCase();
  const networkChainId = normalizeChainValue(
    config.networkChainId || config.__registry?.chainId || config.contracts?.sbtFactory?.chainId || 0,
  );
  const blockStart = String(Number(config.blockLimits?.start || 0) || '');
  const blockEnd = String(Number(config.blockLimits?.end || 0) || '');
  return [slug, factoryAddress, String(networkChainId || ''), blockStart, blockEnd].join('|');
};

export const buildSbtOptionsRequestSignature = ({
  slug,
  cacheRevision,
  sessionConfigSig,
  targetSlugChainSig,
  featuredEntries,
  ignoredFromConfig,
}: SbtOptionsRequestSignatureArgs): string => {
  return [
    String(slug || ''),
    String(cacheRevision ?? ''),
    String(sessionConfigSig || ''),
    String(targetSlugChainSig || ''),
    buildFeaturedEntrySignature(featuredEntries),
    normalizeAddressListForSig(ignoredFromConfig).join(','),
  ].join('|');
};

export const isUnresolvedSessionConfig = (config: unknown): boolean =>
  isSbtSelectorRuntimeRecord(config) && config.__unresolved === true;
