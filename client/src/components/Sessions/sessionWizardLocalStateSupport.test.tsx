import React from 'react';
import { render } from '@testing-library/react';
import {
  clearSessionWizardCache,
  readSessionWizardCache,
  startFreshSessionWizard,
  useStableSerializedObject,
  writeSessionWizardCache,
} from './sessionWizardLocalStateSupport';
import { SESSION_WIZARD_WORKER_SETTLEMENT_KEY } from './sessionWizardWorkerSettlement';

describe('sessionWizardLocalStateSupport', () => {
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

  it('clears the published worker identity before navigating to a fresh wizard', () => {
    const navigate = jest.fn();
    localStorage.setItem(
      'ce:sessionWizardDraft:v1',
      JSON.stringify({
        deployComplete: true,
        deployWorkerUrl: 'https://published-worker.example.test',
        draft: { corsWorkerUrl: 'https://published-worker.example.test' },
      }),
    );
    sessionStorage.setItem('ce:sessionWizardPendingSbtDrafts:v1', '[{"predictedAddress":"0x1"}]');
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

    const result = startFreshSessionWizard({ navigate });

    expect(result.ok).toBe(true);
    expect(readSessionWizardCache()).toBeNull();
    expect(sessionStorage.getItem('ce:sessionWizardPendingSbtDrafts:v1')).toBeNull();
    expect(localStorage.getItem(SESSION_WIZARD_WORKER_SETTLEMENT_KEY)).toBeNull();
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

  it('does not navigate when the durable settlement marker cannot be cleared', () => {
    const navigate = jest.fn();
    const clearCache = jest.fn(() => ({ ok: true as const, removed: 1, failed: 0, status: 'ok' as const }));
    const clearWorkerSettlement = jest.fn(() => ({
      ok: false as const,
      removed: 0,
      failed: 1,
      status: 'partial-failure' as const,
    }));

    expect(startFreshSessionWizard({ clearCache, clearWorkerSettlement, navigate })).toEqual(
      expect.objectContaining({ ok: false, status: 'partial-failure' }),
    );
    expect(clearCache).toHaveBeenCalledTimes(1);
    expect(clearWorkerSettlement).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });
});
