import {
  refreshSessionInfoForSlug,
  refreshSessionMetaFieldsForSlug,
} from './sessionMetaController.js';

const ACCOUNT = '0x00000000000000000000000000000000000000aa';
const GROUP_CFG = {
  networkChainId: 84532,
  slug: 'edge',
};

describe('sessionMetaController', () => {
  it('decrypts session info overrides and returns the next attempt key', async () => {
    const decryptEnvelopeValue = jest.fn().mockResolvedValue('Private session info');
    const getKey = jest.fn();

    const result = await refreshSessionInfoForSlug({
      slug: 'edge',
      cfg: {
        ...GROUP_CFG,
        sessionInfoEncrypted: 'session-info-env',
      },
      account: ACCOUNT,
      providerLike: 'wagmi',
      getKey,
      decryptEnvelopeValue,
    });

    expect(decryptEnvelopeValue).toHaveBeenCalledWith('session-info-env', {
      account: ACCOUNT,
      chainId: 84532,
      providerLike: 'wagmi',
      litOpts: { getKey },
    });
    expect(result).toEqual({
      attemptKey: `edge|${ACCOUNT}|session-info-env`,
      nextValue: 'Private session info',
      shouldUpdate: true,
    });
  });

  it('skips repeated session info decrypt attempts for the same slug/account/envelope', async () => {
    const decryptEnvelopeValue = jest.fn();
    const getKey = jest.fn();
    const attemptKey = `edge|${ACCOUNT}|session-info-env`;

    const result = await refreshSessionInfoForSlug({
      slug: 'edge',
      cfg: {
        ...GROUP_CFG,
        sessionInfoEncrypted: 'session-info-env',
      },
      account: ACCOUNT,
      providerLike: 'wagmi',
      getKey,
      lastAttemptKey: attemptKey,
      decryptEnvelopeValue,
    });

    expect(result).toEqual({
      attemptKey,
      nextValue: '',
      shouldUpdate: false,
    });
    expect(decryptEnvelopeValue).not.toHaveBeenCalled();
  });

  it('builds session name and header patches from encrypted metadata fields', async () => {
    const decryptEnvelopeValue = jest.fn().mockImplementation(async (encrypted) => {
      if (encrypted === 'name-env') return 'Private Session Name';
      if (encrypted === 'header-env') return 'ar://private-header';
      throw new Error(`Unexpected envelope: ${encrypted}`);
    });

    const result = await refreshSessionMetaFieldsForSlug({
      slug: 'edge',
      cfg: {
        ...GROUP_CFG,
        encryptedFields: {
          sessionName: 'name-env',
          sessionHeader: 'header-env',
        },
      },
      account: ACCOUNT,
      providerLike: 'wagmi',
      getKey: jest.fn(),
      decryptEnvelopeValue,
    });

    expect(result.errors).toEqual([]);
    expect(result.patches).toEqual({
      sessionNameOverrides: {
        edge: 'Private Session Name',
      },
      sessionHeaderOverrides: {
        edge: 'ar://private-header',
      },
    });
    expect(Object.keys(result.attempts)).toEqual([
      `edge|${ACCOUNT}|sessionName|name-env`,
      `edge|${ACCOUNT}|sessionHeader|header-env`,
    ]);
  });

  it('keeps successful metadata decrypts when a sibling field fails', async () => {
    const decryptEnvelopeValue = jest.fn().mockImplementation(async (encrypted) => {
      if (encrypted === 'name-env') {
        throw new Error('not authorized');
      }
      if (encrypted === 'header-env') return 'ar://private-header';
      throw new Error(`Unexpected envelope: ${encrypted}`);
    });

    const result = await refreshSessionMetaFieldsForSlug({
      slug: 'edge',
      cfg: {
        ...GROUP_CFG,
        encryptedFields: {
          sessionName: 'name-env',
          sessionHeader: 'header-env',
        },
      },
      account: ACCOUNT,
      providerLike: 'wagmi',
      getKey: jest.fn(),
      decryptEnvelopeValue,
    });

    expect(result.patches).toEqual({
      sessionHeaderOverrides: {
        edge: 'ar://private-header',
      },
    });
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].fieldKey).toBe('sessionName');
    expect(result.errors[0].error).toBeInstanceOf(Error);
    expect(result.errors[0].error.message).toBe('not authorized');
  });
});
