import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import AgentPage from './AgentPage';

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
};

describe('AgentPage', () => {
  afterEach(() => {
    delete window.__ceAgent;
    jest.restoreAllMocks();
  });

  it('renders disabled status when the agent is unavailable', () => {
    render(<AgentPage />);

    expect(screen.getByText('Enabled:')).toBeInTheDocument();
    expect(screen.getByText('no')).toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.AGENT_LOG)).toHaveTextContent('Log is empty.');
    expect(screen.getByTestId(E2E_TESTIDS.AGENT_ACTIONS)).not.toHaveValue(
      expect.stringContaining('ai-browseruse-75209033'),
    );
  });

  it('renders the current contract summary when the agent exposes describe()', () => {
    window.__ceAgent = {
      getState: () => ({ route: '/agent', account: '0xabc' }),
      describe: () => ({
        version: 1,
        actions: [{ type: 'navigate' }, { type: 'fill' }, { type: 'click' }],
        tools: [{ name: 'CompareAddresses' }, { name: 'PolisReport' }],
      }),
    };

    render(<AgentPage />);

    expect(screen.getByText('3 actions')).toBeInTheDocument();
    expect(screen.getByText('· 2 tools')).toBeInTheDocument();
    expect(screen.getByText('navigate, fill, click')).toBeInTheDocument();
    expect(screen.getByText('CompareAddresses, PolisReport')).toBeInTheDocument();
  });

  it('steps through the first configured action when an agent is available', async () => {
    const perform = jest.fn(async () => ({ ok: true }));
    window.__ceAgent = {
      getState: () => ({ route: '/agent', account: '0xabc' }),
      perform,
    };

    render(<AgentPage />);

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.AGENT_STEP));

    await waitFor(() => {
      expect(perform).toHaveBeenCalledWith(expect.objectContaining({ type: 'navigate', to: '/compare/' }));
    });
    await waitFor(() => {
      expect(screen.getByTestId(E2E_TESTIDS.AGENT_LOG)).toHaveTextContent('step:result');
    });
  });

  it('logs run start and result while the page remains mounted', async () => {
    const run = jest.fn(async (actions) => ({ ok: true, actions: actions.length }));
    window.__ceAgent = {
      getState: () => ({ route: '/agent', account: '0xabc' }),
      run,
    };

    render(<AgentPage />);

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.AGENT_RUN));

    await waitFor(() => {
      expect(run).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ type: 'navigate', to: '/compare/' })]),
      );
    });
    await waitFor(() => {
      expect(screen.getByTestId(E2E_TESTIDS.AGENT_LOG)).toHaveTextContent('run:start');
      expect(screen.getByTestId(E2E_TESTIDS.AGENT_LOG)).toHaveTextContent('run:result');
      expect(screen.getByTestId(E2E_TESTIDS.AGENT_LOG)).toHaveTextContent('"ok": true');
    });
  });

  it('logs run errors while the page remains mounted', async () => {
    window.__ceAgent = {
      getState: () => ({ route: '/agent', account: '0xabc' }),
      run: jest.fn(async () => {
        throw new Error('agent run failed');
      }),
    };

    render(<AgentPage />);

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.AGENT_RUN));

    await waitFor(() => {
      expect(screen.getByTestId(E2E_TESTIDS.AGENT_LOG)).toHaveTextContent('run:error');
      expect(screen.getByTestId(E2E_TESTIDS.AGENT_LOG)).toHaveTextContent('agent run failed');
    });
  });

  it('ignores a deferred run result after a later run starts', async () => {
    const firstRun = createDeferred<{ ok: string }>();
    const run = jest
      .fn()
      .mockImplementationOnce(() => firstRun.promise)
      .mockResolvedValueOnce({ ok: 'fresh-run' });
    window.__ceAgent = {
      getState: () => ({ route: '/agent', account: '0xabc' }),
      run,
    };

    render(<AgentPage />);

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.AGENT_RUN));
    await waitFor(() => {
      expect(run).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId(E2E_TESTIDS.AGENT_LOG)).toHaveTextContent('run:start');
    });

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.AGENT_RUN));
    await waitFor(() => {
      expect(run).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId(E2E_TESTIDS.AGENT_LOG)).toHaveTextContent('fresh-run');
    });

    await act(async () => {
      firstRun.resolve({ ok: 'stale-run' });
      await firstRun.promise;
    });

    expect(screen.getByTestId(E2E_TESTIDS.AGENT_LOG)).toHaveTextContent('fresh-run');
    expect(screen.getByTestId(E2E_TESTIDS.AGENT_LOG)).not.toHaveTextContent('stale-run');
  });

  it('does not update state when a deferred run resolves after unmount', async () => {
    const deferredRun = createDeferred<{ ok: boolean }>();
    const run = jest.fn(() => deferredRun.promise);
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    window.__ceAgent = {
      getState: () => ({ route: '/agent', account: '0xabc' }),
      run,
    };

    const { unmount } = render(<AgentPage />);

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.AGENT_RUN));
    await waitFor(() => {
      expect(run).toHaveBeenCalledTimes(1);
    });

    unmount();
    await act(async () => {
      deferredRun.resolve({ ok: true });
      await deferredRun.promise;
    });

    expect(consoleError).not.toHaveBeenCalled();
  });
});
