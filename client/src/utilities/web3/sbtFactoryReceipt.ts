import { ethers } from 'ethers';
import SBT_FACTORY_ABI from '../../contractsABI/SBT_FACTORY_ABI.json';

type ReceiptRecord = Record<string, unknown>;

const SBT_FACTORY_INTERFACE = new ethers.utils.Interface(SBT_FACTORY_ABI);

const toText = (value: unknown): string => (value == null ? '' : String(value).trim());
const isSbtCreatedEventName = (value: unknown): boolean => toText(value).startsWith('SBTCreated');
const isReceiptRecord = (value: unknown): value is ReceiptRecord => (
  !!value && typeof value === 'object'
);

const readSbtAddressFromArgs = (args: unknown): string => {
  const source = isReceiptRecord(args) ? args : {};
  const candidates = [
    source.sbtAddress,
    source.address,
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

const getReceiptLogs = (receipt: unknown): unknown[] => {
  const source = isReceiptRecord(receipt) ? receipt : {};
  if (Array.isArray(source.logs)) return source.logs;
  const nestedReceipt = source.receipt;
  if (isReceiptRecord(nestedReceipt) && Array.isArray(nestedReceipt.logs)) {
    return nestedReceipt.logs;
  }
  return [];
};

export const resolveSbtAddressFromFactoryReceipt = (receipt: unknown): string => {
  const source = isReceiptRecord(receipt) ? receipt : {};
  const decodedEvents = Array.isArray(source.events) ? source.events : [];
  for (const entry of decodedEvents) {
    const eventEntry = isReceiptRecord(entry) ? entry : {};
    if (!isSbtCreatedEventName(eventEntry.event || eventEntry.name)) continue;
    const address = readSbtAddressFromArgs(eventEntry.args);
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
