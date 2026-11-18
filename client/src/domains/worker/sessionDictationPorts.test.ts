import { dictationNeedsSignIn, dictationOffered, sessionEnded } from './sessionDictationPorts';
import { readWorkerResourcePresence } from '../../utilities/worker/workerResourcePresence';

jest.mock('../../utilities/worker/workerResourcePresence', () => ({ readWorkerResourcePresence: jest.fn() }));

const presence = jest.mocked(readWorkerResourcePresence);

const WORKER_RUN = { slug: 'salon', sessionModeProfile: { authority: { mode: 'worker_canonical' } } };
const SIGNED_IN = { sessionSlug: 'salon', sessionConfig: WORKER_RUN, account: '0xabc' };
const VISITOR = { ...SIGNED_IN, account: '' };

describe('sessionDictationPorts', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  // A session that gives transcription to its participants and to visitors.
  const AUTHORITY = { version: 1, participantScopes: ['ai', 'transcribe'], anonymousScopes: ['ai', 'Transcribe'] };
  const SPEAKING = { ...WORKER_RUN, workerAuthority: AUTHORITY };

  it('offers speech only where the session’s Worker holds an AI key the session pays for', async () => {
    presence.mockResolvedValue({ ai: true, arweave: false, rpc: false, txGas: false });
    await expect(dictationOffered({ ...SIGNED_IN, sessionConfig: SPEAKING })).resolves.toBe(true);
    expect(presence).toHaveBeenCalledWith({
      sessionSlug: 'salon',
      sessionConfig: SPEAKING,
      context: { account: '0xabc' },
    });
    presence.mockResolvedValue({ ai: false, arweave: true, rpc: true, txGas: true });
    await expect(dictationOffered({ ...SIGNED_IN, sessionConfig: SPEAKING })).resolves.toBe(false);
    // An older Worker, or one that can't be reached, gives no answer, so the form asks again later.
    presence.mockResolvedValue(null);
    await expect(dictationOffered({ ...SIGNED_IN, sessionConfig: SPEAKING })).resolves.toBeNull();
    presence.mockRejectedValue(new Error('no Worker'));
    await expect(dictationOffered({ ...SIGNED_IN, sessionConfig: SPEAKING })).resolves.toBeNull();
  });

  it('tells a visitor signing in would allow speech only where it would: the session pays for AI and gives members transcription', async () => {
    const membersOnly = { ...WORKER_RUN, workerAuthority: { ...AUTHORITY, anonymousScopes: ['ai'] } };
    presence.mockResolvedValue({ ai: true, arweave: false, rpc: false, txGas: false });
    await expect(dictationNeedsSignIn({ ...VISITOR, sessionConfig: membersOnly })).resolves.toBe(true);
    // A sign-in condition alone stops a visitor too, though visitors are listed for transcription.
    const gated = {
      ...WORKER_RUN,
      workerAuthority: { ...AUTHORITY, loginGate: { conditions: [{ kind: 'worker_group', groupIds: ['salon'] }] } },
    };
    await expect(dictationNeedsSignIn({ ...VISITOR, sessionConfig: gated })).resolves.toBe(true);
    // Not where a visitor may already speak, a member couldn't either, the person is signed in, or it has ended.
    presence.mockClear();
    const ended = { ...membersOnly, sessionEndsAt: new Date(Date.now() - 60_000).toISOString() };
    for (const [who, sessionConfig] of [
      [VISITOR, SPEAKING],
      [
        VISITOR,
        { ...WORKER_RUN, workerAuthority: { ...AUTHORITY, anonymousScopes: ['ai'], participantScopes: ['ai'] } },
      ],
      [SIGNED_IN, membersOnly],
      [VISITOR, ended],
    ] as const) {
      await expect(dictationNeedsSignIn({ ...who, sessionConfig })).resolves.toBe(false);
    }
    expect(presence).not.toHaveBeenCalled();
    // Nor where the session pays for no AI, or its Worker can't be read: nothing is promised.
    presence.mockResolvedValue({ ai: false, arweave: true, rpc: true, txGas: true });
    await expect(dictationNeedsSignIn({ ...VISITOR, sessionConfig: membersOnly })).resolves.toBe(false);
    presence.mockRejectedValue(new Error('no Worker'));
    await expect(dictationNeedsSignIn({ ...VISITOR, sessionConfig: membersOnly })).resolves.toBe(false);
  });

  it('offers no speech once the session has ended, without asking the Worker', async () => {
    presence.mockResolvedValue({ ai: true, arweave: false, rpc: false, txGas: false });
    const ended = { ...SPEAKING, sessionEndsAt: new Date(Date.now() - 60_000).toISOString() };
    expect(sessionEnded(ended)).toBe(true);
    await expect(dictationOffered({ ...SIGNED_IN, sessionConfig: ended })).resolves.toBe(false);
    expect(presence).not.toHaveBeenCalled();
    const later = { ...SPEAKING, sessionEndsAt: new Date(Date.now() + 60_000).toISOString() };
    expect(sessionEnded(later)).toBe(false);
    expect(sessionEnded(SPEAKING)).toBe(false);
    await expect(dictationOffered({ ...SIGNED_IN, sessionConfig: later })).resolves.toBe(true);
  });

  it('offers speech only to whom the session gives transcription, as the Worker decides', async () => {
    presence.mockResolvedValue({ ai: true, arweave: false, rpc: false, txGas: false });
    await expect(dictationOffered({ ...VISITOR, sessionConfig: SPEAKING })).resolves.toBe(true);
    presence.mockClear();
    const gate = { loginGate: { conditions: [{ kind: 'worker_role' }] } };
    for (const [who, closed] of [
      [VISITOR, WORKER_RUN],
      [VISITOR, { ...WORKER_RUN, workerAuthority: { ...AUTHORITY, version: 2 } }],
      [VISITOR, { ...WORKER_RUN, workerAuthority: { ...AUTHORITY, anonymousScopes: ['ai'] } }],
      [VISITOR, { ...WORKER_RUN, workerAuthority: { ...AUTHORITY, ...gate } }],
      [VISITOR, { ...SPEAKING, scopes: { transcribe: false } }],
      [SIGNED_IN, WORKER_RUN],
      [SIGNED_IN, { ...WORKER_RUN, workerAuthority: { ...AUTHORITY, participantScopes: ['ai'] } }],
      [SIGNED_IN, { ...SPEAKING, scopes: { transcribe: false } }],
    ] as const) {
      await expect(dictationOffered({ ...who, sessionConfig: closed })).resolves.toBe(false);
    }
    expect(presence).not.toHaveBeenCalled();
    // A signed-in person's sign-in condition is the Worker's to check.
    await expect(
      dictationOffered({ ...SIGNED_IN, sessionConfig: { ...WORKER_RUN, workerAuthority: { ...AUTHORITY, ...gate } } }),
    ).resolves.toBe(true);
  });
});
