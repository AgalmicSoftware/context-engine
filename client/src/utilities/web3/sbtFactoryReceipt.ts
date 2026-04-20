import { ethers } from 'ethers';
import SBT_FACTORY_ABI from '../../contractsABI/SBT_FACTORY_ABI.json';

type AnyRecord = Record<string, any>;

const SBT_FACTORY_INTERFACE = new ethers.utils.Interface(SBT_FACTORY_ABI);

const toText = (value: unknown): string => (value == null ? '' : String(value).trim());
const isSbtCreatedEventName = (value: unknown): boolean => toText(value).startsWith('SBTCreated');

const readSbtAddressFromArgs = (args: unknown): string => {
  const source = (args && typeof args === 'object') ? args as AnyRecord : {};
  const candidates = [
    source.sbtAddress,
    source.address,
    source[0],
    source['0'],
  ];

  for (const candidate of candidates) {
    const address = toText(candidate);
    if (address && ethers.utils.isAddress(address)) {
      return address;
    }
  }
  return '';
};

const getReceiptLogs = (receipt: unknown): AnyRecord[] => {
  const source = (receipt && typeof receipt === 'object') ? receipt as AnyRecord : {};
  if (Array.isArray(source.logs)) return source.logs;
  if (Array.isArray(source.receipt?.logs)) return source.receipt.logs;
  return [];
};

export const resolveSbtAddressFromFactoryReceipt = (receipt: unknown): string => {
  const source = (receipt && typeof receipt === 'object') ? receipt as AnyRecord : {};
  const decodedEvents = Array.isArray(source.events) ? source.events : [];
  for (const entry of decodedEvents) {
    if (!isSbtCreatedEventName(entry?.event || entry?.name)) continue;
    const address = readSbtAddressFromArgs(entry?.args);
    if (address) return address;
  }

  for (const log of getReceiptLogs(receipt)) {
    try {
      const parsed = SBT_FACTORY_INTERFACE.parseLog(log as { topics: string[]; data: string });
      if (!isSbtCreatedEventName(parsed?.name)) continue;
      const address = readSbtAddressFromArgs(parsed?.args);
      if (address) return address;
    } catch (_) {
      // Ignore non-factory logs in mixed receipts.
    }
  }

  return '';
};
