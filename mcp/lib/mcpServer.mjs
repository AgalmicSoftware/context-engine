// Minimal Model Context Protocol server over stdio: newline-delimited
// JSON-RPC 2.0 with the tools capability only. Protocol output goes to the
// given writer (stdout); diagnostics belong on stderr.

export const SUPPORTED_PROTOCOL_VERSIONS = Object.freeze(['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05']);
const LATEST_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0];
const STRUCTURED_CONTENT_SINCE = '2025-06-18';
// JSON-RPC batches were allowed only by the 2025-03-26 revision.
const BATCH_PROTOCOL_VERSIONS = Object.freeze(['2025-03-26']);

const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const INTERNAL_ERROR = -32603;

const isRecord = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const hasId = (message) => Object.prototype.hasOwnProperty.call(message, 'id');
const isValidId = (id) => typeof id === 'string' || (typeof id === 'number' && Number.isFinite(id));

const errorResponse = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });
const resultResponse = (id, result) => ({ jsonrpc: '2.0', id, result });

// Error text reaches both the client and the log, so it is redacted even when
// it bypassed lib/chainErrors.mjs: ethers appends request bodies, signed
// transactions and the RPC URL as "(key=…)" details, and API keys ride in URL
// credentials, paths and queries.
const MAX_ERROR_LENGTH = 1000;
const DIAGNOSTICS = /\[ See: |\((?=\w+=)|\b(?:requestBody|body|url|transaction|data|error)=/i;
const URLS = /\b[a-z][\w+.-]*:\/\/[^\s"'`]+/gi;
// Example links such as /session/<slug> are not endpoints.
const hostOnly = (url) => (/<\w+>/.test(url) ? url : url.replace(/^([^:]+:\/\/)(?:[^/?#]*@)?([^/?#]*)[\s\S]*$/, '$1$2'));

export const describeError = (error) => {
  const text = String(error?.message || error || '').slice(0, MAX_ERROR_LENGTH);
  const cut = text.search(DIAGNOSTICS);
  return (cut < 0 ? text : text.slice(0, cut)).trimEnd().replace(URLS, hostOnly) || 'Unknown error.';
};

// Long enough for an SBT claim that waits for funding, a commit, and a reveal.
const DEFAULT_TOOL_TIMEOUT_MS = 15 * 60 * 1000;

/**
 * Creates the protocol core. `tools` is a list of
 * `{ name, title, description, inputSchema, annotations, handler }` where
 * `handler(args)` resolves to a JSON-serializable value or throws.
 */
export const createMcpServer = ({
  serverInfo,
  instructions = '',
  tools = [],
  log = () => {},
  toolTimeoutMs = DEFAULT_TOOL_TIMEOUT_MS,
} = {}) => {
  const toolsByName = new Map(tools.map((tool) => [tool.name, tool]));
  let protocolVersion = LATEST_PROTOCOL_VERSION;
  // Tool calls share session state, so run them one at a time. A call that is
  // cancelled or runs past the time limit releases the queue for the next one.
  let toolQueue = Promise.resolve();
  const cancellers = new Map();

  const listTools = () =>
    tools.map(({ name, title, description, inputSchema, annotations }) => ({
      name,
      ...(title ? { title } : {}),
      description,
      inputSchema,
      ...(annotations ? { annotations } : {}),
    }));

  const toolResult = (value, isError = false) => {
    const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    const result = { content: [{ type: 'text', text }] };
    if (!isError && isRecord(value) && protocolVersion >= STRUCTURED_CONTENT_SINCE) {
      result.structuredContent = value;
    }
    if (isError) result.isError = true;
    return result;
  };

  const callTool = (params, requestId) => {
    const name = params?.name;
    const tool = typeof name === 'string' ? toolsByName.get(name) : null;
    if (!tool) return { error: { code: INVALID_PARAMS, message: `Unknown tool: ${String(name).slice(0, 100)}` } };
    const args = params?.arguments === undefined ? {} : params.arguments;
    if (!isRecord(args)) return { error: { code: INVALID_PARAMS, message: 'Tool arguments must be an object.' } };
    const controller = new AbortController();
    let stoppedBy = '';
    const stop = (reason) => {
      if (!stoppedBy) stoppedBy = reason;
      controller.abort();
    };
    cancellers.set(requestId, () => stop('cancelled'));
    const run = toolQueue.then(async () => {
      // Cancelled while waiting in the queue: never start it.
      if (stoppedBy === 'cancelled') {
        cancellers.delete(requestId);
        return { cancelled: true };
      }
      const timer = setTimeout(() => stop('timeout'), toolTimeoutMs);
      try {
        // Handlers check the signal between side effects; the queue moves on
        // only once this call has actually stopped, so calls never overlap.
        const value = await tool.handler(args, { signal: controller.signal });
        if (stoppedBy === 'cancelled') return { cancelled: true };
        return { result: toolResult(value) };
      } catch (error) {
        if (stoppedBy === 'cancelled') return { cancelled: true };
        if (stoppedBy === 'timeout') {
          return { result: toolResult('The tool reached its time limit and stopped; part of its work may already be done. Check before retrying.', true) };
        }
        log(`tool ${name} failed: ${describeError(error)}`);
        return { result: toolResult(describeError(error), true) };
      } finally {
        clearTimeout(timer);
        cancellers.delete(requestId);
      }
    });
    toolQueue = run.catch(() => {});
    return run;
  };

  const cancelRequest = (params) => {
    const requestId = params?.requestId;
    if (isValidId(requestId)) cancellers.get(requestId)?.();
  };

  const handleRequest = async (message) => {
    const { id, method, params } = message;
    switch (method) {
      case 'initialize': {
        const requested = params?.protocolVersion;
        protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.includes(requested) ? requested : LATEST_PROTOCOL_VERSION;
        return resultResponse(id, {
          protocolVersion,
          capabilities: { tools: { listChanged: false } },
          serverInfo,
          ...(instructions ? { instructions } : {}),
        });
      }
      case 'ping':
        return resultResponse(id, {});
      case 'tools/list':
        return resultResponse(id, { tools: listTools() });
      case 'tools/call': {
        const outcome = await callTool(params, id);
        // A cancelled request gets no response.
        if (outcome.cancelled) return null;
        return outcome.error ? errorResponse(id, outcome.error.code, outcome.error.message) : resultResponse(id, outcome.result);
      }
      default:
        return errorResponse(id, METHOD_NOT_FOUND, `Method not found: ${String(method)}`);
    }
  };

  // Returns the response for one decoded message, or null for notifications.
  const handleMessage = async (message) => {
    if (!isRecord(message) || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
      if (isRecord(message) && hasId(message) && !('method' in message)) return null; // a response; we send no requests
      const id = isRecord(message) && isValidId(message.id) ? message.id : null;
      return errorResponse(id, INVALID_REQUEST, 'Invalid JSON-RPC request.');
    }
    if (!hasId(message)) {
      if (message.method === 'notifications/cancelled') cancelRequest(message.params);
      return null; // notifications/initialized and others
    }
    if (!isValidId(message.id)) return errorResponse(null, INVALID_REQUEST, 'Invalid JSON-RPC id.');
    try {
      return await handleRequest(message);
    } catch (error) {
      log(`request ${message.method} failed: ${describeError(error)}`);
      return errorResponse(message.id, INTERNAL_ERROR, 'Internal error.');
    }
  };

  // Handles one line of input; returns the serialized reply line or ''.
  const handleLine = async (line) => {
    const text = String(line || '').trim();
    if (!text) return '';
    let decoded;
    try {
      decoded = JSON.parse(text);
    } catch {
      return JSON.stringify(errorResponse(null, PARSE_ERROR, 'Parse error.'));
    }
    if (Array.isArray(decoded)) {
      if (!BATCH_PROTOCOL_VERSIONS.includes(protocolVersion)) {
        return JSON.stringify(errorResponse(null, INVALID_REQUEST, 'Batched requests are not supported by this protocol version.'));
      }
      if (!decoded.length) return JSON.stringify(errorResponse(null, INVALID_REQUEST, 'Empty batch.'));
      const replies = (
        await Promise.all(
          decoded.map((message) =>
            isRecord(message) && message.method === 'initialize'
              ? errorResponse(isValidId(message.id) ? message.id : null, INVALID_REQUEST, 'initialize cannot be batched.')
              : handleMessage(message),
          ),
        )
      ).filter(Boolean);
      return replies.length ? JSON.stringify(replies) : '';
    }
    const reply = await handleMessage(decoded);
    return reply ? JSON.stringify(reply) : '';
  };

  return { handleLine, handleMessage, listTools };
};

/** Connects a server to newline-delimited streams (stdin/stdout by default). */
export const serveStdio = (server, { input = process.stdin, output = process.stdout, log = () => {} } = {}) =>
  new Promise((resolve) => {
    let buffer = '';
    let pending = Promise.resolve();
    const write = (line) => {
      if (line) output.write(`${line}\n`);
    };
    input.setEncoding?.('utf8');
    input.on('data', (chunk) => {
      buffer += chunk;
      let newline = buffer.indexOf('\n');
      while (newline >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        // Answer each line as soon as it is handled; tool calls queue internally.
        const handled = server.handleLine(line).then(write, (error) => log(`write failed: ${describeError(error)}`));
        pending = pending.then(() => handled);
        newline = buffer.indexOf('\n');
      }
    });
    input.on('end', () => {
      const tail = buffer;
      buffer = '';
      pending = pending.then(() => server.handleLine(tail).then(write));
      pending.then(resolve, resolve);
    });
  });
