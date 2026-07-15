import { act, renderHook, waitFor } from '@testing-library/react';
import { SESSION_WIZARD_CACHE_KEY, clearSessionWizardDraftCache } from '../sessionWizardDraftCache';
import { readSessionWizardCache } from '../sessionWizardLocalStateSupport';
import {
  getSessionWizardWorkerSettlementStorageKey,
  writeSessionWizardWorkerSettlement,
} from '../sessionWizardWorkerSettlement';
import { SESSION_WIZARD_PENDING_SBT_DRAFTS_KEY } from './usePendingSbtDrafts';
import useSessionWizardWorkerSettlementLifecycle from './useSessionWizardWorkerSettlementLifecycle';

const identity = {
  workerUrl: 'https://published-worker.example.test',
  slug: 'published-session',
  sessionId: 'published-id',
};

const cachedWizard = {
  deployWorkerUrl: `${identity.workerUrl}/`,
  draft: { slug: identity.slug, corsWorkerUrl: `${identity.workerUrl}/` },
  sessionId: identity.sessionId,
};

describe('useSessionWizardWorkerSettlementLifecycle', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('restores a matching terminal settlement and removes the stale deployed draft', async () => {
    writeSessionWizardWorkerSettlement({ ...identity, settledAt: 1 });
    localStorage.setItem(SESSION_WIZARD_CACHE_KEY, JSON.stringify(cachedWizard));

    const { result } = renderHook(() => useSessionWizardWorkerSettlementLifecycle(cachedWizard));

    expect(result.current.isSettled).toBe(true);
    expect(result.current.ref.current).toBe(true);
    expect(result.current.settlement).toEqual(expect.objectContaining(identity));
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem(SESSION_WIZARD_CACHE_KEY) || '{}')).toEqual({
        terminalWorkerSettlement: expect.objectContaining(identity),
      }),
    );
    expect(localStorage.getItem(getSessionWizardWorkerSettlementStorageKey(identity))).not.toBeNull();
  });

  it('does not restore a record for a different session on the same worker', () => {
    writeSessionWizardWorkerSettlement({ ...identity, slug: 'other-session', settledAt: 1 });

    const { result } = renderHook(() => useSessionWizardWorkerSettlementLifecycle(cachedWizard));

    expect(result.current.isSettled).toBe(false);
    act(() => result.current.setSettled(identity));
    expect(result.current.isSettled).toBe(true);
    expect(result.current.ref.current).toBe(true);
  });

  it('terminal-locks two live tabs from the per-identity storage event', async () => {
    const firstTab = renderHook(() => useSessionWizardWorkerSettlementLifecycle(cachedWizard));
    const secondTab = renderHook(() => useSessionWizardWorkerSettlementLifecycle(cachedWizard));
    expect(firstTab.result.current.isSettled).toBe(false);
    expect(secondTab.result.current.isSettled).toBe(false);

    writeSessionWizardWorkerSettlement({ ...identity, settledAt: 10 });
    const key = getSessionWizardWorkerSettlementStorageKey(identity);
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key,
          newValue: localStorage.getItem(key),
          storageArea: localStorage,
        }),
      );
    });

    await waitFor(() => expect(firstTab.result.current.isSettled).toBe(true));
    expect(secondTab.result.current.isSettled).toBe(true);
  });

  it('terminal-locks a browser UUID draft from the published bytes16 marker event', async () => {
    const browserSessionId = '00112233-4455-6677-8899-aabbccddeeff';
    const publishedSessionId = '0x00112233445566778899aabbccddeeff';
    const browserCachedWizard = {
      ...cachedWizard,
      sessionId: browserSessionId,
    };
    const browserTab = renderHook(() => useSessionWizardWorkerSettlementLifecycle(browserCachedWizard));

    writeSessionWizardWorkerSettlement({ ...identity, sessionId: publishedSessionId, settledAt: 10 });
    const key = getSessionWizardWorkerSettlementStorageKey({ ...identity, sessionId: publishedSessionId });
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key,
          newValue: localStorage.getItem(key),
          storageArea: localStorage,
        }),
      );
    });

    await waitFor(() => expect(browserTab.result.current.isSettled).toBe(true));
    expect(browserTab.result.current.settlement).toEqual(
      expect.objectContaining({ sessionId: publishedSessionId }),
    );
  });

  it('terminal-locks another tab from the tombstone without deleting its pending SBT drafts', async () => {
    sessionStorage.setItem(SESSION_WIZARD_PENDING_SBT_DRAFTS_KEY, '[{"predictedAddress":"0x1"}]');
    const otherTab = renderHook(() => useSessionWizardWorkerSettlementLifecycle(cachedWizard));
    const terminalWorkerSettlement = {
      version: 2,
      ...identity,
      settledAt: 10,
    };

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: SESSION_WIZARD_CACHE_KEY,
          oldValue: JSON.stringify(cachedWizard),
          newValue: JSON.stringify({ terminalWorkerSettlement }),
          storageArea: localStorage,
        }),
      );
    });

    await waitFor(() => expect(otherTab.result.current.isSettled).toBe(true));
    expect(otherTab.result.current.settlement).toEqual(expect.objectContaining(identity));
    await waitFor(() => expect(sessionStorage.getItem(SESSION_WIZARD_PENDING_SBT_DRAFTS_KEY)).not.toBeNull());
  });

  it('restores a tombstone-only cache after a real page reload', async () => {
    const terminalWorkerSettlement = {
      version: 2,
      ...identity,
      sessionId: '0x00112233445566778899aabbccddeeff',
      settledAt: 10,
    };
    localStorage.setItem(SESSION_WIZARD_CACHE_KEY, JSON.stringify(cachedWizard));
    expect(
      clearSessionWizardDraftCache({
        workerSettlement: terminalWorkerSettlement,
        clearPendingSbtDrafts: () => ({ ok: true, removed: 0, failed: 0, status: 'ok' }),
      }),
    ).toEqual(expect.objectContaining({ ok: true, poisoned: true }));
    const reloadedCache = readSessionWizardCache();

    expect(reloadedCache).toEqual({ terminalWorkerSettlement });
    const reloadedTab = renderHook(() => useSessionWizardWorkerSettlementLifecycle(reloadedCache));

    expect(reloadedTab.result.current.isSettled).toBe(true);
    expect(reloadedTab.result.current.settlement).toEqual(terminalWorkerSettlement);
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem(SESSION_WIZARD_CACHE_KEY) || '{}')).toEqual({
        terminalWorkerSettlement,
      }),
    );
  });

  it('terminal-locks from a worker-canonical removal fallback when tombstone writing fails', async () => {
    const otherTab = renderHook(() => useSessionWizardWorkerSettlementLifecycle(cachedWizard));
    const workerCanonicalDraft = {
      ...cachedWizard,
      draft: {
        ...cachedWizard.draft,
        sessionModeProfile: { authority: { mode: 'worker_canonical' } },
      },
    };

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: SESSION_WIZARD_CACHE_KEY,
          oldValue: JSON.stringify(workerCanonicalDraft),
          newValue: null,
          storageArea: localStorage,
        }),
      );
    });

    await waitFor(() => expect(otherTab.result.current.isSettled).toBe(true));
  });

  it('does not terminal-lock a decentralized draft removal', () => {
    const currentTab = renderHook(() => useSessionWizardWorkerSettlementLifecycle(cachedWizard));
    const decentralizedDraft = {
      ...cachedWizard,
      draft: {
        ...cachedWizard.draft,
        sessionModeProfile: { authority: { mode: 'evm_registry' } },
      },
    };

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: SESSION_WIZARD_CACHE_KEY,
          oldValue: JSON.stringify(decentralizedDraft),
          newValue: null,
          storageArea: localStorage,
        }),
      );
    });

    expect(currentTab.result.current.isSettled).toBe(false);
  });

  it('ignores marker and tombstone events for a different session on the same worker', () => {
    const currentTab = renderHook(() => useSessionWizardWorkerSettlementLifecycle(cachedWizard));
    const foreignSettlement = {
      version: 2,
      ...identity,
      slug: 'foreign-session',
      sessionId: 'foreign-id',
      settledAt: 10,
    };
    writeSessionWizardWorkerSettlement(foreignSettlement);
    const markerKey = getSessionWizardWorkerSettlementStorageKey(foreignSettlement);

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: markerKey,
          newValue: localStorage.getItem(markerKey),
          storageArea: localStorage,
        }),
      );
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: SESSION_WIZARD_CACHE_KEY,
          newValue: JSON.stringify({ terminalWorkerSettlement: foreignSettlement }),
          storageArea: localStorage,
        }),
      );
    });

    expect(currentTab.result.current.isSettled).toBe(false);
  });

  it('does not treat an ordinary same-session draft cache write as a terminal event', () => {
    const currentTab = renderHook(() => useSessionWizardWorkerSettlementLifecycle(cachedWizard));

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: SESSION_WIZARD_CACHE_KEY,
          newValue: JSON.stringify(cachedWizard),
          storageArea: localStorage,
        }),
      );
    });

    expect(currentTab.result.current.isSettled).toBe(false);
  });

  it('keeps the old tab locked without recreating a tombstone removed by Create Another', async () => {
    writeSessionWizardWorkerSettlement({ ...identity, settledAt: 10 });
    const terminalPayload = {
      terminalWorkerSettlement: { version: 2, ...identity, settledAt: 10 },
    };
    localStorage.setItem(SESSION_WIZARD_CACHE_KEY, JSON.stringify(terminalPayload));
    const oldTab = renderHook(() => useSessionWizardWorkerSettlementLifecycle(cachedWizard));
    await waitFor(() => expect(oldTab.result.current.isSettled).toBe(true));
    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: SESSION_WIZARD_CACHE_KEY,
          oldValue: JSON.stringify(terminalPayload),
          newValue: null,
          storageArea: localStorage,
        }),
      );
    });

    expect(oldTab.result.current.isSettled).toBe(true);
    expect(setItemSpy).not.toHaveBeenCalledWith(SESSION_WIZARD_CACHE_KEY, expect.any(String));
    setItemSpy.mockRestore();
  });
});
