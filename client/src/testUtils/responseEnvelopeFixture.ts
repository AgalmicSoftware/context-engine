// Shape-valid synthetic envelopes for tests that mock the encryption transport.
// These bytes are placeholders; decryption is supplied by the calling fixture.
export const responseEnvelopeFixture = (
  tag = 'fixture',
  recipients: Record<string, unknown>[] = [{ type: 'self-eip712-v1' }],
) =>
  JSON.stringify({
    v: 1,
    cipher: 'aes-gcm-256',
    iv: 'AAAAAAAAAAAAAAAA',
    aad: { context: `0x${'aa'.repeat(32)}` },
    ciphertext: btoa(tag),
    recipients: recipients.map((recipient) =>
      recipient.type === 'self-eip712-v1'
        ? { wrap_iv: 'AAAAAAAAAAAAAAAA', wrapped_cek: 'Y2Vr', ...recipient }
        : recipient,
    ),
    commitments: { keccak256: `0x${'bb'.repeat(32)}` },
  });
