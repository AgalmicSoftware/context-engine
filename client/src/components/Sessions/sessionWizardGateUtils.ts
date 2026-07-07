import { DEFAULT_CHAIN_ID } from '../../variables/appConfig.js';
import { sessionRegistryUtils } from '../../utilities/web3/sessionRegistry.js';
import { getDemoSessionConfigBySlug, getSessionConfigBySlugOrDefault } from '../../utilities/web3/contractScripts.js';
import { normalizeSessionNaming } from '../../utilities/session/sessionMetadata.js';
import { normalizeSponsoredFieldSnapshot } from '../../utilities/session/sponsoredFlags.js';
import { t } from '../../utilities/ui/terminology.js';
import { toStr } from '../../utilities/shared/primitives.js';
import { SESSION_WIZARD_ONCHAIN_COMPAT_FIELD_PATHS } from './sessionWizardOnChainCompat.js';
import { normalizeSbtSelection } from './sessionWizardSbtSelections';
import type { AnyRecord, ChainIdLike, NetworkLike, SessionConfigLike } from '../shellTypes';

export const DEFAULT_GATE_KEYS = [
  'default',
  'questionResponses',
  'surveyResponses',
  'docUploads',
  'docUrls',
  'ai',
  'arweave',
  'rpc',
  'txGas',
  'lit',
];

const ENCRYPTION_GATE_COLORS = ['#5affc2', '#5b8cff', '#ffb347', '#ff6bcb', '#ffd166'];
const ONCHAIN_FIELD_PATHS = SESSION_WIZARD_ONCHAIN_COMPAT_FIELD_PATHS;

export const buildDefaultGateState = (chainId: ChainIdLike): AnyRecord => {
  const gates: AnyRecord = {};
  DEFAULT_GATE_KEYS.forEach((key) => {
    gates[key] = {
      sbts: [],
      mode: 'all',
      chainId: chainId || null,
      perMemberLimit: '',
    };
  });
  return gates;
};

export const buildResourceGateMap = (gates: AnyRecord[] = [], fallbackId = ''): Record<string, string> => {
  const firstId = fallbackId || gates[0]?.id || '';
  return DEFAULT_GATE_KEYS.reduce<Record<string, string>>((acc, key) => {
    acc[key] = firstId;
    return acc;
  }, {});
};

export const areSbtSelectionsEqual = (a: unknown[] = [], b: unknown[] = []): boolean => {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  const normalize = (arr: unknown[]) =>
    normalizeSbtSelection(arr)
      .map((sbt) => toStr(sbt?.address).toLowerCase())
      .filter(Boolean)
      .sort();
  const normA = normalize(a);
  const normB = normalize(b);
  if (normA.length !== normB.length) return false;
  for (let i = 0; i < normA.length; i += 1) {
    if (normA[i] !== normB[i]) return false;
  }
  return true;
};

export const getValueAtPath = (obj: AnyRecord | null | undefined, path: string[]): unknown => {
  let cur: unknown = obj;
  for (const key of path) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = (cur as AnyRecord)[key];
  }
  return cur;
};

export const setValueAtPath = (obj: AnyRecord, path: string[], value: unknown): void => {
  let cur: AnyRecord = obj;
  path.forEach((key, idx) => {
    if (idx === path.length - 1) {
      cur[key] = value;
    } else {
      if (!cur[key] || typeof cur[key] !== 'object') {
        cur[key] = {};
      }
      cur = cur[key];
    }
  });
};

const pathKey = (path: string[]): string => path.join('.');

export const getOnChainFieldKeyForPath = (pathArr: string[]): string => {
  if (!Array.isArray(pathArr) || !pathArr.length) return '';
  const candidate = pathKey(pathArr);
  for (const [fieldKey, fieldPath] of Object.entries(ONCHAIN_FIELD_PATHS)) {
    if (pathKey(fieldPath) === candidate) return fieldKey;
  }
  return '';
};

export const isSecretFieldPath = (pathArr: string[]): boolean => {
  if (!Array.isArray(pathArr) || !pathArr.length) return false;
  if (pathArr.length >= 4 && pathArr[0] === 'ai' && pathArr[1] === 'providers') {
    const last = pathArr[pathArr.length - 1];
    return last === 'apiKey' || last === 'encryptedApiKey';
  }
  if (pathArr.length >= 4 && pathArr[0] === 'rpc' && pathArr[1] === 'providers') {
    const last = pathArr[pathArr.length - 1];
    return last === 'apiKey' || last === 'encryptedApiKey';
  }
  if (pathArr.length === 2 && pathArr[0] === 'arweave') {
    return pathArr[1] === 'jwk' || pathArr[1] === 'encryptedJwk';
  }
  if (pathArr.length === 2 && pathArr[0] === 'faucet') {
    return pathArr[1] === 'privateKey' || pathArr[1] === 'encryptedPrivateKey';
  }
  return false;
};

export const isPrimitive = (val: unknown): boolean =>
  val === null || typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean';

export const isStringArray = (arr: unknown): boolean => Array.isArray(arr) && arr.every((v) => isPrimitive(v));

export const shouldLockable = (val: unknown): boolean => isPrimitive(val);

export const parseListInput = (raw: string): string[] =>
  raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

export const buildEmptyProvisionedSponsoredContext = (): AnyRecord => ({
  sessionSlug: '',
  workerUrl: '',
  fields: normalizeSponsoredFieldSnapshot({}),
});

export const getNextGateIndex = (gates: AnyRecord[] = []): number => {
  const used = new Set();
  let sawNumeric = false;
  (Array.isArray(gates) ? gates : []).forEach((gate) => {
    const match = /^gate-(\d+)$/.exec(toStr(gate?.id).trim());
    if (!match) return;
    const numericId = Number.parseInt(match[1], 10);
    if (!Number.isFinite(numericId) || numericId <= 0) return;
    sawNumeric = true;
    used.add(numericId - 1);
  });
  if (!sawNumeric) return Array.isArray(gates) ? gates.length : 0;
  let idx = 0;
  while (used.has(idx)) idx += 1;
  return idx;
};

export const buildEncryptionGate = (index: number): AnyRecord => ({
  id: `gate-${index + 1}`,
  label: `${t('gate')} ${String.fromCharCode(65 + index)}`,
  color: ENCRYPTION_GATE_COLORS[index % ENCRYPTION_GATE_COLORS.length],
  type: 'sbt',
  sbts: [],
  mode: 'all',
});

export const resolveSessionWizardSelectorSourceConfig = ({
  activeSessionSlug = '',
  registryChainId = null,
  draftNetworkChainId = null,
  network = null,
  normalizeSlug = sessionRegistryUtils.normalizeSlug,
  resolveStrictConfig = getSessionConfigBySlugOrDefault,
  resolveDisplayConfig = (slug: string) => getDemoSessionConfigBySlug(slug, { allowDemoFallback: true }),
  defaultChainId = DEFAULT_CHAIN_ID,
}: {
  activeSessionSlug?: string;
  registryChainId?: ChainIdLike;
  draftNetworkChainId?: ChainIdLike;
  network?: NetworkLike;
  normalizeSlug?: ((slug: string) => string) | null;
  resolveStrictConfig?: ((slug: string) => SessionConfigLike | null | undefined) | null;
  resolveDisplayConfig?: ((slug: string) => SessionConfigLike | null | undefined) | null;
  defaultChainId?: ChainIdLike;
} = {}): SessionConfigLike => {
  const activeSlug =
    typeof normalizeSlug === 'function'
      ? normalizeSlug(activeSessionSlug || '')
      : toStr(activeSessionSlug).trim().toLowerCase();
  const fallbackChainId =
    Number(registryChainId || draftNetworkChainId || network?.id || network?.chainId || defaultChainId || 0) || null;
  const normalizeSourceConfig = (cfg: SessionConfigLike | null | undefined): SessionConfigLike | null => {
    if (!cfg || typeof cfg !== 'object') return null;
    const normalizedCfg = normalizeSessionNaming(cfg) as AnyRecord;
    return {
      ...normalizedCfg,
      slug: activeSlug || normalizedCfg?.slug || '',
      networkChainId: Number(normalizedCfg?.networkChainId || fallbackChainId || 0) || fallbackChainId,
      contracts: normalizedCfg?.contracts && typeof normalizedCfg.contracts === 'object' ? normalizedCfg.contracts : {},
    } as SessionConfigLike;
  };

  const strictConfig = typeof resolveStrictConfig === 'function' ? resolveStrictConfig(activeSlug) : null;
  if (strictConfig && !strictConfig.__unresolved) {
    const normalizedStrictConfig = normalizeSourceConfig(strictConfig);
    if (normalizedStrictConfig) return normalizedStrictConfig;
  }

  const displayConfig = typeof resolveDisplayConfig === 'function' ? resolveDisplayConfig(activeSlug) : null;
  if (displayConfig && !displayConfig.__unresolved) {
    const normalizedDisplayConfig = normalizeSourceConfig(displayConfig);
    if (normalizedDisplayConfig) return normalizedDisplayConfig;
  }

  // `/session/demo` is a read-only source-session alias in the wizard, so when no
  // explicit session config exists we still source discovery from the default bucket.
  if (activeSlug === 'demo') {
    const defaultConfig =
      (typeof resolveStrictConfig === 'function' ? resolveStrictConfig('') : null) ||
      (typeof resolveDisplayConfig === 'function' ? resolveDisplayConfig('') : null);
    const normalizedDefaultConfig = normalizeSourceConfig(defaultConfig);
    if (normalizedDefaultConfig) return normalizedDefaultConfig;
  }

  return {
    slug: activeSlug,
    networkChainId: fallbackChainId,
    contracts: {},
  };
};
