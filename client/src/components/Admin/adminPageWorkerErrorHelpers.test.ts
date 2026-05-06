import {
  ADMIN_ACTION_NONCE_RETRY_ATTEMPTS,
  buildAdminWorkerCorsMessage,
  isRetryableAdminNonceFailure,
  normalizeAdminWorkerFetchError,
  sleep,
} from './adminPageWorkerErrorHelpers';

describe('adminPageWorkerErrorHelpers', () => {
  it('builds worker CORS guidance with worker and origin context', () => {
    const message = buildAdminWorkerCorsMessage('https://worker.example.test/', 'Origin not allowed');

    expect(message).toContain('https://worker.example.test/');
    expect(message).toContain('(Origin not allowed)');
    expect(message).toContain('allowOrigins');
    expect(message).toContain(window.location.origin);
  });

  it('normalizes worker origin and network failures to CORS guidance', () => {
    expect(normalizeAdminWorkerFetchError({
      workerBase: 'https://worker.example.test',
      responseStatus: 403,
      responseError: 'Origin not allowed',
    })).toContain('could not reach https://worker.example.test (Origin not allowed)');

    expect(normalizeAdminWorkerFetchError({
      error: new Error('Failed to fetch'),
      workerBase: 'https://worker.example.test',
    })).toContain('could not reach https://worker.example.test');
  });

  it('keeps non-CORS failures and detects retryable nonce errors', () => {
    expect(normalizeAdminWorkerFetchError({ error: new Error('bad request') })).toBe('bad request');
    expect(normalizeAdminWorkerFetchError()).toBe('Failed to update worker allowOrigins.');
    expect(ADMIN_ACTION_NONCE_RETRY_ATTEMPTS).toBe(3);
    expect(isRetryableAdminNonceFailure({
      responseStatus: 400,
      responseError: 'Nonce mismatch or expired',
    })).toBe(true);
    expect(isRetryableAdminNonceFailure({
      responseStatus: 400,
      responseError: 'nonce already used',
    })).toBe(true);
    expect(isRetryableAdminNonceFailure({
      responseStatus: 500,
      responseError: 'nonce already used',
    })).toBe(false);
  });

  it('resolves sleep after the requested delay', async () => {
    jest.useFakeTimers();
    const done = jest.fn();
    const pending = sleep(25).then(done);

    jest.advanceTimersByTime(24);
    await Promise.resolve();
    expect(done).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    await pending;
    expect(done).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});
