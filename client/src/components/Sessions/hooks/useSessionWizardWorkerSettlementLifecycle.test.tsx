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
    sessionStorage.setItem(SESSION_WIZARD_CACHE_KEY, JSON.stringify(cachedWizard));

    const { result } = renderHook(() => useSessionWizardWorkerSettlementLifecycle(cachedWizard));

    expect(result.current.isSettled).toBe(true);
    expect(result.current.ref.current).toBe(true);
    expect(result.current.settlement).toEqual(expect.objectContaining(identity));
    await waitFor(() =>
      expect(JSON.parse(sessionStorage.getItem(SESSION_WIZARD_CACHE_KEY) || '{}')).toEqual({
        terminalWorkerSettlement: expect.objectContaining(identity),
      }),
    );
    expect(localStorage.getItem(getSessionWizardWorkerSettlementStorageKey(identity))).not.toBeNull();
  });

  it('restores terminal publication links without overwriting links already shown in the tab', async () => {
    writeSessionWizardWorkerSettlement({ ...identity, settledAt: 1 });
    const setSessionUrl = jest.fn();
    const setAdminUrl = jest.fn();

    renderHook(() => useSessionWizardWorkerSettlementLifecycle(cachedWizard, { setSessionUrl, setAdminUrl }));

    await waitFor(() => expect(setSessionUrl).toHaveBeenCalledTimes(1));
    expect(setAdminUrl).toHaveBeenCalledTimes(1);
    const restoreSessionUrl = setSessionUrl.mock.calls[0][0];
    const restoreAdminUrl = setAdminUrl.mock.calls[0][0];
    expect(restoreSessionUrl('')).toContain('/session/published-session?worker=');
    expect(restoreAdminUrl('')).toContain('/admin?sessionId=published-id&sessionSlug=published-session&worker=');
    expect(restoreSessionUrl('https://current.example/session')).toBe('https://current.example/session');
    expect(restoreAdminUrl('https://current.example/admin')).toBe('https://current.example/admin');
  });

  it('guards only worker-canonical published state and creates another session with its fallback identity', () => {
    const startFreshSession = jest.fn(() => ({ ok: true }));
    const { result, rerender } = renderHook(
      ({ isWorkerCanonical }) =>
        useSessionWizardWorkerSettlementLifecycle(cachedWizard, {
          currentIdentity: {
            workerUrl: 'https://fallback-worker.example.test',
            slug: 'fallback-session',
            sessionId: 'fallback-id',
          },
          isWorkerCanonical,
          publishStatus: 'published',
          startFreshSession,
        }),
      { initialProps: { isWorkerCanonical: false } },
    );

    expect(result.current.publishCompleted).toBe(false);
    expect(result.current.preventDuplicatePublish(jest.fn())).toBe(false);
    expect(result.current.onCreateAnotherSession).toBeUndefined();

    rerender({ isWorkerCanonical: true });
    expect(result.current.publishCompleted).toBe(true);
    const onGuarded = jest.fn();
    expect(result.current.preventDuplicatePublish(onGuarded)).toBe(true);
    expect(onGuarded).toHaveBeenCalledWith(expect.stringContaining('already owns the published session'));
    act(() => result.current.onCreateAnotherSession?.());
    expect(startFreshSession).toHaveBeenCalledWith({
      settlement: {
        workerUrl: 'https://fallback-worker.example.test',
        slug: 'fallback-session',
        sessionId: 'fallback-id',
      },
    });
  });

  it('creates another session from the exact terminal identity instead of a newer fallback draft', async () => {
    const terminalCachedWizard = {
      terminalWorkerSettlement: { version: 2, ...identity, settledAt: 1 },
    };
    const startFreshSession = jest.fn(() => ({ ok: true }));
    const { result } = renderHook(() =>
      useSessionWizardWorkerSettlementLifecycle(terminalCachedWizard, {
        currentIdentity: {
          workerUrl: 'https://foreign-worker.example.test',
          slug: 'foreign-session',
          sessionId: 'foreign-id',
        },
        startFreshSession,
      }),
    );

    await waitFor(() => expect(result.current.onCreateAnotherSession).toBeDefined());
    act(() => result.current.onCreateAnotherSession?.());
    expect(startFreshSession).toHaveBeenCalledWith({
      settlement: expect.objectContaining(identity),
    });
  });

  it('keeps the completed publication identity pinned when the form rotates to its next session ID', async () => {
    const nextIdentity = { ...identity, sessionId: 'next-session-id' };
    const startFreshSession = jest.fn(() => ({ ok: true }));
    const { result, rerender } = renderHook(
      ({ currentIdentity, publishStatus }) =>
        useSessionWizardWorkerSettlementLifecycle(cachedWizard, {
          currentIdentity,
          isWorkerCanonical: true,
          publishStatus,
          startFreshSession,
        }),
      { initialProps: { currentIdentity: identity, publishStatus: 'publishing' } },
    );
    act(() => {
      result.current.setSettled({ ...identity, settledAt: 10 });
      writeSessionWizardWorkerSettlement({ ...identity, settledAt: 10 });
    });

    rerender({ currentIdentity: nextIdentity, publishStatus: 'published' });

    await waitFor(() => expect(result.current.settlement).toEqual(expect.objectContaining(identity)));
    act(() => result.current.onCreateAnotherSession?.());
    expect(startFreshSession).toHaveBeenCalledWith({ settlement: expect.objectContaining(identity) });
  });

  it('does not restore a record for a different session on the same worker', () => {
    writeSessionWizardWorkerSettlement({ ...identity, slug: 'other-session', settledAt: 1 });

    const { result } = renderHook(() => useSessionWizardWorkerSettlementLifecycle(cachedWizard));

    expect(result.current.isSettled).toBe(false);
    act(() => result.current.setSettled(identity));
    expect(result.current.isSettled).toBe(true);
    expect(result.current.ref.current).toBe(true);
  });

  it('binds marker recovery when an initially incomplete cached identity becomes complete in the live form', async () => {
    const incompleteCache = {
      draft: { slug: identity.slug },
      sessionId: identity.sessionId,
    };
    const { result, rerender } = renderHook(
      ({ currentIdentity }) => useSessionWizardWorkerSettlementLifecycle(incompleteCache, { currentIdentity }),
      {
        initialProps: {
          currentIdentity: { workerUrl: '', slug: identity.slug, sessionId: identity.sessionId },
        },
      },
    );
    expect(result.current.isSettled).toBe(false);
    writeSessionWizardWorkerSettlement({ ...identity, settledAt: 5 });

    rerender({ currentIdentity: identity });

    await waitFor(() => expect(result.current.isSettled).toBe(true));
    expect(result.current.settlement).toEqual(expect.objectContaining(identity));
  });

  it('drops stale identity X settlement state when the live form rerenders as identity Y', async () => {
    const liveY = {
      workerUrl: 'https://live-worker.example.test',
      slug: 'live-session',
      sessionId: 'live-id',
    };
    writeSessionWizardWorkerSettlement({ ...identity, settledAt: 5 });
    const { result, rerender } = renderHook(
      ({ currentIdentity }) => useSessionWizardWorkerSettlementLifecycle(cachedWizard, { currentIdentity }),
      { initialProps: { currentIdentity: identity } },
    );
    expect(result.current.isSettled).toBe(true);

    rerender({ currentIdentity: liveY });

    await waitFor(() => expect(result.current.isSettled).toBe(false));
    expect(result.current.ref.current).toBe(false);
    writeSessionWizardWorkerSettlement({ ...liveY, settledAt: 10 });
    const liveMarkerKey = getSessionWizardWorkerSettlementStorageKey(liveY);
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: liveMarkerKey,
          newValue: localStorage.getItem(liveMarkerKey),
          storageArea: localStorage,
        }),
      );
    });
    await waitFor(() => expect(result.current.isSettled).toBe(true));
    expect(result.current.settlement).toEqual(expect.objectContaining(liveY));
  });

  it('terminal-locks two live tabs from the identity-scoped v2 localStorage event', async () => {
    const firstTab = renderHook(() => useSessionWizardWorkerSettlementLifecycle(cachedWizard));
    const secondTab = renderHook(() => useSessionWizardWorkerSettlementLifecycle(cachedWizard));
    expect(firstTab.result.current.isSettled).toBe(false);
    expect(secondTab.result.current.isSettled).toBe(false);

    writeSessionWizardWorkerSettlement({ ...identity, settledAt: 10 });
    const key = getSessionWizardWorkerSettlementStorageKey(identity);
    expect(key).toMatch(/^ce:sessionWizardWorkerSettlement:v2:/);
    expect(localStorage.getItem(key)).not.toBeNull();
    expect(sessionStorage.getItem(key)).toBeNull();
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
    expect(browserTab.result.current.settlement).toEqual(expect.objectContaining({ sessionId: publishedSessionId }));
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
    const matchingCachedWizard = { ...cachedWizard, sessionId: terminalWorkerSettlement.sessionId };
    sessionStorage.setItem(SESSION_WIZARD_CACHE_KEY, JSON.stringify(matchingCachedWizard));
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
      expect(JSON.parse(sessionStorage.getItem(SESSION_WIZARD_CACHE_KEY) || '{}')).toEqual({
        terminalWorkerSettlement,
      }),
    );
  });

  it('does not invent a terminal settlement from a draft removal without a marker or tombstone', () => {
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

    expect(otherTab.result.current.isSettled).toBe(false);
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
