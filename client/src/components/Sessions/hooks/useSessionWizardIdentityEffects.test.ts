import { renderHook } from '@testing-library/react';
import { sessionRegistryUtils } from '../../../utilities/web3/sessionRegistry.js';
import useSessionWizardIdentityEffects from './useSessionWizardIdentityEffects.js';

type DraftState = {
  slug?: unknown;
  sessionName?: unknown;
};

const renderIdentityEffects = (
  overrides: Partial<{
    initialRegistryChainId: unknown;
    initialSessionId: unknown;
    privateSlugMode: boolean;
    sessionId: unknown;
    slugPinnedByPendingSbtDrafts: boolean;
    draftSessionName: unknown;
    draftSlug: unknown;
    lastManualSlug: string;
    hasPrivateSbtName: boolean;
    privateSlugModeCurrent: boolean;
  }> = {},
) => {
  const setRegistryChainId = jest.fn();
  const setSessionId = jest.fn();
  const setDraft = jest.fn();
  const togglePrivateSlugMode = jest.fn();
  const lastManualSlugRef = { current: overrides.lastManualSlug || '' };
  const lastHasPrivateSbtNameRef = { current: false };
  const privateSlugModeRef = { current: overrides.privateSlugModeCurrent ?? false };
  const togglePrivateSlugModeRef = { current: togglePrivateSlugMode };

  renderHook(() =>
    useSessionWizardIdentityEffects<DraftState>({
      initialRegistryChainId: overrides.initialRegistryChainId,
      setRegistryChainId,
      initialSessionId: overrides.initialSessionId,
      setSessionId,
      setDraft,
      privateSlugMode: overrides.privateSlugMode ?? false,
      sessionId: overrides.sessionId ?? '',
      slugPinnedByPendingSbtDrafts: overrides.slugPinnedByPendingSbtDrafts ?? false,
      draftSessionName: overrides.draftSessionName ?? '',
      draftSlug: overrides.draftSlug ?? '',
      lastManualSlugRef,
      hasPrivateSbtName: overrides.hasPrivateSbtName ?? false,
      lastHasPrivateSbtNameRef,
      privateSlugModeRef,
      togglePrivateSlugModeRef,
    }),
  );

  return {
    lastHasPrivateSbtNameRef,
    setDraft,
    setRegistryChainId,
    setSessionId,
    togglePrivateSlugMode,
  };
};

describe('useSessionWizardIdentityEffects', () => {
  it('hydrates the requested initial registry chain id', () => {
    const { setRegistryChainId } = renderIdentityEffects({
      initialRegistryChainId: 11155420,
    });

    expect(setRegistryChainId).toHaveBeenCalledTimes(1);
    const updater = setRegistryChainId.mock.calls[0][0];
    expect(updater(1)).toBe(11155420);
    expect(updater(11155420)).toBe(11155420);
  });

  it('parses an initial session id when it is already in session-id format', () => {
    const rawSessionId = `0x${'1'.padStart(32, '0')}`;
    const expectedSessionId = sessionRegistryUtils.formatSessionId(rawSessionId);
    const { setSessionId, setDraft } = renderIdentityEffects({
      initialSessionId: rawSessionId,
    });

    expect(setSessionId).toHaveBeenCalledWith(expectedSessionId);
    expect(setDraft).not.toHaveBeenCalled();
  });

  it('uses a non-session-id initial value as the draft slug when no slug exists', () => {
    const { setDraft } = renderIdentityEffects({
      initialSessionId: 'My Session Slug',
    });

    expect(setDraft).toHaveBeenCalledTimes(1);
    const updater = setDraft.mock.calls[0][0];
    expect(updater({})).toEqual({ slug: 'My Session Slug' });
    expect(updater({ slug: 'existing' })).toEqual({ slug: 'existing' });
  });

  it('mirrors session id into the slug while private slug mode is enabled', () => {
    const { setDraft } = renderIdentityEffects({
      privateSlugMode: true,
      sessionId: 'private-session-id',
      draftSlug: 'old-slug',
    });

    expect(setDraft).toHaveBeenCalledTimes(1);
    const updater = setDraft.mock.calls[0][0];
    expect(updater({ slug: 'old-slug' })).toEqual({ slug: 'private-session-id' });
  });

  it('auto-generates a slug from the session name unless a manual slug blocks it', () => {
    const { setDraft } = renderIdentityEffects({
      draftSessionName: 'A Session Name!',
      draftSlug: '',
    });

    expect(setDraft).toHaveBeenCalledTimes(1);
    const updater = setDraft.mock.calls[0][0];
    expect(updater({ slug: '' })).toEqual({ slug: 'a-session-name' });

    const blocked = renderIdentityEffects({
      draftSessionName: 'Different Name',
      draftSlug: 'manual-slug',
      lastManualSlug: 'manual-slug',
    });
    expect(blocked.setDraft).not.toHaveBeenCalled();
  });

  it('toggles private slug mode when a private SBT appears for the first time', () => {
    const { lastHasPrivateSbtNameRef, togglePrivateSlugMode } = renderIdentityEffects({
      hasPrivateSbtName: true,
      privateSlugModeCurrent: false,
    });

    expect(lastHasPrivateSbtNameRef.current).toBe(true);
    expect(togglePrivateSlugMode).toHaveBeenCalledTimes(1);
  });
});
