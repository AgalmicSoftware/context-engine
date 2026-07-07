import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import WorkerSecretsSection from './WorkerSecretsSection';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

const renderWorkerSecretsSection = (props = {}) =>
  render(
    <WorkerSecretsSection
      isNormalMode={false}
      translate={(key) => {
        if (key === 'gatesLower') return 'gates';
        if (key === 'gateLower') return 'gate';
        return key;
      }}
      renderInfoTooltip={({ testId }) => <button type="button" data-testid={testId} />}
      devPersistWorkerSecrets
      persistWorkerSecrets={false}
      setPersistWorkerSecrets={() => {}}
      workerSecretsEnabled
      setWorkerSecretsEnabled={() => {}}
      clearWorkerSecretFields={() => {}}
      effectivePersistWorkerSecrets={false}
      workerResourceKeys={['ai', 'rpc']}
      renderResource={(resourceKey) => <div key={resourceKey}>card {resourceKey}</div>}
      workerAllowOrigins="https://app.example"
      setWorkerAllowOrigins={() => {}}
      defaultAllowedOrigins="https://default.example"
      {...props}
    />,
  );

describe('WorkerSecretsSection', () => {
  it('renders the secrets/resource shell and forwards origin edits', () => {
    const setPersistWorkerSecrets = jest.fn();
    const setWorkerAllowOrigins = jest.fn();

    renderWorkerSecretsSection({
      setPersistWorkerSecrets,
      setWorkerAllowOrigins,
    });

    expect(screen.getByText('Worker secrets')).toBeInTheDocument();
    expect(screen.getByText('Resource gates (on-chain)')).toBeInTheDocument();
    expect(
      screen.getByText('Secrets are not saved locally — re-enter them if you refresh the page.'),
    ).toBeInTheDocument();
    expect(screen.getByText('card ai')).toBeInTheDocument();
    expect(screen.getByText('card rpc')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Dev: keep secrets on refresh'));
    expect(setPersistWorkerSecrets).toHaveBeenCalledWith(true);

    fireEvent.change(screen.getByPlaceholderText('https://default.example'), {
      target: { value: 'https://next.example' },
    });
    expect(setWorkerAllowOrigins).toHaveBeenCalledWith('https://next.example');
  });

  it('clears secret fields when toggling back from user-paid mode', () => {
    const setWorkerSecretsEnabled = jest.fn();
    const clearWorkerSecretFields = jest.fn();

    renderWorkerSecretsSection({
      workerSecretsEnabled: false,
      setWorkerSecretsEnabled,
      clearWorkerSecretFields,
    });

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_WORKER_SECRETS_REQUIRE_PAY));

    expect(setWorkerSecretsEnabled).toHaveBeenCalledWith(true);
    expect(clearWorkerSecretFields).toHaveBeenCalledTimes(1);
  });
});
