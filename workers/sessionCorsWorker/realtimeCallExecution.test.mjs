import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_INTERVIEW_REALTIME_MODEL,
  proxyOpenAiRealtimeCall,
  readRealtimeCallRequestPayload,
} from './realtimeCallExecution.js';

const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

test('readRealtimeCallRequestPayload accepts bounded SDP and rejects missing instructions', async () => {
  const accepted = await readRealtimeCallRequestPayload({
    request: new Request('https://worker.example/realtime/call', {
      method: 'POST',
      body: JSON.stringify({ sdp: 'v=0\r\no=test\r\n', instructions: 'Interview carefully.' }),
    }),
  });
  assert.equal(accepted.ok, true);
  assert.equal(accepted.payload.sdp, 'v=0\r\no=test\r\n');

  const rejected = await readRealtimeCallRequestPayload({
    request: new Request('https://worker.example/realtime/call', {
      method: 'POST',
      body: JSON.stringify({ sdp: 'v=0\r\no=test' }),
    }),
  });
  assert.equal(rejected.status, 400);
});

test('proxyOpenAiRealtimeCall keeps the API key server-side and pins current realtime defaults', async () => {
  let outbound;
  const response = await proxyOpenAiRealtimeCall({
    payload: { sdp: 'v=0\r\no=test\r\n', instructions: 'Ask one question.' },
    secrets: { openaiKey: 'test-secret' },
    config: {},
    baseHeaders: { 'access-control-allow-origin': 'https://app.example' },
    deps: {
      json,
      fetch: async (url, init) => {
        outbound = { url, init };
        return Response.json({ session: { id: 'live_test' }, transport: { type: 'webrtc', sdp: 'v=0\r\no=answer' } }, { status: 201 });
      },
    },
  });
  assert.equal(response.status, 200);
  assert.equal(outbound.url, 'https://api.openai.com/v1/live/sessions');
  assert.equal(outbound.init.headers.authorization, 'Bearer test-secret');
  assert.equal(outbound.init.headers['content-type'], 'application/json');
  const body = JSON.parse(outbound.init.body);
  assert.deepEqual(body.transport, { type: 'webrtc', sdp: 'v=0\r\no=test\r\n' });
  const session = body.session;
  assert.equal(DEFAULT_INTERVIEW_REALTIME_MODEL, 'gpt-live-1');
  assert.deepEqual(session, { model: 'gpt-live-1', instructions: 'Ask one question.', store: false, delegation: { type: 'client' } });
  assert.equal(response.headers.get('x-interview-protocol'), 'live');
  assert.match(response.headers.get('access-control-expose-headers'), /x-interview-protocol/);
  assert.equal(await response.text(), 'v=0\r\no=answer');
  assert.doesNotMatch(JSON.stringify(session), /test-secret/);
});

for (const model of ['gpt-realtime-2.1', 'gpt-realtime-2.1-mini', 'gpt-realtime-2', 'gpt-realtime-1.5']) {
  test(`preserves the verified legacy ${model} Realtime contract`, async () => {
    let outbound;
    const response = await proxyOpenAiRealtimeCall({
      payload: { sdp: 'v=0\r\no=test\r\n', instructions: 'Interview.' }, secrets: { openaiKey: 'fixture-key' },
      config: { interviewMode: { realtimeModel: model } }, deps: { json, fetch: async (url, init) => {
        outbound = new Request(url, init); return new Response('v=0\r\no=answer');
      } },
    });
    assert.equal(outbound.url, 'https://api.openai.com/v1/realtime/calls');
    const form = await outbound.formData(); const session = JSON.parse(form.get('session'));
    assert.equal(form.get('sdp'), 'v=0\r\no=test\r\n');
    assert.equal(session.model, model); assert.equal(session.type, 'realtime');
    assert.deepEqual(session.output_modalities, ['audio']);
    assert.deepEqual(session.audio.input, { transcription: { model: 'gpt-transcribe' }, turn_detection: { type: 'server_vad', create_response: true, interrupt_response: true } });
    assert.equal(response.headers.get('x-interview-protocol'), 'realtime');
  });
}

for (const model of ['gpt-live-1', 'gpt-realtime-invented', 'gpt-realtime', 'gpt-5']) {
  test(`resolves ${model} to the Live outbound request`, async () => {
    await proxyOpenAiRealtimeCall({
      payload: { sdp: 'v=0\r\n', instructions: 'Interview.' }, secrets: { openaiKey: 'fixture-key' },
      config: { interviewMode: { realtimeModel: model } }, deps: { json, fetch: async (url, init) => {
        assert.equal(url, 'https://api.openai.com/v1/live/sessions'); assert.equal(JSON.parse(init.body).session.model, 'gpt-live-1');
        return Response.json({ transport: { sdp: 'v=0\r\n' } });
      } },
    });
  });
}

test('sanitizes provider errors and rejects malformed successful connection answers', async () => {
  for (const result of [new Response(JSON.stringify({ error: { message: 'private upstream details fixture-key' } }), { status: 403 }), Response.json({ session: { id: 'live_test' } })]) {
    const response = await proxyOpenAiRealtimeCall({ payload: { sdp: 'v=0\r\n', instructions: 'Interview.' }, secrets: { openaiKey: 'fixture-key' }, config: {}, deps: { json, fetch: async () => result } });
    assert.ok(response.status >= 400); assert.doesNotMatch(await response.text(), /private|fixture-key/);
  }
});
