import {
  buildSessionWizardPublishPlan,
  buildSessionWizardPublishStepNumbers,
  getSessionWizardNormalModeBundleUrlOverrideValidationError,
  getSessionWizardPublishProgressPercent,
  resolveSessionWizardBundleUrlForMode,
  resolveSessionWizardSponsoredAutoDeployReadiness,
  resolveSponsoredBundleDeployReadiness,
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

  it('validates and resolves the normal-mode bundle URL without leaking stale advanced URLs', () => {
    expect(getSessionWizardNormalModeBundleUrlOverrideValidationError('http://bundle.example')).toMatch(/https:\/\//i);

    expect(resolveSessionWizardBundleUrlForMode({
      wizardMode: 'advanced',
      bundleUrl: 'https://advanced.example/bundle.js',
      normalModeBundleUrlOverride: 'https://override.example/bundle.js',
    })).toBe('https://advanced.example/bundle.js');

    expect(resolveSessionWizardBundleUrlForMode({
      wizardMode: 'normal',
      bundleUrl: 'https://advanced.example/bundle.js',
      normalModeBundleUrlOverride: 'https://override.example/bundle.js',
      normalModeDefaultBundleUrl: 'https://default.example/bundle.js',
    })).toBe('https://override.example/bundle.js');
  });

  it('evaluates sponsored auto-deploy readiness from bundle, deploy form, and secret requirements', () => {
    expect(resolveSponsoredBundleDeployReadiness({
      wizardMode: 'normal',
      sponsoredBundle: {
        deployGrantToken: 'grant',
        bootstrapWorkerUrl: 'https://worker.example',
        openaiKey: 'sk-test',
      },
      deployForm: { workerName: 'launch-week-worker' },
      workerSecretsEnabled: true,
      missingWorkerSecrets: [],
      hasBundleFile: false,
      normalModeDefaultBundleUrl: 'https://default.example/bundle.js',
    })).toEqual(expect.objectContaining({
      active: true,
      ready: true,
      missing: [],
    }));

    expect(resolveSessionWizardSponsoredAutoDeployReadiness({
      wizardMode: 'normal',
      sponsoredBundle: {
        deployGrantToken: 'grant',
        bootstrapWorkerUrl: 'https://worker.example',
      },
      deployForm: { workerName: '' },
      workerSecretsEnabled: true,
      currentWorkerSecrets: {},
      getMissingWorkerSecretsForDeploy: () => ['OpenAI key'],
      hasBundleFile: false,
      normalModeDefaultBundleUrl: 'https://default.example/bundle.js',
    })).toEqual(expect.objectContaining({
      active: true,
      ready: false,
      missing: expect.arrayContaining(['Worker name', 'OpenAI key']),
    }));
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
