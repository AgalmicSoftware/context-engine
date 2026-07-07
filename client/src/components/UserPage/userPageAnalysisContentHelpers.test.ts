import {
  buildUserPageAnalysisCreatedQuestions,
  buildUserPageAnalysisCreatedSurveys,
  buildUserPageAnalysisQuestions,
  buildUserPageAnalysisSbts,
  buildUserPageAnalysisSurveys,
  buildUserPageSbtSection,
  isUserPageSbtAggregateEntry,
  readUserPageDirectNetworkCacheBucket,
} from './userPageAnalysisContentHelpers';

describe('userPageAnalysisContentHelpers', () => {
  it('detects aggregate SBT entries', () => {
    expect(
      isUserPageSbtAggregateEntry({
        mintedSet: new Set(['0xA']),
        burnedSet: new Set(['0xB']),
      }),
    ).toBe(true);
    expect(
      isUserPageSbtAggregateEntry({
        mintedSet: new Set(['0xA']),
        burnedSet: [],
      }),
    ).toBe(false);
  });

  it('builds created question and survey analysis payloads from cache buckets', () => {
    const surveysCache = {
      84532: {
        surveys: {
          survey_a: {
            questionIDs: ['Q_A', 'Q_B', 'Q_missing'],
          },
        },
      },
    };
    const questionsCache = {
      84532: {
        questions: {
          q_a: { id: 'q_a', type: 'text', prompt: 'Prompt A' },
          q_b: { type: 'number', prompt: 'Prompt B' },
        },
      },
    };

    expect(readUserPageDirectNetworkCacheBucket(surveysCache, 84532)).toBe(surveysCache[84532]);
    expect(readUserPageDirectNetworkCacheBucket(surveysCache, '')).toEqual({});
    expect(
      buildUserPageAnalysisCreatedQuestions([{ id: 'q1', type: 'text', prompt: 'Question one', ignored: true }]),
    ).toEqual([{ id: 'q1', type: 'text', prompt: 'Question one' }]);
    expect(
      buildUserPageAnalysisCreatedSurveys({
        networkID: 84532,
        questionsCache,
        surveyCreationInfo: [{ id: 'survey_a', title: 'Survey A', questionsCount: 3 }],
        surveysCache,
      }),
    ).toEqual([
      {
        surveyId: 'survey_a',
        title: 'Survey A',
        questionsCount: 3,
        sampleQuestions: [
          { id: 'q_a', type: 'text', prompt: 'Prompt A' },
          { id: 'q_b', type: 'number', prompt: 'Prompt B' },
          { id: 'q_missing' },
        ],
      },
    ]);
  });

  it('builds analysis SBT section and response inputs', () => {
    expect(
      buildUserPageAnalysisSbts({
        getSbtDisplayName: (sbtInfo) => (sbtInfo as any)?.title,
        sbtList: [{ sbtInfo: { title: 'Alpha Badge', sbtAddress: '0xA' } }, { name: 'Missing Address', sbtInfo: {} }],
      }),
    ).toEqual([{ name: 'Alpha Badge', address: '0xA' }]);

    const derivedSbtSection = buildUserPageSbtSection({
      aggregate: {
        sbtAggregate: {
          '0xBadgeA': {
            mintedSet: new Set(['0xviewer']),
            burnedSet: new Set(),
            sbtAddress: '0xBadgeA',
            sbtInfo: { title: 'Alpha Badge' },
            slug: 'alpha',
          },
          '0xBadgeB': {
            mintedSet: new Set(['0xviewer']),
            burnedSet: new Set(),
            sbtAddress: '0x1234567890abcdef',
            sbtInfo: {},
            slug: 'beta',
          },
          '0xBadgeC': {
            mintedSet: new Set(['0xviewer']),
            burnedSet: new Set(['0xviewer']),
            sbtInfo: { title: 'Burned Badge' },
          },
          '0xBadgeD': {
            mintedSet: new Set(['0xviewer']),
            burnedSet: new Set(),
            sbtInfo: { title: 'Hidden Badge', unlisted: true },
          },
        },
      },
      getSbtDisplayName: (sbtInfo) => (sbtInfo as any)?.title,
      getShortenedAddress: (address) => `short:${address}`,
      translate: () => 'Badge',
      viewAddressLower: '0xviewer',
    });

    expect(derivedSbtSection.sbtList).toEqual([
      {
        sbtInfo: {
          title: 'Alpha Badge',
          name: 'Alpha Badge',
          sbtAddress: '0xBadgeA',
        },
        slug: 'alpha',
      },
      {
        sbtInfo: {
          name: 'Badge short:0x1234567890abcdef',
          sbtAddress: '0x1234567890abcdef',
        },
        slug: 'beta',
      },
    ]);
    expect(derivedSbtSection.telemetry).toEqual({
      signature: '0xviewer|4|3|2',
      payload: {
        viewAddress: '0xviewer',
        aggregateSbtAddresses: 4,
        heldAggregateSbtCount: 3,
        derivedSbtCount: 2,
        derivedSbtSample: ['0xbadgea', '0x1234567890abcdef'],
      },
    });
    expect(
      buildUserPageSbtSection({
        aggregate: { sbtAggregate: {} },
        viewAddressLower: '0xviewer',
      }).telemetry,
    ).toBeNull();

    expect(
      buildUserPageAnalysisQuestions({
        detailedQuestionResponses: {
          q1: {
            answer: { value: ['yes'] },
            additionalComments: 'Useful context',
            importance: { value: 'high' },
          },
          q2: { answer: { value: '*' } },
        },
        questionResponseInfo: [
          { id: 'q1', type: 'multi', prompt: 'Question one' },
          { id: 'q2', type: 'text', prompt: 'Encrypted' },
        ],
      }),
    ).toEqual([
      {
        id: 'q1',
        type: 'multi',
        prompt: 'Question one',
        answer: ['yes'],
        importance: { value: 'high' },
        additionalComment: 'Useful context',
      },
    ]);

    expect(
      buildUserPageAnalysisSurveys({
        detailedSurveyResponses: {
          s1: [
            {
              questionData: { prompt: 'Prompt one', type: 'text' },
              responseData: {
                answer: { value: 'answer one' },
                additionalComment: { value: 'Survey note' },
              },
            },
            {
              questionData: { prompt: 'Hidden prompt' },
              responseData: { answer: { value: '*' } },
            },
          ],
        },
        surveyResponseInfo: [{ id: 's1', title: 'Survey one' }],
      }),
    ).toEqual([
      {
        surveyId: 's1',
        title: 'Survey one',
        answeredCount: 1,
        sample: [
          {
            prompt: 'Prompt one',
            type: 'text',
            answer: 'answer one',
            importance: undefined,
            additionalComment: 'Survey note',
          },
        ],
        additionalCommentsSample: ['Survey note'],
      },
    ]);
  });
});
