import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import SbtPageMiniCard from './SbtPageMiniCard';

jest.mock('../Shared/CETooltip', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

const createProps = (overrides: Record<string, unknown> = {}) => ({
  burnLabel: 'Burn',
  burnedLabel: 'Burned',
  cardStyle: { cursor: 'pointer' },
  claimCountdown: 12,
  groupPasswordInput: '',
  hasGroupPasswordMint: false,
  hasInviteMint: false,
  hasPasswordMint: false,
  hasTokenMini: false,
  imageUrl: 'https://example.test/badge.png',
  isMintingActive: true,
  manualPasswordInput: '',
  miniActionFailureState: {},
  miniActionFailureStatusStyle: { color: 'red' },
  miniActionStatusStyle: { color: 'green' },
  miniBurnActionButtonClassName: 'burn-button',
  miniBurnButtonState: null,
  miniBurnContentState: null,
  miniControlTopMarginStyle: { marginTop: '10px' },
  miniInviteInputStyle: { maxWidth: '140px' },
  miniManualClaimButtonState: { disabled: false, isPending: false },
  miniManualClaimFinishContentState: { label: 'Finish', shouldRenderLabel: true },
  miniManualClaimStartContentState: { label: 'Join', shouldRenderLabel: true },
  miniMintActionButtonClassName: 'mint-button',
  miniMintFlowDisplayState: {},
  miniMintable: true,
  miniOpenMintButtonContentState: { idleLabel: 'Join', shouldRenderIdleLabel: true },
  miniOpenMintButtonState: { disabled: false },
  miniPasswordControlInputStyle: { maxWidth: '100px' },
  miniPasswordJoinButtonState: { disabled: false, isPending: false },
  miniPasswordJoinContentState: { label: 'Join', shouldRenderLabel: true },
  miniTokenActionDisplayState: null,
  mintFailedLabel: 'Mint Failed',
  mintStatusId: 'mintStatus-0xabc',
  mintedLabel: 'Minted',
  mintingLabel: 'Minting',
  onCardClick: jest.fn(),
  onCardKeyDown: jest.fn(),
  onClaimWithInviteCode: jest.fn(),
  onGroupPasswordInputChange: jest.fn(),
  onImageError: jest.fn(),
  onManualPasswordInputChange: jest.fn(),
  onMiniBurn: jest.fn(),
  onMiniMint: jest.fn(),
  onMintUnlimitedWithGroupPassword: jest.fn(),
  onShowMiniPasswordInput: jest.fn(),
  sbtAddress: '0x00000000000000000000000000000000000000f1',
  sbtName: 'Access Badge',
  shouldRenderEndedIndicator: false,
  shouldRenderLiveIndicator: true,
  showLockIcon: true,
  showMiniSbtAddress: true,
  ...overrides,
}) as React.ComponentProps<typeof SbtPageMiniCard>;

describe('SbtPageMiniCard', () => {
  it('renders the passive card identity, image, address, and live status', () => {
    render(<SbtPageMiniCard {...createProps()} />);

    expect(screen.getByTestId(E2E_TESTIDS.SBT_PAGE_IMAGE)).toHaveAttribute('src', 'https://example.test/badge.png');
    expect(screen.getByText('Access Badge')).toBeInTheDocument();
    expect(screen.getByLabelText('Minting Live')).toBeInTheDocument();
    expect(screen.getByText('0x000...00f1')).toBeInTheDocument();
    expect(screen.getByText('Minting Live')).toBeInTheDocument();
  });

  it('renders disclosure, password, invite, and manual claim controls from explicit state', () => {
    const onShowMiniPasswordInput = jest.fn();
    const onMintUnlimitedWithGroupPassword = jest.fn();
    const onClaimWithInviteCode = jest.fn();

    const { rerender } = render(
      <SbtPageMiniCard
        {...createProps({
          hasGroupPasswordMint: true,
          miniMintFlowDisplayState: { shouldRenderGroupPasswordDisclosureButton: true },
          onShowMiniPasswordInput,
        })}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(onShowMiniPasswordInput).toHaveBeenCalledTimes(1);

    rerender(
      <SbtPageMiniCard
        {...createProps({
          groupPasswordInput: 'group-code',
          hasGroupPasswordMint: true,
          miniMintFlowDisplayState: { shouldRenderGroupPasswordInput: true },
          onMintUnlimitedWithGroupPassword,
        })}
      />
    );
    expect(screen.getByPlaceholderText('Password')).toHaveValue('group-code');
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(onMintUnlimitedWithGroupPassword).toHaveBeenCalledTimes(1);

    rerender(
      <SbtPageMiniCard
        {...createProps({
          groupPasswordInput: 'invite-code',
          hasInviteMint: true,
          miniMintFlowDisplayState: { shouldRenderInviteInput: true },
          onClaimWithInviteCode,
        })}
      />
    );
    expect(screen.getByPlaceholderText('Invite Code')).toHaveValue('invite-code');
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(onClaimWithInviteCode).toHaveBeenCalledTimes(1);
  });

  it('preserves disabled and status states without invoking execution handlers directly', () => {
    const onMiniMint = jest.fn();
    const { rerender } = render(
      <SbtPageMiniCard
        {...createProps({
          hasPasswordMint: true,
          manualPasswordInput: 'manual-code',
          miniManualClaimButtonState: { disabled: true, isPending: false },
          miniMintFlowDisplayState: { shouldRenderManualPasswordStartInput: true },
          onMiniMint,
        })}
      />
    );

    expect(screen.getByPlaceholderText('Password')).toHaveValue('manual-code');
    expect(screen.getByRole('button', { name: 'Join' })).toBeDisabled();
    expect(onMiniMint).not.toHaveBeenCalled();

    rerender(
      <SbtPageMiniCard
        {...createProps({
          hasPasswordMint: true,
          miniMintFlowDisplayState: { shouldRenderManualClaimCountdown: true },
        })}
      />
    );
    expect(screen.getByText('Wait: 12s')).toBeInTheDocument();

    rerender(
      <SbtPageMiniCard
        {...createProps({
          miniActionFailureState: { showMintFailedStatus: true },
        })}
      />
    );
    expect(screen.getByText('Mint Failed')).toBeInTheDocument();
  });

  it('renders token burn and joined states from parent-derived permissions', () => {
    const onMiniBurn = jest.fn();
    const { rerender } = render(
      <SbtPageMiniCard
        {...createProps({
          hasTokenMini: true,
          miniBurnButtonState: { disabled: false },
          miniBurnContentState: { label: 'Burn', shouldRenderLabel: true },
          miniTokenActionDisplayState: { shouldRenderBurnButton: true },
          onMiniBurn,
        })}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Burn' }));
    expect(onMiniBurn).toHaveBeenCalledTimes(1);

    rerender(
      <SbtPageMiniCard
        {...createProps({
          hasTokenMini: true,
          miniTokenActionDisplayState: { shouldRenderJoinedStatus: true },
        })}
      />
    );
    expect(screen.getByText('Joined!')).toBeInTheDocument();

    rerender(
      <SbtPageMiniCard
        {...createProps({
          hasTokenMini: true,
          miniTokenActionDisplayState: { shouldRenderBurnedStatus: true },
        })}
      />
    );
    expect(screen.getByText('Burned!')).toBeInTheDocument();
  });
});
