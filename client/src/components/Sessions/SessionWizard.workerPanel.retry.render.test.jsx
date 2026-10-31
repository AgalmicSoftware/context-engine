import {
  E2E_TESTIDS,
  fireEvent,
  renderLoggedInSessionWizard,
  resetSessionWizardWorkerPanelTestState,
  screen,
  selectNormalModeCard,
  setCloudflareApiToken,
  createPublicWorkerVerificationResponder,
  waitFor,
} from './SessionWizard.workerPanel.testUtils';

describe('SessionWizard worker panel retry rendering', () => {
  beforeEach(resetSessionWizardWorkerPanelTestState);

  it('reveals manual URL and upload fallbacks in normal mode after a release-asset deploy failure', async () => {
    const originalFetch = global.fetch;
    const { WORKER_BUNDLE_URL } = require('../../variables/publicDeploymentConfig.js');
    const workerAuth = require('../../utilities/worker/workerAuth.js');
    const originalNormalizeWorkerUrl = workerAuth.normalizeWorkerUrl.getMockImplementation();
    workerAuth.normalizeWorkerUrl.mockImplementation((value = '') => String(value || '').trim());
    global.fetch = jest.fn(async (url, options = {}) => {
      const normalizedUrl = String(url);
      if (normalizedUrl.endsWith('/deploy')) {
        const payload = JSON.parse(options.body);
        expect(payload.bundleUrl).toBe(WORKER_BUNDLE_URL);
        expect(payload.bundleText).toBeUndefined();
        return {
          ok: false,
          status: 502,
          json: async () => ({ error: 'Failed to fetch bundle (404).' }),
        };
      }
      return { ok: true, json: async () => ({ ok: true }) };
    });

    try {
      renderLoggedInSessionWizard();

      fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME), {
        target: { value: 'Normal Mode Release Bundle Retry' },
      });

      selectNormalModeCard('Worker');
      expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_BUNDLE_FILE_INPUT)).not.toBeInTheDocument();

      setCloudflareApiToken('cf-test-token');
      fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SECRET_OPENAI_KEY), {
        target: { value: 'sk-normal-mode-failure' },
      });

      fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_WORKER));

      await waitFor(
        () => {
          expect(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_STATUS)).toHaveTextContent(
            'Failed to fetch bundle (404).',
          );
        },
        { timeout: 8000 },
      );
      expect(screen.getByTestId(E2E_TESTIDS.WIZARD_BUNDLE_URL_OVERRIDE)).toBeInTheDocument();
      expect(screen.getByTestId(E2E_TESTIDS.WIZARD_BUNDLE_FILE_INPUT)).toBeInTheDocument();
      expect(
        screen.getByText(
          'Guided setup still defaults to the GitHub-hosted bundle. Retry with a manual bundle URL or upload a bundle file. Optional fallback: Run nvm use 20 && npm run worker:bundle from the repo root, then choose /dist/sessionCorsWorker.bundle.js.',
        ),
      ).toBeInTheDocument();
    } finally {
      global.fetch = originalFetch;
      workerAuth.normalizeWorkerUrl.mockImplementation(originalNormalizeWorkerUrl);
    }
  });

  it('retries normal-mode deploys with a manual bundle URL override after a release-asset fetch failure', async () => {
    const originalFetch = global.fetch;
    const { WORKER_BUNDLE_URL } = require('../../variables/publicDeploymentConfig.js');
    const workerAuth = require('../../utilities/worker/workerAuth.js');
    const originalNormalizeWorkerUrl = workerAuth.normalizeWorkerUrl.getMockImplementation();
    const manualBundleUrl = 'https://assets.example.test/sessionCorsWorker.bundle.js';
    let deployCallCount = 0;

    workerAuth.normalizeWorkerUrl.mockImplementation((value = '') => String(value || '').trim());
    const respondToPublicWorkerVerification = createPublicWorkerVerificationResponder();
    global.fetch = jest.fn(async (url, options = {}) => {
      const normalizedUrl = String(url);
      if (normalizedUrl.endsWith('/deploy')) {
        deployCallCount += 1;
        const payload = JSON.parse(options.body);
        if (deployCallCount === 2) {
          expect(payload.bundleUrl).toBe(manualBundleUrl);
          expect(payload.bundleText).toBeUndefined();
          return {
            ok: true,
            json: async () => ({
              ok: true,
              workerUrl: 'https://deployed.example.test',
              writesSessionConfig: true,
              writesSessionSecrets: false,
            }),
          };
        }
        expect(payload.bundleUrl).toBe(WORKER_BUNDLE_URL);
        expect(payload.bundleText).toBeUndefined();
        return {
          ok: false,
          status: 502,
          json: async () => ({ error: 'Failed to fetch bundle (404).' }),
        };
      }
      if (normalizedUrl.endsWith('/auth/nonce')) {
        return { ok: true, json: async () => ({ nonce: 'wizard-admin-nonce' }) };
      }
      const publicVerificationResponse = respondToPublicWorkerVerification(normalizedUrl, options);
      if (publicVerificationResponse) return publicVerificationResponse;
      return { ok: true, json: async () => ({ ok: true }) };
    });

    try {
      renderLoggedInSessionWizard();

      fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME), {
        target: { value: 'Normal Mode URL Retry' },
      });

      selectNormalModeCard('Worker');

      setCloudflareApiToken('cf-test-token');
      fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SECRET_OPENAI_KEY), {
        target: { value: 'sk-normal-mode-url-retry' },
      });

      fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_WORKER));

      await waitFor(
        () => {
          expect(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_STATUS)).toHaveTextContent(
            'Failed to fetch bundle (404).',
          );
        },
        { timeout: 8000 },
      );

      fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_BUNDLE_URL_OVERRIDE), {
        target: { value: manualBundleUrl },
      });
      expect(screen.queryByText('Manual bundle URL override must use an https:// URL.')).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_WORKER));

      await waitFor(
        () => {
          expect(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_STATUS)).toHaveTextContent('Worker deployed.');
        },
        { timeout: 8000 },
      );
      expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_BUNDLE_URL_OVERRIDE)).not.toBeInTheDocument();
      expect(deployCallCount).toBe(2);
    } finally {
      global.fetch = originalFetch;
      workerAuth.normalizeWorkerUrl.mockImplementation(originalNormalizeWorkerUrl);
    }
  });

  it('keeps the hosted release bundle authoritative until the normal-mode override is a valid https URL', async () => {
    const originalFetch = global.fetch;
    const { WORKER_BUNDLE_URL } = require('../../variables/publicDeploymentConfig.js');
    const workerAuth = require('../../utilities/worker/workerAuth.js');
    const originalNormalizeWorkerUrl = workerAuth.normalizeWorkerUrl.getMockImplementation();
    const invalidManualBundleUrl = 'http://assets.example.test/sessionCorsWorker.bundle.js';
    const deployPayloads = [];

    workerAuth.normalizeWorkerUrl.mockImplementation((value = '') => String(value || '').trim());
    global.fetch = jest.fn(async (url, options = {}) => {
      const normalizedUrl = String(url);
      if (normalizedUrl.endsWith('/deploy')) {
        const payload = JSON.parse(options.body);
        deployPayloads.push(payload);
        return {
          ok: false,
          status: 502,
          json: async () => ({ error: 'Failed to fetch bundle (404).' }),
        };
      }
      if (normalizedUrl.endsWith('/auth/nonce')) {
        return { ok: true, json: async () => ({ nonce: 'wizard-admin-nonce' }) };
      }
      return { ok: true, json: async () => ({ ok: true }) };
    });

    try {
      renderLoggedInSessionWizard();

      fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME), {
        target: { value: 'Normal Mode Invalid URL Retry' },
      });

      selectNormalModeCard('Worker');

      setCloudflareApiToken('cf-test-token');
      fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SECRET_OPENAI_KEY), {
        target: { value: 'sk-normal-mode-invalid-url' },
      });

      fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_WORKER));

      await waitFor(
        () => {
          expect(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_STATUS)).toHaveTextContent(
            'Failed to fetch bundle (404).',
          );
        },
        { timeout: 8000 },
      );

      fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_BUNDLE_URL_OVERRIDE), {
        target: { value: invalidManualBundleUrl },
      });

      expect(screen.getByText('Manual bundle URL override must use an https:// URL.')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_WORKER));

      await waitFor(
        () => {
          expect(deployPayloads).toHaveLength(2);
        },
        { timeout: 8000 },
      );
      expect(deployPayloads[0].bundleUrl).toBe(WORKER_BUNDLE_URL);
      expect(deployPayloads[1].bundleUrl).toBe(WORKER_BUNDLE_URL);
      expect(deployPayloads[1].bundleText).toBeUndefined();
      expect(screen.getByText('Manual bundle URL override must use an https:// URL.')).toBeInTheDocument();
    } finally {
      global.fetch = originalFetch;
      workerAuth.normalizeWorkerUrl.mockImplementation(originalNormalizeWorkerUrl);
    }
  });

  it('lets users clear a normal-mode manual bundle retry before redeploying', async () => {
    const originalFetch = global.fetch;
    const { WORKER_BUNDLE_URL } = require('../../variables/publicDeploymentConfig.js');
    const workerAuth = require('../../utilities/worker/workerAuth.js');
    const originalNormalizeWorkerUrl = workerAuth.normalizeWorkerUrl.getMockImplementation();
    const bundleFile = {
      name: 'sessionCorsWorker.bundle.js',
      type: 'text/javascript',
      text: async () => 'export default { async fetch() { return new Response("clear-me"); } };',
    };
    const deployPayloads = [];

    workerAuth.normalizeWorkerUrl.mockImplementation((value = '') => String(value || '').trim());
    global.fetch = jest.fn(async (url, options = {}) => {
      const normalizedUrl = String(url);
      if (normalizedUrl.endsWith('/deploy')) {
        const payload = JSON.parse(options.body);
        deployPayloads.push(payload);
        return {
          ok: false,
          status: 502,
          json: async () => ({ error: 'Failed to fetch bundle (404).' }),
        };
      }
      if (normalizedUrl.endsWith('/auth/nonce')) {
        return { ok: true, json: async () => ({ nonce: 'wizard-admin-nonce' }) };
      }
      return { ok: true, json: async () => ({ ok: true }) };
    });

    try {
      renderLoggedInSessionWizard();

      fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME), {
        target: { value: 'Normal Mode Retry Clear' },
      });

      selectNormalModeCard('Worker');

      setCloudflareApiToken('cf-test-token');
      fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SECRET_OPENAI_KEY), {
        target: { value: 'sk-normal-mode-retry-clear' },
      });

      fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_WORKER));

      await waitFor(
        () => {
          expect(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_STATUS)).toHaveTextContent(
            'Failed to fetch bundle (404).',
          );
        },
        { timeout: 8000 },
      );

      const clearButton = screen.getByTestId(E2E_TESTIDS.WIZARD_CLEAR_BUNDLE_FILE_DEPLOY);
      expect(clearButton).toBeDisabled();

      fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_BUNDLE_FILE_INPUT), {
        target: { files: [bundleFile] },
      });

      expect(clearButton).not.toBeDisabled();
      expect(screen.getByText('Using sessionCorsWorker.bundle.js for this deploy.')).toBeInTheDocument();

      fireEvent.click(clearButton);

      expect(clearButton).toBeDisabled();
      expect(screen.queryByText('Using sessionCorsWorker.bundle.js for this deploy.')).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_WORKER));

      await waitFor(
        () => {
          expect(deployPayloads).toHaveLength(2);
        },
        { timeout: 8000 },
      );
      expect(deployPayloads[1].bundleUrl).toBe(WORKER_BUNDLE_URL);
      expect(deployPayloads[1].bundleText).toBeUndefined();
    } finally {
      global.fetch = originalFetch;
      workerAuth.normalizeWorkerUrl.mockImplementation(originalNormalizeWorkerUrl);
    }
  });

  it('clears the one-off manual bundle retry after a successful normal-mode fallback deploy', async () => {
    const originalFetch = global.fetch;
    const { WORKER_BUNDLE_URL } = require('../../variables/publicDeploymentConfig.js');
    const workerAuth = require('../../utilities/worker/workerAuth.js');
    const originalNormalizeWorkerUrl = workerAuth.normalizeWorkerUrl.getMockImplementation();
    const bundleFile = {
      name: 'sessionCorsWorker.bundle.js',
      type: 'text/javascript',
      text: async () => 'export default { async fetch() { return new Response("ok"); } };',
    };
    let deployCallCount = 0;

    workerAuth.normalizeWorkerUrl.mockImplementation((value = '') => String(value || '').trim());
    const respondToPublicWorkerVerification = createPublicWorkerVerificationResponder();
    global.fetch = jest.fn(async (url, options = {}) => {
      const normalizedUrl = String(url);
      if (normalizedUrl.endsWith('/deploy')) {
        deployCallCount += 1;
        const payload = JSON.parse(options.body);
        if (deployCallCount === 2) {
          expect(payload.bundleUrl).toBeUndefined();
          expect(payload.bundleText).toContain('new Response("ok")');
          return {
            ok: true,
            json: async () => ({
              ok: true,
              workerUrl: 'https://deployed.example.test',
              writesSessionConfig: true,
              writesSessionSecrets: false,
            }),
          };
        }
        expect(payload.bundleUrl).toBe(WORKER_BUNDLE_URL);
        expect(payload.bundleText).toBeUndefined();
        return {
          ok: false,
          status: 502,
          json: async () => ({ error: 'Failed to fetch bundle (404).' }),
        };
      }
      if (normalizedUrl.endsWith('/auth/nonce')) {
        return { ok: true, json: async () => ({ nonce: 'wizard-admin-nonce' }) };
      }
      const publicVerificationResponse = respondToPublicWorkerVerification(normalizedUrl, options);
      if (publicVerificationResponse) return publicVerificationResponse;
      return { ok: true, json: async () => ({ ok: true }) };
    });

    try {
      renderLoggedInSessionWizard();

      fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME), {
        target: { value: 'Normal Mode Retry Reset' },
      });

      selectNormalModeCard('Worker');

      setCloudflareApiToken('cf-test-token');
      fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SECRET_OPENAI_KEY), {
        target: { value: 'sk-normal-mode-retry-reset' },
      });

      fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_WORKER));

      await waitFor(
        () => {
          expect(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_STATUS)).toHaveTextContent(
            'Failed to fetch bundle (404).',
          );
        },
        { timeout: 8000 },
      );
      fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_BUNDLE_FILE_INPUT), {
        target: { files: [bundleFile] },
      });

      fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_WORKER));

      await waitFor(
        () => {
          expect(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_STATUS)).toHaveTextContent('Worker deployed.');
        },
        { timeout: 8000 },
      );
      expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_BUNDLE_FILE_INPUT)).not.toBeInTheDocument();

      // A verified Worker replaces the deploy button; a changed key asks for a redeploy.
      expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_DEPLOY_WORKER)).not.toBeInTheDocument();
      fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_SECRET_OPENAI_KEY), {
        target: { value: 'sk-normal-mode-retry-reset-rotated' },
      });
      fireEvent.click(await screen.findByTestId(E2E_TESTIDS.WIZARD_DEPLOY_WORKER));

      await waitFor(
        () => {
          expect(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_STATUS)).toHaveTextContent(
            'Failed to fetch bundle (404).',
          );
        },
        { timeout: 8000 },
      );
      expect(screen.getByTestId(E2E_TESTIDS.WIZARD_BUNDLE_FILE_INPUT)).toBeInTheDocument();
      expect(deployCallCount).toBe(3);
    } finally {
      global.fetch = originalFetch;
      workerAuth.normalizeWorkerUrl.mockImplementation(originalNormalizeWorkerUrl);
    }
  });
});
