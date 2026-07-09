import { formatPasskeyCredentialUserName } from './createCredential.js';

describe('formatPasskeyCredentialUserName', () => {
  it('uses the legacy human-readable passkey display format', () => {
    expect(formatPasskeyCredentialUserName(new Date(2026, 6, 2, 22, 3))).toBe('ContextEngine-July2-2026-1003PM');
  });
});
