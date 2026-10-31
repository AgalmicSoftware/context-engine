import { DEFAULT_AI_MODELS } from '@ce-shared/aiDefaults.mjs';
import { normalizeBlockLimitsForConfig } from '../../../utilities/session/blockLimits';
import { buildWorkerSessionConfigPayload } from '../../Admin/adminPageWorkerSessionConfigHelpers';
import { resolveSessionWizardAutoFeatureBySessionSlug } from '../sessionWizardAiConfig';
import { stripSessionWizardMetadataSecretFields } from '../sessionWizardMetadataPayload';
import { sanitizeSessionWizardMetadataPayload } from '../sessionWizardWriteNormalization';
import { asRecord, text, type SetupDraft } from '../setup/setupSectionTypes';

type Config = Record<string, unknown>;

// On-chain sessions: config comes from the SessionRegistry, through the
// metadata its URI names. These fields exist only there.

/** The contracts an admin can correct, as the /admin editor offered them. */
export const SETTINGS_CONTRACTS = Object.freeze([
  { key: 'surveys', label: 'Surveys contract' },
  { key: 'sbtFactory', label: 'SBT factory contract' },
  { key: 'sessionRegistry', label: 'SessionRegistry contract' },
] as const);

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const DECIMAL = /^\d+(\.\d+)?$/;
const lower = (value: unknown) => text(value).trim().toLowerCase();

const contractAddress = (config: Config, key: string): string => {
  const entry = asRecord(asRecord(config.contracts)[key]);
  return text(entry.address || entry.contractAddress).trim();
};

/** What the registry says about an on-chain session. */
export const readRegistryFacts = (config: unknown) => {
  const source = asRecord(config);
  const registry = asRecord(source.__registry);
  const registryChainId = Number(registry.registryChainId || registry.chainId || 0) || 0;
  return {
    registryChainId,
    /** The chain of the session's contracts and blocks. */
    chainId: Number(source.networkChainId || registry.chainId || registryChainId || 0) || 0,
    adminAddress: text(registry.adminAddress).trim(),
    sessionId: text(registry.sessionIdHex || registry.sessionId || source.sessionId).trim(),
    metadataURI: text(registry.metadataURI).trim(),
    encryptedMetadataURI: text(registry.encryptedMetadataURI).trim(),
    metadataUnavailable: text(registry.metadataLoadState).trim() === 'unavailable',
  };
};

export const buildSessionSettingsChainDraft = (source: Config) => ({
  contracts: Object.fromEntries(SETTINGS_CONTRACTS.map(({ key }) => [key, contractAddress(source, key)])),
  blockLimits: { start: text(asRecord(source.blockLimits).start), end: text(asRecord(source.blockLimits).end) },
  faucet: {
    amountEth: text(asRecord(source.faucet).amountEth),
    balanceThresholdEth: text(asRecord(source.faucet).balanceThresholdEth),
  },
  // The admin's answer to "are these synthesized addresses right?".
  contractsChecked: false,
});

const editedContracts = (draft: SetupDraft, before: Config) =>
  SETTINGS_CONTRACTS.filter(({ key }) => {
    const address = text(asRecord(draft.contracts)[key]).trim();
    return !!address && lower(address) !== lower(contractAddress(before, key));
  });

/**
 * True while saving would publish contract addresses the page synthesized
 * from chain defaults because the metadata could not be read, until the
 * admin edits them or confirms them.
 */
export const contractsNeedChecking = (before: unknown, draft: SetupDraft): boolean => {
  const config = asRecord(before);
  const registry = asRecord(config.__registry);
  const defaulted = Array.isArray(registry.metadataDefaultedContractKeys) ? registry.metadataDefaultedContractKeys : [];
  const synthesized = SETTINGS_CONTRACTS.some(({ key }) => defaulted.includes(key));
  return (
    readRegistryFacts(config).metadataUnavailable &&
    synthesized &&
    draft.contractsChecked !== true &&
    !editedContracts(draft, config).length
  );
};

// A contract's chain when its entry has none: the registry's for the
// SessionRegistry, the session's for the rest (as /admin chose).
const contractChainId = (before: Config, key: string): number => {
  const facts = readRegistryFacts(before);
  return (
    Number(asRecord(asRecord(before.contracts)[key]).chainId || 0) ||
    (key === 'sessionRegistry' ? facts.registryChainId || facts.chainId : facts.chainId || facts.registryChainId)
  );
};

/** The on-chain fields as the metadata will hold them; a field left alone keeps its stored value. */
export const editedChainValues = (before: Config, draft: SetupDraft): Config => {
  const values: Config = {};
  const contracts = { ...asRecord(before.contracts) };
  editedContracts(draft, before).forEach(({ key, label }) => {
    const address = text(asRecord(draft.contracts)[key]).trim();
    if (!ADDRESS.test(address)) throw new Error(`${label} must be an address: 0x and 40 hex digits.`);
    const chainId = contractChainId(before, key);
    contracts[key] = { ...asRecord(contracts[key]), address, ...(chainId ? { chainId } : {}) };
  });
  if (Object.keys(contracts).length) values.contracts = contracts;

  // Registry sessions need a start block, as they did when /admin saved them.
  const range = asRecord(draft.blockLimits);
  const blockLimits = normalizeBlockLimitsForConfig(range);
  if (!blockLimits) throw new Error('Set the start block: the first block this session reads.');
  if (text(range.end).trim() && blockLimits.end === null) {
    throw new Error('The end block must be a block number after the start block.');
  }
  const stored = buildSessionSettingsChainDraft(before).blockLimits;
  values.blockLimits =
    text(range.start) === stored.start && text(range.end) === stored.end ? before.blockLimits : blockLimits;

  const faucetDraft = asRecord(draft.faucet);
  const faucet = { ...asRecord(before.faucet) };
  (['amountEth', 'balanceThresholdEth'] as const).forEach((key) => {
    const amount = text(faucetDraft[key]).trim();
    if (amount === text(asRecord(before.faucet)[key]).trim()) return;
    if (amount && !DECIMAL.test(amount)) throw new Error('Faucet amounts are ETH numbers, such as 0.0002.');
    if (amount) faucet[key] = amount;
    else delete faucet[key];
  });
  if (Object.keys(faucet).length || before.faucet !== undefined) values.faucet = faucet;
  return values;
};

/**
 * The new metadata document: the session's config with the edits, cleaned
 * the way setup cleans what it uploads (no registry record, worker-only
 * fields, gates or secrets).
 */
export const buildOnChainSessionMetadata = (after: Config): Config => {
  const metadata = JSON.parse(JSON.stringify(after)) as Config;
  delete metadata.__registry;
  delete metadata.sponsoredKeys;
  // The legacy alias's choice moves to the current key, so an old "off" stays off.
  const autoFeature = resolveSessionWizardAutoFeatureBySessionSlug(metadata);
  delete metadata.autoFeatureSBTsWithFeaturedSbtTags;
  if (autoFeature !== undefined) metadata.autoFeatureSBTsBySessionSlug = autoFeature;
  // The cleaner reads ai.mode and ai.provider as the models' fallback
  // provider, so it runs before the secret fields (those included) go.
  const sanitized = stripSessionWizardMetadataSecretFields(
    sanitizeSessionWizardMetadataPayload(metadata, { defaultAiModels: DEFAULT_AI_MODELS }),
  );
  // The cleaner keeps only the contracts setup shows; keep the rest too.
  const contracts = { ...asRecord(metadata.contracts), ...asRecord(sanitized.contracts) };
  if (Object.keys(contracts).length) sanitized.contracts = contracts;
  return sanitized;
};

/**
 * What the session's Worker is sent after an on-chain save: the runtime
 * fields /admin always synced, the edited fields, and all of ai when it
 * changed (an older Worker replaces ai whole).
 */
export const buildRegistryWorkerSync = ({
  nextConfig,
  patch,
  metadata,
  account,
}: {
  nextConfig: Config;
  patch: Config;
  metadata: Config;
  account: string;
}): Config => ({
  ...patch,
  ...buildWorkerSessionConfigPayload({
    sessionConfig: nextConfig,
    account,
    fallbackChainId: readRegistryFacts(nextConfig).chainId,
  }),
  ...(patch.ai ? { ai: metadata.ai } : {}),
  ...(patch.sessionModeProfile ? { storageProfile: metadata.storageProfile } : {}),
});
