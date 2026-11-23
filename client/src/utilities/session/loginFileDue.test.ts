import {
  LOGIN_FILE_DUE_EVENT,
  LOGIN_FILE_DUE_TEXT,
  askForLoginFile,
  isLoginFileDueError,
  type LoginFileDueRequest,
} from './loginFileDue';
import { LoginFileExpiredError } from '../../wallet/keystore/loginFile';

describe('a login file that is due again', () => {
  it('is known by its name, or by the first words of its message where only the message came through', () => {
    expect(isLoginFileDueError(new LoginFileExpiredError())).toBe(true);
    // Passed on as a plain error, as a Submit's failed outcome, or with another notice added after it.
    expect(isLoginFileDueError(new Error(new LoginFileExpiredError().message))).toBe(true);
    expect(isLoginFileDueError({ status: 'failed', message: new LoginFileExpiredError().message })).toBe(true);
    expect(isLoginFileDueError(new Error(`${LOGIN_FILE_DUE_TEXT} Reload the page. One answer was too long.`))).toBe(
      true,
    );
    expect(isLoginFileDueError(LOGIN_FILE_DUE_TEXT)).toBe(true);
    // Its first words, not any words: a failure that quotes them (a question's own text, say) is another failure.
    expect(isLoginFileDueError(new Error(`\u201c${LOGIN_FILE_DUE_TEXT}\u201d wasn't submitted. Upload failed.`))).toBe(
      false,
    );
    for (const other of [
      new Error('Upload failed.'),
      new Error('Passkey prompt closed or timed out.'),
      null,
      undefined,
      '',
      {},
    ]) {
      expect(isLoginFileDueError(other)).toBe(false);
    }
  });

  it('answers false at once when nothing on the page takes the request', async () => {
    await expect(askForLoginFile()).resolves.toBe(false);
  });

  it('waits for whoever took the request, and resolves to their answer', async () => {
    const requests: LoginFileDueRequest[] = [];
    const listen = (event: Event) => {
      const request = (event as CustomEvent<LoginFileDueRequest>).detail;
      request.take();
      requests.push(request);
    };
    window.addEventListener(LOGIN_FILE_DUE_EVENT, listen);
    try {
      let settled: boolean | null = null;
      const asked = askForLoginFile().then((answer) => (settled = answer));
      await Promise.resolve();
      expect(requests).toHaveLength(1);
      expect(settled).toBeNull();
      requests[0].answer(true);
      await asked;
      expect(settled).toBe(true);

      const again = askForLoginFile();
      requests[1].answer(false);
      await expect(again).resolves.toBe(false);
    } finally {
      window.removeEventListener(LOGIN_FILE_DUE_EVENT, listen);
    }
  });
});
