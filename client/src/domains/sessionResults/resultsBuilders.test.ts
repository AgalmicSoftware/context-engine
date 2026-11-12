import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from '../../utilities/session/sessionModeProfile';
import { mayStartResultsBuilds } from './resultsBuilders';
import { shouldOfferGeneratedResultsAuthorization } from './sessionResultsAnalysisController';

const ADMIN = '0x00000000000000000000000000000000000000aa';
const CO_ADMIN = '0x00000000000000000000000000000000000000bb';
const RESULTS_ADMIN = '0x00000000000000000000000000000000000000cc';
const STRANGER = '0x00000000000000000000000000000000000000dd';
const config = {
  adminAddress: ADMIN,
  adminAddresses: [CO_ADMIN],
  resultsAdminAddresses: [RESULTS_ADMIN.toUpperCase().replace('0X', '0x')],
  sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
};

describe('who is offered the Results builds', () => {
  it('offers AI Views to admins, co-admins and results admins, and no one else', () => {
    for (const account of [ADMIN, CO_ADMIN, RESULTS_ADMIN]) {
      expect(shouldOfferGeneratedResultsAuthorization({ account, sessionConfig: config })).toBe(true);
      expect(mayStartResultsBuilds(config, account)).toBe(true);
    }
    expect(shouldOfferGeneratedResultsAuthorization({ account: STRANGER, sessionConfig: config })).toBe(false);
    expect(mayStartResultsBuilds(config, STRANGER)).toBe(false);
    expect(mayStartResultsBuilds(config, '')).toBe(false);
  });

  it('offers AI Views only to the admin where the browser supplies the answers', () => {
    const onChain = { ...config, sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED) };
    expect(shouldOfferGeneratedResultsAuthorization({ account: ADMIN, sessionConfig: onChain })).toBe(true);
    expect(shouldOfferGeneratedResultsAuthorization({ account: RESULTS_ADMIN, sessionConfig: onChain })).toBe(false);
    expect(mayStartResultsBuilds(onChain, RESULTS_ADMIN)).toBe(true);
  });

  it('offers them to an on-chain session’s registry admin and, on a hat session, to anyone signed in', () => {
    expect(mayStartResultsBuilds({ __registry: { adminAddress: ADMIN } }, ADMIN)).toBe(true);
    expect(mayStartResultsBuilds({ adminHatId: '7', hatsAddress: '0xhat' }, STRANGER)).toBe(true);
  });
});
