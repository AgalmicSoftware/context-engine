import {
  buildSessionWizardPublishPlan,
  buildSessionWizardPublishStepNumbers,
  getSessionWizardPublishProgressPercent,
  resolveSessionWizardShouldAutoDeployWorker,
} from './sessionWizardPublishFlow';

describe('sessionWizardPublishFlow', () => {
  it('auto-deploys only for sponsored custom-worker flows that are not already deployed', () => {
    expect(resolveSessionWizardShouldAutoDeployWorker({
      workerMode: 'custom',
      sponsoredAutoDeployReady: true,
      deployComplete: false,
    })).toBe(true);

    expect(resolveSessionWizardShouldAutoDeployWorker({
      workerMode: 'custom',
      sponsoredAutoDeployReady: true,
      deployComplete: true,
    })).toBe(false);

    expect(resolveSessionWizardShouldAutoDeployWorker({
      workerMode: 'default',
      sponsoredAutoDeployReady: true,
      deployComplete: false,
    })).toBe(false);
  });

  it('builds publish steps and numbered progress from the active plan', () => {
    expect(buildSessionWizardPublishPlan({
      shouldAutoDeployWorker: true,
      hasPendingDrafts: true,
      hasManualMetadata: false,
    })).toEqual([
      'deploy-worker',
      'deploy-sbts',
      'upload-metadata',
      'register-session',
      'done',
    ]);

    expect(buildSessionWizardPublishStepNumbers({
      shouldAutoDeployWorker: false,
      hasPendingDrafts: false,
      hasManualMetadata: true,
    })).toEqual({
      'register-session': 1,
      done: 2,
    });
  });

  it('fills publish progress within an active step and completes at 100 once done', () => {
    expect(getSessionWizardPublishProgressPercent({
      publishStep: 2,
      publishBusy: true,
      totalSteps: 5,
      elapsedMs: 0,
    })).toBeGreaterThan(20);

    expect(getSessionWizardPublishProgressPercent({
      publishStep: 2,
      publishBusy: true,
      totalSteps: 5,
      elapsedMs: 2600,
    })).toBeGreaterThan(35);

    expect(getSessionWizardPublishProgressPercent({
      publishStep: 5,
      publishBusy: false,
      totalSteps: 5,
      elapsedMs: 0,
    })).toBe(100);
  });
});
