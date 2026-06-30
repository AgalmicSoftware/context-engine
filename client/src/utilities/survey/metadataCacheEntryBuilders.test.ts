import { getSessionSlugByName } from '../web3/sessionConfigResolvers.js';
import { normalizeSessionSlug } from '../session/sessionNaming.js';
import {
  prepareQuestionMetadataCacheEntry,
  prepareSurveyMetadataCacheEntry,
} from './metadataCacheEntryBuilders.js';

jest.mock('../web3/sessionConfigResolvers.js', () => {
  const actual = jest.requireActual('../web3/sessionConfigResolvers.js');
  return {
    __esModule: true,
    ...actual,
    getSessionSlugByName: jest.fn(),
  };
});

const mockGetSessionSlugByName = getSessionSlugByName as jest.MockedFunction<typeof getSessionSlugByName>;

describe('metadataCacheEntryBuilders', () => {
  beforeEach(() => {
    mockGetSessionSlugByName.mockReset();
    mockGetSessionSlugByName.mockReturnValue(null);
  });

  describe('prepareSurveyMetadataCacheEntry', () => {
    it('normalizes surveyID and id to lowercase', () => {
      const result = prepareSurveyMetadataCacheEntry({
        surveyId: 'Survey-ABC',
        surveyData: {
          surveyID: 'IGNORED',
          id: 'IGNORED',
        },
        slug: 'fallback-session',
      });

      expect(result.surveyID).toBe('survey-abc');
      expect(result.id).toBe('survey-abc');
    });

    it('defaults questionIDs to an empty array when not provided as an array', () => {
      const result = prepareSurveyMetadataCacheEntry({
        surveyId: 'survey-abc',
        surveyData: {
          questionIDs: 'not-an-array',
        },
        slug: 'fallback-session',
      });

      expect(result.questionIDs).toEqual([]);
    });

    it('defaults creator to an empty string', () => {
      const result = prepareSurveyMetadataCacheEntry({
        surveyId: 'survey-abc',
        surveyData: {},
        slug: 'fallback-session',
      });

      expect(result.creator).toBe('');
    });

    it('preserves an existing questionIDs array', () => {
      const questionIDs = ['q1', 'q2'];
      const result = prepareSurveyMetadataCacheEntry({
        surveyId: 'survey-abc',
        surveyData: {
          questionIDs,
        },
        slug: 'fallback-session',
      });

      expect(result.questionIDs).toBe(questionIDs);
    });

    it('applies creationBlock when it is finite', () => {
      const result = prepareSurveyMetadataCacheEntry({
        surveyId: 'survey-abc',
        surveyData: {},
        slug: 'fallback-session',
        creationBlock: '42',
      });

      expect(result.creationBlock).toBe(42);
    });

    it.each([null, ''])(
      'coerces creationBlock to 0 for legacy-compatible inputs: %p',
      (creationBlock) => {
        const result = prepareSurveyMetadataCacheEntry({
          surveyId: 'survey-abc',
          surveyData: {},
          slug: 'fallback-session',
          creationBlock,
        });

        expect(result.creationBlock).toBe(0);
      }
    );

    it.each([undefined, Number.NaN, Number.POSITIVE_INFINITY])(
      'skips creationBlock when it is not finite: %p',
      (creationBlock) => {
        const result = prepareSurveyMetadataCacheEntry({
          surveyId: 'survey-abc',
          surveyData: {},
          slug: 'fallback-session',
          creationBlock,
        });

        expect(Object.prototype.hasOwnProperty.call(result, 'creationBlock')).toBe(false);
      }
    );

    it('sets a survey slug fallback when the envelope leaves slug unset for non-scoped writes', () => {
      const result = prepareSurveyMetadataCacheEntry({
        surveyId: 'survey-abc',
        surveyData: {},
        slug: 'Fallback Session',
      });

      expect(result.slug).toBe(normalizeSessionSlug('Fallback Session'));
      expect(result.sessionSlug).toBe(normalizeSessionSlug('Fallback Session'));
    });

    it('blanks the survey slug fallback for scoped writes without an authoritative session binding', () => {
      const result = prepareSurveyMetadataCacheEntry({
        surveyId: 'survey-abc',
        surveyData: {},
        slug: 'Fallback Session',
        enforceScopedIsolation: true,
      });

      expect(result.slug).toBe('');
      expect(result.sessionSlug).toBe('');
    });

    it('does not mutate the input surveyData object', () => {
      const surveyData = {
        surveyID: 'Original',
        id: 'Original',
        questionIDs: ['q1'],
        creator: 'creator',
        sessionName: 'Named Session',
      };
      const original = {
        ...surveyData,
        questionIDs: [...surveyData.questionIDs],
      };
      mockGetSessionSlugByName.mockReturnValue('resolved-session');

      const result = prepareSurveyMetadataCacheEntry({
        surveyId: 'survey-abc',
        surveyData,
        slug: 'fallback-session',
      });

      expect(result).not.toBe(surveyData);
      expect(surveyData).toEqual(original);
    });

    it.each([null, undefined])('handles %p surveyData inputs', (surveyData) => {
      const result = prepareSurveyMetadataCacheEntry({
        surveyId: 'survey-abc',
        surveyData,
        slug: 'fallback-session',
      });

      expect(result).toMatchObject({
        surveyID: 'survey-abc',
        id: 'survey-abc',
        questionIDs: [],
        creator: '',
        sessionSlug: normalizeSessionSlug('fallback-session'),
        slug: normalizeSessionSlug('fallback-session'),
      });
    });
  });

  describe('prepareQuestionMetadataCacheEntry', () => {
    it('normalizes id to lowercase', () => {
      const result = prepareQuestionMetadataCacheEntry({
        questionId: 'Question-ABC',
        questionData: {
          id: 'IGNORED',
        },
        slug: 'fallback-session',
      });

      expect(result.id).toBe('question-abc');
    });

    it('applies session binding from the envelope', () => {
      mockGetSessionSlugByName.mockReturnValue('resolved-session');

      const result = prepareQuestionMetadataCacheEntry({
        questionId: 'question-abc',
        questionData: {
          sessionName: 'Named Session',
          prompt: 'hello',
        },
        slug: 'fallback-session',
      });

      expect(result).toMatchObject({
        id: 'question-abc',
        prompt: 'hello',
        sessionName: 'Named Session',
        sessionSlug: normalizeSessionSlug('resolved-session'),
        sessionSlugExplicit: false,
      });
    });

    it('uses the explicit session slug for scoped writes when question metadata is authoritative', () => {
      mockGetSessionSlugByName.mockReturnValue('resolved-session');

      const result = prepareQuestionMetadataCacheEntry({
        questionId: 'question-abc',
        questionData: {
          sessionSlug: 'Explicit Session',
          sessionName: 'Named Session',
          prompt: 'hello',
        },
        slug: 'fallback-session',
        enforceScopedIsolation: true,
      });

      expect(result).toMatchObject({
        id: 'question-abc',
        prompt: 'hello',
        sessionName: 'Named Session',
        sessionSlug: normalizeSessionSlug('Explicit Session'),
        sessionSlugExplicit: true,
      });
    });

    it('blanks the question session slug for scoped writes without authoritative metadata', () => {
      const result = prepareQuestionMetadataCacheEntry({
        questionId: 'question-abc',
        questionData: {
          prompt: 'hello',
        },
        slug: 'fallback-session',
        enforceScopedIsolation: true,
      });

      expect(result).toMatchObject({
        id: 'question-abc',
        prompt: 'hello',
        sessionSlug: '',
        sessionSlugExplicit: false,
      });
    });

    it('does not mutate the input questionData object', () => {
      const questionData = {
        id: 'Original',
        sessionSlug: 'Edge Session',
        prompt: 'hello',
      };
      const original = { ...questionData };

      const result = prepareQuestionMetadataCacheEntry({
        questionId: 'question-abc',
        questionData,
        slug: 'fallback-session',
      });

      expect(result).not.toBe(questionData);
      expect(questionData).toEqual(original);
    });

    it.each([null, undefined])('handles %p questionData inputs', (questionData) => {
      const result = prepareQuestionMetadataCacheEntry({
        questionId: 'question-abc',
        questionData,
        slug: 'fallback-session',
      });

      expect(result).toMatchObject({
        id: 'question-abc',
        sessionSlug: normalizeSessionSlug('fallback-session'),
        sessionSlugExplicit: false,
      });
    });
  });
});
