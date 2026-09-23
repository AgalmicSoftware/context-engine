#!/usr/bin/env node
import { pathToFileURL } from 'node:url';

// Read the actual kickoff requirement, not the list of legacy import versions.
export function readKickoffVersions(source) {
  const requirement = source.match(/prefillPromptVersion([\s\S]{0,350}?)otherwise stop/);
  if (!requirement) return null;
  let text = requirement[1];
  for (const [, identifier] of text.matchAll(/\$\{([\w$]+)\}/g)) {
    const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const definition = source.match(new RegExp(`\\b${escaped}\\s*=\\s*["'](ce-interview-brief-v\\d+)["']`));
    if (!definition) throw new Error(`Cannot resolve kickoff version variable ${identifier}.`);
    text = text.replace(`\${${identifier}}`, definition[1]);
  }
  const versions = [...new Set(text.match(/ce-interview-brief-v\d+/g) || [])];
  if (!versions.length) throw new Error('Cannot determine the served kickoff contract.');
  return versions;
}

async function readText(url, fetchImpl) {
  const response = await fetchImpl(url, { method: 'GET', credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`GET ${url} returned ${response.status}.`);
  return response.text();
}

function referencedScripts(source, baseUrl, origin) {
  const found = [];
  for (const [, path] of source.matchAll(/["'`]((?:\.?\.?\/|\/)?(?:assets\/)?[A-Za-z0-9_./-]+\.js)["'`]/g)) {
    const url = new URL(path, baseUrl);
    if (url.origin === origin) found.push(url.href);
  }
  return [...new Set(found)].sort((a, b) => Number(b.includes('SurveyPileViewMode')) - Number(a.includes('SurveyPileViewMode')));
}

export async function verifyInterviewCatalogCompatibility({ sessionUrl, workerUrl, fetchImpl = fetch }) {
  const session = new URL(sessionUrl);
  const slug = decodeURIComponent(session.pathname.match(/^\/session\/([^/]+)\/?$/)?.[1] || '');
  if (!slug || !['http:', 'https:'].includes(session.protocol)) throw new Error('Expected an HTTP(S) /session/<slug> URL.');
  const worker = new URL(workerUrl || session.searchParams.get('worker') || '');
  if (!['http:', 'https:'].includes(worker.protocol)) throw new Error('Expected an HTTP(S) Worker URL.');
  const html = await readText(session.href, fetchImpl);
  const queue = referencedScripts(html, session.href, session.origin);
  const seen = new Set();
  let versions;
  let clientAsset;
  while (queue.length && seen.size < 400) {
    const url = queue.shift();
    if (seen.has(url)) continue;
    seen.add(url);
    const source = await readText(url, fetchImpl);
    versions = readKickoffVersions(source);
    if (versions) { clientAsset = url; break; }
    // Vite's mapDeps entries are rooted at the app, whereas imports are relative to the asset.
    const scripts = referencedScripts(source.replace(/(["'`])assets\//g, '$1/assets/'), url, session.origin);
    queue.unshift(...scripts.filter((next) => !seen.has(next)));
  }
  if (!versions) throw new Error('Could not locate the served client kickoff contract within 400 assets.');
  const catalogUrl = new URL(`${worker.href.replace(/\/+$/, '')}/agent/interview-catalog`);
  catalogUrl.searchParams.set('slug', slug);
  catalogUrl.searchParams.set('sessionUrl', session.href);
  const catalog = JSON.parse(await readText(catalogUrl.href, fetchImpl));
  if (catalog.type !== 'context-engine.interview-question-catalog' || catalog.version !== 1 || catalog.sessionSlug !== slug) {
    throw new Error('The Worker did not return this session’s interview catalog.');
  }
  const compatible = versions.includes(catalog.prefillPromptVersion);
  return { compatible, sessionUrl: session.href, workerUrl: worker.href, clientAsset, supportedVersions: versions, catalogVersion: catalog.prefillPromptVersion };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const workerIndex = args.indexOf('--worker-url');
  try {
    if (!args[0] || (workerIndex < 0 && !new URL(args[0]).searchParams.has('worker'))) {
      throw new Error('Usage: node scripts/verify-interview-catalog-compat.mjs <sessionUrl> --worker-url <workerUrl>');
    }
    const result = await verifyInterviewCatalogCompatibility({ sessionUrl: args[0], workerUrl: workerIndex >= 0 ? args[workerIndex + 1] : undefined });
    console.log(JSON.stringify(result, null, 2));
    if (!result.compatible) process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
