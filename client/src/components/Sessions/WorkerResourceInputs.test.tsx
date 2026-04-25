import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import WorkerResourceInputs from './WorkerResourceInputs';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

const buildSecretFieldTestId = (fieldKey: string) => `secret-${fieldKey}`;
const VALID_LIT_PRIVATE_KEY = '0x59c6995e998f97a5a0044976f1d8fa9f2b5f0d2cfc1fd8d7a4ee0f85df9b6f4a';

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
        walletLabel="Wallet"
        getSecretFieldTestId={buildSecretFieldTestId}
        onUpdateSecret={onUpdateSecret}
        onGenerateLitPayer={() => {}}
        onCopyLitPayerAddress={() => {}}
      />
    );

    const input = screen.getByTestId('secret-customRpcUrl');
    expect(input).toHaveAttribute('placeholder', 'https://rpc.example');

    fireEvent.change(input, { target: { value: 'https://rpc.next' } });
    expect(onUpdateSecret).toHaveBeenCalledWith('customRpcUrl', 'https://rpc.next');
  });

  it('renders lit payer controls with stable test ids and callbacks', () => {
    const onGenerateLitPayer = jest.fn();
    const onCopyLitPayerAddress = jest.fn();

    render(
      <WorkerResourceInputs
        resourceKey="lit"
        fields={[{ key: 'litPayerPrivateKey', label: 'Private key', type: 'password' }]}
        workerSecrets={{ litPayerPrivateKey: VALID_LIT_PRIVATE_KEY, litPayerAddress: '' }}
        workerSecretsEnabled
        isNormalMode={false}
        showSponsoredFaucetNotice={false}
        effectiveDefaultWorkerRpcUrl=""
        walletLabel="Wallet"
        getSecretFieldTestId={buildSecretFieldTestId}
        onUpdateSecret={() => {}}
        onGenerateLitPayer={onGenerateLitPayer}
        onCopyLitPayerAddress={onCopyLitPayerAddress}
      />
    );

    expect(screen.getByTestId('secret-litPayerPrivateKey')).toBeInTheDocument();
    expect(screen.getByTestId('secret-litPayerAddress')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    expect(onGenerateLitPayer).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_COPY_LIT_PAYER_ADDRESS));
    expect(onCopyLitPayerAddress).toHaveBeenCalledWith(expect.stringMatching(/^0x[a-fA-F0-9]{40}$/));
  });
});
