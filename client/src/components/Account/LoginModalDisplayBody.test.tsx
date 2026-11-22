import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import LoginModalDisplayBody, { SlowFallback, isPasskeyProblem } from './LoginModalDisplayBody';

// The profile, as the dialog's lazy chunk: it puts the dialog's rows in its own list.
jest.mock('components/UserPage/UserPage', () => ({
  __esModule: true,
  default: ({ accountMenuRows }: { accountMenuRows?: React.ReactNode }) => (
    <ul data-testid="profile-menu">{accountMenuRows}</ul>
  ),
}));

type Props = React.ComponentProps<typeof LoginModalDisplayBody>;

const renderBody = (props: Partial<Props>) => {
  const renderAgentHandoffPanel = jest.fn(() => <div data-testid="agent-box" />);
  render(
    <LoginModalDisplayBody
      {...({
        account: '',
        handleLogout: jest.fn(),
        handlePasskeyWalletCreate: jest.fn(),
        handlePasskeyWalletSignIn: jest.fn(),
        loginComplete: false,
        loginInProgress: false,
        openBookmarks: jest.fn(),
        openCryptoModal: jest.fn(),
        passkeyWalletStatusMessage: '',
        passkeyWalletStatusTone: '',
        passkeyWalletStatusHelp: '',
        provider: '',
        renderAgentTokenLoginPanel: () => null,
        renderAgentHandoffPanel,
      } as unknown as Props)}
      {...props}
      renderAgentHandoffPanel={renderAgentHandoffPanel}
    />,
  );
  return renderAgentHandoffPanel;
};

it('offers Your AI agent only once someone is signed in', () => {
  expect(renderBody({ loginComplete: false })).not.toHaveBeenCalled();
  expect(screen.queryByTestId('agent-box')).not.toBeInTheDocument();
});

it('shows Your AI agent to a signed-in person', () => {
  expect(renderBody({ loginComplete: true })).toHaveBeenCalled();
  expect(screen.getByTestId('agent-box')).toBeInTheDocument();
});

it('lists Bookmarks, Your AI agent and a red Disconnect, in that order, with no account to show', () => {
  const handleLogout = jest.fn();
  const openBookmarks = jest.fn();
  renderBody({ loginComplete: true, handleLogout, openBookmarks });
  const menu = screen.getByTestId('ce-account-menu');
  expect(Array.from(menu.children).map((row) => row.textContent)).toEqual(['Bookmarks', '', 'Disconnect']);
  expect(menu.children[1]).toContainElement(screen.getByTestId('agent-box'));
  fireEvent.click(screen.getByRole('button', { name: 'Bookmarks' }));
  expect(openBookmarks).toHaveBeenCalledTimes(1);
  const disconnect = screen.getByTestId('ce-account-disconnect');
  expect(disconnect.className).toMatch(/accountMenuRowDanger/);
  fireEvent.click(disconnect);
  expect(handleLogout).toHaveBeenCalledTimes(1);
});

it('shows one Disconnect, in the profile list, when the profile loads quickly, and mounts Your AI agent once', async () => {
  renderBody({ loginComplete: true, account: '0x00000000000000000000000000000000000000aa' });
  // Not swapped from under a click: the rows on their own wait for a slow load.
  expect(screen.queryByTestId('ce-account-disconnect')).not.toBeInTheDocument();
  expect(screen.queryByTestId('agent-box')).not.toBeInTheDocument();
  const profile = await screen.findByTestId('profile-menu');
  expect(profile).toContainElement(screen.getByTestId('agent-box'));
  expect(profile).toContainElement(screen.getByTestId('ce-account-disconnect'));
  expect(screen.getAllByTestId('agent-box')).toHaveLength(1);
});

it('shows the rows on their own only once the profile is slow', () => {
  jest.useFakeTimers();
  try {
    render(
      <SlowFallback>
        <span>Disconnect</span>
      </SlowFallback>,
    );
    expect(screen.queryByText('Disconnect')).not.toBeInTheDocument();
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.getByText('Disconnect')).toBeInTheDocument();
  } finally {
    jest.useRealTimers();
  }
});

describe('Copy my answers after a failed sign-in', () => {
  const failed = {
    passkeyWalletStatusMessage: 'Login failed: This passkey does not advertise WebAuthn PRF support.',
    passkeyWalletStatusTone: 'error',
  } as Partial<Props>;
  afterEach(() => sessionStorage.clear());

  it('offers the answers with one line on what to do, and copies a link that holds them', async () => {
    sessionStorage.setItem(
      'dg:surveyDraft:meadow-forum:84532:anon:all',
      JSON.stringify({ answers: { q1: { value: 'Agree' } } }),
    );
    const prompt = jest.spyOn(window, 'prompt').mockReturnValue(null);
    renderBody(failed);
    const button = await screen.findByRole('button', { name: 'Copy my answers' });
    expect(screen.getByTestId('ce-passkey-copy-answers')).toHaveTextContent(
      'Copy this and open it on your phone to sign in and submit.',
    );
    expect(screen.getByRole('button', { name: 'About copying your answers' })).toHaveAccessibleDescription(
      /not sent to us/,
    );
    // The test browser has no clipboard, so the text is offered to copy by hand: the link itself.
    await act(async () => {
      fireEvent.click(button);
    });
    expect(prompt).toHaveBeenCalledWith('Copy this', expect.stringMatching(/#answers=[A-Za-z0-9_-]+$/));
    prompt.mockRestore();
    // The sign-in buttons and the error text are as they were.
    expect(screen.getByTestId('ce-passkey-wallet-status')).toHaveTextContent('Login failed: This passkey');
    expect(screen.getByTestId('ce-passkey-wallet-sign-in')).toBeInTheDocument();
  });

  it('offers a long set on one line by hand, the short link and the code apart', async () => {
    // Text that does not pack down into one link.
    const answers = Object.fromEntries(
      Array.from({ length: 60 }, (_, index) => [
        `q${index}`,
        { value: Array.from({ length: 6 }, (_unused, part) => Math.sin(index * 7 + part)).join(' ') },
      ]),
    );
    sessionStorage.setItem('dg:surveyDraft:meadow-forum:84532:anon:all', JSON.stringify({ answers }));
    const prompt = jest.spyOn(window, 'prompt').mockReturnValue(null);
    renderBody(failed);
    const button = await screen.findByRole('button', { name: 'Copy my answers' });
    await act(async () => {
      fireEvent.click(button);
    });
    expect(prompt).toHaveBeenCalledWith('Copy this', expect.stringMatching(/#answers=paste [A-Za-z0-9_-]+$/));
    prompt.mockRestore();
  });

  it('leaves the sign-in screen as it was with no unsaved answers, or before any failure', async () => {
    renderBody(failed);
    await act(async () => {});
    expect(screen.queryByTestId('ce-passkey-copy-answers')).not.toBeInTheDocument();
    sessionStorage.setItem(
      'dg:surveyDraft:meadow-forum:84532:anon:all',
      JSON.stringify({ answers: { q1: { value: 'Agree' } } }),
    );
    renderBody({ passkeyWalletStatusMessage: '', passkeyWalletStatusTone: '' });
    await act(async () => {});
    expect(screen.queryByTestId('ce-passkey-copy-answers')).not.toBeInTheDocument();
  });

  it('counts only errors of the passkey itself, not ones fixed in this browser', async () => {
    expect(
      [
        'Open this link in Safari or Chrome to sign in.',
        'Create failed: This passkey does not advertise WebAuthn PRF support.',
        'Login failed: WebAuthn PRF is required for the embedded wallet on this browser/authenticator.',
        'Create failed: No passkey credential was created.',
        'Login failed: No passkey assertion was returned.',
        'Login failed: Passkey assertion does not match the stored wallet credential.',
        'Create failed: The operation is insecure.',
      ].map(isPasskeyProblem),
    ).toEqual(Array(7).fill(true));
    expect(
      [
        'Login failed: Passkey prompt closed or timed out. Try again.',
        'Create failed: Click the page, then try the passkey again.',
        'Create failed: This device already holds the passkey for the wallet saved in this browser. Use Login.',
        'Create failed: A passkey wallet already exists in this browser. Sign in, or delete it first.',
        'No passkey wallet is saved in this browser for this app. Use Create to make one under this RP ID.',
        'Signed out here, but the saved wallet could not be disconnected.',
        '',
      ].map(isPasskeyProblem),
    ).toEqual(Array(7).fill(false));

    sessionStorage.setItem(
      'dg:surveyDraft:meadow-forum:84532:anon:all',
      JSON.stringify({ answers: { q1: { value: 'Agree' } } }),
    );
    renderBody({
      passkeyWalletStatusMessage: 'Login failed: Passkey prompt closed or timed out. Try again.',
      passkeyWalletStatusTone: 'error',
    });
    await act(async () => {});
    expect(screen.queryByTestId('ce-passkey-copy-answers')).not.toBeInTheDocument();
  });

  it('names Safari or Chrome, not a phone, in a browser without passkeys that holds answers', async () => {
    sessionStorage.setItem(
      'dg:surveyDraft:meadow-forum:84532:anon:all',
      JSON.stringify({ answers: { q1: { value: 'Agree' } } }),
    );
    renderBody({
      passkeyWalletStatusMessage: 'Open this link in Safari or Chrome to sign in.',
      passkeyWalletStatusTone: 'error',
    });
    expect(await screen.findByTestId('ce-passkey-copy-answers')).toHaveTextContent(
      'Copy this and open it in Safari or Chrome to sign in and submit.',
    );
    expect(screen.queryByTestId('ce-passkey-copy-link')).not.toBeInTheDocument();
  });

  it('keeps the plain Copy link for a browser without passkeys that holds no answers', async () => {
    renderBody({
      passkeyWalletStatusMessage: 'Open this link in Safari or Chrome to sign in.',
      passkeyWalletStatusTone: 'error',
    });
    await act(async () => {});
    expect(screen.getByTestId('ce-passkey-copy-link')).toHaveTextContent('Copy link');
    expect(screen.queryByTestId('ce-passkey-copy-answers')).not.toBeInTheDocument();
  });
});

describe('Disconnect with unsent answers', () => {
  const me = '0x00000000000000000000000000000000000000aa';
  const draftKey = `dg:surveyDraft:meadow-forum:84532:${me}:all`;
  let confirm: jest.SpyInstance<boolean, [message?: string]>;
  beforeEach(() => {
    confirm = jest.spyOn(window, 'confirm');
  });
  afterEach(() => {
    confirm.mockRestore();
    sessionStorage.clear();
  });
  const pressDisconnect = async () => {
    const handleLogout = jest.fn();
    renderBody({ loginComplete: true, account: me, handleLogout });
    await screen.findByTestId('profile-menu');
    fireEvent.click(screen.getByTestId('ce-account-disconnect'));
    return handleLogout;
  };

  it('asks once, and stays signed in when the person declines', async () => {
    sessionStorage.setItem(draftKey, JSON.stringify({ answers: { q1: { value: 'Yes' }, q2: { value: 'No' } } }));
    confirm.mockReturnValue(false);
    const handleLogout = await pressDisconnect();
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm).toHaveBeenCalledWith('You have 2 unsent answers. Disconnect and discard them?');
    expect(handleLogout).not.toHaveBeenCalled();
  });

  it('disconnects once the person agrees', async () => {
    sessionStorage.setItem(draftKey, JSON.stringify({ answers: { q1: { value: 'Yes' } } }));
    confirm.mockReturnValue(true);
    const handleLogout = await pressDisconnect();
    expect(confirm).toHaveBeenCalledWith('You have 1 unsent answer. Disconnect and discard it?');
    expect(handleLogout).toHaveBeenCalledTimes(1);
  });

  it('still disconnects where the browser denies storage', async () => {
    const held = Object.getOwnPropertyDescriptor(window, 'sessionStorage');
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      get() {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      },
    });
    try {
      const handleLogout = await pressDisconnect();
      expect(confirm).not.toHaveBeenCalled();
      expect(handleLogout).toHaveBeenCalledTimes(1);
    } finally {
      if (held) Object.defineProperty(window, 'sessionStorage', held);
      else Reflect.deleteProperty(window, 'sessionStorage');
    }
  });

  it('disconnects at once with none unsent, or only another account’s', async () => {
    sessionStorage.setItem(
      'dg:surveyDraft:meadow-forum:84532:0x00000000000000000000000000000000000000bb:all',
      JSON.stringify({ answers: { q1: { value: 'Yes' } } }),
    );
    const handleLogout = await pressDisconnect();
    expect(confirm).not.toHaveBeenCalled();
    expect(handleLogout).toHaveBeenCalledTimes(1);
  });
});
