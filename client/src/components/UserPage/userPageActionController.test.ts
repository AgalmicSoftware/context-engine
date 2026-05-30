import {
  runUserPageAnalyzeActionController,
  type UserPageAnalyzeActionControllerPorts,
} from './userPageActionController';

describe('userPageActionController', () => {
  it('does not dispatch hidden, blocked, disabled, or unhandled analyze actions', () => {
    const dispatchAnalyze = jest.fn();

    expect(runUserPageAnalyzeActionController({
      plan: {
        blockedReason: 'minimized',
        shouldRenderAnalyzeAction: false,
      },
      ports: { dispatchAnalyze },
    })).toEqual({
      blockedReason: 'minimized',
      status: 'hidden',
    });
    expect(runUserPageAnalyzeActionController({
      plan: {
        blockedReason: 'ai-unavailable',
        shouldRenderAnalyzeAction: true,
      },
      ports: { dispatchAnalyze },
    })).toEqual({
      blockedReason: 'ai-unavailable',
      status: 'blocked',
    });
    expect(runUserPageAnalyzeActionController({
      plan: {
        blockedReason: 'none',
        disabled: true,
        shouldRenderAnalyzeAction: true,
      },
      ports: { dispatchAnalyze },
    })).toEqual({
      blockedReason: 'none',
      status: 'disabled',
    });
    expect(runUserPageAnalyzeActionController({
      plan: {
        blockedReason: 'none',
        shouldRenderAnalyzeAction: true,
      },
      ports: {},
    })).toEqual({
      blockedReason: 'none',
      status: 'unhandled',
    });

    expect(dispatchAnalyze).not.toHaveBeenCalled();
  });

  it('dispatches analyze through the injected port with preserved args', () => {
    const dispatchAnalyze = jest.fn() satisfies UserPageAnalyzeActionControllerPorts<[
      { type: string },
    ]>['dispatchAnalyze'];
    const event = { preventDefault: jest.fn(), type: 'click' };

    expect(runUserPageAnalyzeActionController({
      analyzeArgs: [event],
      event,
      plan: {
        blockedReason: 'none',
        disabled: false,
        shouldRenderAnalyzeAction: true,
      },
      ports: { dispatchAnalyze },
    })).toEqual({
      blockedReason: 'none',
      status: 'dispatched',
    });

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(dispatchAnalyze).toHaveBeenCalledTimes(1);
    expect(dispatchAnalyze).toHaveBeenCalledWith(event);
  });
});
