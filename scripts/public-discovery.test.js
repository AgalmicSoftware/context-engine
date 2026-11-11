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
  assert.match(skillMd, /^# Taking part in a Context Engine session as an AI agent\n/);
  assert.match(skillMd, /`npx -y --prefer-online @agalmic\/contextengine@latest`/);
  assert.match(skillMd, /`CE_MCP_STATE_DIR`/);
  assert.match(skillMd, /Call `join_session` with the session link exactly as you received it/);
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

test('sitemap only includes raw-html crawlable discovery pages', () => {
  assert.deepEqual(extractSitemapLocs(sitemapXml), rawHtmlDiscoveryUrls);
});
