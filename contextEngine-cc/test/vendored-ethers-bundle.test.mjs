import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CC_ROOT = resolve(__dirname, '..');
const EXPECTED_ETHERS_VERSION = '5.7.2';
const EXPECTED_BUNDLE_SHA256 = '2c6f578c2c12e5ded3d095953e6b30787c47429fa305106d0c13da71854fb503';
const REGEN_COMMAND = 'node scripts/vendor-cecc-ethers-bundle.js';

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

test('CE-CC vendored ethers bundle matches the declared package version and expected hash', () => {
  const packageJson = readJson(resolve(CC_ROOT, 'package.json'));
  const bundlePath = resolve(CC_ROOT, 'public/ethers.umd.min.js');
  const bundle = readFileSync(bundlePath);
  const bundleText = bundle.toString('utf8');
  const header =
    `/*! Vendored ethers UMD bundle v${EXPECTED_ETHERS_VERSION} from the ethers npm package dist/ethers.umd.min.js */`;
  const hash = createHash('sha256').update(bundle).digest('hex');

  assert.equal(
    packageJson.dependencies?.ethers,
    EXPECTED_ETHERS_VERSION,
    'contextEngine-cc/package.json dependencies.ethers must stay aligned with the vendored browser bundle'
  );
  assert.equal(
    bundleText.startsWith(`${header}\n`),
    true,
    `CE-CC vendored ethers bundle header must be ${header}. Regenerate with: ${REGEN_COMMAND}`
  );
  assert.equal(
    bundleText.includes(`ethers/${EXPECTED_ETHERS_VERSION}`),
    true,
    `CE-CC vendored ethers bundle must contain ethers/${EXPECTED_ETHERS_VERSION}. Regenerate with: ${REGEN_COMMAND}`
  );
  assert.equal(
    hash,
    EXPECTED_BUNDLE_SHA256,
    `CE-CC vendored ethers bundle SHA-256 drifted. Run ${REGEN_COMMAND}, inspect the minified diff, ` +
      'and update EXPECTED_BUNDLE_SHA256 only for an intentional vendor refresh.'
  );
});

test('CE-CC vendoring script is documented from the repo root', () => {
  const readme = readFileSync(resolve(CC_ROOT, 'README.md'), 'utf8');
  assert.equal(readme.includes(REGEN_COMMAND), true);
  assert.equal(readme.includes(`ethers@${EXPECTED_ETHERS_VERSION}`), true);
  assert.equal(readme.includes('public/ethers.umd.min.js'), true);
});
