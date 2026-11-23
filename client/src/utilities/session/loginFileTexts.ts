// What the wallet says of a login file itself. Kept apart from the wallet's code, so that the parts of the app
// that are always loaded can tell these messages by their exact words without loading the wallet.

/** The first words of the wallet's message when a login file is due again. */
export const LOGIN_FILE_DUE_TEXT = 'Your login file is needed again.';
export const LOGIN_FILE_UNREADABLE_TEXT = 'That is not a Context Engine login file.';
export const LOGIN_FILE_PASSWORD_NEEDED_TEXT = 'This login file has a password. Enter it to log in.';
export const LOGIN_FILE_PASSWORD_WRONG_TEXT = 'Wrong password, or the file is damaged.';
export const LOGIN_FILE_OTHER_ACCOUNT_TEXT = 'That file is for another account.';
