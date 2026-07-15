import { act, renderHook, waitFor } from '@testing-library/react';
import { SESSION_WIZARD_WORKER_SETTLEMENT_KEY } from '../sessionWizardWorkerSettlement';
import useSessionWizardWorkerSettlementLifecycle from './useSessionWizardWorkerSettlementLifecycle';

describe('useSessionWizardWorkerSettlementLifecycle', () => {
  beforeEach(() => localStorage.clear());

  it('restores a matching terminal settlement and removes the stale deployed draft', async () => {
    localStorage.setItem(
      SESSION_WIZARD_WORKER_SETTLEMENT_KEY,
      JSON.stringify({
        version: 1,
        workerUrl: 'https://published-worker.example.test',
        slug: 'published-session',
        sessionId: 'published-id',
        settledAt: 1,
      }),
    );
    localStorage.setItem(
      'ce:sessionWizardDraft:v1',
      JSON.stringify({ deployWorkerUrl: 'https://published-worker.example.test/' }),
    );

    const { result } = renderHook(() =>
      useSessionWizardWorkerSettlementLifecycle({
        deployWorkerUrl: 'https://published-worker.example.test/',
      }),
    );

    expect(result.current.isSettled).toBe(true);
    expect(result.current.ref.current).toBe(true);
    await waitFor(() => expect(localStorage.getItem('ce:sessionWizardDraft:v1')).toBeNull());
    expect(localStorage.getItem(SESSION_WIZARD_WORKER_SETTLEMENT_KEY)).not.toBeNull();
  });

  it('does not restore a settlement owned by a different deployed worker', () => {
    localStorage.setItem(
      SESSION_WIZARD_WORKER_SETTLEMENT_KEY,
      JSON.stringify({
        version: 1,
        workerUrl: 'https://published-worker.example.test',
        slug: 'published-session',
        sessionId: 'published-id',
        settledAt: 1,
      }),
    );

    const { result } = renderHook(() =>
      useSessionWizardWorkerSettlementLifecycle({ deployWorkerUrl: 'https://fresh-worker.example.test' }),
    );

    expect(result.current.isSettled).toBe(false);
    act(() => result.current.setSettled(true));
    expect(result.current.isSettled).toBe(true);
    expect(result.current.ref.current).toBe(true);
  });
});
