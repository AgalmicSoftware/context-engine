import { bindCryptoGatePort } from './cryptoGatePort';

describe('cryptoGatePort', () => {
  it('routes decrypt requests with unchanged envelope and Lit options', async () => {
    const decryptEnvelopeValue = jest.fn(async () => 'decrypted value');
    const getKey = jest.fn(async () => 'lit-key');
    const port = bindCryptoGatePort({
      crypto: () => ({ decryptEnvelopeValue }),
    });

    await expect(
      port.decryptEnvelopeValue('{"ciphertext":"abc"}', {
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
    const firstDecrypt = jest.fn(async () => 'first');
    const secondDecrypt = jest.fn(async () => 'second');
    const crypto = {
      decryptEnvelopeValue: firstDecrypt,
    };
    const port = bindCryptoGatePort({
      crypto: () => crypto,
    });

    await expect(port.decryptEnvelopeValue('first-envelope')).resolves.toBe('first');
    crypto.decryptEnvelopeValue = secondDecrypt;
    await expect(port.decryptEnvelopeValue('second-envelope')).resolves.toBe('second');

    expect(firstDecrypt).toHaveBeenCalledWith('first-envelope', undefined);
    expect(secondDecrypt).toHaveBeenCalledWith('second-envelope', undefined);
  });
});
