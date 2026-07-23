import { act, renderHook } from '@testing-library/react';
import usePendingSbtDrafts, {
  SESSION_WIZARD_PENDING_SBT_DRAFTS_KEY,
  clearSessionWizardPendingSbtDraftsCache,
  readSessionWizardPendingSbtDraftsCache,
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
    clearSessionWizardPendingSbtDraftsCache();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('purges legacy sessionStorage drafts instead of hydrating their secrets', () => {
    sessionStorage.setItem(
      SESSION_WIZARD_PENDING_SBT_DRAFTS_KEY,
      JSON.stringify([buildDraft({ groupPassword: 'legacy-secret', tokenURI: 'ar://pending' })]),
    );

    const { result } = renderHook(() => usePendingSbtDrafts());

    expect(result.current.pendingSbtDrafts).toEqual([]);
    expect(sessionStorage.getItem(SESSION_WIZARD_PENDING_SBT_DRAFTS_KEY)).toBeNull();
  });

  it('keeps pending drafts in tab memory without writing browser storage', () => {
    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');
    const { result } = renderHook(() => usePendingSbtDrafts());

    act(() => {
      result.current.setPendingSbtDrafts([buildDraft({ groupPassword: 'memory-secret' })]);
    });

    expect(setItemSpy).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(SESSION_WIZARD_PENDING_SBT_DRAFTS_KEY)).toBeNull();
    expect(readSessionWizardPendingSbtDraftsCache()).toEqual([
      expect.objectContaining({ groupPassword: 'memory-secret', predictedAddress: PENDING_ADDRESS }),
    ]);
  });

  it('retains the memory update while reporting a failed legacy-artifact purge', () => {
    const storage = {
      removeItem: jest.fn(() => {
        throw new Error('sessionStorage denied');
      }),
    };

    expect(clearSessionWizardPendingSbtDraftsCache({ storage })).toEqual(
      expect.objectContaining({
        ok: false,
        failed: 1,
        status: 'partial-failure',
      }),
    );
  });

  it('retains the memory update while reporting a failed legacy-artifact purge', () => {
    const storage = {
      removeItem: jest.fn(() => {
        throw new Error('sessionStorage denied');
      }),
    };

    expect(writeSessionWizardPendingSbtDraftsCache([buildDraft()], { storage })).toEqual(
      expect.objectContaining({ ok: false, status: 'partial-failure' }),
    );
    expect(readSessionWizardPendingSbtDraftsCache()).toEqual([
      expect.objectContaining({ predictedAddress: PENDING_ADDRESS }),
    ]);
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
