import { normalizeSbtAddress, normalizeSessionIdHex } from '../../utilities/docLibrary/tags.js';

type ListFilter = {
  name: string;
  values: string[];
};

export const buildSessionListFilters = (sessionIdHex: string): ListFilter[] =>
  [
    { name: 'CE-DocLibrary', values: ['1'] },
    { name: 'CE-SessionId', values: [normalizeSessionIdHex(sessionIdHex)] },
  ].filter((filter) => filter.values && filter.values[0]);

export const buildSbtListFilters = ({
  chainId,
  sbtAddress,
}: {
  chainId?: number | string | null;
  sbtAddress?: string;
}): ListFilter[] =>
  [
    { name: 'CE-DocLibrary', values: ['1'] },
    { name: 'CE-SbtChainId', values: [String(Number(chainId || 0) || '')] },
    { name: 'CE-SbtAddress', values: [normalizeSbtAddress(sbtAddress)] },
  ].filter((filter) => filter.values && filter.values[0]);
