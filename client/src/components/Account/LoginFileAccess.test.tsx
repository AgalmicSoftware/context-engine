import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import LoginFileAccess, { saveLoginFile, type ChosenLoginFile } from './LoginFileAccess';
import { createProtectedLoginFile, isLoginFileProtected } from '../../wallet/keystore/loginFile.js';
import { PasskeyEoaWalletClient } from '../../wallet/passkeyWallet.js';
import { createMemoryWalletStorage } from '../../wallet/keystore/storage.js';
import { createInMemorySoftSessionClient } from '../../wallet/session/sessionWorkerClient.js';
import type { PasskeyWalletConfig } from '../../wallet/types.js';

const file = { name: 'ContextEngine-Login-November23-2026-1003PM.json', text: '{"type":"context-engine-login-file"}' };

const renderAccess = ({ savedName = '', protectedName = '', passwordRefusedBy = '' } = {}) => {
  const onCreate = jest.fn();
  const onChoose = jest.fn();
  const onPassword = jest.fn();
  const onBack = jest.fn();
  render(
    <LoginFileAccess
      onCreate={onCreate}
      onChoose={onChoose}
      onPassword={onPassword}
      onBack={onBack}
      savedName={savedName}
      protectedName={protectedName}
      passwordRefusedBy={passwordRefusedBy}
    />,
  );
  return { onCreate, onChoose, onPassword, onBack };
};

const choose = async (chosen: File) => {
  await act(async () => {
    fireEvent.change(screen.getByTestId('ce-login-file-input'), { target: { files: [chosen] } });
  });
};

describe('LoginFileAccess', () => {
  const urls = URL as unknown as { createObjectURL?: unknown; revokeObjectURL?: unknown };
  let saved: Blob[];
  let clicked: Array<{ download: string; href: string }>;
  beforeEach(() => {
    saved = [];
    clicked = [];
    urls.createObjectURL = jest.fn((blob: Blob) => {
      saved.push(blob);
      return 'blob:login-file';
    });
    urls.revokeObjectURL = jest.fn();
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push({ download: this.download, href: this.href });
    });
  });
  afterEach(() => {
    jest.restoreAllMocks();
    delete urls.createObjectURL;
    delete urls.revokeObjectURL;
  });

  it('is one button, "Other options", until asked for; then two choices with an "or" between', () => {
    const { onCreate } = renderAccess();
    expect(screen.queryByTestId('ce-login-file')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Other options' }));
    expect(screen.getByTestId('ce-login-file-create')).toHaveTextContent(
      /^Create login file to login without a passkey/,
    );
    // The choices in order: create and its caret, its (?), then the file to sign in with, after an "or".
    expect(
      within(screen.getByTestId('ce-login-file'))
        .getAllByRole('button')
        .map((button) => button.textContent?.trim() || button.getAttribute('aria-label')),
    ).toEqual(['Create login file', 'Login file options', 'About login files', 'Login with file']);
    expect(screen.getByTestId('ce-login-file')).toHaveTextContent(/orLogin with file if you have one\.$/);
    // No password unless asked for, behind the caret: the file is made as before.
    expect(screen.queryByRole('checkbox', { name: 'Add a password' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create login file' }));
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate).toHaveBeenCalledWith(undefined);
    expect(screen.queryByTestId('ce-login-file-saved')).not.toBeInTheDocument();
  });

  // Create's caret: a second button, closed at first, that shows and hides "Add a password". Create itself still makes
  // a file at once. Ticked, the choice cannot be closed and Create carries a lock, so the state is always in view.
  it('opens "Add a password" from Create\u2019s caret, and keeps it open and marked while a password is wanted', () => {
    const { onCreate } = renderAccess();
    fireEvent.click(screen.getByRole('button', { name: 'Other options' }));
    const caret = screen.getByRole('button', { name: 'Login file options' });
    caret.focus();
    expect(caret).toHaveFocus();
    expect(caret).toHaveAttribute('aria-expanded', 'false');
    expect(caret.querySelector('svg')).toHaveAttribute('data-icon', 'caret-down');
    fireEvent.click(caret);
    expect(caret).toHaveAttribute('aria-expanded', 'true');
    expect(caret.querySelector('svg')).toHaveAttribute('data-icon', 'caret-up');
    expect(caret).toHaveAttribute('aria-controls', screen.getByTestId('ce-login-file-password').id);
    const tick = screen.getByRole('checkbox', { name: 'Add a password' });
    expect(tick).not.toBeChecked();
    expect(screen.getByRole('button', { name: "About a login file's password" })).toBeInTheDocument();
    fireEvent.click(caret);
    expect(screen.queryByRole('checkbox', { name: 'Add a password' })).not.toBeInTheDocument();
    expect(caret).not.toHaveAttribute('aria-controls');

    fireEvent.click(caret);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Add a password' }));
    expect(screen.getByRole('button', { name: 'Create login file with a password' })).toBe(
      screen.getByTestId('ce-login-file-create-button'),
    );
    expect(caret).toBeDisabled();
    expect(caret).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Add a password' }));
    expect(caret).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Create login file' })).toBe(
      screen.getByTestId('ce-login-file-create-button'),
    );
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('takes a password for a new file once "Add a password" is ticked, and waits for one', async () => {
    const { onCreate } = renderAccess();
    fireEvent.click(screen.getByRole('button', { name: 'Other options' }));
    fireEvent.click(screen.getByRole('button', { name: 'Login file options' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Add a password' }));
    const password = screen.getByLabelText('Password');
    expect(password).toHaveAttribute('type', 'password');
    expect(password).toHaveAttribute('autocomplete', 'new-password');
    // Said in view, not only behind the (?): there is no way back from a forgotten password.
    expect(screen.getByTestId('ce-login-file-password')).toHaveTextContent('A forgotten password cannot be recovered.');
    expect(screen.getByRole('button', { name: "About a login file's password" })).toHaveAccessibleDescription(
      /never stored or sent\. It cannot be recovered/,
    );
    // With nothing typed, Create makes no file and points at the box.
    const create = screen.getByTestId('ce-login-file-create-button');
    expect(password).toBeRequired();
    (document.activeElement as HTMLElement | null)?.blur();
    fireEvent.click(create);
    expect(onCreate).not.toHaveBeenCalled();
    expect(password).toHaveFocus();
    fireEvent.change(password, { target: { value: 'salon 2026' } });
    // What is typed stays in the box: it is never copied into the page's markup.
    expect(password).not.toHaveAttribute('value');
    expect(document.body.innerHTML).not.toContain('salon 2026');
    // One box, with "Show password" to read back what was typed.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show password' }));
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText('Password')).toHaveValue('salon 2026');
    expect(document.body.innerHTML).not.toContain('salon 2026');
    await act(async () => {
      fireEvent.click(create);
    });
    expect(onCreate).toHaveBeenCalledWith('salon 2026');

    // Unticked again, the password typed is gone and not used: the file is made as one without.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Add a password' }));
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    fireEvent.click(create);
    expect(onCreate).toHaveBeenLastCalledWith(undefined);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Add a password' }));
    expect(screen.getByLabelText('Password')).toHaveValue('');
  });

  it('lets the Create button go again when the file could not be made', async () => {
    const onCreate = jest.fn(async () => {
      throw new Error('no crypto here');
    });
    render(
      <LoginFileAccess
        onCreate={onCreate}
        onChoose={jest.fn()}
        onPassword={jest.fn()}
        onBack={jest.fn()}
        savedName=""
        protectedName=""
        passwordRefusedBy=""
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Other options' }));
    const create = screen.getByRole('button', { name: 'Create login file' });
    await act(async () => {
      fireEvent.click(create);
    });
    expect(create).toBeEnabled();
  });

  it('holds the Create button while a file with a password is being made', async () => {
    let made!: () => void;
    const onCreate = jest.fn(() => new Promise<void>((resolve) => (made = resolve)));
    render(
      <LoginFileAccess
        onCreate={onCreate}
        onChoose={jest.fn()}
        onPassword={jest.fn()}
        onBack={jest.fn()}
        savedName=""
        protectedName=""
        passwordRefusedBy=""
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Other options' }));
    const create = screen.getByRole('button', { name: 'Create login file' });
    fireEvent.click(create);
    expect(create).toBeDisabled();
    fireEvent.click(create);
    expect(onCreate).toHaveBeenCalledTimes(1);
    await act(async () => made());
    expect(create).toBeEnabled();
  });

  it('asks for the password of a chosen file that has one, in place of every other choice', () => {
    const { onPassword, onBack } = renderAccess({ protectedName: file.name, savedName: 'another.json' });
    const box = screen.getByTestId('ce-login-file');
    expect(screen.getByTestId('ce-login-file-protected')).toHaveTextContent(`${file.name} has a password.`);
    expect(screen.queryByTestId('ce-login-file-saved')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create login file' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Login with file' })).not.toBeInTheDocument();
    const password = screen.getByLabelText('Password');
    expect(password).toHaveAttribute('type', 'password');
    expect(password).toHaveAttribute('autocomplete', 'current-password');
    const login = within(box).getByRole('button', { name: 'Login' });
    // Nothing typed: nothing is tried.
    expect(password).toBeRequired();
    fireEvent.submit(box);
    expect(onPassword).not.toHaveBeenCalled();
    fireEvent.change(password, { target: { value: 'salon 2026' } });
    expect(password).not.toHaveAttribute('value');
    expect(password).not.toHaveAttribute('aria-invalid');
    // The Enter key signs in, as the button does.
    fireEvent.submit(box);
    expect(onPassword).toHaveBeenCalledWith('salon 2026');
    fireEvent.click(login);
    expect(onPassword).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('is a notice once a login file was saved: what was saved, how to login with it, and a way back', () => {
    const { onBack } = renderAccess({ savedName: file.name });
    // In place of every other choice.
    expect(screen.queryByTestId('ce-login-file-open')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create login file' })).not.toBeInTheDocument();
    const notice = screen.getByTestId('ce-login-file');
    // Back comes first, in the notice's corner.
    expect(within(notice).getAllByRole('button')[0]).toHaveTextContent('Back');
    // Where to look, without claiming the browser saved it; what to do if it did not is behind the (?).
    expect(screen.getByRole('status')).toHaveTextContent(`Check your downloads for ${file.name}.`);
    expect(screen.getByRole('status')).not.toHaveTextContent(/Saved/);
    expect(screen.getByRole('button', { name: 'About login files' })).toHaveAccessibleDescription(
      /If no file was saved, open this page in Safari or Chrome and create it there\./,
    );
    expect(notice).toHaveTextContent(
      'Keep it safe. To login, here or on another device, choose it with Login with file',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('saves a login file to downloads under its name', () => {
    saveLoginFile(file);
    expect(clicked).toEqual([{ download: file.name, href: 'blob:login-file' }]);
    expect(saved).toHaveLength(1);
    expect(saved[0].size).toBe(file.text.length);
    expect(saved[0].type).toBe('application/json');
  });

  it('keeps the download\u2019s address for a minute, for a phone that asks before it downloads', () => {
    jest.useFakeTimers();
    try {
      saveLoginFile(file);
      jest.advanceTimersByTime(59_000);
      expect(urls.revokeObjectURL).not.toHaveBeenCalled();
      jest.advanceTimersByTime(1_000);
      expect(urls.revokeObjectURL).toHaveBeenCalledWith('blob:login-file');
    } finally {
      jest.useRealTimers();
    }
  });

  it('ties a refused password to its message, for a screen reader', () => {
    renderAccess({ protectedName: file.name, passwordRefusedBy: 'ce-passkey-wallet-status' });
    const password = screen.getByLabelText('Password');
    expect(password).toHaveAttribute('aria-invalid', 'true');
    expect(password).toHaveAttribute('aria-describedby', 'ce-passkey-wallet-status');
  });

  it('hands on the name and text of the file that is chosen', async () => {
    const { onChoose } = renderAccess({ savedName: file.name });
    const chosen = new File([file.text], file.name, { type: 'application/json' });
    // jsdom's File has no text().
    Object.defineProperty(chosen, 'text', { value: async () => file.text });
    await choose(chosen);
    expect(onChoose).toHaveBeenCalledWith({ name: file.name, text: file.text });
  });

  it('does not read a file far too large to be a login file', async () => {
    const { onChoose } = renderAccess({ savedName: file.name });
    const text = jest.fn(async () => 'x');
    const chosen = new File(['x'], 'holiday.mov');
    Object.defineProperty(chosen, 'size', { value: 5 * 1024 * 1024 * 1024 });
    Object.defineProperty(chosen, 'text', { value: text });
    await choose(chosen);
    expect(text).not.toHaveBeenCalled();
    expect(onChoose).not.toHaveBeenCalled();
    expect(screen.getByTestId('ce-login-file')).toHaveTextContent('That file could not be read.');
  });
});

// The password path from end to end, with the wallet's own file and sign-in: made behind Create's caret with a
// password, chosen again with Login with file, asked for its password, then signed in as the account it names.
describe('a login file made with a password', () => {
  const PASSWORD = 'correct horse battery';
  const config = {
    rpId: 'localhost',
    rpName: 'Context Engine',
    appOrigin: 'http://localhost:3000',
    accountOrigin: 'http://localhost:3000',
    walletMode: 'passkey-eoa',
    walletKeyMode: 'passkey-derived',
    sessionMode: 'soft',
    unlockTtlSeconds: 3600,
    allowPreviewRpId: false,
    storageMode: 'indexeddb',
    derivationNamespace: 'context-engine',
  } as PasskeyWalletConfig;

  it('is made behind the caret, chosen again, and signs in with that password', async () => {
    const made: Array<Awaited<ReturnType<typeof createProtectedLoginFile>>> = [];
    const chosen: ChosenLoginFile[] = [];
    const tries: string[] = [];
    const box = (protectedName = '') => (
      <LoginFileAccess
        onCreate={async (password) => {
          made.push(await createProtectedLoginFile(password as string));
        }}
        onChoose={(file) => chosen.push(file)}
        onPassword={(password) => tries.push(password)}
        onBack={jest.fn()}
        savedName=""
        protectedName={protectedName}
        passwordRefusedBy=""
      />
    );
    const view = render(box());
    fireEvent.click(screen.getByRole('button', { name: 'Other options' }));
    fireEvent.click(screen.getByRole('button', { name: 'Login file options' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Add a password' }));
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: PASSWORD } });
    fireEvent.click(screen.getByRole('button', { name: 'Create login file with a password' }));
    await waitFor(() => expect(made).toHaveLength(1), { timeout: 15000 });
    expect(isLoginFileProtected(made[0].text)).toBe(true);
    expect(made[0].text).not.toContain(PASSWORD);

    const again = new File([made[0].text], made[0].name, { type: 'application/json' });
    // jsdom's File has no text().
    Object.defineProperty(again, 'text', { value: async () => made[0].text });
    await choose(again);
    expect(chosen).toEqual([{ name: made[0].name, text: made[0].text }]);
    // A file with a password: the dialog asks for it, as LoginAndSettingsModal does.
    view.rerender(box(chosen[0].name));
    fireEvent.change(screen.getByTestId('ce-login-file-password-input'), { target: { value: PASSWORD } });
    fireEvent.click(screen.getByTestId('ce-login-file-password-submit'));
    expect(tries).toEqual([PASSWORD]);
    const client = new PasskeyEoaWalletClient({
      config,
      storage: createMemoryWalletStorage(),
      sessionClientFactory: createInMemorySoftSessionClient,
    });
    await expect(client.signInWithLoginFile(chosen[0].text, tries[0])).resolves.toBe(made[0].address);
    await client.lock();
  }, 30000);
});
