import { resolveEncryptedFieldValue, resolveEncryptedValue } from './encryptedFields.js';

var mockDecryptEnvelopeValue = jest.fn();

jest.mock('../../store.js', () => ({
  __esModule: true,
  default: {
    getState: jest.fn(() => ({ profile: {} })),
  },
}));

jest.mock('./cryptography.js', () => ({
  cryptoUtils: {
    decryptEnvelopeValue: (...args) => mockDecryptEnvelopeValue(...args),
  },
}));

const encryptedEnvelope = {
  type: 'ce-envelope-v1',
  ciphertext: 'ciphertext',
};
const fieldPath = ['profile', 'displayName'];
const fieldKey = fieldPath.join('.');
const providerLike = { request: jest.fn() };
const lit = { getKey: jest.fn() };
const walletContext = {
  account: '0x1111111111111111111111111111111111111111',
  chainId: 84532,
  providerLike,
  lit,
};

const cases = [
  {
    name: 'missing value',
    envelope: null,
    context: walletContext,
    decrypt: 'unused',
    expected: { value: '', status: 'missing', encryptedAvailable: false },
  },
  {
    name: 'wallet required',
    envelope: encryptedEnvelope,
    context: { ...walletContext, account: '' },
    decrypt: 'unused',
    expected: { value: '', status: 'wallet-required', encryptedAvailable: true },
  },
  {
    name: 'Lit unavailable',
    envelope: encryptedEnvelope,
    context: { ...walletContext, lit: {} },
    decrypt: 'unused',
    expected: { value: '', status: 'lit-unavailable', encryptedAvailable: true },
  },
  {
    name: 'successful decrypt',
    envelope: encryptedEnvelope,
    context: walletContext,
    decrypt: 'resolved',
    decryptValue: 'visible value',
    expected: { value: 'visible value', status: 'encrypted', encryptedAvailable: true },
  },
  {
    name: 'empty decrypt result',
    envelope: encryptedEnvelope,
    context: walletContext,
    decrypt: 'resolved',
    decryptValue: null,
    expected: { value: '', status: 'locked', encryptedAvailable: true },
  },
  {
    name: 'thrown decrypt',
    envelope: encryptedEnvelope,
    context: walletContext,
    decrypt: 'rejected',
    expected: { value: '', status: 'locked', encryptedAvailable: true },
  },
];

describe('encrypted field resolver parity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each(cases)('preserves the $name status and argument contract', async (testCase) => {
    if (testCase.decrypt === 'resolved') {
      mockDecryptEnvelopeValue.mockResolvedValue(testCase.decryptValue);
    } else if (testCase.decrypt === 'rejected') {
      mockDecryptEnvelopeValue.mockRejectedValue(new Error('decrypt failed'));
    }

    const directResult = await resolveEncryptedValue(testCase.envelope, testCase.context);
    const fieldResult = await resolveEncryptedFieldValue(
      { encryptedFields: { [fieldKey]: testCase.envelope } },
      fieldPath,
      testCase.context,
    );

    expect(directResult).toEqual(testCase.expected);
    expect(fieldResult).toEqual(testCase.expected);

    if (testCase.decrypt === 'unused') {
      expect(mockDecryptEnvelopeValue).not.toHaveBeenCalled();
      return;
    }

    expect(mockDecryptEnvelopeValue).toHaveBeenCalledTimes(2);
    mockDecryptEnvelopeValue.mock.calls.forEach(([envelopeJson, options]) => {
      expect(envelopeJson).toBe(JSON.stringify(encryptedEnvelope));
      expect(options).toEqual({
        account: walletContext.account,
        chainId: walletContext.chainId,
        providerLike,
        litOpts: lit,
      });
    });
  });
});
