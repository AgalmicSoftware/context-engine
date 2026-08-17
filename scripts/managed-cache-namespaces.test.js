'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const readRepoFile = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

test('managed cache consumers and documentation share the canonical namespace registry', () => {
  const registry = JSON.parse(readRepoFile('client/src/utilities/cache/managedCacheNamespaces.json'));
  const managedNamespaces = registry.managedNamespaces;
  const uniqueNamespaces = [...new Set(managedNamespaces)];

  assert.deepEqual(managedNamespaces, uniqueNamespaces);
  assert.ok(managedNamespaces.includes('analysisCache'));
  assert.ok(managedNamespaces.every((namespace) => typeof namespace === 'string' && namespace.length > 0));

  const constantsSource = readRepoFile('client/src/utilities/cache/sessionCacheConstants.ts');
  const cacheScriptsSource = readRepoFile('client/src/utilities/cache/cacheScripts.ts');
  const guardSource = readRepoFile('scripts/check-managed-cache-localstorage.sh');
  assert.match(constantsSource, /managedCacheNamespaces\.json/);
  assert.match(cacheScriptsSource, /DG_MANAGED_CACHE_NAMESPACE_LIST/);
  assert.match(guardSource, /managedCacheNamespaces\.json/);

  const cacheDocs = readRepoFile('docs/cache/README.md');
  const managedSection = cacheDocs.split('## Managed namespaces')[1].split('Logical key format:')[0];
  const documentedNamespaces = [...managedSection.matchAll(/^- `([^`]+)`$/gm)].map((match) => match[1]);
  assert.deepEqual(documentedNamespaces, managedNamespaces);
});
