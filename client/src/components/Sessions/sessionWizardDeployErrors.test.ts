import {
  buildSessionWizardDeployHelperCorsMessage,
  buildSessionWizardDeployHelperWorkersDevStatusMessage,
  formatSessionWizardDeployBundleDiagnostics,
  formatSessionWizardDeployOrphanResources,
  normalizeSessionWizardDeployErrorMessage,
  resolveSessionWizardDeployStatusDisplayState,
  withSessionWizardDeployHelperWorkersDevStatus,
} from './sessionWizardDeployErrors';

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
  });

  it('surfaces only safe orphan identifiers after incomplete Cloudflare cleanup', () => {
    expect(
      formatSessionWizardDeployOrphanResources({
        workerName: 'ce-session-ab12',
        kvNamespaceId: 'kv-public-id',
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
        workerCleanupStatus: 'preserved-existing',
      }),
    ).toBe(' The pre-existing worker was preserved.');
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
});
