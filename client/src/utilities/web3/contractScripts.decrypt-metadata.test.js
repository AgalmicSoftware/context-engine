import contractScripts from './contractScripts.js';
import { cryptoUtils } from '../crypto/cryptography.js';
import store from '../../store.js';

const ACCOUNT = '0x00000000000000000000000000000000000000aa';
const GROUP_CFG = {
  slug: 'edge',
  networkChainId: 84532,
};

describe('contractScripts metadata decrypt helpers', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('propagates decrypt error sentinels while still applying successful survey/question field decrypts', async () => {
    jest.spyOn(cryptoUtils, 'decryptEnvelopeValue').mockImplementation(async (envelopeJson) => {
      switch (envelopeJson) {
        case 'survey-title-env':
          return 'Hidden survey title';
        case 'survey-docs-env':
          throw new Error('wrong chain for decrypt');
        case 'question-prompt-env':
          throw new Error('not authorized');
        case 'question-options-env':
          return '["Option A","Option B"]';
        case 'question-tags-env':
          return ['governance', 'funding'];
        default:
          throw new Error(`Unexpected envelope: ${envelopeJson}`);
      }
    });

    const decryptContext = {
      account: ACCOUNT,
      providerLike: 'wagmi',
      chainId: 84532,
      litHooks: { getKey: jest.fn() },
    };
    const surveyData = {
      id: 'survey-1',
      titleEncrypted: 'survey-title-env',
      documentURLsEncrypted: 'survey-docs-env',
    };
    const questionData = {
      id: 'question-1',
      promptEncrypted: 'question-prompt-env',
      optionsEncrypted: 'question-options-env',
      tagsEncrypted: 'question-tags-env',
    };

    await contractScripts.decryptSurveyPayloadInPlace(surveyData, GROUP_CFG, { decryptContext });
    await contractScripts.decryptQuestionPayloadInPlace(questionData, GROUP_CFG, { decryptContext });

    expect(surveyData.title).toBe('Hidden survey title');
    expect(surveyData.titleDecrypted).toBe(true);
    expect(surveyData.docsUrlsDecryptError).toBe('network');
    expect(surveyData.documentURLs).toBeUndefined();

    expect(questionData.promptDecryptError).toBe('lit_failure');
    expect(questionData.options).toEqual(['Option A', 'Option B']);
    expect(questionData.optionsDecrypted).toBe(true);
    expect(questionData.tags).toEqual(['governance', 'funding']);
    expect(questionData.tagsDecrypted).toBe(true);
  });

  it('returns key_unavailable sentinels when decrypt context is missing required signer state', async () => {
    jest.spyOn(store, 'getState').mockReturnValue({ profile: {} });
    const decryptSpy = jest.spyOn(cryptoUtils, 'decryptEnvelopeValue').mockResolvedValue('unused');

    const questionData = {
      id: 'question-missing-chain',
      promptEncrypted: 'question-missing-chain-env',
    };

    await contractScripts.decryptQuestionPayloadInPlace(
      questionData,
      { slug: 'edge' },
      {
        decryptContext: {
          account: ACCOUNT,
          providerLike: 'wagmi',
          litHooks: { getKey: jest.fn() },
        },
      }
    );

    expect(questionData.promptDecryptError).toBe('key_unavailable');
    expect(questionData.prompt).toBeUndefined();
    expect(decryptSpy).not.toHaveBeenCalled();
  });

  it('prefers Lit recipients for non-creator question metadata decrypts', async () => {
    const decryptSpy = jest.spyOn(cryptoUtils, 'decryptEnvelopeValue').mockResolvedValue('SBT prompt');
    const questionData = {
      id: 'question-lit-first',
      creator: '0x00000000000000000000000000000000000000bb',
      promptEncrypted: '{"recipients":[{"type":"lit-sbt-v1","lit":{"ciphertext":"cipher"}}]}',
    };

    await contractScripts.decryptQuestionPayloadInPlace(
      questionData,
      GROUP_CFG,
      {
        decryptContext: {
          account: ACCOUNT,
          providerLike: 'passkey_eoa',
          chainId: 84532,
          litHooks: { getKey: jest.fn() },
        },
      }
    );

    expect(questionData.prompt).toBe('SBT prompt');
    expect(questionData.promptDecrypted).toBe(true);
    expect(decryptSpy).toHaveBeenCalledWith(
      questionData.promptEncrypted,
      expect.objectContaining({ preferLitRecipients: true })
    );
  });
});
