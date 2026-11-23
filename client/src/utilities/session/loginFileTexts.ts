// What the wallet says of a login file itself, and the name of the event that asks for one again. Kept apart
// from the code that uses them, so that the parts of the app that are always loaded (the navbar among them) can
// know these few words without loading the wallet or the Submit's code.

/** The event a Submit raises when it finds the login file due again; see `loginFileDue.ts`. */
export const LOGIN_FILE_DUE_EVENT = 'ce:login-file-due';

/** The first words of the wallet's message when a login file is due again. */
export const LOGIN_FILE_DUE_TEXT = 'Your login file is needed again.';
export const LOGIN_FILE_UNREADABLE_TEXT = 'That is not a Context Engine login file.';
export const LOGIN_FILE_PASSWORD_NEEDED_TEXT = 'This login file has a password. Enter it to log in.';
export const LOGIN_FILE_PASSWORD_WRONG_TEXT = 'Wrong password, or the file is damaged.';
export const LOGIN_FILE_OTHER_ACCOUNT_TEXT = 'That file is for another account.';
