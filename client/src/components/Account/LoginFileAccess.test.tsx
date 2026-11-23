import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import LoginFileAccess, { saveLoginFile } from './LoginFileAccess';

const file = { name: 'context-engine-login-ab12cd.json', text: '{"type":"context-engine-login-file"}' };

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
    // The choices in order: create, its (?), then the file to sign in with, after an "or".
    expect(
      within(screen.getByTestId('ce-login-file'))
        .getAllByRole('button')
        .map((button) => button.textContent?.trim() || button.getAttribute('aria-label')),
    ).toEqual(['Create login file', 'About login files', "About a login file's password", 'Login with file']);
    expect(screen.getByTestId('ce-login-file')).toHaveTextContent(/orLogin with file if you have one\.$/);
    // No password unless asked for: the file is made as before.
    expect(screen.getByRole('checkbox', { name: 'Add a password' })).not.toBeChecked();
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create login file' }));
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate).toHaveBeenCalledWith(undefined);
    expect(screen.queryByTestId('ce-login-file-saved')).not.toBeInTheDocument();
  });

  it('takes a password for a new file once "Add a password" is ticked, and waits for one', async () => {
    const { onCreate } = renderAccess();
    fireEvent.click(screen.getByRole('button', { name: 'Other options' }));
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
    const create = screen.getByRole('button', { name: 'Create login file' });
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
