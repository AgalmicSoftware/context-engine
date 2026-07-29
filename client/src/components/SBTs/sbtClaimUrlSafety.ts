const isCredentialQueryKey = (key: string): boolean => /^(gp|inv|password)\d*$/.test(key.toLowerCase());

export const SBT_CLAIM_FAILURE_MESSAGE = 'Claim failed. Verify the credential and network, then retry.';
export const SBT_ADMIN_INVITE_FAILURE_MESSAGE =
  'Adding invite credentials failed. Verify the network and admin account, then retry.';

export const resolveSbtPageMintFailure = ({
  error,
  fallbackMessage,
  hasPasswordMint,
}: {
  error: unknown;
  fallbackMessage: string;
  hasPasswordMint: boolean;
}): { logArgs: [string] | [string, unknown]; message: string } =>
  hasPasswordMint
    ? { logArgs: ['Credential mint failed.'], message: SBT_CLAIM_FAILURE_MESSAGE }
    : { logArgs: ['Minting failed in handleMint:', error], message: fallbackMessage };

export const sanitizeSbtClaimIdentityUrl = (value: unknown): string => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const isAbsolute = /^[a-z][a-z\d+.-]*:\/\//i.test(raw);
  const isRootRelative = raw.startsWith('/');
  if (!isAbsolute && !isRootRelative) {
    return /(?:^|[?&])(gp|inv|password)\d*=/i.test(raw) ? '' : raw;
  }

  try {
    const url = new URL(raw, 'https://identity.invalid');
    Array.from(url.searchParams.keys()).forEach((key) => {
      if (isCredentialQueryKey(key)) url.searchParams.delete(key);
    });
    const pathSegments = url.pathname.split('/').filter(Boolean);
    const routeIndex = pathSegments.findIndex((segment) => segment === 'sbt' || segment === 'group');
    if (routeIndex >= 0 && pathSegments.length > routeIndex + 2) {
      url.pathname = `/${pathSegments.slice(0, routeIndex + 2).join('/')}`;
    }
    const query = url.searchParams.toString();
    const relative = `${url.pathname}${query ? `?${query}` : ''}${url.hash || ''}`;
    return isAbsolute ? `${url.origin}${relative}` : relative;
  } catch (_) {
    return '';
  }
};
