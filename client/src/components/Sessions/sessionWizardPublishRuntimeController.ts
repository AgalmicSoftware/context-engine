import sha256 from 'crypto-js/sha256';
import { toStr } from '../../utilities/shared/primitives.js';
import { workerAuthPublishAdapter } from '../../domains/sessions/publish/sessionPublishAdapters.js';
import {
  markSessionPublishEffectSucceeded,
  runSessionPublishEffect,
  type SessionPublishDispatch,
  type SessionPublishEffectRunnerArgs,
  type SessionPublishErrorMessageReader,
} from '../../domains/sessions/publish/sessionPublishDispatch.js';
import type { SessionPublishEffect } from '../../domains/sessions/publish/sessionPublishReducer.js';
import type { AnyRecord } from '../shellTypes';
import type { SessionWizardWorkerDeployRuntime } from './hooks/useSessionWizardWorkerDeploy';
import {
  resolveSessionWizardRegisterStepRequest,
  resolveSessionWizardWorkerPublishSuccessSettlementDescriptor,
  runSessionWizardPublishController,
  type SessionWizardPublishControllerPorts,
  type SessionWizardPublishControllerResult,
  type SessionWizardPublishExecutionPlanLike,
  type SessionWizardRegisterGroupArgs,
} from './sessionWizardPublishController';
import { buildSessionWizardWorkerConfigPayload } from './sessionWizardWriteNormalization';
import {
  persistAndVerifySessionWizardWorkerConfig,
  type SessionWizardWorkerConfigSignInput,
} from './sessionWizardWorkerConfigPersistence';
import type { SessionWizardWorkerSettlementInput } from './sessionWizardWorkerSettlement';
import {
  matchesSessionWizardWorkerPublishEvidence,
  type SessionWizardWorkerPublishEvidence,
} from './sessionWizardWorkerPublishEvidence';

type RuntimeRef = {
  current: SessionWizardWorkerDeployRuntime | null;
};

type PublishExecutionPlan = SessionWizardPublishExecutionPlanLike & {
  shouldRegisterSession?: boolean;
  shouldRefreshRegistryCache?: boolean;
};

type RunTrackedPublishEffect = <Result>(effect: SessionPublishEffect, run: () => Promise<Result>) => Promise<Result>;

type PublishRuntimeCallbacks = {
  setSessionUrl: (value: string) => unknown;
  setAdminUrl: (value: string) => unknown;
  setAdminUrlStatus: (value: string) => unknown;
  setWorkerCanonicalPublishSettled: (value: SessionWizardWorkerSettlementInput | false) => unknown;
  clearSessionWizardCache: (options?: {
    preservedPendingSbtDrafts?: AnyRecord[];
    workerSettlement?: SessionWizardWorkerSettlementInput | null;
  }) => unknown;
  writeSessionWizardWorkerSettlement: (input: SessionWizardWorkerSettlementInput) => unknown;
  setSessionId: (value: string) => unknown;
  setSessionIdStatus: (value: string) => unknown;
};

const requireSuccessfulDurableStorageOperation = (result: unknown, message: string): void => {
  if (result && typeof result === 'object' && (result as { ok?: unknown }).ok === true) return;
  const status =
    result && typeof result === 'object' && 'status' in result
      ? toStr((result as { status?: unknown }).status).trim()
      : '';
  throw new Error(status ? `${message} (${status}).` : `${message}.`);
};

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

const hasSameCanonicalValue = (left: unknown, right: unknown): boolean =>
  JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));

const fingerprintCanonicalValue = (value: unknown): string =>
  sha256(`context-engine:worker-publish-config:v1:${JSON.stringify(canonicalize(value))}`).toString();

type PublishRuntimeControllerOptions = {
  runtimeRef: RuntimeRef;
  dispatch: SessionPublishDispatch;
  getErrorMessage: SessionPublishErrorMessageReader;
  deployWorker: SessionWizardPublishControllerPorts['deployWorker'];
  deployPendingSbts: NonNullable<SessionWizardPublishControllerPorts['deployPendingSbts']>;
  getWorkerPublishEvidence?: (input: { workerUrlOverride?: string }) => SessionWizardWorkerPublishEvidence | null;
  resolveWorkerRpcUrl: () => string;
  resolveWorkerRpcUrlMap: () => Record<string, string[]>;
  parseAllowOriginsInput: () => string[];
  resolveWorkerFaucetConfig: () => AnyRecord;
  signTypedAdminAction: (input: SessionWizardWorkerConfigSignInput & { accountOverride: string }) => Promise<AnyRecord>;
  handleRegisterGroup: (args?: SessionWizardRegisterGroupArgs) => Promise<unknown>;
  generateSessionId: () => string;
  callbacks: PublishRuntimeCallbacks;
  buildWorkerConfig?: typeof buildSessionWizardWorkerConfigPayload;
  persistWorkerConfig?: typeof persistAndVerifySessionWizardWorkerConfig;
};

type RunPreparationInput = {
  publishAllowed?: boolean;
  publishExecutionPlan: PublishExecutionPlan;
  signerAccountOverride: string;
  runTrackedPublishEffect: RunTrackedPublishEffect;
};

type SettleRegistrationInput = {
  preservedPendingSbtDrafts?: AnyRecord[];
  publishExecutionPlan: PublishExecutionPlan;
  uploadResult: AnyRecord | null;
  publishControllerResult: SessionWizardPublishControllerResult;
  runTrackedPublishEffect: RunTrackedPublishEffect;
};

const createEffectRunner =
  ({
    dispatch,
    getErrorMessage,
    runTrackedPublishEffect,
  }: {
    dispatch: SessionPublishDispatch;
    getErrorMessage: SessionPublishErrorMessageReader;
    runTrackedPublishEffect: RunTrackedPublishEffect;
  }) =>
  <Result>({
    effect,
    run,
    result,
  }: Pick<SessionPublishEffectRunnerArgs<Result>, 'effect' | 'run' | 'result'>): Promise<Result> =>
    runSessionPublishEffect({
      dispatch,
      effect,
      getErrorMessage,
      run: () => runTrackedPublishEffect(effect, run),
      result,
    });

export const createSessionWizardPublishRuntimeController = ({
  runtimeRef,
  dispatch,
  getErrorMessage,
  deployWorker,
  deployPendingSbts,
  getWorkerPublishEvidence = () => null,
  resolveWorkerRpcUrl,
  resolveWorkerRpcUrlMap,
  parseAllowOriginsInput,
  resolveWorkerFaucetConfig,
  signTypedAdminAction,
  handleRegisterGroup,
  generateSessionId,
  callbacks,
  buildWorkerConfig = buildSessionWizardWorkerConfigPayload,
  persistWorkerConfig = persistAndVerifySessionWizardWorkerConfig,
}: PublishRuntimeControllerOptions) => {
  const buildConfigForEvidence = ({
    evidence,
    signerAccount,
    workerUrl,
  }: {
    evidence: SessionWizardWorkerPublishEvidence;
    signerAccount: string;
    workerUrl: string;
  }): AnyRecord => {
    const evidenceRuntime = evidence.runtime;
    const evidenceDraft = evidence.draft;
    return buildWorkerConfig({
      slug: evidenceDraft.slug,
      draft: evidenceDraft,
      deployPayload: {
        adminAddress: signerAccount,
        rpcUrl: resolveWorkerRpcUrl(),
        rpcUrlsByChainId: resolveWorkerRpcUrlMap(),
        allowOrigins: parseAllowOriginsInput(),
        limits: Number(evidenceRuntime.workerLimitPerWallet || 0)
          ? { perWalletPerDay: Number(evidenceRuntime.workerLimitPerWallet) }
          : {},
        scopes: {},
        embeddedDeployHelperEnabled: evidenceRuntime.embeddedDeployHelperEnabled,
      },
      workerSecrets: evidence.workerSecrets,
      account: signerAccount,
      registryAddress: evidenceRuntime.registryAddress,
      registryChainId: evidenceRuntime.registryChainId,
      networkChainId: evidenceDraft.networkChainId,
      sessionId: toStr(evidenceRuntime.sessionId).trim(),
      latestChainBlock: evidenceRuntime.latestChainBlock,
      workerUrl,
      resolveWorkerFaucetConfig,
    });
  };

  const runPreparation = async ({
    publishAllowed = false,
    publishExecutionPlan,
    signerAccountOverride,
    runTrackedPublishEffect,
  }: RunPreparationInput): Promise<SessionWizardPublishControllerResult> => {
    const runEffect = createEffectRunner({ dispatch, getErrorMessage, runTrackedPublishEffect });
    return runSessionWizardPublishController({
      input: { publishAllowed, publishExecutionPlan, signerAccountOverride },
      ports: {
        deployWorker: () =>
          runEffect({
            effect: 'deployWorker',
            run: deployWorker,
            result: (result) => ({ workerUrl: result?.workerUrl || '' }),
          }),
        deployPendingSbts: (args) =>
          runEffect({
            effect: 'deployPendingSbts',
            run: () => deployPendingSbts(args),
            result: (drafts) => ({ deployedPendingSbtCount: drafts?.length || 0 }),
          }),
        persistWorkerConfig: ({ workerUrlOverride, signerAccountOverride: signerAccount }) =>
          runEffect({
            effect: 'persistWorkerConfig',
            run: async () => {
              // Keep worker-only reads lazy; eager RPC/secret resolution changes which requirements unrelated plans observe.
              const evidence = getWorkerPublishEvidence({ workerUrlOverride });
              if (!evidence?.verified) {
                throw new Error('Worker deployment requirements changed. Reverify the selected worker before publishing.');
              }
              const runtime = evidence.runtime;
              const draft = evidence.draft;
              const workerUrl =
                workerAuthPublishAdapter.normalizeWorkerUrl(toStr(workerUrlOverride).trim()) || evidence.workerUrl;
              if (!workerUrl || workerUrl !== workerAuthPublishAdapter.normalizeWorkerUrl(evidence.workerUrl)) {
                throw new Error('Worker deployment identity changed. Reverify the selected worker before publishing.');
              }
              const sessionId = toStr(runtime.sessionId).trim();
              const config = buildConfigForEvidence({ evidence, signerAccount, workerUrl });
              const verified = await persistWorkerConfig({
                workerUrl,
                slug: draft.slug,
                sessionId,
                adminAddress: signerAccount,
                config,
                signAdminAction: (input) => signTypedAdminAction({ ...input, accountOverride: signerAccount }),
              });
              const liveEvidence = getWorkerPublishEvidence({ workerUrlOverride: verified.workerOrigin });
              // The remote write is terminal, so never clear local state unless the
              // readback still belongs to the exact draft, identity, profile, AI, and secrets that initiated it.
              if (!liveEvidence || !matchesSessionWizardWorkerPublishEvidence(evidence, liveEvidence)) {
                throw new Error('Session inputs changed while worker config was being verified. Review and publish again.');
              }
              const liveConfig = buildConfigForEvidence({ evidence: liveEvidence, signerAccount, workerUrl });
              if (!hasSameCanonicalValue(config, liveConfig)) {
                throw new Error('Session config inputs changed while worker config was being verified. Review and publish again.');
              }
              return {
                workerUrl: verified.workerOrigin,
                configRevision: verified.configRevision,
                publicConfig: verified.publicConfig,
                workerPublishEvidence: evidence,
                workerConfigFingerprint: fingerprintCanonicalValue(config),
                signerAccount,
              };
            },
            result: (verified) => ({ workerUrl: verified.workerUrl || '' }),
          }),
      },
      callbacks: { setPublishStep: () => {} },
    });
  };

  const settleRegistration = async ({
    preservedPendingSbtDrafts,
    publishExecutionPlan,
    uploadResult,
    publishControllerResult,
    runTrackedPublishEffect,
  }: SettleRegistrationInput): Promise<void> => {
    const runEffect = createEffectRunner({ dispatch, getErrorMessage, runTrackedPublishEffect });
    if (publishExecutionPlan.shouldRegisterSession) {
      const registerStepRequest = resolveSessionWizardRegisterStepRequest({ publishExecutionPlan, uploadResult });
      await runEffect({
        effect: 'registerSession',
        run: () =>
          handleRegisterGroup({
            ...registerStepRequest.registerGroupArgs,
            ...(Array.isArray(preservedPendingSbtDrafts) ? { preservedPendingSbtDrafts } : {}),
          }),
      });
      if (publishExecutionPlan.shouldRefreshRegistryCache) {
        markSessionPublishEffectSucceeded(dispatch, 'refreshRegistryCache');
      }
      return;
    }

    const verifiedWorkerConfig = publishControllerResult.verifiedWorkerConfig;
    const verifiedWorkerUrl = toStr(verifiedWorkerConfig?.workerUrl).trim();
    const workerPublishEvidence = verifiedWorkerConfig?.workerPublishEvidence;
    const settlementIdentity = workerPublishEvidence?.settlementIdentity;
    if (
      !verifiedWorkerConfig ||
      !verifiedWorkerUrl ||
      !workerPublishEvidence?.verified ||
      !settlementIdentity ||
      settlementIdentity.workerUrl !== verifiedWorkerUrl ||
      !settlementIdentity.slug ||
      !settlementIdentity.sessionId
    ) {
      throw new Error('Worker-canonical publish requires verified worker config persistence.');
    }
    const liveEvidence = getWorkerPublishEvidence({ workerUrlOverride: verifiedWorkerUrl });
    if (!liveEvidence || !matchesSessionWizardWorkerPublishEvidence(workerPublishEvidence, liveEvidence)) {
      throw new Error('Session inputs changed before worker publication could settle. Review and publish again.');
    }
    const liveConfig = buildConfigForEvidence({
      evidence: liveEvidence,
      signerAccount: toStr(verifiedWorkerConfig.signerAccount).trim(),
      workerUrl: verifiedWorkerUrl,
    });
    if (
      !verifiedWorkerConfig.workerConfigFingerprint ||
      fingerprintCanonicalValue(liveConfig) !== verifiedWorkerConfig.workerConfigFingerprint
    ) {
      throw new Error('Session config inputs changed before worker publication could settle. Review and publish again.');
    }
    const workerSettlement = resolveSessionWizardWorkerPublishSuccessSettlementDescriptor({
      slug: settlementIdentity.slug,
      sessionId: settlementIdentity.sessionId,
      workerOrigin: verifiedWorkerUrl,
    });
    // Keep cache clearing ahead of identity rotation; reversing this can leak the published draft into the next session.
    callbacks.setSessionUrl(workerSettlement.sessionUrl);
    callbacks.setAdminUrl(workerSettlement.adminUrl);
    callbacks.setAdminUrlStatus(workerSettlement.adminUrlStatus);
    const durableSettlementIdentity = {
      workerUrl: verifiedWorkerUrl,
      slug: settlementIdentity.slug,
      sessionId: settlementIdentity.sessionId,
    };
    callbacks.setWorkerCanonicalPublishSettled(durableSettlementIdentity);
    requireSuccessfulDurableStorageOperation(
      callbacks.writeSessionWizardWorkerSettlement(durableSettlementIdentity),
      'Could not durably record the published worker identity',
    );
    // Remote persistence is terminal. Record the per-identity marker before touching
    // the legacy singleton cache: if tombstone storage fails, the retained matching
    // draft can still discover this marker and reload in the terminal state.
    requireSuccessfulDurableStorageOperation(
      callbacks.clearSessionWizardCache({
        ...(Array.isArray(preservedPendingSbtDrafts) ? { preservedPendingSbtDrafts } : {}),
        workerSettlement: durableSettlementIdentity,
      }),
      'Could not durably clear the published session draft',
    );
    callbacks.setSessionId(generateSessionId());
    callbacks.setSessionIdStatus(workerSettlement.nextSessionIdStatus);
  };

  return { runPreparation, settleRegistration };
};

export type { PublishExecutionPlan, RunTrackedPublishEffect };
