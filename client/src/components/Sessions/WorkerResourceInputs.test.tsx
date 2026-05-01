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
      />
    );

    const input = screen.getByTestId('secret-customRpcUrl');
    expect(input).toHaveAttribute('placeholder', 'https://rpc.example');

    fireEvent.change(input, { target: { value: 'https://rpc.next' } });
    expect(onUpdateSecret).toHaveBeenCalledWith('customRpcUrl', 'https://rpc.next');
  });

  it('renders Chipotle Lit account and runtime fields with stable test ids', () => {
    const onUpdateSecret = jest.fn();

    render(
      <WorkerResourceInputs
        resourceKey="lit"
        fields={[{ key: 'litUsageApiKey', label: 'Usage API key', type: 'password' }]}
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
      />
    );

    expect(screen.getByTestId('secret-litApiBase')).toHaveValue('https://api.chipotle.litprotocol.com');
    expect(screen.getByTestId('secret-litGroupId')).toHaveValue('group_123');
    expect(screen.getByTestId('secret-litPkpId')).toHaveValue('pkp_123');
    expect(screen.getByTestId('secret-litActionCid')).toHaveValue('bafy123');
    expect(screen.getByTestId('secret-litAccountApiKey')).toHaveValue('account-secret');
    expect(screen.getByTestId('secret-litUsageApiKey')).toBeInTheDocument();
    expect(screen.getByText(/let the worker bootstrap a fresh group/i)).toBeInTheDocument();
    expect(screen.getByText(/`Lit account API key` is authority/i)).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('secret-litUsageApiKey'), { target: { value: 'lit-next' } });
    expect(onUpdateSecret).toHaveBeenCalledWith('litUsageApiKey', 'lit-next');
  });

  it('shows only Chipotle Lit fields without legacy payer wallet controls', () => {
    render(
      <WorkerResourceInputs
        resourceKey="lit"
        fields={[{ key: 'litUsageApiKey', label: 'Usage API key', type: 'password' }]}
        workerSecrets={{ litUsageApiKey: 'lit-secret', litAccountApiKey: 'account-secret' }}
        workerSecretsEnabled
        isNormalMode={false}
        showSponsoredFaucetNotice={false}
        effectiveDefaultWorkerRpcUrl=""
        getSecretFieldTestId={buildSecretFieldTestId}
        onUpdateSecret={() => {}}
      />
    );

    expect(screen.getByTestId('secret-litAccountApiKey')).toBeInTheDocument();
    expect(screen.getByTestId('secret-litUsageApiKey')).toBeInTheDocument();
    expect(screen.queryByDisplayValue(/0x/i)).not.toBeInTheDocument();
  });
});
