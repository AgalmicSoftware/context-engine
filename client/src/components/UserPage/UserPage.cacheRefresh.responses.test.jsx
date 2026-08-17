import { UserPage, makeInstance, setupUserPageCacheRefreshTestLifecycle } from './UserPage.cacheRefresh.testUtils';

describe('UserPage cache refresh response hydration', () => {
  setupUserPageCacheRefreshTestLifecycle();

  it('injects creator into createdQuestions sourced from userCache', () => {
    const viewAddress = '0x00000000000000000000000000000000000000bb';
    const networkID = '84532';
    const instance = makeInstance({ viewAddress });

    const dataByNamespace = {
      surveysCache: [],
      sbtCache: [],
      questionsCache: [],
      userCache: [
        {
          slug: 'edge',
          data: {
            [viewAddress.toLowerCase()]: {
              [networkID]: {
                data: {
                  createdQuestions: [
                    {
                      id: 'q-cache-only',
                      data: {
                        id: 'q-cache-only',
                        prompt: 'Who goes there?',
                        type: 'freeform',
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      ],
    };

    instance._dgHasAny = jest.fn(() => true);
    instance._dgReadAll = jest.fn((name) => dataByNamespace[name] || []);

    instance._refreshAllDataFromCache({ force: true, markLoading: true });

    expect(instance.state.questionCreationInfo).toHaveLength(1);
    expect(instance.state.questionCreationInfo[0].prompt).toBe('Who goes there?');
  });

  it('does not mutate cached survey or question records when creator metadata is inferred', () => {
    const viewAddress = '0x00000000000000000000000000000000000000bb';
    const networkID = '84532';
    const instance = makeInstance({ viewAddress });
    const cachedSurvey = { id: 's-cache-only', title: 'Cached survey', questionIDs: [] };
    const cachedQuestion = { id: 'q-cache-only', prompt: 'Cached question', type: 'freeform' };

    const dataByNamespace = {
      surveysCache: [],
      sbtCache: [],
      questionsCache: [],
      userCache: [
        {
          slug: 'edge',
          data: {
            [viewAddress.toLowerCase()]: {
              [networkID]: {
                data: {
                  createdSurveys: [{ id: cachedSurvey.id, data: cachedSurvey }],
                  createdQuestions: [{ id: cachedQuestion.id, data: cachedQuestion }],
                },
              },
            },
          },
        },
      ],
    };

    instance._dgHasAny = jest.fn(() => true);
    instance._dgReadAll = jest.fn((name) => dataByNamespace[name] || []);

    instance._refreshAllDataFromCache({ force: true, markLoading: true });

    expect(instance.state.surveyCreationInfo).toHaveLength(1);
    expect(instance.state.questionCreationInfo).toHaveLength(1);
    expect(cachedSurvey).not.toHaveProperty('creator');
    expect(cachedQuestion).not.toHaveProperty('creator');
  });

  it('preserves source session slugs for profile question cards', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const viewLower = viewAddress.toLowerCase();
    const networkID = '84532';
    const instance = makeInstance({
      viewAddress,
      activeSessionSlug: 'demo',
    });

    const dataByNamespace = {
      surveysCache: [],
      sbtCache: [],
      userCache: [],
      questionsCache: [
        {
          slug: 'demo',
          data: {
            [networkID]: {
              questions: {
                q1: {
                  id: 'q1',
                  creator: viewAddress,
                  prompt: 'Question tied to demo-4',
                  sessionName: 'demo-4',
                  type: 'freeform',
                },
              },
              questionResponses: {
                q1: {
                  [viewLower]: JSON.stringify({
                    answer: { value: 'Visible answer' },
                  }),
                },
              },
            },
          },
        },
      ],
    };

    instance._dgHasAny = jest.fn(() => true);
    instance._dgReadAll = jest.fn((name) => dataByNamespace[name] || []);

    instance._refreshAllDataFromCache({ force: true, markLoading: true });

    expect(instance.state.questionCreationInfo[0]).toEqual(
      expect.objectContaining({
        id: 'q1',
        sessionSlug: 'demo-4',
        slug: 'demo-4',
      }),
    );
    expect(instance.state.questionResponseInfo[0]).toEqual(
      expect.objectContaining({
        id: 'q1',
        sessionSlug: 'demo-4',
        slug: 'demo-4',
      }),
    );
  });

  it('shows question responses even when question metadata has not been cached yet', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const networkID = '84532';
    const instance = makeInstance({ viewAddress });

    const dataByNamespace = {
      surveysCache: [],
      sbtCache: [],
      userCache: [
        {
          slug: 'edge',
          data: {
            [viewAddress.toLowerCase()]: {
              [networkID]: {
                lastBlockScanned: 120,
                data: {
                  createdSurveys: [],
                  createdQuestions: [],
                  surveyResponses: [],
                  questionResponses: [
                    {
                      questionId: 'q-missing',
                      responder: viewAddress.toLowerCase(),
                      response: JSON.stringify({ answer: { value: 'visible response' } }),
                    },
                  ],
                },
              },
            },
          },
        },
      ],
      questionsCache: [],
    };

    instance._dgHasAny = jest.fn(() => true);
    instance._dgReadAll = jest.fn((name) => dataByNamespace[name] || []);

    instance._refreshAllDataFromCache({ force: true, markLoading: true });

    expect(instance.state.questionResponseInfo).toHaveLength(1);
    expect(instance.state.questionResponseInfo[0].id).toBe('q-missing');
    expect(instance.state.questionResponseInfo[0].prompt).toBe('Unknown Prompt');
  });

  it('shows survey responses with fallback metadata when survey metadata is not cached yet', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const viewLower = viewAddress.toLowerCase();
    const networkID = '84532';
    const instance = makeInstance({ viewAddress });

    const dataByNamespace = {
      surveysCache: [],
      sbtCache: [],
      questionsCache: [],
      userCache: [
        {
          slug: 'edge',
          data: {
            [viewLower]: {
              [networkID]: {
                lastBlockScanned: 120,
                data: {
                  createdSurveys: [],
                  createdQuestions: [],
                  questionResponses: [],
                  surveyResponses: [
                    {
                      surveyId: 's-missing',
                      responder: viewLower,
                      response: JSON.stringify({
                        responses: [{ questionID: 'q1', answer: { value: 'visible response' } }],
                      }),
                    },
                  ],
                },
              },
            },
          },
        },
      ],
    };

    instance._dgHasAny = jest.fn(() => true);
    instance._dgReadAll = jest.fn((name) => dataByNamespace[name] || []);

    instance._refreshAllDataFromCache({ force: true, markLoading: true });

    expect(instance.state.surveyResponseInfo).toHaveLength(1);
    expect(instance.state.surveyResponseInfo[0].id).toBe('s-missing');
    expect(instance.state.surveyResponseInfo[0].title).toBe('Untitled Survey');
    expect(instance.state.surveyResponseInfo[0].questionsCount).toBe(1);
  });

  it('prefers questionsCache responder payload over stale userCache fallback values', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const networkID = '84532';
    const instance = makeInstance({ viewAddress });

    const dataByNamespace = {
      surveysCache: [],
      sbtCache: [],
      questionsCache: [
        {
          slug: 'edge',
          data: {
            [networkID]: {
              questions: {
                q1: {
                  id: 'q1',
                  prompt: 'Question 1',
                  type: 'freeform',
                },
              },
              questionResponses: {
                q1: {
                  [viewAddress.toLowerCase()]: JSON.stringify({ answer: { value: 'fresh cache value' } }),
                },
              },
            },
          },
        },
      ],
      userCache: [
        {
          slug: 'edge',
          data: {
            [viewAddress.toLowerCase()]: {
              [networkID]: {
                lastBlockScanned: 120,
                data: {
                  createdSurveys: [],
                  createdQuestions: [],
                  surveyResponses: [],
                  questionResponses: [
                    {
                      questionId: 'q1',
                      responder: viewAddress.toLowerCase(),
                      response: JSON.stringify({ answer: { value: '' } }),
                    },
                  ],
                },
              },
            },
          },
        },
      ],
    };

    instance._dgHasAny = jest.fn(() => true);
    instance._dgReadAll = jest.fn((name) => dataByNamespace[name] || []);

    instance._refreshAllDataFromCache({ force: true, markLoading: true });

    expect(instance.state.questionResponseInfo).toHaveLength(1);
    expect(instance.state.detailedQuestionResponses.q1.answer.value).toBe('fresh cache value');
  });

  it('prefers fresher survey responses from userCache over stale surveysCache payloads', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const viewLower = viewAddress.toLowerCase();
    const networkID = '84532';
    const instance = makeInstance({ viewAddress });

    const dataByNamespace = {
      surveysCache: [
        {
          slug: 'stale',
          data: {
            [networkID]: {
              surveys: {
                s1: {
                  id: 's1',
                  title: 'Survey 1',
                  creator: viewAddress,
                  questionIDs: ['q1'],
                },
              },
              surveyResponses: {
                s1: {
                  [viewLower]: JSON.stringify({
                    responses: [{ questionID: 'q1', answer: { value: '' } }],
                  }),
                },
              },
            },
          },
        },
      ],
      questionsCache: [
        {
          slug: 'fresh',
          data: {
            [networkID]: {
              questions: {
                q1: {
                  id: 'q1',
                  prompt: 'Question 1',
                  type: 'freeform',
                },
              },
            },
          },
        },
      ],
      sbtCache: [],
      userCache: [
        {
          slug: 'fresh',
          data: {
            [viewLower]: {
              [networkID]: {
                lastBlockScanned: 120,
                data: {
                  createdSurveys: [],
                  createdQuestions: [],
                  questionResponses: [],
                  surveyResponses: [
                    {
                      surveyId: 's1',
                      responder: viewLower,
                      blockNumber: 100,
                      response: {
                        responses: [{ questionID: 'q1', answer: { value: 'fresh survey payload' } }],
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      ],
    };

    instance._dgHasAny = jest.fn(() => true);
    instance._dgReadAll = jest.fn((name) => dataByNamespace[name] || []);

    instance._refreshAllDataFromCache({ force: true, markLoading: true });

    expect(instance.state.surveyResponseInfo).toHaveLength(1);
    expect(instance.state.surveyResponseInfo[0].slug).toBe('fresh');
    expect(instance.state.detailedSurveyResponses.s1[0].responseData.answer.value).toBe('fresh survey payload');
  });

  it('prefers the latest response using transaction-index recency when caches disagree', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const networkID = '84532';
    const instance = makeInstance({ viewAddress });

    const dataByNamespace = {
      surveysCache: [],
      sbtCache: [],
      questionsCache: [
        {
          slug: 'edge',
          data: {
            [networkID]: {
              questions: {
                q1: {
                  id: 'q1',
                  prompt: 'Question 1',
                  type: 'freeform',
                },
              },
              questionResponses: {
                q1: {
                  [viewAddress.toLowerCase()]: JSON.stringify({ answer: { value: 'older cache payload' } }),
                },
              },
              questionResponsesMeta: {
                q1: {
                  [viewAddress.toLowerCase()]: { bn: 10, txi: 1, li: 5, ts: 0 },
                },
              },
            },
          },
        },
      ],
      userCache: [
        {
          slug: 'edge',
          data: {
            [viewAddress.toLowerCase()]: {
              [networkID]: {
                lastBlockScanned: 120,
                data: {
                  createdSurveys: [],
                  createdQuestions: [],
                  surveyResponses: [],
                  questionResponses: [
                    {
                      questionId: 'q1',
                      responder: viewAddress.toLowerCase(),
                      response: JSON.stringify({ answer: { value: 'newer user-cache payload' } }),
                      blockNumber: 10,
                      transactionIndex: 2,
                      logIndex: 0,
                    },
                  ],
                },
              },
            },
          },
        },
      ],
    };

    instance._dgHasAny = jest.fn(() => true);
    instance._dgReadAll = jest.fn((name) => dataByNamespace[name] || []);

    instance._refreshAllDataFromCache({ force: true, markLoading: true });

    expect(instance.state.questionResponseInfo).toHaveLength(1);
    expect(instance.state.detailedQuestionResponses.q1.answer.value).toBe('newer user-cache payload');
  });

  it('keeps malformed non-JSON response payloads visible instead of dropping them', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const networkID = '84532';
    const instance = makeInstance({ viewAddress });

    const dataByNamespace = {
      surveysCache: [],
      sbtCache: [],
      userCache: [],
      questionsCache: [
        {
          slug: 'edge',
          data: {
            [networkID]: {
              questions: {
                qbad: {
                  id: 'qbad',
                  prompt: 'Malformed payload prompt',
                  type: 'freeform',
                },
              },
              questionResponses: {
                qbad: {
                  [viewAddress.toLowerCase()]: 'not-json-payload',
                },
              },
            },
          },
        },
      ],
    };

    instance._dgHasAny = jest.fn(() => true);
    instance._dgReadAll = jest.fn((name) => dataByNamespace[name] || []);

    instance._refreshAllDataFromCache({ force: true, markLoading: true });

    expect(instance.state.questionResponseInfo).toHaveLength(1);
    expect(instance.state.detailedQuestionResponses.qbad.answer.value).toBe('not-json-payload');
  });

  it('normalizes legacy question response payloads that use top-level value fields', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const networkID = '84532';
    const instance = makeInstance({ viewAddress });

    const dataByNamespace = {
      surveysCache: [],
      sbtCache: [],
      userCache: [],
      questionsCache: [
        {
          slug: 'edge',
          data: {
            [networkID]: {
              questions: {
                qlegacy: {
                  id: 'qlegacy',
                  prompt: 'Legacy prompt',
                  type: 'freeform',
                },
              },
              questionResponses: {
                qlegacy: {
                  [viewAddress.toLowerCase()]: JSON.stringify({
                    type: 'freeform',
                    value: 'legacy plain answer',
                  }),
                },
              },
            },
          },
        },
      ],
    };

    instance._dgHasAny = jest.fn(() => true);
    instance._dgReadAll = jest.fn((name) => dataByNamespace[name] || []);

    instance._refreshAllDataFromCache({ force: true, markLoading: true });

    expect(instance.state.questionResponseInfo).toHaveLength(1);
    expect(instance.state.questionResponseInfo[0].id).toBe('qlegacy');
    expect(instance.state.detailedQuestionResponses.qlegacy.answer.value).toBe('legacy plain answer');
  });

  it('keeps additional-comment-only responses visible after payload normalization', () => {
    const viewAddress = '0x00000000000000000000000000000000000000aa';
    const networkID = '84532';
    const instance = makeInstance({ viewAddress });

    const dataByNamespace = {
      surveysCache: [],
      sbtCache: [],
      userCache: [],
      questionsCache: [
        {
          slug: 'edge',
          data: {
            [networkID]: {
              questions: {
                qextra: {
                  id: 'qextra',
                  prompt: 'Extra comments prompt',
                  type: 'freeform',
                },
              },
              questionResponses: {
                qextra: {
                  [viewAddress.toLowerCase()]: JSON.stringify({
                    answer: { value: '' },
                    additionalComment: 'I only left extra context.',
                  }),
                },
              },
            },
          },
        },
      ],
    };

    instance._dgHasAny = jest.fn(() => true);
    instance._dgReadAll = jest.fn((name) => dataByNamespace[name] || []);

    instance._refreshAllDataFromCache({ force: true, markLoading: true });

    expect(instance.state.questionResponseInfo).toHaveLength(1);
    expect(instance.state.detailedQuestionResponses.qextra.additional.value).toBe('I only left extra context.');
  });
});
