import { fireEvent, screen, waitFor } from '@testing-library/react';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

const getToggleCheckbox = (labelText) =>
  screen.getByText(labelText).closest('label').querySelector('input[type="checkbox"]');

const getFieldInputByLabel = (labelText) =>
  screen.getByText(labelText).parentElement.querySelector('input,textarea,select');

// Every setup section but Basics starts closed behind its More button.
const openSetupSection = (key: string) => {
  const toggle = screen.queryByTestId(`ce-setup-more-${key}`);
  if (!toggle || toggle.getAttribute('aria-expanded') === 'true') return;
  fireEvent.click(toggle);
};

// New drafts start Worker-hosted. This takes the on-chain registry path that the
// old default (trustless) preset took. It mirrors the worker-panel testUtils
// helper, which can't be imported here without also installing its jest mocks.
const selectRegistryHosting = () => {
  openSetupSection('hosting');
  fireEvent.change(screen.getByTestId('ce-setup-authority'), { target: { value: 'evm_registry_canonical' } });
};

// Lit encryption adds the Lit resource card under Hosting.
const selectLitEncryption = () => {
  openSetupSection('access');
  fireEvent.change(screen.getByTestId('ce-setup-encryption'), { target: { value: 'lit' } });
};

const setCloudflareTokenValue = (value) => {
  const input = screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_API_TOKEN);
  fireEvent.change(input, { target: { value } });
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

export {
  getToggleCheckbox,
  expectSponsoredStatus,
  getFieldInputByLabel,
  openSetupSection,
  selectLitEncryption,
  selectRegistryHosting,
  setCloudflareTokenValue,
};
