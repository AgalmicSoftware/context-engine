import { ethers } from 'ethers';
import SBT_FACTORY_ABI from '../../contractsABI/SBT_FACTORY_ABI.json';

const SBT_FACTORY_INTERFACE = new ethers.utils.Interface(SBT_FACTORY_ABI);

const toText = (value) => (value == null ? '' : String(value).trim());
const isSbtCreatedEventName = (value) => toText(value).startsWith('SBTCreated');

const readSbtAddressFromArgs = (args) => {
  const candidates = [
    args?.sbtAddress,
    args?.address,
    args?.[0],
    args?.['0'],
  ];

  for (const candidate of candidates) {
    const address = toText(candidate);
    if (address && ethers.utils.isAddress(address)) {
      return address;
    }
  }
  return '';
};

const getReceiptLogs = (receipt) => {
  if (Array.isArray(receipt?.logs)) return receipt.logs;
  if (Array.isArray(receipt?.receipt?.logs)) return receipt.receipt.logs;
  return [];
};

export const resolveSbtAddressFromFactoryReceipt = (receipt) => {
  const decodedEvents = Array.isArray(receipt?.events) ? receipt.events : [];
  for (const entry of decodedEvents) {
    if (!isSbtCreatedEventName(entry?.event || entry?.name)) continue;
    const address = readSbtAddressFromArgs(entry?.args);
    if (address) return address;
  }

  for (const log of getReceiptLogs(receipt)) {
    try {
      const parsed = SBT_FACTORY_INTERFACE.parseLog(log);
      if (!isSbtCreatedEventName(parsed?.name)) continue;
      const address = readSbtAddressFromArgs(parsed?.args);
      if (address) return address;
    } catch (_) {
      // Ignore non-factory logs in mixed receipts.
    }
  }

  return '';
};

