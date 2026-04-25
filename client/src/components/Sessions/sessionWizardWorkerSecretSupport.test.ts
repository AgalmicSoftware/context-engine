import {
  DEFAULT_WORKER_SECRETS,
  getSessionWizardWorkerResourceKeys,
  normalizeWorkerSecrets,
  sanitizeSessionWizardSponsoredFieldSnapshotForLitMode,
  sanitizeSessionWizardWorkerSecretsForLitMode,
} from './sessionWizardWorkerSecretSupport';

describe('sessionWizardWorkerSecretSupport', () => {
  it('normalizes worker secrets and strips redacted placeholders', () => {
    expect(normalizeWorkerSecrets({
      ...DEFAULT_WORKER_SECRETS,
      openaiKey: ' sk-openai ',
      customRpcKey: '[redacted]',
    })).toEqual(expect.objectContaining({
      openaiKey: 'sk-openai',
      customRpcKey: '',
    }));
  });

  it('removes lit payer credentials when user-paid mode is disabled', () => {
    const litPayerPrivateKey = '0x59c6995e998f97a5a0044976f84ce7de5d9d7f17b2f6a6a5f76f8864c8ad88f5';
    expect(sanitizeSessionWizardWorkerSecretsForLitMode({
      litPayerPrivateKey,
    }, {
      litPayerWalletInputEnabled: false,
    })).toEqual(expect.objectContaining({
      litPayerPrivateKey: '',
      litPayerAddress: '',
    }));
  });

  it('zeros the sponsored lit flag and hides the lit resource bucket when disabled', () => {
    expect(sanitizeSessionWizardSponsoredFieldSnapshotForLitMode({
      sponsored_lit: '1',
      sponsored_ai: '1',
    }, {
      litPayerWalletInputEnabled: false,
    })).toEqual(expect.objectContaining({
      sponsored_lit: '0',
      sponsored_ai: '1',
    }));

    expect(getSessionWizardWorkerResourceKeys({
      litPayerWalletInputEnabled: false,
    })).not.toContain('lit');
  });
});
