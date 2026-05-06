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
    }, ['session', 'questionIds']),
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
    name: 'revoke_agent_grant',
    description: 'Future agent grant revocation route.',
    method: 'POST',
    path: '/api/agent/grants/revoke',
    implemented: false,
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

export function buildAgentMcpHttpRequest(toolName, args = {}) {
  const tool = AGENT_MCP_TOOLS_BY_NAME[String(toolName || '').trim()];
  if (!tool) throw new Error(`Unknown agent MCP tool: ${toolName}`);

  let path = tool.path;
  const query = {};
  if (path.includes(':id')) {
    const requestId = String(args.requestId || '').trim();
    if (!requestId) throw new Error(`${tool.name} requires requestId.`);
    path = path.replace(':id', encodeURIComponent(requestId));
  }
  if (tool.method === 'GET' && args.session) {
    query.session = args.session;
  }

  const request = {
    method: tool.method,
    path: appendQuery(path, query),
    implemented: tool.implemented,
  };
  if (tool.method !== 'GET') {
    request.body = { ...args };
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

  return Object.fromEntries(AGENT_MCP_TOOL_DEFINITIONS.map((tool) => [
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
