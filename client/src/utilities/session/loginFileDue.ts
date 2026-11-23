// A login file's time ran out while the page was open: the page still shows the account, and the next thing
// that needs a signature fails. A Submit that fails so asks, through this event, for the file to be chosen again
// right there, and waits for the answer: `true` once the same account is signed in again, `false` when the
// window was closed, the account changed, or nothing on the page could show it.
import { LOGIN_FILE_DUE_EVENT, LOGIN_FILE_DUE_TEXT } from './loginFileTexts';

export { LOGIN_FILE_DUE_EVENT, LOGIN_FILE_DUE_TEXT };

export type LoginFileDueRequest = {
  /** Called by whoever will show the window, at once: a request nobody takes is answered `false`. */
  take: () => void;
  /** Called once, with whether the file signed the account back in. */
  answer: (signedIn: boolean) => void;
};

/** Whether an error, or a Submit's failed outcome, is the wallet saying the login file is due again. */
export const isLoginFileDueError = (error: unknown): boolean => {
  const { name, message } = (error || {}) as { name?: unknown; message?: unknown };
  // By its name where the error came through whole; by its first words where only its message did. Its first
  // words, not any words: a message that merely quotes them further on is some other failure.
  return (
    name === 'LoginFileExpiredError' ||
    String(message ?? (typeof error === 'string' ? error : '')).startsWith(LOGIN_FILE_DUE_TEXT)
  );
};

/** Asks for the login file to be chosen again, and resolves to whether it signed the same account back in. */
export const askForLoginFile = (): Promise<boolean> =>
  new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }
    let taken = false;
    const request: LoginFileDueRequest = {
      take: () => {
        taken = true;
      },
      answer: resolve,
    };
    window.dispatchEvent(new CustomEvent<LoginFileDueRequest>(LOGIN_FILE_DUE_EVENT, { detail: request }));
    if (!taken) resolve(false);
  });
