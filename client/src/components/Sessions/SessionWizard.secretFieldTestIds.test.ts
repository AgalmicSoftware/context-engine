import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { getSessionWizardSecretFieldTestId } from './SessionWizard';

describe('SessionWizard secret field test ids', () => {
  it('maps supported worker secret keys to stable E2E test ids', () => {
    expect(getSessionWizardSecretFieldTestId('openaiKey')).toBe(E2E_TESTIDS.WIZARD_SECRET_OPENAI_KEY);
    expect(getSessionWizardSecretFieldTestId('anthropicKey')).toBe(E2E_TESTIDS.WIZARD_SECRET_ANTHROPIC_KEY);
    expect(getSessionWizardSecretFieldTestId('openrouterKey')).toBe(E2E_TESTIDS.WIZARD_SECRET_OPENROUTER_KEY);
    expect(getSessionWizardSecretFieldTestId('arweaveJwk')).toBe(E2E_TESTIDS.WIZARD_SECRET_ARWEAVE_JWK);
    expect(getSessionWizardSecretFieldTestId('faucetPrivateKey')).toBe(
      E2E_TESTIDS.WIZARD_SECRET_FAUCET_PRIVATE_KEY
    );
    expect(getSessionWizardSecretFieldTestId('litPayerPrivateKey')).toBe(
      E2E_TESTIDS.WIZARD_SECRET_LIT_PAYER_PRIVATE_KEY
    );
    expect(getSessionWizardSecretFieldTestId('litPayerAddress')).toBe(
      E2E_TESTIDS.WIZARD_SECRET_LIT_PAYER_ADDRESS
    );
  });

  it('returns undefined for unknown secret keys', () => {
    expect(getSessionWizardSecretFieldTestId('customRpcUrl')).toBeUndefined();
  });
});
