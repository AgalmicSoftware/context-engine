import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

const SPONSORED_FAUCET_NOTICE =
  'Faucet funding is currently provided by the sponsored bundle. Enter a private key here to override it.';
const SPONSORED_DEPLOY_NOTICE =
  'Deploy access is currently provided by the sponsored bundle. Enter a Cloudflare API token here to override it.';

const getFieldInputByLabel = (labelText) =>
  screen.getByText(labelText).parentElement.querySelector('input,textarea,select');

const getToggleCheckbox = (labelText) =>
  screen.getByText(labelText).closest('label').querySelector('input[type="checkbox"]');

const enableAdvancedMode = () => {
  act(() => {
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_MODE_ADVANCED));
  });
  if (hasCommittedSessionModeProfile()) return;
  const arweavePreset = screen.queryByTestId('ce-new-preset-trustless_public_decentralized');
  if (arweavePreset) {
    act(() => {
      fireEvent.click(arweavePreset);
    });
  }
};

const hasCommittedSessionModeProfile = () => {
  const continueButton = screen.queryByTestId('ce-new-preset-continue');
  return !!continueButton && !continueButton.disabled;
};

const ensureSessionModeProfileSelected = () => {
  if (hasCommittedSessionModeProfile()) return;
  if (screen.queryByTestId('ce-new-preset-trustless_public_decentralized')) {
    act(() => {
      fireEvent.click(screen.getByTestId('ce-new-preset-trustless_public_decentralized'));
    });
    return;
  }
  const normalModeButton = screen.queryByTestId(E2E_TESTIDS.WIZARD_MODE_NORMAL);
  const advancedModeButton = screen.queryByTestId(E2E_TESTIDS.WIZARD_MODE_ADVANCED);
  if (!normalModeButton || !advancedModeButton) return;
  const wasNormalMode = normalModeButton.getAttribute('aria-pressed') === 'true';
  act(() => {
    fireEvent.click(advancedModeButton);
  });
  const arweavePreset = screen.queryByTestId('ce-new-preset-trustless_public_decentralized');
  if (arweavePreset) {
    act(() => {
      fireEvent.click(arweavePreset);
    });
  }
  if (wasNormalMode) {
    act(() => {
      fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_MODE_NORMAL));
    });
  }
};

const selectNormalModeCard = (label) => {
  ensureSessionModeProfileSelected();
  fireEvent.click(screen.getByRole('button', { name: new RegExp(label, 'i') }));
};

const openWorkerPanel = () => {
  fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_WORKER_PANEL_TOGGLE));
};

const setControlledInputValue = (input, value) => {
  const reactPropsKey = Object.keys(input).find((key) => key.startsWith('__reactProps$'));
  if (reactPropsKey) {
    act(() => {
      input[reactPropsKey].onChange({ target: { value } });
    });
    return;
  }
  fireEvent.change(input, { target: { value } });
};

const setCloudflareTokenValue = (value) => {
  const input = screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_API_TOKEN);
  setControlledInputValue(input, value);
  return input;
};

const expectSponsoredStatus = async (message) => {
  await waitFor(
    () => {
      if (message instanceof RegExp) {
        expect(screen.getByTestId('ce-wizard-sponsored-status')).toHaveTextContent(message);
        return;
      }
      if (message === 'Sponsored resources applied.') {
        expect(screen.getByTestId('ce-wizard-sponsored-status')).toHaveTextContent(/^Sponsored resources applied:/i);
        return;
      }
      expect(screen.getByTestId('ce-wizard-sponsored-status')).toHaveTextContent(message);
    },
    { timeout: 10000 },
  );
};

const configureAdvancedUseUrlDeploy = async ({
  sessionName = 'Advanced Bundle Retry Session',
  slug = 'advanced-bundle-retry-session',
  bundleUrl = 'https://bundles.example.test/sessionCorsWorker.bundle.js',
  cloudflareToken = 'cf-test-token',
} = {}) => {
  enableAdvancedMode();
  const sessionNameInput = await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
  if (!screen.queryByTestId(E2E_TESTIDS.WIZARD_SLUG)) {
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_METADATA_PANEL_TOGGLE));
  }
  fireEvent.change(sessionNameInput, {
    target: { value: sessionName },
  });
  fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SLUG), {
    target: { value: slug },
  });

  openWorkerPanel();
  fireEvent.click(await screen.findByRole('button', { name: 'Use My Own' }));

  const bundleModeUrlInput = screen.getByTestId(E2E_TESTIDS.WIZARD_BUNDLE_MODE_URL);
  if (!bundleModeUrlInput.checked) {
    fireEvent.click(bundleModeUrlInput);
  }

  const bundleUrlInput = screen.getByPlaceholderText(
    'https://github.com/<org>/<repo>/releases/latest/download/sessionCorsWorker.bundle.js',
  );
  setControlledInputValue(bundleUrlInput, bundleUrl);
  await waitFor(() => {
    expect(bundleUrlInput).toHaveValue(bundleUrl);
  });
  setControlledInputValue(
    screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_HELPER_URL),
    'https://deploy-helper.example.test',
  );
  await waitFor(() => {
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_HELPER_URL)).toHaveValue('https://deploy-helper.example.test');
  });
  setCloudflareTokenValue(cloudflareToken);
  fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SECRET_OPENAI_KEY), {
    target: { value: 'sk-test-openai' },
  });
  fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_SECRET_ARWEAVE_JWK), {
    target: { value: '{"kty":"RSA","n":"abc"}' },
  });
  await waitFor(() => {
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_WORKER_NAME)).toHaveTextContent(slug);
  });
  return {
    bundleModeUrlInput,
    bundleUrlInput,
  };
};

export {
  SPONSORED_DEPLOY_NOTICE,
  SPONSORED_FAUCET_NOTICE,
  configureAdvancedUseUrlDeploy,
  enableAdvancedMode,
  expectSponsoredStatus,
  getFieldInputByLabel,
  getToggleCheckbox,
  openWorkerPanel,
  selectNormalModeCard,
  setCloudflareTokenValue,
};
