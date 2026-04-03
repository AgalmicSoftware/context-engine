import { resolveEncryptionGate } from './encryptionGates';

describe('resolveEncryptionGate', () => {
  it('prefers encryption.gates when present', () => {
    const gateOne = { sbtAddresses: ['0x1'], mode: 'any' };
    const gateTwo = { sbtAddresses: ['0x2'], mode: 'all' };
    const cfg = {
      encryptedFieldGates: {
        'ai.providers.anthropic.apiKey': 'gate-2',
        sessionInfo: 'gate-2',
      },
      encryption: {
        gate: { sbtAddresses: ['0xlegacy'], mode: 'any' },
        gates: {
          'gate-1': gateOne,
          'gate-2': gateTwo,
        },
      },
    };

    expect(resolveEncryptionGate(cfg)).toBe(gateTwo);
  });

  it('counts array-valued encryptedFieldGates entries when choosing by usage', () => {
    const gateOne = { sbtAddresses: ['0x1'], mode: 'any' };
    const gateTwo = { sbtAddresses: ['0x2'], mode: 'all' };
    const cfg = {
      encryptedFieldGates: {
        sessionInfo: ['gate-1', 'gate-2'],
        'ai.providers.anthropic.apiKey': 'gate-2',
      },
      encryption: {
        gates: {
          'gate-1': gateOne,
          'gate-2': gateTwo,
        },
      },
    };

    expect(resolveEncryptionGate(cfg)).toBe(gateTwo);
  });

  it('falls back to legacy gate when usage data is missing', () => {
    const legacyGate = { sbtAddresses: ['0xlegacy'], mode: 'any' };
    const gateOne = { sbtAddresses: ['0x1'], mode: 'any' };
    const gateTwo = { sbtAddresses: ['0x2'], mode: 'all' };
    const cfg = {
      encryption: {
        gate: legacyGate,
        gates: {
          'gate-1': gateOne,
          'gate-2': gateTwo,
        },
      },
    };

    expect(resolveEncryptionGate(cfg)).toBe(legacyGate);
  });

  it('falls back to legacy gate when gates are missing', () => {
    const legacyGate = { sbtAddresses: ['0xlegacy'], mode: 'any' };
    const cfg = { encryption: { gate: legacyGate } };

    expect(resolveEncryptionGate(cfg)).toBe(legacyGate);
  });

  it('returns null when no gate exists', () => {
    expect(resolveEncryptionGate({})).toBeNull();
  });
});
