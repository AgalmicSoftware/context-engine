import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import SbtPageMiniCard from './SbtPageMiniCard';
import type { SbtPageMiniManualClaimActionRequest, SbtPageMiniMintActionPlan } from './sbtPageActionDisplayHelpers';

jest.mock('../Shared/CETooltip', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

const createProps = (overrides: Record<string, unknown> = {}) =>
  ({
    burnLabel: 'Burn',
    burnedLabel: 'Burned',
    cardStyle: { cursor: 'pointer' },
    groupPasswordInput: '',
    hasTokenMini: false,
    imageUrl: 'https://example.test/badge.png',
    isMintingActive: true,
    miniActionFailureState: {},
    miniActionFailureStatusStyle: { color: 'red' },
    miniActionStatusStyle: { color: 'green' },
    miniBurnActionButtonClassName: 'burn-button',
    miniBurnButtonState: null,
    miniBurnContentState: null,
    miniControlTopMarginStyle: { marginTop: '10px' },
    miniInviteInputStyle: { maxWidth: '140px' },
    miniManualClaimActionRequest: createMiniManualClaimActionRequest(),
    miniMintActionPlan: createMiniMintActionPlan({
      blockedReason: 'mini-mint-unavailable',
      disabled: true,
      handlerKind: 'none',
      inertReason: 'hidden',
      isInteractive: false,
      labelKind: 'none',
      shouldRenderMintArea: false,
      viewKind: 'hidden',
    }),
    miniMintActionButtonClassName: 'mint-button',
    miniOpenMintButtonState: { disabled: false, isIdle: true, isPending: false },
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

const createMiniMintActionPlan = (overrides: Partial<SbtPageMiniMintActionPlan> = {}): SbtPageMiniMintActionPlan => ({
  blockedReason: 'none',
  disabled: false,
  handlerKind: 'mini-mint',
  inertReason: 'none',
  isInteractive: true,
  labelKind: 'status',
  shouldRenderMintArea: true,
  viewKind: 'open-mint-button',
  ...overrides,
});

const createMiniManualClaimActionRequest = (
  overrides: Partial<SbtPageMiniManualClaimActionRequest> = {},
): SbtPageMiniManualClaimActionRequest => ({
  buttonState: { disabled: true, isPending: false },
  contentState: { label: '', shouldRenderLabel: false, shouldRenderPendingIcon: false },
  disabled: true,
  handlerKind: 'none',
  inputDisabled: false,
  inputType: 'text',
  inputValue: '',
  placeholder: 'Password',
  shouldRenderInputAction: false,
  shouldRenderStatus: false,
  statusText: '',
  viewKind: 'hidden',
  ...overrides,
});

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
    const onMiniMint = jest.fn();

    const { rerender } = render(
      <SbtPageMiniCard
        {...createProps({
          miniMintActionPlan: createMiniMintActionPlan({
            handlerKind: 'show-password-input',
            labelKind: 'join',
            viewKind: 'group-password-disclosure',
          }),
          onShowMiniPasswordInput,
        })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(onShowMiniPasswordInput).toHaveBeenCalledTimes(1);

    rerender(
      <SbtPageMiniCard
        {...createProps({
          groupPasswordInput: 'group-code',
          miniMintActionPlan: createMiniMintActionPlan({
            handlerKind: 'mint-unlimited-with-group-password',
            labelKind: 'join',
            viewKind: 'group-password-input',
          }),
          onMintUnlimitedWithGroupPassword,
        })}
      />,
    );
    expect(screen.getByPlaceholderText('Password')).toHaveValue('group-code');
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(onMintUnlimitedWithGroupPassword).toHaveBeenCalledTimes(1);

    rerender(
      <SbtPageMiniCard
        {...createProps({
          groupPasswordInput: 'invite-code',
          miniMintActionPlan: createMiniMintActionPlan({
            handlerKind: 'claim-with-invite-code',
            labelKind: 'join',
            viewKind: 'invite-input',
          }),
          onClaimWithInviteCode,
        })}
      />,
    );
    expect(screen.getByPlaceholderText('Invite Code')).toHaveValue('invite-code');
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(onClaimWithInviteCode).toHaveBeenCalledTimes(1);

    rerender(
      <SbtPageMiniCard
        {...createProps({
          miniManualClaimActionRequest: createMiniManualClaimActionRequest({
            buttonState: { disabled: false, isPending: false },
            contentState: { label: 'Finish', shouldRenderLabel: true },
            disabled: false,
            handlerKind: 'mini-mint',
            inputValue: 'manual-code',
            shouldRenderInputAction: true,
            viewKind: 'manual-password-finish-input',
          }),
          miniMintActionPlan: createMiniMintActionPlan({
            handlerKind: 'mini-mint',
            labelKind: 'finish',
            viewKind: 'manual-password-finish-input',
          }),
          onMiniMint,
        })}
      />,
    );
    expect(screen.getByPlaceholderText('Password')).toHaveValue('manual-code');
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    expect(onMiniMint).toHaveBeenCalledTimes(1);
  });

  it('preserves disabled and status states without invoking execution handlers directly', () => {
    const onMiniMint = jest.fn();
    const { rerender } = render(
      <SbtPageMiniCard
        {...createProps({
          miniManualClaimActionRequest: createMiniManualClaimActionRequest({
            buttonState: { disabled: true, isPending: false },
            contentState: { label: 'Join', shouldRenderLabel: true },
            disabled: true,
            handlerKind: 'mini-mint',
            inputDisabled: false,
            inputValue: 'manual-code',
            shouldRenderInputAction: true,
            viewKind: 'manual-password-start-input',
          }),
          miniMintActionPlan: createMiniMintActionPlan({
            disabled: true,
            handlerKind: 'mini-mint',
            inertReason: 'disabled',
            isInteractive: false,
            labelKind: 'join',
            viewKind: 'manual-password-start-input',
          }),
          onMiniMint,
        })}
      />,
    );

    expect(screen.getByPlaceholderText('Password')).toHaveValue('manual-code');
    expect(screen.getByRole('button', { name: 'Join' })).toBeDisabled();
    expect(onMiniMint).not.toHaveBeenCalled();

    rerender(
      <SbtPageMiniCard
        {...createProps({
          miniManualClaimActionRequest: createMiniManualClaimActionRequest({
            disabled: false,
            handlerKind: 'none',
            shouldRenderStatus: true,
            statusText: 'Wait: 12s',
            viewKind: 'manual-claim-countdown',
          }),
          miniMintActionPlan: createMiniMintActionPlan({
            handlerKind: 'none',
            inertReason: 'status-only',
            isInteractive: false,
            labelKind: 'countdown',
            viewKind: 'manual-claim-countdown',
          }),
        })}
      />,
    );
    expect(screen.getByText('Wait: 12s')).toBeInTheDocument();

    rerender(
      <SbtPageMiniCard
        {...createProps({
          miniActionFailureState: { showMintFailedStatus: true },
        })}
      />,
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
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Burn' }));
    expect(onMiniBurn).toHaveBeenCalledTimes(1);

    rerender(
      <SbtPageMiniCard
        {...createProps({
          hasTokenMini: true,
          miniTokenActionDisplayState: { shouldRenderJoinedStatus: true },
        })}
      />,
    );
    expect(screen.getByText('Joined!')).toBeInTheDocument();

    rerender(
      <SbtPageMiniCard
        {...createProps({
          hasTokenMini: true,
          miniTokenActionDisplayState: { shouldRenderBurnedStatus: true },
        })}
      />,
    );
    expect(screen.getByText('Burned!')).toBeInTheDocument();
  });
});
