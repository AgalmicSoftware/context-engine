import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import SbtPageAdminActions from './SbtPageAdminActions';

const createDisplayPlan = (
  overrides: Partial<React.ComponentProps<typeof SbtPageAdminActions>['displayPlan']> = {},
) => ({
  adminBurnButtonContentState: {
    failureLabel: 'Burn Failed',
    idleLabel: 'Burn SBT',
    shouldRenderFailure: false,
    shouldRenderIdleLabel: true,
    shouldRenderPendingIcon: false,
    shouldRenderSuccess: false,
    successLabel: 'Burned',
  },
  adminBurnStatusButtonState: {
    disabled: false,
    isFailure: false,
    isIdle: true,
    isPending: false,
    isSuccess: false,
  },
  adminGeneratedPasswordList: ['claim-one'],
  cachedPasswordList: [],
  canAdminBurn: true,
  combinedPasswords: ['claim-one'],
  effectiveIncludePreviousPasswords: false,
  hasPasswordMint: true,
  isInvite: false,
  onlyCachedPasswords: false,
  passwordExportControlsState: {
    effectiveIncludePreviousPasswordsChecked: false,
    renderIncludePreviousCheckbox: true,
    showCachedPasswordsIncludedNote: false,
  },
  passwordGenerationButtonState: {
    disabled: false,
  },
  passwordInventoryDisplayState: {
    shouldRenderGeneratedPasswordList: true,
    shouldRenderNoMoreInvitesEmptyState: false,
    shouldRenderPasswordGenerationSection: true,
    shouldRenderPreviousPasswordsSection: false,
  },
  passwordsToExport: ['claim-one'],
  showNoMoreInvites: false,
  showPasswordGen: true,
  ...overrides,
});

const createProps = (overrides: Partial<React.ComponentProps<typeof SbtPageAdminActions>> = {}) => ({
  burnLabel: 'Burn',
  burnSearchInput: '0xabc',
  burnSearchResultRecord: {
    address: '0x00000000000000000000000000000000000000a1',
    tokenId: '7',
  },
  displayPlan: createDisplayPlan(),
  exportFormat: 'json',
  onAdminBurn: jest.fn(),
  onBurnSearchChange: jest.fn(),
  onCopyOpenMintUrl: jest.fn(),
  onExportFormatChange: jest.fn(),
  onExportPasswords: jest.fn(),
  onGenerateAdminInvites: jest.fn(),
  onIncludePreviousPasswordsChange: jest.fn(),
  onPasswordGenerationCountChange: jest.fn(),
  openMintAutoJoinUrl: 'https://session.example.test/open',
  openMintUrlCopyIconState: {
    shouldRenderCopiedIcon: false,
    shouldRenderDefaultIcon: true,
  },
  passwordInviteLinkContext: {
    baseUrl: 'https://session.example.test',
    demoPath: '',
    encodeGroupPassword: null,
    isInvite: false,
    sbtAddr: '0xsbt',
    sbtBasePathValue: '/join',
  },
  passwordGenerationCount: '3',
  sbtLabel: 'SBT',
  ...overrides,
});

describe('SbtPageAdminActions', () => {
  it('renders open-mint and admin-burn controls through parent-owned callbacks', () => {
    const onAdminBurn = jest.fn();
    const onCopyOpenMintUrl = jest.fn();
    const onBurnSearchChange = jest.fn();

    render(
      <SbtPageAdminActions
        {...createProps({
          onAdminBurn,
          onBurnSearchChange,
          onCopyOpenMintUrl,
        })}
      />,
    );

    expect(screen.getByTestId('ce-sbt-page-open-mint-url')).toHaveTextContent('https://session.example.test/open');
    fireEvent.click(screen.getByRole('button', { name: 'Copy open mint URL' }));
    expect(onCopyOpenMintUrl).toHaveBeenCalledTimes(1);

    const searchInput = screen.getByPlaceholderText('Enter Address (0x...) or Token ID');
    fireEvent.change(searchInput, { target: { value: '8' } });
    expect(onBurnSearchChange).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Token ID: 7')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Burn SBT' }));
    expect(onAdminBurn).toHaveBeenCalledTimes(1);
  });

  it('renders generated password invites and delegates export controls', () => {
    const onExportFormatChange = jest.fn();
    const onExportPasswords = jest.fn();
    const onGenerateAdminInvites = jest.fn();
    const onIncludePreviousPasswordsChange = jest.fn();
    const onPasswordGenerationCountChange = jest.fn();

    render(
      <SbtPageAdminActions
        {...createProps({
          onExportFormatChange,
          onExportPasswords,
          onGenerateAdminInvites,
          onIncludePreviousPasswordsChange,
          onPasswordGenerationCountChange,
        })}
      />,
    );

    expect(screen.getByText('Generate Additional Password Invites')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /claim-one/ })).toHaveAttribute(
      'href',
      'https://session.example.test/join/0xsbt/claim-one',
    );

    fireEvent.change(screen.getByPlaceholderText('Number of additional passwords'), {
      target: { value: '5' },
    });
    expect(onPasswordGenerationCountChange).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Generate Invites' }));
    expect(onGenerateAdminInvites).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Include previous passwords' }));
    expect(onIncludePreviousPasswordsChange).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'csv' } });
    expect(onExportFormatChange).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Export Passwords' }));
    expect(onExportPasswords).toHaveBeenCalledTimes(1);
  });

  it('keeps disabled admin burn and invite generation actions inert', () => {
    const onAdminBurn = jest.fn();
    const onGenerateAdminInvites = jest.fn();

    render(
      <SbtPageAdminActions
        {...createProps({
          displayPlan: createDisplayPlan({
            adminBurnStatusButtonState: {
              disabled: true,
              isFailure: false,
              isIdle: true,
              isPending: false,
              isSuccess: false,
            },
            passwordGenerationButtonState: {
              disabled: true,
            },
          }),
          onAdminBurn,
          onGenerateAdminInvites,
        })}
      />,
    );

    const burnButton = screen.getByRole('button', { name: 'Burn SBT' });
    const generateButton = screen.getByRole('button', { name: 'Generate Invites' });

    expect(burnButton).toBeDisabled();
    expect(generateButton).toBeDisabled();

    fireEvent.click(burnButton);
    fireEvent.click(generateButton);

    expect(onAdminBurn).not.toHaveBeenCalled();
    expect(onGenerateAdminInvites).not.toHaveBeenCalled();
  });

  it('renders pending and failure admin burn state from the display contract', () => {
    const { rerender } = render(
      <SbtPageAdminActions
        {...createProps({
          openMintAutoJoinUrl: '',
          displayPlan: createDisplayPlan({
            adminBurnButtonContentState: {
              failureLabel: 'Burn Failed',
              idleLabel: 'Burn SBT',
              shouldRenderFailure: false,
              shouldRenderIdleLabel: false,
              shouldRenderPendingIcon: true,
              shouldRenderSuccess: false,
              successLabel: 'Burned',
            },
            adminBurnStatusButtonState: {
              disabled: true,
              isFailure: false,
              isIdle: false,
              isPending: true,
              isSuccess: false,
            },
            passwordInventoryDisplayState: {
              shouldRenderGeneratedPasswordList: false,
              shouldRenderNoMoreInvitesEmptyState: false,
              shouldRenderPasswordGenerationSection: false,
              shouldRenderPreviousPasswordsSection: false,
            },
          }),
        })}
      />,
    );

    expect(screen.getAllByRole('button')[0]).toBeDisabled();

    rerender(
      <SbtPageAdminActions
        {...createProps({
          openMintAutoJoinUrl: '',
          displayPlan: createDisplayPlan({
            adminBurnButtonContentState: {
              failureLabel: 'Burn Failed',
              idleLabel: 'Burn SBT',
              shouldRenderFailure: true,
              shouldRenderIdleLabel: false,
              shouldRenderPendingIcon: false,
              shouldRenderSuccess: false,
              successLabel: 'Burned',
            },
            adminBurnStatusButtonState: {
              disabled: true,
              isFailure: true,
              isIdle: false,
              isPending: false,
              isSuccess: false,
            },
            passwordInventoryDisplayState: {
              shouldRenderGeneratedPasswordList: false,
              shouldRenderNoMoreInvitesEmptyState: false,
              shouldRenderPasswordGenerationSection: false,
              shouldRenderPreviousPasswordsSection: false,
            },
          }),
        })}
      />,
    );

    expect(screen.getByRole('button', { name: 'Burn Failed' })).toBeDisabled();
  });

  it('renders previous-password and no-more-invite states from display plans', () => {
    const { rerender } = render(
      <SbtPageAdminActions
        {...createProps({
          displayPlan: createDisplayPlan({
            passwordInventoryDisplayState: {
              shouldRenderGeneratedPasswordList: false,
              shouldRenderNoMoreInvitesEmptyState: false,
              shouldRenderPasswordGenerationSection: false,
              shouldRenderPreviousPasswordsSection: true,
            },
          }),
        })}
      />,
    );

    expect(screen.getByText('Previously Generated Password Invites')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /claim-one/ })).toHaveAttribute(
      'href',
      'https://session.example.test/join/0xsbt/claim-one',
    );

    rerender(
      <SbtPageAdminActions
        {...createProps({
          openMintAutoJoinUrl: '',
          displayPlan: createDisplayPlan({
            canAdminBurn: false,
            combinedPasswords: [],
            passwordInventoryDisplayState: {
              shouldRenderGeneratedPasswordList: false,
              shouldRenderNoMoreInvitesEmptyState: true,
              shouldRenderPasswordGenerationSection: false,
              shouldRenderPreviousPasswordsSection: false,
            },
          }),
        })}
      />,
    );

    expect(screen.getByText('No Additional Password Invites')).toBeInTheDocument();
  });
});
