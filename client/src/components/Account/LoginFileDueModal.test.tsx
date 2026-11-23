import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import LoginFileDueModal from './LoginFileDueModal';

const ACCOUNT = '0x00000000000000000000000000000000000000aa';
const mockSignIn = jest.fn();

jest.mock('../../wallet/passkeyWallet.js', () => ({
  LOGIN_FILE_OTHER_ACCOUNT_TEXT: 'That file is for another account.',
  LOGIN_FILE_UNREADABLE_TEXT: 'That is not a Context Engine login file.',
  LOGIN_FILE_PASSWORD_WRONG_TEXT: 'Wrong password, or the file is damaged.',
  LOGIN_FILE_PASSWORD_NEEDED_TEXT: 'This login file has a password. Enter it to log in.',
  isLoginFileProtected: (text: string) => /"protected":true/.test(text),
  signInWithLoginFile: (...args: unknown[]) => mockSignIn(...args),
}));

const renderModal = () => {
  const onSignedIn = jest.fn();
  const onClose = jest.fn();
  render(<LoginFileDueModal account={ACCOUNT} onSignedIn={onSignedIn} onClose={onClose} />);
  return { onSignedIn, onClose };
};

// The default name is the earlier pattern: a file downloaded before the names changed still signs in.
const choose = async (text: string, name = 'context-engine-login-ab12cd.json') => {
  const chosen = new File([text], name, { type: 'application/json' });
  // jsdom's File has no text().
  Object.defineProperty(chosen, 'text', { value: async () => text });
  await act(async () => {
    fireEvent.change(screen.getByTestId('ce-login-file-due-input'), { target: { files: [chosen] } });
  });
};

describe('LoginFileDueModal', () => {
  beforeEach(() => {
    mockSignIn.mockReset();
  });

  it('says the answers are kept and offers the file, with no numbers in view', () => {
    renderModal();
    const box = screen.getByTestId('ce-login-file-due');
    expect(box).toHaveTextContent('LOGIN FILE');
    expect(box).toHaveTextContent('Your unsent answers are kept.');
    expect(screen.getByRole('button', { name: 'Login with file' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    // The why is behind the (?); the visible words carry no hours.
    expect(screen.getByRole('button', { name: 'About choosing your login file again' })).toHaveAccessibleDescription(
      /Choose the same file and your Submit goes ahead/,
    );
    // No hours or other numbers anywhere, in view or behind the (?).
    expect(box.textContent).not.toMatch(/\d/);
  });

  it('signs the same account back in with the chosen file, and says it is done', async () => {
    mockSignIn.mockResolvedValueOnce(ACCOUNT);
    const { onSignedIn } = renderModal();
    await choose('the file text');
    // Only a file for the account the page shows is taken.
    expect(mockSignIn).toHaveBeenCalledWith('the file text', undefined, { expectedAddress: ACCOUNT });
    expect(onSignedIn).toHaveBeenCalledTimes(1);
  });

  it('refuses a file for another account in plain words, and stays open for the right one', async () => {
    mockSignIn.mockRejectedValueOnce(new Error('That file is for another account.'));
    const { onSignedIn, onClose } = renderModal();
    await choose('another file');
    expect(screen.getByRole('alert')).toHaveTextContent('That file is for another account.');
    expect(onSignedIn).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    mockSignIn.mockResolvedValueOnce(ACCOUNT);
    await choose('the file text');
    expect(onSignedIn).toHaveBeenCalledTimes(1);
  });

  it('says so for a file that is not a login file, and keeps an unknown failure’s words out of view', async () => {
    mockSignIn.mockRejectedValueOnce(new Error('That is not a Context Engine login file.'));
    renderModal();
    await choose('holiday notes');
    expect(screen.getByRole('alert')).toHaveTextContent('That is not a Context Engine login file.');
    mockSignIn.mockRejectedValueOnce(new Error('IDBDatabase: the transaction was aborted'));
    await choose('the file text');
    expect(screen.getByRole('alert')).toHaveTextContent('That file did not sign you in. Try again.');
  });

  it('asks for the password of a file that has one, inside the same window, and takes a second try', async () => {
    const { onSignedIn } = renderModal();
    await choose('{"protected":true}', 'ContextEngine-Login-November23-2026-1004PM.json');
    expect(mockSignIn).not.toHaveBeenCalled();
    expect(screen.getByTestId('ce-login-file-due-protected')).toHaveTextContent(
      'ContextEngine-Login-November23-2026-1004PM.json has a password.',
    );
    const password = screen.getByLabelText('Password');
    mockSignIn.mockRejectedValueOnce(new Error('Wrong password, or the file is damaged.'));
    fireEvent.change(password, { target: { value: 'not it' } });
    await act(async () => {
      fireEvent.click(screen.getByTestId('ce-login-file-due-submit'));
    });
    expect(mockSignIn).toHaveBeenLastCalledWith('{"protected":true}', 'not it', { expectedAddress: ACCOUNT });
    expect(screen.getByRole('alert')).toHaveTextContent('Wrong password, or the file is damaged.');
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-describedby', 'ce-login-file-due-error');
    // The typed password never reaches the page's markup.
    expect(document.body.innerHTML).not.toContain('not it');

    mockSignIn.mockResolvedValueOnce(ACCOUNT);
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'salon 2026' } });
    await act(async () => {
      fireEvent.click(screen.getByTestId('ce-login-file-due-submit'));
    });
    expect(mockSignIn).toHaveBeenLastCalledWith('{"protected":true}', 'salon 2026', { expectedAddress: ACCOUNT });
    expect(onSignedIn).toHaveBeenCalledTimes(1);
  });

  it('brings the file button back when a file with a password turns out to be another account’s', async () => {
    renderModal();
    await choose('{"protected":true}', 'someone-elses.json');
    mockSignIn.mockRejectedValueOnce(new Error('That file is for another account.'));
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'their password' } });
    await act(async () => {
      fireEvent.click(screen.getByTestId('ce-login-file-due-submit'));
    });
    expect(screen.getByRole('alert')).toHaveTextContent('That file is for another account.');
    // Not a dead end: the password box goes, and another file can be chosen.
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Login with file' })).toBeEnabled();
  });

  it('holds the file button while a chosen file is signing in', async () => {
    let finish!: (address: string) => void;
    mockSignIn.mockImplementationOnce(() => new Promise<string>((resolve) => (finish = resolve)));
    const { onSignedIn } = renderModal();
    await choose('the file text');
    expect(screen.getByRole('button', { name: 'Login with file' })).toBeDisabled();
    await act(async () => finish(ACCOUNT));
    expect(onSignedIn).toHaveBeenCalledTimes(1);
  });

  it('closes without signing anyone in', () => {
    const { onSignedIn, onClose } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSignedIn).not.toHaveBeenCalled();
    expect(mockSignIn).not.toHaveBeenCalled();
  });
});
