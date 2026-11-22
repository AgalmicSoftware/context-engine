import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import LoginFileAccess, { saveLoginFile } from './LoginFileAccess';

const file = { name: 'context-engine-login-ab12cd.json', text: '{"type":"context-engine-login-file"}' };

const renderAccess = (savedName = '') => {
  const onCreate = jest.fn();
  const onSignIn = jest.fn();
  render(<LoginFileAccess onCreate={onCreate} onSignIn={onSignIn} savedName={savedName} />);
  return { onCreate, onSignIn };
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

  it('is one button, "Other options", until asked for', () => {
    const { onCreate } = renderAccess();
    expect(screen.queryByTestId('ce-login-file')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Other options' }));
    expect(screen.getByRole('button', { name: 'Login with file' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create login file' }));
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('ce-login-file-saved')).toBeEmptyDOMElement();
  });

  it('is open and says what to do next once a login file was saved', () => {
    renderAccess(file.name);
    expect(screen.queryByTestId('ce-login-file-open')).not.toBeInTheDocument();
    expect(screen.getByTestId('ce-login-file-saved')).toHaveTextContent(
      `Saved ${file.name} to your downloads. Now login with it.`,
    );
    expect(screen.getByRole('button', { name: 'Login with file' })).toBeInTheDocument();
  });

  it('saves a login file to downloads under its name', () => {
    saveLoginFile(file);
    expect(clicked).toEqual([{ download: file.name, href: 'blob:login-file' }]);
    expect(saved).toHaveLength(1);
    expect(saved[0].size).toBe(file.text.length);
    expect(saved[0].type).toBe('application/json');
  });

  it('signs in with the text of the file that is chosen', async () => {
    const { onSignIn } = renderAccess(file.name);
    const chosen = new File([file.text], file.name, { type: 'application/json' });
    // jsdom's File has no text().
    Object.defineProperty(chosen, 'text', { value: async () => file.text });
    await choose(chosen);
    expect(onSignIn).toHaveBeenCalledWith(file.text);
  });

  it('does not read a file far too large to be a login file', async () => {
    const { onSignIn } = renderAccess(file.name);
    const text = jest.fn(async () => 'x');
    const chosen = new File(['x'], 'holiday.mov');
    Object.defineProperty(chosen, 'size', { value: 5 * 1024 * 1024 * 1024 });
    Object.defineProperty(chosen, 'text', { value: text });
    await choose(chosen);
    expect(text).not.toHaveBeenCalled();
    expect(onSignIn).not.toHaveBeenCalled();
    expect(screen.getByTestId('ce-login-file')).toHaveTextContent('That file could not be read.');
  });
});
