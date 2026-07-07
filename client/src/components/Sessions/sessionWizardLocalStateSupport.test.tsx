import React from 'react';
import { render } from '@testing-library/react';
import {
  clearSessionWizardCache,
  readSessionWizardCache,
  useStableSerializedObject,
  writeSessionWizardCache,
} from './sessionWizardLocalStateSupport';

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
});
