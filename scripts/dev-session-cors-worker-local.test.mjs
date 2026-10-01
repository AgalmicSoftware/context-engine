import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

test('local Worker uses the receiving Host for signed Worker-origin binding', () => {
  const source = readFileSync(new URL('./dev-session-cors-worker-local.mjs', import.meta.url), 'utf8');
  const branch = source.match(/const origin = [^;]+;\n\s*const url = [^;]+;/)?.[0];
  assert.ok(branch);
  for (const requestHost of ['localhost:8787', '127.0.0.1:8787', undefined]) {
    const url = vm.runInNewContext(branch + '\nurl.href;', {
      host: '127.0.0.1', port: 8787, URL,
      req: { url: '/auth/login', headers: { host: requestHost } },
    });
    assert.equal(url, `http://${requestHost || '127.0.0.1:8787'}/auth/login`);
  }
});
