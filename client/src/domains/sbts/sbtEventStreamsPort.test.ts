import chainGateway from '../../utilities/web3/chainGateway.js';
import { sbtEventStreamsPort } from './sbtEventStreamsPort';

describe('SbtEventStreamsPort', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('routes listener cleanup through call-time chainGateway property lookup', () => {
    const removeSBTEventListener = jest.spyOn(chainGateway, 'removeSBTEventListener').mockReturnValue('first-sbt');
    const removeSurveyEventsListener = jest
      .spyOn(chainGateway, 'removeSurveyEventsListener')
      .mockReturnValue('second-survey');
    const removeSBTInstanceEventsListener = jest
      .spyOn(chainGateway, 'removeSBTInstanceEventsListener')
      .mockReturnValue('second-instance');

    expect(sbtEventStreamsPort.removeSBTEventListener('none', 'alpha')).toBe('first-sbt');
    expect(sbtEventStreamsPort.removeSurveyEventsListener('none', 'beta')).toBe('second-survey');
    expect(sbtEventStreamsPort.removeSBTInstanceEventsListener('none', [], 'gamma')).toBe('second-instance');

    expect(removeSBTEventListener).toHaveBeenCalledWith('none', 'alpha');
    expect(removeSurveyEventsListener).toHaveBeenCalledWith('none', 'beta');
    expect(removeSBTInstanceEventsListener).toHaveBeenCalledWith('none', [], 'gamma');
  });
});
