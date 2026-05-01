import {
  LOCAL_WORKER_BUNDLE_FALLBACK_FILE_PATH,
  buildSessionWizardPublishPlan,
  buildSessionWizardPublishStepNumbers,
  getSessionWizardNormalModeBundleUrlOverrideValidationError,
  getSessionWizardPublishProgressPercent,
  readSessionWizardBundleFileText,
  resolveSessionWizardBundleUrlForMode,
  resolveSessionWizardDeployBundleMode,
  resolveSessionWizardDeployBundlePayload,
  resolveSessionWizardSponsoredAutoDeployReadiness,
  resolveSponsoredBundleDeployReadiness,
  resolveSessionWizardShouldAutoDeployWorker,
  shouldForceSessionWizardNormalModeManualBundleRetry,
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

  it('resolves deploy bundle mode from normal-mode overrides and manual fallback choices', () => {
    expect(resolveSessionWizardDeployBundleMode({
      wizardMode: 'normal',
      bundleMode: 'upload',
      bundleUrl: '',
      sponsoredAutoDeployReady: false,
      normalModeBundleUrlOverride: 'https://override.example/bundle.js',
      normalModeDefaultBundleUrl: '',
    })).toBe('url');

    expect(resolveSessionWizardDeployBundleMode({
      wizardMode: 'normal',
      bundleMode: 'url',
      sponsoredAutoDeployReady: false,
      forceManualBundleFile: true,
      hasBundleFile: true,
    })).toBe('upload');

    expect(resolveSessionWizardDeployBundleMode({
      wizardMode: 'advanced',
      bundleMode: 'upload',
      sponsoredAutoDeployReady: true,
    })).toBe('upload');
  });

  it('resolves deploy bundle payloads for URL and validated upload modes', async () => {
    await expect(resolveSessionWizardDeployBundlePayload({
      effectiveBundleMode: 'url',
      bundleUrl: ' https://bundles.example.test/sessionCorsWorker.bundle.js ',
    })).resolves.toEqual({
      bundleText: '',
      bundleUrl: 'https://bundles.example.test/sessionCorsWorker.bundle.js',
      bundleSource: 'url',
    });

    await expect(resolveSessionWizardDeployBundlePayload({
      effectiveBundleMode: 'upload',
      bundleFile: {
        text: async () => 'export default { fetch() { return new Response("ok"); } };',
      } as File,
    })).resolves.toEqual({
      bundleText: 'export default { fetch() { return new Response("ok"); } };',
      bundleUrl: undefined,
      bundleSource: 'upload',
    });
  });

  it('rejects empty, html, wrapped, and invalid bundle uploads with the fallback guidance', async () => {
    await expect(readSessionWizardBundleFileText({
      text: async () => '',
    } as File)).rejects.toThrow(
      `Selected worker bundle file was empty. Choose ${LOCAL_WORKER_BUNDLE_FALLBACK_FILE_PATH} and retry.`
    );

    await expect(readSessionWizardBundleFileText({
      text: async () => '<!doctype html><html><body>oops</body></html>',
    } as File)).rejects.toThrow(
      `Selected worker bundle file resolved to HTML instead of a worker script. Choose ${LOCAL_WORKER_BUNDLE_FALLBACK_FILE_PATH} and retry.`
    );

    await expect(readSessionWizardBundleFileText({
      text: async () => 'export default "worker-bytes";',
    } as File)).rejects.toThrow(
      `Selected worker bundle file resolved to a JavaScript string wrapper instead of raw worker bytes. Choose ${LOCAL_WORKER_BUNDLE_FALLBACK_FILE_PATH} and retry.`
    );

    await expect(readSessionWizardBundleFileText({
      text: async () => 'export default { notFetch() { return "nope"; } };',
    } as File)).rejects.toThrow(
      `Selected worker bundle file is missing the expected worker module export. Choose ${LOCAL_WORKER_BUNDLE_FALLBACK_FILE_PATH} and retry.`
    );
  });

  it('offers a manual normal-mode bundle retry only for URL-mode hosted bundle failures', () => {
    expect(shouldForceSessionWizardNormalModeManualBundleRetry({
      err: {
        message: 'Worker deploy failed.',
        responseError: 'Failed to fetch bundle (404).',
      },
      wizardMode: 'normal',
      effectiveBundleMode: 'url',
      hasBundleFile: false,
    })).toBe(true);

    expect(shouldForceSessionWizardNormalModeManualBundleRetry({
      err: {
        message: 'Worker deploy failed.',
        responseError: 'The uploaded script has no registered event handlers.',
        responseBundleDiagnostics: {
          source: 'remote-url',
          length: 216,
          hasAnyExport: true,
          hasFetchHandler: false,
        },
      },
      wizardMode: 'normal',
      effectiveBundleMode: 'url',
      hasBundleFile: false,
    })).toBe(true);

    expect(shouldForceSessionWizardNormalModeManualBundleRetry({
      err: {
        message: 'Worker deploy failed.',
        responseError: 'Failed to fetch bundle (404).',
      },
      wizardMode: 'advanced',
      effectiveBundleMode: 'url',
      hasBundleFile: false,
    })).toBe(false);

    expect(shouldForceSessionWizardNormalModeManualBundleRetry({
      err: 'Failed to fetch bundle (404).',
      wizardMode: 'normal',
      effectiveBundleMode: 'url',
      hasBundleFile: false,
    })).toBe(true);
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
