import {
  parseSessionWizardAllowOriginsInput,
  resolveSessionWizardWorkerBaseUrlFromDraft,
  resolveSessionWizardWorkerFaucetConfigFromDraft,
  resolveSessionWizardWorkerRpcUrlFromDraft,
  resolveSessionWizardWorkerRpcUrlMapFromDraft,
  resolveSessionWizardWorkerUrlSourceState,
} from './sessionWizardWorkerRuntimeSupport';
import { getSessionWizardDefaultWorkerUrl } from './sessionWizardWorkerDefaults';

describe('sessionWizardWorkerRuntimeSupport', () => {
  it('keeps normal mode on bring-your-own-worker when only the placeholder url is present', () => {
    expect(
      resolveSessionWizardWorkerBaseUrlFromDraft({
        draft: { corsWorkerUrl: getSessionWizardDefaultWorkerUrl() },
        wizardMode: 'normal',
        deployComplete: false,
        workerMode: 'default',
      }),
    ).toBe('');
  });

  it('describes worker URL source display without owning deploy execution', () => {
    expect(
      resolveSessionWizardWorkerUrlSourceState({
        resolvedWorkerBaseUrl: '',
      }),
    ).toEqual({
      deployWorkerMatchesConfiguredUrl: false,
      usesDefaultWorkerUrl: false,
      workerUrlSource: 'missing (set worker URL)',
    });

    expect(
      resolveSessionWizardWorkerUrlSourceState({
        defaultWorkerUrl: 'https://default.example',
        resolvedWorkerBaseUrl: 'https://default.example',
        visibleConfiguredWorkerUrl: 'https://default.example',
        workerMode: 'custom',
      }),
    ).toEqual({
      deployWorkerMatchesConfiguredUrl: false,
      usesDefaultWorkerUrl: true,
      workerUrlSource: 'default worker',
    });

    expect(
      resolveSessionWizardWorkerUrlSourceState({
        deployedWorkerUrl: 'https://deployed.example',
        deployVerifiedInUi: true,
        resolvedWorkerBaseUrl: 'https://deployed.example',
        visibleConfiguredWorkerUrl: 'https://deployed.example',
        workerMode: 'custom',
      }),
    ).toEqual({
      deployWorkerMatchesConfiguredUrl: true,
      usesDefaultWorkerUrl: false,
      workerUrlSource: 'deployed worker URL (verified this run)',
    });

    expect(
      resolveSessionWizardWorkerUrlSourceState({
        deployedWorkerUrl: 'https://old-deploy.example',
        deployVerifiedInUi: true,
        resolvedWorkerBaseUrl: 'https://custom.example',
        visibleConfiguredWorkerUrl: 'https://custom.example',
        workerMode: 'custom',
      }).workerUrlSource,
    ).toBe('custom worker URL changed after deploy (re-deploy to verify)');

    expect(
      resolveSessionWizardWorkerUrlSourceState({
        resolvedWorkerBaseUrl: 'https://custom.example',
        visibleConfiguredWorkerUrl: 'https://custom.example',
        workerMode: 'custom',
      }).workerUrlSource,
    ).toBe('custom worker URL (not verified in this run)');
  });

  it('resolves worker rpc urls and url maps from draft path providers', () => {
    expect(
      resolveSessionWizardWorkerRpcUrlFromDraft({
        draft: {
          networkChainId: 84532,
          rpc: {
            providers: {
              path: {
                rpcUrl: 'https://rpc.example',
                rpcUrlsByChainId: {
                  84532: ['https://rpc.example', 'https://rpc-backup.example'],
                },
              },
            },
          },
        },
      }),
    ).toBe('https://rpc.example');

    expect(
      resolveSessionWizardWorkerRpcUrlMapFromDraft({
        draft: {
          networkChainId: 84532,
          rpc: {
            providers: {
              path: {
                rpcUrlsByChainId: {
                  84532: ['https://rpc.example', 'https://rpc-backup.example'],
                },
              },
            },
          },
        },
      }),
    ).toEqual(
      expect.objectContaining({
        '84532': expect.arrayContaining(['https://rpc.example', 'https://rpc-backup.example']),
      }),
    );
  });

  it('prefers uploaded custom RPC secrets for worker runtime config', () => {
    const draft = {
      networkChainId: 84532,
      rpc: {
        providers: {
          path: {
            rpcUrl: 'https://draft-rpc.example',
            rpcUrlsByChainId: {
              84532: ['https://draft-rpc.example', 'https://rpc-backup.example'],
            },
          },
        },
      },
      faucet: {},
    };
    const workerSecrets = { customRpcUrl: ' https://uploaded-rpc.example ' };

    expect(
      resolveSessionWizardWorkerRpcUrlFromDraft({
        draft,
        workerSecrets,
      }),
    ).toBe('https://uploaded-rpc.example');

    const rpcUrlMap = resolveSessionWizardWorkerRpcUrlMapFromDraft({
      draft,
      workerSecrets,
    });
    expect(rpcUrlMap['84532'].slice(0, 3)).toEqual([
      'https://uploaded-rpc.example',
      'https://draft-rpc.example',
      'https://rpc-backup.example',
    ]);

    expect(
      resolveSessionWizardWorkerFaucetConfigFromDraft({
        draft,
        workerSecrets,
      }).rpcUrl,
    ).toBe('https://uploaded-rpc.example');
  });

  it('resolves faucet defaults from rpc fallbacks when values are unset', () => {
    expect(
      resolveSessionWizardWorkerFaucetConfigFromDraft({
        draft: {
          networkChainId: 84532,
          rpc: {
            providers: {
              path: {
                rpcUrl: 'https://rpc.example',
              },
            },
          },
          faucet: {},
        },
      }),
    ).toEqual({
      rpcUrl: 'https://rpc.example',
      amountEth: '0.0002',
      balanceThresholdEth: '0.001',
    });
  });

  it('parses allow origins and falls back to defaults when all entries are invalid', () => {
    expect(parseSessionWizardAllowOriginsInput('https://app.example,\nhttps://admin.example')).toEqual([
      'https://app.example',
      'https://admin.example',
    ]);
    expect(parseSessionWizardAllowOriginsInput('not-an-origin')).not.toEqual([]);
    expect(parseSessionWizardAllowOriginsInput('')).toEqual([]);
  });
});
