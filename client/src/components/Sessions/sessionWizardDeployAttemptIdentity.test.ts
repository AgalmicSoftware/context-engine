import {
  advanceSessionWizardDeployAttemptGeneration,
  isStructuredSessionWizardDeployAttemptConflict,
  markSessionWizardDeployAttemptCompleted,
  resolveSessionWizardDeployAttemptIdentity,
  shouldRetainSessionWizardDeployAttemptIdentity,
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

  it('classifies deploy-helper retry outcomes without rotating ambiguous attempts', () => {
    expect(shouldRetainSessionWizardDeployAttemptIdentity(202, { deploymentRequestPending: true })).toBe(true);
    expect(shouldRetainSessionWizardDeployAttemptIdentity(409, { deploymentRequestConflict: true })).toBe(true);
    expect(shouldRetainSessionWizardDeployAttemptIdentity(409, { deploymentRequestIdConflict: true })).toBe(true);
    expect(
      shouldRetainSessionWizardDeployAttemptIdentity(409, {
        error: 'deploymentRequestId was already used with a different request payload.',
      }),
    ).toBe(true);
    expect(shouldRetainSessionWizardDeployAttemptIdentity(503, {})).toBe(true);

    const terminalConflict = {
      deploymentRequestConflict: true,
      deploymentRequestTerminal: true,
    };
    expect(isStructuredSessionWizardDeployAttemptConflict(terminalConflict)).toBe(true);
    expect(shouldRetainSessionWizardDeployAttemptIdentity(409, terminalConflict)).toBe(false);
    expect(shouldRetainSessionWizardDeployAttemptIdentity(409, { orphanResources: { worker: 'orphaned' } })).toBe(
      false,
    );
  });

  it('converges independent callers on one persisted non-secret identity', () => {
    const first = resolveSessionWizardDeployAttemptIdentity({ scope, storage: localStorage });
    const second = resolveSessionWizardDeployAttemptIdentity({ scope, storage: localStorage });

    expect(second).toEqual(first);
    expect(JSON.stringify(localStorage)).not.toContain('cf-secret-token');
    expect(localStorage.getItem(first.storageKey)).toBe('{"version":1,"generation":0,"status":"active"}');
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

  it('advances after a terminal failure outcome', () => {
    const first = resolveSessionWizardDeployAttemptIdentity({ scope, storage: localStorage });
    expect(advanceSessionWizardDeployAttemptGeneration(first, { storage: localStorage })).toBe(true);

    const next = resolveSessionWizardDeployAttemptIdentity({ scope, storage: localStorage });
    expect(next.generation).toBe(1);
    expect(next.deploymentRequestId).not.toBe(first.deploymentRequestId);
    expect(next.configRevision).not.toBe(first.configRevision);
    expect(next.status).toBe('active');
  });

  it('keeps a successful generation terminal when a stale peer tab later tries to advance it', () => {
    const firstTab = resolveSessionWizardDeployAttemptIdentity({ scope, storage: localStorage });
    const stalePeerTab = resolveSessionWizardDeployAttemptIdentity({ scope, storage: localStorage });

    expect(markSessionWizardDeployAttemptCompleted(firstTab, { storage: localStorage })).toBe(true);
    expect(advanceSessionWizardDeployAttemptGeneration(stalePeerTab, { storage: localStorage })).toBe(true);

    const reloaded = resolveSessionWizardDeployAttemptIdentity({ scope, storage: localStorage });
    expect(reloaded).toEqual(expect.objectContaining({ generation: 0, status: 'completed' }));
    expect(reloaded.deploymentRequestId).toBe(firstTab.deploymentRequestId);
    expect(reloaded.configRevision).toBe(firstTab.configRevision);
    expect(localStorage.getItem(reloaded.storageKey)).toBe('{"version":1,"generation":0,"status":"completed"}');
  });

  it('keeps a newer active generation when an older success finishes late', () => {
    const firstAttempt = resolveSessionWizardDeployAttemptIdentity({ scope, storage: localStorage });
    expect(advanceSessionWizardDeployAttemptGeneration(firstAttempt, { storage: localStorage })).toBe(true);
    const nextAttempt = resolveSessionWizardDeployAttemptIdentity({ scope, storage: localStorage });

    expect(markSessionWizardDeployAttemptCompleted(firstAttempt, { storage: localStorage })).toBe(true);
    expect(resolveSessionWizardDeployAttemptIdentity({ scope, storage: localStorage })).toEqual(
      expect.objectContaining({ generation: 1, status: 'active' }),
    );

    expect(markSessionWizardDeployAttemptCompleted(nextAttempt, { storage: localStorage })).toBe(true);
    expect(resolveSessionWizardDeployAttemptIdentity({ scope, storage: localStorage })).toEqual(
      expect.objectContaining({ generation: 1, status: 'completed' }),
    );
  });

  it('keeps a newer completed generation when an older success is replayed', () => {
    const firstAttempt = resolveSessionWizardDeployAttemptIdentity({ scope, storage: localStorage });
    expect(advanceSessionWizardDeployAttemptGeneration(firstAttempt, { storage: localStorage })).toBe(true);
    const nextAttempt = resolveSessionWizardDeployAttemptIdentity({ scope, storage: localStorage });
    expect(markSessionWizardDeployAttemptCompleted(nextAttempt, { storage: localStorage })).toBe(true);

    expect(markSessionWizardDeployAttemptCompleted(firstAttempt, { storage: localStorage })).toBe(true);
    expect(resolveSessionWizardDeployAttemptIdentity({ scope, storage: localStorage })).toEqual(
      expect.objectContaining({ generation: 1, status: 'completed' }),
    );
  });

  it('idempotently completes the current generation', () => {
    const currentAttempt = resolveSessionWizardDeployAttemptIdentity({ scope, storage: localStorage });

    expect(markSessionWizardDeployAttemptCompleted(currentAttempt, { storage: localStorage })).toBe(true);
    expect(markSessionWizardDeployAttemptCompleted(currentAttempt, { storage: localStorage })).toBe(true);
    expect(localStorage.getItem(currentAttempt.storageKey)).toBe('{"version":1,"generation":0,"status":"completed"}');
  });

  it('lets a newer identity repair an older completed record', () => {
    const firstAttempt = resolveSessionWizardDeployAttemptIdentity({ scope, storage: localStorage });
    expect(advanceSessionWizardDeployAttemptGeneration(firstAttempt, { storage: localStorage })).toBe(true);
    const nextAttempt = resolveSessionWizardDeployAttemptIdentity({ scope, storage: localStorage });
    // Model a stale peer write from an older client after this tab already captured generation 1.
    localStorage.setItem(nextAttempt.storageKey, '{"version":1,"generation":0,"status":"completed"}');

    expect(markSessionWizardDeployAttemptCompleted(nextAttempt, { storage: localStorage })).toBe(true);
    expect(resolveSessionWizardDeployAttemptIdentity({ scope, storage: localStorage })).toEqual(
      expect.objectContaining({ generation: 1, status: 'completed' }),
    );
  });

  it('advances a completed generation only with explicit terminal-conflict authority', () => {
    const completed = resolveSessionWizardDeployAttemptIdentity({ scope, storage: localStorage });
    expect(markSessionWizardDeployAttemptCompleted(completed, { storage: localStorage })).toBe(true);

    expect(advanceSessionWizardDeployAttemptGeneration(completed, { storage: localStorage })).toBe(true);
    expect(resolveSessionWizardDeployAttemptIdentity({ scope, storage: localStorage })).toEqual(
      expect.objectContaining({ generation: 0, status: 'completed' }),
    );

    expect(
      advanceSessionWizardDeployAttemptGeneration(completed, {
        storage: localStorage,
        allowCompletedTerminalConflict: true,
      }),
    ).toBe(true);
    const next = resolveSessionWizardDeployAttemptIdentity({ scope, storage: localStorage });
    expect(next).toEqual(expect.objectContaining({ generation: 1, status: 'active' }));
    expect(next.deploymentRequestId).not.toBe(completed.deploymentRequestId);
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
