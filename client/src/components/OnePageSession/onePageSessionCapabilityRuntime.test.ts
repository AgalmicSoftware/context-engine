import demoSessions from '../../variables/demo/demo_sessions.json';
import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from '../../utilities/session/sessionModeProfile';
import { buildSessionInterviewSubmitContextToken } from '../SurveyTool/surveySavedAnswerGate';
import { resolveOnePageSessionNetworkRuntime } from './onePageSessionCapabilityRuntime';

// SurveyPileViewMode keys the voice dialog on this token. If signing in changed it on a session
// without network controls, the dialog would remount and silently end a Group Conversation recording.
describe('the voice dialog context on a Worker-hosted session', () => {
  const sessionConfig = (demoSessions as Record<string, Record<string, unknown>>)['rxc-ra-test-2'];
  const contextFor = (network: Record<string, unknown> | null) =>
    buildSessionInterviewSubmitContextToken({
      sessionConfig,
      network: resolveOnePageSessionNetworkRuntime(sessionConfig, network).network,
    });

  it('stays the same when someone signs in with a passkey or a wallet on any chain', () => {
    const signedOut = contextFor(null);
    // Guard against a vacuous pass: the token must carry the session's identity.
    expect(signedOut).toContain('rxc-ra-test-2|');
    expect(signedOut).toContain(String(sessionConfig.corsWorkerUrl).replace(/\/$/, ''));
    expect(contextFor({ id: 11155420, chainId: 11155420, name: 'OP Sepolia (Passkey)' })).toBe(signedOut);
    expect(contextFor({ id: 10, name: 'OP Mainnet' })).toBe(signedOut);
  });
});

// A chain session passes the wallet's network on, and that wallet can be on another chain. The token
// follows the session's own chain, so signing in still keeps the dialog and its recording.
describe('the voice dialog context on a chain session', () => {
  const sessionConfig = {
    slug: 'chain-demo',
    sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED),
  };
  const contextFor = (network: Record<string, unknown> | null) =>
    buildSessionInterviewSubmitContextToken({
      sessionConfig,
      ...resolveOnePageSessionNetworkRuntime(sessionConfig, network),
    });

  it('stays the same when someone signs in with a wallet on another chain', () => {
    const signedOut = contextFor(null);
    expect(contextFor({ id: 10, name: 'OP Mainnet' })).toBe(signedOut);
    expect(contextFor({ id: 11155420, chainId: 11155420, name: 'OP Sepolia' })).toBe(signedOut);
    // Guard against a vacuous pass: the token must carry the session's own chain.
    expect(signedOut).toContain('chain-demo|11155420|');
  });
});
