import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ROUTE_AUTH,
  ROUTE_INVENTORY,
  ROUTE_INVENTORY_BY_KEY,
  routeKey,
} from '../lib/routeInventory.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROUTER_SOURCE = readFileSync(resolve(__dirname, '..', 'lib', 'router.mjs'), 'utf8');

const extractExactRouterRoutes = () => {
  const routes = [];
  const pattern = /if \(path === '([^']+)' && method === '([^']+)'\)/g;
  let match = pattern.exec(ROUTER_SOURCE);
  while (match) {
    routes.push({ path: match[1], method: match[2] });
    match = pattern.exec(ROUTER_SOURCE);
  }
  return routes;
};

const extractPrefixRouterRoutes = () => {
  const routes = [];
  const pattern = /if \(path\.startsWith\('([^']+)'\) && method === '([^']+)'\)/g;
  let match = pattern.exec(ROUTER_SOURCE);
  while (match) {
    const prefix = match[1];
    routes.push({ path: `${prefix}${prefix.endsWith('/') ? ':id' : '/:id'}`, method: match[2], match: 'prefix' });
    match = pattern.exec(ROUTER_SOURCE);
  }
  return routes;
};

test('route inventory covers every exact route branch in router.mjs', () => {
  const routerKeys = [
    ...extractExactRouterRoutes(),
    ...extractPrefixRouterRoutes(),
  ].map(routeKey).sort();
  const inventoryKeys = ROUTE_INVENTORY.map(routeKey).sort();

  assert.deepEqual(inventoryKeys, routerKeys);
});

test('route inventory records auth requirement, owner, and response smoke shape', () => {
  const seen = new Set();
  for (const route of ROUTE_INVENTORY) {
    const key = routeKey(route);
    assert.equal(seen.has(key), false, `duplicate route inventory key: ${key}`);
    seen.add(key);
    assert.equal(typeof route.path, 'string');
    assert.match(route.path, /^\/api\//);
    assert.match(route.method, /^(GET|POST)$/);
    assert.ok(route.match === undefined || route.match === 'prefix', `unknown match mode for ${key}`);
    assert.ok(Object.values(ROUTE_AUTH).includes(route.auth), `unknown auth mode for ${key}`);
    assert.equal(typeof route.authHelper, 'string');
    assert.notEqual(route.authHelper.trim(), '');
    assert.equal(typeof route.owner, 'string');
    assert.notEqual(route.owner.trim(), '');
    assert.equal(typeof route.responseShape, 'string');
    assert.notEqual(route.responseShape.trim(), '');
    assert.deepEqual(ROUTE_INVENTORY_BY_KEY[key], route);
  }
});

test('only local JWT issuance uses trusted-local auth instead of bearer auth', () => {
  const trustedLocalRoutes = ROUTE_INVENTORY
    .filter((route) => route.auth === ROUTE_AUTH.TRUSTED_LOCAL)
    .map(routeKey);

  assert.deepEqual(trustedLocalRoutes, ['POST /api/auth/local-jwt']);
});

test('route inventory records the auth helper planned for router decomposition', () => {
  for (const route of ROUTE_INVENTORY) {
    if (route.auth === ROUTE_AUTH.TRUSTED_LOCAL) {
      assert.equal(route.authHelper, 'requireTrustedLocalRequest');
    } else {
      assert.equal(route.authHelper, 'requireLocalJwtAuth');
    }
  }
});
