import {
  WORKER_GROUPS_CHANGED_EVENT,
  dispatchWorkerGroupsChanged,
  subscribeWorkerGroupsChanged,
} from './workerGroupChangeEvents';

describe('workerGroupChangeEvents', () => {
  it('normalizes and publishes exact Worker session identity', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeWorkerGroupsChanged(listener);

    expect(
      dispatchWorkerGroupsChanged({
        sessionSlug: ' demo-sh ',
        sessionId: '11111111111111111111111111111111',
      }),
    ).toEqual({
      sessionSlug: 'demo-sh',
      sessionId: '0x11111111111111111111111111111111',
    });
    expect(listener).toHaveBeenCalledWith({
      sessionSlug: 'demo-sh',
      sessionId: '0x11111111111111111111111111111111',
    });

    unsubscribe();
    window.dispatchEvent(
      new CustomEvent(WORKER_GROUPS_CHANGED_EVENT, {
        detail: { sessionSlug: 'demo-sh', sessionId: '0x11111111111111111111111111111111' },
      }),
    );
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('does not publish an incomplete session identity', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeWorkerGroupsChanged(listener);

    expect(dispatchWorkerGroupsChanged({ sessionSlug: 'demo-sh', sessionId: '' })).toBeNull();
    window.dispatchEvent(
      new CustomEvent(WORKER_GROUPS_CHANGED_EVENT, {
        detail: { sessionSlug: '', sessionId: '0x11111111111111111111111111111111' },
      }),
    );

    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });
});
