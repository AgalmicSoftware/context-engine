import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AGENT_MCP_TOOL_DEFINITIONS,
  buildAgentMcpHttpRequest,
  createAgentMcpToolHandlers,
} from './mcpTools.mjs';

test('MCP tool descriptors cover the planned agent tool names', () => {
  assert.deepEqual(AGENT_MCP_TOOL_DEFINITIONS.map((tool) => tool.name), [
    'connect',
    'auth_status',
    'list_sessions',
    'get_session',
    'list_questions',
    'resolve_questions',
    'next_question',
    'draft_response',
    'submit_response_request',
    'create_question_request',
    'get_inbox',
    'get_request_status',
    'request_decrypt',
    'revoke_agent_grant',
  ]);
});

test('MCP request builder maps tools to canonical agent HTTP paths', () => {
  assert.deepEqual(buildAgentMcpHttpRequest('list_questions', { session: 'alpha' }), {
    method: 'GET',
    path: '/api/agent/questions?session=alpha',
    implemented: true,
  });
  assert.deepEqual(buildAgentMcpHttpRequest('get_request_status', { requestId: 'agent_req_abc12345' }), {
    method: 'GET',
    path: '/api/agent/requests/agent_req_abc12345',
    implemented: true,
  });
  assert.deepEqual(buildAgentMcpHttpRequest('draft_response', {
    session: 'alpha',
    questionId: '0x1',
    answer: 'yes',
  }), {
    method: 'POST',
    path: '/api/agent/responses/draft',
    implemented: true,
    body: {
      session: 'alpha',
      questionId: '0x1',
      answer: 'yes',
    },
  });
});

test('MCP handlers mirror HTTP JSON responses without adding business logic', async () => {
  const calls = [];
  const handlers = createAgentMcpToolHandlers({
    baseUrl: 'http://localhost:7391/',
    tokenProvider: async () => 'local.jwt',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return {
        async json() {
          return { ok: true, status: 'ok', url, method: init.method };
        },
      };
    },
  });

  const payload = await handlers.submit_response_request({
    session: 'alpha',
    questionIds: ['0xabc'],
  });

  assert.deepEqual(payload, {
    ok: true,
    status: 'ok',
    url: 'http://localhost:7391/api/agent/responses/submit-request',
    method: 'POST',
  });
  assert.equal(calls[0].init.headers.Authorization, 'Bearer local.jwt');
  assert.equal(calls[0].init.body, '{"session":"alpha","questionIds":["0xabc"]}');
});
