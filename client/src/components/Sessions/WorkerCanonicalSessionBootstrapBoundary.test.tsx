import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';

import { STALE_CHUNK_RELOAD_STORAGE_KEY } from '../../bootRecovery.js';
import WorkerCanonicalSessionBootstrapBoundary from './WorkerCanonicalSessionBootstrapBoundary';
import { fetchWorkerCanonicalSessionBootstrap } from '../../utilities/session/sessionWorkerDiscovery';
import {
  markWorkerCanonicalSessionBootstrapVerified,
  upsertWorkerCanonicalSessionBootstrap,
} from '../../utilities/session/sessionWorkerConfigCache.js';

jest.mock('../../utilities/session/sessionWorkerDiscovery', () => ({
  fetchWorkerCanonicalSessionBootstrap: jest.fn(),
}));

jest.mock('../../utilities/session/sessionWorkerConfigCache.js', () => ({
  markWorkerCanonicalSessionBootstrapVerified: jest.fn(),
  upsertWorkerCanonicalSessionBootstrap: jest.fn(),
}));

const mockFetchBootstrap = fetchWorkerCanonicalSessionBootstrap as jest.MockedFunction<
  typeof fetchWorkerCanonicalSessionBootstrap
>;
const mockUpsertBootstrap = upsertWorkerCanonicalSessionBootstrap as jest.MockedFunction<
  typeof upsertWorkerCanonicalSessionBootstrap
>;
const mockMarkBootstrapVerified = markWorkerCanonicalSessionBootstrapVerified as jest.MockedFunction<
  typeof markWorkerCanonicalSessionBootstrapVerified
>;

const WORKER_ORIGIN = 'https://session-worker.example.test';
const EXISTING_WORKER_ORIGIN = 'https://existing-worker.example.test';
const SESSION_ID = '0x00112233445566778899aabbccddeeff';

const bootstrap = {
  config: {
    slug: 'worker-session',
    sessionId: SESSION_ID,
    configRevision: 'revision-1',
    corsWorkerUrl: WORKER_ORIGIN,
    sessionModeProfile: { authority: { mode: 'worker_canonical' } },
  },
  configRevision: 'revision-1',
  sessionId: SESSION_ID,
  sessionSlug: 'worker-session',
  workerOrigin: WORKER_ORIGIN,
};

const cachedResult = {
  status: 'cached' as const,
  cacheKey: `session:0:${SESSION_ID}`,
  config: bootstrap.config,
  existingWorkerOrigin: '',
  workerOrigin: WORKER_ORIGIN,
};

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

describe('WorkerCanonicalSessionBootstrapBoundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchBootstrap.mockResolvedValue(bootstrap);
    mockUpsertBootstrap.mockReturnValue(cachedResult);
    mockMarkBootstrapVerified.mockReturnValue(true);
    window.sessionStorage.clear();
  });

  it('renders loading state, resolves through discovery, caches without repinning, and reports the bootstrap', async () => {
    const fetchImpl = jest.fn() as unknown as typeof fetch;
    const onResolved = jest.fn();
    const pendingBootstrap = deferred<typeof bootstrap>();
    mockFetchBootstrap.mockReturnValueOnce(pendingBootstrap.promise);
    window.sessionStorage.setItem(STALE_CHUNK_RELOAD_STORAGE_KEY, 'true');

    render(
      <WorkerCanonicalSessionBootstrapBoundary
        sessionSlug="worker-session"
        workerQueryValue={WORKER_ORIGIN}
        environment="test"
        fetchImpl={fetchImpl}
        onResolved={onResolved}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Loading worker session…');
    expect(window.sessionStorage.getItem(STALE_CHUNK_RELOAD_STORAGE_KEY)).toBe('true');
    const discoveryArgs = mockFetchBootstrap.mock.calls[0][0];
    expect(discoveryArgs).toEqual(
      expect.objectContaining({
        sessionSlug: 'worker-session',
        workerQueryValue: WORKER_ORIGIN,
        environment: 'test',
        fetchImpl,
        signal: expect.any(AbortSignal),
      }),
    );
    expect(discoveryArgs.signal?.aborted).toBe(false);

    await act(async () => {
      pendingBootstrap.resolve(bootstrap);
      await pendingBootstrap.promise;
    });

    await waitFor(() => expect(onResolved).toHaveBeenCalledWith(bootstrap));
    expect(mockUpsertBootstrap).toHaveBeenCalledWith({
      slug: 'worker-session',
      sessionIdHex: SESSION_ID,
      workerOrigin: WORKER_ORIGIN,
      configRevision: 'revision-1',
      config: bootstrap.config,
      allowRepin: false,
    });
    expect(mockMarkBootstrapVerified).toHaveBeenCalledWith({
      slug: 'worker-session',
      sessionIdHex: SESSION_ID,
      workerOrigin: WORKER_ORIGIN,
    });
    expect(mockUpsertBootstrap.mock.invocationCallOrder[0]).toBeLessThan(
      mockMarkBootstrapVerified.mock.invocationCallOrder[0],
    );
    expect(mockMarkBootstrapVerified.mock.invocationCallOrder[0]).toBeLessThan(onResolved.mock.invocationCallOrder[0]);
    expect(screen.getByRole('status')).toHaveTextContent('Worker session ready.');
  });

  it('requires explicit approval before retrying a TOFU conflict with allowRepin', async () => {
    const events: string[] = [];
    mockUpsertBootstrap
      .mockImplementationOnce((input) => {
        events.push(`cache:${input.allowRepin}`);
        return {
          status: 'conflict',
          cacheKey: cachedResult.cacheKey,
          config: bootstrap.config,
          existingWorkerOrigin: EXISTING_WORKER_ORIGIN,
          workerOrigin: WORKER_ORIGIN,
        };
      })
      .mockImplementationOnce((input) => {
        events.push(`cache:${input.allowRepin}`);
        return cachedResult;
      });
    const confirmRepin = jest.fn(async (message: string) => {
      events.push('confirm');
      expect(message).toContain(EXISTING_WORKER_ORIGIN);
      expect(message).toContain(WORKER_ORIGIN);
      expect(message).toContain('worker-session');
      return true;
    });
    const onResolved = jest.fn();

    render(
      <WorkerCanonicalSessionBootstrapBoundary
        sessionSlug="worker-session"
        workerQueryValue={WORKER_ORIGIN}
        onResolved={onResolved}
        confirmRepin={confirmRepin}
      />,
    );

    await waitFor(() => expect(onResolved).toHaveBeenCalledWith(bootstrap));
    expect(events).toEqual(['cache:false', 'confirm', 'cache:true']);
    expect(mockUpsertBootstrap.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        allowRepin: true,
        workerOrigin: WORKER_ORIGIN,
      }),
    );
    expect(mockUpsertBootstrap.mock.invocationCallOrder[1]).toBeLessThan(
      mockMarkBootstrapVerified.mock.invocationCallOrder[0],
    );
  });

  it('fails closed when a TOFU repin is declined', async () => {
    mockUpsertBootstrap.mockReturnValueOnce({
      status: 'conflict',
      cacheKey: cachedResult.cacheKey,
      config: bootstrap.config,
      existingWorkerOrigin: EXISTING_WORKER_ORIGIN,
      workerOrigin: WORKER_ORIGIN,
    });
    const onResolved = jest.fn();
    const confirmRepin = jest.fn(async () => false);

    render(
      <WorkerCanonicalSessionBootstrapBoundary
        sessionSlug="worker-session"
        workerQueryValue={WORKER_ORIGIN}
        onResolved={onResolved}
        confirmRepin={confirmRepin}
      />,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('Worker origin change was not approved.');
    expect(confirmRepin).toHaveBeenCalledTimes(1);
    expect(mockUpsertBootstrap).toHaveBeenCalledTimes(1);
    expect(mockMarkBootstrapVerified).not.toHaveBeenCalled();
    expect(onResolved).not.toHaveBeenCalled();
  });

  it('fails closed when cache insertion is invalid', async () => {
    mockUpsertBootstrap.mockReturnValueOnce({
      status: 'invalid',
      cacheKey: '',
      config: null,
      existingWorkerOrigin: '',
      workerOrigin: WORKER_ORIGIN,
    });

    render(
      <WorkerCanonicalSessionBootstrapBoundary
        sessionSlug="worker-session"
        workerQueryValue={WORKER_ORIGIN}
        onResolved={jest.fn()}
      />,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('Worker session bootstrap could not be cached.');
    expect(mockMarkBootstrapVerified).not.toHaveBeenCalled();
  });

  it('fails closed when the freshly fetched bootstrap cannot be marked verified', async () => {
    mockMarkBootstrapVerified.mockReturnValueOnce(false);
    const onResolved = jest.fn();

    render(
      <WorkerCanonicalSessionBootstrapBoundary
        sessionSlug="worker-session"
        workerQueryValue={WORKER_ORIGIN}
        onResolved={onResolved}
      />,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('Worker session bootstrap could not be verified.');
    expect(mockUpsertBootstrap).toHaveBeenCalledTimes(1);
    expect(mockMarkBootstrapVerified).toHaveBeenCalledTimes(1);
    expect(onResolved).not.toHaveBeenCalled();
  });

  it('renders discovery failures as an error without resolving', async () => {
    mockFetchBootstrap.mockRejectedValueOnce(new Error('Worker bootstrap request failed with status 403.'));
    const onResolved = jest.fn();
    window.sessionStorage.setItem(STALE_CHUNK_RELOAD_STORAGE_KEY, 'true');

    render(
      <WorkerCanonicalSessionBootstrapBoundary
        sessionSlug="worker-session"
        workerQueryValue={WORKER_ORIGIN}
        onResolved={onResolved}
      />,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('Worker bootstrap request failed with status 403.');
    await waitFor(() => expect(window.sessionStorage.getItem(STALE_CHUNK_RELOAD_STORAGE_KEY)).toBeNull());
    expect(mockUpsertBootstrap).not.toHaveBeenCalled();
    expect(mockMarkBootstrapVerified).not.toHaveBeenCalled();
    expect(onResolved).not.toHaveBeenCalled();
  });

  it.each([500, 598])('retries a bounded HTTP %i bootstrap failure before resolving', async (status) => {
    mockFetchBootstrap
      .mockRejectedValueOnce(
        new WorkerSessionBootstrapRequestError(`Worker bootstrap request failed with status ${status}.`, {
          retryable: true,
          status,
        }),
      )
      .mockResolvedValueOnce(bootstrap);
    const onResolved = jest.fn();

    render(
      <WorkerCanonicalSessionBootstrapBoundary
        sessionSlug="worker-session"
        workerQueryValue={WORKER_ORIGIN}
        onResolved={onResolved}
        retryDelaysMs={[0]}
      />,
    );

    await waitFor(() => expect(onResolved).toHaveBeenCalledWith(bootstrap));
    expect(mockFetchBootstrap).toHaveBeenCalledTimes(2);
  });

  it('still retries a bounded transient network failure before resolving', async () => {
    mockFetchBootstrap.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(bootstrap);
    const onResolved = jest.fn();

    render(
      <WorkerCanonicalSessionBootstrapBoundary
        sessionSlug="worker-session"
        workerQueryValue={WORKER_ORIGIN}
        onResolved={onResolved}
        retryDelaysMs={[0]}
      />,
    );

    await waitFor(() => expect(onResolved).toHaveBeenCalledWith(bootstrap));
    expect(mockFetchBootstrap).toHaveBeenCalledTimes(2);
  });

  it('offers a semantic manual Retry after a nonstandard 5xx failure exhausts automatic retries', async () => {
    mockFetchBootstrap
      .mockRejectedValueOnce(
        new WorkerSessionBootstrapRequestError('Worker bootstrap request failed with status 599.', {
          retryable: true,
          status: 599,
        }),
      )
      .mockResolvedValueOnce(bootstrap);
    const onResolved = jest.fn();

    render(
      <WorkerCanonicalSessionBootstrapBoundary
        sessionSlug="worker-session"
        workerQueryValue={WORKER_ORIGIN}
        onResolved={onResolved}
        retryDelaysMs={[]}
      />,
    );

    const retry = await screen.findByRole('button', { name: 'Retry worker session' });
    expect(screen.getByRole('alert')).toHaveTextContent('status 599');
    await act(async () => retry.click());

    await waitFor(() => expect(onResolved).toHaveBeenCalledWith(bootstrap));
    expect(mockFetchBootstrap).toHaveBeenCalledTimes(2);
  });

  it('caps automatic retries before offering the manual Retry action', async () => {
    mockFetchBootstrap.mockRejectedValue(
      new WorkerSessionBootstrapRequestError('Worker is activating.', {
        retryable: true,
        status: 503,
      }),
    );

    render(
      <WorkerCanonicalSessionBootstrapBoundary
        sessionSlug="worker-session"
        workerQueryValue={WORKER_ORIGIN}
        onResolved={jest.fn()}
        retryDelaysMs={[0, 0, 0, 0]}
      />,
    );

    expect(await screen.findByRole('button', { name: 'Retry worker session' })).toBeInTheDocument();
    expect(mockFetchBootstrap).toHaveBeenCalledTimes(3);
  });

  it.each([
    [
      'permanent HTTP authorization failure',
      new WorkerSessionBootstrapRequestError('Worker bootstrap request failed with status 403.', {
        retryable: false,
        status: 403,
      }),
    ],
    ['invalid canonical config', new Error('Worker bootstrap response slug does not match the requested session.')],
  ])('does not retry or offer Retry for %s', async (_label, failure) => {
    mockFetchBootstrap.mockRejectedValueOnce(failure);

    render(
      <WorkerCanonicalSessionBootstrapBoundary
        sessionSlug="worker-session"
        workerQueryValue={WORKER_ORIGIN}
        onResolved={jest.fn()}
        retryDelaysMs={[0, 0]}
      />,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(failure.message);
    expect(screen.queryByRole('button', { name: 'Retry worker session' })).not.toBeInTheDocument();
    expect(mockFetchBootstrap).toHaveBeenCalledTimes(1);
  });

  it('aborts in-flight discovery on unmount and ignores later completion', async () => {
    const pendingBootstrap = deferred<typeof bootstrap>();
    mockFetchBootstrap.mockReturnValueOnce(pendingBootstrap.promise);
    const onResolved = jest.fn();
    const view = render(
      <WorkerCanonicalSessionBootstrapBoundary
        sessionSlug="worker-session"
        workerQueryValue={WORKER_ORIGIN}
        onResolved={onResolved}
      />,
    );
    const signal = mockFetchBootstrap.mock.calls[0][0].signal;

    view.unmount();
    expect(signal?.aborted).toBe(true);

    await act(async () => {
      pendingBootstrap.resolve(bootstrap);
      await pendingBootstrap.promise;
    });

    expect(mockUpsertBootstrap).not.toHaveBeenCalled();
    expect(mockMarkBootstrapVerified).not.toHaveBeenCalled();
    expect(onResolved).not.toHaveBeenCalled();
  });
});
