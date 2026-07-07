import { normalizeLitMetadataNetwork, normalizeSessionNaming } from '../../utilities/session/sessionMetadata.js';
import { toStr } from '../../utilities/shared/primitives.js';
import { sessionRegistryUtils } from '../../utilities/web3/sessionRegistry.js';
import type { AnyRecord } from '../shellTypes';
import { resolveSessionWizardAutoFeatureBySessionSlug } from './sessionWizardAiConfig';
import { deepClone } from './sessionWizardCoreUtils';
import { isSecretFieldPath } from './sessionWizardGateUtils';
import { normalizeSessionWizardSlug } from './sessionWizardUrlSupport';

const isRecord = (value: unknown): value is AnyRecord => !!value && typeof value === 'object' && !Array.isArray(value);

export const normalizeSessionWizardDefaultFeaturedSbtMetadata = (value: unknown): string[] => {
  let entries: string[] = [];

  if (Array.isArray(value)) {
    entries = value
      .map((entry) => (typeof entry === 'string' ? entry : entry?.address || entry?.sbtAddress))
      .map((entry) => toStr(entry).trim())
      .filter(Boolean);
  } else if (typeof value === 'string') {
    entries = value
      .split(/[\n,]+/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  const seen = new Set<string>();
  return entries.filter((entry) => {
    const lower = entry.toLowerCase();
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });
};

export const resolveSessionWizardMetadataPayloadBase = ({
  draft = {},
  sessionId = '',
}: {
  draft?: AnyRecord | null;
  sessionId?: unknown;
} = {}): AnyRecord => {
  const metadata = normalizeSessionNaming(
    normalizeLitMetadataNetwork(deepClone(isRecord(draft) ? draft : {})),
  ) as AnyRecord;

  metadata.sessionName = toStr(metadata.sessionName || '').trim();
  metadata.sessionInfo = toStr(metadata.sessionInfo || '').trim();
  if (!metadata.sessionName) delete metadata.sessionName;
  if (!metadata.sessionInfo) delete metadata.sessionInfo;
  metadata.slug = normalizeSessionWizardSlug(metadata.slug);

  const resolvedAutoFeature = resolveSessionWizardAutoFeatureBySessionSlug(metadata);
  delete metadata.autoFeatureSBTsWithFeaturedSbtTags;
  if (resolvedAutoFeature !== undefined) {
    metadata.autoFeatureSBTsBySessionSlug = resolvedAutoFeature;
  }

  const formattedSessionId = sessionRegistryUtils.formatSessionId(sessionId);
  const sessionIdHex = sessionRegistryUtils.normalizeSessionIdHex(sessionId);
  metadata.sessionId = formattedSessionId || toStr(sessionId).trim() || '';
  if (sessionIdHex) {
    metadata.sessionIdHex = sessionIdHex;
  } else {
    delete metadata.sessionIdHex;
  }

  delete metadata.sponsoredSbtAddress;
  if (metadata.defaultFeaturedSBTs != null) {
    metadata.defaultFeaturedSBTs = normalizeSessionWizardDefaultFeaturedSbtMetadata(metadata.defaultFeaturedSBTs);
  }

  return metadata;
};

export const stripSessionWizardMetadataSecretFields = (metadata: AnyRecord): AnyRecord => {
  if (!isRecord(metadata)) return metadata;
  if (isRecord(metadata.ai)) {
    delete metadata.ai.providers;
    delete metadata.ai.mode;
    delete metadata.ai.provider;
  }
  if (isRecord(metadata.rpc)) {
    delete metadata.rpc;
  }
  if (isRecord(metadata.arweave)) {
    delete metadata.arweave;
  }
  if (isRecord(metadata.faucet)) {
    delete metadata.faucet.privateKey;
    delete metadata.faucet.encryptedPrivateKey;
  }
  if (isRecord(metadata.encryptedFields)) {
    Object.keys(metadata.encryptedFields).forEach((key) => {
      if (isSecretFieldPath(key.split('.'))) {
        delete metadata.encryptedFields[key];
      }
    });
  }
  if (isRecord(metadata.encryptedFieldGates)) {
    Object.keys(metadata.encryptedFieldGates).forEach((key) => {
      if (isSecretFieldPath(key.split('.'))) {
        delete metadata.encryptedFieldGates[key];
      }
    });
  }
  return metadata;
};

export const getSessionWizardMetadataSecretFieldGateKeys = (metadata: unknown): string[] => {
  if (!isRecord(metadata) || !isRecord(metadata.encryptedFieldGates)) return [];
  return Object.keys(metadata.encryptedFieldGates).filter((key) => isSecretFieldPath(key.split('.')));
};

export const buildSessionWizardSecretFieldGateErrorMessage = (keys: unknown): string => {
  const list = Array.isArray(keys) ? keys.map((key) => toStr(key).trim()).filter(Boolean) : [];
  const suffix = list.length ? `: ${list.join(', ')}.` : '.';
  return `Worker secret fields cannot be locked in public metadata${suffix} Store secrets in the Worker panel instead.`;
};

export const applySessionWizardMetadataUploadGuards = ({
  metadata,
  defaultGateId = '',
  gateSelections = {},
}: {
  metadata: AnyRecord;
  defaultGateId?: unknown;
  gateSelections?: AnyRecord | null;
}): AnyRecord => {
  const next = isRecord(metadata) ? metadata : {};
  const selections = isRecord(gateSelections) ? gateSelections : {};
  const secretFieldGateKeys = getSessionWizardMetadataSecretFieldGateKeys(next);
  if (secretFieldGateKeys.length) {
    throw new Error(buildSessionWizardSecretFieldGateErrorMessage(secretFieldGateKeys));
  }

  stripSessionWizardMetadataSecretFields(next);

  if (isRecord(next.lit)) {
    next.lit.defaultGateId = defaultGateId || next.lit.defaultGateId;
  }

  const existingSpendLimits = isRecord(next.perMemberSpendLimits) ? next.perMemberSpendLimits : {};
  next.perMemberSpendLimits = {
    ...existingSpendLimits,
    ai: selections.ai?.perMemberLimit || existingSpendLimits.ai || '',
    arweave: selections.arweave?.perMemberLimit || existingSpendLimits.arweave || '',
    txGas: selections.txGas?.perMemberLimit || existingSpendLimits.txGas || '',
  };

  return next;
};
