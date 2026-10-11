import {
  isGroupPasswordMismatchError,
  isGroupPasswordUnverifiableError,
} from '../../utilities/crypto/sbtAuthorization';

const isCredentialQueryKey = (key: string): boolean => /^(gp|inv|password)\d*$/.test(key.toLowerCase());

export const SBT_CLAIM_FAILURE_MESSAGE = 'Claim failed. Verify the credential and network, then retry.';
export const SBT_ADMIN_INVITE_FAILURE_MESSAGE =
  'Adding invite credentials failed. Verify the network and admin account, then retry.';
// Pre-0.6.8 groups keep an older on-chain password check that this version cannot derive or replace.
export const SBT_GROUP_PASSWORD_MISMATCH_MESSAGE =
  "Incorrect group password. If this group was created before Context Engine 0.6.8, its password uses an older format this version can't check; the group admin needs to create a new group.";

// Group-password failures people can act on: a wrong (or pre-0.6.8) password, or a check that cannot run
// here, such as an http:// origin without WebCrypto. Other failures return '' and keep their generic copy.
export const resolveSbtGroupPasswordFailureMessage = (error: unknown): string => {
  if (isGroupPasswordMismatchError(error)) return SBT_GROUP_PASSWORD_MISMATCH_MESSAGE;
  if (isGroupPasswordUnverifiableError(error)) return error instanceof Error ? error.message : String(error);
  return '';
};

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
