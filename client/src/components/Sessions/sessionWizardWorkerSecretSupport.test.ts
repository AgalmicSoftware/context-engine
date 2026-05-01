import {
  buildWorkerLitCredentialsConfig,
  CHIPOTLE_LIT_CONFIG_FIELDS,
  DEFAULT_WORKER_SECRETS,
  getSessionWizardWorkerResourceKeys,
  mergeSponsoredBundleDeployForm,
  mergeSponsoredBundleWorkerSecrets,
  normalizeWorkerSecrets,
  resolveSessionWizardEnabledWorkerSecrets,
  sanitizeSessionWizardSponsoredFieldSnapshotForLitMode,
  sanitizeSessionWizardWorkerSecretsForLitMode,
} from './sessionWizardWorkerSecretSupport';

describe('sessionWizardWorkerSecretSupport', () => {
  it('normalizes worker secrets and strips redacted placeholders', () => {
    expect(normalizeWorkerSecrets({
      ...DEFAULT_WORKER_SECRETS,
      openaiKey: ' sk-openai ',
      customRpcKey: '[redacted]',
      litApiBase: ' https://api.chipotle.litprotocol.com ',
    })).toEqual(expect.objectContaining({
      openaiKey: 'sk-openai',
      customRpcKey: '',
      litApiBase: 'https://api.chipotle.litprotocol.com',
    }));
  });

  it('builds worker Lit credentials from the non-secret Chipotle fields only', () => {
    expect(buildWorkerLitCredentialsConfig({
      litApiBase: ' https://api.chipotle.litprotocol.com ',
      litGroupId: ' group_123 ',
      litPkpId: ' pkp_123 ',
      litActionCid: ' bafy123 ',
      litAccountApiKey: ' account-secret ',
      litUsageApiKey: 'sk-secret',
    })).toEqual({
      litApiBase: 'https://api.chipotle.litprotocol.com',
      litGroupId: 'group_123',
      litPkpId: 'pkp_123',
      litActionCid: 'bafy123',
    });
    expect(CHIPOTLE_LIT_CONFIG_FIELDS).toEqual([
      'litApiBase',
      'litGroupId',
      'litPkpId',
      'litActionCid',
    ]);
  });

  it('normalizes worker secrets without dropping account-scoped Chipotle authority', () => {
    expect(sanitizeSessionWizardWorkerSecretsForLitMode({
      litApiBase: 'https://api.chipotle.litprotocol.com',
      litAccountApiKey: ' account-secret ',
      litUsageApiKey: ' usage-secret ',
    })).toEqual(expect.objectContaining({
      litApiBase: 'https://api.chipotle.litprotocol.com',
      litAccountApiKey: 'account-secret',
      litUsageApiKey: 'usage-secret',
    }));
  });

  it('preserves the Lit resource bucket and sponsored flags in Chipotle-only mode', () => {
    expect(sanitizeSessionWizardSponsoredFieldSnapshotForLitMode({
      sponsored_lit: '1',
      sponsored_ai: '1',
    })).toEqual(expect.objectContaining({
      sponsored_lit: '1',
      sponsored_ai: '1',
    }));

    expect(getSessionWizardWorkerResourceKeys()).toContain('lit');
  });
});
