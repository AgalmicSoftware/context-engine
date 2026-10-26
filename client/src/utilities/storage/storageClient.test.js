import {
  LegacyOwnResponseListingError,
  listSessionStorageRefsPage,
  readSessionStorageBlob,
  uploadDataToSessionStorage,
} from './storageClient.js';
import { normalizeSessionStorageConfig } from './sessionStorageConfig.js';
import { buildResponsePayload } from '../../components/SurveyTool/surveyToolResponsePayloadController';
import { readWorkerCapabilities } from '../worker/workerCapabilities';

jest.mock('../worker/workerCapabilities', () => ({
  ...jest.requireActual('../worker/workerCapabilities'),
  readWorkerCapabilities: jest.fn(),
}));

jest.mock('../arweave/arweaveClient.js', () => ({
  arweaveClient: {
    uploadDataToArweave: jest.fn(),
    buildArweaveGatewayUrl: jest.fn((id) => `https://arweave.net/${id}`),
  },
}));

jest.mock('../worker/corsProxy.js', () => ({
  getCorsProxyUrlOrThrow: jest.fn(),
}));

jest.mock('../worker/workerAuth.js', () => ({
  fetchWorkerWithAuth: jest.fn(),
}));

const { arweaveClient } = require('../arweave/arweaveClient.js');
const { getCorsProxyUrlOrThrow } = require('../worker/corsProxy.js');
const { fetchWorkerWithAuth } = require('../worker/workerAuth.js');

const TX_ID = 'abc123abc123abc123abc123abc123abc123abc1230';

describe('Worker capability upload gates', () => {
  const account = '0x1111111111111111111111111111111111111111';
  const options = (resource = 'responses') => ({
    resource,
    workerUrl: 'https://gate-worker.test',
    sessionSlug: 'sample',
    context: { account },
    sessionConfig: { adminAddress: account, storageProfile: { backend: 'cloudflare' } },
  });
  beforeEach(() => {
    jest.clearAllMocks();
    readWorkerCapabilities.mockResolvedValue({ legacy: true, features: [] });
    fetchWorkerWithAuth.mockResolvedValue(
      new Response(
        JSON.stringify({
          storageRef: { backend: 'cloudflare', id: 'cf_gate_result' },
        }),
      ),
    );
  });
  test('refuses submit only for an explicit unavailable operation', async () => {
    readWorkerCapabilities.mockResolvedValue({
      legacy: false,
      features: [],
      session: {
        unavailable: [{ operation: 'submit', reason: 'storage_missing' }],
      },
    });
    await expect(uploadDataToSessionStorage({}, 'json', options())).rejects.toThrow('missing its storage index');
    expect(fetchWorkerWithAuth).not.toHaveBeenCalled();
  });
  test('continues submit on a legacy Worker', async () => {
    await expect(uploadDataToSessionStorage({}, 'json', options())).resolves.toHaveProperty('id', 'cf_gate_result');
  });
  test.each(['questions', 'surveys'])('blocks an unstamped admin correction to %s before upload', async (resource) => {
    fetchWorkerWithAuth.mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [{ metadata: { resourceId: '0xABC' } }],
          listComplete: true,
          cursor: null,
        }),
      ),
    );
    await expect(uploadDataToSessionStorage({ id: '0xabc' }, 'json', options(resource))).rejects.toThrow(
      'Upgrade the session Worker',
    );
    expect(fetchWorkerWithAuth).toHaveBeenCalledTimes(1);
    expect(fetchWorkerWithAuth.mock.calls[0][0]).toContain('/storage/list');
  });
  test('allows a new admin-authored id after a complete previous-version listing', async () => {
    fetchWorkerWithAuth.mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [], listComplete: true, cursor: null })),
    );
    await expect(uploadDataToSessionStorage({ id: '0xabc' }, 'json', options('questions'))).resolves.toHaveProperty(
      'id',
      'cf_gate_result',
    );
  });
  test('allows a correction on a Worker that stamps upload authority', async () => {
    readWorkerCapabilities.mockResolvedValue({ legacy: false, features: ['upload_authority_stamps'] });
    await expect(uploadDataToSessionStorage({ id: '0xabc' }, 'json', options('questions'))).resolves.toHaveProperty(
      'id',
      'cf_gate_result',
    );
    expect(fetchWorkerWithAuth.mock.calls[0][0]).toContain('/storage/upload');
  });
  test('does not mistake an incomplete or unreadable listing for a new id', async () => {
    fetchWorkerWithAuth.mockResolvedValue(new Response(JSON.stringify({ items: [] })));
    await expect(uploadDataToSessionStorage({ id: '0xabc' }, 'json', options('questions'))).rejects.toThrow(
      'Upgrade the session Worker',
    );
  });
});

const buildSingleQuestionResponsePayload = ({ answer, additional, questionType, options, voiceCredits }) =>
  buildResponsePayload({
    isStandalone: false,
    singleQuestionMode: true,
    surveyId: undefined,
    account: '0x00000000000000000000000000000000000000aa',
    surveyIndex: 0,
    surveyResponseState: {
      answers: { q1: { value: answer, encrypted: false } },
      additionalComments: { q1: { value: additional, encrypted: false } },
      importance: {},
      conviction: {},
    },
    questionPool: [{ id: 'q1', type: questionType, prompt: 'Matrix question', options, voiceCredits }],
    pileQuestions: [],
    resolveFieldEncryptionAudience: () => 'self',
    getQuestionEncryptionGates: () => [],
    resolveFieldEncryptionGateId: () => null,
    normalizeFieldAudienceMode: () => 'default',
    getSurveyMetadataForJson: () => null,
    resolveSessionContext: () => ({ sessionName: 'matrix-session' }),
    getConvictionFromSlice: () => null,
    getImportanceFromSlice: () => null,
    sanitizeQuestionPromptForResponsePayload: (question) => question.prompt,
  });

describe('storageClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    readWorkerCapabilities.mockResolvedValue({ legacy: true, features: [] });
    arweaveClient.uploadDataToArweave.mockResolvedValue(TX_ID);
    getCorsProxyUrlOrThrow.mockResolvedValue('https://worker.example');
    fetchWorkerWithAuth.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'cf_01j7safeopaqueid',
          storageRef: {
            backend: 'cloudflare',
            id: 'cf_01j7safeopaqueid',
            uri: '/storage/read?id=cf_01j7safeopaqueid',
            contentType: 'application/json',
            resource: 'docsContext',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
  });

  test('keeps default Arweave upload path unchanged', async () => {
    const result = await uploadDataToSessionStorage({ ok: true }, 'json', {
      sessionSlug: 'alpha',
      sessionConfig: {},
      tags: [{ name: 'CE-DocStorage', value: 'arweave' }],
    });

    expect(arweaveClient.uploadDataToArweave).toHaveBeenCalledWith(
      { ok: true },
      'json',
      expect.objectContaining({ sessionSlug: 'alpha' }),
    );
    expect(fetchWorkerWithAuth).not.toHaveBeenCalled();
    expect(result.storageRef).toEqual({ backend: 'arweave', id: TX_ID, uri: `ar://${TX_ID}`, resource: 'docsContext' });
  });

  test('keeps lit-arweave available for encrypted payload storage refs', async () => {
    const result = await uploadDataToSessionStorage({ envelope: true }, 'json', {
      sessionSlug: 'alpha',
      sessionConfig: { storageProfile: { backend: 'lit-arweave' } },
      encrypted: true,
    });

    expect(arweaveClient.uploadDataToArweave).toHaveBeenCalledTimes(1);
    expect(result.storageRef).toEqual({
      backend: 'lit-arweave',
      id: TX_ID,
      uri: `lit-arweave://${TX_ID}`,
      encrypted: true,
      resource: 'docsContext',
    });
  });

  test('routes Cloudflare uploads through storage endpoint without exposing raw identifiers', async () => {
    const result = await uploadDataToSessionStorage({ ok: true }, 'json', {
      sessionSlug: 'alpha',
      sessionConfig: { storageProfile: { backend: 'cloudflare' } },
      context: { account: '0xabc' },
      requestId: 'answer:v1:json',
      tags: [{ name: 'CE-DocStorage', value: 'cloudflare' }],
    });

    expect(arweaveClient.uploadDataToArweave).not.toHaveBeenCalled();
    expect(fetchWorkerWithAuth).toHaveBeenCalledTimes(1);
    expect(String(fetchWorkerWithAuth.mock.calls[0][0])).toBe('https://worker.example/storage/upload');
    expect(JSON.parse(fetchWorkerWithAuth.mock.calls[0][1].body)).toEqual(
      expect.objectContaining({
        backend: 'cloudflare',
        resource: 'docsContext',
        requestId: 'answer:v1:json',
      }),
    );
    expect(JSON.stringify(result)).not.toMatch(/account|bucket|token|secret|r2:\/\//i);
    expect(result.storageRef.backend).toBe('cloudflare');
  });

  test('routes persisted Worker session-mode profiles through Cloudflare instead of requiring Arweave scope', async () => {
    await uploadDataToSessionStorage(new File(['image'], 'context.png', { type: 'image/png' }), 'file', {
      sessionSlug: 'demo-sh',
      sessionConfig: {
        corsWorkerUrl: 'https://worker.example',
        sessionModeProfile: {
          authority: { mode: 'worker_canonical' },
          storage: {
            backend: 'cloudflare',
            payloadAccessControl: { gate: 'none', encryption: 'none' },
          },
        },
      },
      resource: 'docsContext',
    });

    expect(arweaveClient.uploadDataToArweave).not.toHaveBeenCalled();
    expect(fetchWorkerWithAuth).toHaveBeenCalledTimes(1);
    expect(String(fetchWorkerWithAuth.mock.calls[0][0])).toBe('https://worker.example/storage/upload');
  });

  test.each([
    {
      label: 'public freeform',
      questionType: 'freeform',
      answer: 'Public answer',
      additional: 'Public note',
      accessControl: { gate: 'none', encryption: 'none' },
      expectedMode: 'public_read',
    },
    {
      label: 'Worker-envelope rating',
      questionType: 'rating',
      answer: 8,
      additional: 'Protected by the Worker',
      accessControl: {
        gate: 'role_gate',
        encryption: 'worker_envelope',
        accessConditions: {
          match: 'any',
          conditions: [{ kind: 'worker_role', role: 'member' }],
        },
      },
      expectedMode: 'worker_sbt_gate',
    },
  ])('normalizes and uploads $label survey responses at the correct encryption boundary', async (fixture) => {
    const payload = buildSingleQuestionResponsePayload(fixture);
    const sessionConfig = {
      storageProfile: {
        backend: 'cloudflare',
        resources: { responses: 'active' },
        payloadAccessControl: fixture.accessControl,
      },
    };
    const normalized = normalizeSessionStorageConfig(sessionConfig);

    expect(normalized.payloadAccessControl).toEqual(
      expect.objectContaining({
        gate: fixture.accessControl.gate,
        encryption: fixture.accessControl.encryption,
        mode: fixture.expectedMode,
      }),
    );
    expect(payload.answer).toEqual(
      expect.objectContaining({
        value: fixture.answer,
        encrypted: false,
        encryptedPortion: '',
      }),
    );
    expect(payload.additional).toEqual(
      expect.objectContaining({
        value: fixture.additional,
        encrypted: false,
        encryptedPortion: '',
      }),
    );

    await uploadDataToSessionStorage(payload, 'json', {
      sessionSlug: 'matrix-session',
      sessionConfig,
      resource: 'responses',
    });

    const requestBody = JSON.parse(fetchWorkerWithAuth.mock.calls[0][1].body);
    expect(requestBody).toEqual(
      expect.objectContaining({
        resource: 'responses',
        payloadEncrypted: false,
        data: payload,
      }),
    );
  });

  test.each(['arweave', 'cloudflare'])(
    'preserves quadratic definitions and response arrays through %s storage',
    async (backend) => {
      const question = { id: 'q1', type: 'quadratic', options: ['Parks', 'Transit'], voiceCredits: 25 };
      const response = buildSingleQuestionResponsePayload({
        questionType: question.type,
        options: question.options,
        voiceCredits: 25,
        answer: [3, -4],
        additional: '',
      });
      expect(response.answer.value).toEqual([3, -4]);
      for (const [resource, payload] of [
        ['questions', question],
        ['responses', response],
      ]) {
        await uploadDataToSessionStorage(payload, 'json', {
          resource,
          sessionSlug: 'matrix-session',
          sessionConfig: { storageProfile: { backend, resources: { questions: 'active', responses: 'active' } } },
        });
        if (backend === 'arweave') {
          expect(arweaveClient.uploadDataToArweave).toHaveBeenLastCalledWith(payload, 'json', expect.any(Object));
        } else {
          const request = JSON.parse(fetchWorkerWithAuth.mock.calls.at(-1)[1].body);
          expect(request.data).toEqual(payload);
          expect(request.resource).toBe(resource);
        }
      }
    },
  );

  test('uses an existing Worker credential for Cloudflare file uploads without triggering another auth flow', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'cf_01j7safeopaqueid',
          storageRef: {
            backend: 'cloudflare',
            id: 'cf_01j7safeopaqueid',
            uri: '/storage/read?id=cf_01j7safeopaqueid',
            contentType: 'image/png',
            resource: 'images',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const file = new File(['image'], 'group.png', { type: 'image/png' });

    const result = await uploadDataToSessionStorage(file, 'png', {
      sessionSlug: 'alpha',
      sessionConfig: { storageProfile: { backend: 'cloudflare' } },
      workerUrl: 'https://worker.example',
      credentialToken: 'existing-worker-token',
      requestId: 'answer:v1:form',
      fetchImpl,
      resource: 'images',
      contentType: 'image/png',
    });

    expect(fetchWorkerWithAuth).not.toHaveBeenCalled();
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://worker.example/storage/upload',
      expect.objectContaining({
        method: 'POST',
        headers: expect.any(Headers),
        body: expect.any(FormData),
      }),
    );
    const requestHeaders = fetchImpl.mock.calls[0][1].headers;
    expect(fetchImpl.mock.calls[0][1].body.get('requestId')).toBe('answer:v1:form');
    expect(requestHeaders.get('Authorization')).toBe('Bearer existing-worker-token');
    expect(requestHeaders.get('X-Group-Slug')).toBe('alpha');
    expect(result.storageRef.resource).toBe('images');
  });

  test('keeps the Worker status and reason on a rejected upload', async () => {
    fetchWorkerWithAuth.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: 'This question id already belongs to another author.',
          reason: 'storage_resource_id_owned',
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(
      uploadDataToSessionStorage({ id: '0xq' }, 'json', {
        sessionSlug: 'alpha',
        resource: 'questions',
        sessionConfig: { storageProfile: { backend: 'cloudflare', payloadAccessControl: { mode: 'public_read' } } },
      }),
    ).rejects.toMatchObject({
      message: 'This question id already belongs to another author.',
      status: 409,
      reason: 'storage_resource_id_owned',
    });
  });

  test('rejects plaintext uploads when Cloudflare lit_encrypted mode is selected', async () => {
    await expect(
      uploadDataToSessionStorage({ ok: true }, 'json', {
        sessionSlug: 'alpha',
        sessionConfig: {
          storageProfile: {
            backend: 'cloudflare',
            payloadAccessControl: { mode: 'lit_encrypted' },
          },
        },
      }),
    ).rejects.toThrow(/pre-encrypted payload/i);

    expect(fetchWorkerWithAuth).not.toHaveBeenCalled();
  });

  test('tries anonymous-first Cloudflare reads so public sessions do not prompt for wallet auth', async () => {
    fetchWorkerWithAuth.mockResolvedValueOnce(
      new Response('payload', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      }),
    );

    const response = await readSessionStorageBlob({
      storageRef: { backend: 'cloudflare', id: 'cf_01j7safeopaqueid' },
      sessionSlug: 'alpha',
      sessionConfig: { storageProfile: { backend: 'cloudflare', payloadAccessControl: { mode: 'public_read' } } },
    });

    expect(await response.text()).toBe('payload');
    expect(fetchWorkerWithAuth).toHaveBeenCalledWith(
      'https://worker.example/storage/read?id=cf_01j7safeopaqueid',
      { method: 'GET' },
      expect.objectContaining({ preferAnonymous: true }),
    );
  });

  test('tries anonymous-first Cloudflare lists and leaves gated fallback to worker auth', async () => {
    fetchWorkerWithAuth.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          items: [{ storageRef: { backend: 'cloudflare', id: 'cf_ref' } }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const page = await listSessionStorageRefsPage({
      sessionSlug: 'alpha',
      sessionConfig: { storageProfile: { backend: 'cloudflare' } },
      resource: 'questions',
    });

    expect(page.items).toHaveLength(1);
    expect(page.listComplete).toBe(true);
    expect(fetchWorkerWithAuth).toHaveBeenCalledWith(
      'https://worker.example/storage/list?resource=questions',
      { method: 'GET' },
      expect.objectContaining({ preferAnonymous: true }),
    );
  });

  test('propagates Cloudflare list cursors through the typed page helper', async () => {
    fetchWorkerWithAuth
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [], cursor: 'page-two', listComplete: false }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [{ storageRef: { backend: 'cloudflare', id: 'cf_page_two' } }],
            cursor: null,
            listComplete: true,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    const firstPage = await listSessionStorageRefsPage({
      sessionSlug: 'alpha',
      sessionConfig: { storageProfile: { backend: 'cloudflare' } },
      resource: 'questions',
      limit: 25,
    });
    const secondPage = await listSessionStorageRefsPage({
      sessionSlug: 'alpha',
      sessionConfig: { storageProfile: { backend: 'cloudflare' } },
      resource: 'questions',
      cursor: firstPage.cursor,
      limit: 25,
    });

    expect(firstPage).toEqual({ items: [], cursor: 'page-two', listComplete: false });
    expect(secondPage).toEqual({
      items: [{ storageRef: { backend: 'cloudflare', id: 'cf_page_two' } }],
      cursor: null,
      listComplete: true,
    });
    expect(fetchWorkerWithAuth.mock.calls.map(([url]) => url)).toEqual([
      'https://worker.example/storage/list?resource=questions&limit=25',
      'https://worker.example/storage/list?resource=questions&cursor=page-two&limit=25',
    ]);
  });
});

describe('complete own-answer listings', () => {
  const ownResponses = { account: '0xabc', sessionId: '0x1234' };
  const options = { workerUrl: 'https://worker.example', sessionSlug: 'alpha', resource: 'responses', ownResponses };
  // Recorded response shape from public 0.6.2, bfe30d54ab3ef653e7973bd29c941bc9409b628f:
  // storageRouteExecution.js handleCloudflareList ignores mine and returns only these top-level fields.
  it.each([
    { items: [], cursor: null, listComplete: true },
    { items: [{ metadata: { responder: '0xother' } }], cursor: 'page-two', listComplete: false },
  ])('recognizes the 0.6.2 listing without accepting it as scoped saved answers (%j)', async (body) => {
    fetchWorkerWithAuth.mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
    await expect(listSessionStorageRefsPage(options)).rejects.toBeInstanceOf(LegacyOwnResponseListingError);
  });
  it.each([
    [{ items: [], cursor: null, listComplete: true }, 201],
    [{ items: [], cursor: null, listComplete: true }, 403],
    [{ items: [], cursor: null, listComplete: false }, 200],
    [{ items: [], cursor: 'stale', listComplete: true }, 200],
    [{ items: [], cursor: null, listComplete: true, responder: null }, 200],
    [{ items: [], cursor: null, listComplete: true, sessionId: '0x1234' }, 200],
    [{ items: [], cursor: null, listComplete: true, responder: '0xabc' }, 200],
  ])('never downgrades errors, malformed pagination, or partial scope proofs (%j)', async (body, status) => {
    fetchWorkerWithAuth.mockResolvedValue(new Response(JSON.stringify(body), { status }));
    await expect(listSessionStorageRefsPage(options)).rejects.not.toBeInstanceOf(LegacyOwnResponseListingError);
  });
  it('never downgrades a current Worker on a later page', async () => {
    fetchWorkerWithAuth.mockResolvedValue(
      new Response(JSON.stringify({ items: [], cursor: null, listComplete: true })),
    );
    await expect(listSessionStorageRefsPage({ ...options, cursor: 'page-two' })).rejects.not.toBeInstanceOf(
      LegacyOwnResponseListingError,
    );
  });
  it('authenticates own listings and verifies the responder/session scope', async () => {
    fetchWorkerWithAuth.mockResolvedValue(
      new Response(
        JSON.stringify({
          ...ownResponses,
          responder: ownResponses.account,
          items: [],
          cursor: null,
          listComplete: true,
        }),
      ),
    );
    await expect(listSessionStorageRefsPage(options)).resolves.toEqual({ items: [], cursor: null, listComplete: true });
    expect(fetchWorkerWithAuth).toHaveBeenLastCalledWith(
      expect.stringContaining('mine=true'),
      expect.anything(),
      expect.objectContaining({ preferAnonymous: false }),
    );
  });
  it.each([
    { items: [], listComplete: true },
    { responder: '0xother', sessionId: '0x1234', items: [], listComplete: true },
    { responder: '0xabc', sessionId: '0x5678', items: [], listComplete: true },
    { responder: '0xabc', sessionId: '0x1234', items: [], listComplete: false },
  ])('rejects malformed or mismatched completion (%j)', async (body) => {
    fetchWorkerWithAuth.mockResolvedValue(new Response(JSON.stringify(body)));
    await expect(listSessionStorageRefsPage(options)).rejects.toThrow('complete saved answers');
  });
});
