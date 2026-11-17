import { createWorkerAuthRemoteError } from './workerAuthRemoteError';
import { workerSignInProblem } from './workerSignInProblem';

describe('workerSignInProblem', () => {
  it('says a declined wallet signature was cancelled, without the wallet’s text', () => {
    const declined = Object.assign(
      new Error('user rejected signing (action="signMessage", from="0xCD966D04bc02847Dd0f7D253FE2cc832C38FAb4b")'),
      { code: 'ACTION_REJECTED' },
    );
    expect(workerSignInProblem(declined)).toBe('Sign-in was cancelled.');
    expect(workerSignInProblem({ code: 4001, message: 'User denied message signature.' })).toBe(
      'Sign-in was cancelled.',
    );
  });

  it('says a refused passkey prompt was cancelled', () => {
    expect(workerSignInProblem(new DOMException('The document is not focused.', 'NotAllowedError'))).toBe(
      'Sign-in was cancelled.',
    );
    expect(workerSignInProblem(new DOMException('The operation was aborted.', 'AbortError'))).toBe(
      'Sign-in was cancelled.',
    );
  });

  it('keeps the Worker’s own sentence for a busy or rate-limited sign-in', () => {
    const busy = createWorkerAuthRemoteError({ kind: 'worker_login', payload: { retryable: true }, status: 503 });
    expect(workerSignInProblem(busy)).toBe('The session is busy. Try signing in again in a moment.');
    const limited = createWorkerAuthRemoteError({ kind: 'worker_nonce', payload: {}, status: 429 });
    expect(workerSignInProblem(limited)).toBe('Too many sign-in attempts. Wait a minute and try again.');
    const failed = createWorkerAuthRemoteError({ kind: 'worker_login', payload: {}, status: 500 });
    expect(workerSignInProblem(failed)).toBe('Sign-in didn’t work.');
  });

  it('says any other failure didn’t work, never its message', () => {
    expect(workerSignInProblem(new Error('Worker auth nonce route not supported (404).'))).toBe('Sign-in didn’t work.');
    expect(workerSignInProblem(undefined)).toBe('Sign-in didn’t work.');
  });
});
