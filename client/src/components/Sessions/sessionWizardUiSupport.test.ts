import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import {
  getSessionWizardSecretFieldTestId,
  readSessionWizardTooltipsEnabled,
  resolveSessionHeaderImageFormat,
} from './sessionWizardUiSupport';

describe('sessionWizardUiSupport', () => {
  it('reads tooltip preference from the redux-like store shape', () => {
    expect(readSessionWizardTooltipsEnabled(null)).toBe(true);
    expect(
      readSessionWizardTooltipsEnabled({
        getState: () => ({ sessionState: { tooltipsEnabled: true } }),
      }),
    ).toBe(true);
    expect(
      readSessionWizardTooltipsEnabled({
        getState: () => ({ sessionState: { tooltipsEnabled: false } }),
      }),
    ).toBe(false);
  });

  it('resolves session header image format from name or mime type', () => {
    expect(resolveSessionHeaderImageFormat({ name: 'cover.PNG' })).toBe('png');
    expect(resolveSessionHeaderImageFormat({ type: 'image/jpeg' })).toBe('jpeg');
    expect(resolveSessionHeaderImageFormat(new Blob(['header'], { type: 'image/gif' }))).toBe('gif');
    expect(resolveSessionHeaderImageFormat({ name: 'cover.unknown', type: 'application/json' })).toBe('');
  });

  it('maps supported secret fields to stable e2e test ids', () => {
    expect(getSessionWizardSecretFieldTestId('openaiKey')).toBe(E2E_TESTIDS.WIZARD_SECRET_OPENAI_KEY);
    expect(getSessionWizardSecretFieldTestId('anthropicKey')).toBe(E2E_TESTIDS.WIZARD_SECRET_ANTHROPIC_KEY);
    expect(getSessionWizardSecretFieldTestId('openrouterKey')).toBe(E2E_TESTIDS.WIZARD_SECRET_OPENROUTER_KEY);
    expect(getSessionWizardSecretFieldTestId('arweaveJwk')).toBe(E2E_TESTIDS.WIZARD_SECRET_ARWEAVE_JWK);
    expect(getSessionWizardSecretFieldTestId('faucetPrivateKey')).toBe(E2E_TESTIDS.WIZARD_SECRET_FAUCET_PRIVATE_KEY);
    expect(getSessionWizardSecretFieldTestId('litApiBase')).toBe(E2E_TESTIDS.WIZARD_SECRET_LIT_API_BASE);
    expect(getSessionWizardSecretFieldTestId('litGroupId')).toBe(E2E_TESTIDS.WIZARD_SECRET_LIT_GROUP_ID);
    expect(getSessionWizardSecretFieldTestId('litPkpId')).toBe(E2E_TESTIDS.WIZARD_SECRET_LIT_PKP_ID);
    expect(getSessionWizardSecretFieldTestId('litActionCid')).toBe(E2E_TESTIDS.WIZARD_SECRET_LIT_ACTION_CID);
    expect(getSessionWizardSecretFieldTestId('litUsageApiKey')).toBe(E2E_TESTIDS.WIZARD_SECRET_LIT_USAGE_API_KEY);
    expect(getSessionWizardSecretFieldTestId('customRpcUrl')).toBeUndefined();
  });
});
