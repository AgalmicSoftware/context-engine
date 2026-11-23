'use strict';

// Gives each session in known-sessions.json with an interviewCatalog an address
// on the site, https://contextengine.sh/questions/<slug>, which the host passes
// through to that catalog (a 200 rule in client/public/_redirects), and the same
// questions as short Markdown pages at /questions/<slug>.md (every id and type, and
// the page links) and /questions/<slug>/<page> (ten questions whole, or "link"),
// or /questions/<slug>/size/<k>/<page> for k a page, which a chat app's web reader
// passes on whole where it would summarize the whole list and drop the ids. Many chat
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
// A slug a _redirects path holds as it is (a ':' would make it a placeholder), and a session page
// a target holds as it is: no space, and nothing to percent-encode.
const PLAIN_SLUG = /^[a-z0-9][a-z0-9-]*$/;

// The Worker reads the same catalog whether sessionUrl is percent-encoded or not;
// the rule's target leaves it plain, so the host has nothing to decode or re-encode.
const passThroughTarget = (slug, entry) => {
  const url = new URL(entry.interviewCatalog);
  const page = `${SITE}/session/${slug}`;
  const keys = [...url.searchParams.keys()];
  if (
    !PLAIN_SLUG.test(slug) ||
    // The app's own /questions/results pages.
    slug === 'results' ||
    url.origin !== entry.worker ||
    url.pathname !== '/agent/interview-catalog' ||
    keys.join() !== 'slug,sessionUrl' ||
    url.searchParams.get('slug') !== slug ||
    url.searchParams.get('sessionUrl') !== page
  ) {
    throw new Error(`${slug}: interviewCatalog is not its Worker's catalog for ${page}`);
  }
  return `${url.origin}${url.pathname}?slug=${slug}&sessionUrl=${page}`;
};

// The Worker serves the pages at paths under the catalog route; site=1 has them link to the site's
// short addresses. A placeholder is substituted in a rule's target path, so the page goes there.
const pageTarget = (target, page) => target.replace('/agent/interview-catalog?', `/agent/interview-catalog/${page}?`) + '&site=1';

// The order chat AIs try a listed session's two JSON addresses in: the site's own first, since some chat
// AIs refuse a Worker's host and stop after a first failure; the Worker's catalog second. The prompt
// the site builds (knownSessionQuestionsAddresses in client/src/utilities/session/knownSessionsFile.ts)
// follows this order, and its test checks it. Ahead of both, the listed text gives the question pages'
// index, which a summarizing reader passes on whole with every id; the prompt carries the ids itself.
const tryOrder = ({ questions, catalog }) => [questions, catalog];
const FALLBACK =
  'If the first address does not open, fetch the JSON one, then the second address, exactly as written; if none opens, say so, ask the person to paste the questions and give your drafts of those as plain text with no review link, and never make questions up.';

const listed = (knownSessions) =>
  Object.entries(knownSessions)
    .filter(([, entry]) => entry.interviewCatalog)
    .map(([slug, entry]) => {
      const session = {
        slug,
        page: `${SITE}/session/${slug}`,
        title: entry.title || entry.name || slug,
        catalog: entry.interviewCatalog,
        questions: `${SITE}/questions/${slug}`,
        pages: `${SITE}/questions/${slug}.md`,
        target: passThroughTarget(slug, entry),
      };
      const [first, second] = tryOrder(session);
      return { ...session, first, second };
    });

const escapeHtml = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// No punctuation follows an address, so one copied whole is the address itself.
const htmlBlock = (sessions, indent) =>
  [
    'The listed sessions follow, each link with the address of its questions after it: an index of every question id that links pages of ten questions, to fetch in turn. On the next lines are the whole list as JSON and a second address.',
    FALLBACK,
    ...sessions.flatMap(({ page, title, pages, first, second }) => [`${page} (${escapeHtml(title)}): ${pages}`, `as JSON: ${first}`, `second address: ${second}`]),
  ]
    .map((line) => `${indent}${line}`)
    .join('\n');

const llmsBlock = (sessions) =>
  [
    `  - ${FALLBACK}`,
    ...sessions.map(({ page, title, pages, first, second }) => `  - ${page} (${title}): ${pages}\n    as JSON: ${first}\n    second address: ${second}`),
  ].join('\n');

const mdBlock = (sessions) =>
  [
    '## Sessions listed on this site',
    '',
    'Each session link, then the address of its questions: an index of every',
    'question id that links pages of ten questions and the link page, each to',
    'fetch in turn. Then the whole list as JSON, and a second address. Fetch',
    'them exactly as written here; "Draft answers for the person to review" says what to do with',
    'the questions. Able only to draft, your first reply still gives the link back',
    'and offers to draft (see "Draft only: give the link, offer to draft").',
    '',
    FALLBACK,
    '',
    ...sessions.map(({ page, title, pages, first, second }) => `- ${page} (${title}):\n  ${pages}\n  as JSON: ${first}\n  second address: ${second}`),
  ].join('\n');

// Before the catch-all, so the host's first match is the pass-through. A placeholder matches one path
// segment; the Worker answers only index, link and a page number, with a size of 1 to 40 or none.
// The size is in the path because the host drops a visitor's query on a rule whose target has one.
const rulesBlock = (sessions) =>
  sessions
    .flatMap(({ questions, target }) => {
      const at = questions.slice(SITE.length);
      return [
        `${at} ${target} 200`,
        `${at}.md ${pageTarget(target, 'index')} 200`,
        `${at}/:page ${pageTarget(target, ':page')} 200`,
        `${at}/size/:size/:page ${pageTarget(target, 'size/:size/:page')} 200`,
      ];
    })
    .join('\n');

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

module.exports = { expectedFiles, listed, replaceBlocks, FALLBACK };
