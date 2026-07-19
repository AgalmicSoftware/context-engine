import sha256 from 'crypto-js/sha256';
import { toStr } from '../../utilities/shared/primitives.js';
import type { SessionModeProfile } from '../../utilities/session/sessionModeProfile';
import type { AnyRecord, WorkerSecretsLike } from '../shellTypes';
import type { SessionWizardWorkerDeployRuntime } from './hooks/useSessionWizardWorkerDeploy';
import {
  resolveSessionWizardWorkerRequirementReadiness,
  type SessionWizardWorkerRequirementProof,
} from './sessionWizardWorkerRequirementProof';
import { normalizeSessionWizardWorkerUrl } from './sessionWizardUrlSupport';

export type SessionWizardWorkerPublishEvidence = {
  verified: boolean;
  reason: string;
  workerUrl: string;
  runtime: SessionWizardWorkerDeployRuntime;
  draft: AnyRecord;
  workerSecrets: WorkerSecretsLike;
  settlementIdentity: {
    workerUrl: string;
    slug: string;
    sessionId: string;
  };
  publishInputFingerprint: string;
};

const cloneRecord = <T extends AnyRecord>(value: T): T => JSON.parse(JSON.stringify(value || {})) as T;

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

const buildPublishInputFingerprint = ({
  runtime,
  draft,
  workerSecrets,
  workerUrl,
  proof,
}: {
  runtime: SessionWizardWorkerDeployRuntime;
  draft: AnyRecord;
  workerSecrets: WorkerSecretsLike;
  workerUrl: string;
  proof?: SessionWizardWorkerRequirementProof | null;
}): string =>
  sha256(
    `context-engine:worker-publish-input:v1:${JSON.stringify(
      canonicalize({
        workerUrl,
        draft,
        workerSecrets,
        proof: proof || null,
        runtime: {
          deployComplete: runtime.deployComplete === true,
          deployWorkerUrl: normalizeSessionWizardWorkerUrl(runtime.deployWorkerUrl),
          embeddedDeployHelperEnabled: runtime.embeddedDeployHelperEnabled,
          latestChainBlock: runtime.latestChainBlock,
          registryAddress: toStr(runtime.registryAddress).trim(),
          registryChainId: Number(runtime.registryChainId || 0) || 0,
          sessionId: toStr(runtime.sessionId).trim(),
          sessionIdHex: toStr(runtime.sessionIdHex).trim(),
          workerLimitPerWallet: Number(runtime.workerLimitPerWallet || 0) || 0,
          workerMode: runtime.workerMode || '',
          workerSecretsEnabled: runtime.workerSecretsEnabled !== false,
        },
      }),
    )}`,
  ).toString();

export const matchesSessionWizardWorkerPublishEvidence = (
  expected: SessionWizardWorkerPublishEvidence | null | undefined,
  current: SessionWizardWorkerPublishEvidence | null | undefined,
): boolean =>
  !!expected?.verified &&
  !!current?.verified &&
  !!expected.publishInputFingerprint &&
  expected.publishInputFingerprint === current.publishInputFingerprint;

export const resolveSessionWizardWorkerPublishEvidence = ({
  runtime,
  proof = runtime?.workerRequirementProof,
  workerSecrets = {},
  deployComplete = runtime?.deployComplete === true,
  deployWorkerUrl = runtime?.deployWorkerUrl || '',
  defaultWorkerUrl = '',
}: {
  runtime?: SessionWizardWorkerDeployRuntime | null;
  proof?: SessionWizardWorkerRequirementProof | null;
  workerSecrets?: WorkerSecretsLike;
  deployComplete?: boolean;
  deployWorkerUrl?: unknown;
  defaultWorkerUrl?: unknown;
} = {}): SessionWizardWorkerPublishEvidence | null => {
  if (!runtime?.draft || typeof runtime.draft !== 'object') return null;
  const draft = cloneRecord(runtime.draft as AnyRecord);
  const secrets = cloneRecord(workerSecrets as AnyRecord) as WorkerSecretsLike;
  const configuredWorkerUrl = normalizeSessionWizardWorkerUrl(draft.corsWorkerUrl);
  const normalizedDefaultWorkerUrl = normalizeSessionWizardWorkerUrl(defaultWorkerUrl);
  const deployedWorkerUrl = normalizeSessionWizardWorkerUrl(deployWorkerUrl);
  const customWorkerSelected = runtime.workerMode !== 'default';
  const workerUrl = customWorkerSelected ? deployedWorkerUrl : configuredWorkerUrl || normalizedDefaultWorkerUrl;
  if (!workerUrl) return null;
  const runtimeSnapshot = { ...runtime, draft };
  const settlementIdentity = {
    workerUrl,
    slug: toStr(draft.slug).trim(),
    sessionId: toStr(runtime.sessionIdHex || runtime.sessionId).trim(),
  };
  const publishInputFingerprint = buildPublishInputFingerprint({
    runtime: runtimeSnapshot,
    draft,
    workerSecrets: secrets,
    workerUrl,
    proof,
  });
  const evidenceSnapshot = {
    workerUrl,
    runtime: runtimeSnapshot,
    draft,
    workerSecrets: secrets,
    settlementIdentity,
    publishInputFingerprint,
  };
  if (customWorkerSelected && (!deployComplete || !deployedWorkerUrl || configuredWorkerUrl !== deployedWorkerUrl)) {
    return { verified: false, reason: 'worker-identity-changed', ...evidenceSnapshot };
  }
  if (!customWorkerSelected && (!normalizedDefaultWorkerUrl || workerUrl !== normalizedDefaultWorkerUrl)) {
    return { verified: false, reason: 'default-worker-changed', ...evidenceSnapshot };
  }
  if (customWorkerSelected) {
    const readiness = resolveSessionWizardWorkerRequirementReadiness({
      proof,
      workerUrl,
      sessionSlug: draft.slug,
      sessionId: runtime.sessionIdHex || runtime.sessionId,
      sessionModeProfile: draft.sessionModeProfile as SessionModeProfile,
      sessionAi: draft.ai,
      workerSecrets: secrets,
      workerSecretsEnabled: runtime.workerSecretsEnabled !== false,
    });
    if (!readiness.verified) {
      return { ...readiness, ...evidenceSnapshot };
    }
  }
  return {
    verified: true,
    reason: '',
    ...evidenceSnapshot,
  };
};
