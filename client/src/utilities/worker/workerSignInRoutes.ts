// Routes of a session that this tab saw refuse a signed-out request and serve a
// signed-in one, such as a members-only session's answer listings. While someone
// is signed in they are sent signed in from the start, not refused first each time.
// A storage route counts per resource: a session's answers may need a sign-in
// while its questions don't.
const signInNeededRoutes = new Set<string>();

export const signInRouteKey = (url: RequestInfo | URL, slug: string): string => {
  try {
    const parsed = new URL(typeof url === 'object' && 'url' in url ? url.url : String(url));
    return `${slug}|${parsed.origin}${parsed.pathname}|${parsed.searchParams.get('resource') || ''}`;
  } catch {
    return '';
  }
};

export const rememberSignInRoute = (key: string) => key && signInNeededRoutes.add(key);
export const signInRouteRemembered = (key: string) => signInNeededRoutes.has(key);
export const forgetSignInRoutes = () => signInNeededRoutes.clear();
