import { act, renderHook } from '@testing-library/react';
import {
  readSessionWizardNewSessionBannerDismissed,
  writeSessionWizardNewSessionBannerDismissed,
} from '../sessionWizardRouteState';
import useSessionWizardNewSessionBanner from './useSessionWizardNewSessionBanner.js';

const renderBanner = (overrides = {}) =>
  renderHook(() =>
    useSessionWizardNewSessionBanner({
      hasSponsoredBundleLink: false,
      newSessionBannerDismissalContextKey: '/new::plain',
      ...overrides,
    }),
  );

describe('useSessionWizardNewSessionBanner', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('initializes persisted dismissal state from route storage', () => {
    writeSessionWizardNewSessionBannerDismissed();

    const { result } = renderBanner();

    expect(result.current.persistedNewSessionBannerDismissed).toBe(true);
    expect(result.current.newSessionBannerDismissedContext).toBe('');
  });

  it('persists dismissal for a plain new-session route', () => {
    const { result } = renderBanner();

    act(() => {
      result.current.handleDismissNewSessionRequirementsBanner();
    });

    expect(result.current.newSessionBannerDismissedContext).toBe('/new::plain');
    expect(result.current.persistedNewSessionBannerDismissed).toBe(true);
    expect(readSessionWizardNewSessionBannerDismissed()).toBe(true);
  });

  it('dismisses sponsored contexts without writing the persisted plain flag', () => {
    const { result } = renderBanner({
      hasSponsoredBundleLink: true,
      newSessionBannerDismissalContextKey: '/new::sponsored::bundle-1::with-key',
    });

    act(() => {
      result.current.handleDismissNewSessionRequirementsBanner();
    });

    expect(result.current.newSessionBannerDismissedContext).toBe('/new::sponsored::bundle-1::with-key');
    expect(result.current.persistedNewSessionBannerDismissed).toBe(false);
    expect(readSessionWizardNewSessionBannerDismissed()).toBe(false);
  });
});
