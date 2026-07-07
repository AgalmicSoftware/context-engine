import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import UserPageHeader from './UserPageHeader';
import styles from './UserPage.module.scss';

jest.mock('../Shared/CETooltip', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

const createProps = (overrides: Partial<React.ComponentProps<typeof UserPageHeader>> = {}) => ({
  addressDisplay: <span>Profile Label</span>,
  analyzeButtonDisplayState: {
    ariaBusy: false,
    disabled: false,
    label: 'Analyze',
    shouldRenderAnalyzing: false,
    title: 'Analyze profile',
  },
  avatarDisplayState: {
    avatarStyle: { backgroundImage: 'url(blockie)' },
  },
  bookmarkButtonDisplayState: {
    ariaLabel: 'Bookmark user',
    iconStyle: { color: 'rgb(255, 215, 0)' },
    title: 'Bookmark this user',
  },
  bookmarksHref: '/bookmarks',
  bookmarksLinkDisplayState: {
    className: styles.bookmarksLink,
    style: { display: 'inline-flex' },
  },
  compareButtonDisplayState: {
    disabled: false,
    shouldRenderCollapseClosedIcon: true,
    shouldRenderCollapseOpenIcon: false,
    title: 'Compare profiles',
  },
  copyIconDisplayState: {
    copiedIconStyle: { display: 'none' },
    defaultIconStyle: { display: 'inline-block' },
  },
  explorerUrl: 'https://explorer.example.test/address/0xabc',
  headerActionVisibility: {
    showBookmarkButton: true,
    showBookmarksLink: true,
    showCopyAddressButton: true,
    showExplorerLink: true,
    showNicknameEditor: false,
    showSimulatedBadge: true,
  },
  headerBookmarkClassName: `${styles.bookmarkButton} ${styles.headerBookmark}`,
  isEditingUsername: false,
  isOwner: false,
  minimized: false,
  nicknameEnteredIndicatorDisplayState: {
    shouldRenderEnteredIndicator: false,
  },
  nicknameInput: '',
  onAnalyzeUser: jest.fn(),
  onBookmark: jest.fn(),
  onCollapseToggle: jest.fn(),
  onCopyAddress: jest.fn(),
  onNicknameBlur: jest.fn(),
  onNicknameChange: jest.fn(),
  onNicknameEdit: jest.fn(),
  onNicknameKeyDown: jest.fn(),
  onUsernameBlur: jest.fn(),
  onUsernameChange: jest.fn(),
  onUsernameEdit: jest.fn(),
  onUsernameKeyDown: jest.fn(),
  showPen: true,
  showUsernamePen: true,
  username: '',
  usernameEnteredIndicatorDisplayState: {
    shouldRenderEnteredIndicator: false,
  },
  usernameErrorDisplayState: {
    shouldRenderUsernameError: false,
    usernameErrorText: '',
  },
  ...overrides,
});

describe('UserPageHeader', () => {
  it('renders identity actions and forwards parent-owned handlers', () => {
    const onAnalyzeUser = jest.fn();
    const onBookmark = jest.fn();
    const onCollapseToggle = jest.fn();
    const onCopyAddress = jest.fn();
    const onNicknameEdit = jest.fn();
    const onUsernameEdit = jest.fn();
    const { container } = render(
      <UserPageHeader
        {...createProps({
          onAnalyzeUser,
          onBookmark,
          onCollapseToggle,
          onCopyAddress,
          onNicknameEdit,
          onUsernameEdit,
        })}
      />,
    );

    expect(screen.getByText('Profile Label')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'User avatar' })).toHaveStyle({
      backgroundImage: 'url(blockie)',
    });
    expect(
      screen.getByText('This is a simulated user whose answers are generated based on documents.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View address on explorer' })).toHaveAttribute(
      'href',
      'https://explorer.example.test/address/0xabc',
    );
    expect(screen.getByRole('link', { name: 'View address on explorer' })).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('link', { name: 'View address on explorer' })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
    expect(screen.getByRole('link', { name: /My Bookmarks/ })).toHaveAttribute('href', '/bookmarks');

    fireEvent.click(screen.getByRole('button', { name: 'Edit nickname' }));
    fireEvent.click(screen.getByRole('button', { name: 'Set username' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bookmark user' }));
    fireEvent.click(screen.getByRole('button', { name: /Compare/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Analyze' }));

    const copyAddressButton = container.querySelector(`button.${styles.copyButton}:not([aria-label])`);
    expect(copyAddressButton).not.toBeNull();
    fireEvent.click(copyAddressButton as HTMLElement);

    expect(onNicknameEdit).toHaveBeenCalledTimes(1);
    expect(onUsernameEdit).toHaveBeenCalledTimes(1);
    expect(onBookmark).toHaveBeenCalledTimes(1);
    expect(onCollapseToggle).toHaveBeenCalledTimes(1);
    expect(onAnalyzeUser).toHaveBeenCalledTimes(1);
    expect(onCopyAddress).toHaveBeenCalledTimes(1);
  });

  it('keeps disabled compare and analyze controls inert', () => {
    const onAnalyzeUser = jest.fn();
    const onCollapseToggle = jest.fn();
    render(
      <UserPageHeader
        {...createProps({
          analyzeButtonDisplayState: {
            ariaBusy: true,
            disabled: true,
            label: 'Analyzing',
            shouldRenderAnalyzing: true,
            title: 'Analysis already running',
          },
          compareButtonDisplayState: {
            disabled: true,
            shouldRenderCollapseClosedIcon: false,
            shouldRenderCollapseOpenIcon: true,
            title: 'Comparison unavailable',
          },
          onAnalyzeUser,
          onCollapseToggle,
        })}
      />,
    );

    const compareButton = screen.getByRole('button', { name: /Compare/ });
    const analyzeButton = screen.getByRole('button', { name: /Analyzing/ });
    expect(compareButton).toBeDisabled();
    expect(compareButton).toHaveAttribute('title', 'Comparison unavailable');
    expect(analyzeButton).toBeDisabled();
    expect(analyzeButton).toHaveAttribute('aria-busy', 'true');
    expect(analyzeButton).toHaveAttribute('title', 'Analysis already running');

    fireEvent.click(compareButton);
    fireEvent.click(analyzeButton);

    expect(onCollapseToggle).not.toHaveBeenCalled();
    expect(onAnalyzeUser).not.toHaveBeenCalled();
  });

  it('renders nickname and username editors with entered indicators and explicit handlers', () => {
    const onNicknameBlur = jest.fn();
    const onNicknameChange = jest.fn();
    const onNicknameKeyDown = jest.fn();
    const onUsernameBlur = jest.fn();
    const onUsernameChange = jest.fn();
    const onUsernameKeyDown = jest.fn();
    render(
      <UserPageHeader
        {...createProps({
          headerActionVisibility: {
            showNicknameEditor: true,
          },
          isEditingUsername: true,
          isOwner: true,
          nicknameEnteredIndicatorDisplayState: {
            shouldRenderEnteredIndicator: true,
          },
          nicknameInput: 'Ada',
          onNicknameBlur,
          onNicknameChange,
          onNicknameKeyDown,
          onUsernameBlur,
          onUsernameChange,
          onUsernameKeyDown,
          showPen: false,
          showUsernamePen: false,
          username: 'owner-name',
          usernameEnteredIndicatorDisplayState: {
            shouldRenderEnteredIndicator: true,
          },
        })}
      />,
    );

    const nicknameInput = screen.getByLabelText('Set nickname');
    const usernameInput = screen.getByLabelText('Set username');
    expect(nicknameInput).toHaveValue('Ada');
    expect(usernameInput).toHaveValue('owner-name');
    expect(screen.getByTitle('Nickname entered')).toBeDisabled();
    expect(screen.getByTitle('Username entered')).toBeDisabled();

    fireEvent.change(nicknameInput, { target: { value: 'New Nick' } });
    fireEvent.blur(nicknameInput);
    fireEvent.keyDown(nicknameInput, { key: 'Enter' });
    fireEvent.change(usernameInput, { target: { value: 'New User' } });
    fireEvent.blur(usernameInput);
    fireEvent.keyDown(usernameInput, { key: 'Escape' });

    expect(onNicknameChange).toHaveBeenCalledTimes(1);
    expect(onNicknameBlur).toHaveBeenCalled();
    expect(onNicknameKeyDown).toHaveBeenCalledTimes(1);
    expect(onUsernameChange).toHaveBeenCalledTimes(1);
    expect(onUsernameBlur).toHaveBeenCalled();
    expect(onUsernameKeyDown).toHaveBeenCalledTimes(1);
  });

  it('keeps minimized header actions limited to the username error display', () => {
    render(
      <UserPageHeader
        {...createProps({
          minimized: true,
          usernameErrorDisplayState: {
            shouldRenderUsernameError: true,
            usernameErrorText: 'Cannot persist username.',
          },
        })}
      />,
    );

    expect(screen.getByText('Cannot persist username.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Compare/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Analyze' })).toBeNull();
  });
});
