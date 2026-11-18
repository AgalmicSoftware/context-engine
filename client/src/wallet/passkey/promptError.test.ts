import { describePasskeyPromptError } from './promptError';

const domError = (name: string, message: string) => Object.assign(new Error(message), { name });

it('rewords a closed or expired passkey prompt so it fits the Submit button', () => {
  const raw = domError(
    'NotAllowedError',
    'The operation either timed out or was not allowed. See: https://www.w3.org/TR/webauthn-2/#sctn-privacy-considerations-client.',
  );
  const plain = describePasskeyPromptError(raw) as Error;
  expect(plain.message).toBe('Passkey prompt closed or timed out. Try again.');
  expect(plain.message.length).toBeLessThanOrEqual(47);
  expect(plain.cause).toBe(raw);
});

it('says to bring the page to the front when the prompt opened without focus', () => {
  const plain = describePasskeyPromptError(domError('NotAllowedError', 'The document is not focused.')) as Error;
  expect(plain.message).toBe('Click the page, then try the passkey again.');
});

it('leaves every other error as it was', () => {
  const other = domError('InvalidStateError', 'Already registered.');
  expect(describePasskeyPromptError(other)).toBe(other);
});
