import { ethers } from 'ethers';
import { toStr } from '../../utilities/shared/primitives.js';

export type AdminSbtSelection = Record<string, unknown> & {
  address: string;
  name: unknown;
};

export type AdminDefaultGate = {
  gateId: string;
  sbtAddresses: string[];
  mode: 'any' | 'all';
  chainId: number | null;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

export const normalizeSbtSelection = (value: unknown): AdminSbtSelection[] => {
  if (Array.isArray(value)) {
    return value
      .map((entry): AdminSbtSelection | null => {
        if (!entry) return null;
        if (typeof entry === 'string') {
          const address = entry.trim();
          if (!address) return null;
          return { address, name: address };
        }
        if (typeof entry === 'object') {
          const record = entry as Record<string, unknown>;
          const address = toStr(record.address || record.sbtAddress || record.value).trim();
          if (!address) return null;
          return {
            ...record,
            address,
            name: record.name || record.label || address,
          };
        }
        return null;
      })
      .filter((entry): entry is AdminSbtSelection => Boolean(entry));
  }
  if (typeof value === 'string' && value.trim()) {
    return value
      .split(/[\n,]+/)
      .map((addr) => addr.trim())
      .filter(Boolean)
      .map((addr) => ({ address: addr, name: addr }));
  }
  return [];
};

export const dedupeSbtSelections = (value: unknown): AdminSbtSelection[] => {
  const out: AdminSbtSelection[] = [];
  const seen = new Set<string>();
  normalizeSbtSelection(value).forEach((entry) => {
    if (!ethers.utils.isAddress(entry.address)) return;
    const checksum = ethers.utils.getAddress(entry.address);
    const lower = checksum.toLowerCase();
    if (seen.has(lower)) return;
    seen.add(lower);
    out.push({ ...entry, address: checksum, name: entry.name || checksum });
  });
  return out;
};

export const normalizeGateMode = (raw: unknown): 'any' | 'all' => {
  const mode = toStr(raw).trim().toLowerCase();
  if (mode === 'all' || mode === 'and') return 'all';
  return 'any';
};

export const resolveDefaultGateFromConfig = (cfg: unknown = {}): AdminDefaultGate => {
  const config = asRecord(cfg);
  const sponsored = asRecord(config.sponsored);
  const gates = asRecord(sponsored.gates);
  const registry = asRecord(config.__registry);
  const defaultGateId = toStr(sponsored.defaultGateId || sponsored.defaultGate).trim();
  const gate = defaultGateId ? asRecord(gates[defaultGateId]) : {};
  const rawAddresses: unknown[] = [];
  if (Array.isArray(gate.sbtAddresses)) rawAddresses.push(...gate.sbtAddresses);
  if (gate.sbtAddress) rawAddresses.push(gate.sbtAddress);
  if (!rawAddresses.length && Array.isArray(sponsored.sbtAddresses)) rawAddresses.push(...sponsored.sbtAddresses);
  if (!rawAddresses.length && sponsored.sbtAddress) rawAddresses.push(sponsored.sbtAddress);
  const sbtAddresses = dedupeSbtSelections(rawAddresses).map((entry) => entry.address);
  const chainId = Number(gate.chainId || sponsored.chainId || config.networkChainId || registry.chainId || 0) || null;
  return {
    gateId: defaultGateId || '',
    sbtAddresses,
    mode: normalizeGateMode(gate.mode || sponsored.mode),
    chainId,
  };
};
