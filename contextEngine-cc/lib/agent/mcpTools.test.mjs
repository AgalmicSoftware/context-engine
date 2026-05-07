// @contextengine-cc-fallback-test
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AGENT_MCP_TOOL_DEFINITIONS,
  buildAgentMcpHttpRequest,
  createAgentMcpToolHandlers,
} from './mcpTools.mjs';
import { AGENT_CANONICAL_ROUTES, routeKey as agentRouteKey } from './routeEquivalence.mjs';
import { ROUTE_INVENTORY_BY_KEY, routeKey as inventoryRouteKey } from '../routeInventory.mjs';

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
    'delegated_response_execute',
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
  assert.deepEqual(buildAgentMcpHttpRequest('list_questions', { session: ' general ' }), {
    method: 'GET',
    path: '/api/agent/questions?session=general',
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
  assert.deepEqual(buildAgentMcpHttpRequest('submit_response_request', {
    session: 'alpha',
    questionIds: ['0xabc'],
    idempotencyKey: 'submit:alpha.0001',
  }), {
    method: 'POST',
    path: '/api/agent/responses/submit-request',
    implemented: true,
    body: {
      session: 'alpha',
      questionIds: ['0xabc'],
      idempotencyKey: 'submit:alpha.0001',
    },
  });
  assert.deepEqual(buildAgentMcpHttpRequest('delegated_response_execute', {
    session: 'alpha',
    questionIds: ['0xabc'],
    grantId: 'agent_grant_abc12345',
    agentId: 'telegram:agent-1',
    idempotencyKey: 'delegated:alpha.0001',
  }), {
    method: 'POST',
    path: '/api/agent/responses/delegated-execute',
    implemented: true,
    body: {
      session: 'alpha',
      questionIds: ['0xabc'],
      grantId: 'agent_grant_abc12345',
      agentId: 'telegram:agent-1',
      idempotencyKey: 'delegated:alpha.0001',
    },
  });
  assert.deepEqual(buildAgentMcpHttpRequest('revoke_agent_grant', {
    grantId: 'agent_grant_abc12345',
  }), {
    method: 'POST',
    path: '/api/agent/grants/revoke',
    implemented: true,
    body: {
      grantId: 'agent_grant_abc12345',
    },
  });
});

test('MCP request builder rejects empty public sessions before HTTP', () => {
  assert.throws(
    () => buildAgentMcpHttpRequest('list_questions', { session: '' }),
    /explicit session/,
  );
  assert.throws(
    () => buildAgentMcpHttpRequest('draft_response', {
      session: ' ',
      questionId: '0x1',
      answer: 'yes',
    }),
    /explicit session/,
  );
  assert.throws(
    () => buildAgentMcpHttpRequest('get_inbox', { session: '' }),
    /explicit session/,
  );
  assert.throws(
    () => buildAgentMcpHttpRequest('list_questions', { session: '../bad' }),
    /Invalid agent MCP session slug/,
  );
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

test('MCP handlers pass HTTP error payloads through unchanged', async () => {
  const errorPayload = {
    ok: false,
    status: 'error',
    code: 'bad_request',
    error: 'session required.',
  };
  const handlers = createAgentMcpToolHandlers({
    fetchImpl: async () => ({
      async json() {
        return errorPayload;
      },
    }),
  });

  assert.deepEqual(await handlers.list_questions({ session: 'general' }), errorPayload);
});

test('MCP handlers reject invalid inputs before HTTP', async () => {
  let fetchCalls = 0;
  const handlers = createAgentMcpToolHandlers({
    fetchImpl: async () => {
      fetchCalls += 1;
      return {
        async json() {
          return { ok: true };
        },
      };
    },
  });

  await assert.rejects(
    () => handlers.draft_response({
      session: '',
      questionId: '0x1',
      answer: 'yes',
    }),
    /explicit session/,
  );
  await assert.rejects(
    () => handlers.submit_response_request({
      session: '../outside',
      questionIds: ['0xabc'],
    }),
    /Invalid agent MCP session slug/,
  );
  await assert.rejects(
    () => handlers.delegated_response_execute({
      session: '',
      questionIds: ['0xabc'],
      grantId: 'agent_grant_abc12345',
      agentId: 'telegram:agent-1',
    }),
    /explicit session/,
  );
  await assert.rejects(
    () => handlers.get_request_status({}),
    /requires requestId/,
  );
  assert.equal(fetchCalls, 0);
});

test('MCP submit wrapper preserves approval-required HTTP responses exactly', async () => {
  const approvalResponse = {
    ok: false,
    requiresApproval: true,
    requestId: 'agent_req_abc12345',
    approvalUrl: 'http://localhost:7391/agent/requests/agent_req_abc12345',
    status: 'pending_approval',
    request: {
      requestId: 'agent_req_abc12345',
      session: 'general',
    },
  };
  const handlers = createAgentMcpToolHandlers({
    fetchImpl: async () => ({
      async json() {
        return approvalResponse;
      },
    }),
  });

  assert.deepEqual(await handlers.submit_response_request({
    session: 'general',
    questionIds: ['0xabc'],
    idempotencyKey: 'submit:general.0001',
  }), approvalResponse);
});

test('MCP handler factory only exposes implemented tools', async () => {
  let fetchCalls = 0;
  const handlers = createAgentMcpToolHandlers({
    fetchImpl: async () => {
      fetchCalls += 1;
      return {
        async json() {
          return { ok: true };
        },
      };
    },
  });

  assert.equal(typeof handlers.submit_response_request, 'function');
  assert.equal(typeof handlers.delegated_response_execute, 'function');
  assert.equal(typeof handlers.revoke_agent_grant, 'function');
  assert.equal(Object.hasOwn(handlers, 'create_question_request'), false);
  assert.equal(Object.hasOwn(handlers, 'request_decrypt'), false);
  assert.throws(
    () => buildAgentMcpHttpRequest('create_question_request', { session: 'general' }),
    /not implemented/,
  );
  assert.equal(fetchCalls, 0);
});

test('implemented MCP tools map only to inventoried canonical agent HTTP routes', () => {
  const canonicalKeys = new Set(AGENT_CANONICAL_ROUTES.map(agentRouteKey));
  for (const tool of AGENT_MCP_TOOL_DEFINITIONS.filter((entry) => entry.implemented)) {
    const path = tool.path.includes(':id') ? tool.path : tool.path;
    const key = inventoryRouteKey({ method: tool.method, path });
    assert.ok(ROUTE_INVENTORY_BY_KEY[key], `${tool.name} route is missing from route inventory`);
    assert.ok(canonicalKeys.has(key), `${tool.name} route is missing from route equivalence`);
  }
});
