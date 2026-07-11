import { createSessionSbtCacheController } from './sessionSbtCacheController.js';
import type { SessionSbtCacheController, SessionSbtCacheHost } from './sessionSbtCacheControllerHostTypes.js';

describe('sessionSbtCacheControllerHostTypes', () => {
  it('types the current host boundary without changing controller ownership', () => {
    const host = {
      getActiveSessionSlug: () => 'alpha',
      getCurrentPath: () => '/session/alpha',
      getEffectiveRoutePath: (path: string) => path,
      setState: () => undefined,
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
