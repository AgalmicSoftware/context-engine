import { toStr } from '../../utilities/shared/primitives.js';
import { normalizeRoutePath as normalizeMainSiteRoutePath } from '../MainSite/routePathHelpers.js';

const SESSION_WIZARD_NEW_SESSION_BANNER_DISMISSED_KEY = 'ce_new_session_banner_dismissed';
const SESSION_WIZARD_NEW_SESSION_PATHNAMES = new Set(['/new', '/session/new']);

export const normalizeSessionWizardPathname = (pathname = ''): string => {
  const normalized = normalizeMainSiteRoutePath(toStr(pathname).trim());
  return normalized || '/';
};

export const isNewSessionWizardPathname = (pathname = ''): boolean =>
  SESSION_WIZARD_NEW_SESSION_PATHNAMES.has(normalizeSessionWizardPathname(pathname));

export const readSessionWizardNewSessionBannerDismissed = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return toStr(localStorage.getItem(SESSION_WIZARD_NEW_SESSION_BANNER_DISMISSED_KEY)).trim().toLowerCase() === 'true';
  } catch (_) {
    return false;
  }
};

export const writeSessionWizardNewSessionBannerDismissed = (): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SESSION_WIZARD_NEW_SESSION_BANNER_DISMISSED_KEY, 'true');
  } catch (_) {}
};

export const buildSessionWizardNewSessionBannerDismissalContextKey = ({
  pathname = '',
  sponsoredBundleId = '',
  sponsoredBundleKey = '',
}: {
  pathname?: string;
  sponsoredBundleId?: unknown;
  sponsoredBundleKey?: unknown;
} = {}): string => {
  const normalizedPathname = normalizeSessionWizardPathname(pathname);
  if (!isNewSessionWizardPathname(normalizedPathname)) return '';
  const bundleId = toStr(sponsoredBundleId).trim();
  const bundleKey = toStr(sponsoredBundleKey).trim();
  if (bundleId || bundleKey) {
    return `${normalizedPathname}::sponsored::${bundleId || '__missing_bundle__'}::${bundleKey ? 'with-key' : 'without-key'}`;
  }
  return `${normalizedPathname}::plain`;
};
