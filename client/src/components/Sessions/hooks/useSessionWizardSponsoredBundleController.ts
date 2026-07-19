import { useCallback, type Dispatch, type MutableRefObject, type RefObject, type SetStateAction } from 'react';
import { toStr } from '../../../utilities/shared/primitives.js';
import { resolveWorkerSecretsSnapshot } from '../sessionWizardSecrets.js';
import {
  DEFAULT_WORKER_SECRETS,
  resolveSessionWizardEnabledWorkerSecrets,
  sanitizeSessionWizardWorkerSecretsForLitMode,
} from '../sessionWizardWorkerSecretSupport';
import { deepClone } from '../sessionWizardCoreUtils';
import type { SessionWizardWorkerRequirementProof } from '../sessionWizardWorkerRequirementProof';
import useSponsoredBundleLifecycle from './useSponsoredBundleLifecycle';
import type { AnyRecord, WorkerSecretsLike } from '../../shellTypes';

type WorkerSecretsUpdateFn = (current: WorkerSecretsLike) => WorkerSecretsLike | AnyRecord | null | undefined;

type SponsoredBundleDeploymentStatePatch<TDeployForm> = {
  deployForm?: TDeployForm | AnyRecord;
  deployStatus?: string;
  deployInFlight?: boolean;
  deployComplete?: boolean;
  workerMode?: string;
  deployWorkerUrl?: string;
  workerRequirementProof?: SessionWizardWorkerRequirementProof | null;
  provisionedSponsoredContext?: AnyRecord;
  forceManualBundleFile?: boolean;
  normalModeBundleUrlOverride?: string;
  workerUrlAutoFilled?: boolean;
};

type SponsoredBundleWorkerSecretStatePatch = {
  workerSecretsEnabled?: boolean;
  persistWorkerSecrets?: boolean;
};

type SponsoredBundleControllerRefs<TDeployForm, TProvisionedSponsoredContext> = {
  draftRef: MutableRefObject<AnyRecord | null>;
  deployFormRef: MutableRefObject<TDeployForm | null>;
  deployCompleteRef: MutableRefObject<boolean>;
  deployWorkerUrlRef: MutableRefObject<string>;
  provisionedSponsoredContextRef: MutableRefObject<TProvisionedSponsoredContext | null>;
  workerSecretsEnabledRef: MutableRefObject<boolean>;
  persistWorkerSecretsRef: MutableRefObject<boolean>;
  workerSecretsRef: MutableRefObject<WorkerSecretsLike>;
  advancedBundleFileInputRef: RefObject<HTMLInputElement>;
  normalModeRetryBundleFileInputRef: RefObject<HTMLInputElement>;
  sponsoredPublishBundleFileInputRef: RefObject<HTMLInputElement>;
};

type UseSessionWizardSponsoredBundleControllerOptions<
  TDraft,
  TDeployForm extends AnyRecord,
  TProvisionedSponsoredContext extends AnyRecord,
> = {
  initialSponsoredBundleId?: string | null;
  initialSponsoredBundleKey?: string | null;
  draftSlug?: string | null;
  refs: SponsoredBundleControllerRefs<TDeployForm, TProvisionedSponsoredContext>;
  workerSecretsEnabled: boolean;
  setWorkerSecrets: Dispatch<SetStateAction<WorkerSecretsLike>>;
  setDraft: Dispatch<SetStateAction<TDraft>>;
  setDeployForm: Dispatch<SetStateAction<TDeployForm>>;
  setDeployStatus: Dispatch<SetStateAction<string>>;
  setDeployInFlight: Dispatch<SetStateAction<boolean>>;
  setDeployComplete: Dispatch<SetStateAction<boolean>>;
  setWorkerMode: Dispatch<SetStateAction<string>>;
  setDeployWorkerUrl: Dispatch<SetStateAction<string>>;
  setWorkerRequirementProof: Dispatch<SetStateAction<SessionWizardWorkerRequirementProof | null>>;
  setProvisionedSponsoredContext: Dispatch<SetStateAction<TProvisionedSponsoredContext>>;
  setForceManualBundleFile: Dispatch<SetStateAction<boolean>>;
  setNormalModeBundleUrlOverride: Dispatch<SetStateAction<string>>;
  setWorkerUrlAutoFilled: Dispatch<SetStateAction<boolean>>;
  setWorkerSecretsEnabled: Dispatch<SetStateAction<boolean>>;
  setPersistWorkerSecrets: Dispatch<SetStateAction<boolean>>;
  setBundleFile: Dispatch<SetStateAction<File | null>>;
  buildProvisionedSponsoredContextState: (value: unknown) => TProvisionedSponsoredContext;
};

const useSessionWizardSponsoredBundleController = <
  TDraft,
  TDeployForm extends AnyRecord,
  TProvisionedSponsoredContext extends AnyRecord,
>({
  initialSponsoredBundleId,
  initialSponsoredBundleKey,
  draftSlug,
  refs,
  workerSecretsEnabled,
  setWorkerSecrets,
  setDraft,
  setDeployForm,
  setDeployStatus,
  setDeployInFlight,
  setDeployComplete,
  setWorkerMode,
  setDeployWorkerUrl,
  setWorkerRequirementProof,
  setProvisionedSponsoredContext,
  setForceManualBundleFile,
  setNormalModeBundleUrlOverride,
  setWorkerUrlAutoFilled,
  setWorkerSecretsEnabled,
  setPersistWorkerSecrets,
  setBundleFile,
  buildProvisionedSponsoredContextState,
}: UseSessionWizardSponsoredBundleControllerOptions<TDraft, TDeployForm, TProvisionedSponsoredContext>) => {
  const {
    draftRef,
    deployFormRef,
    deployCompleteRef,
    deployWorkerUrlRef,
    provisionedSponsoredContextRef,
    workerSecretsEnabledRef,
    persistWorkerSecretsRef,
    workerSecretsRef,
    advancedBundleFileInputRef,
    normalModeRetryBundleFileInputRef,
    sponsoredPublishBundleFileInputRef,
  } = refs;

  const getCurrentWorkerSecrets = useCallback(
    () =>
      sanitizeSessionWizardWorkerSecretsForLitMode(
        resolveWorkerSecretsSnapshot({
          workerSecretsRef,
          defaults: DEFAULT_WORKER_SECRETS,
        }),
      ),
    [workerSecretsRef],
  );

  const getCurrentEnabledWorkerSecrets = useCallback(
    () =>
      resolveSessionWizardEnabledWorkerSecrets({
        workerSecrets: getCurrentWorkerSecrets(),
        workerSecretsEnabled,
      }),
    [getCurrentWorkerSecrets, workerSecretsEnabled],
  );

  const applyWorkerSecretsUpdate = useCallback(
    (nextValueOrUpdater: unknown) => {
      const current = resolveWorkerSecretsSnapshot({
        workerSecretsRef,
        defaults: DEFAULT_WORKER_SECRETS,
      });
      const nextValue =
        typeof nextValueOrUpdater === 'function'
          ? (nextValueOrUpdater as WorkerSecretsUpdateFn)(current)
          : nextValueOrUpdater;
      const next = sanitizeSessionWizardWorkerSecretsForLitMode({
        ...DEFAULT_WORKER_SECRETS,
        ...(nextValue && typeof nextValue === 'object' ? nextValue : {}),
      });
      workerSecretsRef.current = next;
      setWorkerSecrets(next);
      return next;
    },
    [setWorkerSecrets, workerSecretsRef],
  );

  const updateSponsoredBundleDraftCorsWorkerUrl = useCallback(
    (nextCorsWorkerUrl = '') => {
      setDraft((prev) => {
        const desiredWorkerUrl = toStr(nextCorsWorkerUrl || '').trim();
        const previousDraft = prev && typeof prev === 'object' ? prev : ({} as TDraft);
        if (toStr((previousDraft as AnyRecord)?.corsWorkerUrl || '').trim() === desiredWorkerUrl) return prev;
        const next = deepClone(previousDraft) as TDraft & { corsWorkerUrl?: string };
        next.corsWorkerUrl = desiredWorkerUrl;
        return next;
      });
    },
    [setDraft],
  );

  const updateSponsoredBundleDeploymentState = useCallback(
    ({
      deployForm: nextDeployForm,
      deployStatus: nextDeployStatus,
      deployInFlight: nextDeployInFlight,
      deployComplete: nextDeployComplete,
      workerMode: nextWorkerMode,
      deployWorkerUrl: nextDeployWorkerUrl,
      workerRequirementProof: nextWorkerRequirementProof,
      provisionedSponsoredContext: nextProvisionedSponsoredContext,
      forceManualBundleFile: nextForceManualBundleFile,
      normalModeBundleUrlOverride: nextNormalModeBundleUrlOverride,
      workerUrlAutoFilled: nextWorkerUrlAutoFilled,
    }: SponsoredBundleDeploymentStatePatch<TDeployForm> = {}) => {
      if (nextDeployForm !== undefined) {
        setDeployForm(nextDeployForm as TDeployForm);
      }
      if (typeof nextDeployStatus === 'string') {
        setDeployStatus(nextDeployStatus);
      }
      if (typeof nextDeployInFlight === 'boolean') {
        setDeployInFlight(nextDeployInFlight);
      }
      if (typeof nextDeployComplete === 'boolean') {
        setDeployComplete(nextDeployComplete);
      }
      if (typeof nextWorkerMode === 'string') {
        setWorkerMode(nextWorkerMode);
      }
      if (typeof nextDeployWorkerUrl === 'string') {
        setDeployWorkerUrl(nextDeployWorkerUrl);
      }
      if (nextWorkerRequirementProof !== undefined) {
        setWorkerRequirementProof(nextWorkerRequirementProof);
      }
      if (nextProvisionedSponsoredContext !== undefined) {
        setProvisionedSponsoredContext(buildProvisionedSponsoredContextState(nextProvisionedSponsoredContext));
      }
      if (typeof nextForceManualBundleFile === 'boolean') {
        setForceManualBundleFile(nextForceManualBundleFile);
      }
      if (typeof nextNormalModeBundleUrlOverride === 'string') {
        setNormalModeBundleUrlOverride(nextNormalModeBundleUrlOverride);
      }
      if (typeof nextWorkerUrlAutoFilled === 'boolean') {
        setWorkerUrlAutoFilled(nextWorkerUrlAutoFilled);
      }
    },
    [
      buildProvisionedSponsoredContextState,
      setDeployComplete,
      setDeployForm,
      setDeployInFlight,
      setDeployStatus,
      setDeployWorkerUrl,
      setWorkerRequirementProof,
      setForceManualBundleFile,
      setNormalModeBundleUrlOverride,
      setProvisionedSponsoredContext,
      setWorkerMode,
      setWorkerUrlAutoFilled,
    ],
  );

  const updateSponsoredBundleWorkerSecretState = useCallback(
    ({
      workerSecretsEnabled: nextWorkerSecretsEnabled,
      persistWorkerSecrets: nextPersistWorkerSecrets,
    }: SponsoredBundleWorkerSecretStatePatch = {}) => {
      if (typeof nextWorkerSecretsEnabled === 'boolean') {
        setWorkerSecretsEnabled(nextWorkerSecretsEnabled);
      }
      if (typeof nextPersistWorkerSecrets === 'boolean') {
        setPersistWorkerSecrets(nextPersistWorkerSecrets);
      }
    },
    [setPersistWorkerSecrets, setWorkerSecretsEnabled],
  );

  const sponsoredBundleLifecycle = useSponsoredBundleLifecycle({
    initialSponsoredBundleId,
    initialSponsoredBundleKey,
    draftSlug,
    refs: {
      draftRef,
      deployFormRef: deployFormRef as MutableRefObject<AnyRecord | null>,
      deployCompleteRef,
      deployWorkerUrlRef,
      provisionedSponsoredContextRef: provisionedSponsoredContextRef as MutableRefObject<AnyRecord | null>,
      workerSecretsEnabledRef,
      persistWorkerSecretsRef,
    },
    getCurrentWorkerSecrets,
    applyWorkerSecretsUpdate,
    updateDraftCorsWorkerUrl: updateSponsoredBundleDraftCorsWorkerUrl,
    updateDeploymentState: updateSponsoredBundleDeploymentState,
    updateWorkerSecretState: updateSponsoredBundleWorkerSecretState,
  });

  const clearSelectedBundleFile = useCallback(() => {
    setBundleFile(null);
    [
      advancedBundleFileInputRef.current,
      normalModeRetryBundleFileInputRef.current,
      sponsoredPublishBundleFileInputRef.current,
    ].forEach((input) => {
      if (input && typeof input.value === 'string') {
        input.value = '';
      }
    });
  }, [
    advancedBundleFileInputRef,
    normalModeRetryBundleFileInputRef,
    setBundleFile,
    sponsoredPublishBundleFileInputRef,
  ]);

  return {
    ...sponsoredBundleLifecycle,
    getCurrentWorkerSecrets,
    getCurrentEnabledWorkerSecrets,
    applyWorkerSecretsUpdate,
    updateSponsoredBundleDeploymentState,
    updateSponsoredBundleWorkerSecretState,
    updateSponsoredBundleDraftCorsWorkerUrl,
    clearSelectedBundleFile,
  };
};

export default useSessionWizardSponsoredBundleController;
