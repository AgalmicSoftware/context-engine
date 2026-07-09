import { ethers } from 'ethers';
import { normalizeSessionSlug } from '../../utilities/web3/chainGateway.js';

type SbtAddressPropsLike = {
  SBTAddress?: unknown;
};

type ResolveSbtPageAddressLinkStateArgs = {
  address?: unknown;
  isAddress?: ((value: string) => boolean) | null;
  zeroAddress?: unknown;
};

type SbtPageAddressLinkState = {
  isRenderable: boolean;
  isZeroAddress: boolean;
  normalized: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object';

export const buildSessionRoutePath = (slugRaw: unknown = '', basePath: unknown = ''): string => {
  const slug = normalizeSessionSlug(slugRaw || '');
  const normalizedBasePath = String(basePath || '').replace(/\/+$/, '');
  return normalizedBasePath + (slug ? `/session/${encodeURIComponent(slug)}` : '/session');
};

export const resolveSbtAddress = (input: unknown): unknown | null => {
  if (Array.isArray(input)) {
    const found = input.find((entry) => isRecord(entry) && entry.sbtAddress !== undefined);
    return found ? found.sbtAddress : null;
  }
  if (isRecord(input) && input.sbtAddress !== undefined) return input.sbtAddress;
  return input || null;
};

export const resolveSbtAddressString = (input: unknown): string => {
  const resolved = resolveSbtAddress(input);
  return resolved ? String(resolved) : '';
};

export const resolveSbtPageAddressLinkState = ({
  address = '',
  isAddress = ethers.utils.isAddress,
  zeroAddress = ethers.constants.AddressZero,
}: ResolveSbtPageAddressLinkStateArgs = {}): SbtPageAddressLinkState => {
  const normalized = String(address || '').trim();
  const isZeroAddress = normalized.toLowerCase() === String(zeroAddress || '').toLowerCase();
  return {
    isRenderable: !!normalized && !isZeroAddress && typeof isAddress === 'function' && isAddress(normalized),
    isZeroAddress,
    normalized,
  };
};

export const getCurrentSbtAddressInfo = (
  propsIn: SbtAddressPropsLike = {},
): {
  lower: string;
  original: unknown;
} => {
  const original = resolveSbtAddress(propsIn.SBTAddress) || '';
  return {
    original,
    lower: String(original || '').toLowerCase(),
  };
};
