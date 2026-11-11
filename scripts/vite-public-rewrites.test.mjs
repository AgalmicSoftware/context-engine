import test from 'node:test';
import assert from 'node:assert/strict';
import viteConfig from '../client/vite.config.mjs';

const plugins = viteConfig({ mode: 'production' }).plugins.flat();
const rewritesPlugin = plugins.find((plugin) => plugin?.name === 'ce-public-rewrites');

// Runs a request URL through the plugin's middleware on a dev or preview server.
const rewrite = (hook, url) => {
  let middleware;
  rewritesPlugin[hook]({ middlewares: { use: (handler) => (middleware = handler) } });
  const req = { url };
  let nextCalls = 0;
  middleware(req, {}, () => (nextCalls += 1));
  assert.equal(nextCalls, 1, url);
  return req.url;
};

test('the dev and preview servers serve the guide for AI agents at /skill.md, as Netlify does', () => {
  for (const hook of ['configureServer', 'configurePreviewServer']) {
    assert.equal(rewrite(hook, '/skill.md'), '/agent-skill.md');
    assert.equal(rewrite(hook, '/skill.md?from=agent'), '/agent-skill.md?from=agent');
    // Wildcard rules, such as the SPA fallback, stay with each server's own handling.
    for (const url of ['/agent-skill.md', '/skill.md/more', '/session/demo-sh', '/.well-known/x', '/']) {
      assert.equal(rewrite(hook, url), url);
    }
  }
});

test('the dev server rewrites before it serves public files', () => {
  const names = plugins.map((plugin) => plugin?.name);
  assert.ok(names.includes('ce-public-rewrites'));
  assert.ok(names.indexOf('ce-public-rewrites') < names.indexOf('ce-public-assets-compatibility'));
});
