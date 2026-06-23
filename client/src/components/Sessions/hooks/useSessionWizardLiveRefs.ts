import { useEffect, type MutableRefObject } from 'react';
import { toStr } from '../../../utilities/shared/primitives.js';

export interface UseSessionWizardLiveRefsOptions<
  TDraft = unknown,
  TDeployForm = unknown,
  TProvisionedSponsoredContext = unknown,
  TWorkerSecrets = unknown,
> {
  draft: TDraft;
  draftRef: MutableRefObject<TDraft>;
  deployForm: TDeployForm;
  deployFormRef: MutableRefObject<TDeployForm>;
  account?: unknown;
  resolvedWalletAccountRef: MutableRefObject<string>;
  deployComplete: boolean;
  deployCompleteRef: MutableRefObject<boolean>;
  deployWorkerUrl: string;
  deployWorkerUrlRef: MutableRefObject<string>;
  provisionedSponsoredContext: TProvisionedSponsoredContext;
  provisionedSponsoredContextRef: MutableRefObject<TProvisionedSponsoredContext>;
  workerSecretsEnabled: boolean;
  workerSecretsEnabledRef: MutableRefObject<boolean>;
  persistWorkerSecrets: boolean;
  persistWorkerSecretsRef: MutableRefObject<boolean>;
  workerSecrets: TWorkerSecrets;
  workerSecretsRef: MutableRefObject<TWorkerSecrets>;
}

const useSessionWizardLiveRefs = <
  TDraft = unknown,
  TDeployForm = unknown,
  TProvisionedSponsoredContext = unknown,
  TWorkerSecrets = unknown,
>({
  draft,
  draftRef,
  deployForm,
  deployFormRef,
  account,
  resolvedWalletAccountRef,
  deployComplete,
  deployCompleteRef,
  deployWorkerUrl,
  deployWorkerUrlRef,
  provisionedSponsoredContext,
  provisionedSponsoredContextRef,
  workerSecretsEnabled,
  workerSecretsEnabledRef,
  persistWorkerSecrets,
  persistWorkerSecretsRef,
  workerSecrets,
  workerSecretsRef,
}: UseSessionWizardLiveRefsOptions<TDraft, TDeployForm, TProvisionedSponsoredContext, TWorkerSecrets>) => {
  useEffect(() => {
    draftRef.current = draft;
  }, [draft, draftRef]);

  useEffect(() => {
    deployFormRef.current = deployForm;
  }, [deployForm, deployFormRef]);

  useEffect(() => {
    const normalizedAccount = toStr(account).trim();
    if (normalizedAccount) {
      resolvedWalletAccountRef.current = normalizedAccount;
    }
  }, [account, resolvedWalletAccountRef]);

  useEffect(() => {
    deployCompleteRef.current = deployComplete;
  }, [deployComplete, deployCompleteRef]);

  useEffect(() => {
    deployWorkerUrlRef.current = deployWorkerUrl;
  }, [deployWorkerUrl, deployWorkerUrlRef]);

  useEffect(() => {
    provisionedSponsoredContextRef.current = provisionedSponsoredContext;
  }, [provisionedSponsoredContext, provisionedSponsoredContextRef]);

  useEffect(() => {
    workerSecretsEnabledRef.current = workerSecretsEnabled;
  }, [workerSecretsEnabled, workerSecretsEnabledRef]);

  useEffect(() => {
    persistWorkerSecretsRef.current = persistWorkerSecrets;
  }, [persistWorkerSecrets, persistWorkerSecretsRef]);

  useEffect(() => {
    workerSecretsRef.current = workerSecrets;
  }, [workerSecrets, workerSecretsRef]);
};

export default useSessionWizardLiveRefs;
