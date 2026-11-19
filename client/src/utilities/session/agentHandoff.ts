import { toStr } from '../shared/primitives';

// A person's AI agent working for them in a session, with a key that answers as them.

export const AGENT_KEY_ENV = 'CE_AGENT_TOKEN';

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

// A key is `ceagt_` and base64url characters, so it holds nothing a shell
// reads. The command is copied with the key masked on screen, so a reply
// with any other text in its place is refused, never pasted.
const AGENT_KEY_RE = /^ceagt_[A-Za-z0-9_-]{16,}$/;

export const buildAgentKeyCommand = (token: string): string => `export ${AGENT_KEY_ENV}='${token}'`;

// Names the variable, never the key, so the prompt is safe to paste into a chat. It names the session by its
// name, link and slug, so an agent that knows several can't take another for it.
export const buildOnMyBehalfPrompt = ({
  key,
  sessionName,
  sessionUrl,
}: {
  key: Pick<AgentDelegateKey, 'sessionSlug' | 'workerUrl' | 'submitAnswers'>;
  sessionName: string;
  sessionUrl: string;
}) =>
  [
    `Take part on my behalf in the Context Engine session ${JSON.stringify(sessionName || key.sessionSlug)}`,
    `(${sessionUrl}, slug "${key.sessionSlug}"), and in no other session you may know.`,
    `Its agent address is ${key.workerUrl}. Your key is in the ${AGENT_KEY_ENV} environment variable.`,
    `Send it only as the header "Authorization: Bearer $${AGENT_KEY_ENV}" to that address, and never print it or put it in chat, files or URLs.`,
    `Follow ${key.workerUrl}/api/agent/skill.`,
    key.submitAnswers
      ? 'Draft my answers, show them to me, and submit as me only the ones I approve.'
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
  if (!response.ok || body?.ok !== true || !AGENT_KEY_RE.test(token)) {
    throw new AgentDelegateKeyError(toStr(body?.reason), response.status);
  }
  // The prompt names the session and Worker that were asked, not what the reply calls them.
  return {
    token,
    expiresAt: toStr(body.expiresAt),
    sessionSlug,
    workerUrl: agentWorkerUrl,
    submitAnswers: body.submitAnswers === true,
  };
};
