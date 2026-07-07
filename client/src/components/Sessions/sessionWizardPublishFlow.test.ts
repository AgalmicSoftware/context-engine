import {
  LOCAL_WORKER_BUNDLE_FALLBACK_FILE_PATH,
  buildSessionWizardPublishExecutionPlan,
  buildSessionWizardPublishPlan,
  buildSessionWizardPublishStepNumbers,
  getSessionWizardNormalModeBundleUrlOverrideValidationError,
  getSessionWizardPublishProgressPercent,
  readSessionWizardBundleFileText,
  resolveSessionWizardBundleUrlForMode,
  resolveSessionWizardDeployBundleMode,
  resolveSessionWizardDeployBundlePayload,
  resolveSessionWizardPublishProgressDisplayState,
  resolveSessionWizardSponsoredPublishSurfaceState,
  resolveSessionWizardSponsoredAutoDeployReadiness,
  resolveSponsoredBundleDeployReadiness,
  resolveSessionWizardShouldAutoDeployWorker,
  shouldForceSessionWizardNormalModeManualBundleRetry,
} from './sessionWizardPublishFlow';
import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from '../../utilities/session/sessionModeProfile';

describe('sessionWizardPublishFlow', () => {
  it('auto-deploys only for sponsored custom-worker flows that are not already deployed', () => {
    expect(
      resolveSessionWizardShouldAutoDeployWorker({
        workerMode: 'custom',
        sponsoredAutoDeployReady: true,
        deployComplete: false,
      }),
    ).toBe(true);

    expect(
      resolveSessionWizardShouldAutoDeployWorker({
        workerMode: 'custom',
        sponsoredAutoDeployReady: true,
        deployComplete: true,
      }),
    ).toBe(false);

    expect(
      resolveSessionWizardShouldAutoDeployWorker({
        workerMode: 'default',
        sponsoredAutoDeployReady: true,
        deployComplete: false,
      }),
    ).toBe(false);
  });

  it('builds publish steps and numbered progress from the active plan', () => {
    expect(
      buildSessionWizardPublishPlan({
        shouldAutoDeployWorker: true,
        hasPendingDrafts: true,
        hasManualMetadata: false,
      }),
    ).toEqual(['deploy-worker', 'deploy-sbts', 'upload-metadata', 'register-session', 'done']);

    expect(
      buildSessionWizardPublishStepNumbers({
        shouldAutoDeployWorker: false,
        hasPendingDrafts: false,
        hasManualMetadata: true,
      }),
    ).toEqual({
      'register-session': 1,
      done: 2,
    });
  });

  it('pins publish side-effect decisions in a pure execution plan', () => {
    expect(
      buildSessionWizardPublishExecutionPlan({
        workerMode: 'custom',
        sponsoredAutoDeployReady: true,
        deployComplete: false,
        hasPendingDrafts: true,
        hasManualMetadata: false,
        canUploadMetadataNow: false,
      }),
    ).toEqual({
      shouldAutoDeployWorker: true,
      shouldDeployPendingSbts: true,
      shouldUploadMetadata: true,
      shouldPersistWorkerConfig: false,
      shouldRegisterSession: true,
      steps: ['deploy-worker', 'deploy-sbts', 'upload-metadata', 'register-session', 'done'],
      stepNumbers: {
        'deploy-worker': 1,
        'deploy-sbts': 2,
        'upload-metadata': 3,
        'register-session': 4,
        done: 5,
      },
    });

    expect(
      buildSessionWizardPublishExecutionPlan({
        workerMode: 'custom',
        sponsoredAutoDeployReady: false,
        deployComplete: false,
        hasPendingDrafts: false,
        hasManualMetadata: false,
        canUploadMetadataNow: false,
      }),
    ).toEqual(
      expect.objectContaining({
        shouldAutoDeployWorker: false,
        shouldDeployPendingSbts: false,
        shouldUploadMetadata: false,
        shouldRegisterSession: true,
      }),
    );
  });

  it('keeps manual metadata and upload readiness out of the upload side-effect decision', () => {
    expect(
      buildSessionWizardPublishExecutionPlan({
        workerMode: 'default',
        sponsoredAutoDeployReady: false,
        deployComplete: false,
        hasPendingDrafts: true,
        hasManualMetadata: true,
        canUploadMetadataNow: true,
      }),
    ).toEqual(
      expect.objectContaining({
        shouldAutoDeployWorker: false,
        shouldDeployPendingSbts: true,
        shouldUploadMetadata: false,
        steps: ['deploy-sbts', 'register-session', 'done'],
        stepNumbers: {
          'deploy-sbts': 1,
          'register-session': 2,
          done: 3,
        },
      }),
    );
  });

  it('validates and resolves the normal-mode bundle URL without leaking stale advanced URLs', () => {
    expect(getSessionWizardNormalModeBundleUrlOverrideValidationError('http://bundle.example')).toMatch(/https:\/\//i);

    expect(
      resolveSessionWizardBundleUrlForMode({
        wizardMode: 'advanced',
        bundleUrl: 'https://advanced.example/bundle.js',
        normalModeBundleUrlOverride: 'https://override.example/bundle.js',
      }),
    ).toBe('https://advanced.example/bundle.js');

    expect(
      resolveSessionWizardBundleUrlForMode({
        wizardMode: 'normal',
        bundleUrl: 'https://advanced.example/bundle.js',
        normalModeBundleUrlOverride: 'https://override.example/bundle.js',
        normalModeDefaultBundleUrl: 'https://default.example/bundle.js',
      }),
    ).toBe('https://override.example/bundle.js');
  });

  it('evaluates sponsored auto-deploy readiness from bundle, deploy form, and secret requirements', () => {
    expect(
      resolveSponsoredBundleDeployReadiness({
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
      }),
    ).toEqual(
      expect.objectContaining({
        active: true,
        ready: true,
        missing: [],
      }),
    );

    expect(
      resolveSessionWizardSponsoredAutoDeployReadiness({
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
      }),
    ).toEqual(
      expect.objectContaining({
        active: true,
        ready: false,
        missing: expect.arrayContaining(['Worker name', 'OpenAI key']),
      }),
    );
  });

  it('requires grant-backed sponsored bundles to include deploy and bootstrap resources', () => {
    const sponsoredBundle = {
      deployGrantToken: 'deploy-grant-token',
      bootstrapWorkerUrl: 'https://source-worker.example.test',
      openaiKey: 'sponsored-openai',
      arweaveJwk: '{"kty":"RSA"}',
    };
    const readyDeployForm = {
      apiToken: '',
      workerName: 'launch-week-worker-201225',
      bundleUrl: 'https://github.com/example/repo/releases/latest/download/sessionCorsWorker.bundle.js',
    };

    expect(
      resolveSponsoredBundleDeployReadiness({
        sponsoredBundle,
        deployForm: readyDeployForm,
        workerSecretsEnabled: true,
        missingWorkerSecrets: [],
      }),
    ).toEqual(
      expect.objectContaining({
        active: true,
        ready: true,
        missing: [],
      }),
    );

    expect(
      resolveSponsoredBundleDeployReadiness({
        sponsoredBundle: {
          ...sponsoredBundle,
          bootstrapWorkerUrl: '',
        },
        deployForm: readyDeployForm,
        workerSecretsEnabled: true,
        missingWorkerSecrets: [],
      }),
    ).toEqual(
      expect.objectContaining({
        active: true,
        ready: false,
        missing: ['Bootstrap worker URL'],
      }),
    );

    expect(
      resolveSponsoredBundleDeployReadiness({
        sponsoredBundle: {
          ...sponsoredBundle,
          deployGrantToken: '',
        },
        deployForm: readyDeployForm,
        workerSecretsEnabled: true,
        missingWorkerSecrets: [],
      }),
    ).toEqual(
      expect.objectContaining({
        active: true,
        ready: false,
        missing: ['Deploy grant token'],
      }),
    );
  });

  it('keeps sponsored auto-deploy readiness override-aware when the hosted bundle URL is blank', () => {
    const baseArgs = {
      wizardMode: 'normal',
      sponsoredBundle: {
        deployGrantToken: 'deploy-grant-token',
        bootstrapWorkerUrl: 'https://source-worker.example.test',
        openaiKey: 'sponsored-openai',
        arweaveJwk: '{"kty":"RSA"}',
      },
      deployForm: {
        workerName: 'launch-week-worker',
        bundleUrl: '',
      },
      workerSecretsEnabled: true,
      currentWorkerSecrets: {
        openaiKey: 'sponsored-openai',
        arweaveJwk: '{"kty":"RSA"}',
      },
      getMissingWorkerSecretsForDeploy: () => [],
      normalModeDefaultBundleUrl: '',
    };

    expect(
      resolveSessionWizardSponsoredAutoDeployReadiness({
        ...baseArgs,
        normalModeBundleUrlOverride: 'https://assets.example.test/sessionCorsWorker.bundle.js',
      }),
    ).toEqual(
      expect.objectContaining({
        active: true,
        ready: true,
        missing: [],
      }),
    );

    expect(resolveSessionWizardSponsoredAutoDeployReadiness(baseArgs)).toEqual(
      expect.objectContaining({
        active: true,
        ready: false,
        missing: ['Worker bundle URL'],
      }),
    );

    expect(
      resolveSessionWizardSponsoredAutoDeployReadiness({
        ...baseArgs,
        hasBundleFile: true,
      }),
    ).toEqual(
      expect.objectContaining({
        active: true,
        ready: true,
        missing: [],
      }),
    );
  });

  it('resolves deploy bundle mode from normal-mode overrides and manual fallback choices', () => {
    expect(
      resolveSessionWizardDeployBundleMode({
        wizardMode: 'normal',
        bundleMode: 'upload',
        bundleUrl: '',
        sponsoredAutoDeployReady: false,
        normalModeBundleUrlOverride: 'https://override.example/bundle.js',
        normalModeDefaultBundleUrl: '',
      }),
    ).toBe('url');

    expect(
      resolveSessionWizardDeployBundleMode({
        wizardMode: 'normal',
        bundleMode: 'url',
        sponsoredAutoDeployReady: false,
        forceManualBundleFile: true,
        hasBundleFile: true,
      }),
    ).toBe('upload');

    expect(
      resolveSessionWizardDeployBundleMode({
        wizardMode: 'advanced',
        bundleMode: 'upload',
        sponsoredAutoDeployReady: true,
      }),
    ).toBe('upload');

    expect(
      resolveSessionWizardDeployBundleMode({
        wizardMode: 'normal',
        bundleMode: 'upload',
        sponsoredAutoDeployReady: true,
      }),
    ).toBe('url');

    expect(
      resolveSessionWizardDeployBundleMode({
        wizardMode: 'normal',
        bundleMode: 'url',
        sponsoredAutoDeployReady: true,
        forceSponsoredAutoDeploy: true,
        forceManualBundleFile: true,
        hasBundleFile: false,
      }),
    ).toBe('url');
  });

  it('plans sponsored auto-deploy publish surface without deploy or upload ports', () => {
    expect(
      resolveSessionWizardSponsoredPublishSurfaceState({
        isNormalMode: true,
        wizardMode: 'normal',
        workerMode: 'custom',
        sponsoredAutoDeployState: {
          active: true,
          ready: true,
          missing: [],
        },
        forceManualBundleFile: false,
        hasBundleFile: false,
        normalModeDefaultBundleUrl: 'https://assets.example.test/sessionCorsWorker.bundle.js',
        manualBundleRetryMessage: 'Retry with a local bundle.',
        missingHostedBundleMessage: 'Bundle URL missing.',
      }),
    ).toEqual({
      canUseSponsoredAutoDeployNow: true,
      hasNormalModeBundleUrlOverride: false,
      normalModeBundleHelpText: expect.stringContaining('GitHub-hosted worker bundle'),
      normalModeHostedBundleConfigured: true,
      normalModeManualBundleHelpText: 'Retry with a local bundle.',
      shouldUseSponsoredAutoDeployFlow: true,
      showNormalModeManualBundleControls: false,
      showNormalModeWorkerStep: false,
      showSponsoredBundleFallbackInput: false,
      sponsoredAutoDeployBundleMode: 'url',
      sponsoredAutoDeployMissingBundleUrl: false,
      sponsoredLocalBundledAssetAvailable: true,
    });
  });

  it('plans hosted-bundle fallback visibility for sponsored normal-mode deploys', () => {
    expect(
      resolveSessionWizardSponsoredPublishSurfaceState({
        isNormalMode: true,
        wizardMode: 'normal',
        workerMode: 'custom',
        deployForm: { bundleUrl: 'https://stale-advanced.example.test/sessionCorsWorker.bundle.js' },
        sponsoredAutoDeployState: {
          active: true,
          ready: false,
          missing: ['Worker bundle URL'],
        },
        forceManualBundleFile: false,
        hasBundleFile: false,
        normalModeDefaultBundleUrl: '',
        manualBundleRetryMessage: 'Retry with a local bundle.',
        missingHostedBundleMessage: 'Bundle URL missing.',
      }),
    ).toEqual(
      expect.objectContaining({
        canUseSponsoredAutoDeployNow: false,
        normalModeBundleHelpText: 'Bundle URL missing.',
        normalModeHostedBundleConfigured: false,
        normalModeManualBundleHelpText: 'Bundle URL missing.',
        shouldUseSponsoredAutoDeployFlow: false,
        showNormalModeManualBundleControls: true,
        showNormalModeWorkerStep: false,
        showSponsoredBundleFallbackInput: true,
        sponsoredAutoDeployBundleMode: 'upload',
        sponsoredAutoDeployMissingBundleUrl: true,
        sponsoredLocalBundledAssetAvailable: false,
      }),
    );

    expect(
      resolveSessionWizardSponsoredPublishSurfaceState({
        isNormalMode: false,
        workerMode: 'custom',
        sponsoredAutoDeployState: {
          active: true,
          ready: false,
          missing: ['Worker bundle URL'],
        },
        normalModeDefaultBundleUrl: '',
      }),
    ).toEqual(
      expect.objectContaining({
        showNormalModeManualBundleControls: false,
        showSponsoredBundleFallbackInput: false,
      }),
    );
  });

  it('resolves deploy bundle payloads for URL and validated upload modes', async () => {
    await expect(
      resolveSessionWizardDeployBundlePayload({
        effectiveBundleMode: 'url',
        bundleUrl: ' https://bundles.example.test/sessionCorsWorker.bundle.js ',
      }),
    ).resolves.toEqual({
      bundleText: '',
      bundleUrl: 'https://bundles.example.test/sessionCorsWorker.bundle.js',
      bundleManifestUrl: 'https://bundles.example.test/worker-release-manifest.json',
      bundleSha256: undefined,
      bundleSource: 'url',
    });

    await expect(
      resolveSessionWizardDeployBundlePayload({
        effectiveBundleMode: 'upload',
        bundleFile: {
          text: async () => 'export default { fetch() { return new Response("ok"); } };',
        } as File,
      }),
    ).resolves.toEqual({
      bundleText: 'export default { fetch() { return new Response("ok"); } };',
      bundleUrl: undefined,
      bundleManifestUrl: undefined,
      bundleSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      bundleSource: 'upload',
    });

    await expect(
      resolveSessionWizardDeployBundlePayload({
        effectiveBundleMode: 'url',
        bundleUrl: '',
      }),
    ).resolves.toEqual({
      bundleText: '',
      bundleUrl: undefined,
      bundleSource: 'url-missing',
    });
  });

  it('drops stale advanced-mode bundle URLs from normal-mode payload resolution when the hosted default is blank', async () => {
    const staleAdvancedBundleUrl = 'https://assets.example.test/stale-advanced-sessionCorsWorker.bundle.js';
    const normalModeOverrideUrl = 'https://assets.example.test/manual-normal-sessionCorsWorker.bundle.js';

    expect(
      resolveSessionWizardBundleUrlForMode({
        wizardMode: 'advanced',
        bundleUrl: staleAdvancedBundleUrl,
        normalModeDefaultBundleUrl: '',
      }),
    ).toBe(staleAdvancedBundleUrl);

    expect(
      resolveSessionWizardBundleUrlForMode({
        wizardMode: 'normal',
        bundleUrl: staleAdvancedBundleUrl,
        normalModeDefaultBundleUrl: '',
      }),
    ).toBe('');

    await expect(
      resolveSessionWizardDeployBundlePayload({
        effectiveBundleMode: 'url',
        bundleUrl: resolveSessionWizardBundleUrlForMode({
          wizardMode: 'normal',
          bundleUrl: staleAdvancedBundleUrl,
          normalModeDefaultBundleUrl: '',
        }),
      }),
    ).resolves.toEqual({
      bundleText: '',
      bundleUrl: undefined,
      bundleSource: 'url-missing',
    });

    expect(
      resolveSessionWizardBundleUrlForMode({
        wizardMode: 'normal',
        bundleUrl: staleAdvancedBundleUrl,
        normalModeBundleUrlOverride: normalModeOverrideUrl,
        normalModeDefaultBundleUrl: '',
      }),
    ).toBe(normalModeOverrideUrl);
  });

  it('rejects empty, html, wrapped, and invalid bundle uploads with the fallback guidance', async () => {
    await expect(
      readSessionWizardBundleFileText({
        text: async () => '',
      } as File),
    ).rejects.toThrow(
      `Selected worker bundle file was empty. Choose ${LOCAL_WORKER_BUNDLE_FALLBACK_FILE_PATH} and retry.`,
    );

    await expect(
      readSessionWizardBundleFileText({
        text: async () => '<!doctype html><html><body>oops</body></html>',
      } as File),
    ).rejects.toThrow(
      `Selected worker bundle file resolved to HTML instead of a worker script. Choose ${LOCAL_WORKER_BUNDLE_FALLBACK_FILE_PATH} and retry.`,
    );

    await expect(
      readSessionWizardBundleFileText({
        text: async () => 'export default "worker-bytes";',
      } as File),
    ).rejects.toThrow(
      `Selected worker bundle file resolved to a JavaScript string wrapper instead of raw worker bytes. Choose ${LOCAL_WORKER_BUNDLE_FALLBACK_FILE_PATH} and retry.`,
    );

    await expect(
      readSessionWizardBundleFileText({
        text: async () => 'export default { notFetch() { return "nope"; } };',
      } as File),
    ).rejects.toThrow(
      `Selected worker bundle file is missing the expected worker module export. Choose ${LOCAL_WORKER_BUNDLE_FALLBACK_FILE_PATH} and retry.`,
    );
  });

  it('offers a manual normal-mode bundle retry only for URL-mode hosted bundle failures', () => {
    expect(
      shouldForceSessionWizardNormalModeManualBundleRetry({
        err: {
          message: 'Worker deploy failed.',
          responseError: 'Failed to fetch bundle (404).',
        },
        wizardMode: 'normal',
        effectiveBundleMode: 'url',
        hasBundleFile: false,
      }),
    ).toBe(true);

    expect(
      shouldForceSessionWizardNormalModeManualBundleRetry({
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
      }),
    ).toBe(true);

    expect(
      shouldForceSessionWizardNormalModeManualBundleRetry({
        err: {
          message: 'Worker deploy failed.',
          responseError: 'Failed to fetch bundle (404).',
        },
        wizardMode: 'advanced',
        effectiveBundleMode: 'url',
        hasBundleFile: false,
      }),
    ).toBe(false);

    expect(
      shouldForceSessionWizardNormalModeManualBundleRetry({
        err: 'Failed to fetch bundle (404).',
        wizardMode: 'normal',
        effectiveBundleMode: 'url',
        hasBundleFile: false,
      }),
    ).toBe(true);

    expect(
      shouldForceSessionWizardNormalModeManualBundleRetry({
        err: {
          message: 'Worker deploy failed.',
          responseError: 'The uploaded script has no registered event handlers.',
        },
        wizardMode: 'normal',
        effectiveBundleMode: 'url',
        hasBundleFile: false,
      }),
    ).toBe(false);
  });

  it('skips upload steps when publish uses manual metadata', () => {
    expect(
      buildSessionWizardPublishPlan({
        shouldAutoDeployWorker: true,
        hasPendingDrafts: true,
        hasManualMetadata: true,
      }),
    ).toEqual(['deploy-worker', 'deploy-sbts', 'register-session', 'done']);

    expect(
      buildSessionWizardPublishStepNumbers({
        shouldAutoDeployWorker: true,
        hasPendingDrafts: true,
        hasManualMetadata: true,
      }),
    ).toEqual({
      'deploy-worker': 1,
      'deploy-sbts': 2,
      'register-session': 3,
      done: 4,
    });
  });

  it('fills publish progress within an active step and completes at 100 once done', () => {
    expect(
      getSessionWizardPublishProgressPercent({
        publishStep: 2,
        publishBusy: true,
        totalSteps: 5,
        elapsedMs: 0,
      }),
    ).toBeGreaterThan(20);

    expect(
      getSessionWizardPublishProgressPercent({
        publishStep: 2,
        publishBusy: true,
        totalSteps: 5,
        elapsedMs: 2600,
      }),
    ).toBeGreaterThan(35);

    expect(
      getSessionWizardPublishProgressPercent({
        publishStep: 5,
        publishBusy: false,
        totalSteps: 5,
        elapsedMs: 0,
      }),
    ).toBe(100);
  });

  it('describes publish progress display state without mutating plan steps', () => {
    const publishSteps = ['deploy-worker', 'deploy-sbts', 'upload-metadata', 'register-session', 'done'];
    const displayState = resolveSessionWizardPublishProgressDisplayState({
      elapsedMs: 1300,
      publishBusy: true,
      publishStep: 4,
      publishSteps,
      sbtsLabel: 'Groups',
    });

    expect(displayState).toEqual(
      expect.objectContaining({
        activePublishProgressStepLabel: 'Register On-chain',
        publishProgressAriaValueText: `${Math.round(displayState.publishProgressPercent)}% Register On-chain`,
        publishProgressEyebrow: 'Publishing Session',
        publishStep: 4,
        publishProgressPercentRounded: Math.round(displayState.publishProgressPercent),
        publishProgressSteps: [
          { key: 'deploy-worker', label: 'Deploy Worker', state: 'complete' },
          { key: 'deploy-sbts', label: 'Deploy Groups', state: 'complete' },
          { key: 'upload-metadata', label: 'Upload Arweave', state: 'complete' },
          { key: 'register-session', label: 'Register On-chain', state: 'active' },
          { key: 'done', label: 'Done', state: 'pending' },
        ],
        showPublishProgress: true,
      }),
    );
    expect(displayState.publishProgressPercent).toBeGreaterThan(60);
    expect(displayState.publishProgressPercent).toBeLessThan(80);
    expect(publishSteps).toEqual(['deploy-worker', 'deploy-sbts', 'upload-metadata', 'register-session', 'done']);

    expect(
      resolveSessionWizardPublishProgressDisplayState({
        publishBusy: false,
        publishStep: 0,
        publishSteps: ['register-session', 'done'],
      }),
    ).toEqual({
      activePublishProgressStepLabel: 'Register On-chain',
      publishProgressAriaValueText: '0% Register On-chain',
      publishProgressEyebrow: 'Publish Complete',
      publishStep: 0,
      publishProgressPercent: 0,
      publishProgressPercentRounded: 0,
      publishProgressSteps: [
        { key: 'register-session', label: 'Register On-chain', state: 'pending' },
        { key: 'done', label: 'Done', state: 'pending' },
      ],
      showPublishProgress: false,
    });

    expect(
      resolveSessionWizardPublishProgressDisplayState({
        publishBusy: true,
        publishStep: 1,
        publishSteps: ['persist-worker-config', 'done'],
      }).activePublishProgressStepLabel,
    ).toBe('Verify Worker Config');
  });
});
