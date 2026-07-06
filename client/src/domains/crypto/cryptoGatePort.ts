import { cryptoUtils } from '../../utilities/crypto/cryptography.js';

export type CryptoGateLitOptions = {
  getKey?: (options?: unknown) => Promise<unknown> | unknown;
};

export type CryptoGateDecryptOptions = {
  account?: unknown;
  chainId?: unknown;
  litOpts?: CryptoGateLitOptions;
  preferLitRecipients?: boolean;
  providerLike?: unknown;
};

export type CryptoGateCryptoUtilsModule = {
  decryptEnvelopeValue: (
    envelopeJson: unknown,
    options?: CryptoGateDecryptOptions
  ) => Promise<unknown>;
};

export type CryptoGatePort = {
  /**
   * Shared Lit/SBT-gated envelope decrypt execution seam for results surfaces.
   * SurveyResults uses this first; SurveyQuestions should reuse the same method
   * when its locked response decrypt path moves behind a domain port.
   */
  decryptEnvelopeValue: (
    envelopeJson: unknown,
    options?: CryptoGateDecryptOptions
  ) => Promise<unknown>;
};

export type BindCryptoGatePortArgs = {
  crypto: () => CryptoGateCryptoUtilsModule;
};

export const bindCryptoGatePort = ({
  crypto,
}: BindCryptoGatePortArgs): CryptoGatePort => ({
  decryptEnvelopeValue: (envelopeJson, options) => (
    crypto().decryptEnvelopeValue(envelopeJson, options)
  ),
});

export const cryptoGatePort = bindCryptoGatePort({
  crypto: () => cryptoUtils as CryptoGateCryptoUtilsModule,
});
