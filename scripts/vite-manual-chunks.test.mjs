import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveManualChunk } from '../client/vite.config.mjs';

test('bootstrap helpers do not inherit a chain vendor chunk', () => {
  assert.equal(resolveManualChunk('\0commonjsHelpers.js'), 'vendor-runtime');
  assert.equal(resolveManualChunk('\0vite/preload-helper'), 'vendor-runtime');
  assert.equal(
    resolveManualChunk('/repo/node_modules/@tanstack/react-query-persist-client/build/modern/index.js'),
    'vendor-react',
  );
  assert.equal(resolveManualChunk('/repo/src/components/App.tsx'), undefined);
});

test('bignumber.js stays with the lazily loaded Arweave SDK', () => {
  assert.equal(resolveManualChunk('/repo/node_modules/bignumber.js/bignumber.mjs'), 'vendor-arweave');
});

test('QR code libraries stay out of the vendor-ui chunk that loads with AppShell', () => {
  assert.equal(resolveManualChunk('/repo/node_modules/qrcode.react/lib/esm/index.js'), 'vendor-qrcode');
  assert.equal(resolveManualChunk('/repo/node_modules/qrcode/lib/browser.js'), 'vendor-qrcode');
  assert.equal(resolveManualChunk('/repo/node_modules/dijkstrajs/dijkstra.js'), 'vendor-qrcode');
  assert.equal(resolveManualChunk('/repo/node_modules/reactstrap/dist/reactstrap.modern.js'), 'vendor-ui');
});

test('shared test IDs get their own chunk instead of growing the AppShell chunk', () => {
  assert.equal(resolveManualChunk('/repo/client/src/utilities/e2eTestIds.json'), 'e2e-test-ids');
  assert.equal(resolveManualChunk('/repo/client/src/utilities/e2eTestIds.ts'), undefined);
});
