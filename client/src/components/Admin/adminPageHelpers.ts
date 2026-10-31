import { inferAiProviderFromModel } from '../../../../shared/aiModelFamily.mjs';
import { getChainById } from '../../variables/chains.js';
import { resolveSessionCapabilityProjection } from '../../utilities/session/sessionCapabilityProjection';
import { toStr } from '../../utilities/shared/primitives.js';
import { normalizeWorkerUrl as normalizeWorkerBaseUrl } from '../../utilities/worker/workerUrl.js';

export { normalizeSessionSlugToken as normalizeSlug } from '../../utilities/session/sessionSlug';

type AdminCapabilitySessionConfig = {
  adminAddress?: unknown;
  __registry?: { registryChainId?: unknown; chainId?: unknown; adminAddress?: unknown } | null;
  sessionModeProfile?: unknown;
};

export const getErrorMessage = (error: unknown, fallback = 'Unknown error'): string => {
  const message =
    error && typeof error === 'object' && 'message' in error ? (error as { message?: unknown }).message : null;
  return typeof message === 'string' && message.trim() ? message : fallback;
};

export const getChainName = (value: unknown): string => {
  const id = Number(value || 0);
  if (!id) return '';
  const chain = getChainById(id);
  return toStr(chain?.name).trim();
};

// Reads the chain id from inputs like "84532" or "OP Sepolia (11155420)": the last number wins.
export const parseChainIdInput = (raw: unknown): number => {
  const matches = toStr(raw).match(/\d+/g);
  if (!matches || !matches.length) return 0;
  return Number(matches[matches.length - 1]) || 0;
};

export const countSessionsForChain = (entries: unknown = [], chainId: unknown = null): number => {
  const list = Array.isArray(entries) ? entries : [];
  if (!chainId) return list.length;
  return list.filter((entry) => {
    const [, cfg] = Array.isArray(entry) ? entry : [];
    const cfgRecord = cfg && typeof cfg === 'object' ? (cfg as Record<string, unknown>) : {};
    const registry =
      cfgRecord.__registry && typeof cfgRecord.__registry === 'object'
        ? (cfgRecord.__registry as Record<string, unknown>)
        : {};
    const cfgChainId = Number(registry.registryChainId || registry.chainId || 0) || 0;
    return cfgChainId === chainId;
  }).length;
};

export const normalizeWorkerUrl = (url: unknown): string => normalizeWorkerBaseUrl(url);

export const resolveAdminCapabilities = ({
  account,
  sessionConfig,
}: {
  account?: unknown;
  sessionConfig?: AdminCapabilitySessionConfig | null;
} = {}) => {
  const accountLower = toStr(account).trim().toLowerCase();
  const workerAdminAddress = toStr(sessionConfig?.adminAddress).trim().toLowerCase();
  const registryAdminAddress = toStr(sessionConfig?.__registry?.adminAddress).trim().toLowerCase();
  const capabilities = resolveSessionCapabilityProjection(sessionConfig);
  const isWorkerCanonicalSession = capabilities.isWorkerCanonical;
  const hasRegistryEntry =
    capabilities.isRegistryCanonical &&
    Number(sessionConfig?.__registry?.registryChainId || sessionConfig?.__registry?.chainId || 0) > 0;
  const isWorkerAdmin = !!accountLower && accountLower === workerAdminAddress;
  const isRegistryAdmin = !!accountLower && accountLower === registryAdminAddress;
  // Worker ownership and registry ownership are independent capabilities: a
  // worker admin must never inherit on-chain authority from a mismatched entry.
  return {
    isWorkerCanonicalSession,
    workerAdminAddress,
    hasRegistryEntry,
    canAdminWorker:
      !!sessionConfig && (capabilities.usesWorkerAuthority ? isWorkerAdmin : hasRegistryEntry && isRegistryAdmin),
    canAdminRegistry: !!sessionConfig && hasRegistryEntry && isRegistryAdmin,
  };
};

export const normalizeAiProvider = (raw: unknown, fallback: unknown = 'openai'): string => {
  const provider = toStr(raw).trim().toLowerCase();
  if (['openai', 'anthropic', 'openrouter', 'custom'].includes(provider)) return provider;
  return String(fallback || '');
};

const asAiRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

// The admin AI test pings the session's everyday model, or the provider's default.
export const resolveAdminAiTestModel = (aiValue: unknown): { provider: string; model: string } => {
  const ai = asAiRecord(aiValue);
  const fast = asAiRecord(asAiRecord(ai.models).fast);
  const fastModel = toStr(fast.model).trim();
  const legacyModel = toStr(ai.model).trim();
  const provider = normalizeAiProvider(
    fast.provider || ai.mode || ai.provider || inferAiProviderFromModel(fastModel || legacyModel) || 'openai',
  );
  const providerModel = toStr(asAiRecord(asAiRecord(ai.providers)[provider]).model).trim();
  const fits = (model: string) => !!model && ['', provider].includes(inferAiProviderFromModel(model));
  // With no stored model the ping names none, so each Worker uses its own default;
  // older Workers refuse this release's defaults.
  const model = (fits(fastModel) ? fastModel : '') || providerModel || (fits(legacyModel) ? legacyModel : '');
  return { provider, model };
};

export const buildTxExplorerUrl = (hash: unknown, chainId: unknown): string => {
  const base = toStr(getChainById(chainId)?.blockExplorers?.default?.url).trim();
  if (!base || !hash) return '';
  return `${base.replace(/\/+$/, '')}/tx/${hash}`;
};
