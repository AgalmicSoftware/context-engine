import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import AdminPageTestsPanel from './AdminPageTestsPanel';

jest.mock('../Shared/AudioInput/AudioInput', () => () => <div data-testid="mock-audio-input" />);
jest.mock('../Shared/CETooltip', () => ({ children }: { children: React.ReactNode }) => <>{children}</>);

const results = {
  health: 'Not run',
  login: 'Not run',
  ai: 'Not run',
  arweave: 'Not run',
  faucet: 'Not run',
  transcribe: 'Not run',
};

const renderPanel = (visibleTestKeys: readonly string[]) => {
  const runDeniedAccessTest = jest.fn();
  render(
    <AdminPageTestsPanel
      testsOpen
      onCollapse={() => undefined}
      litTestValue=""
      setLitTestValue={() => undefined}
      litTestBusy={false}
      litTestEnvelope=""
      litTestStatus=""
      litTestDecrypted=""
      runLitEncryptTest={() => undefined}
      runLitDecryptTest={() => undefined}
      canRunTests
      canRunHealthTest
      defaultGateIsEmpty
      walletReady
      account="0x0000000000000000000000000000000000000001"
      testBusy={false}
      testResults={results}
      testStatus=""
      runWorkerHealthTest={() => undefined}
      runWorkerAiTest={() => undefined}
      runWorkerArweaveTest={() => undefined}
      runWorkerFaucetTest={() => undefined}
      transcribeText=""
      handleTranscribeTestTextChange={() => undefined}
      selectedSlug="worker-session"
      testSessionConfig={{}}
      testContext={null}
      baseWorkerUrl="https://worker.example.test"
      deniedBusy={false}
      deniedStatus=""
      deniedResults={results}
      runDeniedAccessTest={runDeniedAccessTest}
      visibleTestKeys={visibleTestKeys}
    />,
  );
  return runDeniedAccessTest;
};

describe('AdminPageTestsPanel capability projection', () => {
  it('keeps a minimal worker session to Worker health, login, and AI checks', () => {
    const runDeniedAccessTest = renderPanel(['health', 'ai']);

    expect(screen.getByText('Health')).toBeInTheDocument();
    expect(screen.getByTitle('Click to test AI')).toBeInTheDocument();
    expect(screen.getByTestId('ce-admin-denied-chip-login')).toBeInTheDocument();
    expect(screen.getByTestId('ce-admin-denied-chip-ai')).toBeInTheDocument();
    expect(screen.queryByText('Arweave')).not.toBeInTheDocument();
    expect(screen.queryByText('Transcribe')).not.toBeInTheDocument();
    expect(screen.queryByText('Faucet')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ce-admin-denied-chip-login'));
    expect(runDeniedAccessTest).toHaveBeenCalledWith('login');
  });

  it('keeps each Advanced negative check aligned with its enabled capability', () => {
    const runDeniedAccessTest = renderPanel(['health', 'ai', 'arweave', 'faucet', 'transcribe']);

    fireEvent.click(screen.getByTestId('ce-admin-denied-chip-ai'));
    fireEvent.click(screen.getByTestId('ce-admin-denied-chip-arweave'));
    fireEvent.click(screen.getByTestId('ce-admin-denied-chip-transcribe'));
    fireEvent.click(screen.getByTestId('ce-admin-denied-chip-faucet'));

    expect(runDeniedAccessTest.mock.calls).toEqual([['ai'], ['arweave'], ['transcribe'], ['faucet']]);
  });
});
