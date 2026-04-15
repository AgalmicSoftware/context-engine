'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(repoRoot, 'client', 'public', 'index.html'), 'utf8');
const discoverabilityHtml = fs.readFileSync(
  path.join(repoRoot, 'client', 'public', 'discoverability.html'),
  'utf8'
);
const llmsTxt = fs.readFileSync(path.join(repoRoot, 'client', 'public', 'llms.txt'), 'utf8');
const sitemapXml = fs.readFileSync(path.join(repoRoot, 'client', 'public', 'sitemap.xml'), 'utf8');

const repoUrl = 'https://github.com/AgalmicSoftware/context-engine';
const repoSourceUrl = 'https://github.com/AgalmicSoftware/context-engine/tree/main';
const readmeUrl =
  'https://raw.githubusercontent.com/AgalmicSoftware/context-engine/main/README.md';
const architectureUrl =
  'https://raw.githubusercontent.com/AgalmicSoftware/context-engine/main/ARCHITECTURE.md';
const whitepaperUrl =
  'https://raw.githubusercontent.com/AgalmicSoftware/context-engine/main/Whitepaper/whitepaper.md';
const discoverabilityUrl = 'https://contextengine.xyz/discoverability.html';
const llmsUrl = 'https://contextengine.xyz/llms.txt';
const rawHtmlDiscoveryUrls = Object.freeze([
  'https://contextengine.xyz/',
  discoverabilityUrl,
]);

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const toUrlMatcher = (value) => new RegExp(escapeRegExp(value));
const extractSitemapLocs = (xml) => Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g), ([, url]) => url);

test('index.html exposes crawlable repo discovery links in raw HTML', () => {
  assert.match(indexHtml, /<noscript>/);
  assert.match(indexHtml, toUrlMatcher(repoUrl));
  assert.match(indexHtml, toUrlMatcher(repoSourceUrl));
  assert.match(indexHtml, toUrlMatcher(discoverabilityUrl));
  assert.match(indexHtml, toUrlMatcher(llmsUrl));
});

test('discoverability assets point to the latest GitHub branch documents', () => {
  assert.match(discoverabilityHtml, toUrlMatcher(repoUrl));
  assert.match(discoverabilityHtml, toUrlMatcher(repoSourceUrl));
  assert.match(discoverabilityHtml, toUrlMatcher(readmeUrl));
  assert.match(discoverabilityHtml, toUrlMatcher(architectureUrl));
  assert.match(discoverabilityHtml, toUrlMatcher(whitepaperUrl));
  assert.match(discoverabilityHtml, toUrlMatcher(llmsUrl));
  assert.match(llmsTxt, toUrlMatcher(repoUrl));
  assert.match(llmsTxt, toUrlMatcher(repoSourceUrl));
  assert.match(llmsTxt, toUrlMatcher(readmeUrl));
  assert.match(llmsTxt, toUrlMatcher(architectureUrl));
  assert.match(llmsTxt, toUrlMatcher(whitepaperUrl));
  assert.match(llmsTxt, /Latest branch documents/);
});

test('sitemap only includes raw-html crawlable discovery pages', () => {
  assert.deepEqual(extractSitemapLocs(sitemapXml), rawHtmlDiscoveryUrls);
});
