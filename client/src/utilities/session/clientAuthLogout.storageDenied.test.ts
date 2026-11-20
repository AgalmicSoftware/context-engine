import { clearSurveyDraftsForAccount } from './clientAuthLogout';

jest.mock('wagmi/actions', () => ({ disconnect: jest.fn() }));

// Signing out clears the account's unsent answers first. Where the browser denies storage there is nothing to
// clear, and the sign-out must go on: asking for the store at all throws there.
it('clears nothing, and does not throw, where the browser denies storage', () => {
  const held = Object.getOwnPropertyDescriptor(window, 'sessionStorage');
  Object.defineProperty(window, 'sessionStorage', {
    configurable: true,
    get() {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    },
  });
  try {
    expect(() => window.sessionStorage).toThrow();
    expect(() => clearSurveyDraftsForAccount('0x00000000000000000000000000000000000000aa')).not.toThrow();
  } finally {
    if (held) Object.defineProperty(window, 'sessionStorage', held);
    else Reflect.deleteProperty(window, 'sessionStorage');
  }
});
