import { toStr } from '../shared/primitives';

// Two ways a person brings their AI agent to a session: as itself, through the
// MCP with its own key, or on their behalf, with a key that answers as them.

export const AGENT_KEY_ENV = 'CE_AGENT_TOKEN';
export const MCP_SERVER_COMMAND = 'npx -y --prefer-online @agalmic/contextengine@latest';

export type AgentDelegateKey = {
  token: string;
  expiresAt: string;
  sessionSlug: string;
  workerUrl: string;
  submitAnswers: boolean;
};

export class AgentDelegateKeyError extends Error {
  reason: string;
  status: number;

  constructor(reason: string, status: number) {
    super(reason);
    this.reason = reason;
    this.status = status;
  }
}

// The name goes inside a double-quoted shell argument, so it keeps none of the
// characters a shell reads there, nor `!`, which history-expands.
export const agentDisplayName = (ownerName: unknown): string => {
  const name = toStr(ownerName)
    .replace(/[\p{Cc}"$`\\!]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40)
    .trim();
  return name ? `${name}'s Kami` : '';
};

export const buildMcpAddCommand = (displayName: string): string =>
  `claude mcp add context-engine --scope user${
    displayName ? ` -e CE_MCP_DISPLAY_NAME="${displayName}"` : ''
  } -- ${MCP_SERVER_COMMAND}`;

export const buildMcpJoinPrompt = ({ sessionUrl, displayName }: { sessionUrl: string; displayName: string }): string =>
  [
    `Join the Context Engine session ${sessionUrl} with join_session and take part as yourself, an AI agent${
      displayName ? ` named "${displayName}"` : ''
    }.`,
    "Read the session's instructions first, answer honestly in your own voice, and never claim to be a person.",
  ].join(' ');

export const buildAgentKeyCommand = (token: string): string => `export ${AGENT_KEY_ENV}='${token}'`;

// Names the variable, never the key, so the prompt is safe to paste into a chat.
export const buildOnMyBehalfPrompt = (key: Pick<AgentDelegateKey, 'sessionSlug' | 'workerUrl' | 'submitAnswers'>) =>
  [
    `Take part in the Context Engine session "${key.sessionSlug}" at ${key.workerUrl} on my behalf.`,
    `Your key is in the ${AGENT_KEY_ENV} environment variable. Send it only as the header "Authorization: Bearer $${AGENT_KEY_ENV}" to that address, and never print it or put it in chat, files or URLs.`,
    `Follow ${key.workerUrl}/api/agent/skill.`,
    key.submitAnswers
      ? 'Show me your draft answers, and submit only the ones I approve.'
      : "This session doesn't let agents submit, so show me your draft answers and I'll answer on the website.",
  ].join(' ');

export const requestAgentDelegateKey = async ({
  agentWorkerUrl,
  sessionSlug,
  workerToken,
  fetchImpl = fetch,
}: {
  agentWorkerUrl: string;
  sessionSlug: string;
  workerToken: string;
  fetchImpl?: typeof fetch;
}): Promise<AgentDelegateKey> => {
  // Only these two headers, which the agent routes allow across origins.
  const response = await fetchImpl(`${agentWorkerUrl}/api/agent/credentials/delegate`, {
    method: 'POST',
    cache: 'no-store',
    headers: { Authorization: `Bearer ${workerToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionSlug }),
  });
  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  const token = toStr(body?.token);
  if (!response.ok || body?.ok !== true || !token.startsWith('ceagt_')) {
    throw new AgentDelegateKeyError(toStr(body?.reason), response.status);
  }
  return {
    token,
    expiresAt: toStr(body.expiresAt),
    sessionSlug: toStr(body.sessionSlug),
    workerUrl: toStr(body.workerUrl),
    submitAnswers: body.submitAnswers === true,
  };
};
