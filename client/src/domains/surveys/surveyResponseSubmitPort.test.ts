import chainGateway from '../../utilities/web3/chainGateway.js';
import { surveyResponseSubmitPort } from './surveyResponseSubmitPort';

describe('surveyResponseSubmitPort', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('routes submitResponses through call-time chain gateway property lookup', async () => {
    const submitResponses = jest
      .spyOn(chainGateway, 'submitResponses')
      .mockResolvedValueOnce({ transactionHash: '0xfirst' })
      .mockResolvedValueOnce({ transactionHash: '0xsecond' });

    await expect(
      surveyResponseSubmitPort.submitResponses(
        'provider-a',
        ['q1'],
        [{ questionID: 'q1' }],
        'survey-a',
        { responses: [] },
        'slug-a',
      ),
    ).resolves.toEqual({ transactionHash: '0xfirst' });

    await expect(
      surveyResponseSubmitPort.submitResponses(
        'provider-b',
        ['q2'],
        [{ questionID: 'q2' }],
        'survey-b',
        { responses: [{ questionID: 'q2' }] },
        'slug-b',
      ),
    ).resolves.toEqual({ transactionHash: '0xsecond' });

    expect(submitResponses).toHaveBeenNthCalledWith(
      1,
      'provider-a',
      ['q1'],
      [{ questionID: 'q1' }],
      'survey-a',
      { responses: [] },
      'slug-a',
    );
    expect(submitResponses).toHaveBeenNthCalledWith(
      2,
      'provider-b',
      ['q2'],
      [{ questionID: 'q2' }],
      'survey-b',
      { responses: [{ questionID: 'q2' }] },
      'slug-b',
    );
  });
});
