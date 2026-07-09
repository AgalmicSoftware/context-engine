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

export const removeHashQueryParam = (hashValue = '', key = ''): string => {
  const normalizedKey = toStr(key).trim();
  const rawHash = toStr(hashValue).replace(/^#/, '').trim();
  if (!normalizedKey || !rawHash) return toStr(hashValue).trim();
  if (!/[=&]/.test(rawHash)) return toStr(hashValue).trim();
  const params = new URLSearchParams(rawHash);
  params.delete(normalizedKey);
  const nextHash = params.toString();
  return nextHash ? `#${nextHash}` : '';
};

export const scrubSponsoredBundleHashSecret = (): void => {
  if (typeof window === 'undefined' || !window.location || !window.history?.replaceState) return;
  const nextHash = removeHashQueryParam(window.location.hash || '', 'k');
  const nextUrl = `${window.location.pathname || ''}${window.location.search || ''}${nextHash}`;
  const currentUrl = `${window.location.pathname || ''}${window.location.search || ''}${window.location.hash || ''}`;
  if (nextUrl === currentUrl) return;
  window.history.replaceState({}, '', nextUrl);
};
