import { runSurveyResultsQuestionMetadataReadController } from './surveyResultsQuestionMetadataReadController';

describe('surveyResultsQuestionMetadataReadController', () => {
  it('reads network questions through the injected port with normalized identity args', () => {
    const readNetworkQuestions = jest.fn(() => ({
      q1: {
        id: 'q1',
        prompt: 'Ready prompt',
      },
    }));

    const result = runSurveyResultsQuestionMetadataReadController({
      identity: {
        activeSessionSlug: 'edge',
        currentSurveyId: '0xSURVEY',
        questionId: 'Q1',
        viewMode: 'questions',
      },
      ports: {
        readNetworkQuestions,
      },
    });

    expect(readNetworkQuestions).toHaveBeenCalledWith({
      activeSessionSlug: 'edge',
      currentSurveyId: '0xSURVEY',
      questionId: 'Q1',
      viewMode: 'questions',
    });
    expect(result).toEqual({
      identity: {
        activeSessionSlug: 'edge',
        currentSurveyId: '0xSURVEY',
        questionId: 'Q1',
        viewMode: 'questions',
      },
      metadataStatus: 'ready',
      networkQuestions: {
        q1: {
          id: 'q1',
          prompt: 'Ready prompt',
        },
      },
      question: {
        id: 'q1',
        prompt: 'Ready prompt',
      },
      selectedNetworkQuestions: {
        q1: {
          id: 'q1',
          prompt: 'Ready prompt',
        },
      },
      statePatch: {},
    });
  });

  it('uses preloaded render cache without calling the read port', () => {
    const readNetworkQuestions = jest.fn();
    const preloaded = {
      q2: {
        id: 'q2',
        prompt: 'Preloaded prompt',
      },
    };

    const result = runSurveyResultsQuestionMetadataReadController({
      identity: {
        questionId: 'Q2',
      },
      ports: {
        readNetworkQuestions,
      },
      preloadedNetworkQuestions: preloaded,
    });

    expect(readNetworkQuestions).not.toHaveBeenCalled();
    expect(result.metadataStatus).toBe('ready');
    expect(result.networkQuestions).toBe(preloaded);
    expect(result.question).toBe(preloaded.q2);
    expect(result.selectedNetworkQuestions).toEqual({
      q2: preloaded.q2,
    });
  });

  it('returns a missing status and empty patch for missing or empty cache results', () => {
    expect(
      runSurveyResultsQuestionMetadataReadController({
        identity: {
          questionId: 'Q-empty',
        },
        ports: {
          readNetworkQuestions: jest.fn(() => ({})),
        },
      }),
    ).toMatchObject({
      metadataStatus: 'missing',
      networkQuestions: {},
      question: null,
      selectedNetworkQuestions: {},
      statePatch: {},
    });

    expect(
      runSurveyResultsQuestionMetadataReadController({
        identity: {
          questionId: 'Q-empty',
        },
        ports: {
          readNetworkQuestions: jest.fn(() => null),
        },
      }),
    ).toMatchObject({
      metadataStatus: 'missing',
      networkQuestions: {},
      question: null,
      selectedNetworkQuestions: {},
      statePatch: {},
    });
  });

  it('reports loading status for pending metadata placeholders without hiding the cached object', () => {
    const pendingQuestion = {
      id: 'q-pending',
      prompt: '[encrypted]',
      __ceQuestionMetadataPending: true,
    };

    const result = runSurveyResultsQuestionMetadataReadController({
      identity: {
        questionId: 'Q-Pending',
      },
      preloadedNetworkQuestions: {
        'q-pending': pendingQuestion,
      },
    });

    expect(result.metadataStatus).toBe('loading');
    expect(result.question).toBe(pendingQuestion);
    expect(result.selectedNetworkQuestions).toEqual({
      'q-pending': pendingQuestion,
    });
    expect(result.statePatch).toEqual({});
  });

  it('does not call write, persistence, decrypt, export, fetch, or polling ports', () => {
    const ports = {
      readNetworkQuestions: jest.fn(() => ({})),
      writeCache: jest.fn(),
      persistCache: jest.fn(),
      decryptResponses: jest.fn(),
      exportResults: jest.fn(),
      fetchResults: jest.fn(),
      schedulePolling: jest.fn(),
    };

    runSurveyResultsQuestionMetadataReadController({
      identity: {
        questionId: 'Q1',
      },
      ports,
    });

    expect(ports.readNetworkQuestions).toHaveBeenCalledTimes(1);
    expect(ports.writeCache).not.toHaveBeenCalled();
    expect(ports.persistCache).not.toHaveBeenCalled();
    expect(ports.decryptResponses).not.toHaveBeenCalled();
    expect(ports.exportResults).not.toHaveBeenCalled();
    expect(ports.fetchResults).not.toHaveBeenCalled();
    expect(ports.schedulePolling).not.toHaveBeenCalled();
  });
});
