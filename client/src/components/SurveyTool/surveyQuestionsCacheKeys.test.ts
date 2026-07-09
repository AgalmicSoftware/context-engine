import {
  buildDecryptContextKeyFromContext,
  buildResponseGatePolicyCacheKeyFromInputs,
} from './surveyQuestionsCacheKeys.js';

describe('surveyQuestionsCacheKeys', () => {
  describe('buildDecryptContextKeyFromContext', () => {
    it('builds a fully populated survey decrypt context key', () => {
      expect(
        buildDecryptContextKeyFromContext({
          account: '0xAbC',
          providerKind: 'walletconnect',
          sessionSlug: 'AlphaSession',
          networkID: '11155420',
          responder: '0xDef',
          surveyIndex: ' 7 ',
          surveyId: ' Survey-ONE ',
          questionID: ' Question-ONE ',
        }),
      ).toBe('0xAbC|walletconnect|AlphaSession|11155420|0xDef|survey|7|survey-one|question-one');
    });

    it('builds the empty survey decrypt context key', () => {
      expect(buildDecryptContextKeyFromContext({})).toBe('|||||survey|||');
    });

    it('uses single for single-question decrypt context keys', () => {
      expect(
        buildDecryptContextKeyFromContext({
          singleQuestionMode: true,
          isStandalone: true,
        }),
      ).toBe('|||||single|||');
    });

    it('uses standalone only when single-question mode is false', () => {
      expect(
        buildDecryptContextKeyFromContext({
          isStandalone: true,
        }),
      ).toBe('|||||standalone|||');
    });
  });

  describe('buildResponseGatePolicyCacheKeyFromInputs', () => {
    it('builds question-flow response gate policy keys', () => {
      expect(
        buildResponseGatePolicyCacheKeyFromInputs({
          singleQuestionMode: true,
          questionID: ' Question-ABC ',
          surveyId: 'Survey-Ignored',
          hintedSessionSlug: ' Hint Slug ',
          effectiveSessionSlug: 'Effective/Slug',
          networkId: ' 11155420 ',
        }),
      ).toBe('question| question-abc || Hint Slug |Effective/Slug| 11155420 ');
    });

    it('builds survey-flow response gate policy keys', () => {
      expect(
        buildResponseGatePolicyCacheKeyFromInputs({
          questionID: 'Question-Ignored',
          surveyId: ' Survey-XYZ ',
          hintedSessionSlug: ' Hint Slug ',
          effectiveSessionSlug: 'Effective/Slug',
          networkId: 'network:84532',
        }),
      ).toBe('survey|| survey-xyz | Hint Slug |Effective/Slug|network:84532');
    });
  });
});
