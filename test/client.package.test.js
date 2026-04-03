import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const readJson = (relativePath) => JSON.parse(readFileSync(resolve(rootDir, relativePath), 'utf8'));

test('client dev/build scripts stay rooted at / despite GitHub homepage metadata', () => {
  const pkg = readJson('client/package.json');

  assert.equal(pkg?.homepage, 'https://github.com/AgalmicSoftware/context-engine');
  assert.equal(pkg?.scripts?.dev, 'PUBLIC_URL=/ react-app-rewired start');
  assert.equal(pkg?.scripts?.build, 'PUBLIC_URL=/ react-app-rewired build');
});
