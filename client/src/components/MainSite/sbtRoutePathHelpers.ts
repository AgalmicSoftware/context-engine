type AddressValidator = (value: string) => boolean;
type SessionSlugNormalizer = (value: unknown) => string;
export type SbtDetailRouteStatePatch = {
  sbtDetailGroupSlug: string | null;
  sbtDetailAddress: string | null;
};

const splitCleanPath = (path: string): string[] =>
  String(path || '')
    .split('?')[0]
    .split('#')[0]
    .split('/')
    .filter(Boolean);

export const getSbtAddressFromPath = (path: string, opts: { isAddress: AddressValidator }): string | null => {
  const parts = splitCleanPath(path);
  if (!['sbt', 'group'].includes(parts[0]) || !parts[1]) return null;
  const address = parts[1];
  return opts.isAddress(address) ? address : null;
};

export const isSbtListRoutePath = (effectivePath: string): boolean => {
  const parts = splitCleanPath(effectivePath);
  const root = String(parts[0] || '')
    .trim()
    .toLowerCase();
  if (root !== 'sbts' && root !== 'groups') return false;
  const slugOrMode = String(parts[1] || '')
    .trim()
    .toLowerCase();
  if (!slugOrMode) return true;
  return slugOrMode !== 'new';
};

export const getSbtListRouteSessionSlug = (
  effectivePath: string,
  opts: { normalizeSessionSlug: SessionSlugNormalizer },
): string => {
  const parts = splitCleanPath(effectivePath);
  const root = String(parts[0] || '')
    .trim()
    .toLowerCase();
  if (root !== 'sbts' && root !== 'groups') return '';
  const slugOrMode = String(parts[1] || '').trim();
  if (!slugOrMode || slugOrMode.toLowerCase() === 'new') return '';
  return opts.normalizeSessionSlug(slugOrMode);
};

export const getUserAddressFromPath = (path: string, opts: { isAddress: AddressValidator }): string | null => {
  const parts = splitCleanPath(path);
  if (!parts.length) return null;
  if (parts[0] === 'u' && parts[1]) {
    const address = parts[1];
    return opts.isAddress(address) ? address : null;
  }
  const address = parts[0];
  return opts.isAddress(address) ? address : null;
};

export const buildSbtDetailRouteStatePatch = ({
  detailSlug = null,
  address = null,
}: {
  detailSlug?: string | null;
  address?: string | null;
} = {}): SbtDetailRouteStatePatch => ({
  sbtDetailGroupSlug: detailSlug,
  sbtDetailAddress: address,
});
