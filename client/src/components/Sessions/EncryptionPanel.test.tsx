import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import EncryptionPanel, { EncryptionPanelProps } from './EncryptionPanel';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

jest.mock('../SBTs/SBTSelector.jsx', () => function MockSBTSelector() {
  return <div data-testid="mock-sbt-selector" />;
});

const t = (key: string) => key;

const renderEncryptionPanel = (props: Partial<EncryptionPanelProps> = {}) => render(
  <EncryptionPanel
    isNormalMode
    t={t}
    renderSessionWizardInfoTooltip={() => null}
    isCollapsed={false}
    onToggleCollapsed={() => {}}
    launchCreateSbtModal={() => {}}
    activeCreateSbtTargetGateId="gate-1"
    activeCreateSbtTargetGate={{ id: 'gate-1', label: 'Gate A' }}
    encryptionGates={[{
      id: 'gate-1',
      label: 'Gate A',
      mode: 'any',
      color: '#4dffa4',
      sbts: [],
    }]}
    focusCreateSbtTargetGate={() => {}}
    updateEncryptionGate={() => {}}
    removeEncryptionGate={() => {}}
    normalizeSbtSelection={(value: unknown[]) => value}
    handleGateAddSbt={() => {}}
    handleGateRemoveSbt={() => {}}
    network="optimism-sepolia"
    pendingSbtSelectorOptions={[]}
    selectorSourceChainId={11155420}
    selectorSourceSessionConfig={{ slug: 'demo-session' }}
    resolvedActiveSessionSlug="demo-session"
    sbtCacheRevision={0}
    ensureLightSbtUniverse={() => {}}
    addEncryptionGate={() => {}}
    pendingSbtDrafts={[]}
    removePendingSbtDraft={() => {}}
    {...props}
  />
);

describe('EncryptionPanel', () => {
  it('renders without crashing with a minimal prop set', () => {
    renderEncryptionPanel();

    expect(screen.getByText('Privacy & Access')).toBeInTheDocument();
  });

  it('fires the collapse toggle handler when the header button is clicked', () => {
    const onToggleCollapsed = jest.fn();
    renderEncryptionPanel({ onToggleCollapsed });

    fireEvent.click(screen.getByRole('button', { name: /Privacy & Access/i }));

    expect(onToggleCollapsed).toHaveBeenCalledTimes(1);
  });

  it('preserves the create SBT test id', () => {
    renderEncryptionPanel();

    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_CREATE_SBT)).toBeInTheDocument();
  });

  it('renders the gate list while expanded and hides it while collapsed', () => {
    const { rerender } = renderEncryptionPanel();

    expect(screen.getByDisplayValue('Gate A')).toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_ADD_GATE)).toBeInTheDocument();

    rerender(
      <EncryptionPanel
        isNormalMode
        t={t}
        renderSessionWizardInfoTooltip={() => null}
        isCollapsed
        onToggleCollapsed={() => {}}
        launchCreateSbtModal={() => {}}
        activeCreateSbtTargetGateId="gate-1"
        activeCreateSbtTargetGate={{ id: 'gate-1', label: 'Gate A' }}
        encryptionGates={[{
          id: 'gate-1',
          label: 'Gate A',
          mode: 'any',
          color: '#4dffa4',
          sbts: [],
        }]}
        focusCreateSbtTargetGate={() => {}}
        updateEncryptionGate={() => {}}
        removeEncryptionGate={() => {}}
        normalizeSbtSelection={(value: unknown[]) => value}
        handleGateAddSbt={() => {}}
        handleGateRemoveSbt={() => {}}
        network="optimism-sepolia"
        pendingSbtSelectorOptions={[]}
        selectorSourceChainId={11155420}
        selectorSourceSessionConfig={{ slug: 'demo-session' }}
        resolvedActiveSessionSlug="demo-session"
        sbtCacheRevision={0}
        ensureLightSbtUniverse={() => {}}
        addEncryptionGate={() => {}}
        pendingSbtDrafts={[]}
        removePendingSbtDraft={() => {}}
      />
    );

    expect(screen.queryByDisplayValue('Gate A')).not.toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_ADD_GATE)).not.toBeInTheDocument();
  });
});
