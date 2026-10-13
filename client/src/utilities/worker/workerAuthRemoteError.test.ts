import { createWorkerAuthRemoteError } from './workerAuthRemoteError';

describe('createWorkerAuthRemoteError', () => {
  it.each(['admin_nonce', 'worker_nonce', 'worker_login'] as const)('explains a %s 429 in plain words', (kind) => {
    expect(
      createWorkerAuthRemoteError({
        kind,
        payload: { error: 'Too many nonce requests. Try again shortly.' },
        status: 429,
      }),
    ).toMatchObject({
      message: 'Too many sign-in attempts. Wait a minute and try again.',
      reason: 'worker_auth_rate_limited',
      status: 429,
    });
  });

  it.each(['Nonce mismatch or expired.', 'Malformed SIWE message: invalid nonce.', 'Invalid or expired nonce.'])(
    'treats "%s" as a nonce a fresh one can replace',
    (error) => {
      expect(createWorkerAuthRemoteError({ kind: 'worker_login', payload: { error }, status: 400 })).toMatchObject({
        message: 'Worker authentication failed: nonce mismatch or expired.',
        reason: 'worker_auth_nonce_mismatch',
        status: 400,
      });
    },
  );

  it('keeps other failures generic', () => {
    expect(
      createWorkerAuthRemoteError({ kind: 'worker_login', payload: { error: 'Invalid signature.' }, status: 400 }),
    ).toMatchObject({ message: 'Worker login failed (400).', reason: 'worker_auth_worker_login_failed' });
  });
});
