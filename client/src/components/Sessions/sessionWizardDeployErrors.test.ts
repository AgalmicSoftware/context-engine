import {
  buildSessionWizardDeployHelperCorsMessage,
  buildSessionWizardDeployHelperWorkersDevStatusMessage,
  describeSessionWizardSponsoredDeployFailure,
  formatSessionWizardDeployBundleDiagnostics,
  formatSessionWizardDeployOrphanResources,
  normalizeSessionWizardDeployErrorMessage,
  resolveSessionWizardDeployStatusDisplayState,
  withSessionWizardDeployHelperWorkersDevStatus,
} from './sessionWizardDeployErrors';
import { completeSessionWizardWorkerPublicDeployment } from './sessionWizardWorkerPublicVerification';

describe('sessionWizardDeployErrors', () => {
  it('builds the deploy-helper CORS message with origin and helper details', () => {
    expect(
      buildSessionWizardDeployHelperCorsMessage({
        helperBase: 'https://helper.example.test',
        detail: 'Origin not allowed',
        currentOrigin: 'https://app.example.test',
      }),
    ).toBe(
      'Deploy-helper rejected browser origin https://app.example.test (Origin not allowed). Add this origin to the deploy-helper allowlist at https://helper.example.test and retry.',
    );
  });

  it('summarizes workers.dev account and script status details', () => {
    expect(
      buildSessionWizardDeployHelperWorkersDevStatusMessage({
        subdomain: 'launch-week',
        subdomainStatus: 'ready',
        scriptSubdomainEnabled: true,
      }),
    ).toBe('workers.dev status: account ready (launch-week); script enabled.');

    expect(
      withSessionWizardDeployHelperWorkersDevStatus('Worker deployed.', {
        subdomainError: 'subdomain unavailable',
        scriptSubdomainError: 'script missing route',
      }),
    ).toBe(
      'Worker deployed. workers.dev status: account issue: subdomain unavailable; script issue: script missing route.',
    );
  });

  it('classifies deploy status display errors without owning deploy execution', () => {
    expect(resolveSessionWizardDeployStatusDisplayState()).toEqual({
      deployButtonDisabled: false,
      deployStatusText: '',
      isError: false,
    });
    expect(
      resolveSessionWizardDeployStatusDisplayState({
        deployInFlight: true,
        deployStatus: 'Uploading worker...',
      }),
    ).toEqual({
      deployButtonDisabled: true,
      deployStatusText: 'Uploading worker...',
      isError: false,
    });
    expect(
      resolveSessionWizardDeployStatusDisplayState({
        deployStatus: 'Worker deployed.',
      }),
    ).toEqual({
      deployButtonDisabled: false,
      deployStatusText: 'Worker deployed.',
      isError: false,
    });
    expect(
      resolveSessionWizardDeployStatusDisplayState({
        deployStatus: 'Worker deployed.',
        workerCanonicalPublishCompleted: true,
      }),
    ).toEqual({
      deployButtonDisabled: true,
      deployStatusText: 'Worker deployed.',
      isError: false,
    });
    expect(
      resolveSessionWizardDeployStatusDisplayState({
        deployStatus: 'Missing API token.',
      }),
    ).toEqual({
      deployButtonDisabled: false,
      deployStatusText: 'Missing API token.',
      isError: true,
    });
    expect(
      resolveSessionWizardDeployStatusDisplayState({
        deployStatus: 'Custom URL changed after deploy.',
        deployVerifiedInUi: true,
      }),
    ).toEqual({
      deployButtonDisabled: false,
      deployStatusText: 'Custom URL changed after deploy.',
      isError: false,
    });
  });

  it('formats bundle diagnostics as a compact summary', () => {
    expect(
      formatSessionWizardDeployBundleDiagnostics({
        source: 'remote-url',
        length: 216,
        sha256: '0123456789abcdef0123456789abcdef',
        hasAnyExport: true,
        hasExportDefault: false,
        hasNamedDefaultExport: false,
        hasFetchHandler: false,
        hasServiceWorkerFetch: false,
      }),
    ).toBe('source=remote-url len=216 sha256=0123456789abcdef export=1 default=0 namedDefault=0 fetch=0 swFetch=0');
  });

  it('normalizes deploy errors for CORS, bundle fetch, network, diagnostics, and fallbacks', () => {
    expect(
      normalizeSessionWizardDeployErrorMessage({
        err: {
          statusCode: 403,
          responseError: 'Origin not allowed',
        },
        helperBase: 'https://helper.example.test',
        currentOrigin: 'https://app.example.test',
      }),
    ).toBe(
      'Deploy-helper rejected browser origin https://app.example.test (Origin not allowed). Add this origin to the deploy-helper allowlist at https://helper.example.test and retry.',
    );

    expect(
      normalizeSessionWizardDeployErrorMessage({
        err: {
          message: 'Worker deploy failed.',
          responseError: 'Failed to fetch bundle (404).',
        },
        helperBase: 'https://helper.example.test',
        currentOrigin: 'https://app.example.test',
      }),
    ).toBe('Worker deploy failed.');

    expect(
      normalizeSessionWizardDeployErrorMessage({
        err: {
          message: 'Failed to fetch',
        },
        helperBase: 'https://helper.example.test',
        currentOrigin: 'https://app.example.test',
      }),
    ).toBe(
      'Deploy request could not reach https://helper.example.test. This is usually CORS or helper availability; ensure https://app.example.test is allowed and retry.',
    );

    expect(
      normalizeSessionWizardDeployErrorMessage({
        err: {
          message: 'Worker deploy failed.',
          responseError: 'The uploaded script has no registered event handlers.',
          responseBundleDiagnostics: {
            source: 'remote-url',
            length: 216,
            hasAnyExport: true,
            hasExportDefault: false,
            hasNamedDefaultExport: false,
            hasFetchHandler: false,
            hasServiceWorkerFetch: false,
          },
        },
      }),
    ).toBe(
      'Worker deploy failed. Bundle diagnostics: source=remote-url len=216 sha256=n/a export=1 default=0 namedDefault=0 fetch=0 swFetch=0',
    );

    expect(
      normalizeSessionWizardDeployErrorMessage({
        err: { statusCode: 503 },
      }),
    ).toBe('Worker deploy failed (503).');

    expect(
      normalizeSessionWizardDeployErrorMessage({
        err: 'Failed to fetch',
        helperBase: 'https://helper.example.test',
        currentOrigin: 'https://app.example.test',
      }),
    ).toBe(
      'Deploy request could not reach https://helper.example.test. This is usually CORS or helper availability; ensure https://app.example.test is allowed and retry.',
    );

    expect(normalizeSessionWizardDeployErrorMessage()).toBe('Worker deploy failed.');

    expect(
      normalizeSessionWizardDeployErrorMessage({
        err: {
          message: 'This deployment request is already bound to a different Cloudflare account.',
          responseDeploymentRequestConflict: true,
          responseDeploymentRequestTerminal: true,
        },
      }),
    ).toBe(
      'This deployment request is already bound to a different Cloudflare account. Review the account and session details, then click Deploy worker again to start a fresh deployment attempt.',
    );
  });

  it('explains how to recover a deploy grant when the sponsor has no Worker release set', () => {
    expect(
      describeSessionWizardSponsoredDeployFailure({
        status: 400,
        error:
          'Sponsored Agents HTTP deploys need AGENT_BRIDGE_BUNDLE_URL and AGENT_BRIDGE_BUNDLE_MANIFEST_URL on the sponsoring Worker.',
      }),
    ).toBe(
      'Sponsored Agents HTTP deploys need AGENT_BRIDGE_BUNDLE_URL and AGENT_BRIDGE_BUNDLE_MANIFEST_URL on the sponsoring Worker. Your deploy grant was not used. It will work once the sponsor sets these on their Worker.',
    );
    expect(
      describeSessionWizardSponsoredDeployFailure({
        status: 400,
        error: 'Missing bundleText or bundleUrl (set WORKER_BUNDLE_URL or pass bundleUrl).',
      }),
    ).toBe(
      'The sponsoring Worker has no Worker release to deploy, so nothing was deployed. The grant now only works for ' +
        'this exact request: retry this same draft here once the sponsor sets WORKER_BUNDLE_URL on that Worker. ' +
        'If the sponsor updates its Worker code instead, ask for a new deploy grant.',
    );
    expect(describeSessionWizardSponsoredDeployFailure({ status: 400, error: 'Missing deployPayload.' })).toBe(
      'Missing deployPayload.',
    );
    expect(describeSessionWizardSponsoredDeployFailure({ status: 502 })).toBe('Worker deploy failed (502).');
  });

  it('explains how to proceed when an older deploy helper refuses participant test ETH', () => {
    const helperError = 'Worker-canonical authority participantScopes contains an unsupported scope.';
    // A direct deploy's next attempt is a fresh request, so turning the setting off works.
    const direct = Object.assign(new Error(helperError), { statusCode: 400, responseError: helperError });
    expect(normalizeSessionWizardDeployErrorMessage({ err: direct })).toBe(
      `${helperError} This deploy helper predates participant test ETH. Turn off "Send participants test ETH ` +
        'for gas", or deploy with a 0.7.0 or later deploy helper and Session Worker.',
    );
    // An older sponsor has reserved the grant for this exact request, so a changed draft would conflict.
    const sponsoredGuidance =
      'The sponsoring Worker predates participant test ETH, so nothing was deployed. The grant now only works for ' +
      'this exact request: retry this same draft once the sponsor updates that Worker to 0.7.0 or later. To deploy ' +
      'without test ETH instead, ask for a new deploy grant.';
    expect(describeSessionWizardSponsoredDeployFailure({ status: 400, error: helperError })).toBe(sponsoredGuidance);
    const sponsored = Object.assign(new Error(sponsoredGuidance), { statusCode: 400, responseError: helperError });
    expect(normalizeSessionWizardDeployErrorMessage({ err: sponsored })).toBe(sponsoredGuidance);
    const otherField = 'Worker-canonical authority anonymousScopes contains an unsupported scope.';
    expect(
      normalizeSessionWizardDeployErrorMessage({
        err: Object.assign(new Error(otherField), { statusCode: 400, responseError: otherField }),
      }),
    ).toBe(otherField);
  });

  it('keeps session Worker verification failures out of deploy-helper hints', async () => {
    const verificationError = await completeSessionWizardWorkerPublicDeployment({
      workerUrl: 'https://worker.example.test',
      slug: 'session',
      sessionId: '0x00000000000000000000000000000001',
      adminAddress: '0x00000000000000000000000000000000000000aa',
      config: {},
      isWorkerCanonical: true,
      signAdminAction: async () => ({}),
      verify: async () => {
        throw new TypeError('Failed to fetch');
      },
    }).catch((error: unknown) => error);

    expect(
      normalizeSessionWizardDeployErrorMessage({
        err: verificationError,
        helperBase: 'https://helper.example.test',
        currentOrigin: 'https://app.example.test',
      }),
    ).toBe(
      'Worker infrastructure was created, but public config readback and browser-origin verification are still pending. Last error: Failed to fetch',
    );
  });

  it('surfaces only safe orphan identifiers after incomplete Cloudflare cleanup', () => {
    expect(
      formatSessionWizardDeployOrphanResources({
        workerName: 'ce-session-ab12',
        kvNamespaceId: 'kv-public-id',
        kvCleanupStatus: 'delete-failed',
        workerCleanupStatus: 'owned-delete-failed',
        apiToken: 'must-not-appear',
      }),
    ).toBe(
      ' Cleanup incomplete: remove worker ce-session-ab12 and KV namespace kv-public-id in Cloudflare before retrying.',
    );
    expect(
      normalizeSessionWizardDeployErrorMessage({
        err: {
          message: 'Worker script upload was not confirmed.',
          responseOrphanResources: {
            workerName: 'ce-session-ab12',
            kvNamespaceId: 'kv-public-id',
            kvCleanupStatus: 'delete-failed',
            workerCleanupStatus: 'owned-delete-failed',
            apiToken: 'must-not-appear',
          },
        },
      }),
    ).toBe(
      'Worker script upload was not confirmed. Cleanup incomplete: remove worker ce-session-ab12 and KV namespace kv-public-id in Cloudflare before retrying.',
    );
    expect(
      formatSessionWizardDeployOrphanResources({
        workerName: '',
        workerCleanupStatus: 'ownership-changed',
      }),
    ).toBe(' A newer or foreign worker deployment was detected and preserved.');
    expect(
      formatSessionWizardDeployOrphanResources({
        workerName: '',
        workerCleanupStatus: 'ownership-unverified',
      }),
    ).toBe(' Worker ownership could not be verified, so no worker deletion was attempted.');
    expect(formatSessionWizardDeployOrphanResources({ workerName: 'unverified-worker' })).toBe('');
    expect(
      formatSessionWizardDeployOrphanResources({
        workerName: 'preserved-worker',
        kvNamespaceId: 'kv-live-id',
        kvCleanupStatus: 'retained-live-worker',
        workerCleanupStatus: 'preserved-existing',
      }),
    ).toBe(
      ' The pre-existing worker was preserved. KV namespace kv-live-id was retained because it remains or may remain bound to the live worker. Do not delete it before recovery or ownership verification.',
    );
    expect(
      formatSessionWizardDeployOrphanResources({
        kvNamespaceId: 'kv-legacy-live-id',
        workerCleanupStatus: 'preserved-existing',
      }),
    ).not.toContain('remove KV namespace');
    const failedOwnedCleanup = formatSessionWizardDeployOrphanResources({
      workerName: 'owned-worker',
      kvNamespaceId: 'kv-owned-live-id',
      kvCleanupStatus: 'retained-live-worker',
      workerCleanupStatus: 'owned-delete-failed',
    });
    expect(failedOwnedCleanup).toContain('remove worker owned-worker');
    expect(failedOwnedCleanup).not.toContain('remove KV namespace');
    expect(failedOwnedCleanup).toContain('Do not delete it before recovery');
    expect(
      formatSessionWizardDeployOrphanResources({
        workerName: 'foreign-worker',
        workerCleanupStatus: 'ownership-changed',
      }),
    ).toBe(' A newer or foreign worker deployment was detected and preserved.');
    expect(
      formatSessionWizardDeployOrphanResources({
        workerName: 'unknown-worker',
        workerCleanupStatus: 'ownership-unverified',
      }),
    ).toBe(' Worker ownership could not be verified, so no worker deletion was attempted.');
  });

  it.each([
    {
      label: 'an upload journal retry',
      resources: {
        workerName: '',
        kvNamespaceId: 'kv-upload-pending',
        kvCleanupStatus: 'retained-upload-pending',
      },
      expected:
        ' KV namespace kv-upload-pending was retained for safe deployment retry. Retry normally so Context Engine can recover the same deployment. Do not delete the namespace while recovery is pending.',
    },
    {
      label: 'a pre-existing recovered deployment',
      resources: {
        workerName: 'recovered-worker',
        kvNamespaceId: 'kv-pre-existing',
        kvCleanupStatus: 'retained-pre-existing',
        workerCleanupStatus: 'retained-pre-existing',
      },
      expected:
        ' The existing worker and deployment state were preserved. KV namespace kv-pre-existing belongs to the existing deployment and was retained. Retry normally or inspect its Worker binding in Cloudflare. Do not delete the namespace before ownership is verified.',
    },
    {
      label: 'worker config propagation',
      resources: {
        workerName: 'propagating-worker',
        kvNamespaceId: 'kv-config-propagation',
        kvCleanupStatus: 'retained-config-propagation-pending',
        workerCleanupStatus: 'retained-config-propagation-pending',
      },
      expected:
        ' Worker config propagation is still pending; the deployment was preserved for recovery. KV namespace kv-config-propagation remains bound while worker config propagation completes. Retry normally so Context Engine can finish verification. Do not delete the namespace.',
    },
  ])('never advises deleting a retained deploy-helper namespace during $label', ({ resources, expected }) => {
    const message = formatSessionWizardDeployOrphanResources(resources);

    expect(message).toBe(expected);
    expect(message).not.toContain('remove KV namespace');
  });
});
