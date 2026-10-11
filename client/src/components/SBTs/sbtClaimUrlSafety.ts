import {
  isGroupPasswordMismatchError,
  isGroupPasswordUnverifiableError,
} from '../../utilities/crypto/sbtAuthorization';
import { normalizeSbtMintMode, SBT_MINT_MODE } from '../../utilities/sbt/sbtMintMode.js';

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

// The on-chain mint mode carried by SBT metadata, or null when it is missing or invalid. Only an integer or a plain
// digit string counts: Number() turns values such as ' ', false, [] or '0x0' into 0, which would read as "open".
export const readKnownSbtMintMode = (sbtInfo: unknown): number | null => {
  const mintMode = sbtInfo && typeof sbtInfo === 'object' ? (sbtInfo as { mintMode?: unknown }).mintMode : null;
  const candidate =
    (typeof mintMode === 'number' && Number.isInteger(mintMode)) ||
    (typeof mintMode === 'string' && /^(?:0|[1-9]\d*)$/.test(mintMode))
      ? Number(mintMode)
      : -1;
  const mode = normalizeSbtMintMode(candidate, -1);
  return mode < 0 ? null : mode;
};

// A failed group-password hash read (null) is not "no password", so it only allows an open claim when the
// metadata says the group is open.
export const isKnownOpenSbt = (sbtInfo: unknown): boolean =>
  readKnownSbtMintMode(sbtInfo) === SBT_MINT_MODE.PUBLIC_CLAIM;

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
