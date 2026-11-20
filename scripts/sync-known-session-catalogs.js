'use strict';

// Writes each listed session's interviewCatalog address, word for word, into the
// site's agent note (client/index.html, served for every session link) and the
// top of the agent guide (/skill.md). Many chat apps open only an address they
// were shown, so the questions must be one fetch from the link a person pastes.
// Run after editing known-sessions.json: node scripts/sync-known-session-catalogs.js
// scripts/public-discovery.test.js fails while the files differ from it.

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const SITE = 'https://contextengine.sh';
const BEGIN = '<!-- known-session-catalogs: generated from known-sessions.json -->';
const END = '<!-- /known-session-catalogs -->';

const listed = (knownSessions) =>
  Object.entries(knownSessions)
    .filter(([, entry]) => entry.interviewCatalog)
    .map(([slug, entry]) => ({
      page: `${SITE}/session/${slug}`,
      title: entry.title || entry.name || slug,
      catalog: entry.interviewCatalog,
    }));

const escapeHtml = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// No punctuation follows an address, so one copied whole is the address itself.
const htmlBlock = (sessions, indent) =>
  [
    'The listed sessions, each link with its catalog address after it, one per line:',
    ...sessions.map(({ page, title, catalog }) => `${page} (${escapeHtml(title)}): ${catalog}`),
  ]
    .map((line) => `${indent}${line}`)
    .join('\n');

const mdBlock = (sessions) =>
  [
    '## Sessions listed on this site',
    '',
    'Each session link, then the address its questions are read from to draft',
    'answers for review. Fetch that address exactly as written here; "Suggested',
    'answers for the person to review" says what to do with it. Without tools,',
    'your first reply still gives the link back and offers to draft (see',
    '"Without tools: give the link, offer to draft"). Lines too long to wrap are',
    'left whole.',
    '',
    ...sessions.map(({ page, title, catalog }) => `- ${page} (${title}):\n  ${catalog}`),
  ].join('\n');

const replaceBlocks = (text, render, file) => {
  const parts = text.split(BEGIN);
  if (parts.length < 2) throw new Error(`${file} has no ${BEGIN} marker`);
  return parts
    .map((part, i) => {
      if (i === 0) return part;
      const end = part.indexOf(END);
      if (end < 0) throw new Error(`${file} has a ${BEGIN} marker without ${END}`);
      const indent = (parts[i - 1].match(/\n([ \t]*)$/) || [, ''])[1];
      return `\n${render(indent)}\n${indent}${part.slice(end)}`;
    })
    .join(BEGIN);
};

const targets = (knownSessions) => {
  const sessions = listed(knownSessions);
  return [
    ['client/index.html', (indent) => htmlBlock(sessions, indent)],
    ['client/public/agent-guide.md', () => mdBlock(sessions)],
  ];
};

// Returns each target file's text as it should be, beside what is checked in.
const expectedFiles = (knownSessions = JSON.parse(fs.readFileSync(path.join(repoRoot, 'known-sessions.json'), 'utf8'))) =>
  targets(knownSessions).map(([file, render]) => {
    const actual = fs.readFileSync(path.join(repoRoot, file), 'utf8');
    return { file, actual, expected: replaceBlocks(actual, render, file) };
  });

if (require.main === module) {
  for (const { file, actual, expected } of expectedFiles()) {
    if (actual === expected) continue;
    fs.writeFileSync(path.join(repoRoot, file), expected);
    console.log(`updated ${file}`);
  }
}

module.exports = { expectedFiles, listed };
