/** @file profileLinksWorkerHint.test.ts: profile links off an unlisted session's page keep its Worker. */
import { buildPolisParticipantProfileHref } from '../../components/PolisReport/PolisReport';
import { buildCompareProfileHref } from '../../components/UserPage/compareAddressStyles';
import { resolveUserPageAddressDisplayState } from '../../components/UserPage/userPageProfileDisplayHelpers';

const ADDRESS = '0x00000000000000000000000000000000000000aa';
const WORKER = 'worker=https%3A%2F%2Fsalon.example.workers.dev';

afterEach(() => window.history.replaceState({}, '', '/'));

it('keeps the page’s Worker on profile links to the session being shown', () => {
  window.history.replaceState({}, '', `/session/salon?${WORKER}`);
  const expected = `/u/${ADDRESS}?session=salon&${WORKER}`;
  expect(buildPolisParticipantProfileHref({ address: ADDRESS, sessionSlug: 'salon' })).toBe(expected);
  expect(buildCompareProfileHref(ADDRESS, 'salon')).toContain(expected);
  expect(
    resolveUserPageAddressDisplayState({ propViewAddress: ADDRESS, sessionSlug: 'salon', minimized: true }).profileUrl,
  ).toBe(expected);
});

it('adds no Worker for another session, or on a page opened without one', () => {
  window.history.replaceState({}, '', `/session/salon?${WORKER}`);
  expect(buildPolisParticipantProfileHref({ address: ADDRESS, sessionSlug: 'other' })).toBe(
    `/u/${ADDRESS}?session=other`,
  );
  window.history.replaceState({}, '', '/session/salon');
  expect(buildCompareProfileHref(ADDRESS, 'salon')).not.toContain('worker=');
});
