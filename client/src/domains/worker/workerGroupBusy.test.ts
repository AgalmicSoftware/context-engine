import { isBusyWorkerGroupError } from './workerGroupBusy';

describe('isBusyWorkerGroupError', () => {
  it('names a crowded join as busy, and nothing else', () => {
    expect(isBusyWorkerGroupError(new Error('worker_group_coordination_unavailable'))).toBe(true);
    expect(isBusyWorkerGroupError(new Error('worker_group_request_failed_503'))).toBe(true);
    expect(isBusyWorkerGroupError(new Error('worker_group_member_cap_exceeded'))).toBe(false);
    expect(isBusyWorkerGroupError(new Error('worker_group_request_failed_500'))).toBe(false);
    expect(isBusyWorkerGroupError('worker_group_coordination_unavailable')).toBe(false);
  });
});
