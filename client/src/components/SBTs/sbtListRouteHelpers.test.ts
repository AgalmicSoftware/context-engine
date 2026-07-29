import { SBT_LIST_NO_SESSION_UNIVERSE_SLUG } from './sbtListSessionUniverseHelpers';
import { buildSbtListDetailHref, resolveSbtListRouteScope } from './sbtListRouteHelpers';

describe('sbtListRouteHelpers', () => {
  it('builds SBT detail hrefs while hiding synthetic no-session slugs', () => {
    expect(buildSbtListDetailHref('0xABC', 'alpha')).toMatch(/^\/(?:group|sbt)\/0xABC\?session=alpha$/);
    expect(buildSbtListDetailHref('0xABC', SBT_LIST_NO_SESSION_UNIVERSE_SLUG)).toMatch(/^\/(?:group|sbt)\/0xABC$/);
    expect(buildSbtListDetailHref('', 'alpha')).toBe('#');
  });

  it('resolves list scope and accepts only an exact route session config', () => {
    expect(
      resolveSbtListRouteScope({
        pathname: '/groups',
        sessionConfig: { slug: 'alpha', marker: true },
        sessionSlug: 'alpha',
      }),
    ).toEqual({
      allSessionsMode: true,
      explicitRouteSessionConfig: { slug: 'alpha', marker: true },
      routeSlug: 'alpha',
    });
    expect(
      resolveSbtListRouteScope({
        pathname: '/groups/alpha',
        sessionConfig: { slug: 'other' },
        sessionSlug: 'alpha',
      }),
    ).toMatchObject({
      allSessionsMode: false,
      explicitRouteSessionConfig: null,
      routeSlug: 'alpha',
    });
    expect(resolveSbtListRouteScope({ allSessionsMode: true, pathname: '/groups/alpha' }).allSessionsMode).toBe(true);
  });
});
