import {
  parseSessionWizardAllowOriginsInput,
  resolveSessionWizardWorkerBaseUrlFromDraft,
  resolveSessionWizardWorkerFaucetConfigFromDraft,
  resolveSessionWizardWorkerRpcUrlFromDraft,
  resolveSessionWizardWorkerRpcUrlMapFromDraft,
} from './sessionWizardWorkerRuntimeSupport';
import { getSessionWizardDefaultWorkerUrl } from './sessionWizardWorkerDefaults';

describe('sessionWizardWorkerRuntimeSupport', () => {
  it('keeps normal mode on bring-your-own-worker when only the placeholder url is present', () => {
    expect(resolveSessionWizardWorkerBaseUrlFromDraft({
      draft: { corsWorkerUrl: getSessionWizardDefaultWorkerUrl() },
      wizardMode: 'normal',
      deployComplete: false,
      workerMode: 'default',
    })).toBe('');
  });

  it('resolves worker rpc urls and url maps from draft path providers', () => {
    expect(resolveSessionWizardWorkerRpcUrlFromDraft({
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
    })).toBe('https://rpc.example');

    expect(resolveSessionWizardWorkerRpcUrlMapFromDraft({
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
    })).toEqual(expect.objectContaining({
      '84532': expect.arrayContaining(['https://rpc.example', 'https://rpc-backup.example']),
    }));
  });

  it('resolves faucet defaults from rpc fallbacks when values are unset', () => {
    expect(resolveSessionWizardWorkerFaucetConfigFromDraft({
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
    })).toEqual({
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
