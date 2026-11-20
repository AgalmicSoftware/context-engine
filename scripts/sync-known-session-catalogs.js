'use strict';

// Gives each session in known-sessions.json with an interviewCatalog an address
// on the site, https://contextengine.sh/questions/<slug>, which the host passes
// through to that catalog (a 200 rule in client/public/_redirects). Many chat
// apps open only an address they were shown, and some refuse a Worker's own
// host, so the site address is written out word for word in the site's agent
// note (client/index.html, served for every session link), llms.txt and the top
// of the agent guide (/skill.md). Nothing stores the questions.
// Run after editing known-sessions.json: node scripts/sync-known-session-catalogs.js
// scripts/public-discovery.test.js fails while the files differ from it.

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const SITE = 'https://contextengine.sh';
const HTML_MARKERS = ['<!-- known-session-catalogs: generated from known-sessions.json -->', '<!-- /known-session-catalogs -->'];
const RULE_MARKERS = ['# known-session-catalogs: generated from known-sessions.json', '# /known-session-catalogs'];
// Characters a _redirects target may hold as they are: no space, and nothing to percent-encode.
const PLAIN_VALUE = /^[A-Za-z0-9:/._-]+$/;

// The Worker reads the same catalog whether sessionUrl is percent-encoded or not;
// the rule's target leaves it plain, so the host has nothing to decode or re-encode.
const passThroughTarget = (slug, catalog) => {
  const url = new URL(catalog);
  const keys = [...url.searchParams.keys()];
  const sessionUrl = url.searchParams.get('sessionUrl');
  if (keys.join() !== 'slug,sessionUrl' || url.searchParams.get('slug') !== slug || !PLAIN_VALUE.test(slug) || !PLAIN_VALUE.test(sessionUrl || '')) {
    throw new Error(`${slug}: interviewCatalog is not slug and sessionUrl alone, in plain characters`);
  }
  return `${url.origin}${url.pathname}?slug=${slug}&sessionUrl=${sessionUrl}`;
};

const listed = (knownSessions) =>
  Object.entries(knownSessions)
    .filter(([, entry]) => entry.interviewCatalog)
    .map(([slug, entry]) => ({
      slug,
      page: `${SITE}/session/${slug}`,
      title: entry.title || entry.name || slug,
      catalog: entry.interviewCatalog,
      questions: `${SITE}/questions/${slug}`,
      target: passThroughTarget(slug, entry.interviewCatalog),
    }));

const escapeHtml = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// No punctuation follows an address, so one copied whole is the address itself.
const htmlBlock = (sessions, indent) =>
  [
    'The listed sessions, each link with the address of its questions after it, one per line:',
    ...sessions.map(({ page, title, questions }) => `${page} (${escapeHtml(title)}): ${questions}`),
  ]
    .map((line) => `${indent}${line}`)
    .join('\n');

const llmsBlock = (sessions) =>
  sessions.map(({ page, title, questions }) => `  - ${page} (${title}): ${questions}`).join('\n');

const mdBlock = (sessions) =>
  [
    '## Sessions listed on this site',
    '',
    'Each session link, then the address its questions are read from to draft',
    'answers for review. Fetch that address exactly as written here; "Suggested',
    'answers for the person to review" says what to do with it. Without tools,',
    'your first reply still gives the link back and offers to draft (see',
    '"Without tools: give the link, offer to draft").',
    '',
    ...sessions.map(({ page, title, questions }) => `- ${page} (${title}):\n  ${questions}`),
  ].join('\n');

// Before the catch-all, so the host's first match is the pass-through.
const rulesBlock = (sessions) => sessions.map(({ questions, target }) => `${questions.slice(SITE.length)} ${target} 200`).join('\n');

const replaceBlocks = (text, render, file, [begin, end]) => {
  const parts = text.split(begin);
  if (parts.length < 2) throw new Error(`${file} has no ${begin} marker`);
  return parts
    .map((part, i) => {
      if (i === 0) return part;
      const at = part.indexOf(end);
      if (at < 0) throw new Error(`${file} has a ${begin} marker without ${end}`);
      const indent = (parts[i - 1].match(/\n([ \t]*)$/) || [, ''])[1];
      return `\n${render(indent)}\n${indent}${part.slice(at)}`;
    })
    .join(begin);
};

const targets = (knownSessions) => {
  const sessions = listed(knownSessions);
  return [
    ['client/index.html', (indent) => htmlBlock(sessions, indent), HTML_MARKERS],
    ['client/public/agent-guide.md', () => mdBlock(sessions), HTML_MARKERS],
    ['client/public/llms.txt', () => llmsBlock(sessions), HTML_MARKERS],
    ['client/public/_redirects', () => rulesBlock(sessions), RULE_MARKERS],
  ];
};

// Returns each target file's text as it should be, beside what is checked in.
const expectedFiles = (knownSessions = JSON.parse(fs.readFileSync(path.join(repoRoot, 'known-sessions.json'), 'utf8'))) =>
  targets(knownSessions).map(([file, render, markers]) => {
    const actual = fs.readFileSync(path.join(repoRoot, file), 'utf8');
    return { file, actual, expected: replaceBlocks(actual, render, file, markers) };
  });

if (require.main === module) {
  for (const { file, actual, expected } of expectedFiles()) {
    if (actual === expected) continue;
    fs.writeFileSync(path.join(repoRoot, file), expected);
    console.log(`updated ${file}`);
  }
}

module.exports = { expectedFiles, listed };
