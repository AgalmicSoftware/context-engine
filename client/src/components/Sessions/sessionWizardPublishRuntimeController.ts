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
import type { AnyRecord, WorkerSecretsLike } from '../shellTypes';
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

type PublishRuntimeControllerOptions = {
  runtimeRef: RuntimeRef;
  dispatch: SessionPublishDispatch;
  getErrorMessage: SessionPublishErrorMessageReader;
  deployWorker: SessionWizardPublishControllerPorts['deployWorker'];
  deployPendingSbts: NonNullable<SessionWizardPublishControllerPorts['deployPendingSbts']>;
  getCurrentWorkerSecrets: () => WorkerSecretsLike;
  resolveWorkerBaseUrl: () => string;
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
  getCurrentWorkerSecrets,
  resolveWorkerBaseUrl,
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
  const runPreparation = async ({
    publishExecutionPlan,
    signerAccountOverride,
    runTrackedPublishEffect,
  }: RunPreparationInput): Promise<SessionWizardPublishControllerResult> => {
    const runEffect = createEffectRunner({ dispatch, getErrorMessage, runTrackedPublishEffect });
    return runSessionWizardPublishController({
      input: { publishExecutionPlan, signerAccountOverride },
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
              const runtime = runtimeRef.current || {};
              const draft = runtime.draft || {};
              const workerUrl =
                workerAuthPublishAdapter.normalizeWorkerUrl(toStr(workerUrlOverride).trim()) || resolveWorkerBaseUrl();
              const sessionId = toStr(runtime.sessionId).trim();
              const config = buildWorkerConfig({
                slug: draft.slug,
                draft,
                deployPayload: {
                  adminAddress: signerAccount,
                  rpcUrl: resolveWorkerRpcUrl(),
                  rpcUrlsByChainId: resolveWorkerRpcUrlMap(),
                  allowOrigins: parseAllowOriginsInput(),
                  limits: Number(runtime.workerLimitPerWallet || 0)
                    ? { perWalletPerDay: Number(runtime.workerLimitPerWallet) }
                    : {},
                  scopes: {},
                  embeddedDeployHelperEnabled: runtime.embeddedDeployHelperEnabled,
                },
                workerSecrets: getCurrentWorkerSecrets(),
                account: signerAccount,
                registryAddress: runtime.registryAddress,
                registryChainId: runtime.registryChainId,
                networkChainId: draft.networkChainId,
                sessionId,
                latestChainBlock: runtime.latestChainBlock,
                workerUrl,
                resolveWorkerFaucetConfig,
              });
              const verified = await persistWorkerConfig({
                workerUrl,
                slug: draft.slug,
                sessionId,
                adminAddress: signerAccount,
                config,
                signAdminAction: (input) => signTypedAdminAction({ ...input, accountOverride: signerAccount }),
              });
              return {
                workerUrl: verified.workerOrigin,
                configRevision: verified.configRevision,
                publicConfig: verified.publicConfig,
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
        run: () => handleRegisterGroup(registerStepRequest.registerGroupArgs),
      });
      if (publishExecutionPlan.shouldRefreshRegistryCache) {
        markSessionPublishEffectSucceeded(dispatch, 'refreshRegistryCache');
      }
      return;
    }

    const verifiedWorkerUrl = toStr(publishControllerResult.verifiedWorkerConfig?.workerUrl).trim();
    if (!verifiedWorkerUrl) {
      throw new Error('Worker-canonical publish requires verified worker config persistence.');
    }
    const runtime = runtimeRef.current || {};
    const workerSettlement = resolveSessionWizardWorkerPublishSuccessSettlementDescriptor({
      slug: runtime.draft?.slug,
      sessionId: runtime.sessionIdHex || runtime.sessionId,
      workerOrigin: verifiedWorkerUrl,
    });
    // Keep cache clearing ahead of identity rotation; reversing this can leak the published draft into the next session.
    callbacks.setSessionUrl(workerSettlement.sessionUrl);
    callbacks.setAdminUrl(workerSettlement.adminUrl);
    callbacks.setAdminUrlStatus(workerSettlement.adminUrlStatus);
    const settlementIdentity = {
      workerUrl: verifiedWorkerUrl,
      slug: toStr(runtime.draft?.slug).trim(),
      sessionId: toStr(runtime.sessionIdHex || runtime.sessionId).trim(),
    };
    callbacks.setWorkerCanonicalPublishSettled(settlementIdentity);
    requireSuccessfulDurableStorageOperation(
      callbacks.writeSessionWizardWorkerSettlement(settlementIdentity),
      'Could not durably record the published worker identity',
    );
    // Remote persistence is terminal. Record the per-identity marker before touching
    // the legacy singleton cache: if tombstone storage fails, the retained matching
    // draft can still discover this marker and reload in the terminal state.
    requireSuccessfulDurableStorageOperation(
      callbacks.clearSessionWizardCache({
        ...(Array.isArray(preservedPendingSbtDrafts) ? { preservedPendingSbtDrafts } : {}),
        workerSettlement: settlementIdentity,
      }),
      'Could not durably clear the published session draft',
    );
    callbacks.setSessionId(generateSessionId());
    callbacks.setSessionIdStatus(workerSettlement.nextSessionIdStatus);
  };

  return { runPreparation, settleRegistration };
};

export type { PublishExecutionPlan, RunTrackedPublishEffect };
