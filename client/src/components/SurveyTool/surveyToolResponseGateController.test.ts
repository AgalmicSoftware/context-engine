const mockBuildSbtAccessControlConditions = jest.fn();
const mockResolveLitChain = jest.fn();

jest.mock('../../utilities/crypto/litProtocol.js', () => ({
  buildSbtAccessControlConditions: (...args: any[]) => mockBuildSbtAccessControlConditions(...args),
  resolveLitChain: (...args: any[]) => mockResolveLitChain(...args),
}));

import {
  buildRecipientsFromGates,
  getEffectiveRecipientsForField,
  resolveFieldEncryptionGateId,
  resolveGateDisplayLabel,
  resolveGatedPromptGateNames,
} from './surveyToolResponseGateController';

const normalizeText = (value: any): string => {
  const raw = (typeof value === 'string' ? value : value == null ? '' : String(value)).trim();
  if (!raw || /^\[object\s+object\]$/i.test(raw)) return '';
  return raw;
};

describe('surveyToolResponseGateController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveLitChain.mockImplementation(({ chainId }: any = {}) => `chain-${String(chainId || 'default')}`);
    mockBuildSbtAccessControlConditions.mockImplementation(
      ({ sbtAddresses = [], chainId = null, mode = 'any' }: any = {}) =>
        Array.isArray(sbtAddresses) && sbtAddresses.length > 0
          ? [
              {
                contractAddress: String(sbtAddresses[0]),
                chainId,
                mode,
              },
            ]
          : null,
    );
  });

  describe('buildRecipientsFromGates', () => {
    it('returns empty array for empty gates', () => {
      expect(
        buildRecipientsFromGates([], {
          resolveSessionChainId: () => 84532,
        }),
      ).toEqual([]);
      expect(mockResolveLitChain).not.toHaveBeenCalled();
    });

    it('builds a recipient for a single gate', () => {
      const resolveSessionChainId = jest.fn(() => 84532);

      const result = buildRecipientsFromGates(
        [
          {
            sbtAddresses: ['0x00000000000000000000000000000000000000aa'],
            mode: 'all',
          },
        ],
        {
          resolveSessionChainId,
        },
      );

      expect(resolveSessionChainId).toHaveBeenCalledTimes(1);
      expect(mockResolveLitChain).toHaveBeenCalledWith({
        chainId: 84532,
        litChain: undefined,
        chain: undefined,
      });
      expect(mockBuildSbtAccessControlConditions).toHaveBeenCalledWith({
        sbtAddresses: ['0x00000000000000000000000000000000000000aa'],
        chainId: 84532,
        litChain: 'chain-84532',
        mode: 'all',
      });
      expect(result).toEqual([
        {
          accessControlConditions: [
            {
              contractAddress: '0x00000000000000000000000000000000000000aa',
              chainId: 84532,
              mode: 'all',
            },
          ],
          chain: 'chain-84532',
        },
      ]);
    });

    it('deduplicates equivalent recipients across multiple gates', () => {
      const result = buildRecipientsFromGates(
        [
          { sbtAddress: '0x00000000000000000000000000000000000000aa' },
          { sbtAddresses: ['0x00000000000000000000000000000000000000aa'] },
        ],
        {
          resolveSessionChainId: () => 84532,
        },
      );

      expect(result).toHaveLength(1);
    });

    it('skips gates with no SBT addresses', () => {
      const result = buildRecipientsFromGates(
        [
          {
            gateId: 'missing-sbt',
          },
        ],
        {
          resolveSessionChainId: () => 84532,
        },
      );

      expect(result).toEqual([]);
      expect(mockBuildSbtAccessControlConditions).not.toHaveBeenCalled();
    });
  });

  describe('resolveGateDisplayLabel', () => {
    let deps: {
      normalizeGateLabelText: (value: any) => string;
      resolveSbtGateLabel: jest.Mock;
      getShortenedAddress: jest.Mock;
      t: jest.Mock;
    };

    beforeEach(() => {
      deps = {
        normalizeGateLabelText: normalizeText,
        resolveSbtGateLabel: jest.fn((address: string) =>
          address.toLowerCase() === '0x00000000000000000000000000000000000000aa' ? 'VIP Pass' : '',
        ),
        getShortenedAddress: jest.fn((address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`),
        t: jest.fn((key: string) => (key === 'sbt' ? 'SBT' : 'gate')),
      };
    });

    it('reads labels from the supported gate fields', () => {
      expect(
        resolveGateDisplayLabel(
          {
            label: { title: 'Primary Gate' },
          },
          '',
          deps,
        ),
      ).toBe('Primary Gate');

      expect(
        resolveGateDisplayLabel(
          {
            id: 'legacy-gate',
          },
          '',
          deps,
        ),
      ).toBe('legacy-gate');
    });

    it('falls back to the SBT label when no gate label exists', () => {
      expect(resolveGateDisplayLabel({}, '0x00000000000000000000000000000000000000aa', deps)).toBe('SBT VIP Pass');
    });

    it('returns the default gate label when no label sources exist', () => {
      expect(resolveGateDisplayLabel({}, '', deps)).toBe('default gate');
    });
  });

  describe('resolveFieldEncryptionGateId', () => {
    it('returns the matching gate id when the field audience is gate', () => {
      const getResponseGateOptionById = jest.fn(() => ({ gateId: 'gate-1' }));

      const result = resolveFieldEncryptionGateId(
        {
          encryptionAudience: 'gate',
          encryptionGateId: ' gate-1 ',
        },
        'Q1',
        'answer',
        {
          resolveFieldEncryptionAudience: jest.fn(() => 'gate'),
          normalizeGateLabelText: normalizeText,
          getResponseGateOptionById,
        },
      );

      expect(result).toBe('gate-1');
      expect(getResponseGateOptionById).toHaveBeenCalledWith('q1', 'gate-1');
    });

    it('returns null when the field audience is not gate', () => {
      const getResponseGateOptionById = jest.fn();

      const result = resolveFieldEncryptionGateId({}, 'q1', 'answer', {
        resolveFieldEncryptionAudience: jest.fn(() => 'self'),
        normalizeGateLabelText: normalizeText,
        getResponseGateOptionById,
      });

      expect(result).toBeNull();
      expect(getResponseGateOptionById).not.toHaveBeenCalled();
    });
  });

  describe('getEffectiveRecipientsForField', () => {
    const normalizeQuestionIdKey = (value: unknown) =>
      String(value || '')
        .trim()
        .toLowerCase();

    it('returns the locked-question recipients immediately', () => {
      const getEffectiveRecipientsForQid = jest.fn(() => ['0xLocked']);

      const result = getEffectiveRecipientsForField(
        {
          questionId: 'Q1',
          fieldKey: 'answer',
          field: {},
        },
        {
          normalizeQuestionIdKey,
          isQuestionLockedForResponse: jest.fn(() => true),
          getEffectiveRecipientsForQid,
          resolveFieldEncryptionAudience: jest.fn(),
          resolveFieldEncryptionGateId: jest.fn(),
          getResponseGateOptionById: jest.fn(),
        },
      );

      expect(result).toEqual(['0xLocked']);
      expect(getEffectiveRecipientsForQid).toHaveBeenCalledWith('q1');
    });

    it('returns gate-specific recipients for gate audiences', () => {
      const getResponseGateOptionById = jest.fn(() => ({
        gateId: 'gate-2',
        recipients: ['0xA', '0xB'],
      }));

      const result = getEffectiveRecipientsForField(
        {
          questionId: 'q2',
          fieldKey: 'additional',
          field: { encryptionAudience: 'gate', encryptionGateId: 'gate-2' },
        },
        {
          normalizeQuestionIdKey,
          isQuestionLockedForResponse: jest.fn(() => false),
          getEffectiveRecipientsForQid: jest.fn(() => ['0xFallback']),
          resolveFieldEncryptionAudience: jest.fn(() => 'gate'),
          resolveFieldEncryptionGateId: jest.fn(() => 'gate-2'),
          getResponseGateOptionById,
        },
      );

      expect(result).toEqual(['0xA', '0xB']);
      expect(getResponseGateOptionById).toHaveBeenCalledWith('q2', 'gate-2');
    });

    it('returns an empty array for non-gate audiences', () => {
      const getResponseGateOptionById = jest.fn();

      const result = getEffectiveRecipientsForField(
        {
          questionId: 'q3',
          fieldKey: 'answer',
          field: { encryptionAudience: 'self' },
        },
        {
          normalizeQuestionIdKey,
          isQuestionLockedForResponse: jest.fn(() => false),
          getEffectiveRecipientsForQid: jest.fn(() => ['0xFallback']),
          resolveFieldEncryptionAudience: jest.fn(() => 'self'),
          resolveFieldEncryptionGateId: jest.fn(),
          getResponseGateOptionById,
        },
      );

      expect(result).toEqual([]);
      expect(getResponseGateOptionById).not.toHaveBeenCalled();
    });
  });

  describe('resolveGatedPromptGateNames', () => {
    const createDeps = (overrides: Partial<any> = {}) => ({
      normalizeGateLabelText: normalizeText,
      resolveGateDisplayLabel: jest.fn(
        (gate: any = {}, fallbackSbt = '') =>
          normalizeText(gate?.label || gate?.name || gate?.title || gate?.gateId) ||
          (fallbackSbt ? `Gate ${fallbackSbt}` : 'default gate'),
      ),
      getQuestionEncryptionGates: jest.fn(() => []),
      getEffectiveDraftSlug: null,
      resolveEffectiveSlug: jest.fn(() => 'edge'),
      resolveEffectiveResponseGateConfig: jest.fn(() => ({})),
      ...overrides,
    });

    it('returns names from question-specific gates first', () => {
      const deps = createDeps({
        getQuestionEncryptionGates: jest.fn(() => [
          { label: 'Gate Alpha' },
          { label: 'Gate Beta' },
          { label: 'Gate Alpha' },
        ]),
      });

      expect(resolveGatedPromptGateNames({ id: 'q1' }, deps)).toEqual(['Gate Alpha', 'Gate Beta']);
    });

    it('falls back to configured default gate SBT labels', () => {
      const deps = createDeps({
        resolveEffectiveResponseGateConfig: jest.fn(() => ({
          defaultGateSBTs: [{ name: 'VIP' }, { label: 'VIP' }, 'Members'],
        })),
      });

      expect(resolveGatedPromptGateNames({ id: 'q2' }, deps)).toEqual(['VIP', 'Members']);
    });

    it('falls back to the legacy encryption gate when present', () => {
      const deps = createDeps({
        resolveEffectiveResponseGateConfig: jest.fn(() => ({
          encryption: {
            gate: { label: 'Legacy Gate' },
          },
        })),
      });

      expect(resolveGatedPromptGateNames({ id: 'q3' }, deps)).toEqual(['Legacy Gate']);
    });

    it('returns an empty array when no gate names can be resolved', () => {
      expect(resolveGatedPromptGateNames({ id: 'q4' }, createDeps())).toEqual([]);
    });
  });
});
