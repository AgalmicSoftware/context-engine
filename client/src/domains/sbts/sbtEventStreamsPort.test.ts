import { bindSbtEventStreamsPort } from './sbtEventStreamsPort';

describe('SbtEventStreamsPort', () => {
  it('routes listener cleanup through call-time chainGateway lookup', () => {
    const firstChainGateway = {
      removeSBTEventListener: jest.fn(() => 'first-sbt'),
      removeSurveyEventsListener: jest.fn(() => 'first-survey'),
      removeSBTInstanceEventsListener: jest.fn(() => 'first-instance'),
    };
    const secondChainGateway = {
      removeSBTEventListener: jest.fn(() => 'second-sbt'),
      removeSurveyEventsListener: jest.fn(() => 'second-survey'),
      removeSBTInstanceEventsListener: jest.fn(() => 'second-instance'),
    };
    let currentChainGateway = firstChainGateway;
    const port = bindSbtEventStreamsPort({
      chainGateway: () => currentChainGateway,
    });

    expect(port.removeSBTEventListener('none', 'alpha')).toBe('first-sbt');

    currentChainGateway = secondChainGateway;

    expect(port.removeSurveyEventsListener('none', 'beta')).toBe('second-survey');
    expect(port.removeSBTInstanceEventsListener('none', [], 'gamma')).toBe('second-instance');

    expect(firstChainGateway.removeSBTEventListener).toHaveBeenCalledWith('none', 'alpha');
    expect(secondChainGateway.removeSurveyEventsListener).toHaveBeenCalledWith('none', 'beta');
    expect(secondChainGateway.removeSBTInstanceEventsListener).toHaveBeenCalledWith('none', [], 'gamma');
  });
});
