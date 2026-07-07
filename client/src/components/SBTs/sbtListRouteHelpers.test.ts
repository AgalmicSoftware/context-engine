import { SBT_LIST_NO_SESSION_UNIVERSE_SLUG } from './sbtListSessionUniverseHelpers';
import { buildSbtListDetailHref } from './sbtListRouteHelpers';

describe('sbtListRouteHelpers', () => {
  it('builds SBT detail hrefs while hiding synthetic no-session slugs', () => {
    expect(buildSbtListDetailHref('0xABC', 'alpha')).toMatch(/^\/(?:group|sbt)\/0xABC\?session=alpha$/);
    expect(buildSbtListDetailHref('0xABC', SBT_LIST_NO_SESSION_UNIVERSE_SLUG)).toMatch(/^\/(?:group|sbt)\/0xABC$/);
    expect(buildSbtListDetailHref('', 'alpha')).toBe('#');
  });
});
