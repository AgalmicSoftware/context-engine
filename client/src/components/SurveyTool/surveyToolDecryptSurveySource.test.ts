import { webcrypto } from 'crypto';
import { ethers } from 'ethers';
import { cryptoUtils } from '../../utilities/crypto/cryptography';
import {
  buildSurveyDecryptAttemptSourceInputs,
  buildSurveyDecryptSourceState,
  decryptQuestionRatingEnvelopeMap,
  decryptQuestionRatingEnvelopes,
} from './surveyToolDecryptSurveySource';
import { finalizeQuestionDecryptAttempt } from './surveyToolDecryptFlow';
import { processRatingEnvelopesForSubmit } from './surveyToolRatingEnvelopeSubmitController';

describe('surveyToolDecryptSurveySource', () => {
  it('normalizes latest responses into a typed source slice and rating envelope map', () => {
    const buildSliceFromUserAnswers = jest.fn(() => ({
      answers: { q1: { value: '*' } },
      importance: { q1: null },
      conviction: {},
      additionalComments: {},
    }));

    expect(
      buildSurveyDecryptSourceState(
        {
          responses: [
            { questionID: 'Q1', importanceEncrypted: 'imp-1' },
            { questionId: 'q2', convictionEncrypted: 'conv-2' },
          ],
        },
        null,
        {
          importance: { q1: 7 },
          conviction: { q1: 9 },
        },
        buildSliceFromUserAnswers,
      ),
    ).toEqual({
      sourceSlice: {
        answers: { q1: { value: '*' } },
        importance: { q1: 7 },
        conviction: { q1: 9 },
        additionalComments: {},
      },
      ratingEnvelopesByQid: {
        q1: { importanceEncrypted: 'imp-1', convictionEncrypted: '' },
        q2: { importanceEncrypted: '', convictionEncrypted: 'conv-2' },
      },
    });
    expect(buildSliceFromUserAnswers).toHaveBeenCalledWith({
      responses: [
        { questionID: 'Q1', importanceEncrypted: 'imp-1' },
        { questionId: 'q2', convictionEncrypted: 'conv-2' },
      ],
    });
  });

  it('keeps survey attempt source fallbacks parent-owned', () => {
    const fallbackSlice = {
      answers: { q3: { value: '*' } },
      importance: {},
      conviction: {},
      additionalComments: {},
    };
    const state = {
      userAnswers: { answers: { q1: { value: 'cached' } } },
      surveysResponseState: [null, fallbackSlice],
    };

    expect(
      buildSurveyDecryptAttemptSourceInputs({
        decryptContext: { sessionSlug: '', surveyIndex: 1 },
        state,
        getEffectiveDraftSlug: () => 'draft-slug',
      }),
    ).toEqual({
      surveyIndex: 1,
      slug: 'draft-slug',
      fallbackUserAnswers: state.userAnswers,
      fallbackSourceSlice: fallbackSlice,
      previousStateSlice: fallbackSlice,
    });
  });
});

describe('rating envelope decrypt binding', () => {
  const wallet = new ethers.Wallet(`0x${'81'.repeat(32)}`);
  const context = {
    account: wallet.address,
    chainId: 11155420,
    providerLike: {
      request: async ({ method, params }: { method: string; params: string[] }) => {
        if (method === 'eth_chainId') return '0xaa37dc';
        if (method === 'eth_accounts') return [wallet.address];
        const { domain, types, message } = JSON.parse(params[1]);
        delete types.EIP712Domain;
        return wallet._signTypedData(domain, types, message);
      },
    },
  };
  const encryptRating = (value: number, fieldKey: string, questionId: string) =>
    cryptoUtils.encryptEnvelopeValue(value, {
      ...context,
      provider: context.providerLike,
      surveyId: ethers.constants.HashZero,
      kind: 'rating',
      qId: `${fieldKey}:${questionId}`,
    });
  const ports = {
    decryptEnvelopeValue: (value: unknown, options: Record<string, unknown>) =>
      cryptoUtils.decryptEnvelopeValue(value, options),
  };

  beforeAll(() => {
    Object.defineProperty(window, 'crypto', { value: webcrypto, configurable: true });
  });

  it('rejects rating envelopes moved between ratings or questions', async () => {
    const importance = await encryptRating(7, 'importance', 'q1');
    const conviction = await encryptRating(3, 'conviction', 'q1');

    await expect(
      decryptQuestionRatingEnvelopeMap(
        {
          q1: { importanceEncrypted: importance, convictionEncrypted: importance },
          q2: { importanceEncrypted: importance, convictionEncrypted: conviction },
        },
        context,
        ports,
      ),
    ).resolves.toEqual({ decryptedImportanceFromEnv: { q1: 7 }, decryptedConvictionFromEnv: {} });
    await expect(
      decryptQuestionRatingEnvelopes(
        { importanceEncrypted: conviction, convictionEncrypted: conviction },
        { ...context, questionId: 'Q1' },
        ports,
      ),
    ).resolves.toEqual({ decryptedImportance: null, decryptedConviction: 3 });
  });

  // The only rating writer, the submit controller, encrypts each rating with
  // qId `${fieldKey}:${lowercased questionID}`, so binding single-question
  // decrypts to that qId keeps every saved rating readable.
  const writeLockedRatings = async (questionID: string, importance: number, conviction: number) => {
    const response: Record<string, unknown> = { questionID, importance, conviction };
    await processRatingEnvelopesForSubmit(
      {
        sliceForSubmit: { answers: { [questionID.toLowerCase()]: { value: 'locked', encrypted: true } } },
        userAnswersSource: null,
        questionResponses: [response],
        changedMapForSubmit: { [questionID.toLowerCase()]: { importance: true, conviction: true } },
        encryptionBaseOpts: {
          provider: context.providerLike,
          account: context.account,
          chainId: context.chainId,
          surveyId: ethers.constants.HashZero,
          kind: 'rating',
          hasher: null,
        },
      },
      {
        isQuestionLockedForResponse: () => false,
        resolveFieldEncryptionAudience: () => 'self',
        getEffectiveRecipientsForQid: () => [],
        getEffectiveRecipientsForField: () => [],
        getDefaultResponseEncryptionAudienceForQid: () => 'self',
        buildLitEncryptionOptionsForRecipients: () => null,
        encryptEnvelopeValue: (value, options) => cryptoUtils.encryptEnvelopeValue(value, options),
        getImportanceFromResponse: () => null,
        getConvictionFromResponse: () => null,
      },
    );
    return { importanceEncrypted: response.importanceEncrypted, convictionEncrypted: response.convictionEncrypted };
  };
  const finalizeRatings = (questionId: string, ratingEnvelopes: unknown) =>
    finalizeQuestionDecryptAttempt(
      { questionId, fieldToDecrypt: 'answer', baselineForDecrypt: {}, ratingEnvelopes, ...context },
      {
        decryptSingleField: async () => ({ answers: {} }),
        decryptQuestionRatingEnvelopes: (envelopes, ratingContext) =>
          decryptQuestionRatingEnvelopes(envelopes, ratingContext, ports),
      },
    );

  it('decrypts saved ratings on their own question page and nowhere else', async () => {
    const questionA = `0x${'Ab'.repeat(32)}`;
    const questionB = `0x${'cd'.repeat(32)}`;
    const ratingsA = await writeLockedRatings(questionA, 8, 2);

    await expect(finalizeRatings(questionA.toUpperCase().replace('0X', '0x'), ratingsA)).resolves.toEqual(
      expect.objectContaining({ decryptedImportance: 8, decryptedConviction: 2 }),
    );
    await expect(finalizeRatings(questionB, ratingsA)).resolves.toEqual(
      expect.objectContaining({ decryptedImportance: null, decryptedConviction: null }),
    );
  });
});
