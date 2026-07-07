import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import WorkerResourceInputs from './WorkerResourceInputs';

const buildSecretFieldTestId = (fieldKey: string) => `secret-${fieldKey}`;

describe('WorkerResourceInputs', () => {
  it('renders generic resource fields with stable test ids and RPC fallback placeholders', () => {
    const onUpdateSecret = jest.fn();

    render(
      <WorkerResourceInputs
        resourceKey="rpc"
        fields={[{ key: 'customRpcUrl', label: 'Custom RPC URL', type: 'text' }]}
        workerSecrets={{ customRpcUrl: '' }}
        workerSecretsEnabled
        isNormalMode
        showSponsoredFaucetNotice={false}
        effectiveDefaultWorkerRpcUrl="https://rpc.example"
        getSecretFieldTestId={buildSecretFieldTestId}
        onUpdateSecret={onUpdateSecret}
      />,
    );

    const input = screen.getByTestId('secret-customRpcUrl');
    expect(input).toHaveAttribute('placeholder', 'https://rpc.example');

    fireEvent.change(input, { target: { value: 'https://rpc.next' } });
    expect(onUpdateSecret).toHaveBeenCalledWith('customRpcUrl', 'https://rpc.next');
  });

  it('renders only the Chipotle Lit API key field with a stable test id', () => {
    const onUpdateSecret = jest.fn();

    render(
      <WorkerResourceInputs
        resourceKey="lit"
        fields={[{ key: 'litAccountApiKey', label: 'Lit API key', type: 'password' }]}
        workerSecrets={{
          litApiBase: 'https://api.chipotle.litprotocol.com',
          litGroupId: 'group_123',
          litPkpId: 'pkp_123',
          litActionCid: 'bafy123',
          litAccountApiKey: 'account-secret',
          litUsageApiKey: 'lit-secret',
        }}
        workerSecretsEnabled
        isNormalMode={false}
        showSponsoredFaucetNotice={false}
        effectiveDefaultWorkerRpcUrl=""
        getSecretFieldTestId={buildSecretFieldTestId}
        onUpdateSecret={onUpdateSecret}
      />,
    );

    expect(screen.getByTestId('secret-litAccountApiKey')).toHaveValue('account-secret');
    expect(screen.queryByTestId('secret-litApiBase')).not.toBeInTheDocument();
    expect(screen.queryByTestId('secret-litGroupId')).not.toBeInTheDocument();
    expect(screen.queryByTestId('secret-litPkpId')).not.toBeInTheDocument();
    expect(screen.queryByTestId('secret-litActionCid')).not.toBeInTheDocument();
    expect(screen.queryByTestId('secret-litUsageApiKey')).not.toBeInTheDocument();
    expect(screen.queryByText(/derives the Lit group, PKP, usage key, and CE action/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId('secret-litAccountApiKey'), { target: { value: 'lit-next' } });
    expect(onUpdateSecret).toHaveBeenCalledWith('litAccountApiKey', 'lit-next');
  });

  it('hides scoped-runtime and legacy payer wallet controls from the simplified Lit card', () => {
    render(
      <WorkerResourceInputs
        resourceKey="lit"
        fields={[{ key: 'litAccountApiKey', label: 'Lit API key', type: 'password' }]}
        workerSecrets={{ litUsageApiKey: 'lit-secret', litAccountApiKey: 'account-secret' }}
        workerSecretsEnabled
        isNormalMode={false}
        showSponsoredFaucetNotice={false}
        effectiveDefaultWorkerRpcUrl=""
        getSecretFieldTestId={buildSecretFieldTestId}
        onUpdateSecret={() => {}}
      />,
    );

    expect(screen.getByTestId('secret-litAccountApiKey')).toBeInTheDocument();
    expect(screen.queryByTestId('secret-litUsageApiKey')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue(/0x/i)).not.toBeInTheDocument();
  });
});
