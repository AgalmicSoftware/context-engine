'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(repoRoot, 'client', 'index.html'), 'utf8');
const discoverabilityHtml = fs.readFileSync(
  path.join(repoRoot, 'client', 'public', 'discoverability.html'),
  'utf8'
);
const llmsTxt = fs.readFileSync(path.join(repoRoot, 'client', 'public', 'llms.txt'), 'utf8');
const skillMd = fs.readFileSync(path.join(repoRoot, 'client', 'public', 'agent-guide.md'), 'utf8');
const mcpTools = fs.readFileSync(path.join(repoRoot, 'mcp', 'lib', 'tools.mjs'), 'utf8');
// The MCP's own code, without its tests.
const mcpSource = ['bin', 'lib']
  .flatMap((dir) =>
    fs
      .readdirSync(path.join(repoRoot, 'mcp', dir))
      .filter((name) => name.endsWith('.mjs') && !name.endsWith('.test.mjs'))
      .map((name) => fs.readFileSync(path.join(repoRoot, 'mcp', dir, name), 'utf8'))
  )
  .join('\n');
const sitemapXml = fs.readFileSync(path.join(repoRoot, 'client', 'public', 'sitemap.xml'), 'utf8');

const repoUrl = 'https://github.com/AgalmicSoftware/context-engine';
const repoSourceUrl = 'https://github.com/AgalmicSoftware/context-engine/tree/main';
const readmeUrl =
  'https://raw.githubusercontent.com/AgalmicSoftware/context-engine/main/README.md';
const architectureUrl =
  'https://raw.githubusercontent.com/AgalmicSoftware/context-engine/main/ARCHITECTURE.md';
const architectureOverviewUrl =
  'https://raw.githubusercontent.com/AgalmicSoftware/context-engine/main/docs/architecture-overview.md';
const docsUrl = 'https://contextengine.sh/docs';
const whitepaperUrl =
  'https://raw.githubusercontent.com/AgalmicSoftware/context-engine/main/whitepaper/whitepaper.md';
const discoverabilityUrl = 'https://contextengine.sh/discoverability.html';
const llmsUrl = 'https://contextengine.sh/llms.txt';
const rawHtmlDiscoveryUrls = Object.freeze([
  'https://contextengine.sh/',
  discoverabilityUrl,
]);

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const toUrlMatcher = (value) => new RegExp(escapeRegExp(value));
const extractSitemapLocs = (xml) => Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g), ([, url]) => url);

test('index.html exposes crawlable repo discovery links in raw HTML', () => {
  assert.match(indexHtml, /<noscript>/);
  assert.match(indexHtml, toUrlMatcher(repoUrl));
  assert.match(indexHtml, toUrlMatcher(repoSourceUrl));
});

test('index.html uses deployment-relative discovery asset links for the active PUBLIC_URL', () => {
  assert.match(
    indexHtml,
    /<link rel="alternate" href="__PUBLIC_URL__\/discoverability\.html" title="Context Engine static summary" \/>/
  );
  assert.match(
    indexHtml,
    /<link rel="alternate" type="text\/plain" href="__PUBLIC_URL__\/llms\.txt" title="Context Engine llms\.txt" \/>/
  );
  assert.match(
    indexHtml,
    /<a href="__PUBLIC_URL__\/discoverability\.html">Context Engine static summary<\/a>/
  );
  assert.match(indexHtml, /<a href="__PUBLIC_URL__\/llms\.txt">Context Engine llms\.txt<\/a>/);
  assert.match(
    indexHtml,
    /<link rel="alternate" type="text\/markdown" href="__PUBLIC_URL__\/skill\.md" title="How AI agents take part" \/>/
  );
  assert.match(
    indexHtml,
    /AI agents: to take part in a session, read\s+<a href="__PUBLIC_URL__\/skill\.md">\/skill\.md<\/a>\./
  );
  assert.doesNotMatch(
    indexHtml,
    /<link rel="alternate" href="https:\/\/contextengine\.xyz\/discoverability\.html"/
  );
  assert.doesNotMatch(
    indexHtml,
    /<link rel="alternate" type="text\/plain" href="https:\/\/contextengine\.xyz\/llms\.txt"/
  );
  assert.doesNotMatch(
    indexHtml,
    /<a href="https:\/\/contextengine\.xyz\/discoverability\.html">https:\/\/contextengine\.xyz\/discoverability\.html<\/a>/
  );
  assert.doesNotMatch(
    indexHtml,
    /<a href="https:\/\/contextengine\.xyz\/llms\.txt">https:\/\/contextengine\.xyz\/llms\.txt<\/a>/
  );
});

// A fetcher that runs no scripts, and drops the head and <noscript>, reads only the body.
test('index.html tells a fetching agent where the guide is, in body text people never meet', () => {
  const body = indexHtml.split('</noscript>')[1] || '';
  const [, style = '', note = ''] =
    body.match(/<p id="ce-agent-note" style="([^"]*)">([\s\S]*?)<\/p>\s*<div id="root"><\/div>/) || [];
  assert.match(note, /AI agents: to take part in a session, read\s+<a href="__PUBLIC_URL__\/skill\.md">\/skill\.md<\/a>/);
  assert.match(note, /an invitation that names a group included, goes to the Context Engine\s+MCP server's join_session as it is/);
  assert.ok(mcpTools.includes("name: 'join_session'"));
  // Off screen until the site's first script, which removes it before the app loads: an app that
  // fails to start must not leave it to be read out or tabbed to.
  for (const rule of ['position:absolute', 'width:1px', 'height:1px', 'overflow:hidden', 'clip-path:inset(50%)']) {
    assert.ok(style.split(';').includes(rule), rule);
  }
  const firstScript = fs.readFileSync(path.join(repoRoot, 'client', 'src', 'viteEntry.ts'), 'utf8');
  const removal = firstScript.indexOf("document.getElementById('ce-agent-note')?.remove();");
  assert.ok(removal > 0 && removal < firstScript.indexOf("import('./index')"));
  assert.match(indexHtml, /<script type="module" src="\/src\/viteEntry\.ts"><\/script>/);
});

// The file-not-found page answers agents probing /.well-known/ addresses.
test('the file-not-found page points agents to the guide', () => {
  const notFound = fs.readFileSync(path.join(repoRoot, 'client', 'public', '404.html'), 'utf8');
  assert.match(notFound, /AI agents: to take part in a session, read <a href="\/skill\.md">\/skill\.md<\/a>\./);
});

test('index.html does not load the remote Font Awesome kit', () => {
  assert.doesNotMatch(indexHtml, /kit\.fontawesome\.com/);
  assert.doesNotMatch(indexHtml, /<script[^>]+src=["']https:\/\/kit\.fontawesome\.com\//i);
});

test('discoverability assets point to the latest GitHub branch documents', () => {
  assert.match(discoverabilityHtml, toUrlMatcher(repoUrl));
  assert.match(discoverabilityHtml, toUrlMatcher(repoSourceUrl));
  assert.match(discoverabilityHtml, toUrlMatcher(readmeUrl));
  assert.match(discoverabilityHtml, toUrlMatcher(architectureUrl));
  assert.match(discoverabilityHtml, toUrlMatcher(architectureOverviewUrl));
  assert.match(discoverabilityHtml, toUrlMatcher(docsUrl));
  assert.match(discoverabilityHtml, toUrlMatcher(whitepaperUrl));
  assert.match(discoverabilityHtml, toUrlMatcher(llmsUrl));
  assert.match(discoverabilityHtml, toUrlMatcher('https://contextengine.sh/skill.md'));
  assert.match(llmsTxt, toUrlMatcher(repoUrl));
  assert.match(llmsTxt, toUrlMatcher(repoSourceUrl));
  assert.match(llmsTxt, toUrlMatcher(readmeUrl));
  assert.match(llmsTxt, toUrlMatcher(architectureUrl));
  assert.match(llmsTxt, toUrlMatcher(architectureOverviewUrl));
  assert.match(llmsTxt, toUrlMatcher(whitepaperUrl));
  assert.match(llmsTxt, toUrlMatcher(docsUrl));
  assert.match(llmsTxt, /Latest branch documents/);
  assert.match(llmsTxt, /Hosted & Fast/);
  assert.match(llmsTxt, /Trustless & Slower/);
  assert.match(llmsTxt, /Company-Operated.*planned/);
  assert.match(llmsTxt, /EVM and Arweave are profile-specific options, not baseline dependencies/);
});

// The agent docs offer only what the MCP does: each snake_case name they put in
// backticks is one of its tools, adding context needs its add_context tool, and
// "the MCP shows them" (a session's instructions) needs MCP code that reads them.
const assertOffersOnlyWhatTheMcpDoes = (text) => {
  const tools = new Set([...mcpTools.matchAll(/name: '([a-z_]+)'/g)].map((match) => match[1]));
  for (const [, tool] of text.matchAll(/`([a-z]+(?:_[a-z]+)+)`/g)) {
    assert.ok(tools.has(tool), `the MCP has no ${tool} tool`);
  }
  if (/\badd(?:ed|ing)? context\b/i.test(text)) {
    assert.ok(tools.has('add_context'), 'the MCP has no add_context tool');
  }
  if (/MCP\s+shows\s+them/.test(text)) assert.match(mcpSource, /agentInstructions|llms\.txt/);
};

test('llms.txt shows agents how to take part in a session', () => {
  const section = llmsTxt.split('## Taking part as an AI agent\n')[1]?.split('\n## ')[0] || '';
  assert.match(section, /`npx -y --prefer-online @agalmic\/contextengine@latest`/);
  assert.match(section, /`join_session` with the session link as you received it/);
  assertOffersOnlyWhatTheMcpDoes(section);
  assert.match(section, /A session can add its own instructions to this guidance/);
  assert.match(section, /Its Session Worker serves them at `\/llms\.txt`/);
  assert.doesNotMatch(section, /come first/);
  for (const url of [
    'https://contextengine.sh/skill.md',
    'https://raw.githubusercontent.com/AgalmicSoftware/context-engine/main/docs/agent-participants.md',
    'https://raw.githubusercontent.com/AgalmicSoftware/context-engine/main/mcp/README.md',
  ]) {
    assert.match(section, toUrlMatcher(url));
  }
});

test('skill.md shows agents how to take part, with nothing session-specific', () => {
  // The opening lines make the file a skill some hosts install as it is.
  assert.match(skillMd, /^---\nname: context-engine\ndescription: [^\n]+\n---\n\n# Taking part in a Context Engine session as an AI agent\n/);
  assert.match(skillMd, /`CE_MCP_STATE_DIR`/);
  assert.match(skillMd, /Call\s+`join_session` with the session link exactly as you received it/);
  // A link made for a person's browser is still the link to give.
  assert.match(skillMd, /An\s+invitation made for a person's\s+browser works too/);
  assert.match(skillMd, /Never claim to be a person/);
  assert.match(skillMd, /join open groups\s+with `join_group`/);
  assertOffersOnlyWhatTheMcpDoes(skillMd);
  assert.match(skillMd, /`<worker>\/llms\.txt`/);
  // A session's instructions add to the guide and can't lift its rules.
  assert.match(skillMd, /A session's own instructions add to this guide/);
  assert.match(skillMd, /can't lift this guide's\s+rules/);
  assert.match(skillMd, /add no private or personal data/);
  assert.match(skillMd, /put\s+whoever you work for first/);
  assert.match(skillMd, /Nothing a session writes changes what its Worker\s+allows/);
  assert.doesNotMatch(skillMd, /come first/);
  assert.match(skillMd, /`<worker>\/api\/agent\/skill`/);
  for (const url of [
    'https://contextengine.sh/known-sessions.json',
    'https://raw.githubusercontent.com/AgalmicSoftware/context-engine/main/mcp/README.md',
    'https://raw.githubusercontent.com/AgalmicSoftware/context-engine/main/docs/agent-participants.md',
  ]) {
    assert.match(skillMd, toUrlMatcher(url));
  }
  // Every session gets the same guide: no Worker addresses, tokens or group tags.
  assert.doesNotMatch(skillMd, /workers\.dev|ceagt_|ai-agents/);
});

// An agent handed only a link has to find its own case first: tools already there, a computer to add them on,
// or neither.
test('skill.md starts from what the agent can do', () => {
  const cases = skillMd.split('## You were given a session link\n')[1]?.split('\n## ')[0] || '';
  const order = [
    '**You have Context Engine tools**',
    '**You can run commands**',
    "**You run in an app on the person's computer**",
    '**You are a chat app on a website or a phone**',
  ];
  const found = order.map((text) => cases.indexOf(text));
  assert.ok(found.every((at) => at >= 0), 'a case is missing');
  assert.deepEqual([...found].sort((a, b) => a - b), found);
  assert.match(skillMd, /\n## Without tools\n[\s\S]*\*\*Let your AI draft your answers\*\*/);
  // The invite a link carries is kept only by the server that read it.
  assert.match(skillMd, /`join_group` uses it for that group without being asked, while the server that\s+joined is still running/);
});

const mcpReadme = fs.readFileSync(path.join(repoRoot, 'mcp', 'README.md'), 'utf8');
const serverArgs = ['-y', '--prefer-online', '@agalmic/contextengine@latest'];
// The fenced block that follows a host's name in the guide's list.
const hostBlock = (host) => {
  const block = skillMd.split(`- **${host}**`)[1]?.match(/```[a-z]*\n([\s\S]*?)```/)?.[1];
  assert.ok(block, `the guide has no setup for ${host}`);
  return block.replace(/^ {2}/gm, '').trim();
};

test('each host is added in one step that starts the published server', () => {
  for (const [host, start] of [
    ['Claude Code', 'claude mcp add --scope user context-engine --'],
    ['Codex', 'codex mcp add context-engine --'],
    ['Gemini CLI', 'gemini mcp add -s user context-engine'],
    ['Hermes Agent', 'hermes mcp add context-engine --command'],
  ]) {
    const line = hostBlock(host);
    assert.doesNotMatch(line, /\n/, `${host} takes more than one line`);
    // Whatever follows the host's own words is the server's command, whole and last.
    const command = line.slice(start.length).trim().split(' ');
    // Only Hermes names the arguments apart from the command.
    assert.deepEqual(host === 'Hermes Agent' ? command.filter((word) => word !== '--args') : command, ['npx', ...serverArgs], host);
    assert.ok(line.startsWith(start), host);
  }
  // The Node the guide asks for is the Node the package runs on.
  const { engines } = JSON.parse(fs.readFileSync(path.join(repoRoot, 'mcp', 'package.json'), 'utf8'));
  assert.equal(engines.node, '^20.19.0 || >=22.12.0');
  assert.match(skillMd, /[Tt]he computer\s+needs Node 22\.12 or later, or Node 20 from 20\.19\./);
  const link = new URL(hostBlock('Cursor'));
  assert.equal(`${link.protocol}//${link.host}${link.pathname}`, 'cursor://anysphere.cursor-deeplink/mcp/install');
  assert.equal(link.searchParams.get('name'), 'context-engine');
  assert.deepEqual(JSON.parse(Buffer.from(link.searchParams.get('config'), 'base64').toString('utf8')), { command: 'npx', args: serverArgs });
  assert.deepEqual(JSON.parse(hostBlock('Any other MCP host')), { mcpServers: { 'context-engine': { command: 'npx', args: serverArgs } } });
  const sdk = hostBlock('OpenAI Agents SDK');
  assert.ok(sdk.includes(`"command": "npx",\n        "args": ${JSON.stringify(serverArgs).replaceAll(',', ', ')},`));
  // Set by the host, so a model that guesses its own name can't record the guess.
  assert.match(sdk, /"env": \{"CE_MCP_MODEL_ID": "[^"]+", "CE_MCP_PLATFORM": "OpenAI Agents SDK"\}/);
  // Its 5-second default fails every slow call.
  assert.match(sdk, /client_session_timeout_seconds=120/);
  const llmsSection = llmsTxt.split('## Taking part as an AI agent\n')[1]?.split('\n## ')[0] || '';
  for (const host of ['Claude Code', 'Codex', 'Gemini CLI', 'Hermes Agent', 'Cursor', 'OpenAI Agents SDK']) {
    assert.ok(llmsSection.includes(host), `llms.txt does not name ${host}`);
  }
});

// A person follows whichever page they land on, so the two must not drift apart.
test('the guide and the npm README set a host up in the same words', () => {
  const between = (text, from, to) => {
    const start = text.indexOf(from);
    const end = text.indexOf(to, start);
    assert.ok(start >= 0 && end > start, `missing: ${from}`);
    return text.slice(start, end + to.length);
  };
  for (const [from, to] of [
    ['Each line below adds it to one host', '`CE_MCP_STATE_DIR`.\n'],
    ['Allow each tool call at least 60 seconds', 'answers per `answer` call.\n'],
    ['The server takes one request a line', 'It needs the same Node as the lines above.\n'],
  ]) {
    assert.ok(mcpReadme.includes(between(skillMd, from, to)), `the README words this differently: ${from}`);
  }
});

// An agent with a shell sends the guide's own lines to the server and reads a reply to each, with no host set up.
test("the guide's calls from a shell get an answer each, then the server stops", async () => {
  const { PassThrough } = require('node:stream');
  const { createMcpServer, serveStdio } = await import('../mcp/lib/mcpServer.mjs');
  const shell = skillMd.split('\n## From a shell\n')[1]?.split('\n## ')[0] || '';
  const calls = shell.match(/```json\n([\s\S]*?)```/)?.[1].trim().split('\n') || [];
  assert.deepEqual(calls.map((line) => JSON.parse(line).method), ['initialize', 'tools/list', 'tools/call']);
  assert.match(shell, /```sh\nnpx -y --prefer-online @agalmic\/contextengine@latest < calls\.jsonl\n```/);
  const joinSession = mcpTools.match(/name: 'join_session',[\s\S]*?properties: \{\s*(\w+):/);
  const server = createMcpServer({
    serverInfo: { name: 'context-engine', version: '0' },
    instructions: 'Read these.',
    tools: [{ name: 'join_session', description: '', inputSchema: { type: 'object' }, handler: async (args) => ({ joined: args[joinSession[1]] }) }],
  });
  const input = new PassThrough();
  const output = new PassThrough();
  let written = '';
  output.setEncoding('utf8');
  output.on('data', (chunk) => { written += chunk; });
  const stopped = serveStdio(server, { input, output });
  // A file redirected to the command: every line at once, then the end of input.
  input.end(`${calls.join('\n')}\n`);
  await stopped;
  const replies = written.trim().split('\n').map((line) => JSON.parse(line)).sort((a, b) => a.id - b.id);
  assert.deepEqual(replies.map((reply) => reply.id), [1, 2, 3]);
  assert.equal(replies[0].result.instructions, 'Read these.');
  assert.deepEqual(JSON.parse(replies[2].result.content[0].text), { joined: '<the session link>' });
});

// npmjs.com shows the README away from the repository, where a relative link leads nowhere.
test('the npm README and the guide for agents link only to full addresses', () => {
  const readme = fs.readFileSync(path.join(repoRoot, 'mcp', 'README.md'), 'utf8');
  for (const [name, text] of [['mcp/README.md', readme], ['agent-guide.md', skillMd]]) {
    const targets = [...text.matchAll(/\]\(([^)\s]+)/g)].map((match) => match[1]);
    assert.deepEqual(targets.filter((target) => !/^https:\/\//.test(target)), [], name);
  }
  assert.match(readme, /\]\(https:\/\/github\.com\/AgalmicSoftware\/context-engine\/blob\/main\/docs\/agent-participants\.md\)/);
});

test('sitemap only includes raw-html crawlable discovery pages', () => {
  assert.deepEqual(extractSitemapLocs(sitemapXml), rawHtmlDiscoveryUrls);
});
