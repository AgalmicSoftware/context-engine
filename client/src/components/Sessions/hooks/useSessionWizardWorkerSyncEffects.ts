import { type Dispatch, type MutableRefObject, type SetStateAction, useEffect, useRef } from 'react';
import { normalizeBaseUrl } from '../../../utilities/urlUtils.js';
import { normalizeWorkerUrl as normalizeWorkerAuthUrl } from '../../../utilities/worker/workerAuth.js';
import { toStr } from '../../../utilities/shared/primitives.js';
import { NORMAL_MODE_SHARED_HOSTED_WORKER_ENABLED } from '../sessionWizardConfig';
import { getSessionWizardDefaultWorkerUrl } from '../sessionWizardWorkerDefaults';

type DeployFormLike = {
  adminAddress?: unknown;
  workerName?: unknown;
  [key: string]: unknown;
};

type UpdateDraftValueRef = MutableRefObject<null | ((path: string[], value: unknown) => void)>;

export interface UseSessionWizardWorkerSyncEffectsOptions<TDeployForm extends DeployFormLike> {
  account?: unknown;
  deployFormAdminAddress?: unknown;
  deployFormWorkerName?: unknown;
  setDeployForm: Dispatch<SetStateAction<TDeployForm>>;
  draftSessionName?: unknown;
  draftCorsWorkerUrl?: unknown;
  buildWorkerName: (value: unknown) => string;
  deployComplete: boolean;
  deployWorkerUrl?: unknown;
  setDeployComplete: Dispatch<SetStateAction<boolean>>;
  wizardMode: string;
  workerMode: string;
  setWorkerMode: Dispatch<SetStateAction<string>>;
  setWorkerUrlAutoFilled: Dispatch<SetStateAction<boolean>>;
  updateDraftValueRef: UpdateDraftValueRef;
}

const useSessionWizardWorkerSyncEffects = <TDeployForm extends DeployFormLike>({
  account,
  deployFormAdminAddress,
  deployFormWorkerName,
  setDeployForm,
  draftSessionName,
  draftCorsWorkerUrl,
  buildWorkerName,
  deployComplete,
  deployWorkerUrl,
  setDeployComplete,
  wizardMode,
  workerMode,
  setWorkerMode,
  setWorkerUrlAutoFilled,
  updateDraftValueRef,
}: UseSessionWizardWorkerSyncEffectsOptions<TDeployForm>) => {
  const buildWorkerNameRef = useRef(buildWorkerName);
  buildWorkerNameRef.current = buildWorkerName;

  useEffect(() => {
    const normalizedAccount = toStr(account).trim();
    if (normalizedAccount && !toStr(deployFormAdminAddress).trim()) {
      setDeployForm((prev) => ({ ...prev, adminAddress: normalizedAccount }));
    }
  }, [account, deployFormAdminAddress, setDeployForm]);

  useEffect(() => {
    const nextName = buildWorkerNameRef.current(draftSessionName || '');
    if (nextName && nextName !== deployFormWorkerName) {
      setDeployForm((prev) => ({ ...prev, workerName: nextName }));
    }
  }, [draftSessionName, deployFormWorkerName, setDeployForm]);

  useEffect(() => {
    const defaultUrl = getSessionWizardDefaultWorkerUrl();
    const current = toStr(draftCorsWorkerUrl).trim();
    if (current && defaultUrl && current !== defaultUrl) {
      setWorkerMode('custom');
    }
  }, [draftCorsWorkerUrl, setWorkerMode]);

  useEffect(() => {
    if (!deployComplete) return;
    const configured = normalizeBaseUrl(toStr(draftCorsWorkerUrl).trim());
    const deployed = normalizeBaseUrl(toStr(deployWorkerUrl).trim());
    if (!configured || !deployed || configured !== deployed) {
      setDeployComplete(false);
    }
  }, [draftCorsWorkerUrl, deployComplete, deployWorkerUrl, setDeployComplete]);

  useEffect(() => {
    if (wizardMode !== 'normal' || NORMAL_MODE_SHARED_HOSTED_WORKER_ENABLED) return;
    const fallbackUrl = normalizeWorkerAuthUrl(getSessionWizardDefaultWorkerUrl());
    const configuredUrl = normalizeWorkerAuthUrl(toStr(draftCorsWorkerUrl).trim());
    if (workerMode === 'default') {
      setWorkerMode('custom');
    }
    if (!deployComplete && configuredUrl && fallbackUrl && configuredUrl === fallbackUrl) {
      setWorkerUrlAutoFilled(false);
      updateDraftValueRef.current?.(['corsWorkerUrl'], '');
    }
  }, [
    wizardMode,
    workerMode,
    draftCorsWorkerUrl,
    deployComplete,
    setWorkerMode,
    setWorkerUrlAutoFilled,
    updateDraftValueRef,
  ]);
};

export default useSessionWizardWorkerSyncEffects;
