import sha256 from 'crypto-js/sha256';
import { toStr } from '../../utilities/shared/primitives.js';
import { normalizeOriginList } from '../../utilities/urlUtils.js';
import type { SessionModeProfile } from '../../utilities/session/sessionModeProfile';
import type { AnyRecord, WorkerSecretsLike } from '../shellTypes';
import { normalizeAiModels, normalizeAiProvider } from './sessionWizardAiConfig';
import { resolveSessionWizardModeRequirements } from './sessionWizardModeRequirements';
import { resolveSessionWizardResourceSecretFields } from './sessionWizardResourceConfig';
import { CHIPOTLE_LIT_CONFIG_FIELDS } from './sessionWizardWorkerSecretSupport';
import { normalizeSessionWizardSlug, normalizeSessionWizardWorkerUrl } from './sessionWizardUrlSupport';

const PROOF_VERSION = 1 as const;
const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;
const LIT_SECRET_FIELDS = Object.freeze(['litAccountApiKey', 'litUsageApiKey']);
const RPC_SECRET_FIELDS = Object.freeze(['customRpcUrl', 'customRpcKey']);

export type SessionWizardWorkerRequirementProof = {
  version: typeof PROOF_VERSION;
  secretFingerprintSalt: string;
  workerIdentityFingerprint: string;
  requirementsFingerprint: string;
  requiredSecretFields: string[];
  secretValueFingerprints: Record<string, string>;
  remoteManagedSecretFields: string[];
  litRuntimeFingerprint: string;
  workerConfigFingerprint?: string;
};

type RequirementContext = {
  sessionModeProfile?: SessionModeProfile | null;
  sessionAi?: unknown;
  workerAllowOrigins?: unknown;
};

type WorkerIdentityInput = {
  workerUrl?: unknown;
  sessionSlug?: unknown;
  sessionId?: unknown;
};

type SecretSelectionInput = RequirementContext & {
  workerSecrets?: WorkerSecretsLike | AnyRecord;
  fallbackRequiredSecretFields?: readonly string[];
};

type BuildProofInput = RequirementContext &
  WorkerIdentityInput & {
    workerSecrets?: WorkerSecretsLike | AnyRecord;
    requiredSecretFields?: readonly string[];
    remoteManagedSecretFields?: readonly string[];
    litRuntimeConfig?: WorkerSecretsLike | AnyRecord;
    workerConfig?: unknown;
  };

const SERVER_MANAGED_WORKER_CONFIG_FIELDS = new Set([
  'authzEpoch',
  'configRevision',
  'workerCanonicalPublicationRevision',
  'workerGroupsBootstrap',
]);

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value as AnyRecord)
    .sort()
    .reduce<AnyRecord>((result, key) => {
      const entry = (value as AnyRecord)[key];
      if (entry !== undefined) result[key] = canonicalize(entry);
      return result;
    }, {});
};

const fingerprint = (namespace: string, value: unknown): string =>
  sha256(`${namespace}:${JSON.stringify(canonicalize(value))}`).toString();

const createSecretFingerprintSalt = (): string => {
  try {
    const crypto = globalThis.crypto;
    if (!crypto || typeof crypto.getRandomValues !== 'function') return '';
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  } catch (_) {
    return '';
  }
};

const normalizeFieldList = (fields: readonly string[] = []): string[] =>
  Array.from(new Set(fields.map((field) => toStr(field).trim()).filter(Boolean))).sort();

const normalizeWorkerAllowOrigins = (value: unknown): string[] => {
  const entries = (Array.isArray(value) ? value : toStr(value).split(/[\n,]+/))
    .map((entry) => toStr(entry).trim())
    .filter(Boolean);
  return Array.from(new Set(normalizeOriginList(entries))).sort();
};

const uniqueFieldList = (fields: readonly string[] = []): string[] =>
  Array.from(new Set(fields.map((field) => toStr(field).trim()).filter(Boolean)));

const normalizeSessionId = (value: unknown): string => {
  const normalized = toStr(value).trim().toLowerCase().replace(/-/g, '');
  if (/^[a-f0-9]{32}$/.test(normalized)) return `0x${normalized}`;
  return /^0x[a-f0-9]{32}$/.test(normalized) ? normalized : '';
};

const buildWorkerConfigFingerprint = (value: unknown): string => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const source = value as AnyRecord;
  const normalized = Object.keys(source)
    .sort()
    .reduce<AnyRecord>((result, field) => {
      if (SERVER_MANAGED_WORKER_CONFIG_FIELDS.has(field)) return result;
      const entry = source[field];
      if (field === 'adminAddress' || field === 'registryAddress') {
        result[field] = toStr(entry).trim().toLowerCase();
      } else if (field === 'sessionId') {
        result[field] = normalizeSessionId(entry);
      } else if (field === 'corsWorkerUrl') {
        result[field] = normalizeSessionWizardWorkerUrl(entry);
      } else if (field === 'allowOrigins') {
        result[field] = normalizeWorkerAllowOrigins(entry);
      } else {
        result[field] = canonicalize(entry);
      }
      return result;
    }, {});
  return fingerprint('context-engine:worker-config:v1', normalized);
};

const normalizeLitRuntimeConfig = (value: unknown): Record<string, string> => {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? (value as AnyRecord) : {};
  return CHIPOTLE_LIT_CONFIG_FIELDS.reduce<Record<string, string>>((result, field) => {
    result[field] = toStr(source[field]).trim();
    return result;
  }, {});
};

const buildWorkerIdentityFingerprint = ({ workerUrl, sessionSlug, sessionId }: WorkerIdentityInput): string => {
  const identity = {
    workerUrl: normalizeSessionWizardWorkerUrl(workerUrl),
    sessionSlug: normalizeSessionWizardSlug(sessionSlug),
    sessionId: normalizeSessionId(sessionId),
  };
  return Object.values(identity).every(Boolean)
    ? fingerprint('context-engine:worker-requirement-identity:v1', identity)
    : '';
};

const normalizeAiModelAssignments = (value: unknown): Record<string, { provider: string; model: string }> => {
  const ai = value && typeof value === 'object' && !Array.isArray(value) ? (value as AnyRecord) : {};
  const fallbackProvider = normalizeAiProvider(ai.mode || ai.provider || 'openai');
  const models = normalizeAiModels(
    ai.models && typeof ai.models === 'object' ? (ai.models as AnyRecord) : {},
    fallbackProvider,
    ai.transcription && typeof ai.transcription === 'object' ? (ai.transcription as AnyRecord) : undefined,
  );
  return ['fast', 'thinking', 'transcription'].reduce<Record<string, { provider: string; model: string }>>(
    (result, key) => {
      const assignment =
        models[key] && typeof models[key] === 'object' && !Array.isArray(models[key]) ? (models[key] as AnyRecord) : {};
      result[key] = {
        provider: normalizeAiProvider(assignment.provider, key === 'transcription' ? 'openai' : fallbackProvider),
        model: toStr(assignment.model).trim(),
      };
      return result;
    },
    {},
  );
};

const buildRequirementsFingerprint = ({
  sessionModeProfile,
  sessionAi,
  workerAllowOrigins,
}: RequirementContext): string => {
  const requirements = resolveSessionWizardModeRequirements(sessionModeProfile);
  const selectedAiSecretFields = resolveSessionWizardResourceSecretFields('ai', sessionAi).map((field) => field.key);
  return fingerprint('context-engine:worker-requirements:v1', {
    authorityMode: requirements.authorityMode,
    isWorkerCanonical: requirements.isWorkerCanonical,
    requiredRequirementIds: [...requirements.requiredRequirementIds].sort(),
    requiresArweave: requirements.requiresArweave,
    requiresLit: requirements.requiresLit,
    requiresRpc: requirements.requiresRpc,
    selectedAiSecretFields: normalizeFieldList(selectedAiSecretFields),
    workerAllowOrigins: normalizeWorkerAllowOrigins(workerAllowOrigins),
    // Bind the complete canonical profile and effective provider/model choices.
    // Broad requirement flags alone cannot distinguish edits that reuse the same secrets.
    sessionModeProfile: canonicalize(sessionModeProfile || null),
    aiModelAssignments: normalizeAiModelAssignments(sessionAi),
  });
};

const pickPresentFields = (fields: readonly string[], secrets: AnyRecord): string[] =>
  fields.filter((field) => !!toStr(secrets[field]).trim());

export const resolveSessionWizardWorkerSecretSelection = ({
  sessionModeProfile,
  sessionAi,
  workerAllowOrigins,
  workerSecrets = {},
  fallbackRequiredSecretFields = [],
}: SecretSelectionInput = {}) => {
  const requirements = resolveSessionWizardModeRequirements(sessionModeProfile);
  const secrets = workerSecrets && typeof workerSecrets === 'object' ? (workerSecrets as AnyRecord) : {};
  const fallbackFields = new Set(normalizeFieldList(fallbackRequiredSecretFields));
  const selectedAiSecretFields = resolveSessionWizardResourceSecretFields('ai', sessionAi).map((field) => field.key);
  const includeFaucetPrivateKey =
    requirements.requiresFunding &&
    (!!toStr(secrets.faucetPrivateKey).trim() || fallbackFields.has('faucetPrivateKey'));
  const requiredSecretFields = requirements.usesWorkerRuntime
    ? uniqueFieldList([
        ...selectedAiSecretFields,
        ...(requirements.requiresArweave && (toStr(secrets.arweaveJwk).trim() || fallbackFields.has('arweaveJwk'))
          ? ['arweaveJwk']
          : []),
        ...(requirements.requiresLit
          ? pickPresentFields(LIT_SECRET_FIELDS, secrets).length
            ? pickPresentFields(LIT_SECRET_FIELDS, secrets)
            : LIT_SECRET_FIELDS.filter((field) => fallbackFields.has(field))
          : []),
        ...(requirements.requiresRpc
          ? uniqueFieldList([
              ...pickPresentFields(RPC_SECRET_FIELDS, secrets),
              ...RPC_SECRET_FIELDS.filter((field) => fallbackFields.has(field)),
            ])
          : []),
        ...(includeFaucetPrivateKey ? ['faucetPrivateKey'] : []),
      ])
    : [];
  const selectedSecrets = requirements.usesWorkerRuntime
    ? requiredSecretFields.reduce<Record<string, string>>((result, field) => {
        const value = toStr(secrets[field]).trim();
        if (value) result[field] = value;
        return result;
      }, {})
    : Object.entries(secrets).reduce<Record<string, string>>((result, [field, rawValue]) => {
        const value = toStr(rawValue).trim();
        if (value) result[field] = value;
        return result;
      }, {});
  return {
    requirements,
    requirementsFingerprint: buildRequirementsFingerprint({ sessionModeProfile, sessionAi, workerAllowOrigins }),
    requiredSecretFields,
    selectedSecrets,
  };
};

const normalizeProof = (value: unknown): SessionWizardWorkerRequirementProof | null => {
  const proof = value && typeof value === 'object' && !Array.isArray(value) ? (value as AnyRecord) : {};
  if (
    proof.version !== PROOF_VERSION ||
    !FINGERPRINT_PATTERN.test(toStr(proof.secretFingerprintSalt)) ||
    !FINGERPRINT_PATTERN.test(toStr(proof.workerIdentityFingerprint)) ||
    !FINGERPRINT_PATTERN.test(toStr(proof.requirementsFingerprint)) ||
    !Array.isArray(proof.requiredSecretFields) ||
    !proof.secretValueFingerprints ||
    typeof proof.secretValueFingerprints !== 'object' ||
    Array.isArray(proof.secretValueFingerprints)
  ) {
    return null;
  }
  const requiredSecretFields = normalizeFieldList(proof.requiredSecretFields as string[]);
  const secretValueFingerprints = requiredSecretFields.reduce<Record<string, string>>((result, field) => {
    const valueFingerprint = toStr((proof.secretValueFingerprints as AnyRecord)[field]).trim();
    if (FINGERPRINT_PATTERN.test(valueFingerprint)) result[field] = valueFingerprint;
    return result;
  }, {});
  if (Object.keys(secretValueFingerprints).length !== requiredSecretFields.length) return null;
  const litRuntimeFingerprint = toStr(proof.litRuntimeFingerprint).trim();
  if (litRuntimeFingerprint && !FINGERPRINT_PATTERN.test(litRuntimeFingerprint)) return null;
  const workerConfigFingerprint = toStr(proof.workerConfigFingerprint).trim();
  if (workerConfigFingerprint && !FINGERPRINT_PATTERN.test(workerConfigFingerprint)) return null;
  const remoteManagedSecretFields = normalizeFieldList(
    Array.isArray(proof.remoteManagedSecretFields) ? (proof.remoteManagedSecretFields as string[]) : [],
  ).filter((field) => requiredSecretFields.includes(field));
  return {
    version: PROOF_VERSION,
    secretFingerprintSalt: toStr(proof.secretFingerprintSalt),
    workerIdentityFingerprint: toStr(proof.workerIdentityFingerprint),
    requirementsFingerprint: toStr(proof.requirementsFingerprint),
    requiredSecretFields,
    secretValueFingerprints,
    remoteManagedSecretFields,
    litRuntimeFingerprint,
    ...(workerConfigFingerprint ? { workerConfigFingerprint } : {}),
  };
};

export const buildSessionWizardWorkerRequirementProof = ({
  workerUrl,
  sessionSlug,
  sessionId,
  sessionModeProfile,
  sessionAi,
  workerAllowOrigins,
  workerSecrets = {},
  requiredSecretFields,
  remoteManagedSecretFields = [],
  litRuntimeConfig = {},
  workerConfig,
}: BuildProofInput = {}): SessionWizardWorkerRequirementProof | null => {
  const workerIdentityFingerprint = buildWorkerIdentityFingerprint({ workerUrl, sessionSlug, sessionId });
  const secretFingerprintSalt = createSecretFingerprintSalt();
  if (!workerIdentityFingerprint || !secretFingerprintSalt) return null;
  const selection = resolveSessionWizardWorkerSecretSelection({
    sessionModeProfile,
    sessionAi,
    workerAllowOrigins,
    workerSecrets,
    fallbackRequiredSecretFields: requiredSecretFields,
  });
  const normalizedRequiredFields = normalizeFieldList(requiredSecretFields || selection.requiredSecretFields);
  if (!selection.requirements.usesWorkerRuntime) return null;
  const secretValues = workerSecrets && typeof workerSecrets === 'object' ? (workerSecrets as AnyRecord) : {};
  const secretValueFingerprints = normalizedRequiredFields.reduce<Record<string, string>>((result, field) => {
    const value = toStr(secretValues[field]).trim();
    if (value) {
      result[field] = fingerprint('context-engine:worker-requirement-secret:v1', {
        secretFingerprintSalt,
        workerIdentityFingerprint,
        field,
        value,
      });
    }
    return result;
  }, {});
  if (Object.keys(secretValueFingerprints).length !== normalizedRequiredFields.length) return null;
  const normalizedLitRuntime = normalizeLitRuntimeConfig(litRuntimeConfig);
  const litRuntimeComplete = CHIPOTLE_LIT_CONFIG_FIELDS.every((field) => !!normalizedLitRuntime[field]);
  if (selection.requirements.requiresLit && !litRuntimeComplete) return null;
  return normalizeProof({
    version: PROOF_VERSION,
    secretFingerprintSalt,
    workerIdentityFingerprint,
    requirementsFingerprint: selection.requirementsFingerprint,
    requiredSecretFields: normalizedRequiredFields,
    secretValueFingerprints,
    remoteManagedSecretFields,
    litRuntimeFingerprint: selection.requirements.requiresLit
      ? fingerprint('context-engine:worker-requirement-lit-runtime:v1', normalizedLitRuntime)
      : '',
    workerConfigFingerprint: buildWorkerConfigFingerprint(workerConfig),
  });
};

export const resolveSessionWizardWorkerRequirementReadiness = ({
  proof: rawProof,
  workerUrl,
  sessionSlug,
  sessionId,
  sessionModeProfile,
  sessionAi,
  workerAllowOrigins,
  workerSecrets = {},
  workerSecretsEnabled = true,
  workerConfig,
}: BuildProofInput & {
  proof?: unknown;
  workerSecretsEnabled?: boolean;
} = {}): { verified: boolean; reason: string } => {
  const proof = normalizeProof(rawProof);
  if (!proof) return { verified: false, reason: 'missing-proof' };
  if (buildWorkerIdentityFingerprint({ workerUrl, sessionSlug, sessionId }) !== proof.workerIdentityFingerprint) {
    return { verified: false, reason: 'worker-identity-changed' };
  }
  const selection = resolveSessionWizardWorkerSecretSelection({
    sessionModeProfile,
    sessionAi,
    workerAllowOrigins,
    workerSecrets,
    fallbackRequiredSecretFields: proof.requiredSecretFields,
  });
  if (selection.requirementsFingerprint !== proof.requirementsFingerprint) {
    return { verified: false, reason: 'requirements-changed' };
  }
  const currentWorkerConfigFingerprint = buildWorkerConfigFingerprint(workerConfig);
  if (
    (proof.workerConfigFingerprint || currentWorkerConfigFingerprint) &&
    (!proof.workerConfigFingerprint || proof.workerConfigFingerprint !== currentWorkerConfigFingerprint)
  ) {
    return { verified: false, reason: 'worker-config-changed' };
  }
  if (
    JSON.stringify(normalizeFieldList(selection.requiredSecretFields)) !== JSON.stringify(proof.requiredSecretFields)
  ) {
    return { verified: false, reason: 'requirements-changed' };
  }
  if (!workerSecretsEnabled && proof.requiredSecretFields.length) {
    return { verified: false, reason: 'secret-values-changed' };
  }
  const secrets = workerSecrets && typeof workerSecrets === 'object' ? (workerSecrets as AnyRecord) : {};
  const secretValuesMatch = proof.requiredSecretFields.every((field) => {
    const value = toStr(secrets[field]).trim();
    if (!value) return proof.remoteManagedSecretFields.includes(field);
    return (
      fingerprint('context-engine:worker-requirement-secret:v1', {
        secretFingerprintSalt: proof.secretFingerprintSalt,
        workerIdentityFingerprint: proof.workerIdentityFingerprint,
        field,
        value,
      }) === proof.secretValueFingerprints[field]
    );
  });
  if (!secretValuesMatch) return { verified: false, reason: 'secret-values-changed' };
  if (selection.requirements.requiresLit) {
    const normalizedLitRuntime = normalizeLitRuntimeConfig(secrets);
    if (!CHIPOTLE_LIT_CONFIG_FIELDS.every((field) => !!normalizedLitRuntime[field])) {
      return { verified: false, reason: 'lit-runtime-changed' };
    }
    if (
      fingerprint('context-engine:worker-requirement-lit-runtime:v1', normalizedLitRuntime) !==
      proof.litRuntimeFingerprint
    ) {
      return { verified: false, reason: 'lit-runtime-changed' };
    }
  }
  return { verified: true, reason: '' };
};
