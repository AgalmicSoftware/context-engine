import { getCorsProxyUrlOrThrow } from '../worker/corsProxy';
import { fetchWorkerWithAuth } from '../worker/workerAuth';
import {
  unwrapWorkerResponseFieldKey,
  wrapWorkerResponseFieldKey,
  type WorkerFieldRecipient,
} from './workerResponseFieldKeys';

jest.mock('../worker/corsProxy', () => ({ getCorsProxyUrlOrThrow: jest.fn() }));
jest.mock('../worker/workerAuth', () => ({ fetchWorkerWithAuth: jest.fn() }));
const context = { sessionSlug: 'example', sessionConfig: { sessionId: 'session-id' }, account: `0x${'11'.repeat(20)}` };
const fieldContext = `0x${'aa'.repeat(32)}`;
const recipient: WorkerFieldRecipient = {
  type: 'worker-response-field-v1',
  policy: {
    sessionSlug: context.sessionSlug,
    sessionId: context.sessionConfig.sessionId,
    owner: context.account,
    audience: 'self_admin',
    context: fieldContext,
  },
  wrapped: {},
};
const key = Buffer.alloc(32, 13);
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getCorsProxyUrlOrThrow).mockResolvedValue('https://trusted.example/');
  jest
    .mocked(fetchWorkerWithAuth)
    .mockResolvedValue({ ok: true, json: async () => ({ recipient, key: key.toString('base64url') }) } as Response);
});
it('uses the active session Worker and authenticated fetch for key wrapping', async () => {
  expect(await wrapWorkerResponseFieldKey(key, 'self_admin', fieldContext, context)).toEqual(recipient);
  expect(fetchWorkerWithAuth).toHaveBeenCalledWith(
    'https://trusted.example/storage/response-field-key/wrap',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ key: key.toString('base64url'), audience: 'self_admin', context: fieldContext }),
    }),
    expect.objectContaining({
      sessionSlug: context.sessionSlug,
      sessionConfig: context.sessionConfig,
      workerUrl: 'https://trusted.example/',
      allowDemoFallback: false,
    }),
  );
});
it('unwraps a scoped recipient without trusting a Worker URL in ciphertext', async () => {
  const poisoned = { ...recipient, workerUrl: 'https://attacker.example' };
  expect(await unwrapWorkerResponseFieldKey(poisoned, fieldContext, context)).toEqual(new Uint8Array(key));
  expect(fetchWorkerWithAuth).toHaveBeenCalledWith(
    'https://trusted.example/storage/response-field-key/unwrap',
    expect.anything(),
    expect.anything(),
  );
});
it.each(['sessionSlug', 'sessionId', 'context'])(
  'rejects mismatched %s before sending credentials',
  async (property) => {
    await expect(
      unwrapWorkerResponseFieldKey(
        { ...recipient, policy: { ...recipient.policy, [property]: 'other' } },
        fieldContext,
        context,
      ),
    ).rejects.toThrow('different session');
    expect(fetchWorkerWithAuth).not.toHaveBeenCalled();
  },
);
it('rejects a Worker response with a different recipient owner', async () => {
  jest.mocked(fetchWorkerWithAuth).mockResolvedValue({
    ok: true,
    json: async () => ({
      recipient: { ...recipient, policy: { ...recipient.policy, owner: `0x${'22'.repeat(20)}` } },
    }),
  } as Response);
  await expect(wrapWorkerResponseFieldKey(key, 'self_admin', fieldContext, context)).rejects.toThrow(
    'mismatched field policy',
  );
});
it('propagates denied release rather than returning a fallback key', async () => {
  jest
    .mocked(fetchWorkerWithAuth)
    .mockResolvedValue({ ok: false, json: async () => ({ error: 'Access denied' }) } as Response);
  await expect(unwrapWorkerResponseFieldKey(recipient, fieldContext, context)).rejects.toThrow('Access denied');
});
