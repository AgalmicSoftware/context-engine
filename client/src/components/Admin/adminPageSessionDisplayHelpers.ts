import { toStr } from '../../utilities/shared/primitives.js';
import { getChainName } from './adminPageHelpers';
import { normalizeSlug } from './adminPageHelpers';

type SessionDisplayUrlArgs = {
  selectedSlug?: unknown;
  selectedConfig?: Record<string, unknown> | null;
  groupMetadata?: Record<string, unknown> | null;
};

type BuildSessionUrlOptions = {
  allowGeneral?: boolean;
};

type AdminEncryptedEntry = string | Record<string, unknown>;

type AdminChainRegistryDisplayArgs = {
  chainId?: unknown;
  registryChainId?: unknown;
};

type AdminPageSessionIdentityArgs = {
  initialSessionId?: unknown;
  initialRegistryChainId?: unknown;
  initialSessionConfig?: unknown;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

export const buildAdminPageSessionIdentityKey = ({
  initialSessionId,
  initialRegistryChainId,
  initialSessionConfig,
}: AdminPageSessionIdentityArgs = {}): string => {
  const config = asRecord(initialSessionConfig);
  const registry = asRecord(config.__registry);
  // Regression guard: worker bootstrap accepts either canonical session-ID
  // field, so both must participate in route-driven Admin runtime remounts.
  const canonicalSessionId =
    [config.sessionId, config.sessionIdHex, registry.sessionIdHex]
      .map((value) => toStr(value).trim().toLowerCase())
      .find(Boolean) || '';
  return [
    toStr(initialSessionId).trim().toLowerCase(),
    normalizeSlug(config.slug),
    canonicalSessionId,
    toStr(config.corsWorkerUrl ?? config.workerUrl)
      .trim()
      .replace(/\/+$/, '')
      .toLowerCase(),
    toStr(initialRegistryChainId ?? registry.registryChainId ?? registry.chainId ?? config.networkChainId).trim(),
  ].join('|');
};

const buildStableComparableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(buildStableComparableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value as Record<string, unknown>)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = buildStableComparableValue((value as Record<string, unknown>)[key]);
      return acc;
    }, {});
};

export const buildAdminEncryptedEntrySignature = (entry: unknown): string => {
  if (entry == null) return '';
  if (typeof entry === 'string') return entry;
  try {
    return JSON.stringify(buildStableComparableValue(entry)) || '';
  } catch {
    return toStr(entry);
  }
};

export const areAdminEncryptedEntriesEquivalent = (a: unknown, b: unknown): boolean =>
  buildAdminEncryptedEntrySignature(a) === buildAdminEncryptedEntrySignature(b);

export const buildSessionUrl = (slug: unknown, { allowGeneral = false }: BuildSessionUrlOptions = {}): string => {
  const hasExplicitSlug = slug !== undefined && slug !== null;
  const normalized = normalizeSlug(slug);
  const base = typeof window !== 'undefined' && window.location ? window.location.origin : '';
  if (!normalized) return allowGeneral && hasExplicitSlug ? `${base}/session` : '';
  return `${base}/session/${encodeURIComponent(normalized)}`;
};

export const shortAddress = (addr: unknown): string => {
  const s = toStr(addr);
  if (!s) return '';
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
};

export const getAdminSessionDisplayUrl = ({
  selectedSlug,
  selectedConfig,
  groupMetadata,
}: SessionDisplayUrlArgs = {}): string => {
  if (!selectedConfig && !groupMetadata) return '';
  const resolvedSlug = selectedConfig?.slug ?? groupMetadata?.slug ?? selectedSlug;
  return buildSessionUrl(resolvedSlug, { allowGeneral: true });
};

export const buildAdminChainRegistryDisplay = ({
  chainId: chainIdRaw,
  registryChainId: registryChainIdRaw,
}: AdminChainRegistryDisplayArgs = {}): string => {
  const chainId = toStr(chainIdRaw).trim();
  const chainName = getChainName(chainId);
  const registryChainId = toStr(registryChainIdRaw).trim();
  const chainDisplay = chainName ? `${chainName} (${chainId})` : chainId || '\u2014';
  const chainNum = Number(chainId);
  const registryNum = Number(registryChainId);
  const sameChain =
    chainId && registryChainId && Number.isFinite(chainNum) && Number.isFinite(registryNum)
      ? chainNum === registryNum
      : registryChainId === chainId;
  if (!registryChainId || sameChain) return chainDisplay;
  const registryName = getChainName(registryChainId);
  const registryDisplay = registryName ? `${registryName} (${registryChainId})` : registryChainId;
  return `${chainDisplay} / ${registryDisplay}`;
};

export const collectEncryptedEntries = (metadata: unknown): Record<string, AdminEncryptedEntry> => {
  const metadataRecord = asRecord(metadata);
  const entries: Record<string, AdminEncryptedEntry> = {};
  if (!Object.keys(metadataRecord).length) return entries;

  const fields = asRecord(metadataRecord.encryptedFields);
  Object.entries(fields).forEach(([key, value]) => {
    if (value == null || value === '') return;
    entries[key] = value as AdminEncryptedEntry;
  });

  const sessionInfoEncrypted = metadataRecord.sessionInfoEncrypted;
  if (sessionInfoEncrypted) {
    entries.sessionInfo = sessionInfoEncrypted as AdminEncryptedEntry;
  }

  const ai = asRecord(metadataRecord.ai);
  const aiProviders = asRecord(ai.providers);
  Object.entries(aiProviders).forEach(([key, cfg]) => {
    const encrypted = asRecord(cfg).encryptedApiKey;
    if (!encrypted) return;
    const path = `ai.providers.${key}.apiKey`;
    if (!entries[path]) entries[path] = encrypted as AdminEncryptedEntry;
  });

  const rpc = asRecord(metadataRecord.rpc);
  const rpcProviders = asRecord(rpc.providers);
  Object.entries(rpcProviders).forEach(([key, cfg]) => {
    const encrypted = asRecord(cfg).encryptedApiKey;
    if (!encrypted) return;
    const path = `rpc.providers.${key}.apiKey`;
    if (!entries[path]) entries[path] = encrypted as AdminEncryptedEntry;
  });

  const arweaveEncrypted = asRecord(metadataRecord.arweave).encryptedJwk;
  if (arweaveEncrypted && !entries['arweave.jwk']) entries['arweave.jwk'] = arweaveEncrypted as AdminEncryptedEntry;

  const faucetEncrypted = asRecord(metadataRecord.faucet).encryptedPrivateKey;
  if (faucetEncrypted && !entries['faucet.privateKey'])
    entries['faucet.privateKey'] = faucetEncrypted as AdminEncryptedEntry;

  return entries;
};
