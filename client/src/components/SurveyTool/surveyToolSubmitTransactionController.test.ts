import {
  ensureIdentifierHash,
  filterChangedResponsesForSubmit,
  normalizeSubmitReceipt,
  resolveSurveySubmitSessionTarget,
} from './surveyToolSubmitTransactionController';
import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from '../../utilities/session/sessionModeProfile';

const HASH_ZERO = `0x${'0'.repeat(64)}`;
const TX_HASH = `0x${'a'.repeat(64)}`;
type NormalizeSubmitOptions = Parameters<typeof normalizeSubmitReceipt>[1];

const deepCloneJson = <T>(obj: T): T => JSON.parse(JSON.stringify(obj)) as T;

const makeSubmitOpts = (overrides: Partial<NormalizeSubmitOptions> = {}): NormalizeSubmitOptions => ({
  questionResponses: [
    {
      questionID: 'q1',
      answer: { value: 'yes' },
    },
  ],
  surveyResponse: {
    surveyID: 'survey-1',
    responses: [
      {
        questionID: 'q1',
        answer: { value: 'yes' },
      },
    ],
  },
  surveyId: 'survey-1',
  submissionGroupKey: 'group-1',
  deepClone: deepCloneJson,
  ...overrides,
});

describe('surveyToolSubmitTransactionController', () => {
  describe('resolveSurveySubmitSessionTarget', () => {
    it('passes the authoritative config to worker-canonical submission instead of losing it behind a slug', () => {
      const sessionConfig = {
        slug: 'demo-sh',
        corsWorkerUrl: 'https://worker.example',
        sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
        storageProfile: { backend: 'cloudflare' },
      };

      expect(
        resolveSurveySubmitSessionTarget({
          sessionSlug: 'demo-sh',
          sessionConfig,
        }),
      ).toEqual(sessionConfig);
      expect(() => resolveSurveySubmitSessionTarget({ sessionSlug: 'missing', sessionConfig: {} })).toThrow(
        /missing, invalid, or unsupported/i,
      );
      expect(
        resolveSurveySubmitSessionTarget({
          sessionSlug: 'legacy',
          sessionConfig: {
            __registry: {
              registryChainId: 11155420,
              sessionIdHex: '0x00112233445566778899aabbccddeeff',
            },
          },
        }),
      ).toBe('legacy');
    });
  });

  describe('filterChangedResponsesForSubmit', () => {
    it('single question mode returns single-element arrays with HashZero surveyId', () => {
      const data = {
        questionID: 'q1',
        answer: { value: 'yes' },
      };

      expect(
        filterChangedResponsesForSubmit({
          data,
          changedSet: new Set(['q1']),
          singleQuestionMode: true,
          isStandalone: false,
          surveyId: 'survey-1',
          HashZero: HASH_ZERO,
        }),
      ).toEqual({
        questionIds: ['q1'],
        questionResponses: [data],
        surveyId: HASH_ZERO,
        surveyResponse: null,
      });
    });

    it('single question mode throws when qid is not in the changed set', () => {
      expect(() =>
        filterChangedResponsesForSubmit({
          data: { questionID: 'q1' },
          changedSet: new Set(['q2']),
          singleQuestionMode: true,
          isStandalone: false,
          surveyId: 'survey-1',
          HashZero: HASH_ZERO,
        }),
      ).toThrow('No new or changed responses to submit.');
    });

    it('single question mode throws when data has no questionID', () => {
      expect(() =>
        filterChangedResponsesForSubmit({
          data: { answer: { value: 'yes' } },
          changedSet: new Set(['q1']),
          singleQuestionMode: true,
          isStandalone: false,
          surveyId: 'survey-1',
          HashZero: HASH_ZERO,
        }),
      ).toThrow('No new or changed responses to submit.');
    });

    it('survey mode filters responses to only changed qids', () => {
      const q1 = { questionID: 'q1', answer: { value: 'one' } };
      const q2 = { questionID: 'q2', answer: { value: 'two' } };
      const q3 = { questionID: 'q3', answer: { value: 'three' } };

      const result = filterChangedResponsesForSubmit({
        data: { responses: [q1, q2, q3, { answer: { value: 'skip' } }] },
        changedSet: new Set(['q1', 'q3']),
        singleQuestionMode: false,
        isStandalone: false,
        surveyId: 'survey-1',
        HashZero: HASH_ZERO,
      });

      expect(result.questionIds).toEqual(['q1', 'q3']);
      expect(result.questionResponses).toEqual([q1, q3]);
    });

    it('survey mode throws when no responses match the changed set', () => {
      expect(() =>
        filterChangedResponsesForSubmit({
          data: {
            responses: [{ questionID: 'q1' }, { questionID: 'q2' }],
          },
          changedSet: new Set(['q9']),
          singleQuestionMode: false,
          isStandalone: false,
          surveyId: 'survey-1',
          HashZero: HASH_ZERO,
        }),
      ).toThrow('No new or changed responses to submit.');
    });

    it('survey mode sets surveyId from props when not standalone', () => {
      const result = filterChangedResponsesForSubmit({
        data: {
          responses: [{ questionID: 'q1', answer: { value: 'yes' } }],
        },
        changedSet: new Set(['q1']),
        singleQuestionMode: false,
        isStandalone: false,
        surveyId: 'survey-123',
        HashZero: HASH_ZERO,
      });

      expect(result.surveyId).toBe('survey-123');
    });

    it('standalone mode uses HashZero for surveyId and null for surveyResponse', () => {
      const result = filterChangedResponsesForSubmit({
        data: {
          surveyID: 'survey-123',
          responses: [{ questionID: 'q1', answer: { value: 'yes' } }],
        },
        changedSet: new Set(['q1']),
        singleQuestionMode: false,
        isStandalone: true,
        surveyId: 'survey-123',
        HashZero: HASH_ZERO,
      });

      expect(result.surveyId).toBe(HASH_ZERO);
      expect(result.surveyResponse).toBeNull();
    });

    it('survey mode surveyResponse includes filtered responses', () => {
      const q1 = { questionID: 'q1', answer: { value: 'one' } };
      const q2 = { questionID: 'q2', answer: { value: 'two' } };

      const result = filterChangedResponsesForSubmit({
        data: {
          surveyID: 'survey-1',
          title: 'Survey Title',
          responses: [q1, q2],
        },
        changedSet: new Set(['q2']),
        singleQuestionMode: false,
        isStandalone: false,
        surveyId: 'survey-1',
        HashZero: HASH_ZERO,
      });

      expect(result.surveyResponse).toEqual({
        surveyID: 'survey-1',
        title: 'Survey Title',
        responses: [q2],
      });
    });
  });

  describe('ensureIdentifierHash', () => {
    it('uses hashIdentifier when available', () => {
      const hashIdentifier = jest.fn((_value: unknown) => 'hashed-by-helper');
      const isHexString = jest.fn(() => false);
      const id = jest.fn((value: string) => `id:${value}`);

      const result = ensureIdentifierHash('value-1', {
        hashIdentifier,
        isHexString,
        id,
        HashZero: HASH_ZERO,
      });

      expect(result).toBe('hashed-by-helper');
      expect(hashIdentifier).toHaveBeenCalledWith('value-1');
      expect(isHexString).not.toHaveBeenCalled();
      expect(id).not.toHaveBeenCalled();
    });

    it('falls back to isHexString check for 32-byte hex', () => {
      const isHexString = jest.fn((_value: unknown, _length: number) => true);
      const id = jest.fn((value: string) => `id:${value}`);
      const value = `0x${'AB'.repeat(32)}`;

      const result = ensureIdentifierHash(value, {
        isHexString,
        id,
        HashZero: HASH_ZERO,
      });

      expect(result).toBe(value.toLowerCase());
      expect(isHexString).toHaveBeenCalledWith(value, 32);
      expect(id).not.toHaveBeenCalled();
    });

    it('falls through to id() for non-hex strings', () => {
      const isHexString = jest.fn(() => false);
      const id = jest.fn((value: string) => `id:${value}`);

      const result = ensureIdentifierHash('plain-text', {
        isHexString,
        id,
        HashZero: HASH_ZERO,
      });

      expect(result).toBe('id:plain-text');
      expect(id).toHaveBeenCalledWith('plain-text');
    });

    it('returns HashZero for empty, null, and undefined values', () => {
      expect(ensureIdentifierHash('', { HashZero: HASH_ZERO })).toBe(HASH_ZERO);
      expect(ensureIdentifierHash('   ', { HashZero: HASH_ZERO })).toBe(HASH_ZERO);
      expect(ensureIdentifierHash(null, { HashZero: HASH_ZERO })).toBe(HASH_ZERO);
      expect(ensureIdentifierHash(undefined, { HashZero: HASH_ZERO })).toBe(HASH_ZERO);
    });

    it('calls warn on hashIdentifier error', () => {
      const error = new Error('hash failed');
      const warn = jest.fn();
      const hashIdentifier = jest.fn(() => {
        throw error;
      });
      const isHexString = jest.fn(() => false);
      const id = jest.fn(() => 'id:fallback');

      const result = ensureIdentifierHash('value-1', {
        hashIdentifier,
        isHexString,
        id,
        HashZero: HASH_ZERO,
        warn,
      });

      expect(result).toBe('id:fallback');
      expect(warn).toHaveBeenCalledWith('SurveyTool: fallback', error);
    });

    it('calls warn on isHexString error', () => {
      const error = new Error('hex failed');
      const warn = jest.fn();
      const isHexString = jest.fn(() => {
        throw error;
      });
      const id = jest.fn(() => 'id:fallback');

      const result = ensureIdentifierHash('value-1', {
        isHexString,
        id,
        HashZero: HASH_ZERO,
        warn,
      });

      expect(result).toBe('id:fallback');
      expect(warn).toHaveBeenCalledWith('SurveyTool: fallback', error);
    });

    it('throws when id is not available and value is non-empty', () => {
      expect(() =>
        ensureIdentifierHash('plain-text', {
          isHexString: () => false,
          HashZero: HASH_ZERO,
        }),
      ).toThrow('ensureIdentifierHash: id() is required for non-empty values');
    });
  });

  describe('normalizeSubmitReceipt', () => {
    it('awaits tx.wait() for ethers TransactionResponse', async () => {
      let waitResolved = false;
      const tx = {
        wait: jest.fn(async () => {
          await Promise.resolve();
          waitResolved = true;
          return {
            status: 1,
            transactionHash: TX_HASH,
            blockNumber: 99,
          };
        }),
      };

      const result = await normalizeSubmitReceipt(tx, makeSubmitOpts());

      expect(tx.wait).toHaveBeenCalledTimes(1);
      expect(waitResolved).toBe(true);
      expect(result.transactionHash).toBe(TX_HASH);
      expect(result.blockNumber).toBe(99);
    });

    it('throws when tx.wait() returns failed status', async () => {
      const tx = {
        wait: jest.fn(async () => ({
          status: 0,
          transactionHash: TX_HASH,
        })),
      };

      await expect(normalizeSubmitReceipt(tx, makeSubmitOpts())).rejects.toThrow('Submission failed on-chain.');
    });

    it('accepts string transaction hash (0x + 64 chars)', async () => {
      const result = await normalizeSubmitReceipt(TX_HASH, makeSubmitOpts());

      expect(result.transactionHash).toBe(TX_HASH);
    });

    it('accepts object with transactionHash property', async () => {
      const result = await normalizeSubmitReceipt({ transactionHash: TX_HASH, nonce: 7 }, makeSubmitOpts());

      expect(result).toEqual(
        expect.objectContaining({
          transactionHash: TX_HASH,
          nonce: 7,
        }),
      );
    });

    it('accepts object with hash property', async () => {
      const result = await normalizeSubmitReceipt({ hash: TX_HASH, from: '0x123' }, makeSubmitOpts());

      expect(result).toEqual(
        expect.objectContaining({
          hash: TX_HASH,
          from: '0x123',
        }),
      );
    });

    it('throws "No transaction was sent." for invalid tx', async () => {
      await expect(normalizeSubmitReceipt({ receipt: null }, makeSubmitOpts())).rejects.toThrow(
        'No transaction was sent.',
      );
    });

    it('attaches __ceQuestionResponses, __ceSurveyResponse, __ceSurveyId, and __ceSubmissionGroupKey', async () => {
      const result = await normalizeSubmitReceipt(
        TX_HASH,
        makeSubmitOpts({
          questionResponses: [{ questionID: 'q2', answer: { value: 'two' } }],
          surveyResponse: { surveyID: 'survey-2', responses: [{ questionID: 'q2' }] },
          surveyId: 'survey-2',
          submissionGroupKey: 'group-2',
        }),
      );

      expect(result).toEqual(
        expect.objectContaining({
          transactionHash: TX_HASH,
          __ceQuestionResponses: [{ questionID: 'q2', answer: { value: 'two' } }],
          __ceSurveyResponse: { surveyID: 'survey-2', responses: [{ questionID: 'q2' }] },
          __ceSurveyId: 'survey-2',
          __ceSubmissionGroupKey: 'group-2',
        }),
      );
    });

    it('uses deepClone for metadata', async () => {
      const questionResponses = [
        {
          questionID: 'q1',
          answer: { value: 'original' },
        },
      ];
      const surveyResponse = {
        surveyID: 'survey-1',
        responses: questionResponses,
      };
      const deepClone = jest.fn(deepCloneJson);

      const result = await normalizeSubmitReceipt(
        TX_HASH,
        makeSubmitOpts({
          questionResponses,
          surveyResponse,
          deepClone,
        }),
      );

      expect(deepClone).toHaveBeenCalledTimes(2);
      expect(deepClone).toHaveBeenNthCalledWith(1, questionResponses);
      expect(deepClone).toHaveBeenNthCalledWith(2, surveyResponse);
      expect(result.__ceQuestionResponses).not.toBe(questionResponses);
      expect(result.__ceSurveyResponse).not.toBe(surveyResponse);

      questionResponses[0].answer.value = 'mutated';
      surveyResponse.responses[0].answer.value = 'mutated-again';

      expect(result.__ceQuestionResponses[0].answer!.value).toBe('original');
      expect(result.__ceSurveyResponse!.responses![0].answer!.value).toBe('original');
    });
  });
});
