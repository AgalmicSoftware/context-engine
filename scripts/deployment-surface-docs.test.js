'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

test('deployment docs distinguish source, deploy templates, and release bundles', () => {
  const boundaryDoc = read('deploy/README.md');
  const structureDoc = read('docs/repo-structure.md');

  assert.match(boundaryDoc, /workers\/sessionCorsWorker\//);
  assert.match(boundaryDoc, /deploy\/cloudflare\/session-worker\//);
  assert.match(boundaryDoc, /dist\/sessionCorsWorker\.bundle\.js/);
  assert.match(boundaryDoc, /GitHub Worker-bundle releases/);
  assert.match(structureDoc, /`deploy\/` holds reviewed, installable deployment packages/);
});

test('session Worker docs keep immutable publication separate from latest promotion', () => {
  const workerDoc = read('docs/session-cors-worker.md');

  assert.match(workerDoc, /publish-worker-bundles\.yml[^\n]*publishes verified bundle/);
  assert.match(workerDoc, /promote-worker-bundles\.yml[^\n]*re-verifies/);
  assert.doesNotMatch(workerDoc, /publish-worker-bundles\.yml[^\n]*(?:marks|marked)[^\n]*latest/i);
});

test('session creation docs align mode-specific deployment inputs', () => {
  const creationDoc = read('docs/session-creation-guide.md');

  assert.match(
    creationDoc,
    /\| Cloudflare API token[^\n]*Agent Session Wrapped[^\n]*explicit legacy deploy-helper fallback[^\n]*not the native default/,
  );
  assert.match(creationDoc, /\| AI provider key[^\n]*every reachable `\/new` profile/);
});

test('session Worker docs define group authority, counts, and id compatibility', () => {
  const workerDoc = read('docs/session-cors-worker.md');

  assert.match(workerDoc, /complete active membership set[\s\S]*Durable Object/);
  assert.match(workerDoc, /principal indexes[\s\S]*cannot prove that the set is empty/);
  assert.match(workerDoc, /503 with reason `worker_group_projection_unavailable`/);
  assert.match(workerDoc, /`crypto\.randomUUID\(\)`/);
  assert.match(workerDoc, /`0x` plus 40 hexadecimal\s+characters/);
  assert.match(workerDoc, /legacy\s+address-shaped IDs remain readable/);
  assert.match(workerDoc, /Join returns the coordinator's post-mutation\s+`memberCount`/);
  assert.match(workerDoc, /session-visible leave[\s\S]*restricted leave/);
});

test('route docs preserve legacy address-shaped Worker group links', () => {
  for (const relativePath of ['CHANGELOG.md', 'docs/MainSite.MAP.md', 'docs/e2e-testid-api.md']) {
    const routeDoc = read(relativePath);
    assert.match(routeDoc, /non-address[\s\S]{0,160}Worker[\s\S]{0,160}`\/group\/<groupId>/i, relativePath);
    assert.match(
      routeDoc,
      /address-shaped[\s\S]{0,160}Worker[\s\S]{0,160}`\/groups\?sessionName=<slug>#group-<groupId>`/i,
      relativePath,
    );
  }
});
