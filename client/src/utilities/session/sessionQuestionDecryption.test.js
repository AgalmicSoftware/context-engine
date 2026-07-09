import {
  buildQuestionDecryptContextForSession,
  hasMaskedQuestionPayloadImproved,
} from './sessionQuestionDecryption.js';

describe('sessionQuestionDecryption', () => {
  it('builds a question decrypt context from session config and Lit hooks', () => {
    const getKey = jest.fn();
    const litHooks = { getKey, mode: 'test' };

    expect(
      buildQuestionDecryptContextForSession({
        cfg: { networkChainId: 84532 },
        account: '0xabc',
        providerLike: 'wagmi',
        litHooks,
      }),
    ).toEqual({
      account: '0xabc',
      providerLike: 'wagmi',
      chainId: 84532,
      litHooks,
      litOpts: { getKey },
    });
  });

  it('falls back to the provided chain id when the session config omits one', () => {
    expect(
      buildQuestionDecryptContextForSession({
        cfg: {},
        account: '0xabc',
        providerLike: 'wagmi',
        litHooks: {},
        fallbackChainId: 11155420,
      }),
    ).toEqual({
      account: '0xabc',
      providerLike: 'wagmi',
      chainId: 11155420,
      litHooks: {},
      litOpts: null,
    });
  });

  it('preserves object-shaped providerLike values without coercing them', () => {
    const providerLike = { provider: true, request: jest.fn() };

    expect(
      buildQuestionDecryptContextForSession({
        cfg: { networkChainId: 84532 },
        account: '0xabc',
        providerLike,
        litHooks: null,
      }),
    ).toEqual({
      account: '0xabc',
      providerLike,
      chainId: 84532,
      litHooks: null,
      litOpts: null,
    });
  });

  it('treats newly decrypted prompt/options/tags payloads as improvements', () => {
    expect(
      hasMaskedQuestionPayloadImproved(
        {
          prompt: '[encrypted]',
          optionsEncrypted: 'env',
          options: [],
          tagsEncrypted: 'env',
          tags: [],
        },
        {
          prompt: 'Visible prompt',
          promptDecrypted: true,
          optionsEncrypted: 'env',
          options: ['A'],
          optionsDecrypted: true,
          tagsEncrypted: 'env',
          tags: ['governance'],
          tagsDecrypted: true,
        },
      ),
    ).toBe(true);
  });

  it('does not report an improvement when the masked payload stays masked', () => {
    expect(
      hasMaskedQuestionPayloadImproved(
        {
          prompt: '[encrypted]',
          optionsEncrypted: 'env',
          options: [],
        },
        {
          prompt: '[encrypted]',
          optionsEncrypted: 'env',
          options: [],
        },
      ),
    ).toBe(false);
  });
});
