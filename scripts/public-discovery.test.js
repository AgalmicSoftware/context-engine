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
const sitemapXml = fs.readFileSync(path.join(repoRoot, 'client', 'public', 'sitemap.xml'), 'utf8');

const repoUrl = 'https://github.com/AgalmicSoftware/context-engine';
const repoSourceUrl = 'https://github.com/AgalmicSoftware/context-engine/tree/main';
const readmeUrl =
  'https://raw.githubusercontent.com/AgalmicSoftware/context-engine/main/README.md';
const architectureUrl =
  'https://raw.githubusercontent.com/AgalmicSoftware/context-engine/main/ARCHITECTURE.md';
const whitepaperUrl =
  'https://raw.githubusercontent.com/AgalmicSoftware/context-engine/main/whitepaper/whitepaper.md';
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
