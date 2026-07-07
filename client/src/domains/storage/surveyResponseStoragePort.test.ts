import {
  bindSurveyResponseStoragePort,
  surveyResponseStoragePort,
  type SurveyResponseStorageArweaveUrlModule,
  type SurveyResponseStorageNoLeakModule,
  type SurveyResponseStorageRefModule,
} from './surveyResponseStoragePort';

const txId = 'abcdefghijklmnopqrstuvwxyz1234567890ABCDEFG';

describe('survey response storage port', () => {
  it('routes sanitizer and Arweave helpers through call-time module lookup', () => {
    const firstNoLeakPayloads: SurveyResponseStorageNoLeakModule = {
      sanitizeQuestionPromptForResponsePayload: jest.fn(() => 'first-prompt'),
      sanitizeSurveyTitleForResponsePayload: jest.fn(() => 'first-title'),
    };
    const secondNoLeakPayloads: SurveyResponseStorageNoLeakModule = {
      sanitizeQuestionPromptForResponsePayload: jest.fn(() => 'second-prompt'),
      sanitizeSurveyTitleForResponsePayload: jest.fn(() => 'second-title'),
    };
    const firstArweaveUrls: SurveyResponseStorageArweaveUrlModule = {
      normalizeArweaveUrl: jest.fn(() => 'first-href'),
    };
    const secondArweaveUrls: SurveyResponseStorageArweaveUrlModule = {
      normalizeArweaveUrl: jest.fn(() => 'second-href'),
    };
    const firstStorageRefs: SurveyResponseStorageRefModule = {
      getLegacyArweaveTxId: jest.fn(() => 'first-tx'),
    };
    const secondStorageRefs: SurveyResponseStorageRefModule = {
      getLegacyArweaveTxId: jest.fn(() => 'second-tx'),
    };
    let currentNoLeakPayloads = firstNoLeakPayloads;
    let currentArweaveUrls = firstArweaveUrls;
    let currentStorageRefs = firstStorageRefs;
    const port = bindSurveyResponseStoragePort({
      noLeakPayloads: () => currentNoLeakPayloads,
      arweaveUrls: () => currentArweaveUrls,
      storageRefs: () => currentStorageRefs,
    });

    expect(port.sanitizeQuestionPromptForResponsePayload({ prompt: 'first' })).toBe('first-prompt');
    expect(port.sanitizeSurveyTitleForResponsePayload({ title: 'first' })).toBe('first-title');

    currentNoLeakPayloads = secondNoLeakPayloads;
    currentArweaveUrls = secondArweaveUrls;
    currentStorageRefs = secondStorageRefs;

    expect(port.getLegacyArweaveTxId({ arweaveTxId: 'second-tx' })).toBe('second-tx');
    expect(port.normalizeArweaveUrl('second-tx', { contextLabel: 'survey_tool_question_link' })).toBe('second-href');
    expect(
      port.buildQuestionArweaveHref(
        { arweaveTxId: 'second-tx' },
        {
          contextLabel: 'survey_tool_question_link',
        },
      ),
    ).toBe('second-href');

    expect(firstNoLeakPayloads.sanitizeQuestionPromptForResponsePayload).toHaveBeenCalledWith(
      { prompt: 'first' },
      undefined,
    );
    expect(firstNoLeakPayloads.sanitizeSurveyTitleForResponsePayload).toHaveBeenCalledWith(
      { title: 'first' },
      undefined,
    );
    expect(secondStorageRefs.getLegacyArweaveTxId).toHaveBeenCalledWith({ arweaveTxId: 'second-tx' });
    expect(secondArweaveUrls.normalizeArweaveUrl).toHaveBeenCalledWith('second-tx', {
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
