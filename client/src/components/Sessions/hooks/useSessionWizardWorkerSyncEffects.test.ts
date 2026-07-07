import { renderHook } from '@testing-library/react';
import { getSessionWizardDefaultWorkerUrl } from '../sessionWizardWorkerDefaults';
import useSessionWizardWorkerSyncEffects from './useSessionWizardWorkerSyncEffects.js';

type DeployFormState = {
  adminAddress?: unknown;
  workerName?: unknown;
};

const renderWorkerSync = (
  overrides: Partial<{
    account: unknown;
    deployFormAdminAddress: unknown;
    deployFormWorkerName: unknown;
    draftSessionName: unknown;
    draftCorsWorkerUrl: unknown;
    buildWorkerName: jest.Mock<string, [unknown]>;
    deployComplete: boolean;
    deployWorkerUrl: unknown;
    wizardMode: string;
    workerMode: string;
  }> = {},
) => {
  const setDeployForm = jest.fn();
  const setDeployComplete = jest.fn();
  const setWorkerMode = jest.fn();
  const setWorkerUrlAutoFilled = jest.fn();
  const updateDraftValue = jest.fn();
  const buildWorkerName = overrides.buildWorkerName || jest.fn(() => 'existing-worker');

  renderHook(() =>
    useSessionWizardWorkerSyncEffects<DeployFormState>({
      account: overrides.account ?? '',
      deployFormAdminAddress: overrides.deployFormAdminAddress,
      deployFormWorkerName: overrides.deployFormWorkerName ?? 'existing-worker',
      setDeployForm,
      draftSessionName: overrides.draftSessionName ?? '',
      draftCorsWorkerUrl: overrides.draftCorsWorkerUrl ?? '',
      buildWorkerName,
      deployComplete: overrides.deployComplete ?? false,
      deployWorkerUrl: overrides.deployWorkerUrl ?? '',
      setDeployComplete,
      wizardMode: overrides.wizardMode ?? 'advanced',
      workerMode: overrides.workerMode ?? 'custom',
      setWorkerMode,
      setWorkerUrlAutoFilled,
      updateDraftValueRef: { current: updateDraftValue },
    }),
  );

  return {
    buildWorkerName,
    setDeployComplete,
    setDeployForm,
    setWorkerMode,
    setWorkerUrlAutoFilled,
    updateDraftValue,
  };
};

describe('useSessionWizardWorkerSyncEffects', () => {
  it('fills the deploy admin address from the connected account when blank', () => {
    const { setDeployForm } = renderWorkerSync({
      account: '0xAdmin',
      deployFormAdminAddress: undefined,
    });

    expect(setDeployForm).toHaveBeenCalledTimes(1);
    const updater = setDeployForm.mock.calls[0][0];
    expect(updater({ workerName: 'existing-worker' })).toEqual({
      adminAddress: '0xAdmin',
      workerName: 'existing-worker',
    });
  });

  it('updates the derived worker name when it differs from the form value', () => {
    const buildWorkerName = jest.fn(() => 'next-worker');
    const { setDeployForm } = renderWorkerSync({
      buildWorkerName,
      deployFormWorkerName: 'old-worker',
      draftSessionName: 'Next Session',
    });

    expect(buildWorkerName).toHaveBeenCalledWith('Next Session');
    expect(setDeployForm).toHaveBeenCalledTimes(1);
    const updater = setDeployForm.mock.calls[0][0];
    expect(updater({ adminAddress: '0xAdmin', workerName: 'old-worker' })).toEqual({
      adminAddress: '0xAdmin',
      workerName: 'next-worker',
    });
  });

  it('switches to custom mode when the draft worker URL is not the default worker', () => {
    const { setWorkerMode } = renderWorkerSync({
      draftCorsWorkerUrl: 'https://custom-worker.example',
    });

    expect(setWorkerMode).toHaveBeenCalledWith('custom');
  });

  it('clears deploy completion when the deployed worker no longer matches the draft URL', () => {
    const { setDeployComplete } = renderWorkerSync({
      deployComplete: true,
      draftCorsWorkerUrl: 'https://configured-worker.example',
      deployWorkerUrl: 'https://deployed-worker.example',
    });

    expect(setDeployComplete).toHaveBeenCalledWith(false);
  });

  it('clears the shared fallback worker in normal mode when hosted worker sharing is disabled', () => {
    const defaultWorkerUrl = getSessionWizardDefaultWorkerUrl();
    expect(defaultWorkerUrl).toBeTruthy();

    const { setWorkerMode, setWorkerUrlAutoFilled, updateDraftValue } = renderWorkerSync({
      draftCorsWorkerUrl: defaultWorkerUrl,
      wizardMode: 'normal',
      workerMode: 'default',
    });

    expect(setWorkerMode).toHaveBeenCalledWith('custom');
    expect(setWorkerUrlAutoFilled).toHaveBeenCalledWith(false);
    expect(updateDraftValue).toHaveBeenCalledWith(['corsWorkerUrl'], '');
  });
});
