import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import {
  SbtPageBurnActionSurface,
  SbtPageMintActionSurface,
  renderSbtPageFullActionSurfaces,
} from './SbtPageFullActionButtons';
import {
  resolveSbtPageBurnActionPlan,
  resolveSbtPageBurnStatusButtonState,
  resolveSbtPageFullActionDisplayPlan,
  resolveSbtPageMintButtonDisplayState,
  resolveSbtPageStatusButtonContentState,
  type SbtPageBurnActionPlan,
  type SbtPageMintButtonDisplayState,
} from './sbtPageActionDisplayHelpers';

const activeSbtInfo = {
  burnAuth: 1,
  mintingEndTime: 0,
};

const createMintProps = (
  displayState: SbtPageMintButtonDisplayState,
  overrides: Partial<React.ComponentProps<typeof SbtPageMintActionSurface>> = {},
): React.ComponentProps<typeof SbtPageMintActionSurface> => ({
  buttonClassName: 'mint-button',
  displayState,
  groupPasswordInput: 'join-code',
  onClaimWithInviteCode: jest.fn(),
  onGroupPasswordInputChange: jest.fn(),
  onManualPasswordInputChange: jest.fn(),
  onMint: jest.fn(),
  onMintUnlimitedWithGroupPassword: jest.fn(),
  onOpenMintTransaction: jest.fn(),
  ...overrides,
});

const createMintDisplayState = (overrides: Parameters<typeof resolveSbtPageMintButtonDisplayState>[0] = {}) =>
  resolveSbtPageMintButtonDisplayState({
    burningStatus: 'idle',
    groupPasswordInput: 'join-code',
    mintingStatus: 'idle',
    nowSeconds: 100,
    sbtInfo: activeSbtInfo,
    userHasSBT: false,
    ...overrides,
  });

describe('SbtPageMintActionSurface', () => {
  it('routes group-password mint through the named parent dispatch', () => {
    const onGroupPasswordInputChange = jest.fn();
    const onMintUnlimitedWithGroupPassword = jest.fn();
    render(
      <SbtPageMintActionSurface
        {...createMintProps(
          createMintDisplayState({
            hasGroupPasswordMint: true,
          }),
          {
            onGroupPasswordInputChange,
            onMintUnlimitedWithGroupPassword,
          },
        )}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Group Password'), { target: { value: 'next-code' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));

    expect(screen.getByPlaceholderText('Group Password')).toHaveValue('join-code');
    expect(onGroupPasswordInputChange).toHaveBeenCalledTimes(1);
    expect(onMintUnlimitedWithGroupPassword).toHaveBeenCalledTimes(1);
    expect(onMintUnlimitedWithGroupPassword).toHaveBeenCalledWith();
  });

  it('passes invite-code mint args without owning claim execution', () => {
    const onClaimWithInviteCode = jest.fn();
    render(
      <SbtPageMintActionSurface
        {...createMintProps(
          createMintDisplayState({
            hasInviteMint: true,
          }),
          {
            onClaimWithInviteCode,
          },
        )}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Join' }));

    expect(onClaimWithInviteCode).toHaveBeenCalledTimes(1);
    expect(onClaimWithInviteCode).toHaveBeenCalledWith('join-code');
  });

  it('opens the existing mint transaction instead of dispatching another mint', () => {
    const onMint = jest.fn();
    const onOpenMintTransaction = jest.fn();
    render(
      <SbtPageMintActionSurface
        {...createMintProps(
          createMintDisplayState({
            lastMintTxHash: '0xmint',
            mintedLabel: 'Minted',
            mintingStatus: 'success',
          }),
          {
            onMint,
            onOpenMintTransaction,
          },
        )}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Minted' }));

    expect(onOpenMintTransaction).toHaveBeenCalledTimes(1);
    expect(onMint).not.toHaveBeenCalled();
  });

  it('keeps the legacy open-mint button wired to the parent mint handler', () => {
    const onMint = jest.fn();
    render(
      <SbtPageMintActionSurface
        {...createMintProps(createMintDisplayState(), {
          onMint,
        })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Join' }));

    expect(onMint).toHaveBeenCalledTimes(1);
    expect(onMint).toHaveBeenCalledWith(true);
  });

  it('renders no mint controls when the descriptor is hidden', () => {
    const { container } = render(
      <SbtPageMintActionSurface
        {...createMintProps(
          createMintDisplayState({
            userHasSBT: true,
          }),
        )}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});

const createBurnProps = (
  plan: SbtPageBurnActionPlan,
  overrides: Partial<React.ComponentProps<typeof SbtPageBurnActionSurface>> = {},
): React.ComponentProps<typeof SbtPageBurnActionSurface> => {
  const displayState = resolveSbtPageBurnStatusButtonState({
    burningStatus: 'idle',
  });

  return {
    buttonClassName: 'burn-button',
    contentState: resolveSbtPageStatusButtonContentState({
      idleLabel: 'Burn',
      isIdle: displayState.isIdle,
      isPending: displayState.isPending,
      isSuccess: displayState.isSuccess,
      successLabel: 'Burned',
    }),
    displayState,
    onBurn: jest.fn(),
    plan,
    ...overrides,
  };
};

describe('SbtPageBurnActionSurface', () => {
  it('routes owner burn through the named parent dispatch', () => {
    const onBurn = jest.fn();
    render(
      <SbtPageBurnActionSurface
        {...createBurnProps(
          resolveSbtPageBurnActionPlan({
            account: '0xholder',
            sbtInfo: activeSbtInfo,
            userHasSBT: true,
          }),
          {
            onBurn,
          },
        )}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Burn' }));

    expect(onBurn).toHaveBeenCalledTimes(1);
  });

  it('renders no burn button when the parent descriptor is hidden', () => {
    const { container } = render(
      <SbtPageBurnActionSurface
        {...createBurnProps(
          resolveSbtPageBurnActionPlan({
            account: '0xholder',
            sbtInfo: activeSbtInfo,
            userHasSBT: false,
          }),
        )}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});

describe('renderSbtPageFullActionSurfaces', () => {
  it('builds the full mint surface from named execution props', () => {
    const onMint = jest.fn();
    const surfaces = renderSbtPageFullActionSurfaces({
      actionDisplayPlan: resolveSbtPageFullActionDisplayPlan({
        account: '0xholder',
        actionClassName: 'action-button',
        burningStatus: 'idle',
        mintButtonClassName: 'mint-button',
        mintingStatus: 'idle',
        nowSeconds: 100,
        sbtInfo: activeSbtInfo,
        userHasSBT: false,
      }),
      burnExecution: {
        onBurn: jest.fn(),
      },
      groupPasswordInput: 'join-code',
      mintExecution: {
        onClaimWithInviteCode: jest.fn(),
        onGroupPasswordInputChange: jest.fn(),
        onManualPasswordInputChange: jest.fn(),
        onMint,
        onMintUnlimitedWithGroupPassword: jest.fn(),
        onOpenMintTransaction: jest.fn(),
      },
    });

    render(
      <>
        {surfaces.mintButton}
        {surfaces.burnButton}
      </>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));

    expect(onMint).toHaveBeenCalledTimes(1);
    expect(onMint).toHaveBeenCalledWith(true);
    expect(screen.queryByRole('button', { name: 'Burn' })).toBeNull();
  });

  it('builds the full burn surface from named execution props', () => {
    const onBurn = jest.fn();
    const surfaces = renderSbtPageFullActionSurfaces({
      actionDisplayPlan: resolveSbtPageFullActionDisplayPlan({
        account: '0xholder',
        actionClassName: 'action-button',
        burnedLabel: 'Burned',
        burningStatus: 'idle',
        burnButtonClassName: 'burn-button',
        burnLabel: 'Burn',
        mintingStatus: 'idle',
        nowSeconds: 100,
        sbtInfo: activeSbtInfo,
        userHasSBT: true,
      }),
      burnExecution: {
        onBurn,
      },
      mintExecution: {
        onClaimWithInviteCode: jest.fn(),
        onGroupPasswordInputChange: jest.fn(),
        onManualPasswordInputChange: jest.fn(),
        onMint: jest.fn(),
        onMintUnlimitedWithGroupPassword: jest.fn(),
        onOpenMintTransaction: jest.fn(),
      },
    });

    render(
      <>
        {surfaces.mintButton}
        {surfaces.burnButton}
      </>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Burn' }));

    expect(onBurn).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Join' })).toBeNull();
  });
});
