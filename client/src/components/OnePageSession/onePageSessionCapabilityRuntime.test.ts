import { KNOWN_SESSION_CONFIGS } from '../../utilities/session/knownSessionsFile';
import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from '../../utilities/session/sessionModeProfile';
import { buildSessionInterviewSubmitContextToken } from '../SurveyTool/surveySavedAnswerGate';
import { resolveOnePageSessionNetworkRuntime } from './onePageSessionCapabilityRuntime';

const WORKER_HOSTED_SESSIONS: [string, Record<string, unknown>][] = [
  ...Object.entries(KNOWN_SESSION_CONFIGS),
  [
    'worker-salon',
    {
      slug: 'worker-salon',
      corsWorkerUrl: 'https://ce-worker-salon.example.workers.dev/',
      sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
    },
  ],
];

// SurveyPileViewMode keys the voice dialog on this token. If signing in changed it on a session
// without network controls, the dialog would remount and silently end a Group Conversation recording.
describe.each(WORKER_HOSTED_SESSIONS)('the voice dialog context on the Worker-hosted %s', (slug, sessionConfig) => {
  const contextFor = (network: Record<string, unknown> | null) =>
    buildSessionInterviewSubmitContextToken({
      sessionConfig,
      network: resolveOnePageSessionNetworkRuntime(sessionConfig, network).network,
    });

  it('stays the same when someone signs in with a passkey or a wallet on any chain', () => {
    const signedOut = contextFor(null);
    // Guard against a vacuous pass: the token must carry the session's identity.
    expect(signedOut).toContain(`${slug}|`);
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
