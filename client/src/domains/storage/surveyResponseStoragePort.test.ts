import * as noLeakPayloads from '../../utilities/arweave/noLeakPayloads.js';
import * as arweaveUrls from '../../utilities/arweave/arweaveUrls.js';
import * as storageRefs from '../../utilities/storage/storageRefs.js';
import { surveyResponseStoragePort } from './surveyResponseStoragePort';

const txId = 'abcdefghijklmnopqrstuvwxyz1234567890ABCDEFG';

describe('survey response storage port', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('routes sanitizer and Arweave helpers through call-time module property lookup', () => {
    const sanitizeQuestionPromptForResponsePayload = jest
      .spyOn(noLeakPayloads, 'sanitizeQuestionPromptForResponsePayload')
      .mockReturnValue('first-prompt');
    const sanitizeSurveyTitleForResponsePayload = jest
      .spyOn(noLeakPayloads, 'sanitizeSurveyTitleForResponsePayload')
      .mockReturnValue('first-title');
    const normalizeArweaveUrl = jest.spyOn(arweaveUrls, 'normalizeArweaveUrl').mockReturnValue('second-href');
    const getLegacyArweaveTxId = jest.spyOn(storageRefs, 'getLegacyArweaveTxId').mockReturnValue('second-tx');

    expect(surveyResponseStoragePort.sanitizeQuestionPromptForResponsePayload({ prompt: 'first' })).toBe(
      'first-prompt',
    );
    expect(surveyResponseStoragePort.sanitizeSurveyTitleForResponsePayload({ title: 'first' })).toBe('first-title');
    expect(surveyResponseStoragePort.getLegacyArweaveTxId({ arweaveTxId: 'second-tx' })).toBe('second-tx');
    expect(
      surveyResponseStoragePort.normalizeArweaveUrl('second-tx', { contextLabel: 'survey_tool_question_link' }),
    ).toBe('second-href');
    expect(
      surveyResponseStoragePort.buildQuestionArweaveHref(
        { arweaveTxId: 'second-tx' },
        {
          contextLabel: 'survey_tool_question_link',
        },
      ),
    ).toBe('second-href');

    expect(sanitizeQuestionPromptForResponsePayload).toHaveBeenCalledWith({ prompt: 'first' }, undefined);
    expect(sanitizeSurveyTitleForResponsePayload).toHaveBeenCalledWith({ title: 'first' }, undefined);
    expect(getLegacyArweaveTxId).toHaveBeenCalledWith({ arweaveTxId: 'second-tx' });
    expect(normalizeArweaveUrl).toHaveBeenCalledWith('second-tx', {
      contextLabel: 'survey_tool_question_link',
    });
  });

  it('preserves locked-field sanitizer and question link behavior', () => {
    expect(
      surveyResponseStoragePort.sanitizeQuestionPromptForResponsePayload({
        prompt: 'Hidden question',
        promptEncrypted: { ciphertext: 'sealed' },
      }),
    ).toBe('[encrypted]');
    expect(
      surveyResponseStoragePort.sanitizeSurveyTitleForResponsePayload({
        title: 'Hidden survey',
        titleEncrypted: { ciphertext: 'sealed' },
      }),
    ).toBe('[encrypted]');
    expect(
      surveyResponseStoragePort.buildQuestionArweaveHref(
        {
          arweaveTxId: txId,
        },
        {
          contextLabel: 'survey_tool_question_link',
        },
      ),
    ).toContain(txId);
    expect(surveyResponseStoragePort.buildQuestionArweaveHref({})).toBe('');
  });
});
