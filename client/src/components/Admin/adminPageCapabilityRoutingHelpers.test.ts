import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from '../../utilities/session/sessionModeProfile';
import { resolveAdminCapabilityRoute } from './adminPageCapabilityRoutingHelpers';

const SESSION_ID = '0x1234567890abcdef1234567890abcdef';

describe('resolveAdminCapabilityRoute', () => {
  it('binds generic admin signing to a Worker-owned identity only for Worker-canonical sessions', () => {
    const workerRoute = resolveAdminCapabilityRoute({
      sessionId: SESSION_ID,
      sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
    });
    const registryRoute = resolveAdminCapabilityRoute({
      sessionId: SESSION_ID,
      sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED),
    });

    expect(workerRoute).toMatchObject({
      selectedWorkerSessionId: SESSION_ID,
      signedWorkerSessionId: SESSION_ID,
    });
    expect(registryRoute).toMatchObject({
      selectedWorkerSessionId: SESSION_ID,
      signedWorkerSessionId: '',
    });
  });
});
