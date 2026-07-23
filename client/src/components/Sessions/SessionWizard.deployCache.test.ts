import { cacheSessionWorkerConfigAfterDeploy } from './sessionWizardSponsoredBundleSupport';
import { resolveDeployWorkerState, shouldCacheSessionWorkerConfigAfterDeploy } from './sessionWizardWorkerState';
import { readSessionWorkerConfigCache } from '../../utilities/session/sessionWorkerConfigCache.js';

describe('SessionWizard deploy cache authority', () => {
  beforeEach(() => {
    try {
      localStorage.removeItem('ce:sessionWorkerConfigCache:v1');
    } catch (_) {}
  });

  it('keeps the worker-config cache authoritative after a full helper success', () => {
    expect(
      shouldCacheSessionWorkerConfigAfterDeploy({
        deployStatusCode: 200,
        configSyncStatus: { synced: false, warning: 'unused for 200 responses' },
        workerUrl: 'https://worker.example',
      }),
    ).toBe(true);
  });

  it('keeps the worker-config cache authoritative after a successful fallback reseed', () => {
    expect(
      shouldCacheSessionWorkerConfigAfterDeploy({
        deployStatusCode: 207,
        configSyncStatus: { synced: true, warning: '' },
        workerUrl: 'https://worker.example',
      }),
    ).toBe(true);
  });

  it('does not trust partial deploys until the config reseed actually succeeds', () => {
    expect(
      shouldCacheSessionWorkerConfigAfterDeploy({
        deployStatusCode: 207,
        configSyncStatus: { synced: false, warning: 'Config reseed failed' },
        workerUrl: 'https://worker.example',
      }),
    ).toBe(false);
  });

  it('does not seed cache from a draft worker URL when the deploy response omits the worker URL', () => {
    expect(
      shouldCacheSessionWorkerConfigAfterDeploy({
        deployStatusCode: 200,
        configSyncStatus: { synced: false, warning: 'Worker URL unavailable - skipped config sync.' },
        workerUrl: '',
      }),
    ).toBe(false);

    expect(
      cacheSessionWorkerConfigAfterDeploy({
        deployStatusCode: 200,
        configSyncStatus: { synced: false, warning: 'Worker URL unavailable - skipped config sync.' },
        workerUrl: '',
        slug: 'edge',
        config: {
          corsWorkerUrl: 'https://draft-worker.example',
          allowOrigins: ['https://app.example'],
        },
      }),
    ).toBe(false);

    expect(readSessionWorkerConfigCache().bySession).toEqual({});
  });

  it('does not mark deploy as verified when the response omits workerUrl', () => {
    expect(
      resolveDeployWorkerState({
        responseWorkerUrl: '',
        configuredWorkerUrl: 'https://draft-worker.example',
      }),
    ).toEqual({
      resolvedDeployWorkerUrl: '',
      displayWorkerUrl: 'https://draft-worker.example',
      deployComplete: false,
    });

    expect(
      resolveDeployWorkerState({
        responseWorkerUrl: undefined,
        configuredWorkerUrl: 'https://draft-worker.example',
      }).deployComplete,
    ).toBe(false);
  });

  it('does not equate a helper-returned URL with public config verification', () => {
    expect(
      resolveDeployWorkerState({
        responseWorkerUrl: 'https://deployed.example',
        configuredWorkerUrl: '',
      }).deployComplete,
    ).toBe(false);
    expect(
      resolveDeployWorkerState({
        responseWorkerUrl: 'https://deployed.example',
        configuredWorkerUrl: '',
        publicConfigVerified: true,
      }).deployComplete,
    ).toBe(true);
  });
});
