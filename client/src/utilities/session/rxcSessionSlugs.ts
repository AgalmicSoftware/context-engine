export const RXC_SESSION_SLUGS = ['rxc-test', 'rxc-ra-test', 'rxc-ra-test-2'];

export const isRxcSessionEntryPath = (pathname: string): boolean =>
  RXC_SESSION_SLUGS.some((slug) => pathname === `/${slug}` || pathname === `/${slug}/`);
