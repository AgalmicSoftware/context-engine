import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import {
  getSessionWizardSecretFieldTestId,
  readSessionWizardTooltipsEnabled,
  resolveSessionHeaderImageFormat,
} from './sessionWizardUiSupport';

describe('sessionWizardUiSupport', () => {
  it('reads tooltip preference from the redux-like store shape', () => {
    expect(readSessionWizardTooltipsEnabled(null)).toBe(true);
    expect(readSessionWizardTooltipsEnabled({
      getState: () => ({ sessionState: { tooltipsEnabled: true } }),
    })).toBe(true);
    expect(readSessionWizardTooltipsEnabled({
      getState: () => ({ sessionState: { tooltipsEnabled: false } }),
    })).toBe(false);
  });

  it('resolves session header image format from name or mime type', () => {
    expect(resolveSessionHeaderImageFormat({ name: 'cover.PNG' })).toBe('png');
    expect(resolveSessionHeaderImageFormat({ type: 'image/jpeg' })).toBe('jpeg');
    expect(resolveSessionHeaderImageFormat({ name: 'cover.unknown', type: 'application/json' })).toBe('');
  });

  it('maps supported secret fields to stable e2e test ids', () => {
    expect(getSessionWizardSecretFieldTestId('openaiKey')).toBe(E2E_TESTIDS.WIZARD_SECRET_OPENAI_KEY);
    expect(getSessionWizardSecretFieldTestId('anthropicKey')).toBe(E2E_TESTIDS.WIZARD_SECRET_ANTHROPIC_KEY);
    expect(getSessionWizardSecretFieldTestId('openrouterKey')).toBe(E2E_TESTIDS.WIZARD_SECRET_OPENROUTER_KEY);
    expect(getSessionWizardSecretFieldTestId('arweaveJwk')).toBe(E2E_TESTIDS.WIZARD_SECRET_ARWEAVE_JWK);
    expect(getSessionWizardSecretFieldTestId('faucetPrivateKey')).toBe(E2E_TESTIDS.WIZARD_SECRET_FAUCET_PRIVATE_KEY);
    expect(getSessionWizardSecretFieldTestId('litPayerPrivateKey')).toBe(E2E_TESTIDS.WIZARD_SECRET_LIT_PAYER_PRIVATE_KEY);
    expect(getSessionWizardSecretFieldTestId('litPayerAddress')).toBe(E2E_TESTIDS.WIZARD_SECRET_LIT_PAYER_ADDRESS);
    expect(getSessionWizardSecretFieldTestId('customRpcUrl')).toBeUndefined();
  });
});
