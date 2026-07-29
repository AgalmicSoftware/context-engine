import {
  WorkerSessionBootstrapRequestError,
  type WorkerCanonicalSessionBootstrap,
} from '../../utilities/session/sessionWorkerDiscovery';
import {
  checkSessionWizardWorkerSlugExists,
  resolveSessionWizardSlugAvailabilityPort,
} from './sessionWizardSlugAvailability';

const workerBootstrap = (): WorkerCanonicalSessionBootstrap => ({
  config: {},
  configRevision: 'revision-1',
  sessionId: '0x11111111111111111111111111111111',
  sessionSlug: 'worker-session',
  workerOrigin: 'https://worker.example.test',
});

describe('sessionWizardSlugAvailability', () => {
  it('uses the exact Worker bootstrap path to detect a taken Worker-owned slug', async () => {
    const fetchBootstrap = jest.fn().mockResolvedValue(workerBootstrap());

    await expect(
      checkSessionWizardWorkerSlugExists({
        workerUrl: 'https://worker.example.test',
        slug: 'worker-session',
        fetchBootstrap,
      }),
    ).resolves.toBe(true);

    expect(fetchBootstrap).toHaveBeenCalledWith({
      sessionSlug: 'worker-session',
      workerQueryValue: 'https://worker.example.test',
    });
  });

  it('treats only an exact missing-config response as an available Worker slug', async () => {
    const missingConfig = new WorkerSessionBootstrapRequestError('missing', {
      code: 'missing_config',
      retryable: true,
      status: 404,
    });
    const fetchBootstrap = jest.fn().mockRejectedValue(missingConfig);

    await expect(
      checkSessionWizardWorkerSlugExists({
        workerUrl: 'https://worker.example.test',
        slug: 'worker-session',
        fetchBootstrap,
      }),
    ).resolves.toBe(false);

    const identityMismatch = new WorkerSessionBootstrapRequestError('mismatch', {
      code: 'identity_mismatch',
    });
    fetchBootstrap.mockRejectedValueOnce(identityMismatch);
    await expect(
      checkSessionWizardWorkerSlugExists({
        workerUrl: 'https://worker.example.test',
        slug: 'worker-session',
        fetchBootstrap,
      }),
    ).rejects.toBe(identityMismatch);
  });

  it('routes Worker-canonical availability away from the registry port', async () => {
    const checkRegistrySlug = jest.fn().mockResolvedValue(false);
    const checkWorkerSlug = jest.fn().mockResolvedValue(true);
    const port = resolveSessionWizardSlugAvailabilityPort({
      isWorkerCanonical: true,
      registerSession: false,
      workerUrl: 'https://worker.example.test',
      checkRegistrySlug,
      checkWorkerSlug,
    });

    expect(port.source).toBe('worker');
    expect(port.enabled).toBe(true);
    await expect(port.sessionExists({ registryChainId: 11155420, slug: 'worker-session' })).resolves.toBe(true);
    expect(checkWorkerSlug).toHaveBeenCalledWith({
      registryChainId: 11155420,
      slug: 'worker-session',
    });
    expect(checkRegistrySlug).not.toHaveBeenCalled();
  });

  it('preserves registry availability for registry-canonical modes and disables unknown modes', () => {
    const checkRegistrySlug = jest.fn().mockResolvedValue(false);
    const checkWorkerSlug = jest.fn().mockResolvedValue(false);

    expect(
      resolveSessionWizardSlugAvailabilityPort({
        isWorkerCanonical: false,
        registerSession: true,
        workerUrl: 'https://worker.example.test',
        checkRegistrySlug,
        checkWorkerSlug,
      }),
    ).toEqual({
      enabled: true,
      source: 'registry',
      sessionExists: checkRegistrySlug,
    });
    expect(
      resolveSessionWizardSlugAvailabilityPort({
        isWorkerCanonical: false,
        registerSession: false,
        workerUrl: '',
        checkRegistrySlug,
        checkWorkerSlug,
      }),
    ).toEqual({
      enabled: false,
      source: 'none',
      sessionExists: checkWorkerSlug,
    });
  });
});
