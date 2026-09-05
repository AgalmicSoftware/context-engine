import { cryptoUtils } from '../../utilities/crypto/cryptography.js';
import { cryptoGatePort } from './cryptoGatePort';

describe('cryptoGatePort', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('routes decrypt requests with unchanged envelope and Lit options', async () => {
    const decryptEnvelopeValue = jest.spyOn(cryptoUtils, 'decryptEnvelopeValue').mockResolvedValue('decrypted value');
    const getKey = jest.fn(async () => 'lit-key');

    await expect(
      cryptoGatePort.decryptEnvelopeValue('{"ciphertext":"abc"}', {
        account: '0xabc',
        chainId: 11155420,
        litOpts: { getKey },
        providerLike: { provider: true },
      }),
    ).resolves.toBe('decrypted value');

    expect(decryptEnvelopeValue).toHaveBeenCalledWith('{"ciphertext":"abc"}', {
      account: '0xabc',
      chainId: 11155420,
      litOpts: { getKey },
      providerLike: { provider: true },
    });
  });

  it('performs call-time crypto lookup so spies keep intercepting', async () => {
    const decryptEnvelopeValue = jest
      .spyOn(cryptoUtils, 'decryptEnvelopeValue')
      .mockResolvedValueOnce('first')
      .mockResolvedValueOnce('second');

    await expect(cryptoGatePort.decryptEnvelopeValue('first-envelope')).resolves.toBe('first');
    await expect(cryptoGatePort.decryptEnvelopeValue('second-envelope')).resolves.toBe('second');

    expect(decryptEnvelopeValue).toHaveBeenNthCalledWith(1, 'first-envelope', undefined);
    expect(decryptEnvelopeValue).toHaveBeenNthCalledWith(2, 'second-envelope', undefined);
  });
});
