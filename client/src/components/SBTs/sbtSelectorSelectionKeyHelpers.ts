import { ethers } from 'ethers';

import { buildSbtLookupKey } from './sbtSelectorSessionRuntimeHelpers';

type SbtSelectorSelectableKeySource = Record<string, unknown> & {
  address?: unknown;
  chainId?: unknown;
  sbtAddress?: unknown;
  sbtInfo?:
    | (Record<string, unknown> & {
        chainID?: unknown;
        chainId?: unknown;
      })
    | null;
  selectionKey?: unknown;
  value?: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object';

export const normalizeSelectableSbtAddress = (value: unknown): string => {
  const rawAddress = String(value || '').trim();
  if (!rawAddress || !ethers.utils.isAddress(rawAddress)) return '';
  return ethers.utils.getAddress(rawAddress).toLowerCase();
};

export const getSelectableSbtKey = (value: unknown): string => {
  if (isRecord(value)) {
    const record = value as SbtSelectorSelectableKeySource;
    const explicit = String(record.selectionKey || '').trim();
    if (explicit) return explicit;
    const rawAddress = record.address || record.sbtAddress || record.value;
    const sbtInfo = isRecord(record.sbtInfo) ? record.sbtInfo : {};
    const chainId = record.chainId || sbtInfo.chainId || sbtInfo.chainID || null;
    return buildSbtLookupKey({ address: rawAddress, chainId }) || normalizeSelectableSbtAddress(rawAddress);
  }
  const raw = String(value || '').trim();
  if (!raw) return '';
  const chainScopedMatch = raw.match(/^(\d+):(0x[a-fA-F0-9]{40})$/);
  if (chainScopedMatch && ethers.utils.isAddress(chainScopedMatch[2])) {
    return `${Number(chainScopedMatch[1])}:${ethers.utils.getAddress(chainScopedMatch[2]).toLowerCase()}`;
  }
  return normalizeSelectableSbtAddress(raw);
};

export const getSelectOptionValue = (option: unknown): string =>
  getSelectableSbtKey(option) || String(isRecord(option) ? option.value || '' : '');
