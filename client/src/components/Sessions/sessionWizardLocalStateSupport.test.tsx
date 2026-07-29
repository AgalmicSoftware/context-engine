import React from 'react';
import { render } from '@testing-library/react';
import {
  clearSessionWizardCache,
  readSessionWizardCache,
  startFreshSessionWizard,
  useStableSerializedObject,
  writeSessionWizardCache,
} from './sessionWizardLocalStateSupport';
import {
  getSessionWizardWorkerSettlementStorageKey,
  writeSessionWizardWorkerSettlement,
} from './sessionWizardWorkerSettlement';
import {
  clearSessionWizardPendingSbtDraftsCache,
  readSessionWizardPendingSbtDraftsCache,
} from './hooks/usePendingSbtDrafts';

describe('sessionWizardLocalStateSupport', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    clearSessionWizardPendingSbtDraftsCache();
  });

  it('keeps a stable object reference when the serialized value does not change', () => {
    const captures: any[] = [];

    const Probe = ({ value }: { value: Record<string, unknown> | null }) => {
      captures.push(useStableSerializedObject(value));
      return null;
    };

    const { rerender } = render(<Probe value={{ a: 1 }} />);
    rerender(<Probe value={{ a: 1 }} />);
    rerender(<Probe value={{ a: 2 }} />);

    expect(captures[1]).toBe(captures[0]);
    expect(captures[2]).not.toBe(captures[1]);
    expect(captures[2]).toEqual({ a: 2 });
  });

  it('delegates read cache calls to the draft cache reader', () => {
    const readDraftCache = jest.fn(() => ({ draft: { slug: 'demo' } }));
    expect(readSessionWizardCache({ readDraftCache })).toEqual({ draft: { slug: 'demo' } });
    expect(readDraftCache).toHaveBeenCalledTimes(1);
  });

  it('returns null for corrupted non-object cache payloads', () => {
    expect(readSessionWizardCache({ readDraftCache: jest.fn(() => 'stale') })).toBeNull();
    expect(readSessionWizardCache({ readDraftCache: jest.fn(() => ['stale']) })).toBeNull();
    expect(readSessionWizardCache({ readDraftCache: jest.fn(() => null) })).toBeNull();
  });

  it('warns when write cache fails', () => {
    const logger = { warn: jest.fn() };
    const writeDraftCache: any = jest.fn(() => ({
      ok: false as const,
      status: 'too-large' as const,
      error: 'limit reached',
    }));

    expect(writeSessionWizardCache({ draft: {} }, { logger, writeDraftCache })).toEqual({
      ok: false,
      status: 'too-large',
      error: 'limit reached',
    });
    expect(logger.warn).toHaveBeenCalledWith('SessionWizard: fallback', 'limit reached');
  });

  it('forwards the prior cache snapshot used to compare-and-swap an ordinary write', () => {
    const previousPayload = { sessionId: 'previous-id', draft: { slug: 'previous-session' } };
    const nextPayload = { sessionId: 'next-id', draft: { slug: 'next-session' } };
    const writeDraftCache: any = jest.fn(() => ({ ok: true, bytes: 1, key: 'cache', status: 'ok' }));

    writeSessionWizardCache(nextPayload, { expectedCachedPayload: previousPayload, writeDraftCache });

    expect(writeDraftCache).toHaveBeenCalledWith(nextPayload, { expectedCachedPayload: previousPayload });
  });

  it('clears pending sbt drafts and only warns for non-missing storage failures', () => {
    const logger = { warn: jest.fn() };
    const clearPendingSbtDrafts = jest.fn();
    const clearDraftCache: any = jest.fn(
      ({ clearPendingSbtDrafts: clearPending }: { clearPendingSbtDrafts?: () => void } = {}) => {
        clearPending?.();
        return { ok: false, removed: 0, failed: 1, status: 'partial-failure' as const };
      },
    );

    expect(
      clearSessionWizardCache({
        clearDraftCache,
        clearPendingSbtDrafts,
        logger,
      }),
    ).toEqual({ ok: false, removed: 0, failed: 1, status: 'partial-failure' });
    expect(clearPendingSbtDrafts).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith('SessionWizard: fallback', 'partial-failure');

    logger.warn.mockClear();
    clearPendingSbtDrafts.mockClear();
    clearDraftCache.mockImplementation(
      ({ clearPendingSbtDrafts: clearPending }: { clearPendingSbtDrafts?: () => void } = {}) => {
        clearPending?.();
        return { ok: false, removed: 0, failed: 1, status: 'missing-storage' as const };
      },
    );
    clearSessionWizardCache({ clearDraftCache, clearPendingSbtDrafts, logger });
    expect(clearPendingSbtDrafts).toHaveBeenCalledTimes(1);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('returns a combined failure when sessionStorage cleanup throws', () => {
    sessionStorage.setItem('ce:sessionWizardDraft:v1', JSON.stringify({ draft: { slug: 'published-session' } }));
    const logger = { warn: jest.fn() };

    const result = clearSessionWizardCache({
      clearPendingSbtDrafts: () => {
        throw new Error('sessionStorage denied');
      },
      logger,
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        status: 'partial-failure',
        draft: expect.objectContaining({ ok: true }),
        pendingSbtDrafts: expect.objectContaining({ ok: false, status: 'partial-failure' }),
      }),
    );
    expect(logger.warn).toHaveBeenCalledWith('SessionWizard: fallback', 'partial-failure');
  });

  it('forwards the decentralized publication identity into the guarded cache clear', () => {
    const expectedPublicationIdentity = {
      slug: 'published-session',
      sessionId: '0x00112233445566778899aabbccddeeff',
    };
    const clearDraftCache: any = jest.fn(() => ({ ok: true, removed: 1, failed: 0, status: 'ok' }));

    clearSessionWizardCache({ expectedPublicationIdentity, clearDraftCache });

    expect(clearDraftCache).toHaveBeenCalledWith(expect.objectContaining({ expectedPublicationIdentity }));
  });

  it('poisons the published draft while retaining undeployed pending SBT drafts in memory', () => {
    sessionStorage.setItem(
      'ce:sessionWizardDraft:v1',
      JSON.stringify({
        sessionId: 'published-id',
        deployWorkerUrl: 'https://published-worker.example.test',
        draft: {
          slug: 'published-session',
          corsWorkerUrl: 'https://published-worker.example.test',
        },
      }),
    );
    const pendingDraft = {
      predictedAddress: '0x00000000000000000000000000000000000000a1',
      displayName: 'Still pending',
      deployed: false,
    };

    const result = clearSessionWizardCache({
      preservedPendingSbtDrafts: [pendingDraft],
      workerSettlement: {
        workerUrl: 'https://published-worker.example.test',
        slug: 'published-session',
        sessionId: 'published-id',
      },
    });

    expect(result.ok).toBe(true);
    expect(readSessionWizardCache()).toEqual({
      terminalWorkerSettlement: expect.objectContaining({ slug: 'published-session' }),
    });
    expect(sessionStorage.getItem('ce:sessionWizardPendingSbtDrafts:v1')).toBeNull();
    expect(readSessionWizardPendingSbtDraftsCache()).toEqual([expect.objectContaining(pendingDraft)]);
  });

  it('clears only the relevant published worker identity before navigating to a fresh wizard', () => {
    const navigate = jest.fn();
    const settlement = {
      workerUrl: 'https://published-worker.example.test',
      slug: 'published-session',
      sessionId: 'published-id',
    };
    const otherSettlement = {
      workerUrl: 'https://published-worker.example.test',
      slug: 'other-session',
      sessionId: 'other-id',
    };
    sessionStorage.setItem(
      'ce:sessionWizardDraft:v1',
      JSON.stringify({
        terminalWorkerSettlement: {
          version: 2,
          ...settlement,
          settledAt: 1,
        },
      }),
    );
    sessionStorage.setItem('ce:sessionWizardPendingSbtDrafts:v1', '[{"predictedAddress":"0x1"}]');
    writeSessionWizardWorkerSettlement({ ...settlement, settledAt: 1 });
    writeSessionWizardWorkerSettlement({ ...otherSettlement, settledAt: 2 });

    const result = startFreshSessionWizard({ navigate, settlement });

    expect(result.ok).toBe(true);
    expect(readSessionWizardCache()).toBeNull();
    expect(sessionStorage.getItem('ce:sessionWizardPendingSbtDrafts:v1')).toBeNull();
    expect(localStorage.getItem(getSessionWizardWorkerSettlementStorageKey(settlement))).toBeNull();
    expect(localStorage.getItem(getSessionWizardWorkerSettlementStorageKey(otherSettlement))).not.toBeNull();
    expect(navigate).toHaveBeenCalledWith('/new');
  });

  it('does not navigate when durable cache clearing fails', () => {
    const navigate = jest.fn();
    const clearCache = jest.fn(() => ({
      ok: false as const,
      removed: 0,
      failed: 1,
      status: 'partial-failure' as const,
    }));

    expect(startFreshSessionWizard({ clearCache, navigate })).toEqual(
      expect.objectContaining({ ok: false, status: 'partial-failure' }),
    );
    expect(navigate).not.toHaveBeenCalled();
  });

  it('fails closed on missing cache storage instead of navigating', () => {
    const navigate = jest.fn();
    const clearCache = jest.fn(() => ({
      ok: false as const,
      removed: 0,
      failed: 2,
      status: 'missing-storage' as const,
    }));

    expect(startFreshSessionWizard({ clearCache, navigate })).toEqual(
      expect.objectContaining({ ok: false, status: 'missing-storage' }),
    );
    expect(navigate).not.toHaveBeenCalled();
  });

  it('does not navigate when the durable settlement marker cannot be cleared', () => {
    const navigate = jest.fn();
    const clearCache = jest.fn(() => ({ ok: true as const, removed: 1, failed: 0, status: 'ok' as const }));
    const clearWorkerSettlement = jest.fn(() => ({
      ok: false as const,
      removed: 0,
      failed: 1,
      status: 'partial-failure' as const,
    }));

    const settlement = {
      workerUrl: 'https://published-worker.example.test',
      slug: 'published-session',
      sessionId: 'published-id',
    };
    expect(startFreshSessionWizard({ clearCache, clearWorkerSettlement, navigate, settlement })).toEqual(
      expect.objectContaining({ ok: false, status: 'partial-failure' }),
    );
    expect(clearCache).toHaveBeenCalledTimes(1);
    expect(clearWorkerSettlement).toHaveBeenCalledWith(settlement);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('Create Another clears only its marker and preserves a different tab identity in the singleton cache', () => {
    const navigate = jest.fn();
    const settlement = {
      workerUrl: 'https://published-worker.example.test',
      slug: 'published-session',
      sessionId: 'published-id',
    };
    const foreignDraft = {
      sessionId: 'foreign-id',
      deployWorkerUrl: 'https://foreign-worker.example.test',
      draft: {
        slug: 'foreign-session',
        corsWorkerUrl: 'https://foreign-worker.example.test',
        sessionName: 'Keep this newer draft',
      },
    };
    sessionStorage.setItem('ce:sessionWizardDraft:v1', JSON.stringify(foreignDraft));
    writeSessionWizardWorkerSettlement({ ...settlement, settledAt: 1 });

    const result = startFreshSessionWizard({ navigate, settlement });

    expect(result).toEqual(expect.objectContaining({ ok: true }));
    expect(readSessionWizardCache()).toEqual(foreignDraft);
    expect(localStorage.getItem(getSessionWizardWorkerSettlementStorageKey(settlement))).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/new');
  });
});
