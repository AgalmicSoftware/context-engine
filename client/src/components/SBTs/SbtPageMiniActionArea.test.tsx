import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import SbtPageMiniActionArea from './SbtPageMiniActionArea';
import type { SbtPageMiniManualClaimActionRequest, SbtPageMiniMintActionPlan } from './sbtPageActionDisplayHelpers';

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

const createProps = (
  overrides: Partial<React.ComponentProps<typeof SbtPageMiniActionArea>> = {},
): React.ComponentProps<typeof SbtPageMiniActionArea> => ({
  burnLabel: 'Burn',
  burnedLabel: 'Burned',
  groupPasswordInput: '',
  hasTokenMini: false,
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
  mintedLabel: 'Minted',
  onClaimWithInviteCode: jest.fn(),
  onGroupPasswordInputChange: jest.fn(),
  onManualPasswordInputChange: jest.fn(),
  onMiniBurn: jest.fn(),
  onMiniMint: jest.fn(),
  onMintUnlimitedWithGroupPassword: jest.fn(),
  onShowMiniPasswordInput: jest.fn(),
  ...overrides,
});

describe('SbtPageMiniActionArea', () => {
  it('routes disclosure, group-password, invite, and manual claim controls through explicit callbacks', () => {
    const onShowMiniPasswordInput = jest.fn();
    const onMintUnlimitedWithGroupPassword = jest.fn();
    const onClaimWithInviteCode = jest.fn();
    const onMiniMint = jest.fn();

    const { rerender } = render(
      <SbtPageMiniActionArea
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
      <SbtPageMiniActionArea
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
      <SbtPageMiniActionArea
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
      <SbtPageMiniActionArea
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

  it('keeps status, token, and failure descriptors passive', () => {
    const onMiniBurn = jest.fn();
    const { rerender } = render(
      <SbtPageMiniActionArea
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
          onMiniBurn,
        })}
      />,
    );
    expect(screen.getByText('Wait: 12s')).toBeInTheDocument();
    expect(onMiniBurn).not.toHaveBeenCalled();

    rerender(
      <SbtPageMiniActionArea
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
      <SbtPageMiniActionArea
        {...createProps({
          hasTokenMini: true,
          miniTokenActionDisplayState: { shouldRenderJoinedStatus: true },
        })}
      />,
    );
    expect(screen.getByText('Joined!')).toBeInTheDocument();

    rerender(
      <SbtPageMiniActionArea
        {...createProps({
          hasTokenMini: true,
          miniTokenActionDisplayState: { shouldRenderBurnedStatus: true },
        })}
      />,
    );
    expect(screen.getByText('Burned!')).toBeInTheDocument();

    rerender(
      <SbtPageMiniActionArea
        {...createProps({
          miniActionFailureState: { showMintFailedStatus: true },
        })}
      />,
    );
    expect(screen.getByText('Mint Failed')).toBeInTheDocument();
  });
});
