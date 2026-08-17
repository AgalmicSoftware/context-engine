import {
  buildSbtAccessControlConditions,
  getGlobalLitHooks,
  resolveLitChain,
} from '../../utilities/crypto/litProtocol.js';
import { cryptoUtils } from '../../utilities/crypto/cryptography.js';
import { getEffectiveArweaveKey } from '../../utilities/session/resourceKeys.js';
import { normalizeBlockLimitsForConfig } from '../../utilities/session/blockLimits.js';
import type { UnknownRecord } from '../../utilities/session/sessionTypes.js';
import { createLogger } from '../../utilities/logging';
import { toStr } from '../../utilities/shared/primitives.js';
import {
  arweavePublishAdapter,
  workerAuthPublishAdapter,
} from '../../domains/sessions/publish/sessionPublishAdapters.js';
import {
  SESSION_WIZARD_ONCHAIN_COMPAT_FIELD_PATHS,
  buildSessionWizardRegistrySessionFields,
  sanitizeSessionWizardMetadataPayload,
} from './sessionWizardWriteNormalization.js';
import {
  DEFAULT_AI_MODELS,
  normalizeAiModelForProvider,
  normalizeAiModels,
  normalizeAiProvider,
} from './sessionWizardAiConfig';
import { METADATA_FIELD_ORDER } from './sessionWizardConfig';
import { sanitizeSessionWizardContracts } from './sessionWizardContracts.js';
import { getSessionWizardErrorMessage } from './sessionWizardCoreUtils';
import { getOnChainFieldKeyForPath, getValueAtPath, isSecretFieldPath, setValueAtPath } from './sessionWizardGateUtils';
import {
  applySessionWizardMetadataUploadGuards,
  buildSessionWizardSecretFieldGateErrorMessage,
  resolveSessionWizardMetadataPayloadBase,
} from './sessionWizardMetadataPayload';
import { normalizeSessionWizardGateIds as normalizeGateIds } from './sessionWizardResourceGateSupport';
import { normalizeSbtSelection } from './sessionWizardSbtSelections';
import { resolveSessionHeaderImageFormat } from './sessionWizardUiSupport';
import {
  applySessionWizardModeFieldPolicyToPayload,
  resolveSessionWizardModeFieldPolicy,
} from './sessionWizardModeFieldPolicy';
import { resolveSessionWizardModeRequirements } from './sessionWizardModeRequirements';
import type { SessionHeaderFileState, SessionHeaderUploadStatusTone } from './hooks/useSessionHeaderPreview';
import type { ChainIdLike, NetworkLike, WorkerSecretsLike } from '../shellTypes';
import type { SessionModeProfile } from '../../utilities/session/sessionModeProfile';

type EncryptionGateState = UnknownRecord & {
  id: string;
  label?: string;
  color?: string;
  mode?: string;
  sbts?: unknown[];
};

type SessionWizardEncryptionRecipient = {
  accessControlConditions: unknown;
  chain: string;
};

type SessionWizardEncryptionQueueEntry = {
  key: string;
  gateIds: string[];
  path: string[];
  value: unknown;
  recipients: SessionWizardEncryptionRecipient[];
};

type SessionWizardArweaveUploadOptions = UnknownRecord & {
  arweaveJwk?: unknown;
  forceDirectArweaveUpload?: boolean;
  workerUrl?: string;
};

export type SessionWizardMetadataEncryptionResult = {
  metadata: UnknownRecord;
  encryptedFields?: UnknownRecord;
  onChainFields: UnknownRecord;
};

type SessionWizardMetadataPayloadBuilderRequest = {
  workerUrlOverride?: string;
  signerAccountOverride?: string;
};

type SessionWizardMetadataPayloadBuilderOptions = {
  account?: string;
  allEncryptionGates: EncryptionGateState[];
  buildSessionWizardPublishArweaveUploadOptions: (options: {
    arweaveJwk: string;
    workerUrl: string;
    sessionSlug?: string;
    authAccount: string;
  }) => Promise<SessionWizardArweaveUploadOptions>;
  buildSponsoredFlagFields: () => UnknownRecord;
  defaultGateId: string;
  draft: UnknownRecord;
  encryptedFieldGates: UnknownRecord;
  gateSelections: UnknownRecord;
  getCurrentWorkerSecrets: () => WorkerSecretsLike;
  getGateById: (gateId: unknown) => EncryptionGateState | null;
  latestChainBlock?: unknown;
  network?: NetworkLike;
  provider?: UnknownRecord | null;
  registryChainId?: ChainIdLike;
  resolveWorkerBaseUrl: () => string;
  resolvedWalletAccountRef: { current?: unknown };
  sessionHeaderFile?: SessionHeaderFileState | null;
  sessionHeaderMode: string;
  sessionId: unknown;
  setSessionHeaderStatus: (message: string, tone?: SessionHeaderUploadStatusTone) => void;
  toggleLoginModal?: ((open?: boolean) => void) | null;
  workerSecretsEnabled: boolean;
};

const log = createLogger('general');
const ONCHAIN_FIELD_PATHS = SESSION_WIZARD_ONCHAIN_COMPAT_FIELD_PATHS as Readonly<Record<string, string[]>>;
const ONCHAIN_FIELD_KEYS = new Set(Object.keys(SESSION_WIZARD_ONCHAIN_COMPAT_FIELD_PATHS));

export const buildSessionWizardMetadataPayloadBuilder = ({
  account,
  allEncryptionGates,
  buildSessionWizardPublishArweaveUploadOptions,
  buildSponsoredFlagFields,
  defaultGateId,
  draft,
  encryptedFieldGates,
  gateSelections,
  getCurrentWorkerSecrets,
  getGateById,
  latestChainBlock,
  network,
  provider,
  registryChainId,
  resolveWorkerBaseUrl,
  resolvedWalletAccountRef,
  sessionHeaderFile,
  sessionHeaderMode,
  sessionId,
  setSessionHeaderStatus,
  toggleLoginModal,
  workerSecretsEnabled,
}: SessionWizardMetadataPayloadBuilderOptions) => {
  const applyEncryption = async (metadata: UnknownRecord): Promise<SessionWizardMetadataEncryptionResult> => {
    const encryptedKeys = Object.keys(encryptedFieldGates || {}).filter((key) => key !== 'slug');
    const onChainFields: UnknownRecord = {};
    delete metadata.encryptedFields;
    delete metadata.encryptedFieldGates;
    delete metadata.encryption;
    delete metadata.sessionInfoEncrypted;
    if (!encryptedKeys.length) {
      ONCHAIN_FIELD_KEYS.forEach((fieldKey) => {
        const path = ONCHAIN_FIELD_PATHS[fieldKey] || fieldKey.split('.');
        const value = getValueAtPath(metadata, path);
        if (value != null && value !== '') {
          onChainFields[fieldKey] = value;
        }
      });
      return { metadata, onChainFields };
    }

    const chainId = Number(metadata.networkChainId || registryChainId || network?.id || 0) || null;
    const litChain = resolveLitChain({ chainId });

    const encryptedFields: UnknownRecord = {};
    const encryptedFieldGatesOut: UnknownRecord = {};
    const encryptionQueue: SessionWizardEncryptionQueueEntry[] = [];
    for (const key of encryptedKeys) {
      const selectedGateIds = normalizeGateIds(encryptedFieldGates[key] ?? encryptedFieldGates?.[key])
        .map((id) => toStr(id).trim())
        .filter(Boolean);
      if (!selectedGateIds.length) continue;
      const path = key.split('.');
      if (isSecretFieldPath(path)) {
        throw new Error(buildSessionWizardSecretFieldGateErrorMessage([key]));
      }
      const value = getValueAtPath(metadata, path);
      if (value == null || value === '') continue;

      const recipients: SessionWizardEncryptionRecipient[] = [];
      const appliedGateIds: string[] = [];

      for (const gateId of selectedGateIds) {
        const gate = getGateById(gateId);
        if (!gate) continue;
        const sbtAddresses = normalizeSbtSelection(gate.sbts || [])
          .map((s) => s.address)
          .filter(Boolean);
        if (!sbtAddresses.length) {
          if (typeof console !== 'undefined') {
            log.warn('[lit][encrypt] skipping gate without SBTs', { key, gateId });
          }
          continue;
        }
        const accessControlConditions = buildSbtAccessControlConditions({
          sbtAddresses,
          chainId,
          litChain,
          mode: gate.mode,
        });
        if (!accessControlConditions) continue;
        recipients.push({ accessControlConditions, chain: litChain });
        appliedGateIds.push(gateId);
      }

      if (!recipients.length) continue;

      encryptionQueue.push({
        key,
        gateIds: appliedGateIds,
        path,
        value,
        recipients,
      });
    }

    if (!encryptionQueue.length) {
      ONCHAIN_FIELD_KEYS.forEach((fieldKey) => {
        const path = ONCHAIN_FIELD_PATHS[fieldKey] || fieldKey.split('.');
        const value = getValueAtPath(metadata, path);
        if (value != null && value !== '') {
          onChainFields[fieldKey] = value;
        }
      });
      metadata.encryptedFields = encryptedFields;
      metadata.encryptedFieldGates = encryptedFieldGatesOut;
      return { metadata, onChainFields };
    }

    if (!account) {
      if (toggleLoginModal) toggleLoginModal(true);
      throw new Error('Connect a wallet to encrypt fields.');
    }
    const hooks = getGlobalLitHooks();
    if (!hooks || typeof hooks.saveKey !== 'function') {
      throw new Error('Lit hooks not initialized.');
    }

    if (typeof console !== 'undefined') {
      const litNetwork = hooks?.litNetwork || null;
      log.info('[lit][encrypt] start', {
        fields: encryptionQueue.length,
        chainId,
        litChain,
        litNetwork,
      });
    }

    for (const entry of encryptionQueue) {
      const { key, gateIds, path, value, recipients } = entry;
      let envelope;
      try {
        if (typeof console !== 'undefined') {
          log.info('[lit][encrypt] field start', {
            key,
            gateIds,
            chainId,
            litChain,
            litNetwork: hooks?.litNetwork || null,
            recipientCount: Array.isArray(recipients) ? recipients.length : 0,
          });
        }
        envelope = await cryptoUtils.encryptEnvelopeValue(value, {
          providerLike: provider,
          account,
          chainId,
          contextLabel: `group:${metadata.slug || 'group'}:${key}`,
          lit: {
            saveKey: hooks.saveKey,
            accessControlConditions: recipients?.[0]?.accessControlConditions,
            chain: recipients?.[0]?.chain || litChain,
            recipients,
          },
        });
      } catch (err) {
        if (typeof console !== 'undefined') {
          log.error('[lit][encrypt] field failed', {
            key,
            gateIds,
            chainId,
            litChain,
            litNetwork: hooks?.litNetwork || null,
            message: getSessionWizardErrorMessage(err),
          });
        }
        throw err;
      }

      const onChainFieldKey = getOnChainFieldKeyForPath(path);
      const skipEncryptedFields = path.length === 1 && path[0] === 'sessionInfo';
      if (path.length === 1 && path[0] === 'sessionInfo') {
        metadata.sessionInfoEncrypted = envelope;
        setValueAtPath(metadata, path, '');
      } else {
        setValueAtPath(metadata, path, '');
      }
      if (onChainFieldKey) {
        onChainFields[onChainFieldKey] = envelope;
      } else if (!skipEncryptedFields) {
        encryptedFields[key] = envelope;
      }
      const cleanGateIds = Array.isArray(gateIds) ? gateIds.map((id) => toStr(id).trim()).filter(Boolean) : [];
      if (cleanGateIds.length === 1) {
        encryptedFieldGatesOut[key] = cleanGateIds[0];
      } else if (cleanGateIds.length > 1) {
        encryptedFieldGatesOut[key] = cleanGateIds;
      }
    }

    ONCHAIN_FIELD_KEYS.forEach((fieldKey) => {
      if (Object.prototype.hasOwnProperty.call(onChainFields, fieldKey)) return;
      const path = ONCHAIN_FIELD_PATHS[fieldKey] || fieldKey.split('.');
      const value = getValueAtPath(metadata, path);
      if (value != null && value !== '') {
        onChainFields[fieldKey] = value;
      }
    });

    metadata.encryptedFields = encryptedFields;
    metadata.encryptedFieldGates = encryptedFieldGatesOut;
    const gatesById = allEncryptionGates.reduce<Record<string, UnknownRecord>>((acc, gate) => {
      const sbtAddresses = normalizeSbtSelection(gate.sbts || [])
        .map((s) => s.address)
        .filter(Boolean);
      acc[gate.id] = {
        type: 'sbt',
        sbtAddresses,
        mode: gate.mode,
        chainId,
        litChain,
        color: gate.color,
        label: gate.label,
      };
      return acc;
    }, {});
    const gateIds = allEncryptionGates.map((gate) => gate.id);
    const gateCounts: Record<string, number> = {};
    Object.values(encryptedFieldGatesOut || {}).forEach((value) => {
      if (!value) return;
      const ids = Array.isArray(value) ? value : [value];
      ids.forEach((id) => {
        const gateId = toStr(id).trim();
        if (!gateId) return;
        gateCounts[gateId] = (gateCounts[gateId] || 0) + 1;
      });
    });
    let primaryGateId = gateIds[0] || '';
    if (primaryGateId) {
      gateIds.forEach((id) => {
        if ((gateCounts[id] || 0) > (gateCounts[primaryGateId] || 0)) {
          primaryGateId = id;
        }
      });
    }
    const encryptionMetadata: UnknownRecord = { gates: gatesById };
    if (primaryGateId && gatesById[primaryGateId]) {
      encryptionMetadata.gate = gatesById[primaryGateId];
    }
    metadata.encryption = encryptionMetadata;

    return { metadata, encryptedFields, onChainFields };
  };

  return async ({
    workerUrlOverride = '',
    signerAccountOverride = '',
  }: SessionWizardMetadataPayloadBuilderRequest = {}): Promise<SessionWizardMetadataEncryptionResult> => {
    const metadata = resolveSessionWizardMetadataPayloadBase({
      draft,
      sessionId,
    });
    const modeRequirements = resolveSessionWizardModeRequirements(
      metadata.sessionModeProfile as SessionModeProfile | undefined,
    );
    if (modeRequirements.selected) {
      applySessionWizardModeFieldPolicyToPayload(metadata, resolveSessionWizardModeFieldPolicy(modeRequirements));
    }
    const authAccount = toStr(signerAccountOverride || resolvedWalletAccountRef.current || account).trim();
    if (sessionHeaderMode === 'upload') {
      if (sessionHeaderFile) {
        setSessionHeaderStatus('Uploading header image…', 'loading');
        const format = resolveSessionHeaderImageFormat(sessionHeaderFile);
        if (!format) {
          throw new Error('Unsupported header image format. Use png, jpg, jpeg, or gif.');
        }
        let arweaveJwk = toStr(getCurrentWorkerSecrets().arweaveJwk).trim();
        if (!arweaveJwk && !workerSecretsEnabled) {
          const resolved = await getEffectiveArweaveKey({
            sessionConfig: metadata,
            sessionSlug: metadata.slug || '',
            context: {
              account: authAccount,
              providerLike: provider,
              chainId: metadata.networkChainId || registryChainId,
            },
          });
          arweaveJwk = resolved?.arweaveJwk || '';
        }
        const headerRequestId = `arw_header_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const baseUrl =
          workerAuthPublishAdapter.normalizeWorkerUrl(toStr(workerUrlOverride).trim()) || resolveWorkerBaseUrl();
        const uploadAuthOptions = await buildSessionWizardPublishArweaveUploadOptions({
          arweaveJwk,
          workerUrl: baseUrl,
          sessionSlug: toStr(metadata.slug).trim(),
          authAccount,
        });
        log.info('[arweave][ui] header upload start', {
          requestId: headerRequestId,
          workerUrl: uploadAuthOptions.forceDirectArweaveUpload ? null : uploadAuthOptions.workerUrl || null,
          sessionSlug: metadata.slug || '',
          adminAddress: null,
          hasJwk: !!uploadAuthOptions.arweaveJwk,
          ts: new Date().toISOString(),
        });
        let headerTxId: string | undefined;
        try {
          headerTxId = (await arweavePublishAdapter.uploadDataToArweave({
            data: sessionHeaderFile,
            format,
            options: {
              sessionConfig: metadata,
              sessionSlug: metadata.slug || '',
              context: {
                account: authAccount,
                providerLike: provider,
                chainId: metadata.networkChainId || registryChainId,
              },
              requestId: headerRequestId,
              ...uploadAuthOptions,
            },
          })) as string;
        } catch (err) {
          log.error('[arweave][ui] header upload error', {
            requestId: headerRequestId,
            message: getSessionWizardErrorMessage(err),
            ts: new Date().toISOString(),
          });
          throw err;
        }
        log.info('[arweave][ui] header upload success', {
          requestId: headerRequestId,
          txId: headerTxId,
          ts: new Date().toISOString(),
        });
        metadata.sessionHeader = `ar://${headerTxId}`;
        setSessionHeaderStatus('Header image uploaded.');
      } else {
        metadata.sessionHeader = '';
      }
    } else {
      setSessionHeaderStatus('');
    }
    const normalizedBlockLimits = normalizeBlockLimitsForConfig(metadata.blockLimits, latestChainBlock);
    if (normalizedBlockLimits) {
      metadata.blockLimits = normalizedBlockLimits;
    }
    applySessionWizardMetadataUploadGuards({
      metadata,
      defaultGateId,
      gateSelections,
    });
    const result = await applyEncryption(metadata);
    result.metadata = sanitizeSessionWizardMetadataPayload(result.metadata, {
      fieldOrder: METADATA_FIELD_ORDER,
      sanitizeContracts: sanitizeSessionWizardContracts,
      normalizeAiProvider,
      normalizeAiModels: (raw, fallbackProvider = 'openai', transcription) =>
        normalizeAiModels(raw, fallbackProvider, transcription as UnknownRecord | null | undefined),
      normalizeAiModelForProvider,
      defaultAiModels: DEFAULT_AI_MODELS,
    });
    const sponsoredFields = buildSponsoredFlagFields();
    result.onChainFields = buildSessionWizardRegistrySessionFields({
      onChainFields: result.onChainFields,
      sponsoredFields,
    });
    return { ...result };
  };
};
