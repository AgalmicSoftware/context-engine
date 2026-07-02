import { bindSbtEventStreamsPort } from './contractScriptsSbtEventStreamsPort';

describe('SbtEventStreamsPort', () => {
  it('routes listener cleanup through call-time contractScripts lookup', () => {
    const firstContractScripts = {
      removeSBTEventListener: jest.fn(() => 'first-sbt'),
      removeSurveyEventsListener: jest.fn(() => 'first-survey'),
      removeSBTInstanceEventsListener: jest.fn(() => 'first-instance'),
    };
    const secondContractScripts = {
      removeSBTEventListener: jest.fn(() => 'second-sbt'),
      removeSurveyEventsListener: jest.fn(() => 'second-survey'),
      removeSBTInstanceEventsListener: jest.fn(() => 'second-instance'),
    };
    let currentContractScripts = firstContractScripts;
    const port = bindSbtEventStreamsPort({
      contractScripts: () => currentContractScripts,
    });

    expect(port.removeSBTEventListener('none', 'alpha')).toBe('first-sbt');

    currentContractScripts = secondContractScripts;

    expect(port.removeSurveyEventsListener('none', 'beta')).toBe('second-survey');
    expect(port.removeSBTInstanceEventsListener('none', [], 'gamma')).toBe('second-instance');

    expect(firstContractScripts.removeSBTEventListener).toHaveBeenCalledWith('none', 'alpha');
    expect(secondContractScripts.removeSurveyEventsListener).toHaveBeenCalledWith('none', 'beta');
    expect(secondContractScripts.removeSBTInstanceEventsListener).toHaveBeenCalledWith('none', [], 'gamma');
  });
});
