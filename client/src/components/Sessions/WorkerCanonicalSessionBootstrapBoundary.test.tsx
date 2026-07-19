import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';

import WorkerCanonicalSessionBootstrapBoundary from './WorkerCanonicalSessionBootstrapBoundary';
import {
  fetchWorkerCanonicalSessionBootstrap,
  validateWorkerCanonicalSessionBootstrap,
  WorkerSessionBootstrapRequestError,
} from '../../utilities/session/sessionWorkerDiscovery';
import {
  markWorkerCanonicalSessionBootstrapVerified,
  upsertWorkerCanonicalSessionBootstrap,
} from '../../utilities/session/sessionWorkerConfigCache.js';
import { resolveMainSiteLitSessionConfig } from '../MainSite/litSessionConfig.js';
import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from '../../utilities/session/sessionModeProfile';

jest.mock('../../utilities/session/sessionWorkerDiscovery', () => ({
  ...jest.requireActual('../../utilities/session/sessionWorkerDiscovery'),
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
  existingSessionIdHex: '',
  sessionIdHex: SESSION_ID,
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
    mockFetchBootstrap.mockReset();
    mockUpsertBootstrap.mockReset();
    mockMarkBootstrapVerified.mockReset();
    mockFetchBootstrap.mockResolvedValue(bootstrap);
    mockUpsertBootstrap.mockReturnValue(cachedResult);
    mockMarkBootstrapVerified.mockReturnValue(true);
  });

  it('renders loading state, resolves through discovery, caches without repinning, and reports the bootstrap', async () => {
    const fetchImpl = jest.fn() as unknown as typeof fetch;
    const onResolved = jest.fn();
    const pendingBootstrap = deferred<typeof bootstrap>();
    mockFetchBootstrap.mockReturnValueOnce(pendingBootstrap.promise);

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

  it('composes a fresh validated Lit bootstrap into descriptor-free worker hooks config', async () => {
    const sessionModeProfile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    sessionModeProfile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
    sessionModeProfile.encryption = { mode: 'lit' };
    sessionModeProfile.evm.registryChainId = 11155420;
    const config = {
      slug: 'worker-session',
      sessionId: SESSION_ID,
      configRevision: 'revision-lit',
      corsWorkerUrl: WORKER_ORIGIN,
      sessionModeProfile,
    };
    const validatedBootstrap = validateWorkerCanonicalSessionBootstrap(
      {
        ok: true,
        sessionSlug: 'worker-session',
        config,
      },
      {
        expectedSlug: 'worker-session',
        workerOrigin: WORKER_ORIGIN,
        environment: 'test',
      },
    );
    const onResolved = jest.fn((resolved) => resolveMainSiteLitSessionConfig({ sessionConfig: resolved.config }));
    mockFetchBootstrap.mockResolvedValueOnce(validatedBootstrap);
    mockUpsertBootstrap.mockReturnValueOnce({
      ...cachedResult,
      config,
    });

    render(
      <WorkerCanonicalSessionBootstrapBoundary
        sessionSlug="worker-session"
        workerQueryValue={WORKER_ORIGIN}
        environment="test"
        onResolved={onResolved}
      />,
    );

    await waitFor(() => expect(onResolved).toHaveBeenCalledTimes(1));
    expect(onResolved.mock.results[0].value).toEqual(
      expect.objectContaining({
        chainId: 11155420,
        litNetwork: 'chipotle',
        chipotle: {
          enabled: true,
          workerUrl: WORKER_ORIGIN,
          litCredentials: {},
          sessionConfig: config,
        },
      }),
    );
    expect(config).not.toHaveProperty('lit');
    expect(config).not.toHaveProperty('litCredentials');
    expect(config).not.toHaveProperty('rpcUrl');
    expect(config).not.toHaveProperty('rpcUrlsByChainId');
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
          existingSessionIdHex: '0xffeeddccbbaa99887766554433221100',
          sessionIdHex: SESSION_ID,
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
      expect(message).toContain('0xffeeddccbbaa99887766554433221100');
      expect(message).toContain(SESSION_ID);
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

  it('shows both session IDs when a same-origin canonical identity changes', async () => {
    const previousSessionId = '0xffeeddccbbaa99887766554433221100';
    mockUpsertBootstrap
      .mockReturnValueOnce({
        status: 'conflict',
        cacheKey: cachedResult.cacheKey,
        config: bootstrap.config,
        existingSessionIdHex: previousSessionId,
        sessionIdHex: SESSION_ID,
        existingWorkerOrigin: WORKER_ORIGIN,
        workerOrigin: WORKER_ORIGIN,
      })
      .mockReturnValueOnce(cachedResult);
    const confirmRepin = jest.fn(async () => true);

    render(
      <WorkerCanonicalSessionBootstrapBoundary
        sessionSlug="worker-session"
        workerQueryValue={WORKER_ORIGIN}
        onResolved={jest.fn()}
        confirmRepin={confirmRepin}
      />,
    );

    await waitFor(() => expect(confirmRepin).toHaveBeenCalledTimes(1));
    expect(confirmRepin.mock.calls[0][0]).toContain(previousSessionId);
    expect(confirmRepin.mock.calls[0][0]).toContain(SESSION_ID);
    expect(confirmRepin.mock.calls[0][0]).not.toContain(`origin ${WORKER_ORIGIN} -> ${WORKER_ORIGIN}`);
  });

  it('shows both slugs when an authoritative session ID is reused by a different slug', async () => {
    mockUpsertBootstrap
      .mockReturnValueOnce({
        status: 'conflict',
        cacheKey: cachedResult.cacheKey,
        config: { ...bootstrap.config, slug: 'first-session' },
        existingSessionIdHex: SESSION_ID,
        sessionIdHex: SESSION_ID,
        existingWorkerOrigin: WORKER_ORIGIN,
        workerOrigin: WORKER_ORIGIN,
      })
      .mockReturnValueOnce(cachedResult);
    const confirmRepin = jest.fn(async () => true);

    render(
      <WorkerCanonicalSessionBootstrapBoundary
        sessionSlug="worker-session"
        workerQueryValue={WORKER_ORIGIN}
        onResolved={jest.fn()}
        confirmRepin={confirmRepin}
      />,
    );

    await waitFor(() => expect(confirmRepin).toHaveBeenCalledTimes(1));
    expect(confirmRepin.mock.calls[0][0]).toContain('session slug "first-session" -> "worker-session"');
    expect(confirmRepin.mock.calls[0][0]).not.toContain(`origin ${WORKER_ORIGIN} -> ${WORKER_ORIGIN}`);
    expect(confirmRepin.mock.calls[0][0]).not.toContain(`ID ${SESSION_ID} -> ${SESSION_ID}`);
  });

  it('fails closed when a TOFU repin is declined', async () => {
    mockUpsertBootstrap.mockReturnValueOnce({
      status: 'conflict',
      cacheKey: cachedResult.cacheKey,
      config: bootstrap.config,
      existingSessionIdHex: '0xffeeddccbbaa99887766554433221100',
      sessionIdHex: SESSION_ID,
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

    expect(await screen.findByRole('alert')).toHaveTextContent('Worker identity change was not approved.');
    expect(confirmRepin).toHaveBeenCalledTimes(1);
    expect(mockUpsertBootstrap).toHaveBeenCalledTimes(1);
    expect(mockMarkBootstrapVerified).not.toHaveBeenCalled();
    expect(onResolved).not.toHaveBeenCalled();
    expect(mockFetchBootstrap).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Retry worker session' })).not.toBeInTheDocument();
  });

  it('fails closed when cache insertion is invalid', async () => {
    mockUpsertBootstrap.mockReturnValueOnce({
      status: 'invalid',
      cacheKey: '',
      config: null,
      existingSessionIdHex: '',
      sessionIdHex: SESSION_ID,
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

    render(
      <WorkerCanonicalSessionBootstrapBoundary
        sessionSlug="worker-session"
        workerQueryValue={WORKER_ORIGIN}
        onResolved={onResolved}
      />,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('Worker bootstrap request failed with status 403.');
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
