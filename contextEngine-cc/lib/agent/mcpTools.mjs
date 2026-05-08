const jsonSchema = (properties = {}, required = []) => Object.freeze({
  type: 'object',
  properties: Object.freeze(properties),
  required: Object.freeze(required),
  additionalProperties: false,
});

const stringProp = (description) => Object.freeze({ type: 'string', description });
const arrayOfStringsProp = (description) => Object.freeze({
  type: 'array',
  items: Object.freeze({ type: 'string' }),
  description,
});
const SESSION_SLUG_RE = /^[a-z0-9_-]+$/i;
const MAX_SESSION_SLUG_LENGTH = 128;
const REQUIRED_SESSION_TOOLS = new Set([
  'list_questions',
  'resolve_questions',
  'next_question',
  'draft_response',
  'submit_response_request',
  'delegated_response_execute',
]);

export const AGENT_MCP_TOOL_DEFINITIONS = Object.freeze([
  {
    name: 'connect',
    description: 'Read the canonical agent identity and capability shape.',
    method: 'GET',
    path: '/api/agent/me',
    implemented: true,
    inputSchema: jsonSchema(),
  },
  {
    name: 'auth_status',
    description: 'Read local auth and worker-token readiness from the agent identity route.',
    method: 'GET',
    path: '/api/agent/me',
    implemented: true,
    inputSchema: jsonSchema(),
  },
  {
    name: 'list_sessions',
    description: 'List sessions visible to the local agent contract.',
    method: 'GET',
    path: '/api/agent/sessions',
    implemented: true,
    inputSchema: jsonSchema(),
  },
  {
    name: 'get_session',
    description: 'Read the session list while selecting one session client-side.',
    method: 'GET',
    path: '/api/agent/sessions',
    implemented: true,
    inputSchema: jsonSchema({ session: stringProp('Session slug to select from the returned list.') }),
  },
  {
    name: 'list_questions',
    description: 'List the next canonical question payload for a session.',
    method: 'GET',
    path: '/api/agent/questions',
    implemented: true,
    inputSchema: jsonSchema({ session: stringProp('Session slug.') }, ['session']),
  },
  {
    name: 'resolve_questions',
    description: 'Resolve question metadata through the canonical question route.',
    method: 'GET',
    path: '/api/agent/questions',
    implemented: true,
    inputSchema: jsonSchema({ session: stringProp('Session slug.') }, ['session']),
  },
  {
    name: 'next_question',
    description: 'Fetch the next agent-safe question payload for a session.',
    method: 'GET',
    path: '/api/agent/questions',
    implemented: true,
    inputSchema: jsonSchema({ session: stringProp('Session slug.') }, ['session']),
  },
  {
    name: 'draft_response',
    description: 'Store an agent response draft without submitting on-chain.',
    method: 'POST',
    path: '/api/agent/responses/draft',
    implemented: true,
    inputSchema: jsonSchema({
      session: stringProp('Session slug.'),
      questionId: stringProp('32-byte hex question id.'),
      answer: stringProp('Response answer.'),
      questionType: stringProp('Question type.'),
    }, ['session', 'questionId', 'answer']),
  },
  {
    name: 'submit_response_request',
    description: 'Create an approval-gated response submission request.',
    method: 'POST',
    path: '/api/agent/responses/submit-request',
    implemented: true,
    inputSchema: jsonSchema({
      session: stringProp('Session slug.'),
      questionIds: arrayOfStringsProp('32-byte hex question ids to submit after approval.'),
      idempotencyKey: stringProp('Optional client-provided idempotency key.'),
    }, ['session', 'questionIds']),
  },
  {
    name: 'delegated_response_execute',
    description: 'Validate a scoped delegated response execution grant and record the contract-only audit envelope.',
    method: 'POST',
    path: '/api/agent/responses/delegated-execute',
    implemented: true,
    inputSchema: jsonSchema({
      session: stringProp('Session slug.'),
      questionIds: arrayOfStringsProp('32-byte hex question ids to execute under a scoped grant.'),
      grantId: stringProp('Scoped delegated grant id.'),
      agentId: stringProp('Delegated agent identity bound to the grant.'),
      idempotencyKey: stringProp('Optional client-provided idempotency key.'),
    }, ['session', 'questionIds', 'grantId', 'agentId']),
  },
  {
    name: 'create_connect_request',
    description: 'Create a human-approval-required scoped grant connect request.',
    method: 'POST',
    path: '/api/agent/connect-requests',
    implemented: true,
    inputSchema: jsonSchema({
      agentId: stringProp('Delegated agent identity requesting the scoped grant.'),
      requestedScopes: arrayOfStringsProp('Requested agent grant scopes.'),
      requestedSessions: arrayOfStringsProp('Explicit public session slugs.'),
      requestedActions: arrayOfStringsProp('Canonical agent action ids allowed by the grant.'),
      riskCeiling: stringProp('Maximum allowed risk level.'),
      executionPolicy: stringProp('Requested execution policy.'),
      expiresAt: stringProp('Grant request expiration timestamp.'),
      idempotencyKey: stringProp('Client-provided idempotency key.'),
    }, ['agentId', 'requestedScopes', 'requestedSessions', 'requestedActions', 'riskCeiling', 'executionPolicy', 'expiresAt', 'idempotencyKey']),
  },
  {
    name: 'create_question_request',
    description: 'Future approval-gated question creation request.',
    method: 'POST',
    path: '/api/agent/questions/create-request',
    implemented: false,
    inputSchema: jsonSchema({
      session: stringProp('Session slug.'),
    }, ['session']),
  },
  {
    name: 'get_inbox',
    description: 'Read local pending-response and approval-request summaries.',
    method: 'GET',
    path: '/api/agent/inbox',
    implemented: true,
    inputSchema: jsonSchema({ session: stringProp('Optional session slug.') }),
  },
  {
    name: 'get_request_status',
    description: 'Read approval request status by opaque request id.',
    method: 'GET',
    path: '/api/agent/requests/:id',
    implemented: true,
    inputSchema: jsonSchema({ requestId: stringProp('Opaque agent request id.') }, ['requestId']),
  },
  {
    name: 'get_connect_request',
    description: 'Read scoped grant connect request status by opaque request id.',
    method: 'GET',
    path: '/api/agent/connect-requests/:id',
    implemented: true,
    inputSchema: jsonSchema({ requestId: stringProp('Opaque agent connect request id.') }, ['requestId']),
  },
  {
    name: 'request_decrypt',
    description: 'Future approval-gated decrypt request.',
    method: 'POST',
    path: '/api/agent/decrypt/request',
    implemented: false,
    inputSchema: jsonSchema({
      session: stringProp('Session slug.'),
      resourceId: stringProp('Encrypted resource identifier.'),
    }, ['session', 'resourceId']),
  },
  {
    name: 'request_session_storage_access',
    description: 'Future session-worker-backed request for SBT-gated Cloudflare storage snippets, uploads, short reads, or downloads.',
    method: 'POST',
    path: '/api/agent/session-storage/access-request',
    implemented: false,
    inputSchema: jsonSchema({
      session: stringProp('Session slug.'),
      resourceId: stringProp('Document or context resource identifier.'),
      operation: stringProp('Storage operation such as upload_permission, query_snippet, short_read, or download.'),
      storageProfile: stringProp('Session storage profile, for example cloudflare.'),
    }, ['session', 'resourceId', 'operation', 'storageProfile']),
  },
  {
    name: 'revoke_agent_grant',
    description: 'Revoke an existing scoped agent grant by id.',
    method: 'POST',
    path: '/api/agent/grants/revoke',
    implemented: true,
    inputSchema: jsonSchema({ grantId: stringProp('Grant id to revoke.') }, ['grantId']),
  },
]);

export const AGENT_MCP_TOOLS_BY_NAME = Object.freeze(
  Object.fromEntries(AGENT_MCP_TOOL_DEFINITIONS.map((tool) => [tool.name, Object.freeze({ ...tool })]))
);

function appendQuery(path, params = {}) {
  const cleanEntries = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '');
  if (!cleanEntries.length) return path;
  const query = new URLSearchParams(cleanEntries.map(([key, value]) => [key, String(value)]));
  return `${path}?${query.toString()}`;
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function normalizeAgentMcpSessionArg(toolName, args = {}) {
  const hasSession = hasOwn(args, 'session');
  const session = hasSession ? String(args.session ?? '').trim() : '';
  if (!session) {
    if (REQUIRED_SESSION_TOOLS.has(toolName) || hasSession) {
      throw new Error('Agent MCP tools require an explicit session; use "general" for the general session.');
    }
    return '';
  }
  if (session.length > MAX_SESSION_SLUG_LENGTH || !SESSION_SLUG_RE.test(session)) {
    throw new Error('Invalid agent MCP session slug.');
  }
  return session;
}

export function buildAgentMcpHttpRequest(toolName, args = {}) {
  const tool = AGENT_MCP_TOOLS_BY_NAME[String(toolName || '').trim()];
  if (!tool) throw new Error(`Unknown agent MCP tool: ${toolName}`);
  if (!tool.implemented) throw new Error(`Agent MCP tool is not implemented: ${tool.name}`);

  let path = tool.path;
  const query = {};
  const session = normalizeAgentMcpSessionArg(tool.name, args);
  if (path.includes(':id')) {
    const requestId = String(args.requestId || '').trim();
    if (!requestId) throw new Error(`${tool.name} requires requestId.`);
    path = path.replace(':id', encodeURIComponent(requestId));
  }
  if (tool.method === 'GET' && session) {
    query.session = session;
  }

  const request = {
    method: tool.method,
    path: appendQuery(path, query),
    implemented: tool.implemented,
  };
  if (tool.method !== 'GET') {
    request.body = { ...args };
    if (session) request.body.session = session;
  }
  return request;
}

export function createAgentMcpToolHandlers({
  baseUrl = 'http://localhost:7391',
  fetchImpl = globalThis.fetch,
  tokenProvider = null,
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('createAgentMcpToolHandlers requires fetchImpl.');
  }
  const base = String(baseUrl || 'http://localhost:7391').replace(/\/+$/, '');

  return Object.fromEntries(AGENT_MCP_TOOL_DEFINITIONS.filter((tool) => tool.implemented).map((tool) => [
    tool.name,
    async (args = {}) => {
      const request = buildAgentMcpHttpRequest(tool.name, args);
      const headers = { Accept: 'application/json' };
      const token = typeof tokenProvider === 'function' ? await tokenProvider() : null;
      if (token) headers.Authorization = `Bearer ${token}`;
      if (request.body) headers['Content-Type'] = 'application/json';
      const response = await fetchImpl(`${base}${request.path}`, {
        method: request.method,
        headers,
        body: request.body ? JSON.stringify(request.body) : undefined,
      });
      const payload = await response.json();
      return payload;
    },
  ]));
}
