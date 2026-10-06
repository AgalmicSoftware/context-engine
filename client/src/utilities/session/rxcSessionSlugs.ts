export const RXC_SESSION_SLUGS = ['rxc-test', 'rxc-ra-test'];

export const isRxcSessionEntryPath = (pathname: string): boolean =>
  RXC_SESSION_SLUGS.some((slug) => pathname === `/${slug}` || pathname === `/${slug}/`);
