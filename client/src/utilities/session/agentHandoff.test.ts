import {
  AgentDelegateKeyError,
  agentDisplayName,
  buildAgentKeyCommand,
  buildMcpAddCommand,
  buildMcpJoinPrompt,
  buildOnMyBehalfPrompt,
  requestAgentDelegateKey,
} from './agentHandoff';

const key = {
  token: 'ceagt_secret',
  expiresAt: '2026-11-24T16:00:00.000Z',
  sessionSlug: 'salon',
  workerUrl: 'https://ce-salon.example.workers.dev',
  submitAnswers: true,
};

describe('agent hand-off texts', () => {
  it('names the agent after its person, without anything a shell reads in double quotes', () => {
    expect(agentDisplayName('  Audrey  ')).toBe("Audrey's Kami");
    expect(agentDisplayName('Au"d$r`e\\y!\u0007')).toBe("Audrey's Kami");
    expect(agentDisplayName('x'.repeat(80))).toBe(`${'x'.repeat(40)}'s Kami`);
    expect(agentDisplayName('   ')).toBe('');
  });

  it('adds the MCP for every project, named when the person gave a name', () => {
    expect(buildMcpAddCommand("Audrey's Kami")).toBe(
      'claude mcp add context-engine --scope user -e CE_MCP_DISPLAY_NAME="Audrey\'s Kami" -- npx -y --prefer-online @agalmic/contextengine@latest',
    );
    expect(buildMcpAddCommand('')).toBe(
      'claude mcp add context-engine --scope user -- npx -y --prefer-online @agalmic/contextengine@latest',
    );
  });

  it('asks the agent to join as itself with the session link', () => {
    const prompt = buildMcpJoinPrompt({
      sessionUrl: 'https://site.example/session/salon',
      displayName: "Audrey's Kami",
    });
    expect(prompt).toContain('https://site.example/session/salon with join_session');
    expect(prompt).toContain('named "Audrey\'s Kami"');
    expect(prompt).toContain('never claim to be a person');
  });

  it('keeps the key out of the prompt that goes into the chat', () => {
    const prompt = buildOnMyBehalfPrompt(key);
    expect(prompt).not.toContain('ceagt_');
    expect(prompt).toContain('"Authorization: Bearer $CE_AGENT_TOKEN"');
    expect(prompt).toContain('https://ce-salon.example.workers.dev/api/agent/skill');
    expect(prompt).toContain('submit only the ones I approve');
    expect(buildOnMyBehalfPrompt({ ...key, submitAnswers: false })).toContain("doesn't let agents submit");
    expect(buildAgentKeyCommand(key.token)).toBe("export CE_AGENT_TOKEN='ceagt_secret'");
  });
});

describe('requestAgentDelegateKey', () => {
  const reply = (status: number, body: unknown) =>
    jest.fn(async (..._args: Parameters<typeof fetch>) => new Response(JSON.stringify(body), { status }));

  it('asks the Worker with only the sign-in and content type, which agent routes allow across origins', async () => {
    const fetchImpl = reply(200, { ok: true, ...key, scopes: ['read_questions', 'draft_answers'] });
    await expect(
      requestAgentDelegateKey({ agentWorkerUrl: key.workerUrl, sessionSlug: 'salon', workerToken: 'jwt', fetchImpl }),
    ).resolves.toEqual(key);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://ce-salon.example.workers.dev/api/agent/credentials/delegate');
    expect(init?.headers).toEqual({ Authorization: 'Bearer jwt', 'Content-Type': 'application/json' });
    expect(JSON.parse(String(init?.body))).toEqual({ sessionSlug: 'salon' });
  });

  it("reports the Worker's reason and status", async () => {
    const fetchImpl = reply(403, { ok: false, reason: 'agent_http_disabled' });
    const refused = requestAgentDelegateKey({
      agentWorkerUrl: key.workerUrl,
      sessionSlug: 'salon',
      workerToken: 'jwt',
      fetchImpl,
    });
    await expect(refused).rejects.toBeInstanceOf(AgentDelegateKeyError);
    await expect(refused).rejects.toMatchObject({ reason: 'agent_http_disabled', status: 403 });
  });

  it('refuses a reply without a key', async () => {
    const fetchImpl = reply(200, { ok: true, token: 'not-a-key' });
    await expect(
      requestAgentDelegateKey({ agentWorkerUrl: key.workerUrl, sessionSlug: 'salon', workerToken: 'jwt', fetchImpl }),
    ).rejects.toMatchObject({ status: 200 });
  });
});
