import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import EncryptionPanel, { EncryptionPanelProps } from './EncryptionPanel';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

jest.mock(
  '../SBTs/SBTSelector',
  () =>
    function MockSBTSelector(props: {
      id?: string;
      selectedSBTs?: unknown[];
      additionalSBTOptions?: unknown[];
      chainId?: number | string | null;
      sessionSlug?: string;
      onAddSBT?: (sbt: { address: string; name: string }) => void;
      onRemoveSBT?: (address: string) => void;
    }) {
      return (
        <div
          data-testid="mock-sbt-selector"
          data-selector-id={props.id || ''}
          data-selected-count={Array.isArray(props.selectedSBTs) ? String(props.selectedSBTs.length) : '0'}
          data-option-count={
            Array.isArray(props.additionalSBTOptions) ? String(props.additionalSBTOptions.length) : '0'
          }
          data-chain-id={props.chainId == null ? '' : String(props.chainId)}
          data-session-slug={props.sessionSlug || ''}
        >
          <button type="button" onClick={() => props.onAddSBT?.({ address: '0xabc', name: 'Mock SBT' })}>
            Mock add selector SBT
          </button>
          <button type="button" onClick={() => props.onRemoveSBT?.('0xabc')}>
            Mock remove selector SBT
          </button>
        </div>
      );
    },
);

const t = (key: string) => key;

const renderEncryptionPanel = (props: Partial<EncryptionPanelProps> = {}) =>
  render(
    <EncryptionPanel
      isNormalMode
      t={t}
      renderSessionWizardInfoTooltip={() => null}
      isCollapsed={false}
      onToggleCollapsed={() => {}}
      launchCreateSbtModal={() => {}}
      activeCreateSbtTargetGateId="gate-1"
      activeCreateSbtTargetGate={{ id: 'gate-1', label: 'Gate A' }}
      encryptionGates={[
        {
          id: 'gate-1',
          label: 'Gate A',
          mode: 'any',
          color: '#4dffa4',
          sbts: [],
        },
      ]}
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
    />,
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

  it('shows the Worker Group drafts without redundant Session Access copy', () => {
    renderEncryptionPanel({ isWorkerCanonical: true, showOnChainGateControls: false });

    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_WORKER_GROUP_DRAFTS)).toBeInTheDocument();
    expect(screen.queryByText(/Session access uses passkeys and Worker roles/i)).not.toBeInTheDocument();
  });

  it('updates gate mode controls without touching selector handlers', () => {
    const updateEncryptionGate = jest.fn();
    const handleGateAddSbt = jest.fn();
    const handleGateRemoveSbt = jest.fn();
    renderEncryptionPanel({
      updateEncryptionGate,
      handleGateAddSbt,
      handleGateRemoveSbt,
    });

    fireEvent.click(screen.getByRole('button', { name: 'ANY' }));
    fireEvent.click(screen.getByRole('button', { name: 'ALL' }));

    expect(updateEncryptionGate).toHaveBeenNthCalledWith(1, 'gate-1', { mode: 'any' });
    expect(updateEncryptionGate).toHaveBeenNthCalledWith(2, 'gate-1', { mode: 'all' });
    expect(handleGateAddSbt).not.toHaveBeenCalled();
    expect(handleGateRemoveSbt).not.toHaveBeenCalled();
  });

  it('passes gate selector source and pending options to the SBT selector boundary', () => {
    const handleGateAddSbt = jest.fn();
    const handleGateRemoveSbt = jest.fn();
    renderEncryptionPanel({
      encryptionGates: [
        {
          id: 'gate-1',
          label: 'Gate A',
          mode: 'any',
          color: '#4dffa4',
          sbts: [{ address: '0x111', name: 'First SBT' }],
        },
      ],
      pendingSbtSelectorOptions: [{ address: '0x222', name: 'Pending SBT' }],
      selectorSourceChainId: 84532,
      selectorSourceSessionConfig: { slug: 'source-session' },
      resolvedActiveSessionSlug: 'fallback-session',
      handleGateAddSbt,
      handleGateRemoveSbt,
    });

    const selector = screen.getByTestId('mock-sbt-selector');
    expect(selector).toHaveAttribute('data-selector-id', 'encryption-gate-gate-1');
    expect(selector).toHaveAttribute('data-selected-count', '1');
    expect(selector).toHaveAttribute('data-option-count', '1');
    expect(selector).toHaveAttribute('data-chain-id', '84532');
    expect(selector).toHaveAttribute('data-session-slug', 'source-session');

    fireEvent.click(screen.getByRole('button', { name: 'Mock add selector SBT' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mock remove selector SBT' }));

    expect(handleGateAddSbt).toHaveBeenCalledWith('gate-1', { address: '0xabc', name: 'Mock SBT' });
    expect(handleGateRemoveSbt).toHaveBeenCalledWith('gate-1', '0xabc');
  });

  it('renders pending SBT draft statuses and remove actions without invoking selectors', () => {
    const removePendingSbtDraft = jest.fn();
    const handleGateAddSbt = jest.fn();
    const handleGateRemoveSbt = jest.fn();
    renderEncryptionPanel({
      pendingSbtDrafts: [
        {
          id: 'pending-writers',
          displayName: 'Writers Group',
          predictedAddress: '0x00000000000000000000000000000000000000a1',
          deployed: false,
        },
        {
          id: 'pending-readers',
          displayName: 'Readers Group',
          predictedAddress: '0x00000000000000000000000000000000000000a2',
          deployed: true,
        },
      ],
      removePendingSbtDraft,
      handleGateAddSbt,
      handleGateRemoveSbt,
    });

    const pendingCards = screen.getAllByTestId(E2E_TESTIDS.WIZARD_PENDING_SBT);
    expect(pendingCards).toHaveLength(2);
    expect(pendingCards[0]).toHaveAttribute('data-ce-sbt-address', '0x00000000000000000000000000000000000000a1');
    expect(pendingCards[0]).toHaveTextContent('Writers Group');
    expect(pendingCards[0]).toHaveTextContent('Deploys during Publish');
    expect(pendingCards[1]).toHaveTextContent('Readers Group');
    expect(pendingCards[1]).toHaveTextContent('Deployed');

    fireEvent.click(screen.getAllByTitle('Remove pending sbt')[0]);

    expect(removePendingSbtDraft).toHaveBeenCalledWith('0x00000000000000000000000000000000000000a1');
    expect(handleGateAddSbt).not.toHaveBeenCalled();
    expect(handleGateRemoveSbt).not.toHaveBeenCalled();
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
        encryptionGates={[
          {
            id: 'gate-1',
            label: 'Gate A',
            mode: 'any',
            color: '#4dffa4',
            sbts: [],
          },
        ]}
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
      />,
    );

    expect(screen.queryByDisplayValue('Gate A')).not.toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_ADD_GATE)).not.toBeInTheDocument();
  });
});
