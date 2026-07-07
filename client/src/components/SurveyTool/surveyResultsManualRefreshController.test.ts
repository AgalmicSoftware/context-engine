import { runSurveyResultsManualRefreshDispatchController } from './surveyResultsManualRefreshController';

describe('surveyResultsManualRefreshController', () => {
  it('dispatches question refresh ports in existing order', async () => {
    const calls: string[] = [];
    const result = await runSurveyResultsManualRefreshDispatchController({
      viewMode: 'questions',
      ports: {
        onQuestionMetadataRefreshAvailable: () => calls.push('log'),
        refreshQuestionMetadata: async () => calls.push('metadata'),
        refreshQuestionResponses: async () => calls.push('responses'),
      },
    });

    expect(calls).toEqual(['log', 'metadata', 'responses']);
    expect(result).toEqual({
      dispatched: ['questionMetadata', 'questionResponses'],
      status: 'questions',
      surveyId: '',
    });
  });

  it('lowercases survey ids before dispatching survey response refresh', async () => {
    const refreshSurveyResponsesByID = jest.fn().mockResolvedValue(undefined);

    await expect(
      runSurveyResultsManualRefreshDispatchController({
        viewMode: 'survey',
        surveyId: '0xABCDEF',
        ports: {
          refreshSurveyResponsesByID,
        },
      }),
    ).resolves.toEqual({
      dispatched: ['surveyResponses'],
      status: 'survey',
      surveyId: '0xabcdef',
    });
    expect(refreshSurveyResponsesByID).toHaveBeenCalledWith('0xabcdef');
  });

  it('stays inert when the current view has no dispatchable refresh port', async () => {
    const refreshSurveyResponsesByID = jest.fn();

    await expect(
      runSurveyResultsManualRefreshDispatchController({
        viewMode: 'survey',
        surveyId: '',
        ports: {
          refreshSurveyResponsesByID,
        },
      }),
    ).resolves.toEqual({
      dispatched: [],
      status: 'inert',
      surveyId: '',
    });
    expect(refreshSurveyResponsesByID).not.toHaveBeenCalled();

    await expect(
      runSurveyResultsManualRefreshDispatchController({
        viewMode: 'questions',
      }),
    ).resolves.toEqual({
      dispatched: [],
      status: 'inert',
      surveyId: '',
    });
  });

  it('propagates refresh port failures without calling later ports', async () => {
    const error = new Error('refresh failed');
    const refreshQuestionResponses = jest.fn();

    await expect(
      runSurveyResultsManualRefreshDispatchController({
        viewMode: 'questions',
        ports: {
          refreshQuestionMetadata: jest.fn().mockRejectedValue(error),
          refreshQuestionResponses,
        },
      }),
    ).rejects.toThrow(error);
    expect(refreshQuestionResponses).not.toHaveBeenCalled();
  });
});
