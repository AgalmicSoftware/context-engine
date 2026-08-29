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
        return new Response('v=0\r\no=answer', { status: 200 });
      },
    },
  });
  assert.equal(response.status, 200);
  assert.equal(outbound.url, 'https://api.openai.com/v1/realtime/calls');
  assert.equal(outbound.init.headers.authorization, 'Bearer test-secret');
  assert.match(outbound.init.headers['content-type'], /^multipart\/form-data; boundary=/);
  assert.doesNotMatch(outbound.init.body, /filename=/i);
  const outboundRequest = new Request(outbound.url, outbound.init);
  const outboundForm = await outboundRequest.formData();
  assert.equal(outboundForm.get('sdp'), 'v=0\r\no=test\r\n');
  const session = JSON.parse(outboundForm.get('session'));
  assert.equal(session.model, DEFAULT_INTERVIEW_REALTIME_MODEL);
  assert.equal(session.audio.input.transcription.model, 'gpt-transcribe');
  assert.doesNotMatch(JSON.stringify(session), /test-secret/);
});
