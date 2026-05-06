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

test('implemented MCP tools map only to inventoried canonical agent HTTP routes', () => {
  const canonicalKeys = new Set(AGENT_CANONICAL_ROUTES.map(agentRouteKey));
  for (const tool of AGENT_MCP_TOOL_DEFINITIONS.filter((entry) => entry.implemented)) {
    const path = tool.path.includes(':id') ? tool.path : tool.path;
    const key = inventoryRouteKey({ method: tool.method, path });
    assert.ok(ROUTE_INVENTORY_BY_KEY[key], `${tool.name} route is missing from route inventory`);
    assert.ok(canonicalKeys.has(key), `${tool.name} route is missing from route equivalence`);
  }
});
