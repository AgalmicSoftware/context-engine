import { createSessionSbtCacheController } from './sessionSbtCacheController.js';
import type { SessionSbtCacheController, SessionSbtCacheHost } from './sessionSbtCacheControllerHostTypes.js';

describe('sessionSbtCacheControllerHostTypes', () => {
  it('types the current host boundary without changing controller ownership', () => {
    const host = {
      getActiveSessionSlug: () => 'alpha',
      getCurrentPath: () => '/session/alpha',
      getEffectiveRoutePath: (path = '') => path,
      setState: () => undefined,
      updateSbtCacheAtomic: async (_slug: string, updater: (current: Record<string, unknown> | null) => unknown) =>
        updater(null),
      updateUserCacheAtomic: async (_slug: string, updater: (current: Record<string, unknown> | null) => unknown) =>
        updater(null),
    } satisfies SessionSbtCacheHost;

    const controller: SessionSbtCacheController = createSessionSbtCacheController(host);

    expect(controller).toEqual(
      expect.objectContaining({
        ensureLightSbtDiscovery: expect.any(Function),
        refreshSbtDataForGroup: expect.any(Function),
        destroy: expect.any(Function),
      }),
    );
    controller.destroy();
  });
});
