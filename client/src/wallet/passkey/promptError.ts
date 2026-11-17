/**
 * Browsers report a passkey prompt that was closed, ran past its 60 s limit, or opened while the
 * page was not in front as "The operation either timed out or was not allowed" or "The document is
 * not focused". Shown as is (cut short on the Submit button), that read as the site timing out.
 */
export const describePasskeyPromptError = (error: unknown): unknown => {
  const { name, message } = (error && typeof error === 'object' ? error : {}) as { name?: unknown; message?: unknown };
  if (name !== 'NotAllowedError') return error;
  const plain = /not focused/i.test(String(message || ''))
    ? 'Click the page, then try the passkey again.'
    : 'Passkey prompt closed or timed out. Try again.';
  return new Error(plain, { cause: error });
};
