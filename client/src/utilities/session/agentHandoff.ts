import { toStr } from '../shared/primitives';

// A person's AI agent working for them in a session: suggesting answers, or answering as them with a
// short-lived key that the one prompt carries.

export const MCP_ADD_COMMAND =
  'claude mcp add --scope user context-engine -- npx -y --prefer-online @agalmic/contextengine@latest';

// The MCP, in the prompt rather than a box of its own, so the person copies one thing. Its tools act as the
// agent itself, so neither task needs it.
// Addressed only to an agent that already runs commands, so a chat AI without tools just does the task.
export const MCP_PROMPT_LINE = `Only if you are an agent that already runs commands: you can add the Context Engine MCP for later with: ${MCP_ADD_COMMAND} This task does not need it.`;

// The agent box is remounted per session and per account, so a key made for one
// account never stays on screen, or in the prompt, for the next.
export const agentHandoffPanelKey = (sessionSlug: string, account: unknown) =>
  `${sessionSlug}\n${toStr(account).toLowerCase()}`;

// "Answer for me" asks the person in the chat before submitting unless they untick "Ask me before submitting".
export const ASK_BEFORE_SUBMIT_DEFAULT = true;

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

/**
 * Why a key was not made, when it is none of the reasons the page has its own words for: what the session
 * answered (its status and short reason), or what failed before it could answer. Said so the person can pass it
 * on; it never carries a key or a sign-in.
 */
export const agentKeyFailureMessage = (error: unknown): string => {
  if (error instanceof AgentDelegateKeyError) {
    const reason = /^[a-z0-9_]{1,64}$/.test(error.reason) ? `, ${error.reason}` : '';
    return `Couldn't make a key: the session answered ${error.status || 'without one'}${reason}. Try again.`;
  }
  const text = (error instanceof Error ? error.message : '')
    .replace(/(?:ceagt_|eyJ)[\w.-]+/g, '[hidden]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  // A request the browser never completed: "Load failed" in Safari, "Failed to fetch" in Chrome.
  if (/load failed|failed to fetch|networkerror/i.test(text)) {
    return `Couldn't make a key: the session could not be reached (${text}). Try again.`;
  }
  return `Couldn't make a key${text ? ` (${text})` : ''}. Try again.`;
};

// A key is `ceagt_` and base64url characters, so a reply with any other text in its place is refused.
const AGENT_KEY_RE = /^ceagt_[A-Za-z0-9_-]{16,}$/;

// The one prompt for "Answer for me". With `askFirst`, the agent shows its answers in the chat and submits once
// the person says yes there; without it, the copied prompt is their approval, given in advance, so it
// submits without coming back to ask. Either way the person needn't return to the session's page. It carries the key, which lives only as long as
// the person's sign-in and works only in this session, and tells the agent never to repeat it. `shownToken`
// lets the box show the prompt with the key masked. It names the session by name, link and slug, so an agent
// that knows several can't take another for it.
export const buildOnMyBehalfPrompt = ({
  key,
  sessionName,
  sessionUrl,
  shownToken = key.token,
  askFirst = ASK_BEFORE_SUBMIT_DEFAULT,
}: {
  key: AgentDelegateKey;
  askFirst?: boolean;
  sessionName: string;
  sessionUrl: string;
  shownToken?: string;
}) =>
  [
    `Take part on my behalf in the Context Engine session ${JSON.stringify(sessionName || key.sessionSlug)}`,
    `(${sessionUrl}, slug "${key.sessionSlug}"), and in no other session you may know.`,
    `Its agent address is ${key.workerUrl}. Your key is ${shownToken}; it works only for this session, until ${key.expiresAt}.`,
    'I give it to you here on purpose, in place of the CE_AGENT_TOKEN variable the skill mentions, as it is short-lived.',
    'Send it only as the header "Authorization: Bearer <key>" to that address. Never repeat or print it, and never put it in files, URLs or later messages.',
    `Follow ${key.workerUrl}/api/agent/skill.`,
    !key.submitAnswers
      ? "This session doesn't let agents submit, so show me your draft answers and I'll answer on the website."
      : askFirst
        ? "Draft my answers from what you know about me and show them to me here in the chat. Submit them as me only after I say yes here; my yes is my approval, so then send submit: true with approved: true. Leave out any question you can't answer well from what you know, and afterwards tell me what you submitted."
        : "Draft my answers from what you know about me and submit them as me, without asking me again. With this prompt I approve now whatever answers you submit for me in this session, and I don't need to see them first, so send submit: true with approved: true. Leave out any question you can't answer well from what you know, and afterwards tell me what you submitted.",
    MCP_PROMPT_LINE,
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
  // The expiry goes into the prompt, so only a real date is taken, in one fixed form.
  const expiresMs = Date.parse(toStr(body?.expiresAt));
  if (!response.ok || body?.ok !== true || !AGENT_KEY_RE.test(token) || !Number.isFinite(expiresMs)) {
    throw new AgentDelegateKeyError(toStr(body?.reason), response.status);
  }
  // The prompt names the session and Worker that were asked, not what the reply calls them.
  return {
    token,
    expiresAt: new Date(expiresMs).toISOString(),
    sessionSlug,
    workerUrl: agentWorkerUrl,
    submitAnswers: body.submitAnswers === true,
  };
};
