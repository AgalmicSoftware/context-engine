import { act, renderHook } from '@testing-library/react';
import usePendingSbtDrafts, {
  SESSION_WIZARD_PENDING_SBT_DRAFTS_KEY,
  clearSessionWizardPendingSbtDraftsCache,
  writeSessionWizardPendingSbtDraftsCache,
} from './usePendingSbtDrafts.js';

const PENDING_ADDRESS = '0x00000000000000000000000000000000000000a1';
const DEPLOYED_ADDRESS = '0x00000000000000000000000000000000000000b2';

const buildDraft = (overrides = {}) => ({
  predictedAddress: PENDING_ADDRESS,
  displayName: 'Pending Access',
  tokenURI: '',
  deployed: false,
  ...overrides,
});

describe('usePendingSbtDrafts', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('hydrates initial value from the sessionStorage cache', () => {
    sessionStorage.setItem(
      SESSION_WIZARD_PENDING_SBT_DRAFTS_KEY,
      JSON.stringify([buildDraft({ tokenURI: 'ar://pending' })]),
    );
    const getItemSpy = jest.spyOn(Storage.prototype, 'getItem');

    const { result } = renderHook(() => usePendingSbtDrafts());

    expect(getItemSpy).toHaveBeenCalledWith(SESSION_WIZARD_PENDING_SBT_DRAFTS_KEY);
    expect(result.current.pendingSbtDrafts).toHaveLength(1);
    expect(result.current.pendingSbtDrafts[0]).toMatchObject({
      predictedAddress: PENDING_ADDRESS,
      displayName: 'Pending Access',
      metadataUploadStatus: 'ready',
    });
  });

  it('updates the cache when pending drafts change', () => {
    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');
    const { result } = renderHook(() => usePendingSbtDrafts());

    act(() => {
      result.current.setPendingSbtDrafts([buildDraft()]);
    });

    expect(setItemSpy).toHaveBeenCalledWith(
      SESSION_WIZARD_PENDING_SBT_DRAFTS_KEY,
      expect.stringContaining(PENDING_ADDRESS),
    );
    expect(JSON.parse(sessionStorage.getItem(SESSION_WIZARD_PENDING_SBT_DRAFTS_KEY) || '[]')).toEqual([
      expect.objectContaining({
        predictedAddress: PENDING_ADDRESS,
        displayName: 'Pending Access',
        metadataUploadStatus: 'pending-upload',
      }),
    ]);
  });

  it('reports a throwing sessionStorage clear instead of swallowing it', () => {
    const storage = {
      removeItem: jest.fn(() => {
        throw new Error('sessionStorage denied');
      }),
    };

    expect(clearSessionWizardPendingSbtDraftsCache({ storage })).toEqual({
      ok: false,
      removed: 0,
      failed: 1,
      status: 'partial-failure',
    });
  });

  it('reports a failed atomic replacement without deleting the prior pending drafts', () => {
    const prior = JSON.stringify([buildDraft({ displayName: 'Prior draft' })]);
    const storage = {
      getItem: jest.fn(() => prior),
      setItem: jest.fn(() => {
        throw new Error('sessionStorage denied');
      }),
      removeItem: jest.fn(),
    };

    expect(writeSessionWizardPendingSbtDraftsCache([buildDraft()], { storage })).toEqual(
      expect.objectContaining({ ok: false, status: 'write-failed' }),
    );
    expect(storage.removeItem).not.toHaveBeenCalled();
    expect(storage.getItem()).toBe(prior);
  });

  it('derives normalized drafts and undeployed status from state', () => {
    const { result } = renderHook(() => usePendingSbtDrafts());

    act(() => {
      result.current.setPendingSbtDrafts([
        buildDraft({ deployed: true }),
        buildDraft({
          predictedAddress: DEPLOYED_ADDRESS,
          displayName: 'Second Access',
          tokenURI: 'ar://second',
          deployed: false,
        }),
      ]);
    });

    expect(result.current.normalizedPendingSbtDrafts).toEqual([
      expect.objectContaining({
        predictedAddress: PENDING_ADDRESS,
        metadataUploadStatus: 'pending-upload',
      }),
      expect.objectContaining({
        predictedAddress: DEPLOYED_ADDRESS,
        metadataUploadStatus: 'ready',
      }),
    ]);
    expect(result.current.hasUndeployedPendingSbtDrafts).toBe(true);

    act(() => {
      result.current.setPendingSbtDrafts((current) =>
        current.map((draft) => ({
          ...draft,
          deployed: true,
        })),
      );
    });

    expect(result.current.hasUndeployedPendingSbtDrafts).toBe(false);
  });
});
