import {
  advanceSessionWizardDeployAttemptGeneration,
  clearSessionWizardDeployAttemptIdentity,
  resolveSessionWizardDeployAttemptIdentity,
} from './sessionWizardDeployAttemptIdentity';

const scope = {
  slug: 'writers-room',
  sessionId: '0x00000000000000000000000000000001',
  workerName: 'writers-room-worker',
  adminAddress: '0x00000000000000000000000000000000000000aa',
  deployTarget: 'https://deploy-helper.example.test',
};

describe('sessionWizardDeployAttemptIdentity', () => {
  beforeEach(() => localStorage.clear());

  it('converges independent callers on one persisted non-secret identity', () => {
    const first = resolveSessionWizardDeployAttemptIdentity({ scope, storage: localStorage });
    const second = resolveSessionWizardDeployAttemptIdentity({ scope, storage: localStorage });

    expect(second).toEqual(first);
    expect(JSON.stringify(localStorage)).not.toContain('cf-secret-token');
    expect(localStorage.getItem(first.storageKey)).toBe('{"version":1,"generation":0}');
  });

  it('isolates unrelated draft and worker scopes', () => {
    const first = resolveSessionWizardDeployAttemptIdentity({ scope, storage: localStorage });
    const otherSession = resolveSessionWizardDeployAttemptIdentity({
      scope: { ...scope, sessionId: '0x00000000000000000000000000000002' },
      storage: localStorage,
    });
    const otherWorker = resolveSessionWizardDeployAttemptIdentity({
      scope: { ...scope, workerName: 'another-worker' },
      storage: localStorage,
    });

    expect(otherSession.deploymentRequestId).not.toBe(first.deploymentRequestId);
    expect(otherWorker.deploymentRequestId).not.toBe(first.deploymentRequestId);
  });

  it('advances after a terminal outcome and clears only the completed generation', () => {
    const first = resolveSessionWizardDeployAttemptIdentity({ scope, storage: localStorage });
    expect(advanceSessionWizardDeployAttemptGeneration(first, { storage: localStorage })).toBe(true);

    const next = resolveSessionWizardDeployAttemptIdentity({ scope, storage: localStorage });
    expect(next.generation).toBe(1);
    expect(next.deploymentRequestId).not.toBe(first.deploymentRequestId);
    expect(next.configRevision).not.toBe(first.configRevision);
    expect(clearSessionWizardDeployAttemptIdentity(first, { storage: localStorage })).toBe(true);
    expect(resolveSessionWizardDeployAttemptIdentity({ scope, storage: localStorage })).toEqual(next);
    expect(clearSessionWizardDeployAttemptIdentity(next, { storage: localStorage })).toBe(true);
    expect(localStorage.getItem(next.storageKey)).toBeNull();
  });

  it('fails closed when the generation cannot be persisted', () => {
    const storage = {
      getItem: jest.fn(() => null),
      setItem: jest.fn(() => {
        throw new Error('storage denied');
      }),
      removeItem: jest.fn(),
    };

    expect(() => resolveSessionWizardDeployAttemptIdentity({ scope, storage })).toThrow(
      'Durable browser storage is required for safe worker deployment retries.',
    );
  });
});
