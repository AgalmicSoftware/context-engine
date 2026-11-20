import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';

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
  showUsernameButton: true,
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

    fireEvent.click(screen.getByRole('button', { name: 'Edit private label' }));
    fireEvent.click(screen.getByRole('button', { name: 'Set username' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bookmark user' }));
    fireEvent.click(screen.getByRole('button', { name: /Compare/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Analyze' }));

    const copyAddressButton = screen.getByRole('button', { name: 'Copy address' });
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
          showUsernameButton: false,
          username: 'owner-name',
          usernameEnteredIndicatorDisplayState: {
            shouldRenderEnteredIndicator: true,
          },
        })}
      />,
    );

    const nicknameInput = screen.getByLabelText('Private label');
    const usernameInput = screen.getByLabelText('Set username');
    expect(nicknameInput).toHaveAccessibleDescription('Only you see this, on this device');
    expect(usernameInput).toHaveAccessibleDescription('Saved on this device only');
    expect(nicknameInput).toHaveValue('Ada');
    expect(usernameInput).toHaveValue('owner-name');
    expect(screen.getByTitle('Label entered')).toBeDisabled();
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

  it("marks a label on someone else's account as yours, not their name", () => {
    const { rerender } = render(<UserPageHeader {...createProps({ privateLabelTag: 'your label' })} />);
    expect(screen.getByText('your label')).toHaveAttribute(
      'title',
      expect.stringMatching(/Only you see it, on this device; it isn't their name/),
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Profile Label, your label');

    rerender(<UserPageHeader {...createProps({ privateLabelTag: 'your label: Ada' })} />);
    expect(screen.getByText('your label: Ada')).toBeInTheDocument();

    rerender(<UserPageHeader {...createProps({ privateLabelTag: '' })} />);
    expect(screen.queryByText(/your label/)).toBeNull();
  });

  it('offers the username as a button under the address, named for whether one is set', () => {
    const onUsernameEdit = jest.fn();
    const { rerender } = render(<UserPageHeader {...createProps({ isOwner: true, onUsernameEdit })} />);
    const button = screen.getByRole('button', { name: 'Set username' });
    // Under the address, not among the icons beside it.
    expect(screen.getByRole('heading', { level: 1 })).not.toContainElement(button);
    expect(screen.getByRole('heading', { level: 1 }).parentElement).toContainElement(button);
    fireEvent.click(button);
    expect(onUsernameEdit).toHaveBeenCalledTimes(1);

    rerender(<UserPageHeader {...createProps({ isOwner: true, username: 'Sam' })} />);
    expect(screen.getByRole('button', { name: 'Change username' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Set username' })).toBeNull();

    rerender(<UserPageHeader {...createProps({ showUsernameButton: false })} />);
    expect(screen.queryByRole('button', { name: /username/ })).toBeNull();
  });

  it('says where your own username is saved', () => {
    const props = { isOwner: true, isEditingUsername: true, showUsernameButton: false, username: 'Sam' };
    const { rerender } = render(<UserPageHeader {...createProps(props)} />);
    expect(screen.getByRole('textbox', { name: 'Set username' })).toHaveAccessibleDescription(
      'Saved on this device only',
    );

    rerender(<UserPageHeader {...createProps({ ...props, usernameSavedTo: 'session' })} />);
    expect(screen.getByRole('textbox', { name: 'Set username' })).toHaveAccessibleDescription(
      'Shown to people in this session',
    );
  });

  it('stacks "Set username" over "My Bookmarks" right beside the address on the full profile', () => {
    const onUsernameEdit = jest.fn();
    render(<UserPageHeader {...createProps({ isOwner: true, onUsernameEdit })} />);
    const heading = screen.getByRole('heading', { level: 1 });
    const setName = screen.getByRole('button', { name: 'Set username' });
    const bookmarks = screen.getByRole('link', { name: 'My Bookmarks' });
    expect(bookmarks).toHaveAttribute('href', '/bookmarks');
    // One group, next to the address and outside it, away from Analyze and Compare.
    const group = setName.parentElement as HTMLElement;
    expect(group).toHaveClass(styles.identityActions);
    expect(group).toContainElement(bookmarks);
    expect(group.compareDocumentPosition(bookmarks) & Node.DOCUMENT_POSITION_CONTAINED_BY).toBeTruthy();
    expect(setName.compareDocumentPosition(bookmarks) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(heading).not.toContainElement(group);
    expect(heading.parentElement).toContainElement(group);
    expect(screen.getByRole('button', { name: /Compare/ }).parentElement).not.toContainElement(group);
    fireEvent.click(setName);
    expect(onUsernameEdit).toHaveBeenCalledTimes(1);
  });

  it('keeps "My Bookmarks" beside the address while the name field is open, and shows no empty stack', () => {
    const { rerender } = render(
      <UserPageHeader {...createProps({ isOwner: true, isEditingUsername: true, showUsernameButton: false })} />,
    );
    expect(screen.queryByRole('button', { name: /username/ })).toBeNull();
    expect(screen.getByRole('link', { name: 'My Bookmarks' }).parentElement).toHaveClass(styles.identityActions);

    // Someone else's page: neither control, and no stack.
    rerender(
      <UserPageHeader
        {...createProps({
          showUsernameButton: false,
          headerActionVisibility: { ...createProps().headerActionVisibility, showBookmarksLink: false },
        })}
      />,
    );
    expect(document.querySelector(`.${styles.identityActions}`)).toBeNull();
  });

  it("lists the account box's actions in one menu, the dialog's own rows last", () => {
    const onUsernameEdit = jest.fn();
    render(
      <UserPageHeader
        {...createProps({
          isOwner: true,
          minimized: true,
          onUsernameEdit,
          analyzeLinkHref: '/u/0xabc?session=demo-one&analyze=1',
          accountMenuRows: (
            <li>
              <button type="button">Disconnect</button>
            </li>
          ),
        })}
      />,
    );
    const menu = screen.getByTestId('ce-account-menu');
    const rows = Array.from(menu.querySelectorAll(':scope > li > button')).map((row) => row.textContent);
    expect(rows).toEqual(['Analyze user', 'Set username', 'Disconnect']);
    fireEvent.click(screen.getByRole('button', { name: 'Set username' }));
    expect(onUsernameEdit).toHaveBeenCalledTimes(1);
    expect(document.querySelector(`.${styles.identityActions}`)).toBeNull();
    expect(screen.queryByRole('link', { name: /My Bookmarks/ })).toBeNull();
  });

  it('keeps the menu off the full profile', () => {
    render(<UserPageHeader {...createProps({ isOwner: true, accountMenuRows: <li>Disconnect</li> })} />);
    expect(screen.queryByTestId('ce-account-menu')).toBeNull();
    expect(screen.queryByText('Disconnect')).toBeNull();
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
    expect(screen.queryByRole('button', { name: 'Analyze user' })).toBeNull();
  });

  it('offers Analyze user first in the menu only where it is given a link', () => {
    const props = { isOwner: true, minimized: true, showUsernameButton: true };
    const { rerender } = render(<UserPageHeader {...createProps(props)} />);
    expect(screen.queryByRole('button', { name: 'Analyze user' })).toBeNull();
    rerender(<UserPageHeader {...createProps({ ...props, analyzeLinkHref: '/u/0xabc?session=demo-one&analyze=1' })} />);
    const create = screen.getByRole('button', { name: 'Analyze user' });
    const setName = screen.getByRole('button', { name: 'Set username' });
    expect(create.compareDocumentPosition(setName) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(create.closest('ul')).toBe(setName.closest('ul'));
  });

  it('starts no Analyze by itself on a page nobody sent here', () => {
    jest.useFakeTimers();
    try {
      const onAnalyzeUser = jest.fn();
      render(<UserPageHeader {...createProps({ isOwner: true, analyzeLinkReady: true, onAnalyzeUser })} />);
      act(() => void jest.advanceTimersByTime(60_000));
      expect(onAnalyzeUser).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});
