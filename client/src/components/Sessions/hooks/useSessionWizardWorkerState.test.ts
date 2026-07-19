import { act, renderHook } from '@testing-library/react';
import useSessionWizardWorkerState from './useSessionWizardWorkerState.js';

type ProvisionedSponsoredContext = {
  sessionSlug: string;
  workerUrl: string;
  fields: Record<string, unknown>;
};

const buildProvisionedSponsoredContextState = jest.fn((value: unknown): ProvisionedSponsoredContext => {
  const context = value && typeof value === 'object' ? (value as Partial<ProvisionedSponsoredContext>) : {};

  return {
    sessionSlug: context.sessionSlug || '',
    workerUrl: context.workerUrl || '',
    fields: context.fields || {},
  };
});

const renderWorkerState = (overrides = {}) =>
  renderHook(() =>
    useSessionWizardWorkerState<ProvisionedSponsoredContext>({
      cachedWizard: null,
      deployHelperUrlDefault: 'https://deploy-helper.example',
      workerBundleUrlDefault: 'https://bundle.example/session-worker.js',
      devPersistWorkerSecrets: true,
      defaultAllowedOrigins: 'http://localhost:3010\nhttp://127.0.0.1:3010',
      buildProvisionedSponsoredContextState,
      ...overrides,
    }),
  );

describe('useSessionWizardWorkerState', () => {
  beforeEach(() => {
    buildProvisionedSponsoredContextState.mockClear();
  });

  it('initializes deploy and worker defaults without cached wizard state', () => {
    const { result } = renderWorkerState();

    expect(result.current.workerMode).toBe('default');
    expect(result.current.workerSecretsEnabled).toBe(true);
    expect(result.current.persistWorkerSecrets).toBe(true);
    expect(result.current.deployHelperUrl).toBe('https://deploy-helper.example');
    expect(result.current.deployForm).toEqual({
      apiToken: '',
      workerName: '',
      adminAddress: undefined,
      bundleUrl: 'https://bundle.example/session-worker.js',
    });
    expect(result.current.bundleMode).toBe('url');
    expect(result.current.deployStatus).toBe('');
    expect(result.current.deployInFlight).toBe(false);
    expect(result.current.deployComplete).toBe(false);
    expect(result.current.deployWorkerUrl).toBe('');
    expect(result.current.workerAllowOrigins).toBe('http://localhost:3010\nhttp://127.0.0.1:3010');
    expect(result.current.workerLimitPerWallet).toBe('');
    expect(buildProvisionedSponsoredContextState).toHaveBeenCalledWith(undefined);
  });

  it('hydrates cached deploy, worker secret, and sponsored context state', () => {
    const { result } = renderWorkerState({
      cachedWizard: {
        workerSecretsEnabled: false,
        persistWorkerSecrets: false,
        deployComplete: true,
        deployWorkerUrl: 'worker.example/path///',
        workerRequirementProof: {
          version: 1,
          verificationKind: 'remote-deploy-verification',
          workerIdentityFingerprint: 'a'.repeat(64),
          requirementsFingerprint: 'b'.repeat(64),
          requiredSecretFields: ['openaiKey'],
          secretValueFingerprints: { openaiKey: 'c'.repeat(64) },
          remoteManagedSecretFields: [],
        },
        deployForm: {
          apiToken: ' token ',
          workerName: ' worker ',
          adminAddress: ' 0xAdmin ',
          accountId: ' account ',
          bundleUrl: 'https://cached.example/worker.js',
        },
        provisionedSponsoredContext: {
          sessionSlug: 'cached-session',
          workerUrl: 'https://cached-worker.example',
          fields: { prompt: 'enabled' },
        },
        workerSecrets: {
          openaiKey: ' [redacted] ',
          customRpcUrl: ' https://rpc.example ',
          litAccountApiKey: ' lit-account ',
          litApiBase: ' https://lit.example ',
        },
      },
    });

    expect(result.current.workerSecretsEnabled).toBe(false);
    expect(result.current.persistWorkerSecrets).toBe(false);
    expect(result.current.deployComplete).toBe(false);
    expect(result.current.deployWorkerUrl).toBe('https://worker.example/path');
    expect(result.current.workerRequirementProof).toBeNull();
    expect(result.current.deployForm).toEqual({
      apiToken: 'token',
      workerName: 'worker',
      adminAddress: '0xAdmin',
      bundleUrl: 'https://cached.example/worker.js',
    });
    expect(result.current.deployForm.accountId).toBeUndefined();
    expect(result.current.provisionedSponsoredContext).toEqual({
      sessionSlug: 'cached-session',
      workerUrl: 'https://cached-worker.example',
      fields: { prompt: 'enabled' },
    });
    expect(result.current.workerSecrets.openaiKey).toBe('');
    expect(result.current.workerSecrets.customRpcUrl).toBe('https://rpc.example');
    expect(result.current.workerSecrets.litAccountApiKey).toBe('lit-account');
    expect(result.current.workerSecrets.litApiBase).toBe('');
  });

  it('uses upload bundle mode when no hosted worker bundle default exists', () => {
    const { result } = renderWorkerState({
      workerBundleUrlDefault: '',
      devPersistWorkerSecrets: false,
    });

    expect(result.current.bundleMode).toBe('upload');
    expect(result.current.persistWorkerSecrets).toBe(false);
    expect(result.current.deployForm.bundleUrl).toBe('');
  });

  it('exposes setters for worker form state', () => {
    const { result } = renderWorkerState();

    act(() => {
      result.current.setWorkerMode('custom');
      result.current.setDeployStatus('Deploying');
      result.current.setDeployInFlight(true);
      result.current.setDeployWorkerUrl('https://next-worker.example');
      result.current.setWorkerAllowOrigins('https://app.example');
      result.current.setWorkerLimitPerWallet('3');
      result.current.setDeployForm((prev) => ({
        ...prev,
        workerName: 'next-worker',
      }));
    });

    expect(result.current.workerMode).toBe('custom');
    expect(result.current.deployStatus).toBe('Deploying');
    expect(result.current.deployInFlight).toBe(true);
    expect(result.current.deployWorkerUrl).toBe('https://next-worker.example');
    expect(result.current.workerAllowOrigins).toBe('https://app.example');
    expect(result.current.workerLimitPerWallet).toBe('3');
    expect(result.current.deployForm.workerName).toBe('next-worker');
  });
});
