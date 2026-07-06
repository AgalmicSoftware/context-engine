import {
  bindSurveyResponseSubmitPort,
  type SurveyResponseSubmitGateway,
} from './surveyResponseSubmitPort';

describe('surveyResponseSubmitPort', () => {
  it('routes submitResponses through call-time chain gateway lookup', async () => {
    const firstGateway: SurveyResponseSubmitGateway = {
      submitResponses: jest.fn(async () => ({ transactionHash: '0xfirst' })),
    };
    const secondGateway: SurveyResponseSubmitGateway = {
      submitResponses: jest.fn(async () => ({ transactionHash: '0xsecond' })),
    };
    let currentGateway = firstGateway;
    const port = bindSurveyResponseSubmitPort({
      chainGateway: () => currentGateway,
    });

    await expect(port.submitResponses(
      'provider-a',
      ['q1'],
      [{ questionID: 'q1' }],
      'survey-a',
      { responses: [] },
      'slug-a'
    )).resolves.toEqual({ transactionHash: '0xfirst' });

    currentGateway = secondGateway;

    await expect(port.submitResponses(
      'provider-b',
      ['q2'],
      [{ questionID: 'q2' }],
      'survey-b',
      { responses: [{ questionID: 'q2' }] },
      'slug-b'
    )).resolves.toEqual({ transactionHash: '0xsecond' });

    expect(firstGateway.submitResponses).toHaveBeenCalledWith(
      'provider-a',
      ['q1'],
      [{ questionID: 'q1' }],
      'survey-a',
      { responses: [] },
      'slug-a'
    );
    expect(secondGateway.submitResponses).toHaveBeenCalledWith(
      'provider-b',
      ['q2'],
      [{ questionID: 'q2' }],
      'survey-b',
      { responses: [{ questionID: 'q2' }] },
      'slug-b'
    );
  });
});
