import { ethers } from 'ethers';
import { resolveSbtAddressFromFactoryReceipt } from './sbtFactoryReceipt.js';

const FACTORY_IFACE = new ethers.utils.Interface([
  'event SBTCreated(address indexed sbtAddress)',
  'event SBTCreatedDeterministic(address indexed sbtAddress, bytes32 indexed salt)',
]);

const makeReceiptLog = (eventName, args) => {
  const encoded = FACTORY_IFACE.encodeEventLog(
    FACTORY_IFACE.getEvent(eventName),
    args
  );
  return {
    address: '0x00000000000000000000000000000000000000fa',
    topics: encoded.topics,
    data: encoded.data,
  };
};

describe('resolveSbtAddressFromFactoryReceipt', () => {
  it('returns the address from decoded SBTCreated events', () => {
    expect(resolveSbtAddressFromFactoryReceipt({
      events: [
        {
          event: 'SBTCreated',
          args: { sbtAddress: '0x00000000000000000000000000000000000000a1' },
        },
      ],
    })).toBe('0x00000000000000000000000000000000000000a1');
  });

  it('parses factory logs when waitForTransaction receipts do not include decoded events', () => {
    const sbtAddress = '0x00000000000000000000000000000000000000b2';

    expect(resolveSbtAddressFromFactoryReceipt({
      logs: [
        { topics: ['0xdeadbeef'], data: '0x' },
        makeReceiptLog('SBTCreatedDeterministic', [sbtAddress, ethers.utils.id('salt')]),
      ],
    })).toBe(sbtAddress);
  });

  it('returns an empty string when no SBTCreated-style factory event is present', () => {
    expect(resolveSbtAddressFromFactoryReceipt({
      logs: [{ topics: ['0xdeadbeef'], data: '0x' }],
    })).toBe('');
  });

  it('returns an empty string for nullish receipts', () => {
    expect(resolveSbtAddressFromFactoryReceipt(null)).toBe('');
    expect(resolveSbtAddressFromFactoryReceipt(undefined)).toBe('');
  });

  it('ignores malformed factory logs and keeps scanning later logs', () => {
    const sbtAddress = '0x00000000000000000000000000000000000000c3';

    expect(resolveSbtAddressFromFactoryReceipt({
      logs: [
        { topics: [FACTORY_IFACE.getEventTopic('SBTCreated')], data: '0x1234' },
        makeReceiptLog('SBTCreated', [sbtAddress]),
      ],
    })).toBe(ethers.utils.getAddress(sbtAddress));
  });
});
