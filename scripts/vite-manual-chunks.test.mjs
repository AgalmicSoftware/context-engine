import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveManualChunk } from '../client/vite.config.mjs';

test('bootstrap helpers do not inherit a chain vendor chunk', () => {
  assert.equal(resolveManualChunk('\0commonjsHelpers.js'), 'vendor-runtime');
  assert.equal(resolveManualChunk('\0vite/preload-helper'), 'vendor-runtime');
  assert.equal(resolveManualChunk('/repo/node_modules/@tanstack/react-query-persist-client/build/modern/index.js'), 'vendor-react');
  assert.equal(resolveManualChunk('/repo/src/components/App.tsx'), undefined);
});
